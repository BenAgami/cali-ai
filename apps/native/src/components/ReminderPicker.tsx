import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";

import { useTheme } from "@src/context/ThemeContext";
import { baseColors } from "@src/theme/colors";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 7];

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
}

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
        <TouchableOpacity
          style={[styles.timeDisplay, { borderColor: baseColors.grayLight }]}
          onPress={onShowPicker}
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
          onChange={onTimeChange}
          textColor={colors.text}
        />
      )}

      <View style={styles.daysRow}>
        {WEEKDAY_VALUES.map((weekday, idx) => {
          const active = selectedDays.includes(weekday);
          return (
            <TouchableOpacity
              key={weekday}
              style={[
                styles.dayButton,
                {
                  backgroundColor: active ? baseColors.blue : colors.surface,
                  borderColor: active ? baseColors.blue : baseColors.grayLight,
                },
              ]}
              onPress={() => onToggleDay(weekday)}
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

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: selectedDays.length > 0 ? baseColors.blue : baseColors.grayLight },
          ]}
          onPress={onSave}
          disabled={selectedDays.length === 0}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} activeOpacity={0.7}>
          <Text style={[styles.cancelLink, { color: baseColors.grayDark }]}>Cancel</Text>
        </TouchableOpacity>
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
});
