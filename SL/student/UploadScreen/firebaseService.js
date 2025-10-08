import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  deleteField,
  collection,
  addDoc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "../../../database/firebase";

// Save uploads to Firebase
export const saveUploadsToFirebase = async (uploadsData) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      uploads: uploadsData,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error saving uploads to Firebase:", error);
    throw error;
  }
};

// Delete survey data
export const deleteSurveyData = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  try {
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      survey: deleteField(),
      uploads: deleteField(),
    });
  } catch (error) {
    console.error("Error deleting survey data: ", error);
    throw error;
  }
};

// Update loan history when Phase 1 is submitted
export const updateLoanHistoryOnPhase1Submit = async (academicYear, term) => {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  try {
    const userRef = doc(db, "users", currentUser.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) return;
    
    const userData = userDoc.data();
    const loanHistory = userData.loanHistory || {};
    
    await updateDoc(userRef, {
      "loanHistory.currentPhase": "initial_application",
      "loanHistory.hasEverApplied": true,
      "loanHistory.firstApplicationYear": loanHistory.firstApplicationYear || academicYear,
      "loanHistory.firstApplicationTerm": loanHistory.firstApplicationTerm || term,
    });
    
    console.log("✅ Updated loan history for Phase 1 submission");
  } catch (error) {
    console.error("Error updating loan history on Phase 1 submit:", error);
    throw error;
  }
};

// Update loan history when Phase 1 is approved (เจ้าหน้าที่เรียกใช้)
export const updateLoanHistoryOnPhase1Approval = async (userId, academicYear, term) => {
  try {
    const userRef = doc(db, "users", userId);
    
    await updateDoc(userRef, {
      "loanHistory.currentPhase": "disbursement",
      "loanHistory.phase1Approved": true,
      "loanHistory.lastPhase1ApprovedYear": academicYear,
      "loanHistory.lastPhase1ApprovedTerm": term,
      // ✅ รีเซ็ตสถานะ disbursement สำหรับการส่งใหม่
      "loanHistory.disbursementSubmitted": false,
      "loanHistory.disbursementApproved": false,
    });
    
    console.log("✅ Updated loan history - Phase 1 approved, ready for disbursement");
  } catch (error) {
    console.error("Error updating loan history on Phase 1 approval:", error);
    throw error;
  }
};

// Update loan history when Disbursement is submitted
export const updateLoanHistoryOnDisbursementSubmit = async (academicYear, term) => {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  try {
    const userRef = doc(db, "users", currentUser.uid);
    
    await updateDoc(userRef, {
      "loanHistory.disbursementSubmitted": true,
      "loanHistory.currentPhase": "disbursement",
      "loanHistory.lastDisbursementSubmitYear": academicYear,
      "loanHistory.lastDisbursementSubmitTerm": term,
    });
    
    console.log("Updated loan history for Disbursement submission");
  } catch (error) {
    console.error("Error updating loan history on Disbursement submit:", error);
    throw error;
  }
};

export const updateLoanHistoryOnDisbursementApproval = async (userId, academicYear, term) => {
  try {
    const userRef = doc(db, "users", userId);
    
    await updateDoc(userRef, {
      "loanHistory.currentPhase": "completed",
      "loanHistory.disbursementApproved": true,
      "loanHistory.lastDisbursementApprovedYear": academicYear,
      "loanHistory.lastDisbursementApprovedTerm": term,
    });
    
    console.log("Updated loan history - Disbursement approved");
  } catch (error) {
    console.error("Error updating loan history on Disbursement approval:", error);
    throw error;
  }
};

// Reset loan history for new academic year
export const resetLoanHistoryForNewYear = async (newYear, newTerm) => {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  try {
    const userRef = doc(db, "users", currentUser.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) return;
    
    const userData = userDoc.data();
    const loanHistory = userData.loanHistory || {};
    
    // เก็บประวัติว่าเคยยื่นกู้มาก่อน
    const hasEverApplied = loanHistory.hasEverApplied || false;
    const firstYear = loanHistory.firstApplicationYear;
    const firstTerm = loanHistory.firstApplicationTerm;
    
    await updateDoc(userRef, {
      "loanHistory.currentPhase": "initial_application",
      "loanHistory.phase1Approved": false,
      "loanHistory.hasEverApplied": hasEverApplied,
      "loanHistory.firstApplicationYear": firstYear,
      "loanHistory.firstApplicationTerm": firstTerm,
    });
    
    console.log("✅ Reset loan history for new academic year");
  } catch (error) {
    console.error("Error resetting loan history:", error);
    throw error;
  }
};

// Check submission status
export const checkSubmissionStatus = async (appConfig, navigation) => {
  const currentUser = auth.currentUser;
  if (!currentUser) return false;

  const currentConfig = appConfig || { academicYear: "2567", term: "1" };
  const termCollectionName = `document_submissions_${currentConfig.academicYear}_${currentConfig.term}`;

  console.log(`🔍 Checking submission for collection: ${termCollectionName}`);

  const submissionRef = doc(db, termCollectionName, currentUser.uid);
  const submissionDoc = await getDoc(submissionRef);

  if (submissionDoc.exists()) {
    console.log("✅ Found existing submission, redirecting to status screen");
    navigation.replace("DocumentStatusScreen", {
      submissionData: submissionDoc.data(),
    });
    return true;
  }

  console.log("🔍 No submission found, loading upload screen");
  return false;
};

// Submit documents to Firebase
export const submitDocumentsToFirebase = async (
  submissionData,
  academicYear,
  term
) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No authenticated user found");
    }

    // ✅ บันทึกไปที่ collection ที่ถูกต้องตามเทอม
    const submissionRef = doc(
      db,
      `document_submissions_${academicYear}_${term}`,
      currentUser.uid
    );

    const phase = submissionData.phase || submissionData.surveyData?.phase;

    console.log(`📤 Submitting documents:`, {
      collection: `document_submissions_${academicYear}_${term}`,
      userId: currentUser.uid,
      phase,
      documentCount: Object.keys(submissionData.uploads || {}).length
    });

    await setDoc(submissionRef, submissionData);

    const userRef = doc(db, "users", currentUser.uid);
    
    // ✅ อัพเดทข้อมูลพื้นฐาน
    await updateDoc(userRef, {
      lastSubmissionAt: new Date().toISOString(),
      hasSubmittedDocuments: true,
      uploads: submissionData.uploads || {},
      lastSubmissionTerm: `${term}`,
      lastAcademicYear: academicYear,
    });
    
    // ✅ อัพเดท loan history ตาม phase
    if (phase === "initial_application") {
      console.log("📝 Updating Phase 1 submission status");
      await updateDoc(userRef, {
        "loanHistory.currentPhase": "initial_application",
        "loanHistory.hasEverApplied": true,
        "loanHistory.firstApplicationYear": academicYear,
        "loanHistory.firstApplicationTerm": term,
        "loanHistory.phase1Submitted": true,
        "loanHistory.lastPhase1SubmitTerm": term,
        "loanHistory.lastPhase1SubmitYear": academicYear,
      });
    } 
    else if (phase === "disbursement") {
      console.log("💰 Updating disbursement submission status");
      await updateDoc(userRef, {
        "loanHistory.disbursementSubmitted": true,
        "loanHistory.currentPhase": "disbursement",
        "loanHistory.lastDisbursementSubmitYear": academicYear,
        "loanHistory.lastDisbursementSubmitTerm": term,
      });
    }

    console.log(`✅ Successfully submitted to document_submissions_${academicYear}_${term}`);
    return true;
  } catch (error) {
    console.error("❌ Error submitting documents:", error);
    throw error;
  }
};