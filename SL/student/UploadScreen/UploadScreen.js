import { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { db, auth } from "../../database/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  onSnapshot,
  deleteField,
} from "firebase/firestore";
import { storage } from "../../database/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";

// Import refactored modules
import { mergeImagesToPdf } from "./utils/pdfMerger";
import {
  validateDocument,
  showValidationAlert,
  checkAIBackendStatus,
  needsAIValidation,
} from "./documents_ai/UnifiedDocumentAI";
import { generateDocumentsList, calculateAge } from "./utils/documentGenerator";
import { handleDocumentDownload } from "./utils/documentHandlers";

// Import refactored components
import LoadingScreen from "./components/LoadingScreen";
import EmptyState from "./components/EmptyState";
import HeaderSection from "./components/HeaderSection";
import TermInfoCard from "./components/TermInfoCard";
import ProgressCard from "./components/ProgressCard";
import StorageProgressCard from "./components/StorageProgressCard";
import DocumentsSection from "./components/DocumentsSection";
import SubmitSection from "./components/SubmitSection";
import FileDetailModal from "./components/FileDetailModal";

const UploadScreen = ({ navigation, route }) => {
  // State management
  const [surveyData, setSurveyData] = useState(null);
  const [surveyDocId, setSurveyDocId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploads, setUploads] = useState({});
  const [volunteerHours, setVolunteerHours] = useState(0);
  const [uploadProgress, setUploadProgress] = useState({});
  const [showFileModal, setShowFileModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedDocTitle, setSelectedDocTitle] = useState("");
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [fileContent, setFileContent] = useState(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentType, setContentType] = useState("");
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [storageUploadProgress, setStorageUploadProgress] = useState({});
  const [appConfig, setAppConfig] = useState(null);
  const [isConvertingToPDF, setIsConvertingToPDF] = useState({});
  const [isValidatingAI, setIsValidatingAI] = useState({});
  const [aiBackendAvailable, setAiBackendAvailable] = useState(false);
  const [academicYear, setAcademicYear] = useState(null);
  const [term, setTerm] = useState(null);
  const [birthDate, setBirthDate] = useState(null);
  const [document, setDocuments] = useState([]);
  const [userAge, setUserAge] = useState(null);

  // Configuration and initialization
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    await setupConfigListener();
    await checkAIStatus();
  };

  const setupConfigListener = () => {
    const configRef = doc(db, "DocumentService", "config");
    return onSnapshot(
      configRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const config = docSnap.data();
          setAppConfig(config);
          setAcademicYear(config.academicYear);
          setTerm(config.term);
        } else {
          const defaultConfig = { academicYear: "2567", term: "1" };
          setAppConfig(defaultConfig);
          setAcademicYear(defaultConfig.academicYear);
          setTerm(defaultConfig.term);
        }
      },
      (error) => {
        console.error("Error listening to app config:", error);
      }
    );
  };

  const checkAIStatus = async () => {
    const isAvailable = await checkAIBackendStatus();
    setAiBackendAvailable(isAvailable);
    if (!isAvailable) {
      console.warn("AI backend is not available");
    }
  };

  // Data loading effects
  useEffect(() => {
    if (uploads.volunteer_doc) {
      const initialHours = calculateVolunteerHoursFromUploads(uploads);
      setVolunteerHours(initialHours);
    }
  }, [uploads.volunteer_doc]);

  useEffect(() => {
    if (appConfig) {
      checkSubmissionStatus();
    }
  }, [appConfig]);

  useEffect(() => {
    generateDocumentList();
  }, [surveyData, term, academicYear, birthDate]);

  const checkSubmissionStatus = async () => {
    setIsLoading(true);
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    const currentConfig = await getCurrentConfig();
    const termCollectionName = getTermCollectionName(currentConfig);

    const submissionExists = await checkExistingSubmission(
      termCollectionName,
      currentUser.uid
    );
    if (submissionExists) return;

    await loadUserData(currentConfig, currentUser.uid);
    setIsLoading(false);
  };

  const getCurrentConfig = async () => {
    if (appConfig) return appConfig;
    const configDoc = await getDoc(doc(db, "DocumentService", "config"));
    return configDoc?.exists()
      ? configDoc.data()
      : { academicYear: "2567", term: "1" };
  };

  const getTermCollectionName = (config) => {
    return `document_submissions_${config.academicYear || "2567"}_${
      config.term || "1"
    }`;
  };

  const checkExistingSubmission = async (collectionName, userId) => {
    const submissionRef = doc(db, collectionName, userId);
    const submissionDoc = await getDoc(submissionRef);

    if (submissionDoc.exists()) {
      navigation.replace("DocumentStatusScreen", {
        submissionData: submissionDoc.data(),
      });
      setIsLoading(false);
      return true;
    }
    return false;
  };

  const loadUserData = async (config, userId) => {
    const userSurveyRef = doc(db, "users", userId);
    const userSurveyDoc = await getDoc(userSurveyRef);

    if (!userSurveyDoc.exists()) {
      handleNoUserData(config);
      return;
    }

    const userData = userSurveyDoc.data();
    await handleUserData(config, userData, userSurveyDoc.id);
  };

  const handleNoUserData = (config) => {
    if (config.term === "2" || config.term === "3") {
      setSurveyData({ term: config.term });
      setSurveyDocId(null);
    } else {
      setSurveyData(null);
      setSurveyDocId(null);
    }
  };

  const handleUserData = async (config, userData, docId) => {
    if (config.term === "2" || config.term === "3") {
      await setupTerm23Data(config, userData, docId);
    } else {
      await setupTerm1Data(userData, docId);
    }

    if (userData.uploads) {
      setUploads(convertUploadsToNewFormat(userData.uploads));
    }
  };

  const setupTerm23Data = async (config, userData, docId) => {
    setSurveyData({ term: config.term });
    setSurveyDocId(docId);
    await setupBirthDate(userData.birth_date);
  };

  const setupTerm1Data = async (userData, docId) => {
    if (userData.survey) {
      setSurveyData({ ...userData.survey, term: appConfig.term });
      setSurveyDocId(docId);
      await setupBirthDate(userData.birth_date);
    } else {
      setSurveyData(null);
      setSurveyDocId(null);
    }
  };

  const setupBirthDate = async (birthDateData) => {
    setBirthDate(birthDateData);
    if (birthDateData) {
      const age = calculateAge(birthDateData);
      setUserAge(age);
    }
  };

  const convertUploadsToNewFormat = (uploadsData) => {
    const convertedUploads = {};
    Object.keys(uploadsData).forEach((docId) => {
      const upload = uploadsData[docId];
      convertedUploads[docId] = Array.isArray(upload) ? upload : [upload];
    });
    return convertedUploads;
  };

  const generateDocumentList = () => {
    if (term === "2" || term === "3") {
      const docs = generateDocumentsList({
        term,
        academicYear,
        birth_date: birthDate,
      });
      setDocuments(docs);
    } else if (surveyData && term && academicYear && birthDate) {
      const docs = generateDocumentsList({
        ...surveyData,
        term,
        academicYear,
        birth_date: birthDate,
      });
      setDocuments(docs);
    } else if (!surveyData && term === "1") {
      setDocuments([]);
    }
  };

  // File operations
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

    return (
      (mimeType &&
        imageTypes.some((type) => mimeType.toLowerCase().includes(type))) ||
      (filename &&
        imageExtensions.some((ext) => filename.toLowerCase().endsWith(ext)))
    );
  };

  const convertImageToPDF = async (imageFile, docId, fileIndex) => {
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
            @page { margin: 0; size: A4; }
            body { margin: 0; padding: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; }
            img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
          </style>
        </head>
        <body><img src="${base64DataUri}" /></body>
        </html>
      `;

      const { uri: pdfUri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });
      const pdfInfo = await FileSystem.getInfoAsync(pdfUri);
      const originalName = imageFile.filename || imageFile.name || "image";
      const nameWithoutExtension = originalName.replace(/\.[^/.]+$/, "");

      return {
        filename: `${docId}.pdf`,
        uri: pdfUri,
        mimeType: "application/pdf",
        size: pdfInfo.size,
        uploadDate: new Date().toLocaleString("th-TH"),
        status: "pending",
        aiValidated: needsAIValidation(docId),
        fileIndex,
        convertedFromImage: true,
        originalImageName: imageFile.filename ?? null,
        originalImageType: imageFile.mimeType ?? null,
      };
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

  const calculateVolunteerHoursFromUploads = (uploadsData) => {
    const volunteerFiles = uploadsData.volunteer_doc || [];
    return volunteerFiles.reduce((total, file) => total + (file.hours || 0), 0);
  };

  // AI Validation
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
      return true;
    }

    setIsValidatingAI((prev) => ({ ...prev, [docId]: true }));

    try {
      const validationResult = await validateDocument(
        file.uri,
        docId,
        null,
        file.mimeType
      );

      if (docId === "volunteer_doc") {
        return handleVolunteerDocumentValidation(validationResult, file, docId);
      }

      return new Promise((resolve) => {
        showValidationAlert(
          validationResult,
          docId,
          () => resolve(true),
          () => resolve(false)
        );
      });
    } catch (error) {
      console.error("AI validation error:", error);
      return handleAIValidationError(error);
    } finally {
      setIsValidatingAI((prev) => {
        const newState = { ...prev };
        delete newState[docId];
        return newState;
      });
    }
  };

  const handleVolunteerDocumentValidation = (validationResult, file, docId) => {
    const hours = validationResult.accumulatedHours || 0;

    setVolunteerHours((prev) => {
      const newTotal = prev + hours;
      if (newTotal >= 36) {
        Alert.alert("ครบชั่วโมงจิตอาสาแล้ว", `คุณสะสมครบ ${newTotal} ชั่วโมง`);
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
          { text: "ยกเลิก", style: "cancel", onPress: () => resolve(false) },
          { text: "ใช้ไฟล์นี้", onPress: () => resolve(true) },
        ]
      );
    });
  };

  const handleAIValidationError = (error) => {
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
  };

  // Storage operations
  const uploadFileToStorage = async (
    file,
    docId,
    fileIndex,
    userId,
    studentName,
    config,
    studentId
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
          (error) => reject(error),
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              setStorageUploadProgress((prev) => {
                const newState = { ...prev };
                delete newState[`${docId}_${fileIndex}`];
                return newState;
              });

              resolve({
                downloadURL,
                storagePath,
                uploadedAt: new Date().toISOString(),
                originalFileName: file.filename,
                fileSize: file.size,
                mimeType: file.mimeType,
                academicYear,
                term,
                studentFolder: sanitizedStudentName,
                ...(file.convertedFromImage && {
                  convertedFromImage: true,
                  originalImageName: file.originalImageName,
                  originalImageType: file.originalImageType,
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

  // Document handling
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
      let processedFiles = [];

      if (docId === "form_101") {
        processedFiles = await processForm101Files(files, docId);
      } else {
        processedFiles = await processOtherDocumentFiles(files, docId);
      }

      if (processedFiles.length > 0) {
        await updateUploadsWithFiles(docId, processedFiles);
      }
    } catch (error) {
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถเลือกไฟล์ได้");
      console.error(error);
    }
  };

  const processForm101Files = async (files, docId) => {
    if (files.length > 4) {
      Alert.alert(
        "ข้อผิดพลาด",
        "เอกสาร Form 101 สามารถอัปโหลดได้สูงสุด 4 ไฟล์เท่านั้น"
      );
      return [];
    }

    const imagesToProcess = files.filter((file) =>
      isImageFile(file.mimeType, file.name)
    );
    const otherFiles = files.filter(
      (file) => !isImageFile(file.mimeType, file.name)
    );
    const processedFiles = [];

    // Process non-image files
    for (const file of otherFiles) {
      const validatedFile = await processAndValidateFile(
        file,
        docId,
        processedFiles.length
      );
      if (validatedFile) processedFiles.push(validatedFile);
    }

    // Process images
    if (imagesToProcess.length > 0) {
      const mergedFile = await mergeAndValidateImages(imagesToProcess, docId);
      if (mergedFile) processedFiles.push(mergedFile);
    }

    return processedFiles;
  };

  const processOtherDocumentFiles = async (files, docId) => {
    const processedFiles = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const processedFile = await processSingleFile(
        file,
        docId,
        i,
        processedFiles.length
      );
      if (processedFile) processedFiles.push(processedFile);
    }

    return processedFiles;
  };

  const processAndValidateFile = async (file, docId, currentIndex) => {
    const fileWithMetadata = createFileMetadata(file, docId, currentIndex);

    if (needsAIValidation(docId)) {
      const isValid = await performAIValidation(fileWithMetadata, docId);
      if (!isValid) return null;
    }

    return fileWithMetadata;
  };

  const mergeAndValidateImages = async (images, docId) => {
    setIsConvertingToPDF((prev) => ({ ...prev, [`${docId}_merge`]: true }));

    try {
      const mergedPdfFile = await mergeImagesToPdf(images, docId);

      if (needsAIValidation(docId)) {
        const isValid = await performAIValidation(mergedPdfFile, docId);
        if (!isValid) return null;
      }

      return mergedPdfFile;
    } catch (error) {
      console.error("Error merging images to PDF:", error);
      Alert.alert(
        "ข้อผิดพลาด",
        `ไม่สามารถรวมรูปภาพเป็น PDF ได้: ${error.message}`
      );
      return null;
    } finally {
      setIsConvertingToPDF((prev) => {
        const newState = { ...prev };
        delete newState[`${docId}_merge`];
        return newState;
      });
    }
  };

  const processSingleFile = async (
    file,
    docId,
    originalIndex,
    currentIndex
  ) => {
    let processedFile = file;
    const originalMetadata = {
      filename: file.filename ?? file.name,
      mimeType: file.mimeType,
      size: file.size,
      uri: file.uri,
    };

    if (isImageFile(file.mimeType, file.name)) {
      try {
        const convertedPdf = await convertImageToPDF(
          file,
          docId,
          originalIndex
        );
        processedFile = { ...originalMetadata, ...convertedPdf };
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
    }

    if (needsAIValidation(docId)) {
      const isValid = await performAIValidation(processedFile, docId);
      if (!isValid) return null;
    }

    return createFileMetadata(
      processedFile,
      docId,
      currentIndex,
      processedFile.convertedFromImage
    );
  };

  const createFileMetadata = (file, docId, fileIndex, isConverted = false) => {
    const metadata = {
      filename: file.filename,
      uri: file.uri,
      mimeType: file.mimeType,
      size: file.size,
      uploadDate: new Date().toLocaleString("th-TH"),
      status: "pending",
      aiValidated: needsAIValidation(docId),
      fileIndex,
    };

    if (isConverted) {
      metadata.convertedFromImage = true;
      metadata.originalImageName = file.originalImageName;
      metadata.originalImageType = file.originalImageType;
    }

    return metadata;
  };

  const updateUploadsWithFiles = async (docId, processedFiles) => {
    const newUploads = {
      ...uploads,
      [docId]: [...(uploads[docId] || []), ...processedFiles],
    };

    setUploads(newUploads);
    await saveUploadsToFirebase(newUploads);
  };

  const handleRemoveFile = async (docId, fileIndex = null) => {
    const docFiles = uploads[docId] || [];

    if (fileIndex !== null && fileIndex >= 0 && fileIndex < docFiles.length) {
      await removeSingleFile(docId, fileIndex, docFiles);
    } else {
      await removeAllFiles(docId, docFiles);
    }
  };

  const removeSingleFile = async (docId, fileIndex, docFiles) => {
    const fileToRemove = docFiles[fileIndex];

    Alert.alert(
      "ลบไฟล์",
      `คุณต้องการลบไฟล์ "${fileToRemove.filename}" หรือไม่?`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ลบ",
          style: "destructive",
          onPress: () => executeFileRemoval(docId, fileIndex, docFiles),
        },
      ]
    );
  };

  const removeAllFiles = async (docId, docFiles) => {
    Alert.alert(
      "ลบไฟล์ทั้งหมด",
      `คุณต้องการลบไฟล์ทั้งหมด (${docFiles.length} ไฟล์) สำหรับเอกสารนี้หรือไม่?`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ลบทั้งหมด",
          style: "destructive",
          onPress: () => executeAllFilesRemoval(docId, docFiles),
        },
      ]
    );
  };

  const executeFileRemoval = async (docId, fileIndex, docFiles) => {
    const fileToRemove = docFiles[fileIndex];
    await cleanupTemporaryFile(fileToRemove);

    const newFiles = docFiles.filter((_, index) => index !== fileIndex);
    await updateUploadsAfterRemoval(docId, newFiles, fileIndex !== null);
  };

  const executeAllFilesRemoval = async (docId, docFiles) => {
    await Promise.all(docFiles.map((file) => cleanupTemporaryFile(file)));
    await updateUploadsAfterRemoval(docId, [], false);
  };

  const cleanupTemporaryFile = async (file) => {
    if (file.convertedFromImage && file.uri) {
      try {
        await FileSystem.deleteAsync(file.uri, { idempotent: true });
      } catch (cleanupError) {
        console.warn("Could not clean up temporary file:", cleanupError);
      }
    }
  };

  const updateUploadsAfterRemoval = async (docId, newFiles, isSingleFile) => {
    const newUploads = { ...uploads };

    if (newFiles.length === 0) {
      delete newUploads[docId];
    } else {
      newFiles.forEach((file, index) => {
        file.fileIndex = index;
      });
      newUploads[docId] = newFiles;
    }

    if (docId === "volunteer_doc") {
      const newHours = calculateVolunteerHoursFromUploads(newUploads);
      setVolunteerHours(newHours);
    }

    setUploads(newUploads);
    await saveUploadsToFirebase(newUploads);
    if (isSingleFile) handleCloseModal();
  };

  // Submission handling
  const handleSubmitDocuments = async () => {
    if (!validateRequiredDocuments()) return;

    setIsSubmitting(true);

    try {
      const submissionResult = await processDocumentSubmission();
      if (submissionResult) {
        showSubmissionSuccess(submissionResult);
      }
    } catch (error) {
      handleSubmissionError(error);
    } finally {
      setIsSubmitting(false);
      setStorageUploadProgress({});
    }
  };

  const validateRequiredDocuments = () => {
    const documents = generateDocumentsList(surveyData);
    const requiredDocs = documents.filter((doc) => doc.required);
    const uploadedRequiredDocs = requiredDocs.filter(
      (doc) => uploads[doc.id]?.length > 0
    );

    if (uploadedRequiredDocs.length < requiredDocs.length) {
      Alert.alert(
        "เอกสารไม่ครบ",
        `คุณยังอัปโหลดเอกสารไม่ครบ (${uploadedRequiredDocs.length}/${requiredDocs.length})`,
        [{ text: "ตกลง" }]
      );
      return false;
    }
    return true;
  };

  const processDocumentSubmission = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("เกิดข้อผิดพลาด", "ไม่พบข้อมูลผู้ใช้");
      return null;
    }

    const userInfo = await getUserInfo(currentUser.uid);
    const storageUploads = await uploadAllFilesToStorage(
      currentUser.uid,
      userInfo
    );

    return await createSubmission(currentUser, userInfo, storageUploads);
  };

  const getUserInfo = async (userId) => {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        studentId: userData.student_id || "Unknown_Student",
        studentName:
          userData.profile?.student_name ||
          userData.name ||
          userData.nickname ||
          "Unknown_Student",
        citizenId: userData.citizen_id,
      };
    }

    return {
      studentId: "Unknown_Student",
      studentName: "Unknown_Student",
      citizenId: "Unknown_CitizenID",
    };
  };

  const uploadAllFilesToStorage = async (userId, userInfo) => {
    const storageUploads = {};

    for (const [docId, files] of Object.entries(uploads)) {
      const uploadedFiles = [];

      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        try {
          const storageData = await uploadFileToStorage(
            file,
            docId,
            fileIndex,
            userId,
            userInfo.studentName,
            appConfig,
            userInfo.studentId
          );

          uploadedFiles.push(
            createStorageFileMetadata(file, storageData, fileIndex)
          );
        } catch (error) {
          console.error(`Failed to upload file ${file.filename}:`, error);
          Alert.alert(
            "ข้อผิดพลาดในการอัปโหลด",
            `ไม่สามารถอัปโหลดไฟล์ ${file.filename} ได้: ${error.message}`
          );
          throw error;
        }
      }

      storageUploads[docId] = uploadedFiles;
    }

    return storageUploads;
  };

  const createStorageFileMetadata = (file, storageData, fileIndex) => {
    return {
      filename: storageData.originalFileName,
      mimeType: storageData.mimeType,
      size: storageData.fileSize,
      downloadURL: storageData.downloadURL,
      storagePath: storageData.storagePath,
      uploadedAt: storageData.uploadedAt,
      storageUploaded: true,
      status: "uploaded_to_storage",
      fileIndex,
      convertedFromImage: storageData.convertedFromImage || false,
      originalImageName: storageData.originalImageName,
      originalImageType: storageData.originalImageType,
    };
  };

  const createSubmission = async (currentUser, userInfo, storageUploads) => {
    const academicYear = appConfig?.academicYear || "2568";
    const term = appConfig?.term || "1";

    const submissionData = {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      student_id: userInfo.studentId,
      citizen_id: userInfo.citizenId,
      surveyData,
      uploads: storageUploads,
      submittedAt: new Date().toISOString(),
      status: "submitted",
      academicYear,
      term,
      submissionTerm: term,
      documentStatuses: createDocumentStatuses(storageUploads),
    };

    const submissionRef = doc(
      db,
      `document_submissions_${academicYear}_${term}`,
      currentUser.uid
    );
    await setDoc(submissionRef, submissionData);

    await updateUserSubmissionInfo(currentUser.uid, storageUploads, term);

    return {
      submissionData,
      totalFiles: calculateTotalFiles(storageUploads),
      convertedFiles: calculateConvertedFiles(storageUploads),
    };
  };

  const createDocumentStatuses = (storageUploads) => {
    const statuses = {};
    Object.keys(storageUploads).forEach((docId) => {
      statuses[docId] = {
        status: "pending",
        reviewedAt: null,
        reviewedBy: null,
        comments: "",
        fileCount: storageUploads[docId].length,
      };
    });
    return statuses;
  };

  const updateUserSubmissionInfo = async (userId, storageUploads, term) => {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      lastSubmissionAt: new Date().toISOString(),
      hasSubmittedDocuments: true,
      uploads: storageUploads,
      lastSubmissionTerm: term,
    });
  };

  const calculateTotalFiles = (storageUploads) => {
    return Object.values(storageUploads).reduce(
      (sum, files) => sum + files.length,
      0
    );
  };

  const calculateConvertedFiles = (storageUploads) => {
    return Object.values(storageUploads)
      .flat()
      .filter((file) => file.convertedFromImage).length;
  };

  const showSubmissionSuccess = (result) => {
    let successMessage = `เอกสารของคุณได้ถูกส่งและอัปโหลดเรียบร้อยแล้ว\nจำนวนไฟล์: ${result.totalFiles} ไฟล์`;

    if (result.convertedFiles > 0) {
      successMessage += `\nไฟล์ที่แปลงเป็น PDF: ${result.convertedFiles} ไฟล์`;
    }

    successMessage += `\nปีการศึกษา: ${appConfig?.academicYear} เทอม: ${appConfig?.term}\nคุณสามารถติดตามได้ในหน้าแสดงผล`;

    Alert.alert("ส่งเอกสารสำเร็จ", successMessage, [
      {
        text: "ดูสถานะ",
        onPress: () => {
          navigation.push("DocumentStatusScreen", {
            submissionData: result.submissionData,
          });
        },
      },
    ]);
  };

  const handleSubmissionError = (error) => {
    console.error("Error submitting documents:", error);
    Alert.alert(
      "เกิดข้อผิดพลาด",
      `ไม่สามารถส่งเอกสารได้: ${error.message}\nกรุณาลองใหม่อีกครั้ง`
    );
  };

  // Survey management
  const deleteSurveyData = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        survey: deleteField(),
        uploads: deleteField(),
      });
    } catch (error) {
      console.error("Error deleting survey data: ", error);
      Alert.alert("Error", "Failed to delete survey data.");
    }
  };

  const handleRetakeSurvey = () => {
    Alert.alert(
      "ทำแบบสอบถามใหม่",
      "การทำแบบสอบถามใหม่จะลบข้อมูลและไฟล์ที่อัปโหลดทั้งหมด\nคุณแน่ใจหรือไม่?",
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ตกลง",
          style: "destructive",
          onPress: async () => {
            await deleteSurveyData();
            setSurveyData(null);
            setUploads({});
            setUploadProgress({});
            setStorageUploadProgress({});
          },
        },
      ]
    );
  };

  const handleStartSurvey = () => {
    navigation.navigate("Document Reccommend", {
      onSurveyComplete: (data) => {
        setSurveyData(data);
      },
    });
  };

  // Modal handlers
  const handleShowFileModal = async (docId, docTitle, fileIndex = 0) => {
    const files = uploads[docId];
    if (files && files[fileIndex]) {
      setSelectedFile(files[fileIndex]);
      setSelectedDocTitle(`${docTitle} (${fileIndex + 1}/${files.length})`);
      setSelectedFileIndex(fileIndex);
      setShowFileModal(true);
      setIsLoadingContent(true);

      try {
        await loadFileContent(files[fileIndex]);
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
        /\.(jpg|jpeg|png|gif|bmp|webp)$/.test(fileName)
      ) {
        setContentType("image");
        setFileContent(file.uri);
      } else if (
        mimeType.includes("text/") ||
        mimeType.includes("json") ||
        /\.(txt|json)$/.test(fileName)
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

  // Utility functions
  const getUploadStats = () => {
    const documents = generateDocumentsList(surveyData);
    const requiredDocs = documents.filter((doc) => doc.required);
    const uploadedDocs = documents.filter((doc) => uploads[doc.id]?.length > 0);
    const uploadedRequiredDocs = requiredDocs.filter(
      (doc) => uploads[doc.id]?.length > 0
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
      totalFiles,
      convertedFiles,
    };
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Render logic
  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!surveyData) {
    return <EmptyState onStartSurvey={handleStartSurvey} />;
  }

  const documents = generateDocumentsList(surveyData);
  const stats = getUploadStats();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <HeaderSection
        surveyData={surveyData}
        onRetakeSurvey={handleRetakeSurvey}
      />
      {appConfig && <TermInfoCard appConfig={appConfig} />}
      <ProgressCard stats={stats} />
      {(Object.keys(storageUploadProgress).length > 0 ||
        Object.keys(isConvertingToPDF).length > 0) && (
        <StorageProgressCard
          storageUploadProgress={storageUploadProgress}
          uploads={uploads}
          isConvertingToPDF={isConvertingToPDF}
        />
      )}
      <DocumentsSection
        documents={documents}
        uploads={uploads}
        onFileUpload={handleFileUpload}
        onRemoveFile={handleRemoveFile}
        onShowFileModal={handleShowFileModal}
        onDownloadDocument={handleDocumentDownload}
        formatFileSize={formatFileSize}
        isValidatingAI={isValidatingAI}
        aiBackendAvailable={aiBackendAvailable}
        volunteerHours={volunteerHours}
        isConvertingToPDF={isConvertingToPDF}
      />
      <SubmitSection
        stats={stats}
        isSubmitting={isSubmitting}
        storageUploadProgress={storageUploadProgress}
        onSubmit={handleSubmitDocuments}
      />
      <FileDetailModal
        visible={showFileModal}
        onClose={handleCloseModal}
        selectedFile={selectedFile}
        selectedDocTitle={selectedDocTitle}
        fileContent={fileContent}
        contentType={contentType}
        isLoadingContent={isLoadingContent}
        formatFileSize={formatFileSize}
        handleOpenUploadedFile={handleOpenUploadedFile}
        handleRemoveFile={handleRemoveFile}
        imageZoom={imageZoom}
        setImageZoom={setImageZoom}
        setImagePosition={setImagePosition}
        loadFileContent={loadFileContent}
        selectedFileIndex={selectedFileIndex}
        totalFiles={uploads[selectedFile?.docId]?.length || 0}
        onNavigateFile={(direction) => {
          const currentDocFiles = uploads[selectedFile?.docId] || [];
          const newIndex =
            direction === "next"
              ? Math.min(selectedFileIndex + 1, currentDocFiles.length - 1)
              : Math.max(selectedFileIndex - 1, 0);
          handleShowFileModal(
            selectedFile?.docId,
            selectedDocTitle.split(" (")[0],
            newIndex
          );
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f8fafc",
    padding: 16,
  },
});

export default UploadScreen;
