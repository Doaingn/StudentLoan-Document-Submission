import { useState } from "react";
import { Alert } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

export const useFileManagement = (setUploads, setVolunteerHours, uploads) => {
  const [isConvertingToPDF, setIsConvertingToPDF] = useState({});

  // Calculate volunteer hours from uploads
  const calculateVolunteerHoursFromUploads = (uploadsData) => {
    let totalHours = 0;
    const volunteerFiles = uploadsData.volunteer_doc || [];

    volunteerFiles.forEach((file) => {
      if (file.hours) {
        totalHours += file.hours;
      }
    });

    return totalHours;
  };

  // ฟังก์ชันดึงชั่วโมงจิตอาสาจาก Firebase
  const loadVolunteerHoursFromFirebase = async () => {
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const { db, auth } = await import("../../../database/firebase");

      const currentUser = auth.currentUser;
      if (!currentUser) return 0;

      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.volunteerHours || 0;
      }

      return 0;
    } catch (error) {
      console.error("Error loading volunteer hours from Firebase:", error);
      return 0;
    }
  };

  // Remove file with AI validation cleanup
  const handleRemoveFile = async (docId, fileIndex = null) => {
    const { cleanupAIValidationData } = await import(
      "../services/aiValidationService"
    );
    const { saveUploadsToFirebase } = await import(
      "../services/firebaseService"
    );
    const { saveVolunteerHoursToFirebase } = await import(
      "../services/aiValidationService"
    );

    const docFiles = uploads[docId] || [];

    if (fileIndex !== null && fileIndex >= 0 && fileIndex < docFiles.length) {
      // Remove specific file
      const fileToRemove = docFiles[fileIndex];
      Alert.alert(
        "ลบไฟล์",
        `คุณต้องการลบไฟล์ "${fileToRemove.filename}" หรือไม่?\n\n⚠️ ข้อมูลการตรวจสอบ AI ที่เกี่ยวข้องจะถูกลบด้วย`,
        [
          { text: "ยกเลิก", style: "cancel" },
          {
            text: "ลบ",
            style: "destructive",
            onPress: async () => {
              try {
                // 1. ลบข้อมูล AI validation ก่อน
                await cleanupAIValidationData(fileToRemove, docId);

                // 2. ลบไฟล์จาก array
                const newFiles = docFiles.filter(
                  (_, index) => index !== fileIndex
                );

                // 3. Clean up temporary PDF files if they were converted from images
                if (fileToRemove.convertedFromImage && fileToRemove.uri) {
                  try {
                    await FileSystem.deleteAsync(fileToRemove.uri, {
                      idempotent: true,
                    });
                    console.log("✓ Cleaned up temporary PDF file");
                  } catch (cleanupError) {
                    console.warn(
                      "Could not clean up temporary file:",
                      cleanupError
                    );
                  }
                }

                // 4. อัพเดต uploads state
                const newUploads = { ...uploads };
                if (newFiles.length === 0) {
                  delete newUploads[docId];
                } else {
                  // Re-index remaining files
                  newFiles.forEach((file, index) => {
                    file.fileIndex = index;
                  });
                  newUploads[docId] = newFiles;
                }

                // 5. อัพเดตชั่วโมงจิตอาสาหลังจากลบไฟล์
                if (docId === "volunteer_doc") {
                  const newHours =
                    calculateVolunteerHoursFromUploads(newUploads);
                  setVolunteerHours(newHours);

                  // บันทึกลง Firebase
                  await saveVolunteerHoursToFirebase(newHours, {});

                  console.log(
                    `🔄 Updated volunteer hours after deletion: ${newHours}`
                  );
                }

                // 6. บันทึกการเปลี่ยนแปลงลง Firebase
                setUploads(newUploads);
                await saveUploadsToFirebase(newUploads);

                console.log(
                  `✅ Successfully removed file and cleaned up AI data: ${fileToRemove.filename}`
                );
              } catch (error) {
                console.error("❌ Error during file removal:", error);
                Alert.alert(
                  "เกิดข้อผิดพลาด",
                  `ไม่สามารถลบไฟล์ได้: ${error.message}`
                );
              }
            },
          },
        ]
      );
    } else {
      // Remove all files for this document
      Alert.alert(
        "ลบไฟล์ทั้งหมด",
        `คุณต้องการลบไฟล์ทั้งหมด (${docFiles.length} ไฟล์) สำหรับเอกสารนี้หรือไม่?\n\n⚠️ ข้อมูลการตรวจสอบ AI ทั้งหมดที่เกี่ยวข้องจะถูกลบด้วย`,
        [
          { text: "ยกเลิก", style: "cancel" },
          {
            text: "ลบทั้งหมด",
            style: "destructive",
            onPress: async () => {
              try {
                const { cleanupAIValidationData } = await import(
                  "../services/aiValidationService"
                );
                const { saveUploadsToFirebase } = await import(
                  "../services/firebaseService"
                );
                const { saveVolunteerHoursToFirebase } = await import(
                  "../services/aiValidationService"
                );

                // 1. ลบข้อมูล AI validation สำหรับทุกไฟล์
                const cleanupPromises = docFiles.map((file) =>
                  cleanupAIValidationData(file, docId)
                );
                await Promise.all(cleanupPromises);

                // 2. Clean up temporary PDF files
                for (const file of docFiles) {
                  if (file.convertedFromImage && file.uri) {
                    try {
                      await FileSystem.deleteAsync(file.uri, {
                        idempotent: true,
                      });
                    } catch (cleanupError) {
                      console.warn(
                        "Could not clean up temporary file:",
                        cleanupError
                      );
                    }
                  }
                }

                // 3. อัพเดต uploads state
                const newUploads = { ...uploads };
                delete newUploads[docId];

                // 4. รีเซ็ตชั่วโมงจิตอาสาหากลบเอกสารจิตอาสาทั้งหมด
                if (docId === "volunteer_doc") {
                  setVolunteerHours(0);
                  // บันทึกลง Firebase
                  await saveVolunteerHoursToFirebase(0, {});
                  console.log(
                    "🔄 Reset volunteer hours to 0 after deleting all files"
                  );
                }

                // 5. บันทึกการเปลี่ยนแปลงลง Firebase
                setUploads(newUploads);
                await saveUploadsToFirebase(newUploads);

                console.log(
                  `✅ Successfully removed all files and cleaned up AI data for document: ${docId}`
                );
              } catch (error) {
                console.error("❌ Error during bulk file removal:", error);
                Alert.alert(
                  "เกิดข้อผิดพลาด",
                  `ไม่สามารถลบไฟล์ทั้งหมดได้: ${error.message}`
                );
              }
            },
          },
        ]
      );
    }
  };

  return {
    isConvertingToPDF,
    setIsConvertingToPDF,
    calculateVolunteerHoursFromUploads,
    handleRemoveFile,
    loadVolunteerHoursFromFirebase,
  };
};