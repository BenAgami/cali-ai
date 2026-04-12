import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";

import { useTheme } from "@src/context/ThemeContext";
import { baseColors } from "@src/theme/colors";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 7];

const formatTime = (hour: number, minute: number): string => {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
};

type Props = {
  pickerDate: Date;
  showPicker: boolean;
  selectedDays: number[];
  onTimeChange: (event: DateTimePickerEvent, date?: Date) => void;
  onShowPicker: () => void;
  onToggleDay: (weekday: number) => void;
  onSave: () => void;
  onCancel: () => void;
};

const ReminderPicker: React.FC<Props> = ({
  pickerDate,
  showPicker,
  selectedDays,
  onTimeChange,
  onShowPicker,
  onToggleDay,
  onSave,
  onCancel,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {Platform.OS === "android" && !showPicker && (
        <Pressable
          style={({ pressed }) => [
            styles.timeDisplay,
            { borderColor: baseColors.grayLight, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={onShowPicker}
        >
          <Text style={[styles.timeDisplayText, { color: colors.text }]}>
            {formatTime(pickerDate.getHours(), pickerDate.getMinutes())}
          </Text>
        </Pressable>
      )}
      {showPicker && (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onTimeChange}
          textColor={colors.text}
        />
      )}

      <View style={styles.daysRow}>
        {WEEKDAY_VALUES.map((weekday, idx) => {
          const active = selectedDays.includes(weekday);
          return (
            <Pressable
              key={weekday}
              style={({ pressed }) => [
                styles.dayButton,
                {
                  backgroundColor: active ? baseColors.blue : colors.surface,
                  borderColor: active ? baseColors.blue : baseColors.grayLight,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              onPress={() => onToggleDay(weekday)}
            >
              <Text
                style={[
                  styles.dayLabel,
                  { color: active ? baseColors.white : baseColors.grayDark },
                ]}
              >
                {DAY_LABELS[idx]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            {
              backgroundColor:
                selectedDays.length > 0
                  ? pressed
                    ? baseColors.grayLight
                    : baseColors.blue
                  : baseColors.grayLight,
            },
          ]}
          onPress={onSave}
          disabled={selectedDays.length === 0}
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </Pressable>
        <Pressable onPress={onCancel} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={[styles.cancelLink, { color: baseColors.grayDark }]}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default ReminderPicker;

const styles = StyleSheet.create({
  container: {
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
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  saveButtonText: {
    color: baseColors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  cancelLink: {
    fontSize: 14,
  },
  pressed: {
    opacity: 0.7,
  },
});
