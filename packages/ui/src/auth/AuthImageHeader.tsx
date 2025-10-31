import React from "react";
import { View, Image, StyleSheet, ImageSourcePropType } from "react-native";

export type AuthImageHeaderProps = {
  image: ImageSourcePropType;
  overlay?: React.ReactNode;
  height?: number;
};

export const AuthImageHeader: React.FC<AuthImageHeaderProps> = ({
  image,
  overlay,
  height = 250,
}) => (
  <View style={[styles.container, { height }]}>
    <Image source={image} style={styles.image} resizeMode="cover" />
    {overlay}
  </View>
);

const styles = StyleSheet.create({
  container: {
    width: "100%",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
    opacity: 0.85,
  },
});
