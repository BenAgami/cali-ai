import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AnalysisStatusEvent } from "@repo/common";

import { useTheme } from "@src/context/ThemeContext";
import { baseColors } from "@src/theme/colors";
import {
  ANALYSING_PREFIX,
  QUEUED_LABEL,
  RETRY,
  RETRYABLE_FAILURES,
  failureMessage,
} from "@src/constants/formMessages";

const PERCENT_MAX = 100;

interface AnalysingRowProps {
  exerciseDisplayName: string;
  setNumber: number | null;
  status: "PROCESSING" | "FAILED";
  event?: AnalysisStatusEvent;
  failureReason: string | null;
  onRetry: () => void;
  isRetrying: boolean;
}

const AnalysingRow: React.FC<AnalysingRowProps> = ({
  exerciseDisplayName,
  setNumber,
  status,
  event,
  failureReason,
  onRetry,
  isRetrying,
}) => {
  const { colors } = useTheme();
  const percent = event?.progress_percent ?? 0;
  const reason = failureReason ?? event?.failure_reason ?? null;
  const canRetry = reason === null || RETRYABLE_FAILURES.has(reason);

  return (
    <View style={[styles.row, { backgroundColor: colors.surface }]}>
      <Text style={[styles.name, { color: colors.text }]}>
        {setNumber === null
          ? exerciseDisplayName
          : `${exerciseDisplayName} - Set ${setNumber}`}
      </Text>
      {status === "PROCESSING" ? (
        <>
          <Text style={[styles.meta, { color: colors.text }]}>
            {`${ANALYSING_PREFIX} ${event?.stage_label ?? QUEUED_LABEL} ${percent}%`}
          </Text>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${Math.min(percent, PERCENT_MAX)}%` },
              ]}
            />
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.meta, { color: colors.text }]}>
            {failureMessage(reason)}
          </Text>
          {canRetry && (
            <Pressable
              onPress={onRetry}
              disabled={isRetrying}
              accessibilityRole="button"
              accessibilityLabel={RETRY}
              style={({ pressed }) => [
                styles.retry,
                { opacity: pressed || isRetrying ? 0.6 : 1 },
              ]}
            >
              <Text style={styles.retryText}>{RETRY}</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
};

export default AnalysingRow;

const styles = StyleSheet.create({
  row: { padding: 14, borderRadius: 10, marginBottom: 8, gap: 6 },
  name: { fontSize: 16, fontWeight: "600" },
  meta: { fontSize: 13, opacity: 0.8 },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: baseColors.grayDark,
  },
  fill: { height: 4, backgroundColor: baseColors.blue },
  retry: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: baseColors.blue,
  },
  retryText: { color: baseColors.white, fontSize: 14, fontWeight: "600" },
});
