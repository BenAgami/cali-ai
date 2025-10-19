import React from "react";
import { View, Text, StyleSheet } from "react-native";

export const AuthOrDivider: React.FC = () => (
  <View style={styles.container}>
    <View style={styles.line} />
    <Text style={styles.text}>or</Text>
    <View style={styles.line} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  text: {
    marginHorizontal: 16,
    color: "rgba(233,213,255,0.6)",
    fontSize: 14,
  },
});
