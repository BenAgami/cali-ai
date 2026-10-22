import React from "react";
import { Stack } from "expo-router";

const MainLayout: React.FC = () => {
  return (
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
        name="dev-pose-check"
        options={{ headerShown: true, title: "Pose check" }}
      />
      <Stack.Screen
        name="dev-pipeline-check"
        options={{ headerShown: true, title: "Pipeline check" }}
      />
    </Stack>
  );
};

export default MainLayout;
