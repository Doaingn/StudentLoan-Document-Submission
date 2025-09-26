// components/EmptyState.js - Updated for Term 2/3 support
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const EmptyState = ({ onStartSurvey, term = '1' }) => {
  
  const getEmptyStateContent = () => {
    switch(term) {
      case '1':
        return {
          icon: "document-outline",
          title: "ยังไม่มีข้อมูลแบบสอบถาม",
          description: "กรุณาทำแบบสอบถามก่อนอัปโหลดเอกสาร",
          buttonText: "เริ่มทำแบบสอบถาม",
          buttonIcon: "play-outline",
          showButton: true
        };
      case '2':
        return {
          icon: "time-outline",
          title: "กำลังโหลดข้อมูล เทอม 2",
          description: "กรุณารอสักครู่ ระบบกำลังเตรียมการอัปโหลดเอกสารสำหรับการเบิกเงินกู้ยืม",
          buttonText: "",
          buttonIcon: "",
          showButton: false
        };
      case '3':
        return {
          icon: "time-outline", 
          title: "กำลังโหลดข้อมูล เทอม 3",
          description: "กรุณารอสักครู่ ระบบกำลังเตรียมการอัปโหลดเอกสารสำหรับการเบิกเงินกู้ยืม",
          buttonText: "",
          buttonIcon: "",
          showButton: false
        };
      default:
        return {
          icon: "document-outline",
          title: "ยังไม่มีข้อมูล",
          description: "กรุณารอสักครู่",
          buttonText: "",
          buttonIcon: "",
          showButton: false
        };
    }
  };

  const content = getEmptyStateContent();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.emptyState}>
        <View style={styles.headerIcon}>
          <Ionicons name={content.icon} size={48} color="#9ca3af" />
        </View>
        <Text style={styles.emptyStateTitle}>{content.title}</Text>
        <Text style={styles.emptyStateText}>
          {content.description}
        </Text>
        
        {content.showButton && (
          <TouchableOpacity
            style={styles.startSurveyButton}
            onPress={onStartSurvey}
          >
            <Ionicons name={content.buttonIcon} size={20} color="#ffffff" />
            <Text style={styles.startSurveyButtonText}>{content.buttonText}</Text>
          </TouchableOpacity>
        )}

        {/* แสดงข้อมูลเพิ่มเติมสำหรับเทอม 2/3 */}
        {(term === '2' || term === '3') && (
          <View style={styles.termInfo}>
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={24} color="#2563eb" />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>เอกสารที่ต้องอัปโหลด</Text>
                <Text style={styles.infoText}>• ใบเบิกเงินกู้ยืม</Text>
                <Text style={styles.infoText}>• ใบภาระค่าใช้จ่าย</Text>
                <Text style={styles.infoText}>• สำเนาบัตรประชาชนผู้กู้</Text>
                <Text style={styles.infoText}>• สำเนาบัตรประชาชนผู้ปกครอง (หากอายุต่ำกว่า 20 ปี)</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f8fafc",
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  headerIcon: {
    backgroundColor: "#eff6ff",
    padding: 16,
    borderRadius: 50,
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1e293b",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  startSurveyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563eb",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#2563eb",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  startSurveyButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  termInfo: {
    marginTop: 32,
    width: "100%",
  },
  infoCard: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: "#2563eb",
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 4,
    lineHeight: 20,
  },
});

export default EmptyState;
