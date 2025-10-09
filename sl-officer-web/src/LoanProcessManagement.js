import { useState, useEffect } from "react";
import { db } from "./database/firebase";
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc,
  getDoc,
} from "firebase/firestore";
import { detectSubmissionPhase, areAllDocumentsApproved } from './phaseDetection';

const LoanProcessManagement = () => {
  const [approvedSubmissions, setApprovedSubmissions] = useState([]);
  const [users, setUsers] = useState({});
  const [processStatuses, setProcessStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedUserData, setSelectedUserData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [appConfig, setAppConfig] = useState(null);
  
  const [yearFilter, setYearFilter] = useState("current");
  const [termFilter, setTermFilter] = useState("current");
  const [statusFilter, setStatusFilter] = useState("all");
  const [availableYears, setAvailableYears] = useState([]);
  const [availableTerms, setAvailableTerms] = useState([]);
  
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

  // fetchAppConfig ให้โฟกัสเทอมปัจจุบัน
  const fetchAppConfig = async () => {
    try {
      const configRef = doc(db, "DocumentService", "config");
      const configDoc = await getDoc(configRef);

      if (configDoc.exists()) {
        const config = configDoc.data();
        setAppConfig(config);
        console.log("App config loaded - Current:", config.academicYear, "Term:", config.term);
        
        // ตั้งค่า filter เป็นเทอมปัจจุบันโดยอัตโนมัติ
        setYearFilter(config.academicYear);
        setTermFilter(config.term);
        
        return config;
      } else {
        const defaultConfig = {
          academicYear: "2568",
          term: "2",
          isEnabled: true,
          immediateAccess: true,
        };
        setAppConfig(defaultConfig);
        setYearFilter(defaultConfig.academicYear);
        setTermFilter(defaultConfig.term);
        return defaultConfig;
      }
    } catch (error) {
      console.error("Error fetching app config:", error);
      return null;
    }
  };

  // ปีและเทอมที่มีข้อมูลจริง
  const fetchAvailablePeriods = async () => {
    try {
      const periodsRef = doc(db, "DocumentService", "submission_periods_history");
      const periodsDoc = await getDoc(periodsRef);
      
      if (periodsDoc.exists()) {
        const data = periodsDoc.data();
        return {
          years: Array.isArray(data.availableYears) ? data.availableYears : [],
          terms: Array.isArray(data.availableTerms) ? data.availableTerms : ['1', '2', '3'], 
        };
      }
      
      // ถ้าไม่มีประวัติ ให้ใช้ปีและเทอมจาก config ปัจจุบัน
      const config = await fetchAppConfig();
      return { 
        years: [config.academicYear], 
        terms: [config.term] 
      };
    } catch (error) {
      console.error("Error fetching available periods:", error);
      const config = await fetchAppConfig();
      return { 
        years: [config.academicYear], 
        terms: [config.term] 
      };
    }
  };

  const fetchAllSubmissions = async () => {
    try {
      const config = await fetchAppConfig();
      const { years, terms } = await fetchAvailablePeriods();
      
      console.log("Available periods - Years:", years, "Terms:", terms);
      console.log("Current focus - Year:", config.academicYear, "Term:", config.term);
      
      let allSubmissions = [];
      let allProcessStatuses = {};
      let allYears = new Set();
      let allTerms = new Set();

      // ตรวจสอบทุกปีและเทอมที่มีข้อมูล
      for (const year of years) {
        for (const term of terms) {
          try {
            const submissionsRef = collection(db, `document_submissions_${year}_${term}`);
            const submissionsSnap = await getDocs(submissionsRef);
            
            if (!submissionsSnap.empty) {
              console.log(`Found ${submissionsSnap.docs.length} submissions in ${year}_${term}`);
              
              for (const docSnap of submissionsSnap.docs) {
                const data = docSnap.data();
                
                const phase = detectSubmissionPhase({ documentStatuses: data.documentStatuses });
                const allApproved = areAllDocumentsApproved(data.documentStatuses);
                
                if ((phase === 'disbursement' || phase === 'initial_application') && 
                    allApproved && 
                    Object.keys(data.documentStatuses || {}).length > 0) {
                  
                  const submissionData = { 
                    id: docSnap.id, 
                    ...data, 
                    academicYear: year,
                    submissionTerm: term,
                    isCurrentTerm: year === config.academicYear && term === config.term
                  };
                  allSubmissions.push(submissionData);
                  allYears.add(year);
                  allTerms.add(term);
                  
                  console.log(`Approved submission: ${data.student_id} - Phase: ${phase} - Term: ${year}_${term}`);
                  
                  // ดึง process statuses จาก collection ที่ตรงกับเทอม
                  try {
                    const statusCollectionName = `loan_process_status_${year}_${term}`;
                    const statusDoc = await getDoc(doc(db, statusCollectionName, data.userId));
                    
                    if (statusDoc.exists()) {
                      // ใช้ composite key: userId_year_term
                      const compositeKey = `${data.userId}_${year}_${term}`;
                      allProcessStatuses[compositeKey] = {
                        ...statusDoc.data(),
                        academicYear: year,
                        submissionTerm: term,
                        isCurrentTerm: year === config.academicYear && term === config.term,
                        userId: data.userId
                      };
                      console.log(`Found process status for ${data.userId} in ${year}_${term}`);
                    } else {
                      console.log(`No process status found for ${data.userId} in ${year}_${term} - Will create on first update`);
                    }
                  } catch (error) {
                    console.log(`Error accessing process status for ${data.userId} in ${year}_${term}:`, error.message);
                  }
                }
              }
            }
          } catch (error) {
            console.log(`Collection document_submissions_${year}_${term} not found or error:`, error.message);
          }
        }
      }

      setAvailableYears(Array.from(allYears).sort().reverse());
      setAvailableTerms(Array.from(allTerms).sort());
      
      console.log(`Final loaded: ${allSubmissions.length} approved submissions`);
      console.log(`Available years: ${Array.from(allYears)}`);
      console.log(`Available terms: ${Array.from(allTerms)}`);
      console.log(`Process statuses found: ${Object.keys(allProcessStatuses).length}`);
      console.log(`Process status keys:`, Object.keys(allProcessStatuses)); // แสดง keys ที่มี
      
      return { submissions: allSubmissions, processStatuses: allProcessStatuses };
    } catch (error) {
      console.error("Error fetching all submissions:", error);
      return { submissions: [], processStatuses: {} };
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const config = await fetchAppConfig();
      const { submissions, processStatuses } = await fetchAllSubmissions();

      // Fetch users data
      const usersRef = collection(db, "users");
      const usersSnap = await getDocs(usersRef);
      const usersData = {};

      usersSnap.forEach((doc) => {
        usersData[doc.id] = doc.data();
      });

      setApprovedSubmissions(submissions);
      setUsers(usersData);
      setProcessStatuses(processStatuses);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // เพิ่มฟังก์ชันตรวจสอบและสร้าง collection ถ้ายังไม่มี
  const ensureCollectionExists = async (collectionName) => {
    try {
      // ลองดึงข้อมูลจาก collection นี้เพื่อตรวจสอบว่ามีอยู่หรือไม่
      const testRef = collection(db, collectionName);
      const testSnap = await getDocs(testRef);
      console.log(`Collection ${collectionName} exists:`, !testSnap.empty);
      return true;
    } catch (error) {
      console.log(`Collection ${collectionName} does not exist:`, error.message);
      
      // ถ้า collection ไม่มีอยู่ จะสร้างโดยอัตโนมัติเมื่อมีการเขียนข้อมูลครั้งแรก
      console.log(`Collection ${collectionName} will be created on first write`);
      return false;
    }
  };

  // แก้ไข updateProcessStatus ให้รับ year/term โดยตรง
  const updateProcessStatus = async (userId, academicYear, submissionTerm, stepId, status, note) => {
    try {
      const year = academicYear;
      const term = submissionTerm;
      const collectionName = `loan_process_status_${year}_${term}`;
      const compositeKey = `${userId}_${year}_${term}`; // ใช้ composite key
      
      console.log(`===== UPDATE PROCESS STATUS DEBUG =====`);
      console.log(`User ID: ${userId}`);
      console.log(`Year: ${year}, Term: ${term}`);
      console.log(`Composite Key: ${compositeKey}`);
      console.log(`Collection: ${collectionName}`);
      console.log(`Step: ${stepId}, Status: ${status}`);
      
      // ตรวจสอบและสร้าง collection ถ้ายังไม่มี
      await ensureCollectionExists(collectionName);
      
      const processDocRef = doc(db, collectionName, userId);
      
      let currentStatus = processStatuses[compositeKey]; // ใช้ composite key
      
      // ถ้าไม่มี status เก่า หรือปี/เทอมไม่ตรง ให้สร้างใหม่
      if (!currentStatus || currentStatus.academicYear !== year || currentStatus.submissionTerm !== term) {
        currentStatus = {
          currentStep: 'document_collection',
          steps: {
            document_collection: { 
              status: 'pending', 
              updatedAt: null, 
              note: null 
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
          lastUpdatedAt: new Date().toISOString(),
          academicYear: year,
          submissionTerm: term
        };
        
        console.log(`Creating new process status for ${userId} in ${collectionName}`);
      } else {
        console.log(`Updating existing process status for ${userId}`);
      }

      const updatedSteps = {
        ...currentStatus.steps,
        [stepId]: {
          status,
          updatedAt: new Date().toISOString(),
          note: note || null
        }
      };

      let newCurrentStep = stepId;
      let newOverallStatus = 'processing';

      if (status === 'completed') {
        const stepIndex = processSteps.findIndex(step => step.id === stepId);
        if (stepIndex < processSteps.length - 1) {
          newCurrentStep = processSteps[stepIndex + 1].id;
        }
        
        const allCompleted = processSteps.every(step => 
          step.id === stepId ? true : updatedSteps[step.id]?.status === 'completed'
        );
        
        if (allCompleted) {
          newOverallStatus = 'completed';
          newCurrentStep = 'bank_submission';
        }
      }

      const updatedStatus = {
        ...currentStatus,
        currentStep: newCurrentStep,
        steps: updatedSteps,
        overallStatus: newOverallStatus,
        lastUpdatedAt: new Date().toISOString(),
        academicYear: year,
        submissionTerm: term,
        userId: userId // เก็บ userId ไว้ด้วย
      };

      console.log(`About to save to Firestore:`, {
        collection: collectionName,
        documentId: userId,
        data: updatedStatus
      });

      // ใช้ setDoc ด้วย merge: true เพื่อสร้างเอกสารใหม่ถ้ายังไม่มี
      await setDoc(processDocRef, updatedStatus, { merge: true });

      setProcessStatuses(prev => ({
        ...prev,
        [compositeKey]: updatedStatus
      }));

      console.log(`Successfully updated ${collectionName}/${userId}`);
      console.log(`===== END UPDATE DEBUG =====`);
      return true;
    } catch (error) {
      console.error("Error updating process status:", error);
      
      if (error.code) {
        console.error("Firebase error code:", error.code);
        console.error("Firebase error message:", error.message);
      }
      
      throw error;
    }
  };
  // ฟังก์ชันอัพเดทหลายคนพร้อมกัน
  const updateMultipleUsers = async (userSubmissions, stepId, status, note) => {
    try {
      const results = { success: [], failed: [] };

      for (const submission of userSubmissions) {
        try {
          await updateProcessStatus(
            submission.userId, 
            submission.academicYear, 
            submission.submissionTerm, 
            stepId, 
            status, 
            note
          );
          results.success.push(submission.userId);
        } catch (error) {
          results.failed.push({ userId: submission.userId, error: error.message });
        }
      }

      return results;
    } catch (error) {
      console.error("Error in bulk update:", error);
      throw error;
    }
  };

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
      const selectedSubmissions = filteredSubmissions.filter(sub => 
        selectedUsers.has(sub.userId)
      );
      
      const results = await updateMultipleUsers(
        selectedSubmissions,
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
    const user = users[submission.userId] || {};
    const userName = user.name || "";
    const studentId = submission.student_id || "";
    const citizenId = submission.citizen_id || "";

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = userName.toLowerCase().includes(searchLower) ||
                         studentId.toLowerCase().includes(searchLower) ||
                         citizenId.toLowerCase().includes(searchLower);

    let matchesYear = true;
    if (yearFilter === "all") {
      matchesYear = true;
    } else if (yearFilter === "current" && appConfig?.academicYear) {
      matchesYear = submission.academicYear === appConfig.academicYear;
    } else if (yearFilter !== "current") {
      matchesYear = submission.academicYear === yearFilter;
    }

    let matchesTerm = true;
    if (termFilter === "all") {
      matchesTerm = true;
    } else if (termFilter === "current" && appConfig?.term) {
      matchesTerm = submission.submissionTerm === appConfig.term;
    } else if (termFilter !== "current") {
      matchesTerm = submission.submissionTerm === termFilter;
    }

    let matchesStatus = true;
    if (statusFilter !== "all") {
      const compositeKey = `${submission.userId}_${submission.academicYear}_${submission.submissionTerm}`; // ใช้ composite key
      const userProcessStatus = processStatuses[compositeKey];
      const overallStatus = userProcessStatus?.overallStatus || 'processing';
      matchesStatus = overallStatus === statusFilter;
    }

    return matchesSearch && matchesYear && matchesTerm && matchesStatus;
  });

  const FilterSection = () => (
    <div style={styles.filterContainer}>
      <input
        type="text"
        placeholder="ค้นหาชื่อ, รหัสนักศึกษา, หรือเลขบัตรประชาชน..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={styles.input}
      />

      <select
        value={yearFilter}
        onChange={(e) => setYearFilter(e.target.value)}
        style={styles.select}
      >
        <option value="current">ปีการศึกษาปัจจุบัน ({appConfig?.academicYear})</option>
        <option value="all">ทุกปีการศึกษา</option>
        {availableYears.map(year => (
          <option key={year} value={year}>ปีการศึกษา {year}</option>
        ))}
      </select>

      <select
        value={termFilter}
        onChange={(e) => setTermFilter(e.target.value)}
        style={styles.select}
      >
        <option value="current">เทอมปัจจุบัน ({appConfig?.term})</option>
        <option value="all">ทุกเทอม</option>
        {availableTerms.map(term => (
          <option key={term} value={term}>เทอม {term}</option>
        ))}
      </select>

      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        style={styles.select}
      >
        <option value="all">ทุกสถานะ</option>
        <option value="processing">กำลังดำเนินการ</option>
        <option value="completed">เสร็จสิ้นทั้งหมด</option>
      </select>
    </div>
  );

  // เพิ่ม Current Term Badge Component
  const CurrentTermBadge = ({ submission }) => {
    const isCurrentTerm = submission.academicYear === appConfig?.academicYear && 
                         submission.submissionTerm === appConfig?.term;
    
    if (!isCurrentTerm) return null;
    
    return (
      <div style={styles.currentTermBadge}>
        เทอมปัจจุบัน
      </div>
    );
  };

  const ProcessStatusModal = ({ userSubmission, onClose }) => {
    const [stepStates, setStepStates] = useState({});
    
    // ใช้ข้อมูลจาก userSubmission โดยตรง
    const userId = userSubmission.userId;
    const compositeKey = `${userId}_${userSubmission.academicYear}_${userSubmission.submissionTerm}`;
    const userProcessStatus = processStatuses[compositeKey];

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
        await updateProcessStatus(
          userId, 
          userSubmission.academicYear, 
          userSubmission.submissionTerm, 
          stepId, 
          stepState.status, 
          stepState.note
        );
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
            <p style={{fontSize: 14, color: '#666'}}>
              ปีการศึกษา: {userSubmission.academicYear} เทอม: {userSubmission.submissionTerm}
            </p>
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
        ปีการศึกษาปัจจุบัน: <strong>{appConfig?.academicYear}</strong> เทอม: <strong>{appConfig?.term}</strong>
      </p>

      {/* ใช้ FilterSection เพียงครั้งเดียว */}
      <FilterSection />

      {/* สถิติการกรอง */}
      <div style={styles.statsContainer}>
        <div style={styles.statItem}>
          <span style={styles.statNumber}>{filteredSubmissions.length}</span>
          <span style={styles.statLabel}>รายการทั้งหมด</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statNumber}>
            {filteredSubmissions.filter(s => {
              const compositeKey = `${s.userId}_${s.academicYear}_${s.submissionTerm}`; // ใช้ composite key
              const userProcessStatus = processStatuses[compositeKey];
              return userProcessStatus?.overallStatus === 'processing' || !userProcessStatus;
            }).length}
          </span>
          <span style={styles.statLabel}>กำลังดำเนินการ</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statNumber}>
            {filteredSubmissions.filter(s => {
              const compositeKey = `${s.userId}_${s.academicYear}_${s.submissionTerm}`; // ใช้ composite key
              const userProcessStatus = processStatuses[compositeKey];
              return userProcessStatus?.overallStatus === 'completed';
            }).length}
          </span>
          <span style={styles.statLabel}>เสร็จสิ้นแล้ว</span>
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
          const compositeKey = `${submission.userId}_${submission.academicYear}_${submission.submissionTerm}`; // สร้าง composite key
          const userProcessStatus = processStatuses[compositeKey]; // ใช้ composite key
          const currentStep = processSteps.find(s => s.id === userProcessStatus?.currentStep);
          const overallStatus = userProcessStatus?.overallStatus || 'processing';
          const isSelected = selectedUsers.has(submission.userId);
          const isCurrentTerm = submission.academicYear === appConfig?.academicYear && 
                               submission.submissionTerm === appConfig?.term;

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
                ...(isSelected ? styles.userCardSelected : {}),
                ...(isCurrentTerm ? styles.currentTermCard : {})
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
                  <div>
                    <h3 style={styles.userName}>{user.name || "ไม่ระบุชื่อ"}</h3>
                    <CurrentTermBadge submission={submission} />
                  </div>
                  <div style={{
                    ...styles.statusBadge,
                    backgroundColor: overallStatus === 'completed' ? '#28a745' : '#ffc107'
                  }}>
                    {overallStatusOptions[overallStatus] || 'กำลังดำเนินการ'}
                  </div>
                </div>
              </div>

              <div style={styles.userInfo}>
                <p><strong>รหัสนักศึกษา:</strong> {submission.student_id}</p>
                <p><strong>เลขประจำตัวประชาชน:</strong> {submission.citizen_id}</p>
                <p><strong>ปีการศึกษา:</strong> {submission.academicYear}</p>
                <p><strong>เทอม:</strong> {submission.submissionTerm}</p>
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
                onClick={() => setSelectedUserData(submission)}
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

      {selectedUserData && (
        <ProcessStatusModal
          userSubmission={selectedUserData}
          onClose={() => setSelectedUserData(null)}
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
    gap: 15,
    marginBottom: 20,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  input: {
    padding: 12,
    fontSize: 16,
    border: "1px solid #ccc",
    borderRadius: 8,
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    minWidth: 300,
  },
  select: {
    padding: 12,
    fontSize: 16,
    border: "1px solid #ccc",
    borderRadius: 8,
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    backgroundColor: "#fff",
    minWidth: 150,
  },
  statsContainer: {
    display: "flex",
    gap: 20,
    marginBottom: 20,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  statItem: {
    background: "#f8f9fa",
    padding: 20,
    borderRadius: 12,
    textAlign: "center",
    minWidth: 120,
    border: "1px solid #e9ecef",
  },
  statNumber: {
    display: "block",
    fontSize: 28,
    fontWeight: "bold",
    color: "#007bff",
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: "#6c757d",
    fontWeight: "500",
  },
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
  currentTermCard: {
    border: "2px solid #1976d2",
    backgroundColor: "#f8fdff"
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
    alignItems: "flex-start",
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    margin: 0,
    marginBottom: 5,
  },
  currentTermBadge: {
    display: "inline-block",
    padding: "2px 8px",
    backgroundColor: "#1976d2",
    color: "white",
    fontSize: "11px",
    borderRadius: "10px",
    fontWeight: "bold"
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