import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@src/context/ThemeContext";

export interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}

const Stepper: React.FC<StepperProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}) => {
  const { colors } = useTheme();
  const decrement = () => {
    const next = Math.max(min, value - step);
    if (next !== value) onChange(next);
  };
  const increment = () => {
    const next = Math.min(max, value + step);
    if (next !== value) onChange(next);
  };
  const display = format ? format(value) : String(value);
  const isAtMin = value <= min;
  const isAtMax = value >= max;

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={styles.controlRow}>
        <Pressable
          onPress={decrement}
          disabled={isAtMin}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.surface,
              opacity: isAtMin ? 0.4 : pressed ? 0.7 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>−</Text>
        </Pressable>
        <Text
          style={[
            styles.value,
            { color: colors.text, fontVariant: ["tabular-nums"] },
          ]}
          accessibilityLabel={`${label} ${display}`}
        >
          {display}
        </Text>
        <Pressable
          onPress={increment}
          disabled={isAtMax}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.surface,
              opacity: isAtMax ? 0.4 : pressed ? 0.7 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default Stepper;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  label: { fontSize: 14, fontWeight: "500" },
  controlRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 22, fontWeight: "600" },
  value: {
    minWidth: 56,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
  },
});
