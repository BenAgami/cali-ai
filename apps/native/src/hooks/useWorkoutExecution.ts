import { useState, useEffect, useCallback, useMemo } from "react";

import { useCountdown } from "@src/hooks/useCountdown";
import type {
  WorkoutWithExercises,
  WorkoutExerciseHydrated,
} from "@repo/common";

export type ExecutionPhase = "working" | "resting" | "complete";

export interface UseWorkoutExecutionResult {
  phase: ExecutionPhase;
  currentExerciseIndex: number;
  currentSet: number;
  currentExercise: WorkoutExerciseHydrated | null;
  isLastSet: boolean;
  isLastExercise: boolean;
  /** Epoch ms when this run began; recorded sets before it belong to earlier runs. */
  startedAtMs: number;
  totalElapsedSecs: number;
  restSecondsLeft: number;
  restTotalSecs: number;
  completeSet: () => void;
  skipRest: () => void;
}

export const useWorkoutExecution = (
  workout: WorkoutWithExercises | undefined,
): UseWorkoutExecutionResult => {
  const exercises = workout?.exercises ?? [];
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setNumber, setSetNumber] = useState(1);
  const [phase, setPhase] = useState<ExecutionPhase>("working");
  const [startedAtMs] = useState(() => Date.now());
  const [totalElapsed, setTotalElapsed] = useState(0);

  const currentExercise: WorkoutExerciseHydrated | null =
    exercises[exerciseIndex] ?? null;
  const restTotal = currentExercise?.restSecs ?? 0;

  const countdown = useCountdown(restTotal);

  useEffect(() => {
    if (phase === "complete") return;
    const interval = setInterval(() => {
      setTotalElapsed(Math.floor((Date.now() - startedAtMs) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, startedAtMs]);

  useEffect(() => {
    if (phase !== "resting") return;
    if (countdown.isRunning) return;
    if (countdown.secondsLeft !== 0) return;
    advanceAfterRest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown.isRunning, countdown.secondsLeft]);

  const advanceAfterRest = useCallback(() => {
    if (!currentExercise) return;
    if (setNumber < currentExercise.sets) {
      setSetNumber((s) => s + 1);
      setPhase("working");
      return;
    }
    if (exerciseIndex < exercises.length - 1) {
      setExerciseIndex((i) => i + 1);
      setSetNumber(1);
      setPhase("working");
      return;
    }
    setPhase("complete");
  }, [currentExercise, setNumber, exerciseIndex, exercises.length]);

  const completeSet = useCallback(() => {
    if (!currentExercise) return;
    if (phase !== "working") return;

    const isLastSetOfExercise = setNumber >= currentExercise.sets;
    const isLastExerciseOfWorkout = exerciseIndex >= exercises.length - 1;

    if (isLastSetOfExercise && isLastExerciseOfWorkout) {
      setPhase("complete");
      return;
    }
    if (currentExercise.restSecs <= 0) {
      advanceAfterRest();
      return;
    }
    setPhase("resting");
    countdown.start(currentExercise.restSecs);
  }, [
    currentExercise,
    phase,
    setNumber,
    exerciseIndex,
    exercises.length,
    countdown,
    advanceAfterRest,
  ]);

  const skipRest = useCallback(() => {
    if (phase !== "resting") return;
    countdown.skip();
    advanceAfterRest();
  }, [phase, countdown, advanceAfterRest]);

  const isLastSet = useMemo(
    () => !!currentExercise && setNumber >= currentExercise.sets,
    [currentExercise, setNumber],
  );
  const isLastExercise = exerciseIndex >= exercises.length - 1;

  return {
    phase,
    currentExerciseIndex: exerciseIndex,
    currentSet: setNumber,
    currentExercise,
    isLastSet,
    isLastExercise,
    startedAtMs,
    totalElapsedSecs: totalElapsed,
    restSecondsLeft: countdown.secondsLeft,
    restTotalSecs: restTotal,
    completeSet,
    skipRest,
  };
};
