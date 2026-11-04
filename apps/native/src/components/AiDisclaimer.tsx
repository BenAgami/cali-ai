import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@src/context/ThemeContext";
import { AI_DISCLAIMER_TEXT } from "@src/constants/aiMessages";

interface AiDisclaimerProps {
  compact?: boolean;
}

const AiDisclaimer: React.FC<AiDisclaimerProps> = ({ compact = false }) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface },
        compact && styles.compact,
      ]}
    >
      <Ionicons
        name="information-circle-outline"
        size={compact ? 16 : 20}
        color={colors.text}
        style={styles.icon}
      />
      <Text
        accessibilityRole="text"
        style={[
          styles.text,
          { color: colors.text },
          compact && styles.compactText,
        ]}
      >
        {AI_DISCLAIMER_TEXT}
      </Text>
    </View>
  );
};

export default AiDisclaimer;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  compact: { padding: 8 },
  icon: { marginTop: 1, opacity: 0.8 },
  text: { flex: 1, fontSize: 13, lineHeight: 18, opacity: 0.8 },
  compactText: { fontSize: 12, lineHeight: 16 },
});
