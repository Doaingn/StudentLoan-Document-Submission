import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  orderBy,
  limitToLast,
} from "firebase/firestore";
import { db, auth } from "../../../database/firebase";
import {
  validateDocument,
  showValidationAlert,
  checkAIBackendStatus,
  needsAIValidation,
} from "../documents_ai/UnifiedDocumentAI";

// ฟังก์ชันสำหรับบันทึกชั่วโมงจิตอาสาลง Firebase
export const saveVolunteerHoursToFirebase = async (totalHours, appConfig) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error("No authenticated user found");
      return false;
    }

    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      volunteerHours: totalHours,
      volunteerHoursUpdatedAt: new Date().toISOString(),
      academicYear: appConfig?.academicYear || null,
      term: appConfig?.term || null,
    });

    console.log(`✅ Volunteer hours saved to Firebase: ${totalHours} hours`);
    return true;
  } catch (error) {
    console.error("❌ Error saving volunteer hours to Firebase:", error);
    return false;
  }
};

// ฟังก์ชันตรวจสอบไฟล์ซ้ำ
export const checkDuplicateVolunteerFile = async (file, existingFiles) => {
  try {
    // ตรวจสอบจากชื่อไฟล์และขนาด
    const isDuplicate = existingFiles.some(
      (existingFile) =>
        existingFile.filename === file.filename &&
        existingFile.size === file.size
    );

    if (isDuplicate) {
      console.log("❌ Duplicate file detected:", file.filename);
      return true;
    }

    // ตรวจสอบจาก content hash (เพิ่มเติม)
    const FileSystem = await import("expo-file-system/legacy");
    const fileInfo = await FileSystem.getInfoAsync(file.uri);

    if (fileInfo.exists) {
      // สร้าง hash จาก URI และขนาดไฟล์ (แบบง่าย)
      const fileHash = `${file.uri}_${file.size}`;

      const contentDuplicate = existingFiles.some((existingFile) => {
        const existingHash = `${existingFile.uri}_${existingFile.size}`;
        return existingHash === fileHash;
      });

      return contentDuplicate;
    }

    return false;
  } catch (error) {
    console.error("Error checking duplicate file:", error);
    return false;
  }
};

// Save AI validation result to Firebase
export const saveAIValidationResult = async (validationData) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error("No authenticated user found");
      return null;
    }

    // สร้าง validation result object
    const validationResult = {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      documentType: validationData.documentType,
      fileName: validationData.fileName,
      fileUri: validationData.fileUri,
      mimeType: validationData.mimeType,
      validatedAt: new Date().toISOString(),

      // ข้อมูลผลการตรวจสอบ AI
      aiResult: {
        isValid: validationData.aiResult.isValid || false,
        confidence: validationData.aiResult.confidence || 0,
        overall_status: validationData.aiResult.overall_status || "unknown",

        // ข้อมูลที่แยกออกได้จากเอกสาร
        extractedData: validationData.aiResult.extractedData || {},

        // ข้อมูลการรับรองสำเนา (สำหรับ ID Card)
        certificationInfo: validationData.aiResult.certificationInfo || {},

        // ข้อมูลคุณภาพเอกสาร
        imageQuality: validationData.aiResult.imageQuality || "unknown",

        // ปัญหาที่พบ
        qualityIssues: validationData.aiResult.qualityIssues || [],

        // คำแนะนำ
        recommendations: validationData.aiResult.recommendations || [],

        // ข้อมูลเฉพาะตามประเภทเอกสาร
        documentSpecificData:
          validationData.aiResult.documentSpecificData || {},

        // สำหรับเอกสารจิตอาสา
        ...(validationData.documentType === "volunteer_doc" && {
          accumulatedHours: validationData.aiResult.accumulatedHours || 0,
          volunteerActivities:
            validationData.aiResult.volunteerActivities || [],
        }),

        // ข้อมูล AI backend ที่ใช้
        aiBackendInfo: {
          method: validationData.aiBackendInfo?.method || "unknown",
          model: validationData.aiBackendInfo?.model || "unknown",
          backendUrl: validationData.aiBackendInfo?.backendUrl || null,
        },
      },

      // ข้อมูล academic context
      academicYear: validationData.academicYear || null,
      term: validationData.term || null,

      // สถานะการใช้งาน
      userAction: "accepted",

      // Metadata
      metadata: {
        appVersion: "1.0.0",
        platform: "react-native",
        validationTimestamp: Date.now(),
      },
    };

    // เก็บลงใน collection "ai_validation_results"
    const validationRef = await addDoc(
      collection(db, "ai_validation_results"),
      validationResult
    );

    console.log("✅ AI validation result saved with ID:", validationRef.id);

    // อัพเดตข้อมูลในเอกสาร user ด้วย (เก็บ reference)
    const userRef = doc(db, "users", currentUser.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      const aiValidations = userData.aiValidations || [];

      // เพิ่ม reference ใหม่
      aiValidations.push({
        validationId: validationRef.id,
        documentType: validationData.documentType,
        fileName: validationData.fileName,
        validatedAt: new Date().toISOString(),
        status: validationData.aiResult.overall_status,
      });

      // เก็บเฉพาะ 50 รายการล่าสุด เพื่อไม่ให้เอกสาร user ใหญ่เกินไป
      if (aiValidations.length > 50) {
        aiValidations.splice(0, aiValidations.length - 50);
      }

      await updateDoc(userRef, {
        aiValidations: aiValidations,
        lastAIValidation: new Date().toISOString(),
      });
    }

    return validationRef.id;
  } catch (error) {
    console.error("❌ Error saving AI validation result:", error);
    return null;
  }
};

