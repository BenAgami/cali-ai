import React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  FORM_DIMENSION_LABELS,
  type FormBand,
  type FormDimension,
} from "@repo/common";

import BandBadge from "@src/components/form/BandBadge";
import { useTheme } from "@src/context/ThemeContext";
import { NOT_ASSESSED_TEXT } from "@src/constants/formMessages";

interface DimensionRowProps {
  dimension: FormDimension;
  band: FormBand | null;
  isAssessed: boolean;
}

const DimensionRow: React.FC<DimensionRowProps> = ({
  dimension,
  band,
  isAssessed,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: colors.surface }]}>
      <Text style={[styles.label, { color: colors.text }]}>
        {FORM_DIMENSION_LABELS[dimension]}
      </Text>
      {isAssessed && band !== null ? (
        <BandBadge band={band} size="sm" />
      ) : (
        <Text style={[styles.notAssessed, { color: colors.text }]}>
          {NOT_ASSESSED_TEXT}
        </Text>
      )}
    </View>
  );
};

export default DimensionRow;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    gap: 12,
  },
  label: { fontSize: 16, fontWeight: "600", flexShrink: 1 },
  notAssessed: { fontSize: 13, opacity: 0.7, flexShrink: 1 },
});
