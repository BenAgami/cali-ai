import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@src/context/ThemeContext";
import {
  FIX_THIS,
  MAX_CORRECTIONS_SHOWN,
  WHAT_WENT_WELL,
  repLabel,
} from "@src/constants/formMessages";

interface FeedbackPositive {
  text: string;
  repNumbers: number[];
}

interface FeedbackCorrection {
  code: string;
  title: string;
  cue: string;
  detail: string;
  repNumbers: number[];
}

interface FeedbackBlocksProps {
  positives: FeedbackPositive[];
  corrections: FeedbackCorrection[];
}

const RepChip: React.FC<{ repNumbers: number[] }> = ({ repNumbers }) => {
  const { colors } = useTheme();
  if (repNumbers.length === 0) return null;
  return (
    <View style={[styles.chip, { borderColor: colors.text }]}>
      <Text style={[styles.chipText, { color: colors.text }]}>
        {repLabel(repNumbers)}
      </Text>
    </View>
  );
};

const FeedbackBlocks: React.FC<FeedbackBlocksProps> = ({
  positives,
  corrections,
}) => {
  const { colors } = useTheme();

  return (
    <View>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.heading, { color: colors.text }]}>
          {WHAT_WENT_WELL}
        </Text>
        {positives.map((positive) => (
          <View key={positive.text} style={styles.item}>
            <Text style={[styles.body, { color: colors.text }]}>
              {positive.text}
            </Text>
            <RepChip repNumbers={positive.repNumbers} />
          </View>
        ))}
      </View>
      {corrections.slice(0, MAX_CORRECTIONS_SHOWN).map((correction) => (
        <View
          key={correction.code}
          style={[styles.card, { backgroundColor: colors.surface }]}
        >
          <Text style={[styles.heading, { color: colors.text }]}>
            {FIX_THIS}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {correction.title}
          </Text>
          <Text style={[styles.body, { color: colors.text }]}>
            {correction.detail}
          </Text>
          <Text style={[styles.cue, { color: colors.text }]}>
            {correction.cue}
          </Text>
          <RepChip repNumbers={correction.repNumbers} />
        </View>
      ))}
    </View>
  );
};

export default FeedbackBlocks;

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 10, marginBottom: 12, gap: 6 },
  heading: { fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
  item: { gap: 4 },
  title: { fontSize: 16, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 21 },
  cue: { fontSize: 15, fontWeight: "700", lineHeight: 21 },
  chip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  chipText: { fontSize: 12, fontWeight: "600" },
});
