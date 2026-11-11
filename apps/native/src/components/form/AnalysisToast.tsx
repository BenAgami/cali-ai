import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { SlideInUp, SlideOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useAnalysisTracker } from "@src/context/AnalysisTrackerContext";
import { useTheme } from "@src/context/ThemeContext";
import { baseColors } from "@src/theme/colors";

const AUTO_DISMISS_MS = 6000;

const AnalysisToast: React.FC = () => {
  const { toast, dismissToast, markSeen } = useAnalysisTracker();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(dismissToast, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  if (toast === null) return null;

  const handleView = () => {
    markSeen(toast.sessionId);
    dismissToast();
    router.push({
      pathname: "/analysis-result",
      params: { sessionId: String(toast.sessionId) },
    });
  };

  return (
    <Animated.View
      entering={SlideInUp}
      exiting={SlideOutUp}
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        { top: insets.top + 8, backgroundColor: colors.surface },
      ]}
    >
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: colors.text }]}>
          {toast.title}
        </Text>
        <Text style={[styles.body, { color: colors.text }]}>{toast.body}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={handleView}
        style={styles.action}
      >
        <Text style={styles.actionLabel}>View feedback</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={dismissToast}
        hitSlop={8}
      >
        <Text style={[styles.close, { color: colors.text }]}>X</Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    elevation: 6,
    shadowColor: baseColors.black,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  textBlock: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600" },
  body: { fontSize: 13, marginTop: 2 },
  action: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: baseColors.blue,
  },
  actionLabel: { color: baseColors.white, fontWeight: "600", fontSize: 13 },
  close: { fontSize: 16, fontWeight: "600" },
});

export default AnalysisToast;
