import { useState, useEffect } from "react";
import { ScrollView, StyleSheet, Alert } from "react-native";
import { db, auth } from "../../database/firebase";
import { doc, getDoc } from "firebase/firestore";

// Import hooks
import { useUploadScreen } from "./hooks/useUploadScreen";
import { useFirebaseData } from "./hooks/useFirebaseData";
import { useFileManagement } from "./hooks/useFileManagement";

// Import services
import {
  checkSubmissionStatus,
  deleteSurveyData,
  submitDocumentsToFirebase,
} from "./services/firebaseService";
import { checkAIBackendStatus } from "./services/aiValidationService";
import { handleFileUpload } from "./services/documentService";
import { uploadFileToStorage } from "./services/fileUploadService";

// Import components
import LoadingScreen from "./components/LoadingScreen";
import EmptyState from "./components/EmptyState";
import HeaderSection from "./components/HeaderSection";
import TermInfoCard from "./components/TermInfoCard";
import ProgressCard from "./components/ProgressCard";
import StorageProgressCard from "./components/StorageProgressCard";
import DocumentsSection from "./components/DocumentsSection";
import SubmitSection from "./components/SubmitSection";
import FileDetailModal from "./components/FileDetailModal";

// Import utils
import { generateDocumentsList } from "./utils/documentGenerator";
import { handleDocumentDownload } from "./utils/documentHandlers";
import {
  getUploadStats,
  loadFileContent,
  handleOpenUploadedFile,
  formatFileSize,
} from "./utils/helpers";

