import { useState, useEffect } from "react";
import { ScrollView, StyleSheet, Alert } from "react-native";
import { db, auth } from "../../database/firebase";
import { doc, getDoc, onSnapshot,updateDoc } from "firebase/firestore";

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

  // ฟังก์ชันตรวจสอบ phase ปัจจุบัน
const checkCurrentPhase = async () => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;

    const userRef = doc(db, "users", currentUser.uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.loanHistory || {};
    }
    return null;
  } catch (error) {
    console.error("Error checking current phase:", error);
    return null;
  }
};


// เพิ่มฟังก์ชันตรวจสอบและรีเซ็ต uploads เมื่อเทอมเปลี่ยน
const checkAndResetForNewTerm = async (currentTerm, appConfig) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return false;

    const userRef = doc(db, "users", currentUser.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) return false;
    
    const userData = userDoc.data();
    const lastSubmissionTerm = userData.lastSubmissionTerm;
    const lastAcademicYear = userData.lastAcademicYear;
    
    const currentAcademicYear = appConfig?.academicYear || "2568";
    
    console.log("Term Detection:", {
      lastSubmissionTerm,
      currentTerm,
      lastAcademicYear,
      currentAcademicYear
    });
    
    // ตรวจสอบว่าเปลี่ยนเทอมหรือปีการศึกษา
    const isNewTerm = lastSubmissionTerm !== currentTerm;
    const isNewYear = lastAcademicYear !== currentAcademicYear;
    
    if (isNewTerm || isNewYear) {
      console.log("New term/year detected - clearing uploads only");
      
      // ล้างแค่ uploads และ hasSubmittedDocuments
      // ไม่ต้องอัพเดท lastSubmissionTerm (จะอัพเดทตอนส่งเอกสารจริง)
      await updateDoc(userRef, {
        uploads: {},
        hasSubmittedDocuments: false,
        lastUpdated: new Date().toISOString()
      });
      
      return true; // บอกว่ามีการรีเซ็ต
    }
    
    return false; // ไม่ได้รีเซ็ต
  } catch (error) {
    console.error("Error checking term change:", error);
    return false;
  }
};

useEffect(() => {
  const initializeData = async () => {
    if (!configLoaded) return;

    setIsLoading(true);

    const currentUser = auth.currentUser;
    if (currentUser) {
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const loanHistory = userData.loanHistory || {};
        
        // ตรวจสอบว่า disbursementApproved เป็นของเทอมปัจจุบันหรือเทอมเก่า
        const lastDisbursementTerm = loanHistory.lastDisbursementApprovedTerm;
        const isCurrentTermApproved = lastDisbursementTerm === term;
        
        console.log("Checking disbursement approval:", {
          disbursementApproved: loanHistory.disbursementApproved,
          lastDisbursementTerm,
          currentTerm: term,
          isCurrentTermApproved
        });
        
        // เงื่อนไข 1: ถ้าอนุมัติครบทุกอย่างแล้ว AND เป็นเทอมเดียวกันเท่านั้น
        if (loanHistory.disbursementApproved === true && isCurrentTermApproved) {
          console.log("All approved for current term, showing loan process status");
          navigation.replace("LoanProcessStatus");
          setIsLoading(false);
          return;
        }
        
        // เงื่อนไข 2: ถ้าส่งเอกสารเบิกเงินแล้ว AND เป็นเทอมเดียวกัน รอผล
        const lastSubmitTerm = loanHistory.lastDisbursementSubmitTerm;
        const isCurrentTermSubmitted = lastSubmitTerm === term;
        
        if (loanHistory.disbursementSubmitted === true && 
            isCurrentTermSubmitted &&
            loanHistory.disbursementApproved !== true) {
          console.log("Disbursement submitted for current term, awaiting approval");
          navigation.replace("DocumentStatusScreen");
          setIsLoading(false);
          return;
        }
        
        // เทอม 2/3 - แสดงหน้าอัพโหลดเอกสารเบิกเงิน
        if (term === "2" || term === "3") {
          console.log(`Term ${term} - Loading disbursement documents`);
          
          // ตรวจสอบว่าเคยส่งเอกสารเบิกเงินในเทอมนี้แล้วหรือยัง
          if (loanHistory.disbursementSubmitted === true && 
              loanHistory.lastDisbursementSubmitTerm === term) {
            console.log("Already submitted disbursement for this term - showing status");
            navigation.replace("DocumentStatusScreen");
            setIsLoading(false);
            return;
          }
          
          // ยังไม่ได้ส่ง - โหลดหน้าอัพโหลดปกติ
          const userData = await loadUserData(appConfig);
          if (userData) {
            setSurveyData(userData.surveyData);
            setSurveyDocId(userData.surveyDocId);
            setUploads(userData.uploads || {});
          }
          setIsLoading(false);
          return;
        }
        
        // เงื่อนไข 4: เทอม 1 - ตรวจสอบ Phase 1
        const lastPhase1Term = loanHistory.lastPhase1ApprovedTerm;
        const isPhase1CurrentTerm = lastPhase1Term === term;
        
        if (term === "1" && 
            loanHistory.phase1Approved === true && 
            isPhase1CurrentTerm &&
            loanHistory.disbursementSubmitted !== true) {
          console.log("Phase 1 approved for current term, ready for disbursement");
          
          setUploads({});
          setStorageUploadProgress({});
          setUploadProgress({});
          
          const userData = await loadUserData(appConfig);
          if (userData) {
            setSurveyData(userData.surveyData);
            setSurveyDocId(userData.surveyDocId);
            setUploads(userData.uploads || {});
          }
          setIsLoading(false);
          return;
        }
      }
    }

    // เช็ค submission status ปกติ
    const hasSubmission = await checkSubmissionStatus(appConfig, navigation);
    if (hasSubmission) {
      setIsLoading(false);
      return;
    }

    // Load user data สำหรับกรณีปกติ
    const userData = await loadUserData(appConfig);
    if (userData) {
      setSurveyData(userData.surveyData);
      setSurveyDocId(userData.surveyDocId);

      if (userData.uploads) {
        const convertedUploads = {};
        Object.keys(userData.uploads).forEach((docId) => {
          const upload = userData.uploads[docId];
          if (Array.isArray(upload)) {
            convertedUploads[docId] = upload;
          } else {
            convertedUploads[docId] = [upload];
          }
        });
        setUploads(convertedUploads);
      }
    }

    setIsLoading(false);
  };

  initializeData();
}, [configLoaded, appConfig, term]);

  // Document List Generator
  useEffect(() => {
  console.log(`🔧 Document Generator useEffect triggered`);
  console.log(`🔧 Current values:`, {
    term,
    academicYear,
    birthDate: birthDate ? "present" : "missing",
    surveyData: surveyData ? "present" : "missing",
    phase: surveyData?.phase // เช็คค่า phase
  });

  // สำหรับเทอม 2/3: ใช้ birthDate และ term ในการสร้างรายการ
  if (term === "2" || term === "3") {
    console.log(`Generating documents for Term ${term}`);

    const docs = generateDocumentsList({
      term: term,
      academicYear: academicYear,
      birth_date: birthDate,
      phase: "disbursement"
    });

    setDocuments(docs);
    console.log(`Generated ${docs.length} documents for Term ${term}`);
    return;
  }

  // สำหรับเทอม 1: ต้องมี surveyData
  if (surveyData && term && academicYear && birthDate) {
    console.log(`Generating documents for Term ${term} with survey data`);
    console.log(`Phase from surveyData: ${surveyData.phase}`); // ต้องเป็น "disbursement"

    const docs = generateDocumentsList({
      ...surveyData,
      term: term,
      academicYear: academicYear,
      birth_date: birthDate,
    });

    setDocuments(docs);
    console.log(`Generated ${docs.length} documents`);
  } else if (!surveyData && term === "1") {
    console.log(`Term 1 without survey data - clearing document list`);
    setDocuments([]);
  }
}, [surveyData, term, academicYear, birthDate]);

