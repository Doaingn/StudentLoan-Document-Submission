import { useState, useEffect } from "react";
import { db } from "./database/firebase";
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  setDoc,
  getDoc,
  query,
  where 
} from "firebase/firestore";

const LoanProcessManagement = () => {
  const [approvedSubmissions, setApprovedSubmissions] = useState([]);
  const [users, setUsers] = useState({});
  const [processStatuses, setProcessStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Bulk selection states
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [showBulkControls, setShowBulkControls] = useState(false);
  const [bulkStep, setBulkStep] = useState('document_collection');
  const [bulkStatus, setBulkStatus] = useState('pending');
  const [bulkNote, setBulkNote] = useState('');

  // Process steps configuration
  const processSteps = [
    {
      id: 'document_collection',
      title: 'รวบรวมเอกสาร',
      description: 'เจ้าหน้าที่กำลังรวบรวมเอกสารของผู้กู้ทั้งหมด',
    },
    {
      id: 'document_organization',
      title: 'จัดเรียงเอกสาร',
      description: 'จัดเรียงเอกสารเพื่อเตรียมส่งให้ธนาคาร',
    },
    {
      id: 'bank_submission',
      title: 'ส่งเอกสารไปยังธนาคาร',
      description: 'ส่งเอกสารให้ธนาคารพิจารณาการกู้ยืม',
    },
  ];

  const stepStatusOptions = {
    pending: 'รอดำเนินการ',
    in_progress: 'กำลังดำเนินการ',
    completed: 'เสร็จสิ้น'
  };

  const overallStatusOptions = {
    processing: 'กำลังดำเนินการ',
    completed: 'เสร็จสิ้นทั้งหมด'
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch document submissions
      const submissionsRef = collection(db, "document_submissions_2568_1");
      const submissionsSnap = await getDocs(submissionsRef);
      const submissionsData = [];

      submissionsSnap.forEach((doc) => {
        const data = doc.data();
        // Check if all documents are approved
        const allApproved = Object.values(data.documentStatuses || {}).every(
          doc => doc.status === 'approved'
        );
        
        if (allApproved && Object.keys(data.documentStatuses || {}).length > 0) {
          submissionsData.push({ id: doc.id, ...data });
        }
      });

      // Fetch users data
      const usersRef = collection(db, "users");
      const usersSnap = await getDocs(usersRef);
      const usersData = {};

      usersSnap.forEach((doc) => {
        usersData[doc.id] = doc.data();
      });

      // Fetch existing process statuses
      const processStatusesData = {};
      for (const submission of submissionsData) {
        const statusDoc = await getDoc(doc(db, 'loan_process_status', submission.userId));
        if (statusDoc.exists()) {
          processStatusesData[submission.userId] = statusDoc.data();
        }
      }

      setApprovedSubmissions(submissionsData);
      setUsers(usersData);
      setProcessStatuses(processStatusesData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateProcessStatus = async (userId, stepId, status, note) => {
    try {
      const processDocRef = doc(db, 'loan_process_status', userId);
      
      // Get current process status or create default
      let currentStatus = processStatuses[userId];
      if (!currentStatus) {
        currentStatus = {
          currentStep: 'document_collection',
          steps: {
            document_collection: { status: 'pending', updatedAt: null, note: null },
            document_organization: { status: 'pending', updatedAt: null, note: null },
            bank_submission: { status: 'pending', updatedAt: null, note: null }
          },
          overallStatus: 'processing',
          createdAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString()
        };
      }

      // Update the specific step
      const updatedSteps = {
        ...currentStatus.steps,
        [stepId]: {
          status,
          updatedAt: new Date().toISOString(),
          note: note || null
        }
      };

      // Determine current step and overall status
      let newCurrentStep = stepId;
      let newOverallStatus = 'processing';

      // If current step is completed, move to next step
      if (status === 'completed') {
        const stepIndex = processSteps.findIndex(step => step.id === stepId);
        if (stepIndex < processSteps.length - 1) {
          newCurrentStep = processSteps[stepIndex + 1].id;
        }
        
        // Check if all steps are completed
        const allCompleted = processSteps.every(step => 
          step.id === stepId ? true : updatedSteps[step.id]?.status === 'completed'
        );
        
        if (allCompleted) {
          newOverallStatus = 'completed';
          newCurrentStep = 'bank_submission'; // Keep at last step if all completed
        }
      }

      const updatedStatus = {
        ...currentStatus,
        currentStep: newCurrentStep,
        steps: updatedSteps,
        overallStatus: newOverallStatus,
        lastUpdatedAt: new Date().toISOString()
      };

      await setDoc(processDocRef, updatedStatus, { merge: true });

      // Update local state
      setProcessStatuses(prev => ({
        ...prev,
        [userId]: updatedStatus
      }));

      return true;
    } catch (error) {
      console.error("Error updating process status:", error);
      throw error;
    }
  };

  // Bulk update function
  const updateMultipleUsers = async (userIds, stepId, status, note) => {
    try {
      const results = {
        success: [],
        failed: []
      };

      for (const userId of userIds) {
        try {
          await updateProcessStatus(userId, stepId, status, note);
          results.success.push(userId);
        } catch (error) {
          results.failed.push({ userId, error: error.message });
        }
      }

      return results;
    } catch (error) {
      console.error("Error in bulk update:", error);
      throw error;
    }
  };

  // Selection functions
  const toggleUserSelection = (userId) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
    setSelectAll(newSelected.size === filteredSubmissions.length);
    setShowBulkControls(newSelected.size > 0);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedUsers(new Set());
      setShowBulkControls(false);
    } else {
      const allUserIds = filteredSubmissions.map(sub => sub.userId);
      setSelectedUsers(new Set(allUserIds));
      setShowBulkControls(true);
    }
    setSelectAll(!selectAll);
  };

  // Bulk update handler
  const handleBulkUpdate = async () => {
    if (selectedUsers.size === 0) {
      alert("กรุณาเลือกผู้กู้ที่ต้องการอัพเดท");
      return;
    }

    const stepName = processSteps.find(s => s.id === bulkStep)?.title;
    const statusName = stepStatusOptions[bulkStatus];

    if (!window.confirm(`ต้องการอัพเดทขั้นตอน "${stepName}" เป็น "${statusName}" สำหรับผู้กู้ ${selectedUsers.size} คนหรือไม่?`)) {
      return;
    }

    try {
      const results = await updateMultipleUsers(
        Array.from(selectedUsers),
        bulkStep,
        bulkStatus,
        bulkNote
      );

      if (results.failed.length === 0) {
        alert(`อัพเดทสำเร็จทั้งหมด ${results.success.length} คน`);
      } else {
        alert(`อัพเดทสำเร็จ ${results.success.length} คน, ล้มเหลว ${results.failed.length} คน`);
        console.error("Failed updates:", results.failed);
      }

      // Reset selections
      setSelectedUsers(new Set());
      setSelectAll(false);
      setShowBulkControls(false);
      setBulkNote('');

    } catch (error) {
      alert('เกิดข้อผิดพลาดในการอัพเดท');
      console.error(error);
    }
  };

  const filteredSubmissions = approvedSubmissions.filter((submission) => {
    const userName = users[submission.userId]?.name || "";
    return userName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'in_progress':
        return '⏳';
      case 'pending':
        return '○';
      default:
        return '○';
    }
  };

  const ProcessStatusModal = ({ userId, onClose }) => {
    const [stepStates, setStepStates] = useState({});
    const userProcessStatus = processStatuses[userId];

    useEffect(() => {
      const initialStates = {};
      processSteps.forEach(step => {
        const currentStepStatus = userProcessStatus?.steps?.[step.id];
        initialStates[step.id] = {
          status: currentStepStatus?.status || 'pending',
          note: currentStepStatus?.note || ''
        };
      });
      setStepStates(initialStates);
    }, [userId, userProcessStatus]);

    const handleStatusChange = (stepId, newStatus) => {
      setStepStates(prev => ({
        ...prev,
        [stepId]: { ...prev[stepId], status: newStatus }
      }));
    };

    const handleNoteChange = (stepId, note) => {
      setStepStates(prev => ({
        ...prev,
        [stepId]: { ...prev[stepId], note }
      }));
    };

    const handleSave = async (stepId) => {
      try {
        const stepState = stepStates[stepId];
        await updateProcessStatus(userId, stepId, stepState.status, stepState.note);
        alert('อัพเดทสถานะเรียบร้อยแล้ว');
      } catch (error) {
        alert('เกิดข้อผิดพลาดในการอัพเดทสถานะ');
      }
    };

    return (
      <div style={styles.modal}>
        <div style={styles.modalContent}>
          <div style={styles.modalHeader}>
            <h2>จัดการสถานะการดำเนินการ</h2>
            <h3>ผู้กู้: {users[userId]?.name || 'ไม่ระบุชื่อ'}</h3>
            <button onClick={onClose} style={styles.closeButton}>×</button>
          </div>

          <div style={styles.currentStatus}>
            <h4>สถานะปัจจุบัน</h4>
            <p>ขั้นตอนปัจจุบัน: {processSteps.find(s => s.id === userProcessStatus?.currentStep)?.title || 'รวบรวมเอกสาร'}</p>
            <p>สถานะโดยรวม: {overallStatusOptions[userProcessStatus?.overallStatus] || 'กำลังดำเนินการ'}</p>
          </div>

          <div style={styles.stepsContainer}>
            {processSteps.map((step, index) => {
              const stepState = stepStates[step.id] || { status: 'pending', note: '' };
              const currentStepStatus = userProcessStatus?.steps?.[step.id];

              return (
                <div key={step.id} style={styles.stepCard}>
                  <h4>{step.title}</h4>
                  <p style={styles.stepDescription}>{step.description}</p>
                  
                  <div style={styles.statusRow}>
                    <label style={styles.label}>สถานะ:</label>
                    <select
                      value={stepState.status}
                      onChange={(e) => handleStatusChange(step.id, e.target.value)}
                      style={styles.select}
                    >
                      <option value="pending">รอดำเนินการ</option>
                      <option value="in_progress">กำลังดำเนินการ</option>
                      <option value="completed">เสร็จสิ้น</option>
                    </select>
                  </div>

                  <div style={styles.noteRow}>
                    <label style={styles.label}>หมายเหตุ:</label>
                    <textarea
                      value={stepState.note}
                      onChange={(e) => handleNoteChange(step.id, e.target.value)}
                      style={styles.textarea}
                      placeholder="ใส่หมายเหตุเพิ่มเติม (ถ้ามี)"
                      rows={3}
                    />
                  </div>

                  {currentStepStatus?.updatedAt && (
                    <div style={styles.lastUpdated}>
                      อัพเดทล่าสุด: {new Date(currentStepStatus.updatedAt).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  )}

                  <button
                    onClick={() => handleSave(step.id)}
                    style={styles.saveButton}
                  >
                    บันทึกการเปลี่ยนแปลง
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div style={styles.loadingText}>กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>ระบบจัดการสถานะการดำเนินการกู้ยืม</h1>
      <p style={styles.subtitle}>
        จัดการสถานะสำหรับผู้กู้ที่เอกสารได้รับการอนุมัติครบถ้วนแล้ว
      </p>

      <div style={styles.filterContainer}>
        <input
          type="text"
          placeholder="ค้นหาชื่อผู้กู้..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.input}
        />
        <div style={styles.countInfo}>
          ผู้กู้ที่เอกสารอนุมัติครบ: {filteredSubmissions.length} คน
        </div>
      </div>

      {/* Bulk Selection Controls */}
      <div style={styles.bulkSelectionContainer}>
        <label style={styles.selectAllLabel}>
          <input
            type="checkbox"
            checked={selectAll}
            onChange={toggleSelectAll}
            style={styles.checkbox}
          />
          เลือกทั้งหมด ({selectedUsers.size} คน)
        </label>
      </div>

      {/* Bulk Update Controls */}
      {showBulkControls && (
        <div style={styles.bulkControls}>
          <h3>อัพเดทหลายคนพร้อมกัน ({selectedUsers.size} คน)</h3>
          
          <div style={styles.bulkInputsContainer}>
            <div style={styles.bulkInputRow}>
              <div style={styles.bulkInputGroup}>
                <label style={styles.label}>เลือกขั้นตอน:</label>
                <select
                  value={bulkStep}
                  onChange={(e) => setBulkStep(e.target.value)}
                  style={styles.select}
                >
                  {processSteps.map(step => (
                    <option key={step.id} value={step.id}>
                      {step.title}
                    </option>
                  ))}
                </select>
              </div>
              
              <div style={styles.bulkInputGroup}>
                <label style={styles.label}>กำหนดสถานะ:</label>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  style={styles.select}
                >
                  <option value="pending">รอดำเนินการ</option>
                  <option value="in_progress">กำลังดำเนินการ</option>
                  <option value="completed">เสร็จสิ้น</option>
                </select>
              </div>
            </div>
            
            <div style={styles.bulkNoteContainer}>
              <label style={styles.label}>หมายเหตุสำหรับทุกคน:</label>
              <textarea
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value)}
                style={styles.textarea}
                placeholder="ใส่หมายเหตุที่จะใช้สำหรับทุกคนที่เลือก"
                rows={2}
              />
            </div>
            
            <div style={styles.bulkActionButtons}>
              <button
                onClick={handleBulkUpdate}
                style={styles.bulkUpdateButton}
              >
                อัพเดท {selectedUsers.size} คน
              </button>
              <button
                onClick={() => {
                  setSelectedUsers(new Set());
                  setSelectAll(false);
                  setShowBulkControls(false);
                }}
                style={styles.cancelButton}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.usersGrid}>
        {filteredSubmissions.map((submission) => {
          const user = users[submission.userId] || {};
          const userProcessStatus = processStatuses[submission.userId];
          const currentStep = processSteps.find(s => s.id === userProcessStatus?.currentStep);
          const overallStatus = userProcessStatus?.overallStatus || 'processing';
          const isSelected = selectedUsers.has(submission.userId);

          // Count step statuses
          const completedSteps = Object.values(userProcessStatus?.steps || {})
            .filter(step => step.status === 'completed').length;
          const inProgressSteps = Object.values(userProcessStatus?.steps || {})
            .filter(step => step.status === 'in_progress').length;

          return (
            <div 
              key={submission.id} 
              style={{
                ...styles.userCard,
                ...(isSelected ? styles.userCardSelected : {})
              }}
            >
              <div style={styles.userCardHeader}>
                <label style={styles.userCheckboxLabel}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleUserSelection(submission.userId)}
                    style={styles.checkbox}
                  />
                </label>
                <div style={styles.userHeader}>
                  <h3 style={styles.userName}>{user.name || "ไม่ระบุชื่อ"}</h3>
                  <div style={{
                    ...styles.statusBadge,
                    backgroundColor: overallStatus === 'completed' ? '#28a745' : '#ffc107'
                  }}>
                    {overallStatusOptions[overallStatus] || 'กำลังดำเนินการ'}
                  </div>
                </div>
              </div>

              <div style={styles.userInfo}>
                <p><strong>อีเมล:</strong> {submission.userEmail}</p>
                <p><strong>วันที่ส่งเอกสาร:</strong> {new Date(submission.submittedAt).toLocaleDateString('th-TH')}</p>
                <p><strong>ขั้นตอนปัจจุบัน:</strong> {currentStep?.title || 'รวบรวมเอกสาร'}</p>
              </div>

              <div style={styles.progressInfo}>
                <div style={styles.progressRow}>
                  <span style={{...styles.progressBadge, backgroundColor: '#28a745'}}>
                    เสร็จสิ้น: {completedSteps}
                  </span>
                  <span style={{...styles.progressBadge, backgroundColor: '#ffc107'}}>
                    กำลังดำเนินการ: {inProgressSteps}
                  </span>
                  <span style={{...styles.progressBadge, backgroundColor: '#6c757d'}}>
                    รอดำเนินการ: {3 - completedSteps - inProgressSteps}
                  </span>
                </div>
              </div>

              {userProcessStatus?.lastUpdatedAt && (
                <div style={styles.lastUpdateInfo}>
                  อัพเดทล่าสุด: {new Date(userProcessStatus.lastUpdatedAt).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              )}

              <button
                onClick={() => setSelectedUser(submission.userId)}
                style={styles.manageButton}
              >
                จัดการสถานะ
              </button>
            </div>
          );
        })}
      </div>

      {filteredSubmissions.length === 0 && (
        <div style={styles.noData}>
          {searchTerm ? 'ไม่พบผู้กู้ที่ตรงกับการค้นหา' : 'ยังไม่มีผู้กู้ที่เอกสารอนุมัติครบถ้วน'}
        </div>
      )}

      {selectedUser && (
        <ProcessStatusModal
          userId={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: 30,
    maxWidth: 1400,
    margin: "0 auto",
    fontFamily: "Arial, sans-serif",
    fontSize: 16,
    lineHeight: 1.5,
  },
  header: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
  },
  filterContainer: {
    display: "flex",
    gap: 20,
    marginBottom: 20,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  input: {
    padding: 12,
    fontSize: 16,
    border: "1px solid #ccc",
    borderRadius: 8,
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    minWidth: 300,
  },
  countInfo: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#28a745",
  },
  
  // Bulk Selection Styles
  bulkSelectionContainer: {
    background: "#f8f9fa",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  selectAllLabel: {
    display: "flex",
    alignItems: "center",
    fontSize: 16,
    fontWeight: "bold",
    color: "#495057",
    cursor: "pointer",
  },
  checkbox: {
    marginRight: 10,
    width: 16,
    height: 16,
    cursor: "pointer",
  },
  
  // Bulk Update Controls
  bulkControls: {
    background: "#e3f2fd",
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
    border: "2px solid #1976d2",
  },
  bulkInputsContainer: {
    marginTop: 15,
  },
  bulkInputRow: {
    display: "flex",
    gap: 20,
    marginBottom: 15,
    flexWrap: "wrap",
  },
  bulkInputGroup: {
    display: "flex",
    flexDirection: "column",
    minWidth: 200,
  },
  bulkNoteContainer: {
    marginBottom: 20,
  },
  bulkActionButtons: {
    display: "flex",
    gap: 10,
  },
  bulkUpdateButton: {
    padding: "12px 24px",
    fontSize: 16,
    backgroundColor: "#1976d2",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold",
  },
  cancelButton: {
    padding: "12px 24px",
    fontSize: 16,
    backgroundColor: "#6c757d",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  
  loadingText: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    padding: 20,
  },
  usersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
    gap: 20,
  },
  userCard: {
    background: "#fff",
    padding: 20,
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    border: "1px solid #e0e0e0",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  userCardSelected: {
    border: "2px solid #1976d2",
    boxShadow: "0 6px 16px rgba(25,118,210,0.2)",
  },
  userCardHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 15,
  },
  userCheckboxLabel: {
    cursor: "pointer",
    marginTop: 5,
  },
  userHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    margin: 0,
  },
  statusBadge: {
    padding: "4px 12px",
    borderRadius: 20,
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  userInfo: {
    marginBottom: 15,
    fontSize: 14,
    color: "#666",
  },
  progressInfo: {
    marginBottom: 15,
  },
  progressRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  progressBadge: {
    padding: "4px 8px",
    borderRadius: 12,
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  lastUpdateInfo: {
    fontSize: 12,
    color: "#999",
    marginBottom: 15,
  },
  manageButton: {
    width: "100%",
    padding: "10px 20px",
    fontSize: 16,
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold",
  },
  noData: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    padding: 40,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
  },
  modal: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 30,
    maxWidth: 800,
    maxHeight: "90vh",
    overflowY: "auto",
    position: "relative",
    width: "90%",
  },
  modalHeader: {
    marginBottom: 20,
    borderBottom: "1px solid #eee",
    paddingBottom: 15,
  },
  closeButton: {
    position: "absolute",
    top: 15,
    right: 20,
    background: "none",
    border: "none",
    fontSize: 24,
    cursor: "pointer",
    color: "#999",
  },
  currentStatus: {
    backgroundColor: "#f8f9fa",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  stepsContainer: {
    display: "grid",
    gap: 20,
  },
  stepCard: {
    border: "1px solid #e0e0e0",
    borderRadius: 8,
    padding: 20,
    backgroundColor: "#fafafa",
  },
  stepDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 15,
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
  },
  noteRow: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: "bold",
    minWidth: 80,
    color: "#333",
    marginBottom: 5,
    display: "block",
  },
  select: {
    padding: 8,
    fontSize: 14,
    border: "1px solid #ccc",
    borderRadius: 4,
    backgroundColor: "#fff",
    minWidth: 150,
  },
  textarea: {
    width: "100%",
    padding: 8,
    fontSize: 14,
    border: "1px solid #ccc",
    borderRadius: 4,
    resize: "vertical",
    fontFamily: "inherit",
  },
  lastUpdated: {
    fontSize: 12,
    color: "#999",
    marginBottom: 10,
  },
  saveButton: {
    padding: "8px 16px",
    fontSize: 14,
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: "bold",
  },
};

export default LoanProcessManagement;