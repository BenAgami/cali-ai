import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "@src/context/ThemeContext";
import { SHOW_EARLIER_SETS } from "@src/constants/formMessages";

interface ShowEarlierSetsButtonProps {
  isLoading: boolean;
  onPress: () => void;
}

const ShowEarlierSetsButton: React.FC<ShowEarlierSetsButtonProps> = ({
  isLoading,
  onPress,
}) => {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={isLoading}
      style={[styles.button, { backgroundColor: colors.surface }]}
      accessibilityRole="button"
      accessibilityLabel={SHOW_EARLIER_SETS}
    >
      {isLoading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={[styles.label, { color: colors.text }]}>
          {SHOW_EARLIER_SETS}
        </Text>
      )}
    </Pressable>
  );
};

export default ShowEarlierSetsButton;

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 12,
    marginTop: 12,
    paddingVertical: 12,
  },
  label: { fontSize: 14, fontWeight: "600" },
});
