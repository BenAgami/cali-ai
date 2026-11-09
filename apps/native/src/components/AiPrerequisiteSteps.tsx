import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import AiConsentNotice from "@src/components/AiConsentNotice";
import AiProfilePrerequisite from "@src/components/AiProfilePrerequisite";
import BodyMetricsForm from "@src/components/BodyMetricsForm";
import { useTheme } from "@src/context/ThemeContext";
import type { AiPrerequisiteStepsState } from "@src/hooks/useAiPrerequisiteSteps";

interface AiPrerequisiteStepsProps {
  prerequisites: AiPrerequisiteStepsState;
}

/** Renders the current missing-prerequisite step; nothing once READY. */
const AiPrerequisiteSteps: React.FC<AiPrerequisiteStepsProps> = ({
  prerequisites,
}) => {
  const { colors } = useTheme();

  if (prerequisites.step === "PROFILE_INCOMPLETE") {
    return (
      <AiProfilePrerequisite
        experienceLevel={prerequisites.experienceLevel}
        goalTitle={prerequisites.goalTitle}
        goalType={prerequisites.goalType}
        onChangeLevel={prerequisites.setExperienceLevel}
        onChangeGoalTitle={prerequisites.setGoalTitle}
        onChangeGoalType={prerequisites.setGoalType}
        onSave={prerequisites.saveProfilePrerequisite}
        isSaving={prerequisites.isSavingProfile}
        error={prerequisites.profileError}
      />
    );
  }

  if (prerequisites.step === "BODY_METRICS_REQUIRED") {
    return (
      <View>
        <Text style={[styles.heading, { color: colors.text }]}>
          Add your height and weight
        </Text>
        <BodyMetricsForm form={prerequisites.bodyMetricsForm} />
        {prerequisites.bodyMetricsError && (
          <Text style={styles.error}>{prerequisites.bodyMetricsError}</Text>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor:
                prerequisites.isSavingBodyMetrics || pressed
                  ? "#007AFF88"
                  : "#007AFF",
            },
          ]}
          onPress={prerequisites.saveBodyMetrics}
          disabled={prerequisites.isSavingBodyMetrics}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Save</Text>
        </Pressable>
      </View>
    );
  }

  if (prerequisites.step === "AI_CONSENT_REQUIRED") {
    return (
      <AiConsentNotice
        onAccept={prerequisites.acceptConsent}
        isAccepting={prerequisites.isAcceptingConsent}
      />
    );
  }

  return null;
};

export default AiPrerequisiteSteps;

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  button: {
    marginTop: 24,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  error: { color: "#E57373", fontSize: 14, marginTop: 12 },
});
