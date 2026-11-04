import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useTheme } from "@src/context/ThemeContext";
import type {
  BodyMetricsField,
  BodyMetricsFormState,
} from "@src/hooks/useBodyMetricsForm";
import type { UnitSystem } from "@src/utils/units";

interface BodyMetricsFormProps {
  form: BodyMetricsFormState;
}

const UNIT_OPTIONS: Array<{ value: UnitSystem; label: string }> = [
  { value: "metric", label: "Metric" },
  { value: "imperial", label: "Imperial" },
];

const BodyMetricsForm: React.FC<BodyMetricsFormProps> = ({ form }) => {
  const { colors } = useTheme();
  const { unitSystem, fields, setField, setUnitSystem } = form;

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.surface,
      color: colors.text,
      borderColor: colors.text + "33",
    },
  ];

  const renderInput = (
    field: BodyMetricsField,
    label: string,
    keyboardType: "decimal-pad" | "number-pad" = "decimal-pad",
    flex = 1,
  ) => (
    <TextInput
      style={[inputStyle, { flex }]}
      value={fields[field]}
      onChangeText={(text) => setField(field, text)}
      keyboardType={keyboardType}
      placeholder={label}
      placeholderTextColor={colors.text + "66"}
      accessibilityLabel={label}
      maxLength={6}
    />
  );

  return (
    <View>
      <View style={[styles.toggle, { backgroundColor: colors.surface }]}>
        {UNIT_OPTIONS.map((opt) => {
          const active = opt.value === unitSystem;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setUnitSystem(opt.value)}
              style={[
                styles.toggleOption,
                active && { backgroundColor: colors.background },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.toggleLabel,
                  { color: colors.text, opacity: active ? 1 : 0.6 },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {unitSystem === "metric" ? (
        <>
          <Text style={[styles.label, { color: colors.text }]}>
            Height (cm)
          </Text>
          <View style={styles.row}>
            {renderInput("heightCm", "Height in centimeters")}
          </View>
          <Text style={[styles.label, { color: colors.text }]}>
            Weight (kg)
          </Text>
          <View style={styles.row}>
            {renderInput("weightKg", "Weight in kilograms")}
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.label, { color: colors.text }]}>Height</Text>
          <View style={styles.row}>
            {renderInput("heightFt", "Height feet", "number-pad")}
            <Text style={[styles.unit, { color: colors.text }]}>ft</Text>
            {renderInput("heightIn", "Height inches", "decimal-pad")}
            <Text style={[styles.unit, { color: colors.text }]}>in</Text>
          </View>
          <Text style={[styles.label, { color: colors.text }]}>
            Weight (lb)
          </Text>
          <View style={styles.row}>
            {renderInput("weightLb", "Weight in pounds")}
          </View>
        </>
      )}
    </View>
  );
};

export default BodyMetricsForm;

const styles = StyleSheet.create({
  toggle: { flexDirection: "row", borderRadius: 10, padding: 4 },
  toggleOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  toggleLabel: { fontSize: 13, fontWeight: "600" },
  label: { fontSize: 14, fontWeight: "600", marginTop: 14, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  unit: { fontSize: 14, opacity: 0.7 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
});
