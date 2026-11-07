import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

import BodyMetricsForm from "@src/components/BodyMetricsForm";
import { useTheme } from "@src/context/ThemeContext";
import { useSaveBodyMetrics } from "@src/hooks/mutations/useSaveBodyMetrics";
import { useBodyMetricsForm } from "@src/hooks/useBodyMetricsForm";

const OnboardingBodyMetricsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const form = useBodyMetricsForm(null);
  const saveMutation = useSaveBodyMetrics();
  const [error, setError] = useState<string | null>(null);

  const destination = returnTo?.startsWith("/") ? returnTo : "/";

  const handleSkip = () => {
    router.replace(destination);
  };

  const handleSave = () => {
    const result = form.validate();
    if (!result.isValid) {
      setError(result.message);
      return;
    }
    setError(null);
    saveMutation.mutate(result.data, {
      onSuccess: () => router.replace(destination),
      onError: () =>
        Alert.alert("Error", "Something went wrong. Please try again."),
    });
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.text }]}>
          Add your height and weight
        </Text>
        <Text style={[styles.body, { color: colors.text }]}>
          AI workouts and form feedback use these to tailor volume. You can skip
          this and add them later.
        </Text>

        <BodyMetricsForm form={form} />
        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            {
              backgroundColor:
                saveMutation.isPending || pressed ? "#007AFF88" : "#007AFF",
            },
          ]}
          onPress={handleSave}
          disabled={saveMutation.isPending}
        >
          <Text style={styles.saveText}>Save</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.skipButton,
            { borderColor: colors.text + "44", opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={handleSkip}
          disabled={saveMutation.isPending}
        >
          <Text style={[styles.skipText, { color: colors.text }]}>
            Skip for now
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

export default OnboardingBodyMetricsScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  body: { fontSize: 14, opacity: 0.7, marginBottom: 20 },
  error: { marginTop: 12, color: "#E57373", fontSize: 13 },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 12,
  },
  saveText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  skipButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  skipText: { fontSize: 16, fontWeight: "500" },
});
