import { useState, useRef, useEffect, useMemo } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { StatusCodes } from "http-status-codes";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { userApi, ApiError, userKeys } from "@src/api";
import { useProfile } from "@src/hooks/queries/useProfile";
import { useBodyMetricsForm } from "@src/hooks/useBodyMetricsForm";
import type { GoalDraft } from "@src/types/user";
import type { ExperienceLevel } from "@repo/common";

export const useProfileEdit = () => {
  const queryClient = useQueryClient();

  const [isAvatarPickerVisible, setIsAvatarPickerVisible] = useState(false);
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] =
    useState<ExperienceLevel | null>(null);
  const [initialGoal, setInitialGoal] = useState<GoalDraft | null>(null);
  const [goalDraft, setGoalDraft] = useState<GoalDraft>({
    goalType: "STRENGTH",
    title: "",
    targetValue: "",
    targetUnit: "",
  });

  const seededRef = useRef(false);

  const { data, isLoading } = useProfile();

  const initialBodyMetric = useMemo(
    () =>
      data?.bodyMetric
        ? {
            heightCm: data.bodyMetric.heightCm,
            weightKg: data.bodyMetric.weightKg,
          }
        : null,
    [data?.bodyMetric],
  );
  const bodyMetricsForm = useBodyMetricsForm(initialBodyMetric);
  const [bodyMetricsError, setBodyMetricsError] = useState<string | null>(null);

  useEffect(() => {
    if (!data || seededRef.current) return;
    seededRef.current = true;

    setUsername(data.username);
    setCharCount(data.username.length);
    setAvatarUri(data.avatarUrl);
    setExperienceLevel(data.experienceLevel);

    const activeGoal = data.goals[0];
    const snapshot: GoalDraft = {
      goalType: activeGoal?.goalType ?? "STRENGTH",
      title: activeGoal?.title ?? "",
      targetValue: activeGoal?.targetValue?.toString() ?? "",
      targetUnit: activeGoal?.targetUnit ?? "",
    };
    setInitialGoal(snapshot);
    setGoalDraft(snapshot);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await userApi.updateProfile({
        username: username.trim(),
        ...(experienceLevel ? { experienceLevel } : {}),
      });

      const hasGoalChanged =
        goalDraft.goalType !== initialGoal?.goalType ||
        goalDraft.title !== initialGoal?.title ||
        goalDraft.targetValue !== initialGoal?.targetValue ||
        goalDraft.targetUnit !== initialGoal?.targetUnit;

      if (hasGoalChanged && goalDraft.title.trim().length > 0) {
        await userApi.upsertGoal({
          goalType: goalDraft.goalType,
          title: goalDraft.title,
          ...(goalDraft.targetValue
            ? { targetValue: Number(goalDraft.targetValue) }
            : {}),
          ...(goalDraft.targetUnit ? { targetUnit: goalDraft.targetUnit } : {}),
        });
      }

      // Metrics are append-only: clearing both fields is a no-op, and an
      // unchanged save sends no request.
      if (!bodyMetricsForm.isEmpty) {
        const validated = bodyMetricsForm.validate();
        if (validated.ok && bodyMetricsForm.isChangedFrom(initialBodyMetric)) {
          await userApi.saveBodyMetrics(validated.data);
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
      router.back();
    },
    onError: (err) => {
      if (
        err instanceof ApiError &&
        err.status === Number(StatusCodes.CONFLICT)
      ) {
        setUsernameError("Username already taken.");
        return;
      }
      Alert.alert("Error", "Something went wrong. Please try again.");
    },
  });

  const avatarMutation = useMutation({
    mutationFn: async (fileUri: string) => {
      const { uploadUrl, publicUrl } = await userApi.getAvatarUploadUrl();
      await userApi.uploadAvatarToS3(uploadUrl, fileUri);
      await userApi.updateProfile({ avatarUrl: publicUrl });
      return publicUrl;
    },
    onSuccess: (publicUrl) => {
      // Append timestamp to bust React Native's Image cache when the URL is unchanged
      setAvatarUri(`${publicUrl}?t=${Date.now()}`);
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: () => {
      Alert.alert("Error", "Something went wrong with the avatar upload.");
    },
  });

  const handleUsernameChange = (text: string) => {
    setUsername(text);
    setCharCount(text.length);
    if (usernameError) setUsernameError(null);
  };

  const handlePickImage = async (canUseCamera: boolean) => {
    setIsAvatarPickerVisible(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 750));

    if (canUseCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== ImagePicker.PermissionStatus.GRANTED) {
        Alert.alert(
          "Camera Access Required",
          "Please enable camera access in your device settings to take a photo.",
        );
        return;
      }
    } else {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== ImagePicker.PermissionStatus.GRANTED) {
        Alert.alert(
          "Photo Library Access Required",
          "Please enable photo library access in your device settings to choose a photo.",
        );
        return;
      }
    }

    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    };

    const result = canUseCamera
      ? await ImagePicker.launchCameraAsync(pickerOptions)
      : await ImagePicker.launchImageLibraryAsync(pickerOptions);

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const manipResult = await ImageManipulator.manipulate(result.assets[0].uri)
      .resize({ width: 400, height: 400 })
      .renderAsync()
      .then((ctx) => ctx.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 }));

    setAvatarUri(manipResult.uri);
    avatarMutation.mutate(manipResult.uri);
  };

  const handleSave = () => {
    if (username.trim().length < 3) {
      setUsernameError("Username must be at least 3 characters.");
      return;
    }
    if (username.trim().length > 30) {
      setUsernameError("Username must be at most 30 characters.");
      return;
    }
    setUsernameError(null);
    if (!bodyMetricsForm.isEmpty) {
      const validated = bodyMetricsForm.validate();
      if (!validated.ok) {
        setBodyMetricsError(validated.message);
        return;
      }
    }
    setBodyMetricsError(null);
    saveMutation.mutate();
  };

  return {
    loading: isLoading,
    saving: saveMutation.isPending,
    username,
    usernameError,
    charCount,
    avatarUri,
    experienceLevel,
    goalDraft,
    bodyMetricsForm,
    bodyMetricsError,
    isAvatarPickerVisible,
    setExperienceLevel,
    setGoalDraft,
    setIsAvatarPickerVisible,
    handleUsernameChange,
    handlePickImage,
    handleSave,
    handleCancel: router.back,
  };
};