// Clean up AI validation data when file is removed
export const cleanupAIValidationData = async (fileToRemove, docId) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.warn("No authenticated user found for AI data cleanup");
      return;
    }

    console.log(
      `🧹 Cleaning up AI validation data for file: ${fileToRemove.filename}`
    );

    // ลบข้อมูลจาก ai_validation_results collection
    const validationsRef = collection(db, "ai_validation_results");

    // ค้นหา validation results ที่เกี่ยวข้องกับไฟล์นี้
    const q = query(
      validationsRef,
      where("userId", "==", currentUser.uid),
      where("documentType", "==", docId),
      where("fileName", "==", fileToRemove.filename || `${docId}_file`)
    );

    const querySnapshot = await getDocs(q);
    const deletionPromises = [];

    querySnapshot.forEach((docSnapshot) => {
      console.log(`🗑️ Deleting AI validation result: ${docSnapshot.id}`);
      deletionPromises.push(deleteDoc(docSnapshot.ref));
    });

    // ลบข้อมูล validation results ทั้งหมดที่เกี่ยวข้อง
    await Promise.all(deletionPromises);

    // อัพเดตข้อมูล aiValidations ใน user document
    const userRef = doc(db, "users", currentUser.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      const aiValidations = userData.aiValidations || [];

      // กรองข้อมูลที่เกี่ยวข้องกับไฟล์ที่ลบออก
      const updatedAiValidations = aiValidations.filter((validation) => {
        return !(
          validation.documentType === docId &&
          validation.fileName === (fileToRemove.filename || `${docId}_file`)
        );
      });

      // อัพเดต user document
      await updateDoc(userRef, {
        aiValidations: updatedAiValidations,
      });

      console.log(
        `✅ Cleaned up ${
          aiValidations.length - updatedAiValidations.length
        } AI validation entries from user document`
      );
    }

    console.log(
      `✅ AI validation data cleanup completed for ${fileToRemove.filename}`
    );
  } catch (error) {
    console.error("❌ Error cleaning up AI validation data:", error);
  }
};

