import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@src/context/ThemeContext";
import type { WorkoutPlanWithExercises } from "@repo/common";

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatExerciseCount = (n: number): string =>
  n === 1 ? "1 exercise" : `${n} exercises`;

export interface WorkoutCardProps {
  workout: WorkoutPlanWithExercises;
  onPress: (workoutPlanId: number) => void;
}

const WorkoutCard: React.FC<WorkoutCardProps> = ({ workout, onPress }) => {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onPress(workout.id)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Workout ${workout.name}, ${workout.exercises.length} exercises`}
    >
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {workout.name}
      </Text>
      <View style={styles.metaRow}>
        <Text style={[styles.meta, { color: colors.text }]}>
          {formatExerciseCount(workout.exercises.length)}
        </Text>
        <Text style={[styles.meta, { color: colors.text, opacity: 0.5 }]}>
          {formatDate(workout.updatedAt)}
        </Text>
      </View>
    </Pressable>
  );
};

export default WorkoutCard;

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  name: { fontSize: 18, fontWeight: "700" },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  meta: { fontSize: 13, opacity: 0.7 },
});
