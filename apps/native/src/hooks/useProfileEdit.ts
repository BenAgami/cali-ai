import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { useAuth } from "@src/context/AuthContext";
import { apiClient, ApiError, API_BASE } from "@src/lib/api";
import type { GoalDraft } from "@src/types/user";

export function useProfileEdit() {
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);

  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState("BEGINNER");

  const [initialGoal, setInitialGoal] = useState<GoalDraft | null>(null);
  const [goalDraft, setGoalDraft] = useState<GoalDraft>({
    goalType: "STRENGTH",
    title: "",
    targetValue: "",
    targetUnit: "",
  });

  const fetchUser = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await apiClient.get<{ username: string; avatarUrl: string; experienceLevel: string; goals?: { goalType: string; title: string; targetValue?: number; targetUnit?: string }[] }>("/api/users/me", token);

      setUsername(data.username);
      setCharCount(data.username.length);
      setAvatarUri(data.avatarUrl);
      setExperienceLevel(data.experienceLevel);

      const activeGoal = data.goals?.[0];
      const snapshot: GoalDraft = {
        goalType: activeGoal?.goalType ?? "STRENGTH",
        title: activeGoal?.title ?? "",
        targetValue: activeGoal?.targetValue?.toString() ?? "",
        targetUnit: activeGoal?.targetUnit ?? "",
      };
      setInitialGoal(snapshot);
      setGoalDraft(snapshot);
    } catch {
      // ignore — screen will show stale/empty state
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

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

    try {
      const manipResult = await ImageManipulator.manipulate(result.assets[0].uri)
        .resize({ width: 400, height: 400 })
        .renderAsync()
        .then((ctx) => ctx.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 }));

      if (!token) return;

      const { uploadUrl, publicUrl } = await apiClient.post<{ uploadUrl: string; publicUrl: string }>("/api/users/me/avatar-upload-url", {}, token);

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: { uri: manipResult.uri, type: "image/jpeg", name: "avatar.jpg" } as unknown as BodyInit,
        headers: { "Content-Type": "image/jpeg" },
      });
      if (!uploadRes.ok) {
        Alert.alert("Error", "Failed to upload image.");
        return;
      }

      await apiClient.patch("/api/users/me", { avatarUrl: publicUrl }, token);

      setAvatarUri(publicUrl);
    } catch {
      Alert.alert("Error", "Something went wrong with the avatar upload.");
    }
  };

  const handleSave = async () => {
    if (username.trim().length < 3) {
      setUsernameError("Username must be at least 3 characters.");
      return;
    }
    if (username.trim().length > 30) {
      setUsernameError("Username must be at most 30 characters.");
      return;
    }

    setSaving(true);
    setUsernameError(null);

    try {
      await apiClient.patch("/api/users/me", { username: username.trim(), experienceLevel }, token);

      const goalChanged =
        goalDraft.goalType !== initialGoal?.goalType ||
        goalDraft.title !== initialGoal?.title ||
        goalDraft.targetValue !== initialGoal?.targetValue ||
        goalDraft.targetUnit !== initialGoal?.targetUnit;

      if (goalChanged && goalDraft.title.trim().length > 0) {
        await apiClient.post("/api/users/me/goals", {
          goalType: goalDraft.goalType,
          title: goalDraft.title,
          ...(goalDraft.targetValue ? { targetValue: Number(goalDraft.targetValue) } : {}),
          ...(goalDraft.targetUnit ? { targetUnit: goalDraft.targetUnit } : {}),
        }, token);
      }

      router.back();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setUsernameError("Username already taken.");
        return;
      }
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return {
    loading,
    saving,
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
}