const UploadScreen = ({ navigation, route }) => {
  // State management using custom hook
  const {
    surveyData,
    setSurveyData,
    surveyDocId,
    setSurveyDocId,
    isLoading,
    setIsLoading,
    uploads,
    setUploads,
    volunteerHours,
    setVolunteerHours,
    uploadProgress,
    setUploadProgress,
    showFileModal,
    setShowFileModal,
    selectedFile,
    setSelectedFile,
    selectedDocTitle,
    setSelectedDocTitle,
    selectedFileIndex,
    setSelectedFileIndex,
    fileContent,
    setFileContent,
    isLoadingContent,
    setIsLoadingContent,
    contentType,
    setContentType,
    imageZoom,
    setImageZoom,
    imagePosition,
    setImagePosition,
    isSubmitting,
    setIsSubmitting,
    storageUploadProgress,
    setStorageUploadProgress,
    appConfig,
    setAppConfig,
    isConvertingToPDF,
    setIsConvertingToPDF,
    isValidatingAI,
    setIsValidatingAI,
    aiBackendAvailable,
    setAiBackendAvailable,
    academicYear,
    setAcademicYear,
    term,
    setTerm,
    birthDate,
    setBirthDate,
    document,
    setDocuments,
    userAge,
    setUserAge,
  } = useUploadScreen();

  // Firebase data hook
  const { configLoaded, loadUserData } = useFirebaseData(
    setAppConfig,
    setAcademicYear,
    setTerm,
    setBirthDate,
    setUserAge
  );

  useEffect(() => {
    return () => {
      // Cleanup เมื่อ component unmount
      setIsConvertingToPDF({});
      setIsValidatingAI({});
    };
  }, []);

  // File management hook
  const {
    isConvertingToPDF: localIsConvertingToPDF,
    setIsConvertingToPDF: setLocalIsConvertingToPDF,
    calculateVolunteerHoursFromUploads,
    handleRemoveFile,
  } = useFileManagement(setUploads, setVolunteerHours, uploads);

  // Merge local isConvertingToPDF with hook's isConvertingToPDF
  useEffect(() => {
    setIsConvertingToPDF((prev) => {
      // merge state
      const merged = { ...prev, ...localIsConvertingToPDF };

      // ถ้า local ลบ key ออกไปแล้ว ให้ global ลบตามด้วย
      Object.keys(merged).forEach((key) => {
        if (!(key in localIsConvertingToPDF)) {
          delete merged[key];
        }
      });

      return merged;
    });
  }, [localIsConvertingToPDF]);
  // Calculate volunteer hours when uploads change
  useEffect(() => {
    if (uploads.volunteer_doc) {
      const initialHours = calculateVolunteerHoursFromUploads(uploads);
      setVolunteerHours(initialHours);
      console.log(`🔄 Initial volunteer hours calculated: ${initialHours}`);
    }
  }, [uploads.volunteer_doc]);

  // Check AI backend status on component mount
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

  // Check submission status and load data when config is loaded
  useEffect(() => {
    const initializeData = async () => {
      if (!configLoaded) return;

      setIsLoading(true);

      // Check submission status first
      const hasSubmission = await checkSubmissionStatus(appConfig, navigation);
      if (hasSubmission) {
        setIsLoading(false);
        return;
      }

      // Load user data
      const userData = await loadUserData(appConfig);
      if (userData) {
        setSurveyData(userData.surveyData);
        setSurveyDocId(userData.surveyDocId);

        // Convert old uploads format to new format if needed
        if (userData.uploads) {
          const convertedUploads = {};
          Object.keys(userData.uploads).forEach((docId) => {
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
      }

      setIsLoading(false);
    };

    initializeData();
  }, [configLoaded, appConfig]);

  // Document List Generator
  useEffect(() => {
    console.log(`🔧 Document Generator useEffect triggered`);
    console.log(`🔧 Current values:`, {
      term,
      academicYear,
      birthDate: birthDate ? "present" : "missing",
      birthDateType: typeof birthDate,
      surveyData: surveyData ? "present" : "missing",
    });

    // สำหรับเทอม 2/3: ใช้ birthDate และ term ในการสร้างรายการ
    if (term === "2" || term === "3") {
      console.log(`🎓 Generating documents for Term ${term}`);

      const docs = generateDocumentsList({
        term: term,
        academicYear: academicYear,
        birth_date: birthDate,
      });

      setDocuments(docs);
      console.log(`📋 Generated ${docs.length} documents for Term ${term}`);
      console.log(
        `📋 Documents list:`,
        docs.map((d) => ({
          id: d.id,
          title: d.title,
          required: d.required,
        }))
      );

      return;
    }

    // สำหรับเทอม 1: ต้องมีข้อมูลที่จำเป็นครบถ้วน
    else if (surveyData && term && academicYear && birthDate) {
      console.log(
        `🎓 Generating documents for Term ${term} with full survey data`
      );

      const docs = generateDocumentsList({
        ...surveyData,
        term: term,
        academicYear: academicYear,
        birth_date: birthDate,
      });

      setDocuments(docs);
      console.log(`📋 Generated ${docs.length} documents for Term ${term}`);
      console.log(
        `📋 Documents list:`,
        docs.map((d) => ({
          id: d.id,
          title: d.title,
          required: d.required,
        }))
      );
    } else if (!surveyData && term === "1") {
      console.log(`❌ Term 1 without survey data - clearing document list`);
      setDocuments([]);
    } else {
      console.log(`⏳ Waiting for required data...`, {
        hasSurveyData: !!surveyData,
        hasTerm: !!term,
        hasAcademicYear: !!academicYear,
        hasBirthDate: !!birthDate,
      });
    }
  }, [surveyData, term, academicYear, birthDate]);

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
            try {
              await deleteSurveyData();
              setSurveyData(null);
              setUploads({});
              setUploadProgress({});
              setStorageUploadProgress({});
            } catch (error) {
              Alert.alert("Error", "Failed to delete survey data.");
            }
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

  // Handle file upload
  const handleFileUploadWrapper = (docId, allowMultiple = true) => {
    handleFileUpload(
      docId,
      allowMultiple,
      uploads,
      setUploads,
      setVolunteerHours,
      volunteerHours,
      appConfig,
      setLocalIsConvertingToPDF,
      setStorageUploadProgress,
      setIsValidatingAI
    );
  };

  // Handle submit documents
  const handleSubmitDocuments = async () => {
    const stats = getUploadStats(
      uploads,
      surveyData,
      term,
      academicYear,
      birthDate
    );
    const requiredDocs = document.filter((doc) => doc.required);
    const uploadedRequiredDocs = requiredDocs.filter(
      (doc) => uploads[doc.id] && uploads[doc.id].length > 0
    );

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
      const { prepareSubmissionData } = await import(
        "./services/documentService"
      );
      const {
        submissionData,
        studentId,
        studentName,
        academicYear: year,
        term: currentTerm,
      } = await prepareSubmissionData(uploads, surveyData, appConfig);

      const storageUploads = {};

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
              auth.currentUser.uid,
              studentName,
              appConfig,
              studentId,
              setStorageUploadProgress
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

      submissionData.uploads = storageUploads;

      // Set document statuses
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

      // Submit to Firebase
      await submitDocumentsToFirebase(submissionData, year, currentTerm);

      const totalFiles = Object.values(storageUploads).reduce(
        (sum, files) => sum + files.length,
        0
      );
      const convertedFiles = Object.values(storageUploads)
        .flat()
        .filter((file) => file.convertedFromImage).length;

      let successMessage = `เอกสารของคุณได้ถูกส่งและอัปโหลดเรียบร้อยแล้ว\nจำนวนไฟล์: ${totalFiles} ไฟล์`;
      if (convertedFiles > 0) {
        successMessage += `\nไฟล์ที่แปลงเป็น PDF: ${convertedFiles} ไฟล์`;
      }
      successMessage += `\nปีการศึกษา: ${year} เทอม: ${currentTerm}\nคุณสามารถติดตามได้ในหน้าแสดงผล`;

      Alert.alert("ส่งเอกสารสำเร็จ", successMessage, [
        {
          text: "ดูสถานะ",
          onPress: () => {
            navigation.push("DocumentStatusScreen", {
              submissionData: submissionData,
            });
          },
        },
      ]);
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
        const { type, content } = await loadFileContent(files[fileIndex]);
        setContentType(type);
        setFileContent(content);
      } catch (error) {
        console.error("Error loading file content:", error);
        Alert.alert("ข้อผิดพลาด", "ไม่สามารถโหลดเนื้อหาไฟล์ได้");
      } finally {
        setIsLoadingContent(false);
      }
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

  // Utility functions
  const stats = getUploadStats(
    uploads,
    surveyData,
    term,
    academicYear,
    birthDate
  );

  // Render logic
  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!surveyData) {
    return <EmptyState onStartSurvey={handleStartSurvey} />;
  }

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
        documents={document}
        uploads={uploads}
        onFileUpload={handleFileUploadWrapper}
        onRemoveFile={handleRemoveFile}
        onShowFileModal={handleShowFileModal}
        onDownloadDocument={handleDocumentDownload}
        formatFileSize={formatFileSize}
        isValidatingAI={isValidatingAI}
        aiBackendAvailable={aiBackendAvailable}
        volunteerHours={volunteerHours}
        isConvertingToPDF={isConvertingToPDF}
        term={term}
        birth_date={birthDate}
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
