import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { FORM_DIMENSIONS } from "@repo/common";

import BandBadge from "@src/components/form/BandBadge";
import CameraAdvice from "@src/components/form/CameraAdvice";
import DimensionRow from "@src/components/form/DimensionRow";
import FeedbackBlocks from "@src/components/form/FeedbackBlocks";
import { useTheme } from "@src/context/ThemeContext";
import { useAnalysisResultScreen } from "@src/hooks/useAnalysisResultScreen";
import {
  ANALYSING_PREFIX,
  FEEDBACK_LOAD_ERROR_TEXT,
  FEEDBACK_NOT_READY_TEXT,
  QUEUED_LABEL,
  RETRY,
} from "@src/constants/formMessages";
import { baseColors } from "@src/theme/colors";

type ResultParams = { sessionId?: string };

const AnalysisResultScreen: React.FC = () => {
  const { colors } = useTheme();
  const { sessionId } = useLocalSearchParams<ResultParams>();
  const { state, analysis, liveEvent, refetch, recordAgain } =
    useAnalysisResultScreen(sessionId);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["bottom"]}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {state === "loading" && (
          <ActivityIndicator size="large" color={colors.text} />
        )}

        {state === "notReady" && (
          <>
            <Text style={[styles.message, { color: colors.text }]}>
              {FEEDBACK_NOT_READY_TEXT}
            </Text>
            {liveEvent !== undefined && (
              <Text style={[styles.message, { color: colors.text }]}>
                {`${ANALYSING_PREFIX} ${liveEvent.stage_label || QUEUED_LABEL} ${liveEvent.progress_percent}%`}
              </Text>
            )}
          </>
        )}

        {state === "error" && (
          <>
            <Text style={[styles.message, { color: colors.text }]}>
              {FEEDBACK_LOAD_ERROR_TEXT}
            </Text>
            <Pressable
              onPress={refetch}
              accessibilityRole="button"
              accessibilityLabel={RETRY}
              style={styles.retry}
            >
              <Text style={styles.retryText}>{RETRY}</Text>
            </Pressable>
          </>
        )}

        {analysis?.outcome === "SCORED" && (
          <>
            <Text style={[styles.title, { color: colors.text }]}>
              {analysis.setNumber === null
                ? analysis.exerciseDisplayName
                : `${analysis.exerciseDisplayName} - Set ${analysis.setNumber}`}
            </Text>
            <BandBadge band={analysis.band} size="lg" />
            <Text style={[styles.summary, { color: colors.text }]}>
              {analysis.summary}
            </Text>
            {FORM_DIMENSIONS.map((dimension) => {
              const result = analysis.dimensions.find(
                (entry) => entry.dimension === dimension,
              );
              return (
                <DimensionRow
                  key={dimension}
                  dimension={dimension}
                  band={result?.band ?? null}
                  isAssessed={result?.isAssessed ?? false}
                />
              );
            })}
            <FeedbackBlocks
              positives={analysis.positives}
              corrections={analysis.corrections}
            />
          </>
        )}

        {analysis?.outcome === "UNTRACKABLE" && (
          <CameraAdvice advice={analysis.advice} onRecordAgain={recordAgain} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default AnalysisResultScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 24, paddingBottom: 64, gap: 12 },
  message: { fontSize: 15, textAlign: "center", marginTop: 24 },
  title: { fontSize: 24, fontWeight: "700" },
  summary: { fontSize: 16, lineHeight: 22, marginBottom: 8 },
  retry: {
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: baseColors.blue,
  },
  retryText: { color: baseColors.white, fontSize: 16, fontWeight: "700" },
});
