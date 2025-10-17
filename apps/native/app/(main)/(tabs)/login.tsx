import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import { AntDesign, Feather } from "@expo/vector-icons";

const MailIcon = () => <Feather name="mail" style={styles.icon} />;
const LockIcon = () => <Feather name="lock" style={styles.icon} />;
const GoogleIcon = () => <AntDesign name="google" style={styles.icon} />;
const CheckIcon = () => <Text style={styles.checkIcon}>✓</Text>;

const SignInScreen = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [rememberMe, setRememberMe] = useState(false);

  const router = useRouter();

  const handleSignIn = () => {
    console.log("Sign in data:", formData, "Remember me:", rememberMe);
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

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <StatusBar style="light" />
        <LinearGradient
          colors={["#0f0c29", "#302b63", "#24243e"]}
          style={styles.gradient}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Mars Image Section */}
            <View style={styles.imageContainer}>
              <Image
                source={require("@assets/images/mars.png")}
                style={styles.mars}
                resizeMode="cover"
              />
              <LinearGradient
                colors={["transparent", "rgba(10, 10, 10, 0.8)"]}
                style={styles.imageOverlay}
              />
            </View>

            {/* Sign In Form Section */}
            <View style={styles.formWrapper}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>
                  Sign in to continue your journey
                </Text>
              </View>

              {/* Form Container */}
              <View style={styles.formContainer}>
                {/* Email Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email</Text>
                  <View style={styles.inputWrapper}>
                    <MailIcon />
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com"
                      placeholderTextColor="rgba(167, 139, 250, 0.4)"
                      value={formData.email}
                      onChangeText={(text) =>
                        setFormData({ ...formData, email: text })
                      }
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                {/* Password Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <LockIcon />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(167, 139, 250, 0.4)"
                      value={formData.password}
                      onChangeText={(text) =>
                        setFormData({ ...formData, password: text })
                      }
                      secureTextEntry
                    />
                  </View>
                </View>

                {/* Remember Me & Forgot Password */}
                <View style={styles.optionsRow}>
                  <TouchableOpacity
                    style={styles.rememberMeContainer}
                    onPress={() => setRememberMe(!rememberMe)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        rememberMe && styles.checkboxActive,
                      ]}
                    >
                      {rememberMe && <CheckIcon />}
                    </View>
                    <Text style={styles.rememberMeText}>Remember me</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleForgotPassword}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.forgotPasswordText}>
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Sign In Button */}
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleSignIn}
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

                {/* Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Google Sign-In Button */}
                <TouchableOpacity
                  style={styles.googleButton}
                  onPress={handleGoogleSignIn}
                  activeOpacity={0.8}
                >
                  <GoogleIcon />
                  <Text style={styles.googleButtonText}>
                    Continue with Google
                  </Text>
                </TouchableOpacity>

                {/* Sign Up Link */}
                <View style={styles.footer}>
                  <Text style={styles.footerText}>Don't have an account? </Text>
                  <TouchableOpacity onPress={handleSignUp} activeOpacity={0.7}>
                    <Text style={styles.signUpLink}>Sign Up</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </>
  );
};

export default SignInScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  imageContainer: {
    height: 280,
    width: "100%",
    position: "relative",
  },
  mars: {
    width: "100%",
    height: "100%",
    opacity: 0.75,
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  formWrapper: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(196, 181, 253, 0.7)",
  },
  formContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 50,
  },
  icon: {
    fontSize: 20,
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: "#ffffff",
    fontSize: 16,
    height: "100%",
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
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
  submitButton: {
    borderRadius: 8,
    overflow: "hidden",
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
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  dividerText: {
    marginHorizontal: 16,
    color: "rgba(196, 181, 253, 0.6)",
    fontSize: 14,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  googleButtonText: {
    color: "#1f2937",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
    alignItems: "center",
  },
  footerText: {
    color: "rgba(196, 181, 253, 0.7)",
    fontSize: 14,
  },
  signUpLink: {
    color: "#c4b5fd",
    fontSize: 14,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
});
