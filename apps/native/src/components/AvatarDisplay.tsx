import React from "react";
import { View, Text, Image } from "react-native";

const PALETTE = [
  "#E57373",
  "#64B5F6",
  "#81C784",
  "#FFB74D",
  "#BA68C8",
  "#4DB6AC",
];

const avatarColor = (username: string): string => {
  const hash = username
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length];
};

const getInitials = (username: string): string =>
  username.slice(0, 2).toUpperCase();

type AvatarDisplayProps = {
  uri: string | null;
  username: string;
  size: number;
};

const AvatarDisplay: React.FC<AvatarDisplayProps> = ({
  uri,
  username,
  size,
}) => {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColor(username),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: "#FFFFFF",
          fontSize: size * 0.4,
          fontWeight: "700",
        }}
      >
        {getInitials(username)}
      </Text>
    </View>
  );
};

export default AvatarDisplay;
