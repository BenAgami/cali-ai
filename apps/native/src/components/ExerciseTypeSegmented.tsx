import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@src/context/ThemeContext";

export type ExerciseTypeFilter = "ALL" | "DYNAMIC" | "STATIC_HOLD";

interface ExerciseTypeSegmentedProps {
  value: ExerciseTypeFilter;
  onChange: (value: ExerciseTypeFilter) => void;
}

const OPTIONS: Array<{ value: ExerciseTypeFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "DYNAMIC", label: "Dynamic" },
  { value: "STATIC_HOLD", label: "Static Hold" },
];

const ExerciseTypeSegmented: React.FC<ExerciseTypeSegmentedProps> = ({
  value,
  onChange,
}) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {OPTIONS.map((opt) => {
        const isActive = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.option,
              isActive && { backgroundColor: colors.background },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={[
                styles.label,
                { color: colors.text, opacity: isActive ? 1 : 0.6 },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export default ExerciseTypeSegmented;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 4,
    marginHorizontal: 16,
  },
  option: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
});
