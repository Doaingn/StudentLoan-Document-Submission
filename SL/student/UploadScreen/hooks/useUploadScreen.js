import { useState, useEffect } from "react";
import { Alert } from "react-native";
import { db, auth } from "../../../database/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  onSnapshot,
  deleteField,
  collection,
  addDoc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../../../database/firebase";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";

import {
  validateDocument,
  showValidationAlert,
  checkAIBackendStatus,
  needsAIValidation,
} from "../documents_ai/UnifiedDocumentAI";
import {
  generateDocumentsList,
  calculateAge,
} from "../utils/documentGenerator";
import { mergeImagesToPdf } from "../utils/pdfMerger";
import { saveAIValidationResult } from "../utils/aiValidationStorage";

export const useUploadScreen = (navigation, route) => {
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
  const [documents, setDocuments] = useState([]);
  const [userAge, setUserAge] = useState(null);

  // Calculate volunteer hours on initial load
  useEffect(() => {
    if (uploads.volunteer_doc) {
      const initialHours = calculateVolunteerHoursFromUploads(uploads);
      setVolunteerHours(initialHours);
    }
  }, [uploads.volunteer_doc]);

  // Check AI backend status
  useEffect(() => {
    const checkAIStatus = async () => {
      const isAvailable = await checkAIBackendStatus();
      setAiBackendAvailable(isAvailable);
    };
    checkAIStatus();
  }, []);

  // Config listener for term and academic year
  useEffect(() => {
    const configRef = doc(db, "DocumentService", "config");
    const configUnsubscribe = onSnapshot(
      configRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const config = docSnap.data();
          if (config) {
            setAppConfig(config);
            setAcademicYear(config.academicYear);
            setTerm(config.term);
          }
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

    return () => configUnsubscribe();
  }, []);

  // Check submission status and load data
  useEffect(() => {
    const checkSubmissionStatus = async () => {
      if (!appConfig) return;

      setIsLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      const termCollectionName = `document_submissions_${
        appConfig.academicYear || "2567"
      }_${appConfig.term || "1"}`;
      const submissionRef = doc(db, termCollectionName, currentUser.uid);
      const submissionDoc = await getDoc(submissionRef);

      if (submissionDoc.exists()) {
        navigation.replace("DocumentStatusScreen", {
          submissionData: submissionDoc.data(),
        });
        setIsLoading(false);
        return;
      }

      const userSurveyRef = doc(db, "users", currentUser.uid);
      const userSurveyDoc = await getDoc(userSurveyRef);

      if (userSurveyDoc.exists()) {
        const userData = userSurveyDoc.data();

        if (appConfig.term === "2" || appConfig.term === "3") {
          const birthDateFromUser = userData.birth_date;
          setBirthDate(birthDateFromUser);
          if (birthDateFromUser) {
            const age = calculateAge(birthDateFromUser);
            setUserAge(age);
          }
          setSurveyData({ term: appConfig.term });
          setSurveyDocId(userSurveyDoc.id);
        } else {
          const surveyData = userData.survey;
          if (surveyData) {
            setSurveyData({ ...surveyData, term: appConfig.term });
            setSurveyDocId(userSurveyDoc.id);
            const birthDateData = userData.birth_date;
            setBirthDate(birthDateData);
            if (birthDateData) {
              const age = calculateAge(birthDateData);
              setUserAge(age);
            }
          }
        }

        if (userData.uploads) {
          const convertedUploads = {};
          Object.keys(userData.uploads).forEach((docId) => {
            const upload = userData.uploads[docId];
            convertedUploads[docId] = Array.isArray(upload) ? upload : [upload];
          });
          setUploads(convertedUploads);
        }
      }
      setIsLoading(false);
    };

    if (appConfig) {
      checkSubmissionStatus();
    }
  }, [appConfig]);

  // Document list generator
  useEffect(() => {
    if (surveyData && term && academicYear && birthDate) {
      const docs = generateDocumentsList({
        term: term,
        familyStatus: surveyData.familyStatus,
        fatherIncome: surveyData.fatherIncome,
        motherIncome: surveyData.motherIncome,
        guardianIncome: surveyData.guardianIncome,
        birth_date: birthDate,
      });
      setDocuments(docs);
    } else if (surveyData && term && academicYear && birthDate) {
      const docs = generateDocumentsList({
        ...surveyData,
        term: term,
        academicYear: academicYear,
        birth_date: birthDate,
      });
      setDocuments(docs);
    } else if (!surveyData && term === "1") {
      setDocuments([]);
    }
  }, [surveyData, term, academicYear, birthDate]);

  // Utility functions
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

  console.log("Survey Data for Term 1:", surveyData);
  console.log("Family Status:", surveyData?.familyStatus);
  console.log("Father Income:", surveyData?.fatherIncome);
  console.log("Mother Income:", surveyData?.motherIncome);
  // Return all state and functions for the component to use
  return {
    // State
    surveyData,
    isLoading,
    uploads,
    volunteerHours,
    showFileModal,
    selectedFile,
    selectedDocTitle,
    selectedFileIndex,
    fileContent,
    isLoadingContent,
    contentType,
    imageZoom,
    imagePosition,
    isSubmitting,
    storageUploadProgress,
    appConfig,
    isConvertingToPDF,
    isValidatingAI,
    aiBackendAvailable,
    academicYear,
    term,
    documents,

    // Setters\
    setSurveyData,
    setUploads,
    setVolunteerHours,
    setShowFileModal,
    setSelectedFile,
    setSelectedDocTitle,
    setSelectedFileIndex,
    setFileContent,
    setIsLoadingContent,
    setContentType,
    setImageZoom,
    setImagePosition,
    setIsSubmitting,
    setStorageUploadProgress,
    setIsConvertingToPDF,
    setIsValidatingAI,

    // Utility functions
    calculateVolunteerHoursFromUploads,
    isImageFile,
  };
};
