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
          } else {
            console.warn("ไม่พบ config document");
          }
        } else {
          const defaultConfig = { academicYear: "2567", term: "1" };
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

  // Load user data with term checking
  const loadUserData = async (currentConfig) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;

    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        console.log("ไม่พบข้อมูล user");
        return handleNoUserData(currentConfig);
      }

      const userData = userDoc.data();
      
      // เช็คเทอมปัจจุบันกับเทอมที่ submit ล่าสุด
      const currentTerm = `${currentConfig.term}`;
      const lastSubmissionTerm = userData.lastSubmissionTerm;
      
      console.log(`📊 Current term: ${currentTerm}, Last submission term: ${lastSubmissionTerm}`);

      // ถ้าเทอมไม่ตรงกัน ให้ล้าง uploads
      let uploadsToUse = {};
      if (lastSubmissionTerm === currentTerm && userData.uploads) {
        uploadsToUse = userData.uploads;
        console.log(`✅ Loading uploads for current term ${currentTerm}`);
      } else {
        console.log(`🔄 Term changed or first upload - clearing uploads`);
        // ล้าง uploads ใน Firebase
        await updateDoc(userRef, {
          uploads: {},
        });
      }

      // ดึงชั่วโมงจิตอาสาจาก Firebase
      const volunteerHoursFromFirebase = userData.volunteerHours || 0;
      setVolunteerHours(volunteerHoursFromFirebase);
      console.log(`📊 Loaded volunteer hours from Firebase: ${volunteerHoursFromFirebase}`);

      // สำหรับเทอม 2/3: ไม่จำเป็นต้องมี survey data
      if (currentConfig.term === "2" || currentConfig.term === "3") {
        console.log(`🎓 Term ${currentConfig.term}: Setting up without survey requirement`);

        const birthDateFromUser = userData.birth_date;
        setBirthDate(birthDateFromUser);

        if (birthDateFromUser) {
          const { calculateAge } = await import("../utils/helpers");
          const age = calculateAge(birthDateFromUser);
          setUserAge(age);
          console.log(`👤 User age calculated: ${age} years`);
        }

        return {
          surveyData: { term: currentConfig.term },
          surveyDocId: userDoc.id,
          uploads: uploadsToUse,
          volunteerHours: volunteerHoursFromFirebase,
        };
      } else {
        // สำหรับเทอม 1: ต้องมี survey data
        const surveyData = userData.survey;
        if (surveyData) {
          const birthDateData = userData.birth_date;
          setBirthDate(birthDateData);

          if (birthDateData) {
            const { calculateAge } = await import("../utils/helpers");
            const age = calculateAge(birthDateData);
            setUserAge(age);
            console.log(`👤 User age calculated: ${age} years`);
          }

          return {
            surveyData: { ...surveyData, term: currentConfig.term },
            surveyDocId: userDoc.id,
            uploads: uploadsToUse,
            volunteerHours: volunteerHoursFromFirebase,
          };
        } else {
          console.log("❌ Term 1 requires survey data but none found");
          return {
            surveyData: null,
            surveyDocId: null,
            uploads: {},
            volunteerHours: volunteerHoursFromFirebase,
          };
        }
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

  // Helper function for when no user data exists
  const handleNoUserData = (currentConfig) => {
    if (currentConfig.term === "2" || currentConfig.term === "3") {
      console.log(`🎓 Term ${currentConfig.term}: Creating minimal data without survey requirement`);
      return {
        surveyData: { term: currentConfig.term },
        surveyDocId: null,
        uploads: {},
        volunteerHours: 0,
      };
    } else {
      console.log("❌ Term 1 requires user data but none found");
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
