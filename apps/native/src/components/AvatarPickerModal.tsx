import React from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";

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
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>Change Avatar</Text>
          <Pressable
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            onPress={onPickLibrary}
          >
            <Text style={styles.optionBlue}>Choose from Library</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            onPress={onPickCamera}
          >
            <Text style={styles.optionBlue}>Take Photo</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            onPress={onClose}
          >
            <Text style={styles.optionRed}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
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
  pressed: {
    opacity: 0.6,
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
