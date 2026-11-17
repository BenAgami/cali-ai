import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { FORM_BAND_LABELS, type FormBand } from "@repo/common";

import { NOT_ASSESSED_TEXT } from "@src/constants/formMessages";
import { FORM_BAND_COLORS, NOT_ASSESSED_COLORS } from "@src/theme/formBands";

interface BandBadgeProps {
  band: FormBand | null;
  size?: "lg" | "sm";
}

const BandBadge: React.FC<BandBadgeProps> = ({ band, size = "sm" }) => {
  const palette = band === null ? NOT_ASSESSED_COLORS : FORM_BAND_COLORS[band];
  const label = band === null ? NOT_ASSESSED_TEXT : FORM_BAND_LABELS[band];
  const isLarge = size === "lg";

  return (
    <View
      accessible
      accessibilityLabel={`Form: ${label}`}
      style={[
        styles.pill,
        isLarge ? styles.pillLarge : styles.pillSmall,
        { backgroundColor: palette.background },
      ]}
    >
      <Text
        style={[
          isLarge ? styles.textLarge : styles.textSmall,
          { color: palette.text },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

export default BandBadge;

const styles = StyleSheet.create({
  pill: { alignSelf: "flex-start", borderRadius: 999 },
  pillLarge: { paddingHorizontal: 20, paddingVertical: 10 },
  pillSmall: { paddingHorizontal: 10, paddingVertical: 4 },
  textLarge: { fontSize: 22, fontWeight: "700" },
  textSmall: { fontSize: 13, fontWeight: "600" },
});
