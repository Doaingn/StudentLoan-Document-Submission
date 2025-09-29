import { useState } from "react";
import { Alert } from "react-native";
import { db, auth } from "../../../database/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import * as FileSystem from "expo-file-system/legacy";

import {
  validateDocument,
  showValidationAlert,
  needsAIValidation,
} from "../documents_ai/UnifiedDocumentAI";
import { convertImageToPDF } from "../services/pdfConversionService";
import { mergeImagesToPdf } from "../utils/pdfMerger";
import { saveAIValidationResult } from "../utils/aiValidationStorage";

export const useFileOperations = (props) => {
  const {
    uploads,
    setUploads,
    volunteerHours,
    setVolunteerHours,
    isConvertingToPDF,
    setIsConvertingToPDF,
    isValidatingAI,
    setIsValidatingAI,
    aiBackendAvailable,
    appConfig,
  } = props;

  // Save uploads to Firebase
  const saveUploadsToFirebase = async (uploadsData) => {
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
    }
  };

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

  // Check if file is image
  const isImageFile = (mimeType, filename) => {
    const imageTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/bmp",
      "image/webp",
    ];
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];

    if (
      mimeType &&
      imageTypes.some((type) => mimeType.toLowerCase().includes(type))
    ) {
      return true;
    }

    if (
      filename &&
      imageExtensions.some((ext) => filename.toLowerCase().endsWith(ext))
    ) {
      return true;
    }

    return false;
  };

  // Perform AI validation
  const performAIValidation = async (file, docId) => {
    if (!aiBackendAvailable) {
      Alert.alert(
        "ระบบ AI ไม่พร้อมใช้งาน",
        "ไม่สามารถตรวจสอบเอกสารด้วย AI ได้ในขณะนี้ คุณสามารถดำเนินการต่อได้",
        [{ text: "ตกลง" }]
      );
      return true;
    }

    if (!needsAIValidation(docId)) {
      console.log(`Document ${docId} does not need AI validation`);
      return true;
    }

    setIsValidatingAI((prev) => ({ ...prev, [docId]: true }));

    try {
      console.log(`🤖 Starting AI validation for ${docId}`);

      const validationResult = await validateDocument(
        file.uri,
        docId,
        null,
        file.mimeType
      );

      const validationDataForDB = {
        documentType: docId,
        fileName: file.filename || `${docId}_file`,
        fileUri: file.uri,
        mimeType: file.mimeType,
        aiResult: validationResult,
        aiBackendInfo: {
          method: aiBackendAvailable ? "available" : "unavailable",
        },
      };

      if (docId === "volunteer_doc") {
        const hours = validationResult.accumulatedHours || 0;
        console.log(`📊 Extracted volunteer hours: ${hours}`);

        setVolunteerHours((prev) => {
          const newTotal = prev + hours;
          if (newTotal >= 36) {
            Alert.alert(
              "ครบชั่วโมงจิตอาสาแล้ว",
              `คุณสะสมครบ ${newTotal} ชั่วโมง`
            );
          }
          return newTotal;
        });

        return new Promise((resolve) => {
          Alert.alert(
            "ตรวจสอบชั่วโมงจิตอาสา",
            `AI ตรวจพบ ${hours} ชั่วโมงจิตอาสาในเอกสารนี้\nชั่วโมงรวมปัจจุบัน: ${
              volunteerHours + hours
            } ชั่วโมง`,
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
                  await saveAIValidationResult(validationDataForDB);
                  resolve(true);
                },
              },
            ]
          );
        });
      }

      // For other documents
      return new Promise((resolve) => {
        showValidationAlert(
          validationResult,
          docId,
          async () => {
            console.log(
              `✓ AI Validation passed for ${file.filename} (${docId})`
            );
            await saveAIValidationResult(validationDataForDB);
            resolve(true);
          },
          () => {
            console.log(
              `✗ AI Validation failed for ${file.filename} (${docId})`
            );
            resolve(false);
          }
        );
      });
    } catch (error) {
      console.error("AI validation error:", error);
      return new Promise((resolve) => {
        Alert.alert(
          "เกิดข้อผิดพลาดในการตรวจสอบ",
          `ไม่สามารถตรวจสอบเอกสารด้วย AI ได้: ${error.message}\nคุณต้องการดำเนินการต่อหรือไม่?`,
          [
            { text: "ลองใหม่", style: "cancel", onPress: () => resolve(false) },
            { text: "ดำเนินการต่อ", onPress: () => resolve(true) },
          ]
        );
      });
    } finally {
      setIsValidatingAI((prev) => {
        const newState = { ...prev };
        delete newState[docId];
        return newState;
      });
    }
  };

  // Handle file upload
  const handleFileUpload = async (docId, allowMultiple = true) => {
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
            const isValid = await performAIValidation(fileWithMetadata, docId);
            if (!isValid) continue;
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
              `🔥 FORM 101 IMAGES - Merging ${imagesToProcess.length} images to PDF...`
            );
            const mergedPdfFile = await mergeImagesToPdf(
              imagesToProcess,
              docId
            );

            // AI validation for the merged PDF
            if (needsAIValidation(docId)) {
              const isValid = await performAIValidation(mergedPdfFile, docId);
              if (!isValid) {
                setIsConvertingToPDF((prev) => {
                  const newState = { ...prev };
                  delete newState[`${docId}_merge`];
                  return newState;
                });
                return;
              }
            }

            processedFiles.push(mergedPdfFile);
          } catch (error) {
            console.error("Error merging images to PDF:", error);
            Alert.alert(
              "ข้อผิดพลาด",
              `ไม่สามารถรวมรูปภาพเป็น PDF ได้: ${error.message}`
            );
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
              const convertedPdf = await convertImageToPDF(file, docId, i);
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
          if (needsAIValidation(docId)) {
            const isValid = await performAIValidation(processedFile, docId);
            if (!isValid) continue;
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
          `✅ Successfully added ${processedFiles.length} files for ${docId}`
        );
      }
    } catch (error) {
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถเลือกไฟล์ได้");
      console.error(error);
    }
  };

  // Clean up AI validation data
  const cleanupAIValidationData = async (fileToRemove, docId) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      console.log(
        `🧹 Cleaning up AI validation data for file: ${fileToRemove.filename}`
      );

      const { query, where, getDocs, deleteDoc, collection } = await import(
        "firebase/firestore"
      );
      const validationsRef = collection(db, "ai_validation_results");

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

      await Promise.all(deletionPromises);

      // Update user document
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const aiValidations = userData.aiValidations || [];

        const updatedAiValidations = aiValidations.filter((validation) => {
          return !(
            validation.documentType === docId &&
            validation.fileName === (fileToRemove.filename || `${docId}_file`)
          );
        });

        await updateDoc(userRef, {
          aiValidations: updatedAiValidations,
        });
      }

      console.log(
        `✅ AI validation data cleanup completed for ${fileToRemove.filename}`
      );
    } catch (error) {
      console.error("❌ Error cleaning up AI validation data:", error);
    }
  };

  // Handle remove file
  const handleRemoveFile = async (docId, fileIndex = null) => {
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
                await cleanupAIValidationData(fileToRemove, docId);

                const newFiles = docFiles.filter(
                  (_, index) => index !== fileIndex
                );

                // Clean up temporary PDF files
                if (fileToRemove.convertedFromImage && fileToRemove.uri) {
                  try {
                    await FileSystem.deleteAsync(fileToRemove.uri, {
                      idempotent: true,
                    });
                  } catch (cleanupError) {
                    console.warn(
                      "Could not clean up temporary file:",
                      cleanupError
                    );
                  }
                }

                const newUploads = { ...uploads };
                if (newFiles.length === 0) {
                  delete newUploads[docId];
                } else {
                  newFiles.forEach((file, index) => {
                    file.fileIndex = index;
                  });
                  newUploads[docId] = newFiles;
                }

                // Update volunteer hours if needed
                if (docId === "volunteer_doc") {
                  const newHours =
                    calculateVolunteerHoursFromUploads(newUploads);
                  setVolunteerHours(newHours);
                }

                setUploads(newUploads);
                await saveUploadsToFirebase(newUploads);

                console.log(
                  `✅ Successfully removed file: ${fileToRemove.filename}`
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
                // Clean up AI validation data for all files
                const cleanupPromises = docFiles.map((file) =>
                  cleanupAIValidationData(file, docId)
                );
                await Promise.all(cleanupPromises);

                // Clean up temporary PDF files
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

                const newUploads = { ...uploads };
                delete newUploads[docId];

                // Reset volunteer hours if needed
                if (docId === "volunteer_doc") {
                  setVolunteerHours(0);
                }

                setUploads(newUploads);
                await saveUploadsToFirebase(newUploads);

                console.log(
                  `✅ Successfully removed all files for document: ${docId}`
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
    handleFileUpload,
    handleRemoveFile,
    saveUploadsToFirebase,
    performAIValidation,
    calculateVolunteerHoursFromUploads,
    isImageFile,
  };
};
