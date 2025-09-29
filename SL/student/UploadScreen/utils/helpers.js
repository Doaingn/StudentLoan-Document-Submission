import { Timestamp } from "firebase/firestore";

// Calculate age from birth date (Timestamp or string)
export const calculateAge = (birthDate) => {
  if (!birthDate) return null;

  let birthDateObj;

  // ถ้า birthDate เป็น Timestamp ของ Firebase
  if (birthDate instanceof Timestamp) {
    birthDateObj = birthDate.toDate();
  }
  // ถ้าเป็น string (ISO string)
  else if (typeof birthDate === "string") {
    birthDateObj = new Date(birthDate);
  }
  // ถ้าเป็น Date object อยู่แล้ว
  else if (birthDate instanceof Date) {
    birthDateObj = birthDate;
  } else {
    console.warn("Unsupported birthDate type:", typeof birthDate);
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDateObj.getFullYear();
  const monthDiff = today.getMonth() - birthDateObj.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDateObj.getDate())
  ) {
    age--;
  }

  return age;
};

// Format file size
export const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Get upload stats
export const getUploadStats = (
  uploads,
  surveyData,
  term,
  academicYear,
  birthDate
) => {
  const { generateDocumentsList } = require("./documentGenerator");

  const documents = generateDocumentsList({
    ...surveyData,
    term: term,
    academicYear: academicYear,
    birth_date: birthDate,
  });

  const requiredDocs = documents.filter((doc) => doc.required);
  const uploadedDocs = documents.filter(
    (doc) => uploads[doc.id] && uploads[doc.id].length > 0
  );
  const uploadedRequiredDocs = requiredDocs.filter(
    (doc) => uploads[doc.id] && uploads[doc.id].length > 0
  );

  const totalFiles = Object.values(uploads).reduce(
    (sum, files) => sum + files.length,
    0
  );
  const convertedFiles = Object.values(uploads)
    .flat()
    .filter((file) => file.convertedFromImage).length;

  return {
    total: documents.length,
    required: requiredDocs.length,
    uploaded: uploadedDocs.length,
    uploadedRequired: uploadedRequiredDocs.length,
    totalFiles: totalFiles,
    convertedFiles: convertedFiles,
  };
};

// Load file content for preview
export const loadFileContent = async (file) => {
  try {
    const mimeType = file.mimeType?.toLowerCase() || "";
    const fileName = file.filename?.toLowerCase() || "";

    if (
      mimeType.startsWith("image/") ||
      fileName.endsWith(".jpg") ||
      fileName.endsWith(".jpeg") ||
      fileName.endsWith(".png") ||
      fileName.endsWith(".gif") ||
      fileName.endsWith(".bmp") ||
      fileName.endsWith(".webp")
    ) {
      return { type: "image", content: file.uri };
    } else if (
      mimeType.includes("text/") ||
      mimeType.includes("json") ||
      fileName.endsWith(".txt") ||
      fileName.endsWith(".json")
    ) {
      const FileSystem = require("expo-file-system/legacy");
      const content = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      return { type: "text", content };
    } else if (mimeType.includes("pdf") || fileName.endsWith(".pdf")) {
      let pdfMessage =
        'ไฟล์ PDF ต้องใช้แอปพลิเคชันภายนอกในการดู คลิก "เปิดด้วยแอปภายนอก" เพื่อดูไฟล์';

      if (file.convertedFromImage) {
        pdfMessage = `ไฟล์ PDF ที่แปลงมาจากรูปภาพ\n(ไฟล์ต้นฉบับ: ${file.originalImageName})\n\n${pdfMessage}`;
      }

      return { type: "pdf", content: pdfMessage };
    } else {
      return {
        type: "other",
        content: `ไฟล์ประเภท ${mimeType || "ไม่ทราบ"} ไม่สามารถแสดงผลในแอปได้`,
      };
    }
  } catch (error) {
    console.error("Error reading file:", error);
    return {
      type: "error",
      content: "ไม่สามารถอ่านไฟล์นี้ได้ กรุณาลองใหม่อีกครั้ง",
    };
  }
};

// Handle open uploaded file with external app
export const handleOpenUploadedFile = async (file) => {
  try {
    if (!file?.uri) return;
    const Sharing = await import("expo-sharing");
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert(
        "ไม่สามารถเปิดไฟล์ได้",
        "อุปกรณ์ของคุณไม่รองรับการเปิดไฟล์นี้"
      );
      return;
    }
    await Sharing.shareAsync(file.uri);
  } catch (error) {
    console.error(error);
    Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถเปิดไฟล์นี้ได้");
  }
};
