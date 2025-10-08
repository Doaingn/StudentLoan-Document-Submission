import { useState, useEffect } from "react";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { db, auth } from "../../../database/firebase";

export const useFirebaseData = (
  setAppConfig,
  setAcademicYear,
  setTerm,
  setBirthDate,
  setUserAge,
  setVolunteerHours = () => {}
) => {
  const [configLoaded, setConfigLoaded] = useState(false);

  // Config Listener
  useEffect(() => {
    const configRef = doc(db, "DocumentService", "config");

    const configUnsubscribe = onSnapshot(
      configRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const config = docSnap.data();
          if (config) {
            setAppConfig(config);
            setAcademicYear(config.academicYear);
            setTerm(config.term);
          }
        } else {
          const defaultConfig = { academicYear: "2568", term: "1" };
          setAppConfig(defaultConfig);
          setAcademicYear(defaultConfig.academicYear);
          setTerm(defaultConfig.term);
        }
        setConfigLoaded(true);
      },
      (error) => {
        console.error("Error listening to app config:", error);
        setConfigLoaded(true);
      }
    );

    return () => configUnsubscribe();
  }, []);

  // Initialize loan history if not exists
  const initializeLoanHistory = async (userRef, currentYear, currentTerm) => {
    try {
      await updateDoc(userRef, {
        loanHistory: {
          currentPhase: "initial_application",
          phase1Approved: false,
          phase1ApprovedYear: null,
          disbursementSubmitted: false,
          disbursementApproved: false,
          firstApplicationYear: currentYear,
          firstApplicationTerm: currentTerm,
          lastPhase1ApprovedTerm: null,
          lastDisbursementSubmitTerm: null,
          lastDisbursementApprovedTerm: null,
          hasEverApplied: false,
          hasCompletedPhase1Ever: false // ใหม่: เช็คว่าเคยทำ Phase 1 แล้วหรือยัง
        }
      });
      
      return {
        currentPhase: "initial_application",
        phase1Approved: false,
        phase1ApprovedYear: null,
        disbursementSubmitted: false,
        disbursementApproved: false,
        firstApplicationYear: currentYear,
        firstApplicationTerm: currentTerm,
        lastPhase1ApprovedTerm: null,
        lastDisbursementSubmitTerm: null,
        lastDisbursementApprovedTerm: null,
        hasEverApplied: false,
        hasCompletedPhase1Ever: false
      };
    } catch (error) {
      console.error("Error initializing loan history:", error);
      return null;
    }
  };

  // ฟังก์ชันกำหนด Phase
