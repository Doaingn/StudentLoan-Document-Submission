import { useState, useEffect } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../../database/firebase";

export const useFirebaseData = (
  setAppConfig,
  setAcademicYear,
  setTerm,
  setBirthDate,
  setUserAge,
  setVolunteerHours = () => {} // เพิ่ม parameter นี้
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

  // Load user data
  const loadUserData = async (currentConfig) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;

    try {
      const userSurveyRef = doc(db, "users", currentUser.uid);
      const userSurveyDoc = await getDoc(userSurveyRef);

      if (userSurveyDoc.exists()) {
        const userData = userSurveyDoc.data();

        // ดึงชั่วโมงจิตอาสาจาก Firebase
        const volunteerHoursFromFirebase = userData.volunteerHours || 0;
        setVolunteerHours(volunteerHoursFromFirebase);
        console.log(
          `📊 Loaded volunteer hours from Firebase: ${volunteerHoursFromFirebase}`
        );

        // สำหรับเทอม 2/3: ไม่จำเป็นต้องมี survey data
        if (currentConfig.term === "2" || currentConfig.term === "3") {
          console.log(
            `🎓 Term ${currentConfig.term}: Setting up without survey requirement`
          );

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
            surveyDocId: userSurveyDoc.id,
            uploads: userData.uploads || {},
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
              surveyDocId: userSurveyDoc.id,
              uploads: userData.uploads || {},
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
      } else {
        // ไม่พบข้อมูล user
        if (currentConfig.term === "2" || currentConfig.term === "3") {
          console.log(
            `🎓 Term ${currentConfig.term}: Creating minimal data without survey requirement`
          );
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

  return {
    configLoaded,
    loadUserData,
  };
};
