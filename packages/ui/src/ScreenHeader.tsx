import React from "react";
import { StyleSheet, Text, View } from "react-native";

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  color: string;
};

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  color,
}) => {
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 24,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "400",
    marginTop: 6,
  },
});
