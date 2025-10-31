import React from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { FontAwesome } from "@expo/vector-icons";

export type GoogleSignInButtonProps = { onPress: () => void };

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onPress,
}) => (
  <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.content}>
      <FontAwesome name="google" size={18} />
      <Text style={styles.text}>Continue with Google</Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "#1f2937",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
