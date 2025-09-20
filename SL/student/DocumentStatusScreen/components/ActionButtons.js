import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ActionButtons = ({ 
  onDelete, 
  disabled = false, 
  showDelete = true 
}) => {
  return (
    <View style={styles.actionButtons}>

      {showDelete && (
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton, disabled && styles.disabledButton]}
          onPress={onDelete}
          disabled={disabled}
        >
          <Ionicons name="trash-outline" size={20} color="#ffffff" />
          <Text style={styles.actionButtonText}>ยกเลิกการส่งเอกสาร</Text>
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
