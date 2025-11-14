import pluginReactNative from "eslint-plugin-react-native";
import { config as reactConfig } from "./react-internal.js";

/**
 * ESLint configuration for React Native + Expo apps.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
  ...reactConfig,
  {
    plugins: {
      "react-native": pluginReactNative,
    },
    languageOptions: {
      globals: {
        __DEV__: "readonly",
      },
    },
    rules: {
      "react-native/no-inline-styles": "warn",
      "react-native/no-color-literals": "off",
      "react-native/split-platform-components": "warn",
    },
  },
];
