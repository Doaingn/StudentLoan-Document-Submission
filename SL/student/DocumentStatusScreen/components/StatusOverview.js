import { View, Text, StyleSheet } from 'react-native';

const StatusOverview = ({ stats }) => {
  return (
    <View style={styles.overallStatusCard}>
      <Text style={styles.overallStatusTitle}>สถานะโดยรวม</Text>
      <View style={styles.statusGrid}>
        <View style={styles.statusItem}>
          <Text style={[styles.statusNumber, { color: "#10b981" }]}>{stats.approved}</Text>
          <Text style={styles.statusLabel}>อนุมัติแล้ว</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={[styles.statusNumber, { color: "#f59e0b" }]}>{stats.pending}</Text>
          <Text style={styles.statusLabel}>รอตรวจสอบ</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={[styles.statusNumber, { color: "#ef4444" }]}>{stats.rejected}</Text>
          <Text style={styles.statusLabel}>ไม่อนุมัติ</Text>
        </View>
      </View>
      <View style={styles.totalContainer}>
        <Text style={styles.totalText}>
          รวม {stats.total} เอกสาร • {stats.totalFiles} ไฟล์
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overallStatusCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  overallStatusTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    color: "#1e293b",
    textAlign: 'center',
  },
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statusItem: {
    alignItems: 'center',
  },
  statusNumber: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 12,
    color: "#64748b",
    textAlign: 'center',
  },
  totalContainer: {
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  totalText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
});

export default StatusOverview;