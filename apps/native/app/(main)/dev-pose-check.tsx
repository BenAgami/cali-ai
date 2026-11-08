import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { Camera } from "react-native-vision-camera";

import { useTheme } from "@src/context/ThemeContext";
import { baseColors } from "@src/theme/colors";
import { usePoseCheck } from "@src/hooks/usePoseCheck";

const KEYPOINT_COUNT = 17;
const SCORE_THRESHOLD = 0.3;

const DevPoseCheck: React.FC = () => {
  const { colors } = useTheme();
  const {
    hasPermission,
    requestPermission,
    device,
    toggleCamera,
    modelState,
    frameProcessor,
    stats,
  } = usePoseCheck();

  if (!__DEV__) return <Redirect href="/" />;

  if (!hasPermission) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Pressable
          style={[styles.button, { backgroundColor: baseColors.blue }]}
          onPress={() => {
            void requestPermission();
          }}
        >
          <Text style={{ color: baseColors.white }}>Grant camera access</Text>
        </Pressable>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>No camera device found</Text>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
      />
      <View style={[styles.overlay, { backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.text }}>Model: {modelState}</Text>
        <Text style={{ color: colors.text }}>
          Frames: {stats.framesProcessed}
        </Text>
        <Text style={{ color: colors.text }}>
          Keypoints &gt;= {SCORE_THRESHOLD}: {stats.detectedKeypoints}/
          {KEYPOINT_COUNT}
        </Text>
        <Text style={{ color: colors.text }}>
          Mean score: {stats.meanScore.toFixed(2)}
        </Text>
        <Text style={{ color: colors.text }}>
          Inference: {stats.inferenceMs.toFixed(0)} ms
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: baseColors.blue }]}
          onPress={toggleCamera}
        >
          <Text style={{ color: baseColors.white }}>Flip camera</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default DevPoseCheck;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  overlay: {
    position: "absolute",
    top: 16,
    left: 16,
    padding: 12,
    borderRadius: 8,
    gap: 4,
    opacity: 0.9,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    alignItems: "center",
  },
});
