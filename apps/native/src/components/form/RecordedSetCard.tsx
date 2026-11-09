import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import AnalysingRow from "@src/components/form/AnalysingRow";
import BandBadge from "@src/components/form/BandBadge";
import { useTheme } from "@src/context/ThemeContext";
import type { WorkoutRecordedSet } from "@src/hooks/useWorkoutRecordedSets";
import { baseColors } from "@src/theme/colors";
import {
  NEW_BADGE,
  UNTRACKABLE_ROW_TEXT,
  VIEW_FEEDBACK,
} from "@src/constants/formMessages";

const CHEVRON_SIZE = 20;

interface RecordedSetCardProps {
  item: WorkoutRecordedSet;
  onOpen: (sessionId: number) => void;
  onRetry: (sessionId: number) => void;
  isRetrying: boolean;
}

const RecordedSetCard: React.FC<RecordedSetCardProps> = ({
  item,
  onOpen,
  onRetry,
  isRetrying,
}) => {
  const { colors } = useTheme();
  const { effectiveStatus } = item;

  if (effectiveStatus === "PROCESSING" || effectiveStatus === "FAILED") {
    return (
      <AnalysingRow
        exerciseDisplayName={item.exerciseDisplayName}
        setNumber={item.setNumber}
        status={effectiveStatus}
        event={item.liveEvent}
        failureReason={item.failureReason}
        onRetry={() => onRetry(item.sessionId)}
        isRetrying={isRetrying}
      />
    );
  }

  const isScored = item.outcome === "SCORED" && item.band !== null;

  return (
    <Pressable
      onPress={() => onOpen(item.sessionId)}
      accessibilityRole="button"
      accessibilityLabel={`${VIEW_FEEDBACK}: ${item.exerciseDisplayName}`}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text }]}>
          {item.setNumber === null
            ? item.exerciseDisplayName
            : `${item.exerciseDisplayName} - Set ${item.setNumber}`}
        </Text>
        {isScored ? (
          <BandBadge band={item.band} size="sm" />
        ) : (
          <Text style={[styles.meta, { color: colors.text }]}>
            {UNTRACKABLE_ROW_TEXT}
          </Text>
        )}
      </View>
      {item.isUnseen && (
        <View style={styles.newPill}>
          <Text style={styles.newText}>{NEW_BADGE}</Text>
        </View>
      )}
      <Ionicons
        name="chevron-forward"
        size={CHEVRON_SIZE}
        color={colors.text}
      />
    </Pressable>
  );
};

export default RecordedSetCard;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    gap: 10,
  },
  info: { flex: 1, gap: 6 },
  name: { fontSize: 16, fontWeight: "600" },
  meta: { fontSize: 13, opacity: 0.8 },
  newPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: baseColors.blue,
  },
  newText: { color: baseColors.white, fontSize: 12, fontWeight: "700" },
});
