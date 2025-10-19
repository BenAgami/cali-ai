import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export type AuthFooterProps = {
  text: string;
  linkText: string;
  onPressLink: () => void;
};

export const AuthFooter: React.FC<AuthFooterProps> = ({
  text,
  linkText,
  onPressLink,
}) => (
  <View style={styles.container}>
    <Text style={styles.text}>{text} </Text>
    <TouchableOpacity onPress={onPressLink} activeOpacity={0.7}>
      <Text style={styles.link}>{linkText}</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
    alignItems: "center",
  },
  text: { color: "rgba(233,213,255,0.7)", fontSize: 14 },
  link: {
    color: "#d8b4fe",
    fontSize: 14,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
});
