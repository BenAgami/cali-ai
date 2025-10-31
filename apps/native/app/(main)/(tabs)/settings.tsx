import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";

import { ScreenHeader, SwitchRow } from "@repo/ui";

import { useTheme } from "@src/context/ThemeContext";
import { baseColors } from "@src/theme/colors";

const Settings: React.FC = () => {
  const { currentTheme, toggleTheme, colors } = useTheme();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.container}>
          <ScreenHeader
            title="Settings"
            subtitle="Customize your experience"
            color={colors.text}
          />

          <ScrollView>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Preferences
              </Text>

              <View
                style={[
                  styles.sectionBody,
                  { backgroundColor: colors.background },
                ]}
              >
                <View style={[styles.rowWrapper, styles.rowFirst]}>
                  <SwitchRow
                    label="Dark Mode"
                    isEnabled={currentTheme === "dark"}
                    onToggle={toggleTheme}
                    colors={colors}
                    iconName="moon"
                    iconBackground={baseColors.blue}
                  />
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </>
  );
};

export default Settings;

const styles = StyleSheet.create({
  container: {
    paddingVertical: 24,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
  /** Section */
  section: {
    paddingTop: 12,
  },
  sectionTitle: {
    marginVertical: 8,
    marginHorizontal: 24,
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  sectionBody: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#5f5f5f",
  },
  /** Row */
  rowWrapper: {
    borderTopWidth: 1,
    borderColor: "#5f5f5f",
  },
  rowFirst: {
    borderTopWidth: 0,
  },
});
