import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

import AiDisclaimer from "@src/components/AiDisclaimer";
import { useTheme } from "@src/context/ThemeContext";
import { useWorkoutDetail } from "@src/hooks/queries/useWorkoutDetail";
import { useDeleteWorkout } from "@src/hooks/mutations/useDeleteWorkout";
import type { WorkoutExerciseHydrated } from "@repo/common";

type DetailParams = { id?: string };

const formatExerciseRow = (ex: WorkoutExerciseHydrated): string => {
  const parts: string[] = [];
  parts.push(`${ex.sets} × `);
  if (ex.exercise.exerciseType === "STATIC_HOLD" && ex.durationSecs != null) {
    const m = Math.floor(ex.durationSecs / 60);
    const s = ex.durationSecs % 60;
    parts.push(m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`);
  } else if (ex.reps != null) {
    parts.push(`${ex.reps} reps`);
  } else {
    parts.push("—");
  }
  parts.push(` · ${ex.restSecs}s rest`);
  return parts.join("");
};

const WorkoutDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const params = useLocalSearchParams<DetailParams>();
  const id = params.id ? Number(params.id) : undefined;
  const { data, isLoading, error } = useWorkoutDetail(id);
  const deleteMutation = useDeleteWorkout();

  const handleStart = () => {
    if (!id) return;
    router.push({ pathname: "/workout-execute", params: { id: String(id) } });
  };

  const handleEdit = () => {
    if (!id) return;
    router.push({ pathname: "/workout-builder", params: { id: String(id) } });
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert(
      "Delete workout?",
      data
        ? `"${data.name}" will be removed permanently. This cannot be undone.`
        : "This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteMutation.mutate(id, {
              onSuccess: () => router.back(),
              onError: () => {
                Alert.alert(
                  "Error",
                  "Could not delete the workout. Please try again.",
                );
              },
            });
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {isLoading && (
          <ActivityIndicator
            size="large"
            color={colors.text}
            style={styles.loader}
          />
        )}
        {error && !isLoading && (
          <Text style={[styles.errorText, { color: "#E57373" }]}>
            Failed to load workout.
          </Text>
        )}
        {data && !isLoading && (
          <>
            <Text style={[styles.name, { color: colors.text }]}>
              {data.name}
            </Text>
            <Text style={[styles.subtle, { color: colors.text }]}>
              {data.exercises.length === 1
                ? "1 exercise"
                : `${data.exercises.length} exercises`}
            </Text>

            <View style={styles.list}>
              {data.exercises.map((ex) => (
                <View
                  key={ex.id}
                  style={[styles.row, { backgroundColor: colors.surface }]}
                >
                  <Text style={[styles.rowName, { color: colors.text }]}>
                    {ex.exercise.displayName}
                  </Text>
                  <Text style={[styles.rowMeta, { color: colors.text }]}>
                    {formatExerciseRow(ex)}
                  </Text>
                </View>
              ))}
            </View>

            {data.aiModel !== null && (
              <View style={styles.aiDisclaimer}>
                <AiDisclaimer />
              </View>
            )}
            <Pressable
              onPress={handleStart}
              style={({ pressed }) => [
                styles.primaryCta,
                { backgroundColor: pressed ? "#006EE6" : "#007AFF" },
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                data.aiModel !== null
                  ? "Start AI-generated workout"
                  : "Start workout"
              }
            >
              <Text style={styles.primaryCtaText}>Start</Text>
            </Pressable>

            <View style={styles.secondaryRow}>
              <Pressable
                onPress={handleEdit}
                style={({ pressed }) => [
                  styles.secondaryCta,
                  {
                    backgroundColor: colors.surface,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Edit workout"
              >
                <Text style={[styles.secondaryCtaText, { color: colors.text }]}>
                  Edit
                </Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                disabled={deleteMutation.isPending}
                style={({ pressed }) => [
                  styles.secondaryCta,
                  styles.destructive,
                  { opacity: pressed || deleteMutation.isPending ? 0.6 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Delete workout"
              >
                <Text style={styles.destructiveText}>
                  {deleteMutation.isPending ? "Deleting…" : "Delete"}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default WorkoutDetailScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 24, paddingBottom: 64 },
  loader: { marginTop: 60 },
  errorText: { fontSize: 14, marginTop: 40, textAlign: "center" },
  name: { fontSize: 28, fontWeight: "700" },
  subtle: { fontSize: 14, opacity: 0.6, marginTop: 4 },
  list: { marginTop: 24 },
  row: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  rowName: { fontSize: 16, fontWeight: "600" },
  rowMeta: { fontSize: 13, opacity: 0.7, marginTop: 4 },
  aiDisclaimer: { marginTop: 24 },
  primaryCta: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryCtaText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  secondaryRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  secondaryCta: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryCtaText: { fontSize: 15, fontWeight: "600" },
  destructive: { backgroundColor: "#FFE0E0" },
  destructiveText: { color: "#C62828", fontSize: 15, fontWeight: "600" },
});
