import React from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";

import { useTheme } from "@src/context/ThemeContext";

type Props = {
  visible: boolean;
  onClose: () => void;
  onPickLibrary: () => void;
  onPickCamera: () => void;
};

const AvatarPickerModal: React.FC<Props> = ({
  visible,
  onClose,
  onPickLibrary,
  onPickCamera,
}) => {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>Change Avatar</Text>
          <TouchableOpacity style={styles.option} onPress={onPickLibrary} activeOpacity={0.8}>
            <Text style={styles.optionBlue}>Choose from Library</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.option} onPress={onPickCamera} activeOpacity={0.8}>
            <Text style={styles.optionBlue}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.option} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.optionRed}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default AvatarPickerModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  option: {
    paddingVertical: 14,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  optionBlue: {
    fontSize: 16,
    fontWeight: "500",
    color: "#007AFF",
  },
  optionRed: {
    fontSize: 16,
    fontWeight: "500",
    color: "#E57373",
  },
});
