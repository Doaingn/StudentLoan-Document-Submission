import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom"; 
import { db } from "./database/firebase";
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc,
  getDoc,
  setDoc
} from "firebase/firestore";
import { detectSubmissionPhase, areAllDocumentsApproved, getPhaseInfo } from './phaseDetection';

const StudentDocumentSubmission = () => {
  const [submissions, setSubmissions] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [appConfig, setAppConfig] = useState(null);
  
  const [yearFilter, setYearFilter] = useState("all");
  const [termFilter, setTermFilter] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [availableYears, setAvailableYears] = useState([]);
  const [availableTerms, setAvailableTerms] = useState([]);

  const [searchParams] = useSearchParams();
  const studentIdParam = searchParams.get('studentId');
  const yearParam = searchParams.get('year');
  const termParam = searchParams.get('term');
  
  const documentTypes = {
    'form_101': 'กยศ 101',
    'volunteer_doc': 'เอกสารจิตอาสา',
    'id_copies_student': 'สำเนาบัตรประชาชนนักศึกษา',
    'consent_student_form': 'หนังสือยินยอมเปิดเผยข้อมูลนักศึกษา',
    'consent_father_form': 'หนังสือยินยอมเปิดเผยข้อมูลบิดา',
    'id_copies_father': 'สำเนาบัตรประชาชนบิดา',
    'consent_mother_form': 'หนังสือยินยอมเปิดเผยข้อมูลมารดา',
    'id_copies_mother': 'สำเนาบัตรประชาชนมารดา',
    'guardian_consent': 'หนังสือยินยอมเปิดเผยข้อมูลผู้ปกครอง',
    'guardian_income_cert': 'หนังสือรับรองรายได้ผู้ปกครอง',
    'father_income_cert': 'หนังสือรับรองรายได้บิดา',
    'fa_id_copies_gov': 'สำเนาบัตรข้าราชการผู้รับรอง',
    'mother_income_cert': 'หนังสือรับรองรายได้มารดา',
    'ma_id_copies_gov': 'สำเนาบัตรข้าราชการผู้รับรอง',
    'single_parent_income_cert': 'หนังสือรับรองรายได้',
    'single_parent_income': 'หนังสือรับรองเงินเดือน',
    'famo_income_cert': 'หนังสือรับรองรายได้บิดามารดา',
    'famo_id_copies_gov': 'สำเนาบัตรข้าราชการผู้รับรอง',
    'family_status_cert': 'หนังสือรับรองสถานภาพครอบครัว',
    'father_income': 'หนังสือรับรองเงินเดือนบิดา',
    'mother_income': 'หนังสือรับรองเงินเดือนมารดา',
    'legal_status': 'สำเนาใบหย่า/สำเนาใบมรณะบัตร',
    'fam_id_copies_gov': 'สำเนาบัตรข้าราชการผู้รับรอง',
    '102_id_copies_gov': 'สำเนาบัตรข้าราชการผู้รับรอง',
    'guardian_id_copies': 'สำเนาบัตรประชาชนผู้ปกครอง',
    'guardian_income': 'หนังสือรับรองเงินเดือนผู้ปกครอง',
    'guar_id_copies_gov': 'สำเนาบัตรข้าราชการผู้รับรอง',
    'disbursement_form': 'แบบยืนยันการเบิกเงินกู้ยืม',
    'expense_burden_form': 'ใบภาระค่าใช้จ่ายทุน',
  };

  const statusOptions = {
    pending: "รอการตรวจสอบ",
    approved: "เอกสารถูกต้อง",
    rejected: "เอกสารไม่ถูกต้อง",
  };

  // ฟังก์ชันอนุมัติ Phase 1
  const updateLoanHistoryOnPhase1Approval = async (userId, academicYear, term) => {
    try {
      console.log("Approving Phase 1 for user:", userId);
      
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        "loanHistory.hasCompletedPhase1Ever": true,
        "loanHistory.phase1Approved": true,
        "loanHistory.lastPhase1ApprovedYear": academicYear,
        "loanHistory.lastPhase1ApprovedTerm": term,
        "loanHistory.currentPhase": "disbursement",
        "loanHistory.hasEverApplied": true,
        "loanHistory.firstApplicationYear": academicYear,
        "loanHistory.firstApplicationTerm": term
      });
      
      console.log("Phase 1 approved - User can now submit disbursement documents");
    } catch (error) {
      console.error("Error approving Phase 1:", error);
      throw error;
    }
  };

  // ฟังก์ชันอนุมัติเอกสารเบิกเงิน
  const updateLoanHistoryOnDisbursementApproval = async (userId, academicYear, term) => {
    try {
      console.log("Approving disbursement for user:", userId);
      
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        "loanHistory.disbursementSubmitted": true,
        "loanHistory.disbursementApproved": true,
        "loanHistory.lastDisbursementSubmitYear": academicYear,
        "loanHistory.lastDisbursementSubmitTerm": term,
        "loanHistory.lastDisbursementApprovedYear": academicYear,
        "loanHistory.lastDisbursementApprovedTerm": term
      });
      
      console.log("Disbursement approved for term:", term);
    } catch (error) {
      console.error("Error approving disbursement:", error);
      throw error;
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (yearParam && yearFilter !== yearParam) {
      setYearFilter(yearParam);
    }
    if (termParam && termFilter !== termParam) {
      setTermFilter(termParam);
    }
  }, [studentIdParam, yearParam, termParam]);

  useEffect(() => {
    if (studentIdParam && submissions.length > 0) {
      const initialSelection = submissions.find(sub => 
        sub.student_id === studentIdParam 
      );

      if (initialSelection) {
        setSelectedSubmission(initialSelection);
        setSearchTerm(initialSelection.student_id);
        
        if (typeof window !== 'undefined' && window.history) {
          window.history.replaceState(null, '', window.location.pathname); 
        }
      }
    }
  }, [submissions, studentIdParam]);

  const fetchAppConfig = async () => {
    try {
      const configRef = doc(db, "DocumentService", "config");
      const configDoc = await getDoc(configRef);

      if (configDoc.exists()) {
        const config = configDoc.data();
        setAppConfig(config);
        console.log("App config loaded:", config);
        return config;
      } else {
        const defaultConfig = {
          academicYear: "2568",
          term: "2",
          isEnabled: true,
        };
        setAppConfig(defaultConfig);
        return defaultConfig;
      }
    } catch (error) {
      console.error("Error fetching app config:", error);
      return null;
    }
  };

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
      return { years: [], terms: ['1', '2', '3'] };
    } catch (error) {
      console.error("Error fetching available periods:", error);
      return { years: [], terms: ['1', '2', '3'] };
    }
  };

  const fetchAllSubmissions = async () => {
    try {
      const { years, terms } = await fetchAvailablePeriods();
      
      if (years.length === 0) {
        console.log("No available periods found");
        setAvailableYears([]);
        setAvailableTerms(terms.sort());
        return [];
      }
      
      let allSubmissions = [];
      let allYears = new Set();
      let allTerms = new Set();

      for (const year of years) {
        for (const term of terms) {
          try {
            const submissionsRef = collection(db, `document_submissions_${year}_${term}`);
            const submissionsSnap = await getDocs(submissionsRef);
            
            if (!submissionsSnap.empty) {
              const yearTermSubmissions = [];
              
              for (const docSnap of submissionsSnap.docs) {
                const data = docSnap.data();
                const submissionData = { 
                  id: docSnap.id, 
                  ...data, 
                  academicYear: year,
                  submissionTerm: term,
                  uniqueId: `${year}_${term}_${docSnap.id}`
                };
                yearTermSubmissions.push(submissionData);
                allYears.add(year);
                allTerms.add(term);
              }

              allSubmissions = allSubmissions.concat(yearTermSubmissions);
            }
          } catch (error) {
            console.log(`Collection document_submissions_${year}_${term} not found`);
          }
        }
      }

      setAvailableYears(Array.from(allYears).sort().reverse());
      setAvailableTerms(Array.from(allTerms).sort());
      
      console.log(`Loaded ${allSubmissions.length} submissions from Firebase`);
      
      return allSubmissions;
    } catch (error) {
      console.error("Error fetching all submissions:", error);
      return [];
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const config = await fetchAppConfig();
      const submissionsData = await fetchAllSubmissions();

      const usersRef = collection(db, "users");
      const usersSnap = await getDocs(usersRef);
      const usersData = {};

      usersSnap.forEach((doc) => {
        usersData[doc.id] = doc.data();
      });

      setSubmissions(submissionsData);
      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateDocumentStatus = async (uniqueId, documentType, status, comments) => {
    try {
      console.log("🔧 Updating document:", documentType, "for uniqueId:", uniqueId);

      const submission = submissions.find((s) => s.uniqueId === uniqueId);
      
      if (!submission) {
        console.error("Submission not found for uniqueId:", uniqueId);
        alert("ไม่พบข้อมูลการส่งเอกสาร");
        return;
      }

      if (!submission.academicYear || !submission.submissionTerm) {
        console.error("Missing academicYear or submissionTerm:", submission);
        alert("ข้อมูลปีการศึกษาหรือเทอมไม่ครบถ้วน");
        return;
      }

      const collectionName = `document_submissions_${submission.academicYear}_${submission.submissionTerm}`;
      const docRef = doc(db, collectionName, submission.userId);
      
      const updateData = {
        [`documentStatuses.${documentType}.status`]: status,
        [`documentStatuses.${documentType}.comments`]: comments,
        [`documentStatuses.${documentType}.reviewedAt`]: new Date().toISOString(),
        [`documentStatuses.${documentType}.reviewedBy`]: "admin",
        lastUpdatedAt: new Date().toISOString()
      };

      console.log("Firestore update =>", collectionName, submission.userId, updateData);
      
      await updateDoc(docRef, updateData);

      // อัพเดท state หลังอัพเดท Firebase สำเร็จ
      const updatedSubmissions = submissions.map((sub) => {
        if (sub.uniqueId === uniqueId) {
          const updatedDocStatuses = {
            ...sub.documentStatuses,
            [documentType]: {
              ...(sub.documentStatuses?.[documentType] || {}),
              status,
              comments,
              reviewedAt: new Date().toISOString(),
              reviewedBy: "admin",
            },
          };

          return {
            ...sub,
            documentStatuses: updatedDocStatuses,
            lastUpdatedAt: new Date().toISOString()
          };
        }
        return sub;
      });

      setSubmissions(updatedSubmissions);
      alert(`อัปเดตสถานะ "${documentTypes[documentType] || documentType}" สำเร็จแล้ว`);

      const updatedSubmission = updatedSubmissions.find(s => s.uniqueId === uniqueId);
      if (updatedSubmission) {
        console.log("Checking phase after document update");
        await checkAndUpdateApplicationPhase(updatedSubmission.userId, updatedSubmission.documentStatuses, updatedSubmission);
      }

    } catch (error) {
      console.error("Error in updateDocumentStatus:", error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  const updateMultipleDocuments = async (uniqueId, documentTypes, status, comments) => {
    try {
      console.log("🔧 Bulk updating documents:", documentTypes, "for uniqueId:", uniqueId);

      const submission = submissions.find((s) => s.uniqueId === uniqueId);
      if (!submission) {
        console.error("Submission not found for uniqueId:", uniqueId);
        alert("ไม่พบข้อมูลการส่งเอกสาร");
        return;
      }

      if (!submission.academicYear || !submission.submissionTerm) {
        console.error("Missing academicYear or submissionTerm:", submission);
        alert("ข้อมูลปีการศึกษาหรือเทอมไม่ครบถ้วน");
        return;
      }

      // ใช้ userId เป็น document ID ใน Firestore
      const collectionName = `document_submissions_${submission.academicYear}_${submission.submissionTerm}`;
      const docRef = doc(db, collectionName, submission.userId);
      
      const updateData = {
        lastUpdatedAt: new Date().toISOString()
      };
      
      documentTypes.forEach((docType) => {
        updateData[`documentStatuses.${docType}.status`] = status;
        updateData[`documentStatuses.${docType}.comments`] = comments;
        updateData[`documentStatuses.${docType}.reviewedAt`] = new Date().toISOString();
        updateData[`documentStatuses.${docType}.reviewedBy`] = "admin";
      });

      console.log("Firestore batch update =>", collectionName, submission.userId, updateData);
      
      await updateDoc(docRef, updateData);

      const updatedSubmissions = submissions.map((sub) => {
        if (sub.uniqueId === uniqueId) {
          const newDocumentStatuses = { ...sub.documentStatuses };
          documentTypes.forEach((docType) => {
            newDocumentStatuses[docType] = {
              ...(newDocumentStatuses?.[docType] || {}),
              status,
              comments,
              reviewedAt: new Date().toISOString(),
              reviewedBy: "admin",
            };
          });

          return {
            ...sub,
            documentStatuses: newDocumentStatuses,
            lastUpdatedAt: new Date().toISOString()
          };
        }
        return sub;
      });

      setSubmissions(updatedSubmissions);
      alert(`อัปเดตเอกสาร ${documentTypes.length} รายการสำเร็จ`);

      const updatedSubmission = updatedSubmissions.find(s => s.uniqueId === uniqueId);
      if (updatedSubmission) {
        console.log("Checking phase after bulk document update");
        await checkAndUpdateApplicationPhase(updatedSubmission.userId, updatedSubmission.documentStatuses, updatedSubmission);
      }

    } catch (error) {
      console.error("Error in updateMultipleDocuments:", error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

const initializeLoanProcessStatus = async (userId, academicYear, term) => {
  try {
    const collectionName = `loan_process_status_${academicYear}_${term}`;
    const processDocRef = doc(db, collectionName, userId);
    
    console.log(`Creating loan process status in ${collectionName} for user: ${userId}`);
    
    const initialProcessStatus = {
      currentStep: 'document_collection',
      overallStatus: 'processing',
      steps: {
        document_collection: {
          status: 'pending',
          updatedAt: new Date().toISOString(),
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
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      academicYear: academicYear,
      submissionTerm: term
    };

    await setDoc(processDocRef, initialProcessStatus, { merge: true });
    
    console.log(`Successfully created/updated loan_process_status_${academicYear}_${term} for user: ${userId}`);
    
    return true;
  } catch (error) {
    console.error(`Error creating loan process status:`, error);
    
    if (error.code) {
      console.error("Firebase error code:", error.code);
      console.error("Firebase error message:", error.message);
    }
    
    throw error;
  }
};

const checkAndUpdateApplicationPhase = async (userId, updatedStatuses, submission) => {
  try {
    console.log("===== STARTING PHASE CHECK =====");
    console.log("User ID:", userId);
    console.log("Document Statuses:", updatedStatuses);

    if (!submission) {
      submission = submissions.find((s) => s.userId === userId);
    }
    if (!submission) {
      console.warn("Submission not found for userId:", userId);
      return;
    }

    const documentKeys = Object.keys(updatedStatuses || {});
    if (documentKeys.length === 0) {
      console.warn("No documentStatuses found for:", userId);
      return;
    }

    const allApproved = areAllDocumentsApproved(updatedStatuses);
    
    console.log("Total documents:", documentKeys.length);
    console.log("Are ALL documents approved?", allApproved);

    if (!allApproved) {
      console.log("NOT ALL DOCUMENTS APPROVED - STOPPING HERE");
      return;
    }

    console.log("ALL DOCUMENTS APPROVED - Proceeding with phase update");

    const phase = detectSubmissionPhase({ documentStatuses: updatedStatuses });
    console.log("Detected phase:", phase);

    if (!phase) {
      console.warn("Cannot determine phase for submission:", userId);
      return;
    }

    const currentYear = String(submission.academicYear);
    const currentTerm = String(submission.submissionTerm);

    console.log("Current year:", currentYear, "term:", currentTerm);

    // สร้าง loan process status เมื่อเอกสารอนุมัติครบ
    console.log(`Initializing loan process status for ${currentYear}_${currentTerm}`);
    await initializeLoanProcessStatus(userId, currentYear, currentTerm);

    if (phase === "initial_application") {
      console.log("ALL PHASE 1 DOCUMENTS APPROVED - Updating loan history");
      await updateLoanHistoryOnPhase1Approval(userId, currentYear, currentTerm);

      alert(
        `เอกสาร Phase 1 ผ่านการอนุมัติแล้ว!\n\n` +
        `ผู้กู้สามารถส่งเอกสารเบิกเงินได้\n\n` +
        `ชื่อ: ${users[userId]?.name || "ไม่ระบุ"}\n` +
        `รหัส: ${submission.student_id}\n` +
        `ปี: ${currentYear} เทอม: ${currentTerm}`
      );

      console.log("===== PHASE 1 UPDATE COMPLETED =====");
      return;
    }

    if (phase === "disbursement") {
      console.log("ALL DISBURSEMENT DOCUMENTS APPROVED - Updating loan history");
      await updateLoanHistoryOnDisbursementApproval(userId, currentYear, currentTerm);

      alert(
        `เอกสารเบิกเงินผ่านการอนุมัติแล้ว!\n\n` +
        `ชื่อ: ${users[userId]?.name || "ไม่ระบุ"}\n` +
        `รหัส: ${submission.student_id}\n` +
        `ปี: ${currentYear} เทอม: ${currentTerm}`
      );

      console.log("===== DISBURSEMENT UPDATE COMPLETED =====");
      return;
    }

    console.warn("Unknown phase type:", phase);
  } catch (error) {
    console.error("Error in checkAndUpdateApplicationPhase:", error);
    alert(`เกิดข้อผิดพลาดในการอนุมัติ Phase: ${error.message}`);
  }
};

  const filteredSubmissions = submissions.filter((submission) => {
    const user = users[submission.userId] || {};
    const userName = user.name || "";
    const studentId = submission.student_id || "";
    const citizenId = submission.citizen_id || "";

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = userName.toLowerCase().includes(searchLower) ||
                         studentId.toLowerCase().includes(searchLower) ||
                         citizenId.toLowerCase().includes(searchLower);

    const matchesYear = yearFilter === "all" || submission.academicYear === yearFilter;
    const matchesTerm = termFilter === "all" || submission.submissionTerm === termFilter;

    let matchesPhase = true;
    if (phaseFilter !== "all") {
      const phase = detectSubmissionPhase(submission);
      matchesPhase = phase === phaseFilter;
    }

    let matchesStatus = true;
    if (statusFilter !== "all") {
      matchesStatus = Object.values(submission.documentStatuses || {}).some(
        (doc) => doc.status === statusFilter
      );
    }

    return matchesSearch && matchesYear && matchesTerm && matchesPhase && matchesStatus;
  });

  const DocumentViewer = ({ submission, updateDocumentStatus, updateMultipleDocuments, users }) => {
    const [documentStates, setDocumentStates] = useState({});
    const [selectedDocuments, setSelectedDocuments] = useState(new Set());
    const [bulkStatus, setBulkStatus] = useState("pending");
    const [bulkComments, setBulkComments] = useState("");
    const [selectAll, setSelectAll] = useState(false);

    const initializeDocumentStates = () => {
      const states = {};
      Object.keys(submission.documentStatuses || {}).forEach((docType) => {
        const docStatus = submission.documentStatuses[docType];
        states[docType] = {
          status: docStatus.status || "pending",
          comments: docStatus.comments || "",
        };
      });
      setDocumentStates(states);
    };

    useEffect(() => {
      initializeDocumentStates();
    }, [submission]);

    const toggleDocumentSelection = (docType) => {
      const newSelected = new Set(selectedDocuments);
      if (newSelected.has(docType)) {
        newSelected.delete(docType);
      } else {
        newSelected.add(docType);
      }
      setSelectedDocuments(newSelected);
    };

    const toggleSelectAll = () => {
      if (selectAll) {
        setSelectedDocuments(new Set());
      } else {
        setSelectedDocuments(new Set(Object.keys(submission.documentStatuses || {})));
      }
      setSelectAll(!selectAll);
    };

    const handleBulkUpdate = async () => {
      if (selectedDocuments.size === 0) {
        alert("กรุณาเลือกเอกสารที่ต้องการอัพเดท");
        return;
      }

      if (window.confirm(`ต้องการอัพเดทสถานะของเอกสาร ${selectedDocuments.size} รายการหรือไม่?`)) {
        try {
          await updateMultipleDocuments(
            submission.uniqueId,
            Array.from(selectedDocuments),
            bulkStatus,
            bulkComments
          );
          
          initializeDocumentStates();
          setSelectedDocuments(new Set());
          setSelectAll(false);
          setBulkComments("");
          
          alert("อัพเดทสถานะเรียบร้อยแล้ว");
        } catch (error) {
          alert("เกิดข้อผิดพลาด");
        }
      }
    };

    const handleStatusChange = (docType, newStatus) => {
      setDocumentStates((prev) => ({
        ...prev,
        [docType]: { ...prev[docType], status: newStatus },
      }));
    };

    const handleCommentsChange = (docType, comments) => {
      setDocumentStates((prev) => ({
        ...prev,
        [docType]: { ...prev[docType], comments },
      }));
    };

    const handleSave = async (docType) => {
      const state = documentStates[docType];
      await updateDocumentStatus(
        submission.uniqueId,
        docType,
        state.status,
        state.comments
      );
    };

    const phase = detectSubmissionPhase(submission);
    const phaseInfo = getPhaseInfo(phase);

    return (
      <div style={styles.container}>
        <button onClick={() => setSelectedSubmission(null)} style={styles.backButton}>
          ← กลับไปหน้าหลัก
        </button>

        <h2 style={styles.header}>
          เอกสารของ {users[submission.userId]?.name || "ไม่ระบุชื่อ"}
        </h2>

        <div style={{...styles.phaseBadge, backgroundColor: phaseInfo.color}}>
          {phaseInfo.label}
        </div>

        <div style={styles.bulkControls}>
          <h3>จัดการหลายเอกสารพร้อมกัน</h3>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={selectAll}
              onChange={toggleSelectAll}
              style={styles.checkbox}
            />
            เลือกทั้งหมด ({selectedDocuments.size} รายการ)
          </label>
          
          {selectedDocuments.size > 0 && (
            <div style={styles.bulkActionsContainer}>
              <div style={styles.bulkInputsRow}>
                <div>
                  <label>กำหนดสถานะ:</label>
                  <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} style={styles.select}>
                    <option value="pending">รอการตรวจสอบ</option>
                    <option value="approved">เอกสารถูกต้อง</option>
                    <option value="rejected">เอกสารไม่ถูกต้อง</option>
                  </select>
                </div>
                <div style={styles.bulkCommentsContainer}>
                  <label>หมายเหตุ:</label>
                  <textarea
                    value={bulkComments}
                    onChange={(e) => setBulkComments(e.target.value)}
                    style={styles.textarea}
                    rows={2}
                  />
                </div>
              </div>
              <button onClick={handleBulkUpdate} style={styles.bulkUpdateButton}>
                อัพเดทเอกสาร {selectedDocuments.size} รายการ
              </button>
            </div>
          )}
        </div>

        <div style={styles.documentsGrid}>
          {Object.keys(submission.documentStatuses || {}).map((docType) => {
            const docData = submission.documentStatuses[docType];
            const uploads = submission.uploads?.[docType] || [];
            const currentState = documentStates[docType] || { status: "pending", comments: "" };
            const isSelected = selectedDocuments.has(docType);

            return (
              <div key={docType} style={{...styles.documentCard, ...(isSelected ? styles.documentCardSelected : {})}}>
                <div style={styles.documentHeader}>
                  <label style={styles.documentCheckboxLabel}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleDocumentSelection(docType)}
                      style={styles.checkbox}
                    />
                    <h3 style={styles.documentTitle}>{documentTypes[docType] || docType}</h3>
                  </label>
                </div>

                <div style={styles.documentInfo}>
                  <p>จำนวนไฟล์: {docData.fileCount || 0}</p>
                  <p>สถานะ: <span style={{
                    color: currentState.status === "approved" ? "green" : 
                           currentState.status === "rejected" ? "red" : "orange",
                    fontWeight: "bold"
                  }}>
                    {statusOptions[currentState.status]}
                  </span></p>
                </div>

                {uploads.length > 0 && (
                  <div style={styles.filesList}>
                    <h4>ไฟล์ที่อัพโหลด:</h4>
                    {uploads.map((file, index) => (
                      <div key={index} style={styles.fileItem}>
                        {file.mimeType?.startsWith("image/") ? (
                          <div style={styles.imageContainer}>
                            <img
                              src={file.downloadURL}
                              alt={file.originalFileName}
                              style={styles.imagePreview}
                              onClick={() => window.open(file.downloadURL, "_blank")}
                            />
                            <div style={styles.fileName}>
                              {file.originalFileName}
                            </div>
                          </div>
                        ) : file.mimeType === "application/pdf" ? (
                          <div style={styles.pdfContainer}>
                            <iframe
                              src={file.downloadURL}
                              title={file.originalFileName}
                              style={styles.pdfPreview}
                            />
                            <div style={styles.fileName}>{file.originalFileName}</div>
                          </div>
                        ) : (
                          <a href={file.downloadURL} target="_blank" rel="noopener noreferrer" style={styles.documentLink}>
                            📎 {file.originalFileName}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div style={styles.statusControls}>
                  <label style={styles.label}>เปลี่ยนสถานะ:</label>
                  <select
                    value={currentState.status}
                    onChange={(e) => handleStatusChange(docType, e.target.value)}
                    style={styles.select}
                  >
                    <option value="pending">รอการตรวจสอบ</option>
                    <option value="approved">เอกสารถูกต้อง</option>
                    <option value="rejected">เอกสารไม่ถูกต้อง</option>
                  </select>

                  <label style={styles.label}>หมายเหตุ:</label>
                  <textarea
                    value={currentState.comments}
                    onChange={(e) => handleCommentsChange(docType, e.target.value)}
                    style={styles.textarea}
                    placeholder="ใส่หมายเหตุ (ถ้ามี)"
                    rows={3}
                  />

                  <button onClick={() => handleSave(docType)} style={styles.saveButton}>
                    บันทึกการเปลี่ยนแปลง
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div style={styles.loadingText}>กำลังโหลดข้อมูล...</div>;
  }

  if (selectedSubmission) {
    return (
      <DocumentViewer 
        submission={selectedSubmission} 
        updateDocumentStatus={updateDocumentStatus}
        updateMultipleDocuments={updateMultipleDocuments}
        users={users}
      />
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>ระบบตรวจสอบเอกสารนักศึกษา</h1>

      <div style={styles.filterContainer}>
        <input
          type="text"
          placeholder="ค้นหาชื่อ, รหัสนักศึกษา, หรือเลขบัตรประชาชน..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.input}
        />

        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} style={styles.select}>
          <option value="all">ทุกปีการศึกษา</option>
          {availableYears.map(year => (
            <option key={year} value={year}>ปีการศึกษา {year}</option>
          ))}
        </select>

        <select value={termFilter} onChange={(e) => setTermFilter(e.target.value)} style={styles.select}>
          <option value="all">ทุกเทอม</option>
          {availableTerms.map(term => (
            <option key={term} value={term}>เทอม {term}</option>
          ))}
        </select>

        <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} style={styles.select}>
          <option value="all">ทุก Phase</option>
          <option value="initial_application">Phase 1: ยื่นกู้ครั้งแรก</option>
          <option value="disbursement">Phase 2: เบิกเงิน</option>
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.select}>
          <option value="pending">รอการตรวจสอบ</option>
          <option value="approved">เอกสารถูกต้อง</option>
          <option value="rejected">เอกสารไม่ถูกต้อง</option>
          <option value="all">ทุกสถานะ</option>
        </select>
      </div>

      <div style={styles.statsContainer}>
        <div style={styles.statItem}>
          <span style={styles.statNumber}>{filteredSubmissions.length}</span>
          <span style={styles.statLabel}>รายการทั้งหมด</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statNumber}>
            {filteredSubmissions.filter(s => 
              Object.values(s.documentStatuses || {}).some(doc => doc.status === 'pending')
            ).length}
          </span>
          <span style={styles.statLabel}>รอตรวจสอบ</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statNumber}>
            {filteredSubmissions.filter(s => 
              Object.values(s.documentStatuses || {}).every(doc => doc.status === 'approved')
            ).length}
          </span>
          <span style={styles.statLabel}>ผ่านทั้งหมด</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statNumber}>
            {filteredSubmissions.filter(s => 
              Object.values(s.documentStatuses || {}).some(doc => doc.status === 'rejected')
            ).length}
          </span>
          <span style={styles.statLabel}>มีเอกสารไม่ผ่าน</span>
        </div>
      </div>

      <div style={styles.postsContainer}>
        {filteredSubmissions.map((submission) => {
          const user = users[submission.userId] || {};
          const phase = detectSubmissionPhase(submission);
          const phaseInfo = getPhaseInfo(phase);
          const totalDocuments = Object.keys(submission.documentStatuses || {}).length;
          const approvedDocuments = Object.values(submission.documentStatuses || {})
            .filter((doc) => doc.status === "approved").length;
          const rejectedDocuments = Object.values(submission.documentStatuses || {})
            .filter((doc) => doc.status === "rejected").length;
          const pendingDocuments = totalDocuments - approvedDocuments - rejectedDocuments;

          return (
            <div key={submission.id} style={styles.postCard} onClick={() => setSelectedSubmission(submission)}>
              <div style={{...styles.phaseBadgeSmall, backgroundColor: phaseInfo.color}}>
                {phaseInfo.label}
              </div>
              
              <h3 style={styles.postTitle}>{user.name || "ไม่ระบุชื่อ"}</h3>

              <div style={styles.postDescription}>
                <p style={styles.infoLine}><strong>รหัสนักศึกษา:</strong> {submission.student_id}</p>
                <p style={styles.infoLine}><strong>เลขบัตรประชาชน:</strong> {submission.citizen_id}</p>
                <p style={styles.infoLine}><strong>ปีการศึกษา:</strong> {submission.academicYear}</p>
                <p style={styles.infoLine}><strong>เทอม:</strong> {submission.submissionTerm}</p>
                <p style={styles.infoLine}>
                  <strong>วันที่ส่ง:</strong> {new Date(submission.submittedAt).toLocaleDateString("th-TH")}
                </p>

                <div style={styles.statusSummary}>
                  <div style={{...styles.statusBadge, backgroundColor: "#28a745"}}>
                    ถูกต้อง: {approvedDocuments}
                  </div>
                  <div style={{...styles.statusBadge, backgroundColor: "#dc3545"}}>
                    ไม่ถูกต้อง: {rejectedDocuments}
                  </div>
                  <div style={{...styles.statusBadge, backgroundColor: "#ffc107"}}>
                    รอตรวจ: {pendingDocuments}
                  </div>
                </div>
              </div>

              <p style={styles.clickText}>คลิกเพื่อดูรายละเอียดเอกสาร</p>
            </div>
          );
        })}
      </div>

      {filteredSubmissions.length === 0 && (
        <div style={styles.loadingText}>ไม่พบข้อมูลการส่งเอกสาร</div>
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
  },
  header: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 30,
    textAlign: "center",
  },
  filterContainer: {
    display: "flex",
    gap: 15,
    marginBottom: 20,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  input: {
    padding: 12,
    fontSize: 16,
    border: "1px solid #ccc",
    borderRadius: 8,
    minWidth: 300,
  },
  select: {
    padding: 12,
    fontSize: 16,
    border: "1px solid #ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
    minWidth: 150,
  },
  statsContainer: {
    display: "flex",
    gap: 20,
    marginBottom: 30,
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
  phaseBadge: {
    display: 'inline-block',
    padding: '8px 16px',
    borderRadius: 20,
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center'
  },
  phaseBadgeSmall: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: 12,
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 10
  },
  loadingText: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    padding: 20,
  },
  postsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 20,
  },
  postCard: {
    background: "#fff",
    padding: 15,
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    border: "1px solid #e0e0e0",
    cursor: "pointer",
    transition: "transform 0.2s",
  },
  postTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
    textAlign: "center",
  },
  postDescription: {
    fontSize: 13,
    color: "#555",
    marginBottom: 10,
  },
  infoLine: {
    margin: "5px 0",
    fontSize: 12,
  },
  statusSummary: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    margin: "10px 0",
  },
  statusBadge: {
    padding: "3px 8px",
    borderRadius: 12,
    color: "white",
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
  },
  clickText: {
    fontSize: 11,
    color: "#777",
    fontStyle: "italic",
    textAlign: "center",
  },
  backButton: {
    padding: "10px 20px",
    fontSize: 16,
    backgroundColor: "#6c757d",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    marginBottom: 20,
  },
  bulkControls: {
    background: "#f8f9fa",
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
    border: "2px solid #e9ecef",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    fontSize: 16,
    fontWeight: "bold",
    cursor: "pointer",
  },
  checkbox: {
    marginRight: 8,
    width: 16,
    height: 16,
    cursor: "pointer",
  },
  bulkActionsContainer: {
    background: "#fff",
    padding: 20,
    borderRadius: 8,
    marginTop: 15,
  },
  bulkInputsRow: {
    display: "flex",
    gap: 20,
    marginBottom: 15,
    flexWrap: "wrap",
  },
  bulkCommentsContainer: {
    flex: 1,
    minWidth: 300,
  },
  bulkUpdateButton: {
    padding: "12px 24px",
    fontSize: 16,
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold",
  },
  documentsGrid: {
    display: "grid",
    gap: 20,
    gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
  },
  documentCard: {
    background: "#fff",
    padding: 20,
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    border: "1px solid #e0e0e0",
  },
  documentCardSelected: {
    border: "2px solid #007bff",
    boxShadow: "0 6px 16px rgba(0,123,255,0.2)",
  },
  documentHeader: {
    marginBottom: 15,
  },
  documentCheckboxLabel: {
    display: "flex",
    alignItems: "flex-start",
    cursor: "pointer",
    gap: 10,
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    margin: 0,
  },
  documentInfo: {
    marginBottom: 15,
    fontSize: 14,
    color: "#666",
  },
  filesList: {
    marginBottom: 20,
  },
  fileItem: {
    marginBottom: 20,
  },
  imageContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  imagePreview: {
    width: 120,
    height: 120,
    objectFit: "cover",
    borderRadius: 8,
    border: "1px solid #ddd",
    cursor: "pointer",
  },
  pdfContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: 15,
  },
  pdfPreview: {
    width: "100%",
    height: 400,
    border: "none",
  },
  fileName: {
    fontSize: 14,
    color: "#3b82f6",
    marginTop: 8,
    textAlign: "center",
  },
  documentLink: {
    fontSize: 16,
    color: "#3b82f6",
    textDecoration: "none",
  },
  statusControls: {
    borderTop: "1px solid #eee",
    paddingTop: 15,
  },
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
    marginTop: 10,
  },
  textarea: {
    width: "100%",
    padding: 8,
    fontSize: 14,
    border: "1px solid #ccc",
    borderRadius: 4,
    resize: "vertical",
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
  },
};

export default StudentDocumentSubmission;