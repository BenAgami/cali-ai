import React from "react";
import {
  StyleSheet,
  Text,
  Pressable,
  View,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { Stack, router } from "expo-router";

import { useTheme } from "@src/context/ThemeContext";
import { useProfile } from "@src/hooks/queries/useProfile";
import AvatarDisplay from "@src/components/AvatarDisplay";
import ReminderCard from "@src/components/ReminderCard";

const Home: React.FC = () => {
  const { colors } = useTheme();
  const { data: user } = useProfile();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.push("/profile")}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <AvatarDisplay
                uri={user?.avatarUrl ?? null}
                username={user?.username ?? "U"}
                size={44}
              />
            </Pressable>
            <Text style={[styles.greeting, { color: colors.text }]}>
              Hello, {user?.username ?? "User"}
            </Text>
          </View>
          <View style={styles.reminderSection}>
            <ReminderCard username={user?.username ?? "User"} />
          </View>
          <View style={styles.content}>
            <Text style={[styles.placeholder, { color: colors.text }]}>
              Your workouts will appear here.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

export default Home;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  pressed: {
    opacity: 0.8,
  },
  reminderSection: {
    marginTop: 20,
  },
  greeting: {
    fontSize: 20,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
  },
  placeholder: {
    fontSize: 16,
    opacity: 0.6,
  },
});
