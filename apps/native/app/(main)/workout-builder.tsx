import React, { useCallback } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";

import AiDisclaimer from "@src/components/AiDisclaimer";
import { useTheme } from "@src/context/ThemeContext";
import {
  useWorkoutBuilder,
  type DraftExercise,
} from "@src/hooks/useWorkoutBuilder";
import WorkoutExerciseRow from "@src/components/WorkoutExerciseRow";
import { consumePickedExercise } from "@src/state/pickedExerciseStore";

type BuilderParams = {
  id?: string;
  fromGeneration?: string;
};

const BUILDER_PATH = "/workout-builder";
const CATALOG_PATH = "/exercise-catalog";

const WorkoutBuilderScreen: React.FC = () => {
  const { colors } = useTheme();
  const params = useLocalSearchParams<BuilderParams>();
  const workoutId = params.id ? Number(params.id) : undefined;

  const builder = useWorkoutBuilder({
    workoutId,
    fromGeneration: params.fromGeneration === "1",
  });

  // Pull a picked exercise from the store every time the builder regains focus.
  // Fires after returning from the picker via router.dismiss(2).
  // The store self-clears on consume, so it cannot fire twice for one pick.
  useFocusEffect(
    useCallback(() => {
      const picked = consumePickedExercise();
      if (picked) {
        builder.addExercise(picked);
      }
    }, [builder]),
  );

  const handleAddExercise = () => {
    router.push({
      pathname: CATALOG_PATH,
      params: { pickerReturnTo: BUILDER_PATH },
    });
  };

  const handleSave = () => {
    void builder.save(
      (createdId) => {
        // Replace so the back button skips the builder.
        router.replace({
          pathname: "/workout-detail",
          params: { id: String(createdId) },
        });
      },
      (updatedId) => {
        router.replace({
          pathname: "/workout-detail",
          params: { id: String(updatedId) },
        });
      },
    );
  };

  if (builder.isLoading) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator
          size="large"
          color={colors.text}
          style={styles.loader}
        />
      </SafeAreaView>
    );
  }

  if (builder.error) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <Text style={[styles.errorText, { color: "#E57373" }]}>
          Failed to load workout.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex1}
      >
        <View style={styles.header}>
          <TextInput
            value={builder.name}
            onChangeText={builder.setName}
            placeholder="Workout name"
            placeholderTextColor={colors.text + "80"}
            style={[
              styles.nameInput,
              { backgroundColor: colors.surface, color: colors.text },
            ]}
            maxLength={100}
            accessibilityLabel="Workout name"
          />
        </View>

        {builder.isAiDraft && (
          <View style={styles.disclaimer}>
            <AiDisclaimer compact />
          </View>
        )}

        <DraggableFlatList
          data={builder.exercises}
          keyExtractor={(item) => item.localId}
          onDragEnd={({ data }) => builder.reorderExercises(data)}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Pressable
              onPress={handleAddExercise}
              style={({ pressed }) => [
                styles.addButton,
                {
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Add exercise"
            >
              <Text style={[styles.addButtonText, { color: "#007AFF" }]}>
                + Add exercise
              </Text>
            </Pressable>
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.text }]}>
              No exercises yet. Tap "+ Add exercise" above.
            </Text>
          }
          renderItem={({
            item,
            drag,
            isActive,
          }: RenderItemParams<DraftExercise>) => (
            <ScaleDecorator>
              <WorkoutExerciseRow
                exerciseDisplayName={item.exerciseDisplayName}
                exerciseType={item.exerciseType}
                values={{
                  sets: item.sets,
                  reps: item.reps,
                  durationSecs: item.durationSecs,
                  restSecs: item.restSecs,
                }}
                onChange={(values) =>
                  builder.updateExercise(item.localId, values)
                }
                onRemove={() => builder.removeExercise(item.localId)}
                onDragStart={drag}
                isActive={isActive}
              />
            </ScaleDecorator>
          )}
        />

        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.surface,
            },
          ]}
        >
          <Pressable
            onPress={handleSave}
            disabled={!builder.validation.valid || builder.saving}
            style={({ pressed }) => [
              styles.saveButton,
              {
                backgroundColor:
                  !builder.validation.valid || builder.saving
                    ? "#A0A0A0"
                    : pressed
                      ? "#006EE6"
                      : "#007AFF",
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              builder.isEdit ? "Save changes" : "Save workout"
            }
          >
            <Text style={styles.saveButtonText}>
              {builder.saving
                ? "Saving..."
                : builder.isEdit
                  ? "Save changes"
                  : "Save workout"}
            </Text>
          </Pressable>
          {!builder.validation.valid && builder.validation.message && (
            <Text style={[styles.validationText, { color: colors.text }]}>
              {builder.validation.message}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default WorkoutBuilderScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex1: { flex: 1 },
  loader: { marginTop: 60 },
  errorText: { fontSize: 14, marginTop: 40, textAlign: "center" },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  nameInput: {
    fontSize: 20,
    fontWeight: "600",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  disclaimer: { paddingHorizontal: 16, paddingBottom: 4 },
  listContent: { paddingTop: 12, paddingBottom: 24 },
  addButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#007AFF",
    borderStyle: "dashed",
  },
  addButtonText: { fontSize: 15, fontWeight: "700" },
  emptyText: { textAlign: "center", marginTop: 24, opacity: 0.6 },
  footer: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  validationText: {
    fontSize: 13,
    opacity: 0.7,
    textAlign: "center",
    marginTop: 8,
  },
});
