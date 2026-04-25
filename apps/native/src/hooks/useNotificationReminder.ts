import { useState, useEffect, useCallback } from "react";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { DayOfWeek, type ReminderConfig } from "@src/types/reminder";

const REMINDER_IDS_KEY = "workoutReminderIds";
const REMINDER_CONFIG_KEY = "workoutReminderConfig";
const WORKOUT_REMINDER_CHANNEL_ID = "workout-reminders";

export const useNotificationReminder = () => {
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(REMINDER_CONFIG_KEY);
      if (stored) {
        setReminderConfig(JSON.parse(stored));
      }
      setIsLoading(false);
    })();
  }, []);

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
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(
        WORKOUT_REMINDER_CHANNEL_ID,
        {
          name: "Workout Reminders",
          importance: Notifications.AndroidImportance.MAX,
          sound: "default",
        },
      );
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
      daysOfWeek: DayOfWeek[],
    ): Promise<boolean> => {
      const isGranted = await requestPermissions();
      if (!isGranted) return false;

      const stored = await AsyncStorage.getItem(REMINDER_IDS_KEY);
      const prevIds: string[] = stored ? JSON.parse(stored) : [];
      await Promise.all(
        prevIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
      );

      const newIds = await Promise.all(
        daysOfWeek.map((weekday) =>
          Notifications.scheduleNotificationAsync({
            content: {
              title: "Cali AI",
              body: `Hey ${username}, time for your workout!`,
              sound: "default",
              ...(Platform.OS === "android" && {
                channelId: WORKOUT_REMINDER_CHANNEL_ID,
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

      await AsyncStorage.setItem(REMINDER_IDS_KEY, JSON.stringify(newIds));
      const newConfig: ReminderConfig = { hour, minute, daysOfWeek };
      await AsyncStorage.setItem(
        REMINDER_CONFIG_KEY,
        JSON.stringify(newConfig),
      );
      setReminderConfig(newConfig);

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
    setReminderConfig(null);
  }, []);

  return { reminderConfig, loading: isLoading, scheduleReminder, cancelReminder };
};