useEffect(() => {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const userRef = doc(db, "users", currentUser.uid);
  
  let hasShownAlert = false;
  let debounceTimer = null;
  
  const unsubscribe = onSnapshot(userRef, async (userDoc) => {
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const loanHistory = userData.loanHistory || {};
      
      if (debounceTimer) clearTimeout(debounceTimer);
      
      debounceTimer = setTimeout(async () => {
        // ตรวจสอบว่าการอนุมัติเป็นของเทอมปัจจุบันหรือไม่
        const lastDisbursementTerm = loanHistory.lastDisbursementApprovedTerm;
        const lastSubmitTerm = loanHistory.lastDisbursementSubmitTerm;
        const isCurrentTermApproved = lastDisbursementTerm === term;
        const isCurrentTermSubmitted = lastSubmitTerm === term;
        
        console.log("Real-time update check:", {
          currentTerm: term,
          lastDisbursementTerm,
          lastSubmitTerm,
          isCurrentTermApproved,
          isCurrentTermSubmitted
        });
        
        // แสดง Alert เฉพาะเมื่อเปลี่ยนเป็น disbursement phase และเป็นเทอมปัจจุบัน
        if (loanHistory.phase1Approved === true && 
            loanHistory.currentPhase === "disbursement" &&
            loanHistory.disbursementSubmitted !== true &&
            loanHistory.lastPhase1ApprovedTerm === term &&
            !hasShownAlert) {
          
          console.log("Showing approval alert for disbursement phase");
          hasShownAlert = true;
          
          Alert.alert(
            "เอกสารเฟส 1 ได้รับการอนุมัติแล้ว!",
            "คุณสามารถอัพโหลดเอกสารเบิกเงิน (เฟส 2) ได้แล้ว",
            [{ text: "ตกลง" }]
          );
        }
        
        // Navigation logic - ต้องตรวจสอบว่าเป็นเทอมปัจจุบัน
        if (loanHistory.disbursementSubmitted === true && 
            isCurrentTermSubmitted &&
            loanHistory.disbursementApproved !== true) {
          navigation.replace("DocumentStatusScreen");
        }
        
        if (loanHistory.disbursementApproved === true && isCurrentTermApproved) {
          navigation.replace("LoanProcessStatus");
        }
      }, 1000);
    }
  });

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    unsubscribe();
  };
}, [appConfig, navigation, term]);

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
      let errorMessage = "ไม่สามารถส่งเอกสารได้ กรุณาลองใหม่อีกครั้ง";
      if (error.message.includes('Network request failed')) {
        errorMessage = "การเชื่อมต่ออินเทอร์เน็ตมีปัญหา กรุณาตรวจสอบสัญญาณและลองอีกครั้ง";
      } else if (error.message.includes('timeout')) {
        errorMessage = "การอัปโหลดใช้เวลานานเกินไป กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต";
      }
      
      Alert.alert("เกิดข้อผิดพลาด", `${errorMessage}\n\nข้อผิดพลาด: ${error.message}`);
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
