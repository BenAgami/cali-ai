import React, { useCallback } from "react";
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
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { useTheme } from "@src/context/ThemeContext";
import { useWorkoutDetail } from "@src/hooks/queries/useWorkoutDetail";
import { useWorkoutExecution } from "@src/hooks/useWorkoutExecution";
import { useStartWorkout } from "@src/hooks/mutations/useStartWorkout";
import RestTimer from "@src/components/RestTimer";
import RecordedSetCard from "@src/components/form/RecordedSetCard";
import { useWorkoutRecordedSets } from "@src/hooks/useWorkoutRecordedSets";
import { consumeRecordedSetDone } from "@src/state/recordedSetStore";
import { isFormAnalysisExercise } from "@repo/common";

type ExecuteParams = { id?: string };

const formatElapsed = (s: number): string => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
};

const formatRepsOrDuration = (
  reps: number | null,
  durationSecs: number | null,
): string => {
  if (durationSecs != null) {
    const m = Math.floor(durationSecs / 60);
    const sec = durationSecs % 60;
    return m > 0
      ? `Hold for ${m}:${String(sec).padStart(2, "0")}`
      : `Hold for ${sec}s`;
  }
  if (reps != null) return `${reps} reps`;
  return "—";
};

const WorkoutExecuteScreen: React.FC = () => {
  const { colors } = useTheme();
  const params = useLocalSearchParams<ExecuteParams>();
  const id = params.id ? Number(params.id) : undefined;
  const { data: workout, isLoading, error } = useWorkoutDetail(id);
  const execution = useWorkoutExecution(workout);
  const startMutation = useStartWorkout();
  const recorded = useWorkoutRecordedSets(id);
  const { phase, currentSet, completeSet, startedAtMs } = execution;

  // Returning from a submitted recording completes the set and starts rest.
  useFocusEffect(
    useCallback(() => {
      if (id === undefined || phase !== "working") return;
      if (consumeRecordedSetDone({ workoutId: id, setNumber: currentSet })) {
        completeSet();
      }
    }, [id, phase, currentSet, completeSet]),
  );

  const handleOpenResult = (sessionId: number) => {
    router.push({
      pathname: "/analysis-result",
      params: { sessionId: String(sessionId) },
    });
  };

  const thisRunSets = recorded.items.filter(
    (item) => Date.parse(item.performedAt) >= startedAtMs,
  );

  const handleDone = () => {
    if (!id || !workout) return;
    startMutation.mutate(
      {
        workoutId: id,
        data: {
          durationSecs: execution.totalElapsedSecs,
          completedAt: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          // Pop back to the workouts tab — the list will refetch via useFocusEffect.
          router.replace("/(main)/(tabs)/workouts");
        },
        onError: () => {
          Alert.alert(
            "Could not save",
            "We couldn't record this workout, but your time is shown above.",
            [
              {
                text: "OK",
                onPress: () => router.replace("/(main)/(tabs)/workouts"),
              },
            ],
          );
        },
      },
    );
  };

  if (isLoading || !workout) {
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

  if (error) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <Text style={[styles.errorText, { color: "#E57373" }]}>
          Failed to load workout.
        </Text>
      </SafeAreaView>
    );
  }

  // ───────── Completion summary (D-18) ─────────
  if (execution.phase === "complete") {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <ScrollView contentContainerStyle={styles.summaryContainer}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>
            Workout complete
          </Text>
          <Text style={[styles.summaryName, { color: colors.text }]}>
            {workout.name}
          </Text>
          <View
            style={[styles.summaryStat, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.summaryStatLabel, { color: colors.text }]}>
              Total duration
            </Text>
            <Text
              style={[
                styles.summaryStatValue,
                { color: colors.text, fontVariant: ["tabular-nums"] },
              ]}
            >
              {formatElapsed(execution.totalElapsedSecs)}
            </Text>
          </View>
          <View
            style={[styles.summaryStat, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.summaryStatLabel, { color: colors.text }]}>
              Exercises completed
            </Text>
            <Text style={[styles.summaryStatValue, { color: colors.text }]}>
              {workout.exercises.length}
            </Text>
          </View>
          <Pressable
            onPress={handleDone}
            disabled={startMutation.isPending}
            style={({ pressed }) => [
              styles.doneButton,
              {
                backgroundColor: pressed ? "#006EE6" : "#007AFF",
                opacity: startMutation.isPending ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={styles.doneButtonText}>
              {startMutation.isPending ? "Saving…" : "Done"}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ───────── Active set / rest (D-15, D-17) ─────────
  const ex = execution.currentExercise!;
  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={styles.topBar}>
        <Text style={[styles.elapsedLabel, { color: colors.text }]}>
          Elapsed
        </Text>
        <Text
          style={[
            styles.elapsedValue,
            { color: colors.text, fontVariant: ["tabular-nums"] },
          ]}
        >
          {formatElapsed(execution.totalElapsedSecs)}
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={[styles.exerciseIndex, { color: colors.text }]}>
          Exercise {execution.currentExerciseIndex + 1} of{" "}
          {workout.exercises.length}
        </Text>
        <Text style={[styles.exerciseName, { color: colors.text }]}>
          {ex.exercise.displayName}
        </Text>
        <Text style={[styles.config, { color: colors.text }]}>
          Set {execution.currentSet} of {ex.sets} ·{" "}
          {formatRepsOrDuration(ex.reps, ex.durationSecs)}
        </Text>

        {execution.phase === "resting" ? (
          <RestTimer
            secondsLeft={execution.restSecondsLeft}
            totalSeconds={execution.restTotalSecs}
            onSkip={execution.skipRest}
          />
        ) : (
          <Pressable
            onPress={execution.completeSet}
            style={({ pressed }) => [
              styles.completeButton,
              { backgroundColor: pressed ? "#006EE6" : "#007AFF" },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Complete set"
          >
            <Text style={styles.completeButtonText}>Complete set</Text>
          </Pressable>
        )}

        {execution.phase === "working" &&
          isFormAnalysisExercise(ex.exercise.code) && (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/record-set",
                  params: {
                    workoutId: String(id),
                    setNumber: String(execution.currentSet),
                    exerciseCode: ex.exercise.code,
                    exerciseDisplayName: ex.exercise.displayName,
                    source: "execute",
                  },
                })
              }
              style={({ pressed }) => [
                styles.recordButton,
                { borderColor: colors.text + "44", opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Record this set for form feedback"
            >
              <Text style={[styles.recordButtonText, { color: colors.text }]}>
                Record this set
              </Text>
            </Pressable>
          )}

        <ScrollView style={styles.recordedRows}>
          {thisRunSets.map((item) => (
            <RecordedSetCard
              key={item.sessionId}
              item={item}
              onOpen={handleOpenResult}
              onRetry={(sessionId) => void recorded.retrySet(sessionId)}
              isRetrying={recorded.retryingIds.has(item.sessionId)}
            />
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default WorkoutExecuteScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loader: { marginTop: 60 },
  errorText: { fontSize: 14, marginTop: 40, textAlign: "center" },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  elapsedLabel: {
    fontSize: 13,
    opacity: 0.6,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  elapsedValue: { fontSize: 16, fontWeight: "700" },
  body: {
    flex: 1,
    paddingTop: 32,
    paddingHorizontal: 24,
    alignItems: "stretch",
  },
  exerciseIndex: {
    fontSize: 13,
    opacity: 0.6,
    fontWeight: "600",
    textTransform: "uppercase",
    textAlign: "center",
  },
  exerciseName: {
    fontSize: 32,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },
  config: {
    fontSize: 18,
    opacity: 0.7,
    marginTop: 12,
    marginBottom: 32,
    textAlign: "center",
  },
  completeButton: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
  },
  recordButton: {
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    marginTop: 12,
  },
  recordButtonText: { fontSize: 16, fontWeight: "600" },
  recordedRows: { flex: 1, marginTop: 16 },
  completeButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },

  summaryContainer: { padding: 32, paddingTop: 64, alignItems: "center" },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    opacity: 0.6,
  },
  summaryName: {
    fontSize: 32,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },
  summaryStat: {
    width: "100%",
    padding: 20,
    borderRadius: 12,
    marginTop: 16,
  },
  summaryStatLabel: {
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.6,
    textTransform: "uppercase",
  },
  summaryStatValue: { fontSize: 28, fontWeight: "700", marginTop: 6 },
  doneButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 32,
  },
  doneButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
