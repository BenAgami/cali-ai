import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import * as ScreenOrientation from "expo-screen-orientation";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";

import { useTheme } from "@src/context/ThemeContext";
import { baseColors } from "@src/theme/colors";
import { useMediaPipePose } from "@src/pose/useMediaPipePose";
import type { PoseFrame } from "@src/pose/types";

const TARGET_FPS = 15;
const VISIBILITY_THRESHOLD = 0.5;
const LEFT_CHAIN = [11, 13, 15, 23, 27];
const RIGHT_CHAIN = [12, 14, 16, 24, 28];
const OVERLAY_INTERVAL_MS = 200;
const STATS_INTERVAL_MS = 1000;
const RECORD_MS = 10_000;
const DOT_SIZE = 8;

type Dot = { index: number; x: number; y: number };
type Stats = {
  fps: number;
  leftMean: number;
  rightMean: number;
  keypointCount: number;
};

const chainMean = (frame: PoseFrame, chain: number[]) =>
  chain.reduce((sum, index) => sum + (frame.keypoints[index]?.[2] ?? 0), 0) /
  chain.length;

const chainPercent = (frames: PoseFrame[], chain: number[]) => {
  if (frames.length === 0) return 0;
  const hits = frames.filter((frame) =>
    chain.every(
      (index) => (frame.keypoints[index]?.[2] ?? 0) >= VISIBILITY_THRESHOLD,
    ),
  ).length;
  return (hits / frames.length) * 100;
};

const dotColor = (index: number) => {
  if (LEFT_CHAIN.includes(index)) return baseColors.blue;
  if (RIGHT_CHAIN.includes(index)) return "#ff9500";
  return "#34c759";
};

const DevBlazePoseCheck: React.FC = () => {
  useKeepAwake();
  const { colors } = useTheme();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [position, setPosition] = useState<"front" | "back">("back");
  const [isLandscape, setIsLandscape] = useState(false);
  const device = useCameraDevice(position);
  const [dots, setDots] = useState<Dot[]>([]);
  const [stats, setStats] = useState<Stats>({
    fps: 0,
    leftMean: 0,
    rightMean: 0,
    keypointCount: 0,
  });
  const [recordSummary, setRecordSummary] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const latestFrame = useRef<PoseFrame | null>(null);
  const frameCount = useRef(0);
  const recordBuffer = useRef<PoseFrame[] | null>(null);

  const onFrame = useCallback((frame: PoseFrame) => {
    latestFrame.current = frame;
    frameCount.current += 1;
    recordBuffer.current?.push(frame);
  }, []);

  const pose = useMediaPipePose({
    isActive: true,
    cameraPosition: position,
    targetFps: TARGET_FPS,
    onFrame,
  });
  const { onDeviceChange } = pose.cameraHandlers;

  useEffect(() => {
    onDeviceChange(device);
  }, [device, onDeviceChange]);

  useEffect(() => {
    const overlayTimer = setInterval(() => {
      const frame = latestFrame.current;
      if (!frame) return;
      setDots(
        frame.keypoints.flatMap(([x, y, visibility], index) =>
          visibility >= VISIBILITY_THRESHOLD ? [{ index, x, y }] : [],
        ),
      );
    }, OVERLAY_INTERVAL_MS);
    const statsTimer = setInterval(() => {
      const frame = latestFrame.current;
      setStats({
        fps: (frameCount.current * 1000) / STATS_INTERVAL_MS,
        leftMean: frame ? chainMean(frame, LEFT_CHAIN) : 0,
        rightMean: frame ? chainMean(frame, RIGHT_CHAIN) : 0,
        keypointCount: frame?.keypoints.length ?? 0,
      });
      frameCount.current = 0;
    }, STATS_INTERVAL_MS);
    return () => {
      clearInterval(overlayTimer);
      clearInterval(statsTimer);
    };
  }, []);

  useEffect(
    () => () => {
      void ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      );
    },
    [],
  );

  const toggleOrientation = () => {
    const next = !isLandscape;
    setIsLandscape(next);
    void ScreenOrientation.lockAsync(
      next
        ? ScreenOrientation.OrientationLock.LANDSCAPE
        : ScreenOrientation.OrientationLock.PORTRAIT_UP,
    );
  };

  const startRecording = () => {
    recordBuffer.current = [];
    setIsRecording(true);
    setRecordSummary([]);
    setTimeout(() => {
      const frames = recordBuffer.current ?? [];
      recordBuffer.current = null;
      setIsRecording(false);
      setRecordSummary([
        `frames: ${frames.length}`,
        `left chain >= ${VISIBILITY_THRESHOLD}: ${chainPercent(frames, LEFT_CHAIN).toFixed(0)}%`,
        `right chain >= ${VISIBILITY_THRESHOLD}: ${chainPercent(frames, RIGHT_CHAIN).toFixed(0)}%`,
      ]);
    }, RECORD_MS);
  };

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

  const aspectRatio = pose.info?.aspectRatio ?? 0;
  const isFront = position === "front";

  return (
    <View style={styles.fill}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        pixelFormat="rgb"
        frameProcessor={pose.frameProcessor}
        onLayout={pose.cameraHandlers.onLayout}
        onOutputOrientationChanged={
          pose.cameraHandlers.onOutputOrientationChanged
        }
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {dots.map((dot) => (
          <View
            key={dot.index}
            style={[
              styles.dot,
              {
                left: `${(isFront ? 1 - dot.x : dot.x) * 100}%`,
                top: `${dot.y * 100}%`,
                backgroundColor: dotColor(dot.index),
              },
            ]}
          />
        ))}
      </View>
      <View style={[styles.overlay, { backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.text }}>
          fps {stats.fps.toFixed(1)} | keypoints {stats.keypointCount}
        </Text>
        <Text style={{ color: colors.text }}>
          left chain {stats.leftMean.toFixed(2)} | right chain{" "}
          {stats.rightMean.toFixed(2)}
        </Text>
        <Text style={{ color: colors.text }}>
          aspectRatio {aspectRatio.toFixed(3)} | delegate {pose.delegate}
        </Text>
        <Text style={{ color: colors.text }}>
          model {pose.info?.poseModelVersion ?? "-"}
        </Text>
        {pose.lastError ? (
          <Text style={{ color: colors.text }}>error: {pose.lastError}</Text>
        ) : null}
        {recordSummary.map((line) => (
          <Text key={line} style={{ color: colors.text }}>
            {line}
          </Text>
        ))}
        <View style={styles.row}>
          <Pressable
            style={[styles.button, { backgroundColor: baseColors.blue }]}
            onPress={() => {
              setPosition(isFront ? "back" : "front");
            }}
          >
            <Text style={{ color: baseColors.white }}>
              {isFront ? "Front" : "Back"}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.button, { backgroundColor: baseColors.blue }]}
            onPress={toggleOrientation}
          >
            <Text style={{ color: baseColors.white }}>
              {isLandscape ? "Landscape" : "Portrait"}
            </Text>
          </Pressable>
          <Pressable
            disabled={isRecording}
            style={[styles.button, { backgroundColor: baseColors.blue }]}
            onPress={startRecording}
          >
            <Text style={{ color: baseColors.white }}>
              {isRecording ? "Recording..." : "Record 10 s"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default DevBlazePoseCheck;

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
  row: { flexDirection: "row", gap: 8 },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
    alignItems: "center",
  },
  dot: {
    position: "absolute",
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    marginLeft: -DOT_SIZE / 2,
    marginTop: -DOT_SIZE / 2,
  },
});
