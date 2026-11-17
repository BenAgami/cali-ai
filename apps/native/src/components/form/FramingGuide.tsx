import React from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  FORM_CAPTURE_SETUP,
  FORM_VIEW_HINTS,
  type FormAnalysisExercise,
  type SetupIssue,
} from "@repo/common";
import { baseColors } from "@src/theme/colors";
import { FORM_BAND_COLORS } from "@src/theme/formBands";

const PORTRAIT_BOX = { width: "80%", height: "80%" } as const;
const LANDSCAPE_BOX = { width: "80%", height: "70%" } as const;
const NEUTRAL_OUTLINE = "rgba(255,255,255,0.7)";
const HINT_BACKDROP = "rgba(0,0,0,0.55)";

interface FramingGuideProps {
  exerciseCode: FormAnalysisExercise;
  issue: SetupIssue | null;
  isReady: boolean;
}

/** Dashed framing outline plus the per-exercise camera placement hint. */
const FramingGuide: React.FC<FramingGuideProps> = ({
  exerciseCode,
  issue,
  isReady,
}) => {
  const isPortrait =
    FORM_CAPTURE_SETUP[exerciseCode].orientation === "portrait";
  let outlineColor = NEUTRAL_OUTLINE;
  if (isReady) outlineColor = FORM_BAND_COLORS.EXCELLENT.background;
  else if (issue !== null)
    outlineColor = FORM_BAND_COLORS.NEEDS_WORK.background;

  return (
    // direction: "ltr" keeps the layer stable on RTL phones.
    <View style={[StyleSheet.absoluteFill, styles.layer]} pointerEvents="none">
      <View
        style={[
          styles.outline,
          isPortrait ? PORTRAIT_BOX : LANDSCAPE_BOX,
          { borderColor: outlineColor },
        ]}
      />
      <View style={styles.hint}>
        <Text style={styles.hintText}>{FORM_VIEW_HINTS[exerciseCode]}</Text>
      </View>
    </View>
  );
};

export default FramingGuide;

const styles = StyleSheet.create({
  layer: { direction: "ltr", alignItems: "center", justifyContent: "center" },
  outline: { borderWidth: 3, borderStyle: "dashed", borderRadius: 24 },
  hint: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    padding: 8,
    borderRadius: 10,
    backgroundColor: HINT_BACKDROP,
  },
  hintText: {
    color: baseColors.white,
    fontSize: 14,
    textAlign: "center",
  },
});
