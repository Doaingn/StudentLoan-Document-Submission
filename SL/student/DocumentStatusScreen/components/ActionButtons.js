import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ActionButtons = ({ 
  onRefresh, 
  onHome, 
  onDelete, 
  refreshing = false, 
  disabled = false, 
  showDelete = true 
}) => {
  return (
    <View style={styles.actionButtons}>
      <TouchableOpacity
        style={[styles.actionButton, styles.refreshButton, (refreshing || disabled) && styles.disabledButton]}
        onPress={onRefresh}
        disabled={refreshing || disabled}
      >
        {refreshing ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Ionicons name="refresh-outline" size={20} color="#ffffff" />
        )}
        <Text style={styles.actionButtonText}>
          {refreshing ? "กำลังโหลด..." : "รีเฟรช"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, styles.homeButton, disabled && styles.disabledButton]}
        onPress={onHome}
        disabled={disabled}
      >
        <Ionicons name="home-outline" size={20} color="#ffffff" />
        <Text style={styles.actionButtonText}>หน้าหลัก</Text>
      </TouchableOpacity>

      {showDelete && (
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton, disabled && styles.disabledButton]}
          onPress={onDelete}
          disabled={disabled}
        >
          <Ionicons name="trash-outline" size={20} color="#ffffff" />
          <Text style={styles.actionButtonText}>ลบทั้งหมด</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 48,
  },
  refreshButton: {
    backgroundColor: '#3b82f6',
  },
  homeButton: {
    backgroundColor: '#10b981',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  disabledButton: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ActionButtons;
