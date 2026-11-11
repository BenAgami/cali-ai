import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Camera } from "react-native-vision-camera";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  isFormAnalysisExercise,
  type FormAnalysisExercise,
} from "@repo/common";
import AiPrerequisiteSteps from "@src/components/AiPrerequisiteSteps";
import FramingGuide from "@src/components/form/FramingGuide";
import {
  COUNTDOWN_HINT,
  RETRY_UPLOAD,
  STOP,
} from "@src/constants/recordingMessages";
import { useTheme } from "@src/context/ThemeContext";
import { useAiPrerequisiteSteps } from "@src/hooks/useAiPrerequisiteSteps";
import { useRecordedSet } from "@src/hooks/useRecordedSet";
import { baseColors } from "@src/theme/colors";

type RecordSetParams = {
  workoutId?: string;
  setNumber?: string;
  exerciseCode?: string;
  exerciseDisplayName?: string;
  source?: string;
};

const SECONDS_PER_MINUTE = 60;
const ICON_SIZE = 26;
const RECORD_RED = "#C62828";
const PILL_BACKDROP = "rgba(0,0,0,0.6)";

const formatElapsed = (totalSec: number): string => {
  const minutes = Math.floor(totalSec / SECONDS_PER_MINUTE);
  const seconds = totalSec % SECONDS_PER_MINUTE;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const toNumberOrNull = (value: string | undefined): number | null => {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Dev-only readout of the one rotation signal the preview follows. */
const OrientationDebug: React.FC<{ cameraPosition: string }> = ({
  cameraPosition,
}) => {
  const [orientation, setOrientation] = useState("");
  useEffect(() => {
    void ScreenOrientation.getOrientationAsync().then((value) => {
      setOrientation(ScreenOrientation.Orientation[value]);
    });
    const subscription = ScreenOrientation.addOrientationChangeListener(
      (event) => {
        setOrientation(
          ScreenOrientation.Orientation[event.orientationInfo.orientation],
        );
      },
    );
    return () => {
      subscription.remove();
    };
  }, []);
  return (
    <View style={styles.debug} pointerEvents="none">
      <Text style={styles.debugText}>
        {`screen ${orientation} | ${cameraPosition}`}
      </Text>
    </View>
  );
};

interface RecorderProps {
  workoutId: number | null;
  setNumber: number | null;
  exerciseCode: FormAnalysisExercise;
  exerciseDisplayName: string;
  source: "execute" | "standalone";
}

const Recorder: React.FC<RecorderProps> = ({
  workoutId,
  setNumber,
  exerciseCode,
  exerciseDisplayName,
  source,
}) => {
  const { colors } = useTheme();
  const prerequisites = useAiPrerequisiteSteps();
  const recorder = useRecordedSet({
    workoutId,
    setNumber,
    exerciseCode,
    exerciseDisplayName,
    source,
    onSubmitted: () => router.back(),
  });
  const { phase } = recorder;

  const cancel = () => {
    recorder.discard();
    router.back();
  };

  if (phase === "prerequisites") {
    return (
      <SafeAreaView
        style={[styles.fill, { backgroundColor: colors.background }]}
      >
        <ScrollView contentContainerStyle={styles.padded}>
          {recorder.isLoadingPrerequisites ? (
            <ActivityIndicator size="large" color={colors.text} />
          ) : (
            <AiPrerequisiteSteps prerequisites={prerequisites} />
          )}
          <Pressable
            style={[styles.textButton]}
            onPress={cancel}
            accessibilityRole="button"
          >
            <Text style={[styles.textButtonLabel, { color: colors.text }]}>
              Cancel
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === "permission") {
    return (
      <SafeAreaView
        style={[styles.fill, { backgroundColor: colors.background }]}
      >
        <View style={styles.centered}>
          <Text style={[styles.heading, { color: colors.text }]}>
            Camera access
          </Text>
          <Text style={[styles.body, { color: colors.text }]}>
            We use the camera to track your movement. Video stays on your phone.
          </Text>
          <Pressable
            style={styles.primary}
            onPress={() => void recorder.requestPermission()}
            accessibilityRole="button"
          >
            <Text style={styles.primaryLabel}>Allow camera</Text>
          </Pressable>
          <Pressable
            style={styles.textButton}
            onPress={() => void Linking.openSettings()}
            accessibilityRole="button"
          >
            <Text style={[styles.textButtonLabel, { color: colors.text }]}>
              Open settings
            </Text>
          </Pressable>
          <Pressable
            style={styles.textButton}
            onPress={cancel}
            accessibilityRole="button"
          >
            <Text style={[styles.textButtonLabel, { color: colors.text }]}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "uploading" || phase === "submitted") {
    return (
      <SafeAreaView
        style={[styles.fill, { backgroundColor: colors.background }]}
      >
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.text} />
          <Text style={[styles.body, { color: colors.text }]}>
            Sending your set...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "uploadError") {
    return (
      <SafeAreaView
        style={[styles.fill, { backgroundColor: colors.background }]}
      >
        <View style={styles.centered}>
          <Text style={[styles.body, { color: colors.text }]}>
            {recorder.uploadError}
          </Text>
          {recorder.isUploadRetryable && (
            <Pressable
              style={styles.primary}
              onPress={recorder.retryUpload}
              accessibilityRole="button"
            >
              <Text style={styles.primaryLabel}>{RETRY_UPLOAD}</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.textButton}
            onPress={cancel}
            accessibilityRole="button"
          >
            <Text style={[styles.textButtonLabel, { color: colors.text }]}>
              Discard
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // setup | countdown | recording
  const { cameraHandlers, device } = recorder;
  const isFront = recorder.cameraPosition === "front";

  return (
    <View style={styles.fill}>
      {device !== undefined && (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive
          pixelFormat="rgb"
          androidPreviewViewType="texture-view"
          outputOrientation="preview"
          frameProcessor={recorder.frameProcessor}
          onPreviewStarted={recorder.onPreviewStarted}
          onLayout={cameraHandlers.onLayout}
          onOutputOrientationChanged={cameraHandlers.onOutputOrientationChanged}
        />
      )}
      {__DEV__ && <OrientationDebug cameraPosition={recorder.cameraPosition} />}
      <FramingGuide
        exerciseCode={exerciseCode}
        issue={recorder.setupIssue}
        isReady={recorder.isPlacementReady}
      />
      <SafeAreaView
        style={[StyleSheet.absoluteFill, styles.hud]}
        pointerEvents="box-none"
      >
        {phase === "setup" && (
          <View style={styles.hudTop} pointerEvents="box-none">
            <Pressable
              style={styles.roundButton}
              onPress={cancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel recording"
            >
              <Ionicons
                name="close"
                size={ICON_SIZE}
                color={baseColors.white}
              />
            </Pressable>
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                {recorder.setupMessage ?? "Getting your position..."}
              </Text>
            </View>
            <Pressable
              style={styles.roundButton}
              onPress={recorder.toggleCamera}
              accessibilityRole="button"
              accessibilityLabel={
                isFront ? "Switch to back camera" : "Switch to front camera"
              }
            >
              <Ionicons
                name="camera-reverse"
                size={ICON_SIZE}
                color={baseColors.white}
              />
            </Pressable>
          </View>
        )}

        {phase === "countdown" && (
          <View style={styles.countdown} pointerEvents="none">
            <Text style={styles.countdownNumber}>
              {recorder.countdownSecondsLeft}
            </Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{COUNTDOWN_HINT}</Text>
            </View>
          </View>
        )}

        {phase === "recording" && (
          <View style={styles.hudTop} pointerEvents="none">
            <View style={[styles.pill, styles.pillRow]}>
              <View style={styles.recordDot} />
              <Text style={styles.pillText}>
                {formatElapsed(recorder.elapsedSec)}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.hudBottom} pointerEvents="box-none">
          {phase === "countdown" && (
            <Pressable
              style={styles.secondary}
              onPress={cancel}
              accessibilityRole="button"
            >
              <Text style={styles.primaryLabel}>Cancel</Text>
            </Pressable>
          )}
          {phase === "recording" && (
            <Pressable
              style={styles.stop}
              onPress={recorder.stop}
              accessibilityRole="button"
              accessibilityLabel="Stop recording"
            >
              <Text style={styles.primaryLabel}>{STOP}</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
      {!recorder.isOrientationReady && (
        <View style={[StyleSheet.absoluteFill, styles.cover]}>
          <ActivityIndicator size="large" color={baseColors.white} />
          <Text style={styles.pillText}>Preparing camera...</Text>
        </View>
      )}
    </View>
  );
};

const RecordSetScreen: React.FC = () => {
  const { colors } = useTheme();
  const params = useLocalSearchParams<RecordSetParams>();
  const { exerciseCode } = params;

  if (exerciseCode === undefined || !isFormAnalysisExercise(exerciseCode)) {
    return (
      <SafeAreaView
        style={[styles.fill, { backgroundColor: colors.background }]}
      >
        <View style={styles.centered}>
          <Text style={[styles.body, { color: colors.text }]}>
            This exercise can't be recorded
          </Text>
          <Pressable
            style={styles.primary}
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Text style={styles.primaryLabel}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Recorder
      workoutId={toNumberOrNull(params.workoutId)}
      setNumber={toNumberOrNull(params.setNumber)}
      exerciseCode={exerciseCode}
      exerciseDisplayName={params.exerciseDisplayName ?? exerciseCode}
      source={params.source === "execute" ? "execute" : "standalone"}
    />
  );
};

export default RecordSetScreen;

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: baseColors.black },
  padded: { padding: 20, paddingBottom: 48 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  heading: { fontSize: 22, fontWeight: "700" },
  body: { fontSize: 16, textAlign: "center" },
  primary: {
    backgroundColor: baseColors.blue,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  secondary: {
    backgroundColor: PILL_BACKDROP,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  primaryLabel: { color: baseColors.white, fontSize: 18, fontWeight: "700" },
  textButton: { paddingVertical: 12, alignItems: "center" },
  textButtonLabel: { fontSize: 16, fontWeight: "600" },
  cover: {
    backgroundColor: baseColors.black,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  debug: { position: "absolute", bottom: 96, left: 8 },
  debugText: {
    color: "yellow",
    backgroundColor: PILL_BACKDROP,
    fontSize: 13,
  },
  hud: { justifyContent: "space-between" },
  hudTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    gap: 12,
  },
  hudBottom: { alignItems: "center", padding: 24 },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PILL_BACKDROP,
  },
  pill: {
    flexShrink: 1,
    backgroundColor: PILL_BACKDROP,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  pillRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pillText: { color: baseColors.white, fontSize: 15, textAlign: "center" },
  recordDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: RECORD_RED,
  },
  countdown: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  countdownNumber: {
    color: baseColors.white,
    fontSize: 120,
    fontWeight: "800",
  },
  stop: {
    backgroundColor: RECORD_RED,
    borderRadius: 40,
    paddingVertical: 20,
    paddingHorizontal: 56,
    alignItems: "center",
  },
});
