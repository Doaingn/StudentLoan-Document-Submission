import { useState } from "react";

export const useUploadScreen = () => {
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

  return {
    // States
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
  };
};