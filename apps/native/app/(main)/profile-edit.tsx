import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";

import { useTheme } from "@src/context/ThemeContext";
import { useProfileEdit } from "@src/hooks/useProfileEdit";
import AvatarDisplay from "@src/components/AvatarDisplay";
import AvatarPickerModal from "@src/components/AvatarPickerModal";

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
  const {
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
    handleCancel,
  } = useProfileEdit();

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
        <ActivityIndicator
          size="large"
          color={colors.text}
          style={styles.loader}
        />
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
            <View
              style={[styles.editAvatarBadge, { backgroundColor: "#007AFF" }]}
            >
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

        {/* Actions */}
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

      <AvatarPickerModal
        visible={avatarPickerVisible}
        onClose={() => setAvatarPickerVisible(false)}
        onPickLibrary={() => handlePickImage(false)}
        onPickCamera={() => handlePickImage(true)}
      />
    </SafeAreaView>
  );
};

export default ProfileEditScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loader: { marginTop: 60 },
  container: { padding: 24, paddingBottom: 48 },
  avatarSection: { alignItems: "center", marginBottom: 28 },
  editAvatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  editAvatarBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  fieldGroup: { marginBottom: 24 },
  fieldLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  fieldLabel: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  charCount: { fontSize: 12, opacity: 0.5 },
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
  fieldError: { marginTop: 4, color: "#E57373", fontSize: 12 },
  segmentRow: { flexDirection: "row", gap: 8 },
  segmentButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  segmentText: { fontSize: 13, fontWeight: "600" },
  goalTypeRow: { flexDirection: "row", marginBottom: 4 },
  goalTypeButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  goalTypeText: { fontSize: 13, fontWeight: "600" },
  targetRow: { flexDirection: "row", gap: 10 },
  targetValueInput: { flex: 1 },
  targetUnitInput: { flex: 2 },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  saveButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  cancelButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelButtonText: { fontSize: 16, fontWeight: "500" },
});
