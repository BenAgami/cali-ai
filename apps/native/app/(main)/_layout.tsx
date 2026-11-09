import React from "react";
import { Stack } from "expo-router";

import AnalysisToast from "@src/components/form/AnalysisToast";
import { AnalysisTrackerProvider } from "@src/context/AnalysisTrackerContext";
import { FEEDBACK_SCREEN_TITLE } from "@src/constants/formMessages";

const MainLayout: React.FC = () => {
  return (
    <AnalysisTrackerProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="profile"
          options={{ headerShown: true, title: "Profile" }}
        />
        <Stack.Screen
          name="profile-edit"
          options={{ headerShown: true, title: "Edit Profile" }}
        />
        <Stack.Screen
          name="onboarding-body-metrics"
          options={{
            headerShown: true,
            title: "About you",
            headerBackVisible: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="exercise-catalog"
          options={{ headerShown: true, title: "Exercises" }}
        />
        <Stack.Screen
          name="exercise-detail"
          options={{ headerShown: true, title: "Exercise" }}
        />
        <Stack.Screen
          name="workout-detail"
          options={{ headerShown: true, title: "Workout" }}
        />
        <Stack.Screen
          name="analysis-result"
          options={{ headerShown: true, title: FEEDBACK_SCREEN_TITLE }}
        />
        <Stack.Screen
          name="workout-execute"
          options={{
            headerShown: true,
            title: "Workout in progress",
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="workout-builder"
          options={{ headerShown: true, title: "Build workout" }}
        />
        <Stack.Screen
          name="workout-generate"
          options={{ headerShown: true, title: "Generate with AI" }}
        />
        <Stack.Screen
          name="dev-pose-check"
          options={{ headerShown: true, title: "Pose check" }}
        />
        <Stack.Screen
          name="dev-pipeline-check"
          options={{ headerShown: true, title: "Pipeline check" }}
        />
      </Stack>
      <AnalysisToast />
    </AnalysisTrackerProvider>
  );
};

export default MainLayout;
