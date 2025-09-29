import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../../../database/firebase";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";

// Upload file to Firebase Storage
export const uploadFileToStorage = async (
  file,
  docId,
  fileIndex,
  userId,
  studentName,
  config,
  studentId,
  setStorageUploadProgress
) => {
  try {
    const sanitizedStudentName = (studentName ?? "Unknown_Student")
      .replace(/[.#$[\]/\\]/g, "_")
      .replace(/\s+/g, "_");

    // Use PDF extension for converted files, or original extension
    const fileExtension = file.convertedFromImage
      ? "pdf"
      : file.filename?.split(".").pop() || "unknown";

    const academicYear = config?.academicYear || "2568";
    const term = config?.term || "1";
    const storagePath = `student_documents/${sanitizedStudentName}/${academicYear}/term_${term}/${studentId}_${docId}.${fileExtension}`;

    const response = await fetch(file.uri);
    const blob = await response.blob();

    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, blob);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setStorageUploadProgress((prev) => ({
            ...prev,
            [`${docId}_${fileIndex}`]: Math.round(progress),
          }));
        },
        (error) => {
          console.error("Upload error:", error);
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            setStorageUploadProgress((prev) => {
              const newState = { ...prev };
              delete newState[`${docId}_${fileIndex}`];
              return newState;
            });

            resolve({
              downloadURL: downloadURL ?? null,
              storagePath: storagePath ?? null,
              uploadedAt: new Date().toISOString() ?? null,
              originalFileName: file.filename ?? null,
              fileSize: file.size ?? null,
              mimeType: file.mimeType ?? null,
              academicYear: academicYear ?? null,
              term: term ?? null,
              studentFolder: sanitizedStudentName ?? null,
              ...(file.convertedFromImage && {
                convertedFromImage: true,
                originalImageName: file.originalImageName ?? null,
                originalImageType: file.originalImageType ?? null,
              }),
            });
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  } catch (error) {
    console.error("Error in uploadFileToStorage:", error);
    throw error;
  }
};

// Convert image to PDF
export const convertImageToPDF = async (
  imageFile,
  docId,
  fileIndex,
  setIsConvertingToPDF
) => {
  try {
    setIsConvertingToPDF((prev) => ({
      ...prev,
      [`${docId}_${fileIndex}`]: true,
    }));

    const base64Image = await FileSystem.readAsStringAsync(imageFile.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const mimeType = imageFile.mimeType || "image/jpeg";
    const base64DataUri = `data:${mimeType};base64,${base64Image}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @page {
            margin: 0;
            size: A4;
          }
          body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            display: block;
          }
        </style>
      </head>
      <body>
        <img src="${base64DataUri}" />
      </body>
      </html>
    `;

    const { uri: pdfUri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    const pdfInfo = await FileSystem.getInfoAsync(pdfUri);
    const originalName = imageFile.filename || imageFile.name || "image";
    const nameWithoutExtension = originalName.replace(/\.[^/.]+$/, "");

    const pdfFile = {
      filename: `${docId}.pdf`,
      uri: pdfUri,
      mimeType: "application/pdf",
      size: pdfInfo.size,
      uploadDate: new Date().toLocaleString("th-TH"),
      status: "pending",
      aiValidated: false, // Will be set based on needsAIValidation later
      fileIndex: fileIndex,
      convertedFromImage: true,
      originalImageName: imageFile.filename ?? null,
      originalImageType: imageFile.mimeType ?? null,
    };

    return pdfFile;
  } catch (error) {
    console.error("Error converting image to PDF:", error);
    throw new Error(`ไม่สามารถแปลงรูปภาพเป็น PDF ได้: ${error.message}`);
  } finally {
    setIsConvertingToPDF((prev) => {
      const newState = { ...prev };
      delete newState[`${docId}_${fileIndex}`];
      return newState;
    });
  }
};

// Check if file is image
export const isImageFile = (mimeType, filename) => {
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
