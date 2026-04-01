import { useState, useEffect, useCallback } from "react";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const REMINDER_IDS_KEY = "workoutReminderIds";
const REMINDER_CONFIG_KEY = "workoutReminderConfig";

export type ReminderConfig = {
  hour: number;
  minute: number;
  weekdays: number[]; // 1=Sunday, 2=Monday ... 7=Saturday
};

export function useNotificationReminder() {
  const [config, setConfig] = useState<ReminderConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Load saved config on mount
  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(REMINDER_CONFIG_KEY);
      if (stored) {
        setConfig(JSON.parse(stored));
      }
      setLoading(false);
    })();
  }, []);

  // Reconcile on mount: if AsyncStorage is empty but OS has notifications, cancel all
  useEffect(() => {
    (async () => {
      const storedIds = await AsyncStorage.getItem(REMINDER_IDS_KEY);
      if (!storedIds || JSON.parse(storedIds).length === 0) {
        const scheduled =
          await Notifications.getAllScheduledNotificationsAsync();
        if (scheduled.length > 0) {
          await Notifications.cancelAllScheduledNotificationsAsync();
        }
      }
    })();
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    // Android channel setup — required for Android 8+
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("workout-reminders", {
        name: "Workout Reminders",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
      });
    }

    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return status === "granted";
  }, []);

  const scheduleReminder = useCallback(
    async (
      username: string,
      hour: number,
      minute: number,
      weekdays: number[],
    ): Promise<boolean> => {
      const granted = await requestPermissions();
      if (!granted) return false;

      // Cancel previous notifications (cancel-and-replace)
      const stored = await AsyncStorage.getItem(REMINDER_IDS_KEY);
      const prevIds: string[] = stored ? JSON.parse(stored) : [];
      await Promise.all(
        prevIds.map((id) =>
          Notifications.cancelScheduledNotificationAsync(id),
        ),
      );

      // Schedule one notification per selected day
      const newIds = await Promise.all(
        weekdays.map((weekday) =>
          Notifications.scheduleNotificationAsync({
            content: {
              title: "Cali AI",
              body: `Hey ${username}, time for your workout!`,
              sound: "default",
              ...(Platform.OS === "android" && {
                channelId: "workout-reminders",
              }),
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday,
              hour,
              minute,
            },
          }),
        ),
      );

      // Persist IDs and config
      await AsyncStorage.setItem(REMINDER_IDS_KEY, JSON.stringify(newIds));
      const newConfig: ReminderConfig = { hour, minute, weekdays };
      await AsyncStorage.setItem(
        REMINDER_CONFIG_KEY,
        JSON.stringify(newConfig),
      );
      setConfig(newConfig);

      return true;
    },
    [requestPermissions],
  );

  const cancelReminder = useCallback(async () => {
    const stored = await AsyncStorage.getItem(REMINDER_IDS_KEY);
    const prevIds: string[] = stored ? JSON.parse(stored) : [];
    await Promise.all(
      prevIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
    );
    await AsyncStorage.removeItem(REMINDER_IDS_KEY);
    await AsyncStorage.removeItem(REMINDER_CONFIG_KEY);
    setConfig(null);
  }, []);

  return { config, loading, scheduleReminder, cancelReminder };
}
