import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import { useTheme } from "@src/context/ThemeContext";
import { baseColors } from "@src/theme/colors";
import { useNotificationReminder } from "@src/hooks/useNotificationReminder";

// Day labels: index 0=Sun(1), 1=Mon(2), ... 6=Sat(7) — expo-notifications weekday convention
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 7]; // 1=Sunday ... 7=Saturday

type Props = {
  username: string;
};

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMin = minute.toString().padStart(2, "0");
  return `${displayHour}:${displayMin} ${period}`;
}

function formatDays(weekdays: number[]): string {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return weekdays.map((d) => names[d - 1]).join(", ");
}

const ReminderCard: React.FC<Props> = ({ username }) => {
  const { colors } = useTheme();
  const { config, loading, scheduleReminder, cancelReminder } =
    useNotificationReminder();

  const [expanded, setExpanded] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => {
    const d = new Date();
    d.setHours(7, 30, 0, 0);
    return d;
  });
  const [showPicker, setShowPicker] = useState(Platform.OS === "ios");
  const [selectedDays, setSelectedDays] = useState<number[]>([2, 4, 6]); // Mon, Wed, Fri

  const handleTimeChange = (
    event: DateTimePickerEvent,
    selected?: Date,
  ) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }
    if (selected) {
      setPickerDate(selected);
    }
  };

  const toggleDay = (weekday: number) => {
    setSelectedDays((prev) =>
      prev.includes(weekday)
        ? prev.filter((d) => d !== weekday)
        : [...prev, weekday].sort((a, b) => a - b),
    );
  };

  const handleSave = async () => {
    if (selectedDays.length === 0) return;
    const hour = pickerDate.getHours();
    const minute = pickerDate.getMinutes();
    await scheduleReminder(username, hour, minute, selectedDays);
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
    <View
      style={[styles.card, { backgroundColor: colors.surface, shadowColor: baseColors.black }]}
    >
      {!config ? (
        // No reminder set — nudge state
        <>
          <Text style={[styles.nudgeTitle, { color: colors.text }]}>
            Stay consistent
          </Text>
          <Text style={[styles.nudgeSubtitle, { color: baseColors.grayDark }]}>
            Set a workout reminder to keep your streak going
          </Text>
          {!expanded && (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: baseColors.blue }]}
              onPress={() => {
                setShowPicker(Platform.OS === "ios");
                setExpanded(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Set Reminder</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        // Reminder set — display state
        <>
          <Text style={[styles.reminderTitle, { color: colors.text }]}>
            Workout Reminder
          </Text>
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
                <Text style={[styles.removeLink, { color: baseColors.grayDark }]}>
                  Remove
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* Expanded picker section */}
      {expanded && (
        <View style={styles.pickerSection}>
          {/* Time picker */}
          {Platform.OS === "android" && !showPicker && (
            <TouchableOpacity
              style={[styles.timeDisplay, { borderColor: baseColors.grayLight }]}
              onPress={() => setShowPicker(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.timeDisplayText, { color: colors.text }]}>
                {formatTime(pickerDate.getHours(), pickerDate.getMinutes())}
              </Text>
            </TouchableOpacity>
          )}
          {showPicker && (
            <DateTimePicker
              value={pickerDate}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={handleTimeChange}
              textColor={colors.text}
            />
          )}

          {/* Day of week selector */}
          <View style={styles.daysRow}>
            {WEEKDAY_VALUES.map((weekday, idx) => {
              const active = selectedDays.includes(weekday);
              return (
                <TouchableOpacity
                  key={weekday}
                  style={[
                    styles.dayButton,
                    {
                      backgroundColor: active
                        ? baseColors.blue
                        : colors.surface,
                      borderColor: active ? baseColors.blue : baseColors.grayLight,
                    },
                  ]}
                  onPress={() => toggleDay(weekday)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayLabel,
                      { color: active ? baseColors.white : baseColors.grayDark },
                    ]}
                  >
                    {DAY_LABELS[idx]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Save / Cancel */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor:
                    selectedDays.length > 0 ? baseColors.blue : baseColors.grayLight,
                },
              ]}
              onPress={handleSave}
              disabled={selectedDays.length === 0}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setExpanded(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.removeLink, { color: baseColors.grayDark }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
  nudgeTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  nudgeSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  reminderTitle: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 2,
  },
  reminderTime: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 2,
  },
  reminderDays: {
    fontSize: 13,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: baseColors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  removeLink: {
    fontSize: 14,
  },
  pickerSection: {
    marginTop: 12,
  },
  timeDisplay: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  timeDisplayText: {
    fontSize: 18,
    fontWeight: "600",
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    marginTop: 8,
  },
  dayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
});
