import React from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardTypeOptions,
} from "react-native";
import { Feather } from "@expo/vector-icons";

type AutoCapitalize = "none" | "sentences" | "words" | "characters";

export type AuthInputProps = {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: AutoCapitalize;
};

export const AuthInput: React.FC<AuthInputProps> = ({
  label,
  icon,
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  secureTextEntry = false,
  autoCapitalize = "sentences",
}) => (
  <View style={{ marginBottom: 20 }}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputWrapper}>
      <Feather name={icon} size={20} color="rgba(255,255,255,0.9)" />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="rgba(216,180,254,0.4)"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  label: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 50,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    marginLeft: 8,
  },
});
