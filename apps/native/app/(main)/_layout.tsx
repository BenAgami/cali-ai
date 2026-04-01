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
    </Stack>
  );
};

export default MainLayout;
