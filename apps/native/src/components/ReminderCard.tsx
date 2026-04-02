import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { DateTimePickerEvent } from "@react-native-community/datetimepicker";

import { useTheme } from "@src/context/ThemeContext";
import { baseColors } from "@src/theme/colors";
import { useNotificationReminder } from "@src/hooks/useNotificationReminder";
import ReminderPicker from "@src/components/ReminderPicker";

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
}

function formatDays(weekdays: number[]): string {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return weekdays.map((d) => names[d - 1]).join(", ");
}

type Props = { username: string };

const ReminderCard: React.FC<Props> = ({ username }) => {
  const { colors } = useTheme();
  const { config, loading, scheduleReminder, cancelReminder } = useNotificationReminder();

  const [expanded, setExpanded] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => {
    const d = new Date();
    d.setHours(7, 30, 0, 0);
    return d;
  });
  const [showPicker, setShowPicker] = useState(Platform.OS === "ios");
  const [selectedDays, setSelectedDays] = useState<number[]>([2, 4, 6]);

  const handleTimeChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setShowPicker(false);
    if (selected) setPickerDate(selected);
  };

  const handleToggleDay = (weekday: number) => {
    setSelectedDays((prev) =>
      prev.includes(weekday)
        ? prev.filter((d) => d !== weekday)
        : [...prev, weekday].sort((a, b) => a - b)
    );
  };

  const handleSave = async () => {
    if (selectedDays.length === 0) return;
    await scheduleReminder(username, pickerDate.getHours(), pickerDate.getMinutes(), selectedDays);
    setExpanded(false);
  };

  const handleEdit = () => {
    if (config) {
      const d = new Date();
      d.setHours(config.hour, config.minute, 0, 0);
      setPickerDate(d);
      setSelectedDays(config.weekdays);
    }
    setShowPicker(Platform.OS === "ios");
    setExpanded(true);
  };

  if (loading) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: baseColors.black }]}>
      {!config ? (
        <>
          <Text style={[styles.nudgeTitle, { color: colors.text }]}>Stay consistent</Text>
          <Text style={[styles.nudgeSubtitle, { color: baseColors.grayDark }]}>
            Set a workout reminder to keep your streak going
          </Text>
          {!expanded && (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: baseColors.blue }]}
              onPress={() => { setShowPicker(Platform.OS === "ios"); setExpanded(true); }}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Set Reminder</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <>
          <Text style={[styles.reminderTitle, { color: colors.text }]}>Workout Reminder</Text>
          <Text style={[styles.reminderTime, { color: baseColors.blue }]}>
            {formatTime(config.hour, config.minute)}
          </Text>
          <Text style={[styles.reminderDays, { color: baseColors.grayDark }]}>
            {formatDays(config.weekdays)}
          </Text>
          {!expanded && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: baseColors.blue }]}
                onPress={handleEdit}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={cancelReminder} activeOpacity={0.7}>
                <Text style={[styles.removeLink, { color: baseColors.grayDark }]}>Remove</Text>
              </TouchableOpacity>
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
});
