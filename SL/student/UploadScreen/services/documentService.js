import { Alert } from "react-native";
import { auth } from "../../../database/firebase";
import { mergeImagesToPdf } from "../utils/pdfMerger";
import {
  convertImageToPDF,
  isImageFile,
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
  setStorageUploadProgress,
  setIsValidatingAI
) => {
  try {
    // FIX: ใช้ static import แทน dynamic import
    const DocumentPicker = require("expo-document-picker");

    // FIX: ใช้ getDocumentAsync โดยตรงจาก DocumentPicker
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
      if (files.length > 4) {
        Alert.alert(
          "ข้อผิดพลาด",
          "เอกสาร Form 101 สามารถอัปโหลดได้สูงสุด 4 ไฟล์เท่านั้น"
        );
        return;
      }

      const imagesToProcess = files.filter((file) =>
        isImageFile(file.mimeType, file.name)
      );
      const otherFiles = files.filter(
        (file) => !isImageFile(file.mimeType, file.name)
      );

      // Process non-image files first
      for (const file of otherFiles) {
        const fileWithMetadata = {
          filename: file.name ?? null,
          uri: file.uri ?? null,
          mimeType: file.mimeType ?? null,
          size: file.size ?? null,
          uploadDate: new Date().toLocaleString("th-TH"),
          status: "pending",
          aiValidated: needsAIValidation(docId),
          fileIndex: (uploads[docId] || []).length + processedFiles.length,
        };

        // AI validation for non-image files
        if (needsAIValidation(docId)) {
          console.log(
            `FORM 101 NON-IMAGE - Starting AI validation for ${file.name}...`
          );
          const isValid = await performAIValidation(
            fileWithMetadata,
            docId,
            volunteerHours,
            setVolunteerHours,
            appConfig,
            uploads,
            setIsValidatingAI
          );
          if (!isValid) {
            console.log(
              `FORM 101 NON-IMAGE - AI validation failed for ${file.name}`
            );
            continue; // Skip this file if validation fails
          }
          console.log(
            `FORM 101 NON-IMAGE - AI validation passed for ${file.name}`
          );
        }

        processedFiles.push(fileWithMetadata);
      }

      // Process and merge images if any
      if (imagesToProcess.length > 0) {
        setIsConvertingToPDF((prev) => ({
          ...prev,
          [`${docId}_merge`]: true,
        }));

        try {
          console.log(
            `FORM 101 IMAGES - Merging ${imagesToProcess.length} images to PDF...`
          );
          const mergedPdfFile = await mergeImagesToPdf(
            files,
            docId,
            setIsConvertingToPDF
          );

          // AI validation for the merged PDF
          if (needsAIValidation(docId)) {
            console.log(`FORM 101 MERGED PDF - Starting AI validation...`);
            const isValid = await performAIValidation(
              mergedPdfFile,
              docId,
              volunteerHours,
              setVolunteerHours,
              appConfig,
              uploads,
              setIsValidatingAI
            );
            if (!isValid) {
              console.log(`FORM 101 MERGED PDF - AI validation failed`);
              setIsConvertingToPDF((prev) => {
                const newState = { ...prev };
                delete newState[`${docId}_merge`];
                return newState;
              });
              return; // Don't add the file if validation fails
            }
            console.log(`FORM 101 MERGED PDF - AI validation passed`);
          }

          processedFiles.push(mergedPdfFile);
        } catch (error) {
          console.error("Error merging images to PDF:", error);
          Alert.alert(
            "ข้อผิดพลาด",
            `ไม่สามารถรวมรูปภาพเป็น PDF ได้: ${error.message}`
          );
          setIsConvertingToPDF((prev) => {
            const newState = { ...prev };
            delete newState[`${docId}_merge`];
            return newState;
          });
          return;
        } finally {
          setIsConvertingToPDF((prev) => {
            const newState = { ...prev };
            delete newState[`${docId}_merge`];
            return newState;
          });
        }
      }
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

        // AI validation
        const { needsAIValidation } = require("./aiValidationService");
        if (needsAIValidation(docId)) {
          setIsValidatingAI((prev) => ({
            ...prev,
            [docId]: true,
          }));

          let validationResult = false;

          try {
            validationResult = await performAIValidation(
              processedFile,
              docId,
              volunteerHours,
              setVolunteerHours,
              appConfig,
              uploads,
              setIsValidatingAI
            );

            console.log(
              `Validation result for ${docId}: ${validationResult}`
            );

            if (!validationResult) {
              console.log(
                `AI validation failed for ${docId}, skipping file`
              );
            } else {
              console.log(`AI validation passed for ${docId}`);
            }
          } catch (error) {
            console.error(`AI validation error for ${docId}:`, error);
            validationResult = false;
          } finally {
            console.log(`Force clearing validation state for ${docId}`);

            setIsValidatingAI((prev) => {
              const newState = { ...prev };
              delete newState[docId];
              console.log(`State after clear:`, Object.keys(newState));
              return newState;
            });

            // Clear อีกครั้งหลัง microtask
            await Promise.resolve();
            setIsValidatingAI((prev) => {
              const newState = { ...prev };
              delete newState[docId];
              return newState;
            });

            // Clear อีกครั้งหลัง delay สั้นๆ
            setTimeout(() => {
              setIsValidatingAI((prev) => {
                const newState = { ...prev };
                delete newState[docId];
                return newState;
              });
            }, 50);
          }

          // ถ้า validation ไม่ผ่าน ให้ skip ไฟล์นี้
          if (!validationResult) {
            continue;
          }
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
          ...(docId === "volunteer_doc" &&
            processedFile.hours && {
              hours: processedFile.hours,
            }),
        };

        processedFiles.push(fileWithMetadata);
      }
    }

    // Only update uploads if we have processed files
    if (processedFiles.length > 0) {
      const newUploads = {
        ...uploads,
        [docId]: [...(uploads[docId] || []), ...processedFiles],
      };

      setUploads(newUploads);
      await saveUploadsToFirebase(newUploads);
      console.log(
        `Successfully added ${processedFiles.length} files for ${docId}`
      );
    } else {
      console.log(
        `No files were added for ${docId} - all validations failed or user cancelled`
      );
    }

    // FORCE CLEAR ทุก state ที่เกี่ยวข้องกับ docId
    console.log("FINAL CLEANUP - Clearing all states for", docId);
    setIsValidatingAI((prev) => {
      const newState = { ...prev };
      delete newState[docId];
      return newState;
    });

    setIsConvertingToPDF((prev) => {
      const newState = { ...prev };
      // Clear ทั้ง docId และ docId_merge และ docId_[index]
      Object.keys(newState).forEach((key) => {
        if (key.startsWith(docId)) {
          delete newState[key];
        }
      });
      console.log("Final state keys after cleanup:", Object.keys(newState));
      return newState;
    });
  } catch (error) {
    // FORCE CLEAR state ใน catch block ด้วย
    console.log("ERROR CLEANUP - Clearing all states for", docId);

    setIsValidatingAI((prev) => {
      const newState = { ...prev };
      delete newState[docId];
      return newState;
    });

    setIsConvertingToPDF((prev) => {
      const newState = { ...prev };
      Object.keys(newState).forEach((key) => {
        if (key.startsWith(docId)) {
          delete newState[key];
        }
      });
      return newState;
    });

    Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถเลือกไฟล์ได้");
    console.error("File upload error:", error);
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

  // ใช้ค่าจาก appConfig โดยตรง
  const academicYear = appConfig?.academicYear || "2568";
  const term = appConfig?.term || "1";

  // ดึง phase จาก surveyData หรือ appConfig
  const phase = surveyData?.phase || "initial_application";

  console.log(`Preparing submission:`, {
    academicYear,
    term,
    phase,
    studentId,
    studentName
  });

  const submissionData = {
    userId: currentUser.uid ?? null,
    userEmail: currentUser.email ?? null,
    student_id: studentId ?? null,
    citizen_id: citizenId ?? null,
    surveyData: surveyData ?? null,
    uploads: {},
    submittedAt: new Date().toISOString() ?? null,
    status: "submitted" ?? null,
    academicYear: academicYear ?? null,
    term: term ?? null,
    submissionTerm: `${term}` ?? null,
    phase: phase ?? null,
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
