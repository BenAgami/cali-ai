import React from "react";
import { View, Text, StyleSheet } from "react-native";

export type AuthHeaderProps = {
  title: string;
  subtitle?: string;
};

export const AuthHeader: React.FC<AuthHeaderProps> = ({ title, subtitle }) => (
  <View style={styles.container}>
    <Text style={styles.title}>{title}</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(233,213,255,0.7)",
  },
});
