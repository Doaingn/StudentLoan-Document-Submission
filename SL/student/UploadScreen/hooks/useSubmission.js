import { Alert } from "react-native";
import { db, auth } from "../../../database/firebase";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { uploadFileToStorage } from "../services/fileUploadService";

export const useSubmission = (props) => {
  const {
    surveyData,
    uploads,
    appConfig,
    isSubmitting,
    setIsSubmitting,
    storageUploadProgress,
    setStorageUploadProgress,
    navigation,
  } = props;

  const handleSubmitDocuments = async () => {
    const { generateDocumentsList } = await import(
      "../utils/documentGenerator"
    );
    const documents = generateDocumentsList(surveyData);
    const requiredDocs = documents.filter((doc) => doc.required);
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
          studentName =
            userData.profile?.student_name ||
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
              (docId, fileIndex, progress) => {
                setStorageUploadProgress((prev) => ({
                  ...prev,
                  [`${docId}_${fileIndex}`]: progress,
                }));
              }
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
      successMessage += `\nปีการศึกษา: ${academicYear} เทอม: ${term}\nคุณสามารถติดตามได้ในหน้าแสดงผล`;

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

  return {
    handleSubmitDocuments,
  };
};
