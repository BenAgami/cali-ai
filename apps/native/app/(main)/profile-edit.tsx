import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { SaveFormat } from "expo-image-manipulator";

import { useTheme } from "@src/context/ThemeContext";
import { useAuth } from "@src/context/AuthContext";
import AvatarDisplay from "@src/components/AvatarDisplay";

const API_BASE = "http://localhost:3000";

type GoalDraft = {
  goalType: string;
  title: string;
  targetValue: string;
  targetUnit: string;
};

type UserData = {
  username: string;
  email: string;
  avatarUrl: string | null;
  experienceLevel: string;
  goals: {
    goalType: string;
    title: string;
    targetValue: number | null;
    targetUnit: string | null;
  }[];
};

const EXPERIENCE_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const GOAL_TYPES = [
  "SKILL",
  "STRENGTH",
  "ENDURANCE",
  "MOBILITY",
  "CONSISTENCY",
] as const;

const ProfileEditScreen: React.FC = () => {
  const { colors } = useTheme();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);

  // Profile fields
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<string>("BEGINNER");

  // Goal draft + initial snapshot for change detection
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
      const res = await fetch(`${API_BASE}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success) return;
      const userData: UserData = json.data;

      setUsername(userData.username);
      setCharCount(userData.username.length);
      setAvatarUri(userData.avatarUrl);
      setExperienceLevel(userData.experienceLevel);

      const activeGoal = userData.goals?.[0];
      const snapshot: GoalDraft = {
        goalType: activeGoal?.goalType ?? "STRENGTH",
        title: activeGoal?.title ?? "",
        targetValue: activeGoal?.targetValue?.toString() ?? "",
        targetUnit: activeGoal?.targetUnit ?? "",
      };
      setInitialGoal(snapshot);
      setGoalDraft(snapshot);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

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

    const pickedUri = result.assets[0].uri;

    try {
      // Resize to 400x400 JPEG
      const manipResult = await ImageManipulator.manipulate(pickedUri)
        .resize({ width: 400, height: 400 })
        .renderAsync()
        .then((ctx) => ctx.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 }));

      const croppedUri = manipResult.uri;

      if (!token) return;

      // Get presigned upload URL
      const urlRes = await fetch(`${API_BASE}/api/users/me/avatar-upload-url`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!urlRes.ok) {
        Alert.alert("Error", "Failed to get upload URL.");
        return;
      }
      const urlJson = await urlRes.json();
      const { uploadUrl, publicUrl } = urlJson.data;

      // Upload to R2
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: { uri: croppedUri, type: "image/jpeg", name: "avatar.jpg" } as unknown as BodyInit,
        headers: { "Content-Type": "image/jpeg" },
      });
      if (!uploadRes.ok) {
        Alert.alert("Error", "Failed to upload image.");
        return;
      }

      // Save public URL to profile
      await fetch(`${API_BASE}/api/users/me`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ avatarUrl: publicUrl }),
      });

      setAvatarUri(publicUrl);
    } catch {
      Alert.alert("Error", "Something went wrong with the avatar upload.");
    }
  };

  const postMyGoal = async (draft: GoalDraft) => {
    if (!token) return;
    await fetch(`${API_BASE}/api/users/me/goals`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        goalType: draft.goalType,
        title: draft.title,
        ...(draft.targetValue
          ? { targetValue: Number(draft.targetValue) }
          : {}),
        ...(draft.targetUnit ? { targetUnit: draft.targetUnit } : {}),
      }),
    });
  };

  const handleSave = async () => {
    // Validate username length
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
      // PATCH /me for username + experienceLevel
      const patchRes = await fetch(`${API_BASE}/api/users/me`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          experienceLevel,
        }),
      });

      if (patchRes.status === 409) {
        setUsernameError("Username already taken.");
        setSaving(false);
        return;
      }

      if (!patchRes.ok) {
        Alert.alert("Error", "Failed to update profile.");
        setSaving(false);
        return;
      }

      // POST /me/goals only if goal fields changed
      const goalChanged =
        goalDraft.goalType !== initialGoal?.goalType ||
        goalDraft.title !== initialGoal?.title ||
        goalDraft.targetValue !== initialGoal?.targetValue ||
        goalDraft.targetUnit !== initialGoal?.targetUnit;

      if (goalChanged && goalDraft.title.trim().length > 0) {
        await postMyGoal(goalDraft);
      }

      router.back();
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const handleUsernameChange = (text: string) => {
    setUsername(text);
    setCharCount(text.length);
    if (usernameError) setUsernameError(null);
  };

  const inputStyle = [
    styles.textInput,
    {
      backgroundColor: colors.surface,
      color: colors.text,
      borderColor: colors.text + "33",
    },
  ];

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color={colors.text} style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={() => setAvatarPickerVisible(true)}
            activeOpacity={0.8}
          >
            <AvatarDisplay
              uri={avatarUri}
              username={username || "U"}
              size={90}
            />
            <View style={[styles.editAvatarBadge, { backgroundColor: "#007AFF" }]}>
              <Text style={styles.editAvatarBadgeText}>Edit</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Username */}
        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabelRow}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>
              Username
            </Text>
            <Text style={[styles.charCount, { color: colors.text }]}>
              {charCount}/30
            </Text>
          </View>
          <TextInput
            style={inputStyle}
            value={username}
            onChangeText={handleUsernameChange}
            autoCapitalize="none"
            maxLength={30}
            placeholder="Your username"
            placeholderTextColor={colors.text + "66"}
          />
          {usernameError && (
            <Text style={styles.fieldError}>{usernameError}</Text>
          )}
        </View>

        {/* Experience Level */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>
            Experience Level
          </Text>
          <View style={styles.segmentRow}>
            {EXPERIENCE_LEVELS.map((level) => {
              const active = experienceLevel === level;
              return (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.segmentButton,
                    {
                      backgroundColor: active ? "#007AFF" : colors.surface,
                      borderColor: active ? "#007AFF" : colors.text + "33",
                    },
                  ]}
                  onPress={() => setExperienceLevel(level)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? "#FFFFFF" : colors.text },
                    ]}
                  >
                    {level.charAt(0) + level.slice(1).toLowerCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Goal */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Goal</Text>

          <Text style={[styles.subLabel, { color: colors.text }]}>
            Goal Type
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.goalTypeRow}
          >
            {GOAL_TYPES.map((gt) => {
              const active = goalDraft.goalType === gt;
              return (
                <TouchableOpacity
                  key={gt}
                  style={[
                    styles.goalTypeButton,
                    {
                      backgroundColor: active ? "#007AFF" : colors.surface,
                      borderColor: active ? "#007AFF" : colors.text + "33",
                    },
                  ]}
                  onPress={() =>
                    setGoalDraft((prev) => ({ ...prev, goalType: gt }))
                  }
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.goalTypeText,
                      { color: active ? "#FFFFFF" : colors.text },
                    ]}
                  >
                    {gt.charAt(0) + gt.slice(1).toLowerCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[styles.subLabel, { color: colors.text }]}>
            Goal Title
          </Text>
          <TextInput
            style={inputStyle}
            value={goalDraft.title}
            onChangeText={(t) =>
              setGoalDraft((prev) => ({ ...prev, title: t }))
            }
            placeholder="e.g., Learn planche, Get to 20 push-ups"
            placeholderTextColor={colors.text + "66"}
            maxLength={100}
          />

          <Text style={[styles.subLabel, { color: colors.text }]}>
            Target (optional)
          </Text>
          <View style={styles.targetRow}>
            <TextInput
              style={[inputStyle, styles.targetValueInput]}
              value={goalDraft.targetValue}
              onChangeText={(t) =>
                setGoalDraft((prev) => ({ ...prev, targetValue: t }))
              }
              placeholder="e.g., 20"
              placeholderTextColor={colors.text + "66"}
              keyboardType="numeric"
            />
            <TextInput
              style={[inputStyle, styles.targetUnitInput]}
              value={goalDraft.targetUnit}
              onChangeText={(t) =>
                setGoalDraft((prev) => ({ ...prev, targetUnit: t }))
              }
              placeholder="e.g., reps"
              placeholderTextColor={colors.text + "66"}
            />
          </View>
        </View>

        {/* Action buttons */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: saving ? "#007AFF88" : "#007AFF" },
          ]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: colors.text + "44" }]}
          onPress={handleCancel}
          activeOpacity={0.8}
        >
          <Text style={[styles.cancelButtonText, { color: colors.text }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Avatar picker modal */}
      <Modal
        visible={avatarPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAvatarPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAvatarPickerVisible(false)}
        >
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Change Avatar
            </Text>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handlePickImage(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.modalOptionText, { color: "#007AFF" }]}>
                Choose from Library
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handlePickImage(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.modalOptionText, { color: "#007AFF" }]}>
                Take Photo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => setAvatarPickerVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.modalOptionText, { color: "#E57373" }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

export default ProfileEditScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loader: {
    marginTop: 60,
  },
  container: {
    padding: 24,
    paddingBottom: 48,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 28,
  },
  editAvatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  editAvatarBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  charCount: {
    fontSize: 12,
    opacity: 0.5,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: "500",
    opacity: 0.6,
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  fieldError: {
    marginTop: 4,
    color: "#E57373",
    fontSize: 12,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
  },
  goalTypeRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  goalTypeButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  goalTypeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  targetRow: {
    flexDirection: "row",
    gap: 10,
  },
  targetValueInput: {
    flex: 1,
  },
  targetUnitInput: {
    flex: 2,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  modalOption: {
    paddingVertical: 14,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
