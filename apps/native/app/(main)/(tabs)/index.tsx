import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Stack, router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "@src/context/ThemeContext";

const Home: React.FC = () => {
  const { colors } = useTheme();

  const handleNavigate = () => {
    router.push("/register");
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.header, { color: colors.text }]}>Clear Night</Text>
        <TouchableOpacity
          onPress={handleNavigate}
          activeOpacity={0.8}
          style={[styles.fab, { backgroundColor: colors.background }]}
        >
          <MaterialIcons name="person" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    fontWeight: "bold",
    marginBottom: 20,
    fontSize: 36,
  },
  fab: {
    position: "absolute",
    bottom: 40,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
});
