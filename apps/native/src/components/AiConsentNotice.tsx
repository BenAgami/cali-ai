import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@src/context/ThemeContext";
import { AI_CONSENT_BODY_TEXT } from "@src/constants/aiMessages";

interface AiConsentNoticeProps {
  onAccept: () => void;
  isAccepting: boolean;
}

const AiConsentNotice: React.FC<AiConsentNoticeProps> = ({
  onAccept,
  isAccepting,
}) => {
  const { colors } = useTheme();

  return (
    <View>
      <Text style={[styles.heading, { color: colors.text }]}>
        Before your first AI workout
      </Text>
      <Text style={[styles.body, { color: colors.text }]}>
        {AI_CONSENT_BODY_TEXT}
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: isAccepting || pressed ? "#007AFF88" : "#007AFF" },
        ]}
        onPress={onAccept}
        disabled={isAccepting}
        accessibilityRole="button"
        accessibilityLabel="I agree"
      >
        <Text style={styles.buttonText}>I agree</Text>
      </Pressable>
    </View>
  );
};

export default AiConsentNotice;

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 22, opacity: 0.85 },
  button: {
    marginTop: 24,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
});
