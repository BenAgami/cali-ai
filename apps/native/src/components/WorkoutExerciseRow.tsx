import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@src/context/ThemeContext";
import Stepper from "@src/components/Stepper";
import type { ExerciseType } from "@repo/common";

export interface DraftExerciseValues {
  sets: number;
  reps: number | null;
  durationSecs: number | null;
  restSecs: number;
}

export interface WorkoutExerciseRowProps {
  exerciseDisplayName: string;
  exerciseType: ExerciseType;
  values: DraftExerciseValues;
  onChange: (values: DraftExerciseValues) => void;
  onRemove: () => void;
  onDragStart: () => void;
  isActive: boolean;
}

const formatDuration = (s: number): string => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
};

const WorkoutExerciseRow: React.FC<WorkoutExerciseRowProps> = ({
  exerciseDisplayName,
  exerciseType,
  values,
  onChange,
  onRemove,
  onDragStart,
  isActive,
}) => {
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const isStatic = exerciseType === "STATIC_HOLD";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface },
        isActive && styles.active,
      ]}
    >
      <View style={styles.headerRow}>
        <Pressable
          onLongPress={onDragStart}
          delayLongPress={150}
          style={styles.dragHandle}
          accessibilityRole="button"
          accessibilityLabel={`Reorder ${exerciseDisplayName}`}
        >
          <Ionicons
            name="reorder-three-outline"
            size={22}
            color={colors.text}
          />
        </Pressable>
        <Pressable
          onPress={() => setIsExpanded((v) => !v)}
          style={styles.headerLabel}
          accessibilityRole="button"
          accessibilityLabel={`${isExpanded ? "Collapse" : "Expand"} ${exerciseDisplayName}`}
        >
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {exerciseDisplayName}
          </Text>
          <Text style={[styles.summary, { color: colors.text }]}>
            {values.sets} ×{" "}
            {isStatic && values.durationSecs != null
              ? formatDuration(values.durationSecs)
              : `${values.reps ?? 0} reps`}
            {" · "}
            {values.restSecs}s rest
          </Text>
        </Pressable>
        <Pressable
          onPress={onRemove}
          style={styles.removeButton}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${exerciseDisplayName}`}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </Pressable>
      </View>

      {isExpanded && (
        <View style={[styles.body, { borderTopColor: colors.background }]}>
          <Stepper
            label="Sets"
            value={values.sets}
            min={1}
            max={20}
            onChange={(sets) => onChange({ ...values, sets })}
          />
          {isStatic ? (
            <Stepper
              label="Duration"
              value={values.durationSecs ?? 30}
              min={5}
              max={600}
              step={5}
              onChange={(durationSecs) =>
                onChange({ ...values, durationSecs, reps: null })
              }
              format={formatDuration}
            />
          ) : (
            <Stepper
              label="Reps"
              value={values.reps ?? 8}
              min={1}
              max={50}
              onChange={(reps) =>
                onChange({ ...values, reps, durationSecs: null })
              }
            />
          )}
          <Stepper
            label="Rest"
            value={values.restSecs}
            min={0}
            max={300}
            step={5}
            onChange={(restSecs) => onChange({ ...values, restSecs })}
            format={(s) => `${s}s`}
          />
        </View>
      )}
    </View>
  );
};

export default WorkoutExerciseRow;

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    overflow: "hidden",
  },
  active: { opacity: 0.85, transform: [{ scale: 1.02 }] },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
  },
  dragHandle: { padding: 4 },
  headerLabel: { flex: 1 },
  name: { fontSize: 15, fontWeight: "700" },
  summary: { fontSize: 12, opacity: 0.6, marginTop: 2 },
  removeButton: { padding: 6 },
  body: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    gap: 4,
  },
});
