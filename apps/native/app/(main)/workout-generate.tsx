import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AiConsentNotice from "@src/components/AiConsentNotice";
import AiDisclaimer from "@src/components/AiDisclaimer";
import AiProfilePrerequisite from "@src/components/AiProfilePrerequisite";
import BodyMetricsForm from "@src/components/BodyMetricsForm";
import { useTheme } from "@src/context/ThemeContext";
import { useWorkoutGenerate } from "@src/hooks/useWorkoutGenerate";
import {
  AI_GENERATING_TEXT,
  AI_GOAL_EXAMPLES,
} from "@src/constants/aiMessages";

const WorkoutGenerateScreen: React.FC = () => {
  const { colors } = useTheme();
  const g = useWorkoutGenerate();

  const primaryButton = (
    text: string,
    onPress: () => void,
    isDisabled: boolean,
  ) => (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: isDisabled || pressed ? "#007AFF88" : "#007AFF" },
      ]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
    >
      <Text style={styles.buttonText}>{text}</Text>
    </Pressable>
  );

  const renderBody = () => {
    if (g.isLoading) {
      return (
        <ActivityIndicator
          size="large"
          color={colors.text}
          style={styles.loader}
        />
      );
    }

    if (g.step === "PROFILE_INCOMPLETE") {
      return (
        <AiProfilePrerequisite
          experienceLevel={g.experienceLevel}
          goalTitle={g.goalTitle}
          goalType={g.goalType}
          onChangeLevel={g.setExperienceLevel}
          onChangeGoalTitle={g.setGoalTitle}
          onChangeGoalType={g.setGoalType}
          onSave={g.saveProfilePrerequisite}
          isSaving={g.isSavingProfile}
          error={g.profileError}
        />
      );
    }

    if (g.step === "BODY_METRICS_REQUIRED") {
      return (
        <View>
          <Text style={[styles.heading, { color: colors.text }]}>
            Add your height and weight
          </Text>
          <BodyMetricsForm form={g.bodyMetricsForm} />
          {g.bodyMetricsError && (
            <Text style={styles.error}>{g.bodyMetricsError}</Text>
          )}
          {primaryButton("Save", g.saveBodyMetrics, g.isSavingBodyMetrics)}
        </View>
      );
    }

    if (g.step === "AI_CONSENT_REQUIRED") {
      return (
        <AiConsentNotice
          onAccept={g.acceptConsent}
          isAccepting={g.isAcceptingConsent}
        />
      );
    }

    if (g.preview) {
      return (
        <View>
          <AiDisclaimer />
          <Text style={[styles.previewName, { color: colors.text }]}>
            {g.preview.name}
          </Text>
          {g.preview.note !== null && (
            <View style={[styles.note, { backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.text, fontSize: 14 }}>
                {g.preview.note}
              </Text>
            </View>
          )}
          {g.previewRows.map((row, index) => (
            <View
              key={`${g.preview?.exercises[index]?.exerciseId}-${index}`}
              style={[styles.row, { backgroundColor: colors.surface }]}
            >
              <Text style={{ color: colors.text, fontSize: 15 }}>{row}</Text>
            </View>
          ))}
          {primaryButton("Save workout", g.save, g.isSaving || g.isGenerating)}
          <Pressable
            style={({ pressed }) => [
              styles.secondary,
              { borderColor: colors.text + "44", opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={g.editInBuilder}
            disabled={g.isSaving || g.isGenerating}
            accessibilityRole="button"
          >
            <Text style={[styles.secondaryText, { color: colors.text }]}>
              Edit in builder
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.secondary,
              { borderColor: colors.text + "44", opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={g.regenerate}
            disabled={g.isSaving || g.isGenerating}
            accessibilityRole="button"
          >
            <Text style={[styles.secondaryText, { color: colors.text }]}>
              Regenerate
            </Text>
          </Pressable>
          {g.errorMessage && <Text style={styles.error}>{g.errorMessage}</Text>}
        </View>
      );
    }

    return (
      <View>
        <Text style={[styles.heading, { color: colors.text }]}>
          What do you want to work on?
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              color: colors.text,
              borderColor: colors.text + "33",
            },
          ]}
          value={g.goalText}
          onChangeText={g.setGoalText}
          editable={!g.isGenerating}
          multiline
          maxLength={500}
          placeholder="e.g. Get stronger at pull-ups with 30-minute sessions"
          placeholderTextColor={colors.text + "66"}
        />
        <View style={styles.chips}>
          {AI_GOAL_EXAMPLES.map((example) => (
            <Pressable
              key={example}
              style={[
                styles.chip,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.text + "33",
                },
              ]}
              onPress={() => g.selectExample(example)}
              disabled={g.isGenerating}
              accessibilityRole="button"
            >
              <Text style={{ color: colors.text, fontSize: 13 }}>
                {example}
              </Text>
            </Pressable>
          ))}
        </View>
        {g.isGenerating ? (
          <View style={styles.generating}>
            <ActivityIndicator color={colors.text} />
            <Text style={{ color: colors.text, marginTop: 8 }}>
              {AI_GENERATING_TEXT}
            </Text>
          </View>
        ) : (
          primaryButton("Generate", g.generate, !g.canGenerate)
        )}
        {g.errorMessage && <Text style={styles.error}>{g.errorMessage}</Text>}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["bottom"]}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {renderBody()}
      </ScrollView>
    </SafeAreaView>
  );
};

export default WorkoutGenerateScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 20, paddingBottom: 48 },
  loader: { marginTop: 60 },
  heading: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: "top",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  button: {
    marginTop: 24,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  secondary: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryText: { fontSize: 16, fontWeight: "600" },
  generating: { alignItems: "center", marginTop: 24 },
  error: { color: "#E57373", fontSize: 14, marginTop: 12 },
  previewName: { fontSize: 22, fontWeight: "700", marginTop: 16 },
  note: { borderRadius: 10, padding: 12, marginTop: 12 },
  row: { borderRadius: 10, padding: 12, marginTop: 8 },
});
