export const baseColors = {
  white: "#FFFFFF",
  black: "#000000",
  grayLight: "#F2F2F7",
  grayDark: "#767577",
  blue: "#007AFF",
};

export const themes = {
  light: {
    background: baseColors.grayLight,
    text: baseColors.black,
    surface: baseColors.white,
  },
  dark: {
    background: baseColors.black,
    text: baseColors.white,
    surface: baseColors.grayDark,
  },
} as const;
export type ThemeNames = keyof typeof themes;
export type ThemeColors = (typeof themes)[keyof typeof themes];
