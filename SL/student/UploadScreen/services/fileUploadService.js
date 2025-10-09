import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../../../database/firebase";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";

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

    const fileExtension = file.convertedFromImage
      ? "pdf"
      : file.filename?.split(".").pop() || "unknown";

    const academicYear = config?.academicYear || "2568";
    const term = config?.term || "1";
    
    const timestamp = Date.now();
    const storagePath = `student_documents/${sanitizedStudentName}/${academicYear}/term_${term}/${studentId}_${docId}_${timestamp}.${fileExtension}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

    try {
      const response = await fetch(file.uri, {
        signal: controller.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      clearTimeout(timeoutId);

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
            clearTimeout(timeoutId);
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
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error("Error in uploadFileToStorage:", error);
    
    if (error.name === 'AbortError') {
      throw new Error("การอัปโหลดใช้เวลานานเกินไป กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต");
    } else if (error.message.includes('Network request failed')) {
      throw new Error("การเชื่อมต่ออินเทอร์เน็ตมีปัญหา กรุณาตรวจสอบสัญญาณและลองอีกครั้ง");
    }
    
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
  const stateKey = `${docId}_${fileIndex}`;

  try {
    setIsConvertingToPDF((prev) => ({
      ...prev,
      [stateKey]: true,
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          @page {
            margin: 0;
            size: A4;
          }
          html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
          body {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          img {
            max-width: 100%;
            max-height: 100vh;
            width: auto;
            height: auto;
            object-fit: contain;
            display: block;
          }
        </style>
      </head>
      <body>
        <img src="${base64DataUri}" alt="Document Image" />
      </body>
      </html>
    `;

    const { uri: pdfUri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
      width: 595,
      height: 842,
    });

    const pdfInfo = await FileSystem.getInfoAsync(pdfUri);

    const pdfFile = {
      filename: `${docId}.pdf`,
      uri: pdfUri,
      mimeType: "application/pdf",
      size: pdfInfo.size,
      uploadDate: new Date().toLocaleString("th-TH"),
      status: "pending",
      aiValidated: false,
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
    console.log("FINALLY: Clearing convertImageToPDF state for:", stateKey);
    setIsConvertingToPDF((prev) => {
      const newState = { ...prev };
      delete newState[stateKey];
      console.log("Remaining keys:", Object.keys(newState));
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
