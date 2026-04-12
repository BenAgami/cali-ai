import { useState, useEffect, useRef } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@src/context/AuthContext";
import { userApi, ApiError, userKeys } from "@src/api";
import type { ExperienceLevel } from "@repo/common";
import type { GoalDraft } from "@src/types/user";

export const useProfileEdit = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("BEGINNER");
  const [initialGoal, setInitialGoal] = useState<GoalDraft | null>(null);
  const [goalDraft, setGoalDraft] = useState<GoalDraft>({
    goalType: "STRENGTH",
    title: "",
    targetValue: "",
    targetUnit: "",
  });

  const seededRef = useRef(false);

  const { isLoading } = useQuery({
    queryKey: userKeys.me(),
    queryFn: () => userApi.getMe(),
    enabled: !!token,
    select: (data) => {
      // Seed local form state once on first load — don't reset while user is editing
      if (seededRef.current) return data;
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

      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await userApi.updateProfile({
        username: username.trim(),
        experienceLevel,
      });

      const goalChanged =
        goalDraft.goalType !== initialGoal?.goalType ||
        goalDraft.title !== initialGoal?.title ||
        goalDraft.targetValue !== initialGoal?.targetValue ||
        goalDraft.targetUnit !== initialGoal?.targetUnit;

      if (goalChanged && goalDraft.title.trim().length > 0) {
        await userApi.upsertGoal({
          goalType: goalDraft.goalType,
          title: goalDraft.title,
          ...(goalDraft.targetValue ? { targetValue: Number(goalDraft.targetValue) } : {}),
          ...(goalDraft.targetUnit ? { targetUnit: goalDraft.targetUnit } : {}),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      router.back();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
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
      setAvatarUri(publicUrl);
      queryClient.invalidateQueries({ queryKey: userKeys.all });
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

  const handlePickImage = async (useCamera: boolean) => {
    setAvatarPickerVisible(false);

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const manipResult = await ImageManipulator.manipulate(result.assets[0].uri)
      .resize({ width: 400, height: 400 })
      .renderAsync()
      .then((ctx) => ctx.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 }));

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
    avatarPickerVisible,
    setExperienceLevel,
    setGoalDraft,
    setAvatarPickerVisible,
    handleUsernameChange,
    handlePickImage,
    handleSave,
    handleCancel: router.back,
  };
};
