import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@src/context/ThemeContext";
import { baseColors } from "@src/theme/colors";
import { RECORD_AGAIN, UNTRACKABLE_TITLE } from "@src/constants/formMessages";

interface CameraAdviceProps {
  advice: string[];
  onRecordAgain?: () => void;
}

const CameraAdvice: React.FC<CameraAdviceProps> = ({
  advice,
  onRecordAgain,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        {UNTRACKABLE_TITLE}
      </Text>
      {advice.map((tip) => (
        <Text key={tip} style={[styles.tip, { color: colors.text }]}>
          {`• ${tip}`}
        </Text>
      ))}
      {onRecordAgain !== undefined && (
        <Pressable
          onPress={onRecordAgain}
          accessibilityRole="button"
          accessibilityLabel={RECORD_AGAIN}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: baseColors.blue, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={styles.buttonText}>{RECORD_AGAIN}</Text>
        </Pressable>
      )}
    </View>
  );
};

export default CameraAdvice;

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12, gap: 8 },
  title: { fontSize: 18, fontWeight: "700" },
  tip: { fontSize: 15, lineHeight: 21 },
  button: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: baseColors.white, fontSize: 16, fontWeight: "700" },
});
