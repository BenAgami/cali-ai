import React, { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

import { ScreenHeader } from "@repo/ui";
import { useTheme } from "@src/context/ThemeContext";
import { useWorkouts } from "@src/hooks/queries/useWorkouts";
import { workoutKeys } from "@src/api";
import WorkoutCard from "@src/components/WorkoutCard";

const WorkoutsTab: React.FC = () => {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useWorkouts();

  // Per Phase 2 lesson + RESEARCH Pitfall 4: invalidate the list query on focus
  // so that returning from create/edit/delete shows the latest data.
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: workoutKeys.lists() });
    }, [queryClient]),
  );

  const handleCardPress = (workoutId: number) => {
    router.push({
      pathname: "/workout-detail",
      params: { id: String(workoutId) },
    });
  };

  const handleGeneratePress = () => {
    router.push("/workout-generate");
  };

  const handleCreatePress = () => {
    router.push("/workout-builder");
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <ScreenHeader
        title="Workouts"
        subtitle="Your saved workouts"
        color={colors.text}
      />

      {isLoading && (
        <ActivityIndicator
          size="large"
          color={colors.text}
          style={styles.loader}
        />
      )}

      {error && !isLoading && (
        <Text style={[styles.errorText, { color: "#E57373" }]}>
          Failed to load workouts.
        </Text>
      )}

      {!isLoading && !error && (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <WorkoutCard workout={item} onPress={handleCardPress} />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.text }]}>
                You haven't created any workouts yet.
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.text }]}>
                Tap + to build one, or Generate with AI.
              </Text>
            </View>
          }
        />
      )}

      <Pressable
        onPress={handleGeneratePress}
        style={({ pressed }) => [
          styles.generatePill,
          { opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Generate workout with AI"
      >
        <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
        <Text style={styles.generateText}>Generate with AI</Text>
      </Pressable>

      <Pressable
        onPress={handleCreatePress}
        style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.85 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Create new workout"
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>
    </SafeAreaView>
  );
};

export default WorkoutsTab;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loader: { marginTop: 60 },
  errorText: { fontSize: 14, marginTop: 40, textAlign: "center" },
  listContent: { paddingTop: 8, paddingBottom: 96 },
  emptyContainer: {
    paddingTop: 80,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  emptyText: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: "center",
    marginTop: 8,
  },
  generatePill: {
    position: "absolute",
    right: 24,
    bottom: 96,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#007AFF",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  generateText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
