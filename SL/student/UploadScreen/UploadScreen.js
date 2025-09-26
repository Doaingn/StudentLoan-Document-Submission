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
// Import for PDF creation
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { mergeImagesToPdf } from './utils/pdfMerger';

// Import refactored AI validation modules
import {
  validateDocument,
  showValidationAlert,
  checkAIBackendStatus,
  needsAIValidation,
} from "./documents_ai/UnifiedDocumentAI";

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
import { generateDocumentsList, calculateAge } from "./utils/documentGenerator";
import { handleDocumentDownload } from "./utils/documentHandlers";

const UploadScreen = ({ navigation, route }) => {
  // State management
  const [surveyData, setSurveyData] = useState(null);
  const [surveyDocId, setSurveyDocId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // Updated: Change uploads structure to support multiple files per document
  const [uploads, setUploads] = useState({});
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

  // AI related states - UPDATED to use unified AI system
  const [isValidatingAI, setIsValidatingAI] = useState({});
  const [aiBackendAvailable, setAiBackendAvailable] = useState(false);

  const [academicYear, setAcademicYear] = useState(null);
  const [term, setTerm] = useState(null);
  const [birthDate, setBirthDate] = useState(null); // เก็บ Timestamp object ของวันเกิด
  const [document, setDocuments] = useState([]);
  const [userAge, setUserAge] = useState(null); // เพิ่มสำหรับเก็บอายุที่คำนวณได้

  // Check AI backend status on component mount - UPDATED to use unified AI system
  useEffect(() => {
    const checkAIStatus = async () => {
      const isAvailable = await checkAIBackendStatus();
      setAiBackendAvailable(isAvailable);
      if (!isAvailable) {
        console.warn("AI backend is not available");
      }
    };
    checkAIStatus();
  }, []);

  // -----------------------------------------------------
  // 1. Config Listener (Term และ Academic Year)
  // -----------------------------------------------------
  useEffect(() => {
      const configRef = doc(db, "DocumentService", "config");
      
      const configUnsubscribe = onSnapshot(configRef, (docSnap) => {
          if (docSnap.exists()) {
              const config = docSnap.data();
              if (config) {
                setAppConfig(config);
                setAcademicYear(config.academicYear);
                setTerm(config.term);
              } else {
                console.warn("ไม่พบ config document");
              }
          } else {
              // ใช้ค่า Default หาก config document ไม่มี
              const defaultConfig = { academicYear: "2567", term: "1" };
              setAppConfig(defaultConfig);
              setAcademicYear(defaultConfig.academicYear);
              setTerm(defaultConfig.term);
          }
      }, (error) => {
          console.error("Error listening to app config:", error);
      });

      return () => configUnsubscribe();
  }, []); // เรียกใช้ครั้งเดียวเมื่อ Component Mount

  // -----------------------------------------------------
  // 2. Check submission status and load data (ปรับปรุงการดึงข้อมูลอย่างปลอดภัย)
  // -----------------------------------------------------
  useEffect(() => {
    const checkSubmissionStatus = async () => {
      setIsLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      // ***** แก้ไขส่วนที่ 1: ดึง Config อย่างปลอดภัย *****
      let currentConfig = appConfig;
      if (!currentConfig) {
          const configDoc = await getDoc(doc(db, "DocumentService", "config"));
          currentConfig = (configDoc && configDoc.exists()) 
              ? configDoc.data() 
              : { academicYear: "2567", term: "1" };
      }
      
      // ***** ตรวจสอบ Submission status สำหรับ term ปัจจุบัน *****
      const termCollectionName = `document_submissions_${
        currentConfig.academicYear || "2567"
      }_${currentConfig.term || "1"}`;
      
      console.log(`🔍 Checking submission for collection: ${termCollectionName}`);
      
      const submissionRef = doc(db, termCollectionName, currentUser.uid);
      const submissionDoc = await getDoc(submissionRef);
      
      if (submissionDoc.exists()) {
        console.log("✅ Found existing submission, redirecting to status screen");
        navigation.replace("DocumentStatusScreen", {
          submissionData: submissionDoc.data(),
        });
        setIsLoading(false);
        return;
      } else {
        console.log("📝 No submission found, loading upload screen");
      }

      // ***** ดึงข้อมูล User และ Survey Data *****
      const userSurveyRef = doc(db, "users", currentUser.uid);
      const userSurveyDoc = await getDoc(userSurveyRef);

      if (userSurveyDoc.exists()) {
        const userData = userSurveyDoc.data();
        
        // ***** สำหรับเทอม 2/3: ไม่จำเป็นต้องมี survey data *****
        if (currentConfig.term === '2' || currentConfig.term === '3') {
          console.log(`🎓 Term ${currentConfig.term}: Setting up without survey requirement`);
          
          // ใช้ข้อมูล birth_date จาก user document
          const birthDateFromUser = userData.birth_date;
          setBirthDate(birthDateFromUser);
          
          if (birthDateFromUser) {
            const age = calculateAge(birthDateFromUser);
            setUserAge(age);
            console.log(`👤 User age calculated: ${age} years`);
          }
          
          // สำหรับเทอม 2/3 ไม่ต้องมี survey data
          setSurveyData({ term: currentConfig.term });
          setSurveyDocId(userSurveyDoc.id);
        } else {
          // ***** สำหรับเทอม 1: ต้องมี survey data *****
          const surveyData = userData.survey;
          if (surveyData) {
            setSurveyData({...surveyData, term: currentConfig.term });
            setSurveyDocId(userSurveyDoc.id);
            
            // ดึง birth_date จาก survey หรือ user data
            const birthDateData = userData.birth_date;
            setBirthDate(birthDateData);
            
            if (birthDateData) {
              const age = calculateAge(birthDateData);
              setUserAge(age);
              console.log(`👤 User age calculated: ${age} years`);
            }
          } else {
            console.log("❌ Term 1 requires survey data but none found");
            setSurveyData(null);
            setSurveyDocId(null);
          }
        }

        // ***** ดึงข้อมูล uploads ที่มีอยู่ *****
        if (userData.uploads) {
          // Convert old format to new format if needed
          const convertedUploads = {};
          Object.keys(userData.uploads).forEach(docId => {
            const upload = userData.uploads[docId];
            if (Array.isArray(upload)) {
              convertedUploads[docId] = upload;
            } else {
              // Convert single file to array format
              convertedUploads[docId] = [upload];
            }
          });
          setUploads(convertedUploads);
        }
      } else {
        // ไม่พบข้อมูล user
        if (currentConfig.term === '2' || currentConfig.term === '3') {
          console.log(`🎓 Term ${currentConfig.term}: Creating minimal data without survey requirement`);
          // สำหรับเทอม 2/3 ไม่จำเป็นต้องมี survey data
          setSurveyData({ term: currentConfig.term });
          setSurveyDocId(null);
        } else {
          console.log("❌ Term 1 requires user data but none found");
          setSurveyData(null);
          setSurveyDocId(null);
        }
      }
      setIsLoading(false);
    };

    // เรียกใช้เมื่อ appConfig ถูกโหลดแล้ว
    if (appConfig) {
        checkSubmissionStatus();
    }
    
  }, [appConfig]); 

  // -----------------------------------------------------
  // 3. Document List Generator (สร้างรายการเอกสาร)
  // -----------------------------------------------------
  useEffect(() => {
    // สำหรับเทอม 2/3: ใช้ birthDate และ term ในการสร้างรายการ
    if (term === '2' || term === '3') {
      console.log(`🎓 Generating documents for Term ${term}`);
      const docs = generateDocumentsList({
          term: term,
          academicYear: academicYear,
          birth_date: birthDate,
      });
      setDocuments(docs);
      console.log(`📋 Generated ${docs.length} documents for Term ${term}`);
    }
    // สำหรับเทอม 1: ต้องมีข้อมูลที่จำเป็นครบถ้วน
    else if (surveyData && term && academicYear && birthDate) {
      console.log(`🎓 Generating documents for Term ${term}`);
      const docs = generateDocumentsList({
          ...surveyData, // ส่ง surveyData เดิม (familyStatus, incomes)
          term: term,
          academicYear: academicYear,
          birth_date: birthDate, // ส่ง birth date (Timestamp) เพื่อคำนวดอายุ
      });
      setDocuments(docs);
      console.log(`📋 Generated ${docs.length} documents for Term ${term}`);
    } else if (!surveyData && term === '1') {
      // หาก term 1 แต่ยังไม่มี surveyData ให้เคลียร์รายการเอกสาร
      console.log("❌ Term 1 without survey data - clearing document list");
      setDocuments([]); 
    }
  }, [surveyData, term, academicYear, birthDate]); // เรียกใช้เมื่อข้อมูลเหล่านี้มีการเปลี่ยนแปลง

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

  const isImageFile = (mimeType, filename) => {
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    
    if (mimeType && imageTypes.some(type => mimeType.toLowerCase().includes(type))) {
      return true;
    }
    
    if (filename && imageExtensions.some(ext => filename.toLowerCase().endsWith(ext))) {
      return true;
    }
    
    return false;
  };

  // Function to convert image to PDF
  const convertImageToPDF = async (imageFile, docId, fileIndex) => {
    try {
      setIsConvertingToPDF((prev) => ({
        ...prev,
        [`${docId}_${fileIndex}`]: true,
      }));

      const base64Image = await FileSystem.readAsStringAsync(imageFile.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const mimeType = imageFile.mimeType || 'image/jpeg';
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
      const originalName = imageFile.filename || imageFile.name || 'image';
      const nameWithoutExtension = originalName.replace(/\.[^/.]+$/, "");

      const pdfFile = {
        filename: `${docId}.pdf`,
        uri: pdfUri,
        mimeType: 'application/pdf',
        size: pdfInfo.size,
        uploadDate: new Date().toLocaleString("th-TH"),
        status: "pending",
        aiValidated: needsAIValidation(docId), // Updated to use unified AI system
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

  // UPDATED: AI validation function to use unified AI system
  const performAIValidation = async (file, docId) => {
    if (!aiBackendAvailable) {
      Alert.alert(
        "ระบบ AI ไม่พร้อมใช้งาน",
        "ไม่สามารถตรวจสอบเอกสารด้วย AI ได้ในขณะนี้ คุณสามารถดำเนินการต่อได้",
        [{ text: "ตกลง" }]
      );
      return true; // Allow to continue if AI is not available
    }

    // Check if this document type needs AI validation
    if (!needsAIValidation(docId)) {
      console.log(`Document ${docId} does not need AI validation`);
      return true;
    }

    setIsValidatingAI((prev) => ({ ...prev, [docId]: true }));

    try {
      console.log(`🤖 Starting AI validation for ${docId}`);
      
      // Use the unified validation function
      const validationResult = await validateDocument(file.uri, docId, null, file.mimeType);

      return new Promise((resolve) => {
        showValidationAlert(
          validationResult,
          docId,
          () => {
            console.log(`✓ AI Validation passed for ${file.filename} (${docId})`);
            resolve(true);
          },
          () => {
            console.log(`✗ AI Validation failed for ${file.filename} (${docId})`);
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

  // Upload file to Firebase Storage
  const uploadFileToStorage = async (
    file,
    docId,
    fileIndex,
    userId,
    studentName,
    config,
    studentId,
  ) => {
    try {
      const sanitizedStudentName = (studentName ?? 'Unknown_Student')
        .replace(/[.#$[\]/\\]/g, "_")
        .replace(/\s+/g, "_");
      
      // Use PDF extension for converted files, or original extension
      const fileExtension = file.convertedFromImage ? 'pdf' : (file.filename?.split(".").pop() || 'unknown');
      
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

  // Delete survey data
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

  // Handle retake survey
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

  // Handle start survey
  const handleStartSurvey = () => {
    navigation.navigate("Document Reccommend", {
      onSurveyComplete: (data) => {
        setSurveyData(data);
      },
    });
  };

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
        "image/webp"
      ],
      copyToCacheDirectory: true,
      multiple: allowMultiple,
    });

      if (result.canceled) return;

      const files = result.assets;
      const processedFiles = [];

      if (docId === 'form_101') {
        if (files.length > 4) {
          Alert.alert("ข้อผิดพลาด", "เอกสาร Form 101 สามารถอัปโหลดได้สูงสุด 4 ไฟล์เท่านั้น");
          return;
        }
        
        const imagesToProcess = files.filter(file => isImageFile(file.mimeType, file.name));
        const otherFiles = files.filter(file => !isImageFile(file.mimeType, file.name));

        for (const file of otherFiles) {
          processedFiles.push({
            filename: file.name ?? null,
            uri: file.uri ?? null,
            mimeType: file.mimeType ?? null,
            size: file.size ?? null,
            uploadDate: new Date().toLocaleString("th-TH"),
            status: "pending",
            aiValidated: needsAIValidation(docId), // Updated to use unified AI system
            fileIndex: (uploads[docId] || []).length + processedFiles.length,
          });
        }

        if (imagesToProcess.length > 0) {
          setIsConvertingToPDF(prev => ({
            ...prev,
            [`${docId}_merge`]: true
          }));
          
          try {
            const mergedPdfFile = await mergeImagesToPdf(imagesToProcess, docId);
            processedFiles.push(mergedPdfFile);
          } catch (error) {
            console.error("Error merging images to PDF:", error);
            Alert.alert("ข้อผิดพลาด", `ไม่สามารถรวมรูปภาพเป็น PDF ได้: ${error.message}`);
            setIsConvertingToPDF(prev => {
              const newState = { ...prev };
              delete newState[`${docId}_merge`];
              return newState;
            });
            return;
          } finally {
            setIsConvertingToPDF(prev => {
              const newState = { ...prev };
              delete newState[`${docId}_merge`];
              return newState;
            });
          }
        }

      } else {
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
                mimeType: 'application/pdf',
              };
            } catch (conversionError) {
              console.error('PDF conversion failed:', conversionError);
              Alert.alert("การแปลงล้มเหลว", `ไม่สามารถแปลงไฟล์ "${file.name ?? 'ไม่ทราบชื่อไฟล์'}" เป็น PDF ได้ จะใช้ไฟล์ต้นฉบับแทน`);
              processedFile = file;
            }
          } else {
            processedFile = originalMetadata;
          }
          
          // AI validation for documents that need it - UPDATED to use unified system
          if (needsAIValidation(docId)) {
            const isValid = await performAIValidation(processedFile, docId);
            if (!isValid) {
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
            aiValidated: needsAIValidation(docId), // Updated to use unified AI system
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
      
      const newUploads = {
        ...uploads,
        [docId]: [...(uploads[docId] || []), ...processedFiles],
      };

      setUploads(newUploads);
      await saveUploadsToFirebase(newUploads);

    } catch (error) {
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถเลือกไฟล์ได้");
      console.error(error);
    }
  };

  // Rest of the component methods remain the same...
  // Updated: Handle remove specific file from document
  const handleRemoveFile = async (docId, fileIndex = null) => {
    const docFiles = uploads[docId] || [];
    
    if (fileIndex !== null && fileIndex >= 0 && fileIndex < docFiles.length) {
      // Remove specific file
      const fileToRemove = docFiles[fileIndex];
      Alert.alert(
        "ลบไฟล์",
        `คุณต้องการลบไฟล์ "${fileToRemove.filename}" หรือไม่?`,
        [
          { text: "ยกเลิก", style: "cancel" },
          {
            text: "ลบ",
            style: "destructive",
            onPress: async () => {
              const newFiles = docFiles.filter((_, index) => index !== fileIndex);
              
              // Clean up temporary PDF files if they were converted from images
              if (fileToRemove.convertedFromImage && fileToRemove.uri) {
                try {
                  await FileSystem.deleteAsync(fileToRemove.uri, { idempotent: true });
                  console.log('✓ Cleaned up temporary PDF file');
                } catch (cleanupError) {
                  console.warn('Could not clean up temporary file:', cleanupError);
                }
              }
              
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
              
              setUploads(newUploads);
              await saveUploadsToFirebase(newUploads);
              handleCloseModal();
            },
          },
        ]
      );
    } else {
      // Remove all files for this document
      Alert.alert(
        "ลบไฟล์ทั้งหมด",
        `คุณต้องการลบไฟล์ทั้งหมด (${docFiles.length} ไฟล์) สำหรับเอกสารนี้หรือไม่?`,
        [
          { text: "ยกเลิก", style: "cancel" },
          {
            text: "ลบทั้งหมด",
            style: "destructive",
            onPress: async () => {
              // Clean up temporary PDF files
              for (const file of docFiles) {
                if (file.convertedFromImage && file.uri) {
                  try {
                    await FileSystem.deleteAsync(file.uri, { idempotent: true });
                  } catch (cleanupError) {
                    console.warn('Could not clean up temporary file:', cleanupError);
                  }
                }
              }
              
              const newUploads = { ...uploads };
              delete newUploads[docId];
              setUploads(newUploads);
              await saveUploadsToFirebase(newUploads);
              handleCloseModal();
            },
          },
        ]
      );
    }
  };

  // Rest of the methods remain identical to the original file...
  const handleSubmitDocuments = async () => {
    const documents = generateDocumentsList(surveyData);
    const requiredDocs = documents.filter((doc) => doc.required);
    const uploadedRequiredDocs = requiredDocs.filter((doc) => uploads[doc.id] && uploads[doc.id].length > 0);

    if (uploadedRequiredDocs.length < requiredDocs.length) {
      Alert.alert(
        "เอกสารไม่ครบ",
        `คุณยังอัปโหลดเอกสารไม่ครบ (${uploadedRequiredDocs.length}/${requiredDocs.length})`,
        [{ text: "ตกลง" }]
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert("เกิดข้อผิดพลาด", "ไม่พบข้อมูลผู้ใช้");
        setIsSubmitting(false);
        return;
      }

      let studentId = "Unknown_Student";
      let studentName = "Unknown_Student";
      let citizenId = "Unknown_CitizenID";

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          studentId = userData.student_id || "Unknown_Student";
          studentName = userData.profile?.student_name ||
            userData.name ||
            userData.nickname ||
            "Unknown_Student";
          citizenId = userData.citizen_id;
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }

      const storageUploads = {};
      const academicYear = appConfig?.academicYear || "2568";
      const term = appConfig?.term || "1";
      
      // Upload all files for each document
      for (const [docId, files] of Object.entries(uploads)) {
        const uploadedFiles = [];
        
        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
          const file = files[fileIndex];
          try {
            const storageData = await uploadFileToStorage(
              file,
              docId,
              fileIndex,
              currentUser.uid,
              studentName,
              appConfig,
              studentId,
            );

            uploadedFiles.push({
              filename: storageData.originalFileName ?? null,
              mimeType: storageData.mimeType ?? null,
              size: storageData.fileSize ?? null,
              downloadURL: storageData.downloadURL ?? null,
              storagePath: storageData.storagePath ?? null,
              uploadedAt: storageData.uploadedAt ?? null,
              storageUploaded: true,
              status: "uploaded_to_storage",
              fileIndex: fileIndex,
              convertedFromImage: storageData.convertedFromImage ?? false,
              originalImageName: storageData.originalImageName ?? null,
              originalImageType: storageData.originalImageType ?? null,
            });

          } catch (error) {
            console.error(`Failed to upload file ${file.filename}:`, error);
            Alert.alert(
              "ข้อผิดพลาดในการอัปโหลด",
              `ไม่สามารถอัปโหลดไฟล์ ${file.filename} ได้: ${error.message}`
            );
            setIsSubmitting(false);
            return;
          }
        }
        
        storageUploads[docId] = uploadedFiles;
      }
      
      const submissionData = {
        userId: currentUser.uid ?? null,
        userEmail: currentUser.email ?? null,
        student_id: studentId ?? null,
        citizen_id: citizenId ?? null,
        surveyData: surveyData ?? null,
        uploads: storageUploads ?? {},
        submittedAt: new Date().toISOString() ?? null,
        status: "submitted" ?? null,
        academicYear: academicYear ?? null,
        term: term ?? null,
        submissionTerm: `${term}` ?? null,
      };

      submissionData.documentStatuses = {};
      Object.keys(storageUploads).forEach((docId) => {
        submissionData.documentStatuses[docId] = {
          status: "pending",
          reviewedAt: null,
          reviewedBy: null,
          comments: "",
          fileCount: storageUploads[docId].length,
        };
      });

      const submissionRef = doc(
        db,
        `document_submissions_${academicYear}_${term}`,
        currentUser.uid
      );
      await setDoc(submissionRef, submissionData);

      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        lastSubmissionAt: new Date().toISOString() ?? null,
        hasSubmittedDocuments: true,
        uploads: storageUploads ?? {},
        lastSubmissionTerm: `${term}` ?? null,
      });

      const totalFiles = Object.values(storageUploads).reduce(
        (sum, files) => sum + files.length, 0
      );
      const convertedFiles = Object.values(storageUploads)
        .flat()
        .filter(file => file.convertedFromImage).length;

      let successMessage = `เอกสารของคุณได้ถูกส่งและอัปโหลดเรียบร้อยแล้ว\nจำนวนไฟล์: ${totalFiles} ไฟล์`;
      if (convertedFiles > 0) {
        successMessage += `\nไฟล์ที่แปลงเป็น PDF: ${convertedFiles} ไฟล์`;
      }
      successMessage += `\nปีการศึกษา: ${academicYear} เทอม: ${term}\nคุณสามารถติดตามได้ในหน้าแสดงผล`;

      Alert.alert(
        "ส่งเอกสารสำเร็จ",
        successMessage,
        [
          {
            text: "ดูสถานะ",
            onPress: () => {
              navigation.push("DocumentStatusScreen", {
                submissionData: submissionData,
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error("Error submitting documents:", error);
      Alert.alert(
        "เกิดข้อผิดพลาด",
        `ไม่สามารถส่งเอกสารได้: ${error.message}\nกรุณาลองใหม่อีกครั้ง`
      );
    } finally {
      setIsSubmitting(false);
      setStorageUploadProgress({});
    }
  };

  // Modal handlers and other utility functions remain the same...
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
        let pdfMessage = 'ไฟล์ PDF ต้องใช้แอปพลิเคชันภายนอกในการดู คลิก "เปิดด้วยแอปภายนอก" เพื่อดูไฟล์';
        
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
    const uploadedDocs = documents.filter((doc) => uploads[doc.id] && uploads[doc.id].length > 0);
    const uploadedRequiredDocs = requiredDocs.filter((doc) => uploads[doc.id] && uploads[doc.id].length > 0);
    
    const totalFiles = Object.values(uploads).reduce((sum, files) => sum + files.length, 0);
    const convertedFiles = Object.values(uploads)
      .flat()
      .filter(file => file.convertedFromImage).length;
    
    return {
      total: documents.length,
      required: requiredDocs.length,
      uploaded: uploadedDocs.length,
      uploadedRequired: uploadedRequiredDocs.length,
      totalFiles: totalFiles,
      convertedFiles: convertedFiles,
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

      {(Object.keys(storageUploadProgress).length > 0 || Object.keys(isConvertingToPDF).length > 0) && (
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
          const newIndex = direction === 'next' 
            ? Math.min(selectedFileIndex + 1, currentDocFiles.length - 1)
            : Math.max(selectedFileIndex - 1, 0);
          handleShowFileModal(selectedFile?.docId, selectedDocTitle.split(' (')[0], newIndex);
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
