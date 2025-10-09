import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const StatusBadge = ({ status }) => {
  const getStatusInfo = (status) => {
    switch (status) {
      case "pending":
        return {
          color: "#f59e0b",
          bgColor: "#fef3c7",
          icon: "time-outline",
          text: "รอการตรวจสอบ",
          textColor: "#92400e"
        };
      case "approved":
        return {
          color: "#10b981",
          bgColor: "#d1fae5",
          icon: "checkmark-circle-outline",
          text: "อนุมัติแล้ว",
          textColor: "#065f46"
        };
      case "rejected":
        return {
          color: "#ef4444",
          bgColor: "#fee2e2",
          icon: "close-circle-outline",
          text: "ไม่อนุมัติ",
          textColor: "#991b1b"
        };
      default:
        return {
          color: "#6b7280",
          bgColor: "#f3f4f6",
          icon: "help-circle-outline",
          text: "ไม่ทราบสถานะ",
          textColor: "#374151"
        };
    }
  };

  const statusInfo = getStatusInfo(status);

  return (
    <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
      <Ionicons
        name={statusInfo.icon}
        size={16}
        color={statusInfo.color}
        style={styles.statusIcon}
      />
      <Text style={[styles.statusText, { color: statusInfo.textColor }]}>
        {statusInfo.text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

export default StatusBadge;