import React, { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
} from "react-native";

import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";

import { loginSchema, LoginValues } from "@repo/common";
import {
  AuthImageHeader,
  AuthHeader,
  AuthRememberRow,
  AuthOrDivider,
  GoogleSignInButton,
  AuthFooter,
} from "@repo/ui";

import AuthFormFields, {
  type FieldConfig,
} from "@src/components/AuthFormFields";
import { baseColors } from "@src/theme/colors";

const defaultFormData: LoginValues = {
  email: "",
  password: "",
};

const signInFields: FieldConfig<LoginValues>[] = [
  {
    name: "email",
    label: "Email",
    icon: "mail",
    placeholder: "you@example.com",
    keyboardType: "email-address",
    autoCapitalize: "none",
  },
  {
    name: "password",
    label: "Password",
    icon: "lock",
    placeholder: "••••••••",
    secureTextEntry: true,
  },
];

const SignInScreen: React.FC = () => {
  const [rememberMe, setRememberMe] = useState(false);

  const router = useRouter();

  const handleSignIn = (data: LoginValues) => {
    console.log("Sign in data:", data, "Remember me:", rememberMe);
    // Handle sign-in logic here
    // Example: call your API endpoint
  };

  const handleGoogleSignIn = () => {
    console.log("Google sign-in clicked");
    // Handle Google sign-in logic here
  };

  const handleForgotPassword = () => {
    console.log("Forgot password clicked");
    // Navigate to forgot password screen
  };

  const handleSignUp = () => {
    router.push("/register");
  };

  const handleNavigateHome = () => {
    router.push("/");
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <StatusBar style="light" />
        <LinearGradient
          colors={["#0f0c29", "#302b63", "#24243e"]}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            onPress={() => handleNavigateHome()}
            style={styles.navigateHomeButton}
            activeOpacity={0.8}
          >
            <Text style={styles.navigateHomeButtonText}>{"←"}</Text>
          </TouchableOpacity>

          <AuthImageHeader
            image={require("@assets/images/mars.png")}
            overlay={
              <LinearGradient
                colors={["transparent", "rgba(10, 10, 10, 0.8)"]}
                style={styles.imageOverlay}
              />
            }
          />

          <View style={styles.formWrapper}>
            <AuthHeader
              title="Welcome Back"
              subtitle="Sign in to continue your journey"
            />

            <View style={styles.formContainer}>
              <AuthFormFields
                schema={loginSchema}
                defaultValues={defaultFormData}
                fields={signInFields}
                onSubmit={handleSignIn}
                extraRow={
                  <AuthRememberRow
                    rememberMe={rememberMe}
                    onToggleRemember={() => setRememberMe(!rememberMe)}
                    onForgotPassword={handleForgotPassword}
                  />
                }
                renderSubmit={(submit) => (
                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={submit}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={["#667eea", "#764ba2"]}
                      style={styles.buttonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.submitButtonText}>Sign In</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              />

              <AuthOrDivider />

              <GoogleSignInButton onPress={handleGoogleSignIn} />

              <AuthFooter
                text="Don't have an account?"
                linkText="Sign Up"
                onPressLink={handleSignUp}
              />
            </View>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </>
  );
};

export default SignInScreen;

const styles = StyleSheet.create({
  navigateHomeButton: {
    position: "absolute",
    top: 36,
    left: 24,
    padding: 10,
    zIndex: 10,
  },
  navigateHomeButtonText: {
    color: baseColors.grayDark,
    fontSize: 26,
    fontWeight: "bold",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  formWrapper: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
  },
  formContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  submitButton: {
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 8,
  },
  buttonGradient: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
