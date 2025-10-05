// CrossPlatformPicker.js
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Platform,
  StyleSheet,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";

/**
 * Cross-Platform Picker Component
 * รองรับทั้ง Android (แสดง Picker แบบ dropdown) และ iOS (แสดง Modal แบบ bottom sheet)
 */
const CrossPlatformPicker = ({
  selectedValue,
  onValueChange,
  items = [],
  placeholder = "เลือก",
  enabled = true,
  label,
  style,
  iconName = "location-outline",
  textAlign = "left",
}) => {
  const [isModalVisible, setModalVisible] = useState(false);
  const [tempValue, setTempValue] = useState(selectedValue);

  const handleConfirm = () => {
    onValueChange(tempValue);
    setModalVisible(false);
  };

  const handleCancel = () => {
    setTempValue(selectedValue);
    setModalVisible(false);
  };

  const selectedLabel =
    items.find((item) => item.value === selectedValue)?.label || placeholder;

  // Android: ใช้ Picker โดยตรง
  if (Platform.OS === "android") {
    return (
      <View style={[styles.container, style]}>
        {label && <Text style={styles.label}>{label}</Text>}
        <View style={[styles.pickerWrapper, !enabled && styles.disabled]}>
          <Ionicons
            name={iconName}
            size={20}
            color={enabled ? "#666" : "#ccc"}
            style={styles.icon}
          />
          <Picker
            selectedValue={selectedValue}
            onValueChange={onValueChange}
            enabled={enabled}
            style={styles.androidPicker}
            dropdownIconColor={enabled ? "#666" : "#ccc"}
            mode="dropdown"
          >
            <Picker.Item label={placeholder} value="" color="#999" />
            {items.map((item) => (
              <Picker.Item
                key={item.value}
                label={item.label}
                value={item.value}
                color="#333"
              />
            ))}
          </Picker>
        </View>
      </View>
    );
  }

  // iOS: ใช้ Modal Picker
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.iosButton, !enabled && styles.disabled]}
        onPress={() => enabled && setModalVisible(true)}
        disabled={!enabled}
        activeOpacity={0.7}
      >
        <Ionicons
          name={iconName}
          size={20}
          color={enabled ? "#666" : "#ccc"}
          style={styles.icon}
        />
        <Text
          style={[
            styles.iosButtonText,
            !selectedValue && styles.placeholderText,
            !enabled && styles.disabledText,
            { textAlign: textAlign },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {selectedLabel}
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={enabled ? "#666" : "#ccc"}
        />
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={handleCancel}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={handleCancel}
                style={styles.modalButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.cancelText}>ยกเลิก</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{label || placeholder}</Text>
              <TouchableOpacity
                onPress={handleConfirm}
                style={styles.modalButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.confirmText}>เลือก</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={tempValue}
              onValueChange={setTempValue}
              style={styles.iosPicker}
              itemStyle={styles.iosPickerItem}
            >
              <Picker.Item label={placeholder} value="" />
              {items.map((item) => (
                <Picker.Item
                  key={item.value}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </Picker>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  pickerWrapper: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    flexDirection: "row",
    alignItems: "center",
    minHeight: 50,
  },
  disabled: {
    opacity: 0.5,
    backgroundColor: "#f9f9f9",
  },
  icon: {
    marginLeft: 0,
  },
  androidPicker: {
    flex: 1,
    height: 50,
    color: "#333",
    backgroundColor: "#fff",
    textAlign: "left",
  },
  iosButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 50,
    textAlign: "left",
  },
  iosButtonText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    marginLeft: 8,
  },
  placeholderText: {
    color: "#999",
  },
  disabledText: {
    color: "#ccc",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalButton: {
    padding: 8,
    minWidth: 60,
  },
  cancelText: {
    fontSize: 16,
    color: "#666",
  },
  confirmText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#333",
  },
  iosPicker: {
    width: "100%",
    height: 216,
    backgroundColor: "#fff",
  },
  iosPickerItem: {
    fontSize: 20,
    height: 216,
    color: "#000",
    textAlign: "left",
    paddingRight: 20,
  },
});

export default CrossPlatformPicker;
