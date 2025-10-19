import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";

export type AuthRememberRowProps = {
  rememberMe: boolean;
  onToggleRemember: () => void;
  onForgotPassword: () => void;
};

const CheckIcon = () => <Text style={styles.checkIcon}>✓</Text>;

export const AuthRememberRow: React.FC<AuthRememberRowProps> = ({
  rememberMe,
  onToggleRemember,
  onForgotPassword,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.rememberMeContainer}
        onPress={onToggleRemember}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
          {rememberMe && <CheckIcon />}
        </View>
        <Text style={styles.rememberMeText}>Remember me</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onForgotPassword} activeOpacity={0.7}>
        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 4,
  },
  rememberMeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "rgba(167, 139, 250, 0.5)",
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  checkboxActive: {
    backgroundColor: "#8b5cf6",
    borderColor: "#8b5cf6",
  },
  checkIcon: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
  rememberMeText: {
    color: "rgba(196, 181, 253, 0.8)",
    fontSize: 14,
  },
  forgotPasswordText: {
    color: "#a78bfa",
    fontSize: 14,
    fontWeight: "500",
  },
});
