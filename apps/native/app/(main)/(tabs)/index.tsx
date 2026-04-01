import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { Stack, router } from "expo-router";

import { useTheme } from "@src/context/ThemeContext";
import { useAuth } from "@src/context/AuthContext";
import AvatarDisplay from "@src/components/AvatarDisplay";
import ReminderCard from "@src/components/ReminderCard";

const API_BASE = "http://localhost:3000";

type UserProfile = {
  uuid: string;
  username: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  experienceLevel: string;
};

const Home: React.FC = () => {
  const { colors } = useTheme();
  const { token } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data) {
          setUser(json.data);
        }
      } catch {
        // ignore network errors on home screen
      }
    };

    fetchUser();
  }, [token]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.push("/profile")}
              activeOpacity={0.8}
            >
              <AvatarDisplay
                uri={user?.avatarUrl ?? null}
                username={user?.username ?? "U"}
                size={44}
              />
            </TouchableOpacity>
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
