import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const HeaderSection = ({ submissionData }) => {
  const submittedDate = submissionData?.submittedAt 
    ? new Date(submissionData.submittedAt).toLocaleString('th-TH')
    : 'ไม่ทราบ';

  return (
    <View style={styles.header}>
      <View style={styles.headerIcon}>
        <Ionicons name="document-text" size={32} color="#2563eb" />
      </View>
      <Text style={styles.title}>สถานะการส่งเอกสาร</Text>
      <Text style={styles.subtitle}>
        ส่งเมื่อ: {submittedDate}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 20,
  },
  headerIcon: {
    backgroundColor: "#eff6ff",
    padding: 16,
    borderRadius: 50,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 4,
  },
  userInfo: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: 'center',
  },
});

export default HeaderSection;