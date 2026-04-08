import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
} from "react-native";

import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";

import { registerSchema, RegisterValues } from "@repo/common";
import {
  AuthImageHeader,
  AuthHeader,
  AuthOrDivider,
  GoogleSignInButton,
  AuthFooter,
} from "@repo/ui";

import AuthFormFields, {
  type FieldConfig,
} from "@src/components/AuthFormFields";
import { apiClient, ApiError } from "@src/lib/api";
import { useAuth } from "@src/context/AuthContext";
import { baseColors } from "@src/theme/colors";

const defaultFormData: RegisterValues = {
  name: "",
  email: "",
  password: "",
};

const registerFields: FieldConfig<RegisterValues>[] = [
  {
    name: "name",
    label: "Full Name",
    icon: "user",
    placeholder: "John Doe",
    autoCapitalize: "words",
  },
  {
    name: "email",
    label: "Email",
    icon: "mail",
    placeholder: "you@example.com",
    keyboardType: "email-address",
  },
  {
    name: "password",
    label: "Password",
    icon: "lock",
    placeholder: "••••••••",
    secureTextEntry: true,
  },
];

const RegistrationScreen: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { setToken } = useAuth();

  const handleSignUp = async (data: RegisterValues) => {
    setError(null);
    try {
      const result = await apiClient.post<{ token: string }>(
        "/api/users/register",
        data,
      );
      await setToken(result.token);
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("An account with this email already exists.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  };

  const handleGoogleSignIn = () => {
    console.log("Google sign-in clicked");
  };

  const handleSignIn = () => {
    router.push("/login");
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
          colors={["#1e1b4b", "#581c87", "#0f172a"]}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              onPress={() => handleNavigateHome()}
              style={styles.navigateHomeButton}
              activeOpacity={0.8}
            >
              <Text style={styles.navigateHomeButtonText}>{"←"}</Text>
            </TouchableOpacity>

            <AuthImageHeader
              image={require("@assets/images/saturn.png")}
              overlay={
                <LinearGradient
                  colors={["transparent", "rgba(30, 27, 75, 0.8)"]}
                  style={styles.imageOverlay}
                />
              }
            />

            <View style={styles.formWrapper}>
              <AuthHeader
                title="Create Account"
                subtitle="Join us and explore the cosmos"
              />

              <View style={styles.formContainer}>
                {error && (
                  <Text style={styles.errorText}>{error}</Text>
                )}
                <AuthFormFields
                  schema={registerSchema}
                  defaultValues={defaultFormData}
                  fields={registerFields}
                  onSubmit={handleSignUp}
                  renderSubmit={(submit) => (
                    <TouchableOpacity
                      style={styles.submitButton}
                      onPress={submit}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={["#9333ea", "#4f46e5"]}
                        style={styles.buttonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Text style={styles.submitButtonText}>
                          Create Account
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                />

                <AuthOrDivider />

                <GoogleSignInButton onPress={handleGoogleSignIn} />

                <AuthFooter
                  text="Already have an account?"
                  linkText="Sign In"
                  onPressLink={handleSignIn}
                />
              </View>
            </View>
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </>
  );
};

export default RegistrationScreen;

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
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
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
  errorText: {
    color: "#E57373",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
  },
});
