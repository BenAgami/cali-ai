import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";

import { ScreenHeader, SwitchRow } from "@repo/ui";

import { useTheme } from "@src/context/ThemeContext";
import { baseColors } from "@src/theme/colors";

const Settings: React.FC = () => {
  const { currentTheme, toggleTheme, colors } = useTheme();
  const router = useRouter();

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
                    onToggle={() => {
                      void toggleTheme();
                    }}
                    colors={colors}
                    iconName="moon"
                    iconBackground={baseColors.blue}
                  />
                </View>
              </View>
            </View>

            {__DEV__ ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Developer
                </Text>

                <View
                  style={[
                    styles.sectionBody,
                    { backgroundColor: colors.background },
                  ]}
                >
                  <Pressable
                    style={styles.devRow}
                    onPress={() => {
                      router.push("/dev-pose-check");
                    }}
                  >
                    <Text style={{ color: colors.text }}>Pose check</Text>
                  </Pressable>
                  <Pressable
                    style={styles.devRow}
                    onPress={() => {
                      router.push("/dev-pipeline-check");
                    }}
                  >
                    <Text style={{ color: colors.text }}>Pipeline check</Text>
                  </Pressable>
                  <Pressable
                    style={styles.devRow}
                    onPress={() => {
                      router.push("/dev-blazepose-check");
                    }}
                  >
                    <Text style={{ color: colors.text }}>BlazePose check</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
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
  devRow: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  rowFirst: {
    borderTopWidth: 0,
  },
});