// Perform AI validation with user interaction
export const performAIValidation = async (
  file,
  docId,
  volunteerHours,
  setVolunteerHours,
  appConfig,
  uploads,
  setIsValidatingAI
) => {
  const aiBackendAvailable = await checkAIBackendStatus();

  if (!aiBackendAvailable) {
    throw new Error("ระบบ AI ไม่พร้อมใช้งาน");
  }

  if (!needsAIValidation(docId)) {
    console.log(`Document ${docId} does not need AI validation`);
    return true;
  }

  try {
    console.log(`🤖 Starting AI validation for ${docId}`);

    // ตรวจสอบไฟล์ซ้ำสำหรับเอกสารจิตอาสา
    if (docId === "volunteer_doc") {
      const existingFiles = uploads[docId] || [];
      const isDuplicate = await checkDuplicateVolunteerFile(
        file,
        existingFiles
      );

      if (isDuplicate) {
        const Alert = require("react-native").Alert;
        Alert.alert(
          "ไฟล์ซ้ำ",
          "คุณได้อัปโหลดไฟล์นี้ไปแล้ว กรุณาเลือกไฟล์อื่น",
          [{ text: "ตกลง" }]
        );
        return false;
      }
    }

    const validationResult = await validateDocument(
      file.uri,
      docId,
      null,
      file.mimeType
    );

    // เตรียมข้อมูลสำหรับเก็บในฐานข้อมูล
    const validationDataForDB = {
      documentType: docId,
      fileName: file.filename || `${docId}_file`,
      fileUri: file.uri,
      mimeType: file.mimeType,
      aiResult: validationResult,
      academicYear: appConfig?.academicYear || null,
      term: appConfig?.term || null,
      aiBackendInfo: {
        method: aiBackendAvailable ? "available" : "unavailable",
      },
    };

    if (docId === "volunteer_doc") {
      const hours = validationResult.accumulatedHours || 0;
      console.log(`📊 Extracted volunteer hours: ${hours}`);

      return new Promise((resolve) => {
        const newTotal = volunteerHours + hours;

        const Alert = require("react-native").Alert;
        Alert.alert(
          "ตรวจสอบชั่วโมงจิตอาสา",
          `AI ตรวจพบ ${hours} ชั่วโมงจิตอาสาในเอกสารนี้\nชั่วโมงรวมปัจจุบัน: ${newTotal} ชั่วโมง`,
          [
            {
              text: "ยกเลิก",
              style: "cancel",
              onPress: () => {
                console.log("✗ User cancelled volunteer document");
                resolve(false);
              },
            },
            {
              text: "ใช้ไฟล์นี้",
              onPress: async () => {
                console.log("✓ User accepted volunteer document");

                try {
                  // อัพเดทชั่วโมงจิตอาสาใน state
                  setVolunteerHours(newTotal);

                  // บันทึกชั่วโมงจิตอาสาลง Firebase
                  await saveVolunteerHoursToFirebase(newTotal, appConfig);

                  // เก็บผลการตรวจสอบ AI ลงฐานข้อมูล
                  await saveAIValidationResult(validationDataForDB);

                  // ตั้งค่า hours ให้กับไฟล์
                  file.hours = hours;

                  if (newTotal >= 36) {
                    Alert.alert(
                      "ครบชั่วโมงจิตอาสาแล้ว",
                      `คุณสะสมครบ ${newTotal} ชั่วโมง`
                    );
                  }

                  console.log("✅ Volunteer document accepted successfully");
                  resolve(true);

                } catch (error) {
                  console.error(
                    "Error in volunteer document acceptance:",
                    error
                  );

                  Alert.alert(
                    "เกิดข้อผิดพลาด",
                    "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่"
                  );
                  resolve(false);
                } finally {
                  // ✅ เคลียร์ state เสมอ
                  setIsValidatingAI((prev) => {
                    const newState = { ...prev };
                    delete newState[docId];
                    return newState;
                  });
                }
              },
            },
          ],
          { cancelable: false }
        );
      });
    }

    // สำหรับเอกสารอื่นๆ
    return new Promise((resolve) => {
      showValidationAlert(
        validationResult,
        docId,
        async () => {
          console.log(`✓ AI Validation passed for ${file.filename} (${docId})`);

          try {
            // เก็บผลการตรวจสอบ AI ลงฐานข้อมูล
            await saveAIValidationResult(validationDataForDB);

            console.log("✅ Validation accepted successfully");
            resolve(true);
          } catch (error) {
            console.error("Error saving validation result:", error);
            resolve(true); // ยังคง resolve true เพราะ validation ผ่านแล้ว
          }
        },
        () => {
          console.log(`✗ AI Validation failed for ${file.filename} (${docId})`);
          resolve(false);
        }
      );
    });
  } catch (error) {
    console.error("AI validation error:", error);
    throw error;
  }
};
// Get user AI validation history
export const getUserAIValidationHistory = async (userId, limit = 20) => {
  try {
    const validationsRef = collection(db, "ai_validation_results");
    const q = query(
      validationsRef,
      where("userId", "==", userId),
      orderBy("validatedAt", "desc"),
      limitToLast(limit)
    );

    const querySnapshot = await getDocs(q);
    const validations = [];

    querySnapshot.forEach((doc) => {
      validations.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return validations;
  } catch (error) {
    console.error("Error fetching AI validation history:", error);
    return [];
  }
};

export {
  validateDocument,
  showValidationAlert,
  checkAIBackendStatus,
  needsAIValidation,
};