const determinePhase = (loanHistory, currentTerm, currentYear) => {
  if (!loanHistory || typeof loanHistory !== 'object') {
    console.log("⚠️ loanHistory is null or invalid");
    return { phase: "initial_application", reason: "no_loan_history" };
  }

  console.log("🔍 Determining phase:", { 
    currentTerm,
    currentYear,
    hasCompletedPhase1Ever: loanHistory.hasCompletedPhase1Ever,
    phase1ApprovedYear: loanHistory.phase1ApprovedYear,
    lastDisbursementApprovedTerm: loanHistory.lastDisbursementApprovedTerm,
    disbursementApproved: loanHistory.disbursementApproved
  });
  
  // ✅ เช็คว่า disbursementApproved ของเทอมปัจจุบันหรือไม่
  const isCurrentTermApproved = 
    loanHistory.lastDisbursementApprovedTerm === currentTerm &&
    loanHistory.lastDisbursementApprovedYear === currentYear &&
    loanHistory.disbursementApproved === true;
  
  // ✅ ถ้าเอกสารเบิกเงินของเทอมปัจจุบันอนุมัติแล้ว → completed
  if (isCurrentTermApproved) {
    return { phase: "completed", reason: "current_term_approved" };
  }
  
  // ✅ เช็คว่าส่งเอกสารเบิกเงินของเทอมปัจจุบันแล้วหรือยัง
  const hasSubmittedCurrentTerm = 
    loanHistory.lastDisbursementSubmitTerm === currentTerm &&
    loanHistory.lastDisbursementSubmitYear === currentYear &&
    loanHistory.disbursementSubmitted === true;
  
  if (hasSubmittedCurrentTerm) {
    return { phase: "disbursement_pending", reason: "awaiting_approval" };
  }
  
  // ✅ เทอม 2/3 หรือปีถัดไป → ต้องอัพโหลดเอกสารเบิกเงิน
  if (currentTerm === "2" || currentTerm === "3") {
    return { phase: "disbursement", reason: "term_2_or_3" };
  }
  
  // ✅ เทอม 1 - เช็คว่าเคยทำ Phase 1 ไปแล้วหรือยัง
  if (currentTerm === "1") {
    // เช็คว่าปีการศึกษาเปลี่ยนหรือไม่
    const isNewYear = loanHistory.phase1ApprovedYear !== currentYear;
    
    // ✅ ถ้าเคยทำ Phase 1 ไปแล้วในอดีต (ไม่ว่าปีไหน) → ให้อัพโหลดเอกสารเบิกเงิน
    if (loanHistory.hasCompletedPhase1Ever === true) {
      console.log("✅ User has completed Phase 1 before → disbursement only");
      return { phase: "disbursement", reason: "term1_phase1_already_done_lifetime" };
    }
    
    // ✅ ถ้ายังไม่เคยทำ Phase 1 เลย → ต้องทำ Phase 1 ก่อน
    if (!loanHistory.hasCompletedPhase1Ever) {
      // เช็คว่าส่ง Phase 1 ไปแล้วหรือยัง
      if (loanHistory.currentPhase === "initial_application" && 
          !loanHistory.phase1Approved) {
        return { phase: "initial_application_pending", reason: "awaiting_phase1_approval" };
      }
      
      return { phase: "initial_application", reason: "first_time_applicant" };
    }
  }
  
  return { phase: "initial_application", reason: "fallback" };
};

  // ✅ ฟังก์ชัน loadUserData ที่ปรับปรุงแล้ว
  const loadUserData = async (currentConfig) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;

    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return handleNoUserData(currentConfig);
      }

      const userData = userDoc.data();
      const currentTerm = currentConfig.term;
      const currentYear = currentConfig.academicYear;
      
      let loanHistory = userData.loanHistory;
      
      if (!loanHistory) {
        loanHistory = await initializeLoanHistory(userRef, currentYear, currentTerm);
      }
      
      // ✅ กำหนด phase ตามเงื่อนไขที่ชัดเจน
      const { phase, reason } = determinePhase(loanHistory, currentTerm, currentYear);
      console.log(`✅ Determined phase: "${phase}" (reason: ${reason})`);
      
      // ✅ จัดการ birth_date
      const birthDateFromUser = userData.birth_date;
      setBirthDate(birthDateFromUser);

      if (birthDateFromUser) {
        const { calculateAge } = await import("../utils/helpers");
        const age = calculateAge(birthDateFromUser);
        setUserAge(age);
      }

      const volunteerHoursFromFirebase = userData.volunteerHours || 0;
      setVolunteerHours(volunteerHoursFromFirebase);

      // ✅ จัดการ uploads ตาม phase
      let uploadsToUse = {};
      
      // ถ้าเป็น disbursement phase และยังไม่ส่ง → ล้าง uploads เก่า
      if (phase === "disbursement" && !loanHistory.disbursementSubmitted) {
        console.log("🧹 Disbursement phase - clearing old uploads");
        await updateDoc(userRef, { 
          uploads: {},
          lastUpdated: new Date().toISOString()
        });
      } 
      // ถ้าส่งไปแล้ว หรือ pending → เก็บ uploads เดิม
      else if (phase === "disbursement_pending" || 
               phase === "initial_application_pending" ||
               phase === "completed") {
        uploadsToUse = userData.uploads || {};
      } 
      // Phase อื่นๆ
      else {
        const lastSubmissionTerm = userData.lastSubmissionTerm;
        if (lastSubmissionTerm === currentTerm && userData.uploads) {
          uploadsToUse = userData.uploads;
        }
      }

      // ✅ สร้าง surveyData ตาม phase
      if (phase === "disbursement" || 
          phase === "disbursement_pending" || 
          phase === "completed") {
        return {
          surveyData: { 
            term: currentTerm,
            phase: phase === "disbursement_pending" ? "disbursement" : phase,
            userId: currentUser.uid,
            loanHistory: loanHistory,
            birth_date: birthDateFromUser
          },
          surveyDocId: userDoc.id,
          uploads: uploadsToUse,
          volunteerHours: volunteerHoursFromFirebase,
        };
      }
      
      // Phase 1 - ต้องมี survey
      const surveyData = userData.survey;
      if (surveyData) {
        return {
          surveyData: { 
            ...surveyData, 
            term: currentTerm,
            phase: phase === "initial_application_pending" ? "initial_application" : phase,
            userId: currentUser.uid,
            loanHistory: loanHistory
          },
          surveyDocId: userDoc.id,
          uploads: uploadsToUse,
          volunteerHours: volunteerHoursFromFirebase,
        };
      } else {
        console.log("⚠️ Term 1 requires survey data but none found");
        return {
          surveyData: null,
          surveyDocId: null,
          uploads: {},
          volunteerHours: volunteerHoursFromFirebase,
        };
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      return {
        surveyData: null,
        surveyDocId: null,
        uploads: {},
        volunteerHours: 0,
      };
    }
  };

  const handleNoUserData = (currentConfig) => {
    const currentTerm = currentConfig.term;
    
    if (currentTerm === "2" || currentTerm === "3") {
      return {
        surveyData: { 
          term: currentTerm,
          phase: "disbursement"
        },
        surveyDocId: null,
        uploads: {},
        volunteerHours: 0,
      };
    } else {
      return {
        surveyData: null,
        surveyDocId: null,
        uploads: {},
        volunteerHours: 0,
      };
    }
  };

  return {
    configLoaded,
    loadUserData,
  };
};