import { Alert } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { generateDocumentsList } from "../utils/documentGenerator";

export const useFileModal = (props) => {
  const {
    uploads,
    setShowFileModal,
    setSelectedFile,
    setSelectedDocTitle,
    setSelectedFileIndex,
    setFileContent,
    setIsLoadingContent,
    setContentType,
    setImageZoom,
    setImagePosition,
    surveyData,
  } = props;

  const handleShowFileModal = async (docId, docTitle, fileIndex = 0) => {
    const files = uploads[docId];
    if (files && files[fileIndex]) {
      const file = files[fileIndex];
      setSelectedFile({ ...file, docId });
      setSelectedDocTitle(`${docTitle} (${fileIndex + 1}/${files.length})`);
      setSelectedFileIndex(fileIndex);
      setShowFileModal(true);
      setIsLoadingContent(true);
      try {
        await loadFileContent(file);
      } catch (error) {
        console.error("Error loading file content:", error);
        Alert.alert("ข้อผิดพลาด", "ไม่สามารถโหลดเนื้อหาไฟล์ได้");
      } finally {
        setIsLoadingContent(false);
      }
    }
  };

  const loadFileContent = async (file) => {
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
        setContentType("image");
        setFileContent(file.uri);
      } else if (
        mimeType.includes("text/") ||
        mimeType.includes("json") ||
        fileName.endsWith(".txt") ||
        fileName.endsWith(".json")
      ) {
        setContentType("text");
        const content = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        setFileContent(content);
      } else if (mimeType.includes("pdf") || fileName.endsWith(".pdf")) {
        setContentType("pdf");
        let pdfMessage =
          'ไฟล์ PDF ต้องใช้แอปพลิเคชันภายนอกในการดู คลิก "เปิดด้วยแอปภายนอก" เพื่อดูไฟล์';

        if (file.convertedFromImage) {
          pdfMessage = `ไฟล์ PDF ที่แปลงมาจากรูปภาพ\n(ไฟล์ต้นฉบับ: ${file.originalImageName})\n\n${pdfMessage}`;
        }

        setFileContent(pdfMessage);
      } else {
        setContentType("other");
        setFileContent(
          `ไฟล์ประเภท ${mimeType || "ไม่ทราบ"} ไม่สามารถแสดงผลในแอปได้`
        );
      }
    } catch (error) {
      console.error("Error reading file:", error);
      setContentType("error");
      setFileContent("ไม่สามารถอ่านไฟล์นี้ได้ กรุณาลองใหม่อีกครั้ง");
    }
  };

  const handleCloseModal = () => {
    setShowFileModal(false);
    setSelectedFile(null);
    setSelectedDocTitle("");
    setSelectedFileIndex(0);
    setFileContent(null);
    setContentType("");
    setIsLoadingContent(false);
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const handleOpenUploadedFile = async (file) => {
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

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getUploadStats = () => {
    const documents = generateDocumentsList(surveyData);
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

  return {
    handleShowFileModal,
    handleCloseModal,
    handleOpenUploadedFile,
    loadFileContent,
    formatFileSize,
    getUploadStats,
  };
};
