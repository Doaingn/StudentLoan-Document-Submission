import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { db } from "../database/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

const DocCooldown = () => {
  const navigation = useNavigation();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, "DocumentService", "config");

    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const configData = docSnap.data();
          setConfig(configData);
        } else {
          setConfig(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to DocumentService config:", error);
        setConfig(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return "ไม่ระบุ";

    try {
      const [year, month, day] = dateStr.split("-");
      const [hour, minute] = timeStr.split(":");
      const dateTime = new Date(year, month - 1, day, hour, minute);

      const dateOptions = {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      };

      const timeOptions = {
        hour: "2-digit",
        minute: "2-digit",
      };

      const formattedDate = dateTime.toLocaleDateString("th-TH", dateOptions);
      const formattedTime = dateTime.toLocaleTimeString("th-TH", timeOptions);

      return `${formattedDate}\nเวลา ${formattedTime}`;
    } catch (error) {
      return "รูปแบบวันที่ไม่ถูกต้อง";
    }
  };

  const getTimeRemaining = () => {
    if (!config || !config.startDate || !config.startTime) {
      return null;
    }

    try {
      const [startYear, startMonth, startDay] = config.startDate.split("-");
      const [startHour, startMinute] = config.startTime.split(":");
      const startDateTime = new Date(
        startYear,
        startMonth - 1,
        startDay,
        startHour,
        startMinute
      );

      const now = new Date();
      const bangkokTime = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
      );

      const timeDiff = startDateTime - bangkokTime;

      if (timeDiff <= 0) {
        return null; // เวลาเปิดผ่านไปแล้ว
      }

      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

      return { days, hours, minutes };
    } catch (error) {
      return null;
    }
  };

  const timeRemaining = getTimeRemaining();

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.safeArea, styles.container, styles.centerContent]}
      >
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.iconContainer}>
            <Ionicons name="time-outline" size={48} color="#dc3545" />
          </View>
          <Text style={styles.headerTitle}>ระบบปิดให้บริการชั่วคราว</Text>
          <Text style={styles.headerSubtitle}>
            กรุณารอช่วงเวลาที่กำหนดเพื่อใช้งานระบบ
          </Text>
        </View>

        {/* Service Period Card */}
        {config && (
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>ช่วงเวลาให้บริการ</Text>

            {config.term && config.academicYear && (
              <View style={styles.termContainer}>
                <Text style={styles.termLabel}>เทอม/ปีการศึกษา</Text>
                <Text style={styles.termValue}>
                  เทอม {config.term} ปีการศึกษา {config.academicYear}
                </Text>
              </View>
            )}

            <View style={styles.timeContainer}>
              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>เริ่มให้บริการ</Text>
                <Text style={styles.timeValue}>
                  {formatDateTime(config.startDate, config.startTime)}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>สิ้นสุดการให้บริการ</Text>
                <Text style={styles.timeValue}>
                  {formatDateTime(config.endDate, config.endTime)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Status Message Card */}
        {config && config.maintenanceMessage && (
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>📢 ประกาศ</Text>
            <Text style={styles.messageText}>{config.maintenanceMessage}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  container: {
    flexGrow: 1,
    padding: 20,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 32,
    shadowColor: "#1e293b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
  headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#1e293b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#dc3545",
    textAlign: "center",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#6c757d",
    textAlign: "center",
    lineHeight: 24,
  },
  infoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#1e293b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 16,
  },
  termContainer: {
    backgroundColor: "#e3f2fd",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#2196f3",
  },
  termLabel: {
    fontSize: 14,
    color: "#1565c0",
    fontWeight: "600",
    marginBottom: 4,
  },
  termValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0d47a1",
  },
  timeContainer: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
  },
  timeBlock: {
    marginBottom: 16,
  },
  timeLabel: {
    fontSize: 14,
    color: "#6c757d",
    fontWeight: "600",
    marginBottom: 8,
  },
  timeValue: {
    fontSize: 16,
    color: "#2c3e50",
    fontWeight: "500",
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: "#dee2e6",
    marginVertical: 16,
  },
  countdownCard: {
    backgroundColor: "#fff3cd",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#ffeaa7",
  },
  countdownTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#856404",
    textAlign: "center",
    marginBottom: 20,
  },
  countdownContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  countdownBox: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    minWidth: 70,
    shadowColor: "#856404",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  countdownNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#d63384",
  },
  countdownLabel: {
    fontSize: 12,
    color: "#856404",
    fontWeight: "600",
    marginTop: 4,
  },
  countdownSeparator: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#856404",
    marginHorizontal: 8,
  },
  messageCard: {
    backgroundColor: "#d1ecf1",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#bee5eb",
  },
  messageTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0c5460",
    marginBottom: 12,
  },
  messageText: {
    fontSize: 16,
    color: "#0c5460",
    lineHeight: 24,
  },
  instructionCard: {
    backgroundColor: "#d4edda",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#c3e6cb",
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#155724",
    marginBottom: 12,
  },
  instructionList: {
    paddingLeft: 8,
  },
  instructionItem: {
    fontSize: 14,
    color: "#155724",
    lineHeight: 22,
    marginBottom: 8,
  },
  backButton: {
    backgroundColor: "#6c757d",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: "#1e293b",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});

export default DocCooldown;
