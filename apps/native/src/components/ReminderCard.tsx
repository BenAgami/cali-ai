import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { DateTimePickerEvent } from "@react-native-community/datetimepicker";

import { useTheme } from "@src/context/ThemeContext";
import { baseColors } from "@src/theme/colors";
import { useNotificationReminder } from "@src/hooks/useNotificationReminder";
import { DayOfWeek } from "@src/types/reminder";
import ReminderPicker from "@src/components/ReminderPicker";

const formatTime = (hour: number, minute: number): string => {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
};

const formatDays = (daysOfWeek: DayOfWeek[]): string => {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return daysOfWeek.map((d) => names[d - 1]).join(", ");
};

type Props = { username: string };

const ReminderCard: React.FC<Props> = ({ username }) => {
  const { colors } = useTheme();
  const { reminderConfig, loading, scheduleReminder, cancelReminder } =
    useNotificationReminder();

  const [expanded, setExpanded] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => {
    const d = new Date();
    d.setHours(7, 30, 0, 0);
    return d;
  });
  const [showPicker, setShowPicker] = useState(Platform.OS === "ios");
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([
    DayOfWeek.Monday,
    DayOfWeek.Wednesday,
    DayOfWeek.Friday,
  ]);

  const handleTimeChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setShowPicker(false);
    if (selected) setPickerDate(selected);
  };

  const handleToggleDay = (day: DayOfWeek) => {
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : ([...prev, day].sort((a, b) => a - b) as DayOfWeek[]),
    );
  };

  const handleSave = async () => {
    if (selectedDays.length === 0) return;
    await scheduleReminder(
      username,
      pickerDate.getHours(),
      pickerDate.getMinutes(),
      selectedDays,
    );
    setExpanded(false);
  };

  const handleEdit = () => {
    if (reminderConfig) {
      const d = new Date();
      d.setHours(reminderConfig.hour, reminderConfig.minute, 0, 0);
      setPickerDate(d);
      setSelectedDays(reminderConfig.daysOfWeek);
    }
    setShowPicker(Platform.OS === "ios");
    setExpanded(true);
  };

  if (loading) return null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, shadowColor: baseColors.black },
      ]}
    >
      {!reminderConfig ? (
        <>
          <Text style={[styles.nudgeTitle, { color: colors.text }]}>
            Stay consistent
          </Text>
          <Text style={[styles.nudgeSubtitle, { color: baseColors.grayDark }]}>
            Set a workout reminder to keep your streak going
          </Text>
          {!expanded && (
            <Pressable
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: baseColors.blue,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              onPress={() => {
                setShowPicker(Platform.OS === "ios");
                setExpanded(true);
              }}
            >
              <Text style={styles.buttonText}>Set Reminder</Text>
            </Pressable>
          )}
        </>
      ) : (
        <>
          <Text style={[styles.reminderTitle, { color: colors.text }]}>
            Workout Reminder
          </Text>
          <Text style={[styles.reminderTime, { color: baseColors.blue }]}>
            {formatTime(reminderConfig.hour, reminderConfig.minute)}
          </Text>
          <Text style={[styles.reminderDays, { color: baseColors.grayDark }]}>
            {formatDays(reminderConfig.daysOfWeek)}
          </Text>
          {!expanded && (
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: baseColors.blue,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={handleEdit}
              >
                <Text style={styles.buttonText}>Edit</Text>
              </Pressable>
              <Pressable
                onPress={cancelReminder}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text
                  style={[styles.removeLink, { color: baseColors.grayDark }]}
                >
                  Remove
                </Text>
              </Pressable>
            </View>
          )}
        </>
      )}

      {expanded && (
        <ReminderPicker
          pickerDate={pickerDate}
          showPicker={showPicker}
          selectedDays={selectedDays}
          onTimeChange={handleTimeChange}
          onShowPicker={() => setShowPicker(true)}
          onToggleDay={handleToggleDay}
          onSave={handleSave}
          onCancel={() => setExpanded(false)}
        />
      )}
    </View>
  );
};

export default ReminderCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  nudgeTitle: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  nudgeSubtitle: { fontSize: 13, marginBottom: 12 },
  reminderTitle: { fontSize: 13, fontWeight: "500", marginBottom: 2 },
  reminderTime: { fontSize: 22, fontWeight: "700", marginBottom: 2 },
  reminderDays: { fontSize: 13, marginBottom: 12 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  button: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 8 },
  buttonText: { color: baseColors.white, fontSize: 14, fontWeight: "600" },
  removeLink: { fontSize: 14 },
  pressed: { opacity: 0.7 },
});
