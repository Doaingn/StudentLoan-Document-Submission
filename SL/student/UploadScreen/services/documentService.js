import { Alert } from "react-native";
import { auth } from "../../../database/firebase";
import { mergeImagesToPdf } from "../utils/pdfMerger";
import {
  convertImageToPDF,
  isImageFile,
  uploadFileToStorage,
} from "./fileUploadService";
import { performAIValidation } from "./aiValidationService";
import { saveUploadsToFirebase } from "./firebaseService";

// Handle file upload with AI validation
export const handleFileUpload = async (
  docId,
  allowMultiple,
  uploads,
  setUploads,
  setVolunteerHours,
  volunteerHours,
  appConfig,
  setIsConvertingToPDF,
  setStorageUploadProgress
) => {
  try {
    const DocumentPicker = await import("expo-document-picker");
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "image/*",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/bmp",
        "image/webp",
      ],
      copyToCacheDirectory: true,
      multiple: allowMultiple,
    });

    if (result.canceled) return;

    const files = result.assets;
    const processedFiles = [];

    if (docId === "form_101") {
      // ... existing form_101 logic ...
    } else {
      // Handle other document types
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let processedFile = file;
        let originalMetadata = {
          filename: file.filename ?? file.name ?? null,
          mimeType: file.mimeType ?? null,
          size: file.size ?? null,
          uri: file.uri ?? null,
        };

        if (isImageFile(file.mimeType, file.name)) {
          try {
            const convertedPdf = await convertImageToPDF(
              file,
              docId,
              i,
              setIsConvertingToPDF
            );
            processedFile = {
              ...originalMetadata,
              ...convertedPdf,
              filename: convertedPdf.filename,
              mimeType: "application/pdf",
            };
          } catch (conversionError) {
            console.error("PDF conversion failed:", conversionError);
            Alert.alert(
              "การแปลงล้มเหลว",
              `ไม่สามารถแปลงไฟล์ "${
                file.name ?? "ไม่ทราบชื่อไฟล์"
              }" เป็น PDF ได้ จะใช้ไฟล์ต้นฉบับแทน`
            );
            processedFile = file;
          }
        } else {
          processedFile = originalMetadata;
        }

        // AI validation - ส่ง uploads ไปด้วยเพื่อตรวจสอบไฟล์ซ้ำ
        const { needsAIValidation } = await import("./aiValidationService");
        if (needsAIValidation(docId)) {
          const isValid = await performAIValidation(
            processedFile,
            docId,
            volunteerHours,
            setVolunteerHours,
            appConfig,
            uploads // เพิ่ม parameter นี้
          );
          if (!isValid) {
            console.log(`❌ AI validation failed for ${docId}, skipping file`);
            continue;
          }
          console.log(`✅ AI validation passed for ${docId}`);
        }

        const fileWithMetadata = {
          filename: processedFile.filename ?? null,
          uri: processedFile.uri ?? null,
          mimeType: processedFile.mimeType ?? null,
          size: processedFile.size ?? null,
          uploadDate: new Date().toLocaleString("th-TH"),
          status: "pending",
          aiValidated: needsAIValidation(docId),
          fileIndex: (uploads[docId] || []).length + processedFiles.length,
          ...(processedFile.convertedFromImage !== undefined && {
            convertedFromImage: processedFile.convertedFromImage ?? false,
            originalImageName: processedFile.originalImageName ?? null,
            originalImageType: processedFile.originalImageType ?? null,
          }),
          // เก็บชั่วโมงจิตอาสาไว้ในไฟล์
          ...(docId === "volunteer_doc" &&
            processedFile.hours && {
              hours: processedFile.hours,
            }),
        };

        processedFiles.push(fileWithMetadata);
      }
    }

    // Only update uploads if we have processed files (validation passed)
    if (processedFiles.length > 0) {
      const newUploads = {
        ...uploads,
        [docId]: [...(uploads[docId] || []), ...processedFiles],
      };

      setUploads(newUploads);
      await saveUploadsToFirebase(newUploads);
      console.log(
        `✅ Successfully added ${processedFiles.length} files for ${docId}`
      );
    } else {
      console.log(
        `❌ No files were added for ${docId} - all validations failed or user cancelled`
      );
    }
  } catch (error) {
    Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถเลือกไฟล์ได้");
    console.error(error);
  }
};
// Prepare submission data
export const prepareSubmissionData = async (uploads, surveyData, appConfig) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("No authenticated user found");
  }

  let studentId = "Unknown_Student";
  let studentName = "Unknown_Student";
  let citizenId = "Unknown_CitizenID";

  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const { db } = await import("../../../database/firebase");

    const userRef = doc(db, "users", currentUser.uid);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const userData = userDoc.data();
      studentId = userData.student_id || "Unknown_Student";
      studentName =
        userData.profile?.student_name ||
        userData.name ||
        userData.nickname ||
        "Unknown_Student";
      citizenId = userData.citizen_id;
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
  }

  const academicYear = appConfig?.academicYear || "2568";
  const term = appConfig?.term || "1";

  const submissionData = {
    userId: currentUser.uid ?? null,
    userEmail: currentUser.email ?? null,
    student_id: studentId ?? null,
    citizen_id: citizenId ?? null,
    surveyData: surveyData ?? null,
    uploads: {}, // Will be filled with storage uploads
    submittedAt: new Date().toISOString() ?? null,
    status: "submitted" ?? null,
    academicYear: academicYear ?? null,
    term: term ?? null,
    submissionTerm: `${term}` ?? null,
    documentStatuses: {},
  };

  return {
    submissionData,
    studentId,
    studentName,
    academicYear,
    term,
  };
};
