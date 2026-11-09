import type { FormBand } from "@repo/common";

type BandColors = { background: string; text: string };

// Every background/text pair has a WCAG contrast ratio of at least 4.5:1.
// Green (best) to red (worst) per D-05; the label is always printed too.
export const FORM_BAND_COLORS: Record<FormBand, BandColors> = {
  EXCELLENT: { background: "#1E7B34", text: "#FFFFFF" },
  GOOD: { background: "#A8E0A0", text: "#0B3D14" },
  FAIR: { background: "#FFE08A", text: "#4A3800" },
  NEEDS_WORK: { background: "#FFB870", text: "#4A2300" },
  POOR: { background: "#C62828", text: "#FFFFFF" },
};

export const NOT_ASSESSED_COLORS: BandColors = {
  background: "#E0E0E0",
  text: "#424242",
};
