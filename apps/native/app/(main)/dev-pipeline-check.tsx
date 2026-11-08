import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";

import { useTheme } from "@src/context/ThemeContext";
import { baseColors } from "@src/theme/colors";
import { usePipelineCheck } from "@src/hooks/usePipelineCheck";

const DevPipelineCheck: React.FC = () => {
  const { colors } = useTheme();
  const {
    phase,
    sessionId,
    jobId,
    event,
    streamError,
    errorMessage,
    run,
    retry,
    isBusy,
    canRetry,
  } = usePipelineCheck();

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Pressable
        disabled={isBusy}
        style={[
          styles.button,
          { backgroundColor: baseColors.blue },
          isBusy && styles.disabled,
        ]}
        onPress={() => {
          void run();
        }}
      >
        <Text style={{ color: baseColors.white }}>Run pipeline check</Text>
      </Pressable>

      <Text style={{ color: colors.text }}>Phase: {phase}</Text>
      <Text style={{ color: colors.text }}>Session: {sessionId ?? "-"}</Text>
      <Text style={{ color: colors.text }}>Job: {jobId ?? "-"}</Text>
      <Text style={{ color: colors.text }}>Status: {event?.status ?? "-"}</Text>
      <Text style={{ color: colors.text }}>
        Stage:{" "}
        {event ? `${event.stage_label} - ${event.progress_percent}%` : "-"}
      </Text>
      {event?.failure_reason ? (
        <Text style={{ color: colors.text }}>
          Failure: {event.failure_reason}
        </Text>
      ) : null}
      {streamError ? (
        <Text style={{ color: colors.text }}>Stream error: {streamError}</Text>
      ) : null}
      {errorMessage ? (
        <Text style={{ color: colors.text }}>Error: {errorMessage}</Text>
      ) : null}

      {canRetry ? (
        <Pressable
          style={[styles.button, { backgroundColor: baseColors.blue }]}
          onPress={() => {
            void retry();
          }}
        >
          <Text style={{ color: baseColors.white }}>Retry analysis</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

export default DevPipelineCheck;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  disabled: { opacity: 0.5 },
});
