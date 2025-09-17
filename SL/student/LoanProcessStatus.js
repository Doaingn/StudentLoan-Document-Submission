import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../database/firebase';

const LoanProcessStatus = ({ navigation }) => {
  const [processStatus, setProcessStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submissionData, setSubmissionData] = useState(null);

  const processSteps = [
    {
      id: 'document_collection',
      title: 'รวบรวมเอกสาร',
      description: 'เจ้าหน้าที่กำลังรวบรวมเอกสารของผู้กู้ทั้งหมด',
      icon: 'folder-outline',
    },
    {
      id: 'document_organization',
      title: 'จัดเรียงเอกสาร',
      description: 'จัดเรียงเอกสารเพื่อเตรียมส่งให้ธนาคาร',
      icon: 'library-outline',
    },
    {
      id: 'bank_submission',
      title: 'ส่งเอกสารไปยังธนาคาร',
      description: 'ส่งเอกสารให้ธนาคารพิจารณาการกู้ยืม',
      icon: 'business-outline',
    },
  ];

  useEffect(() => {
    fetchProcessStatus();
    // Set up real-time listener for process status updates
    const setupRealtimeListener = () => {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const processDocRef = doc(db, 'loan_process_status', userId);
      const unsubscribe = onSnapshot(processDocRef, (doc) => {
        if (doc.exists()) {
          setProcessStatus(doc.data());
        }
      });

      return unsubscribe;
    };

    const unsubscribe = setupRealtimeListener();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const fetchProcessStatus = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert("ข้อผิดพลาด", "ไม่พบข้อมูลผู้ใช้");
        navigation.goBack();
        return;
      }

      // Fetch process status
      const processDocRef = doc(db, 'loan_process_status', userId);
      const processDoc = await getDoc(processDocRef);
      
      if (processDoc.exists()) {
        setProcessStatus(processDoc.data());
      } else {
        // Initialize default status if doesn't exist
        const defaultStatus = {
          currentStep: 'document_collection',
          steps: {
            document_collection: {
              status: 'in_progress',
              updatedAt: new Date().toISOString(),
              note: 'เริ่มกระบวนการรวบรวมเอกสาร'
            },
            document_organization: {
              status: 'pending',
              updatedAt: null,
              note: null
            },
            bank_submission: {
              status: 'pending',
              updatedAt: null,
              note: null
            }
          },
          overallStatus: 'processing',
          createdAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString()
        };
        setProcessStatus(defaultStatus);
      }

      // Also fetch submission data for display
      const submissionDocRef = doc(db, 'document_submissions', userId);
      const submissionDoc = await getDoc(submissionDocRef);
      if (submissionDoc.exists()) {
        setSubmissionData(submissionDoc.data());
      }

    } catch (error) {
      console.error("Error fetching process status:", error);
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถโหลดข้อมูลสถานะได้");
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProcessStatus();
    setRefreshing(false);
  };

  const getStepStatus = (stepId) => {
    if (!processStatus?.steps) return 'pending';
    return processStatus.steps[stepId]?.status || 'pending';
  };

  const getStepNote = (stepId) => {
    if (!processStatus?.steps) return null;
    return processStatus.steps[stepId]?.note || null;
  };

  const getStepUpdatedAt = (stepId) => {
    if (!processStatus?.steps) return null;
    const updatedAt = processStatus.steps[stepId]?.updatedAt;
    if (!updatedAt) return null;
    return new Date(updatedAt).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'in_progress':
        return '#f59e0b';
      case 'pending':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return 'checkmark-circle';
      case 'in_progress':
        return 'time';
      case 'pending':
        return 'ellipse-outline';
      default:
        return 'ellipse-outline';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return 'เสร็จสิ้น';
      case 'in_progress':
        return 'กำลังดำเนินการ';
      case 'pending':
        return 'รอดำเนินการ';
      default:
        return 'รอดำเนินการ';
    }
  };

  const renderProcessStep = (step, index) => {
    const stepStatus = getStepStatus(step.id);
    const stepNote = getStepNote(step.id);
    const updatedAt = getStepUpdatedAt(step.id);
    const statusColor = getStatusColor(stepStatus);
    const isLastStep = index === processSteps.length - 1;

    return (
      <View key={step.id} style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepIcon, { backgroundColor: statusColor }]}>
            <Ionicons 
              name={getStatusIcon(stepStatus)} 
              size={24} 
              color="#fff" 
            />
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepDescription}>{step.description}</Text>
            <View style={styles.stepStatusContainer}>
              <Text style={[styles.stepStatus, { color: statusColor }]}>
                {getStatusText(stepStatus)}
              </Text>
              {updatedAt && (
                <Text style={styles.stepTime}>
                  อัพเดทเมื่อ: {updatedAt}
                </Text>
              )}
            </View>
            {stepNote && (
              <View style={styles.noteContainer}>
                <Text style={styles.noteText}>{stepNote}</Text>
              </View>
            )}
          </View>
        </View>
        {!isLastStep && (
          <View style={[
            styles.stepConnector,
            { 
              backgroundColor: stepStatus === 'completed' ? '#10b981' : '#e5e7eb',
            }
          ]} />
        )}
      </View>
    );
  };

  const renderOverallStatus = () => {
    const overallStatus = processStatus?.overallStatus || 'processing';
    const currentStep = processStatus?.currentStep;
    const currentStepInfo = processSteps.find(step => step.id === currentStep);
    
    let statusMessage = '';
    let statusColor = '#f59e0b';
    let statusIcon = 'time';

    switch (overallStatus) {
      case 'completed':
        statusMessage = 'เอกสารของคุณถูกส่งไปยังธนาคารเรียบร้อยแล้ว';
        statusColor = '#10b981';
        statusIcon = 'checkmark-circle';
        break;
      case 'processing':
        statusMessage = `กำลังดำเนินการ: ${currentStepInfo?.title || 'รวบรวมเอกสาร'}`;
        statusColor = '#f59e0b';
        statusIcon = 'time';
        break;
      default:
        statusMessage = 'รอเริ่มกระบวนการ';
        statusColor = '#6b7280';
        statusIcon = 'ellipse-outline';
    }

    return (
      <View style={[styles.overallStatusCard, { borderLeftColor: statusColor }]}>
        <View style={styles.overallStatusHeader}>
          <Ionicons name={statusIcon} size={24} color={statusColor} />
          <Text style={[styles.overallStatusTitle, { color: statusColor }]}>
            สถานะการดำเนินการ
          </Text>
        </View>
        <Text style={styles.overallStatusMessage}>{statusMessage}</Text>
        {processStatus?.lastUpdatedAt && (
          <Text style={styles.lastUpdated}>
            อัพเดทล่าสุด: {new Date(processStatus.lastUpdatedAt).toLocaleDateString('th-TH', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="refresh" size={48} color="#3b82f6" />
        <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="document-text" size={32} color="#3b82f6" />
        <Text style={styles.headerTitle}>สถานะการดำเนินการ</Text>
        <Text style={styles.headerSubtitle}>
          ติดตามความคืบหน้าการประมวลผลเอกสารของคุณ
        </Text>
      </View>

      {/* Overall Status */}
      {renderOverallStatus()}

      {/* Process Steps */}
      <View style={styles.stepsSection}>
        <Text style={styles.sectionTitle}>ขั้นตอนการดำเนินการ</Text>
        <View style={styles.stepsContainer}>
          {processSteps.map((step, index) => renderProcessStep(step, index))}
        </View>
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Ionicons name="information-circle-outline" size={20} color="#3b82f6" />
          <Text style={styles.infoTitle}>หมายเหตุ</Text>
        </View>
        <Text style={styles.infoText}>
          • เจ้าหน้าที่จะอัพเดทสถานะให้คุณทราบในแต่ละขั้นตอน{'\n'}
          • กระบวนการทั้งหมดอาจใช้เวลา 3-5 วันทำการ{'\n'}
          • หากมีข้อสงสัยสามารถติดต่อเจ้าหน้าที่ได้
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 12,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  overallStatusCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  overallStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  overallStatusTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  overallStatusMessage: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 8,
    lineHeight: 24,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#9ca3af',
  },
  stepsSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 20,
  },
  stepsContainer: {
    paddingLeft: 8,
  },
  stepContainer: {
    marginBottom: 32,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepContent: {
    flex: 1,
    paddingTop: 4,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
    lineHeight: 20,
  },
  stepStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stepStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  noteContainer: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  noteText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  stepConnector: {
    width: 2,
    height: 24,
    marginLeft: 23,
    marginTop: 8,
  },
  infoCard: {
    backgroundColor: '#f0f9ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
});

export default LoanProcessStatus;