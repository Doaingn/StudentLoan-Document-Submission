// components/ProgressCard.js - Updated for Term 2/3 support
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const ProgressCard = ({ stats, term = '1' }) => {
  
  const getProgressTitle = () => {
    switch(term) {
      case '1': return 'ความคืบหน้าการอัปโหลด';
      case '2': return 'ความคืบหน้าการอัปโหลดเอกสาร เทอม 2';
      case '3': return 'ความคืบหน้าการอัปโหลดเอกสาร เทอม 3';
      default: return 'ความคืบหน้าการอัปโหลด';
    }
  };

  const getProgressDescription = () => {
    switch(term) {
      case '1': return 'อัปโหลดเอกสารที่จำเป็นสำหรับการสมัครทุน';
      case '2': return 'อัปโหลดเอกสารที่จำเป็นสำหรับการเบิกเงินกู้ยืม';
      case '3': return 'อัปโหลดเอกสารที่จำเป็นสำหรับการเบิกเงินกู้ยืม';
      default: return 'อัปโหลดเอกสารที่จำเป็น';
    }
  };

  const progressPercentage = stats.required > 0 ? Math.round((stats.uploadedRequired / stats.required) * 100) : 0;
  const isComplete = stats.uploadedRequired === stats.required && stats.required > 0;

  const getProgressColor = () => {
    if (isComplete) return "#10b981"; // Green
    if (progressPercentage >= 50) return "#f59e0b"; // Orange
    return "#ef4444"; // Red
  };

  const getProgressIcon = () => {
    if (isComplete) return "checkmark-circle";
    if (progressPercentage >= 50) return "time";
    return "document-text-outline";
  };

  return (
    <View style={styles.progressCard}>
      <View style={styles.progressHeader}>
        <View style={styles.progressIcon}>
          <Ionicons 
            name={getProgressIcon()} 
            size={24} 
            color={getProgressColor()} 
          />
        </View>
        <View style={styles.progressInfo}>
          <Text style={styles.progressTitle}>{getProgressTitle()}</Text>
          <Text style={styles.progressDescription}>{getProgressDescription()}</Text>
        </View>
        <Text style={[styles.progressPercent, { color: getProgressColor() }]}>
          {progressPercentage}%
        </Text>
      </View>
      
      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${progressPercentage}%`,
                backgroundColor: getProgressColor()
              }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          {stats.uploadedRequired}/{stats.required} เอกสารจำเป็น
        </Text>
      </View>

      {/* Additional stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <View style={styles.statIcon}>
            <Ionicons name="documents" size={16} color="#2563eb" />
          </View>
          <Text style={styles.statLabel}>เอกสารทั้งหมด:</Text>
          <Text style={styles.statValue}>{stats.uploaded}/{stats.total}</Text>
        </View>
        
        {stats.totalFiles > 0 && (
          <View style={styles.statItem}>
            <View style={styles.statIcon}>
              <Ionicons name="folder" size={16} color="#8b5cf6" />
            </View>
            <Text style={styles.statLabel}>ไฟล์ทั้งหมด:</Text>
            <Text style={styles.statValue}>{stats.totalFiles}</Text>
          </View>
        )}

        {stats.convertedFiles > 0 && (
          <View style={styles.statItem}>
            <View style={styles.statIcon}>
              <Ionicons name="image" size={16} color="#0ea5e9" />
            </View>
            <Text style={styles.statLabel}>แปลงจากรูป:</Text>
            <Text style={styles.statValue}>{stats.convertedFiles}</Text>
          </View>
        )}
      </View>

      {/* Status message */}
      <View style={[styles.statusMessage, { backgroundColor: isComplete ? "#d1fae5" : "#fef3c7" }]}>
        <Ionicons 
          name={isComplete ? "checkmark-circle" : "information-circle"} 
          size={16} 
          color={isComplete ? "#065f46" : "#92400e"} 
        />
        <Text style={[styles.statusText, { color: isComplete ? "#065f46" : "#92400e" }]}>
          {isComplete 
            ? "เอกสารครบถ้วนแล้ว พร้อมส่งเอกสาร"
            : `ยังต้องอัปโหลดอีก ${stats.required - stats.uploadedRequired} เอกสาร`
          }
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  progressCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  progressIcon: {
    marginRight: 12,
  },
  progressInfo: {
    flex: 1,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
  },
  progressDescription: {
    fontSize: 12,
    color: "#64748b",
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: "bold",
  },
  progressBarContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    marginBottom: 4,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    transition: "width 0.3s ease",
  },
  progressText: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  statsContainer: {
    marginBottom: 12,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  statIcon: {
    marginRight: 8,
  },
  statLabel: {
    fontSize: 13,
    color: "#64748b",
    flex: 1,
  },
  statValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  statusMessage: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 6,
  },
});

export default ProgressCard;
