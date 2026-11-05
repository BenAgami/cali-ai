import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  EXPERIENCE_LEVELS,
  GOAL_TYPES,
  type ExperienceLevel,
  type GoalType,
} from "@repo/common";
import { useTheme } from "@src/context/ThemeContext";

interface AiProfilePrerequisiteProps {
  experienceLevel: ExperienceLevel | null;
  goalTitle: string;
  goalType: GoalType;
  onChangeLevel: (level: ExperienceLevel) => void;
  onChangeGoalTitle: (title: string) => void;
  onChangeGoalType: (type: GoalType) => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
}

const label = (value: string): string =>
  value.charAt(0) + value.slice(1).toLowerCase();

const AiProfilePrerequisite: React.FC<AiProfilePrerequisiteProps> = ({
  experienceLevel,
  goalTitle,
  goalType,
  onChangeLevel,
  onChangeGoalTitle,
  onChangeGoalType,
  onSave,
  saving,
  error,
}) => {
  const { colors } = useTheme();

  const renderChip = (text: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={text}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? "#007AFF" : colors.surface,
          borderColor: active ? "#007AFF" : colors.text + "33",
          opacity: pressed ? 0.8 : 1,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={{ color: active ? "#FFFFFF" : colors.text, fontSize: 13 }}>
        {text}
      </Text>
    </Pressable>
  );

  return (
    <View>
      <Text style={[styles.heading, { color: colors.text }]}>
        Tell us about your training
      </Text>

      <Text style={[styles.label, { color: colors.text }]}>
        Experience level
      </Text>
      <View style={styles.row}>
        {EXPERIENCE_LEVELS.map((level) =>
          renderChip(label(level), experienceLevel === level, () =>
            onChangeLevel(level),
          ),
        )}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Goal type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {GOAL_TYPES.map((type) =>
            renderChip(label(type), goalType === type, () =>
              onChangeGoalType(type),
            ),
          )}
        </View>
      </ScrollView>

      <Text style={[styles.label, { color: colors.text }]}>Goal</Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            color: colors.text,
            borderColor: colors.text + "33",
          },
        ]}
        value={goalTitle}
        onChangeText={onChangeGoalTitle}
        placeholder="e.g., Learn planche, Get to 20 push-ups"
        placeholderTextColor={colors.text + "66"}
        maxLength={100}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: saving || pressed ? "#007AFF88" : "#007AFF" },
        ]}
        onPress={onSave}
        disabled={saving}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>Save</Text>
      </Pressable>
    </View>
  );
};

export default AiProfilePrerequisite;

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  label: { fontSize: 14, fontWeight: "600", marginTop: 16, marginBottom: 8 },
  row: { flexDirection: "row", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  error: { color: "#E57373", fontSize: 13, marginTop: 8 },
  button: {
    marginTop: 24,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
});
