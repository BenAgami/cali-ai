import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import { useTheme } from "@src/context/ThemeContext";
import { useAuth } from "@src/context/AuthContext";
import AvatarDisplay from "@src/components/AvatarDisplay";

const API_BASE = "http://localhost:3000";

type Goal = {
  goalType: string;
  title: string;
  targetValue: number | null;
  targetUnit: string | null;
};

type UserProfile = {
  uuid: string;
  username: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  experienceLevel: string;
  goals: Goal[];
};

function formatExperienceLevel(level: string): string {
  return level.charAt(0) + level.slice(1).toLowerCase();
}

const ProfileScreen: React.FC = () => {
  const { colors } = useTheme();
  const { token } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setError("Not authenticated. Please log in.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError("Failed to load profile.");
        return;
      }
      const json = await res.json();
      if (json.success && json.data) {
        setUser(json.data);
      } else {
        setError("Failed to load profile.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchUser();
    }, [fetchUser])
  );

  const activeGoal = user?.goals?.[0] ?? null;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <ActivityIndicator
            size="large"
            color={colors.text}
            style={styles.loader}
          />
        )}

        {!loading && error && (
          <Text style={[styles.errorText, { color: "#E57373" }]}>{error}</Text>
        )}

        {!loading && user && (
          <>
            <View style={styles.avatarSection}>
              <AvatarDisplay
                uri={user.avatarUrl}
                username={user.username}
                size={100}
              />
              <Text style={[styles.username, { color: colors.text }]}>
                {user.username}
              </Text>
              <Text style={[styles.email, { color: colors.text }]}>
                {user.email}
              </Text>
            </View>

            <View
              style={[styles.card, { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.cardLabel, { color: colors.text }]}>
                Experience Level
              </Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: colors.background },
                ]}
              >
                <Text style={[styles.badgeText, { color: colors.text }]}>
                  {formatExperienceLevel(user.experienceLevel)}
                </Text>
              </View>
            </View>

            <View
              style={[styles.card, { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.cardLabel, { color: colors.text }]}>
                Active Goal
              </Text>
              {activeGoal ? (
                <View>
                  <Text
                    style={[styles.goalType, { color: colors.text }]}
                  >
                    {activeGoal.goalType}
                  </Text>
                  <Text
                    style={[styles.goalTitle, { color: colors.text }]}
                  >
                    {activeGoal.title}
                  </Text>
                  {activeGoal.targetValue != null && (
                    <Text
                      style={[styles.goalTarget, { color: colors.text }]}
                    >
                      Target: {activeGoal.targetValue}{" "}
                      {activeGoal.targetUnit ?? ""}
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={[styles.noGoal, { color: colors.text }]}>
                  No goal set yet
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.editButton, { backgroundColor: "#007AFF" }]}
              onPress={() => router.push("/profile-edit")}
              activeOpacity={0.8}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    padding: 24,
    paddingBottom: 48,
    alignItems: "center",
  },
  loader: {
    marginTop: 60,
  },
  errorText: {
    fontSize: 14,
    marginTop: 40,
    textAlign: "center",
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 28,
  },
  username: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 14,
  },
  email: {
    fontSize: 14,
    opacity: 0.65,
    marginTop: 4,
  },
  card: {
    width: "100%",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    opacity: 0.6,
    marginBottom: 8,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 15,
    fontWeight: "600",
  },
  goalType: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    opacity: 0.55,
    marginBottom: 4,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  goalTarget: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 4,
  },
  noGoal: {
    fontSize: 15,
    opacity: 0.5,
  },
  editButton: {
    marginTop: 12,
    width: "100%",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  editButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
