import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  deleteField,
  collection,
  addDoc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "../../../database/firebase";

// Save uploads to Firebase
export const saveUploadsToFirebase = async (uploadsData) => {
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
    throw error;
  }
};

// Delete survey data
export const deleteSurveyData = async () => {
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
    throw error;
  }
};

// Check submission status
export const checkSubmissionStatus = async (appConfig, navigation) => {
  const currentUser = auth.currentUser;
  if (!currentUser) return false;

  const currentConfig = appConfig || { academicYear: "2567", term: "1" };
  const termCollectionName = `document_submissions_${currentConfig.academicYear}_${currentConfig.term}`;

  console.log(`🔍 Checking submission for collection: ${termCollectionName}`);

  const submissionRef = doc(db, termCollectionName, currentUser.uid);
  const submissionDoc = await getDoc(submissionRef);

  if (submissionDoc.exists()) {
    console.log("✅ Found existing submission, redirecting to status screen");
    navigation.replace("DocumentStatusScreen", {
      submissionData: submissionDoc.data(),
    });
    return true;
  }

  console.log("📝 No submission found, loading upload screen");
  return false;
};

// Submit documents to Firebase
export const submitDocumentsToFirebase = async (
  submissionData,
  academicYear,
  term
) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No authenticated user found");
    }

    const submissionRef = doc(
      db,
      `document_submissions_${academicYear}_${term}`,
      currentUser.uid
    );

    await setDoc(submissionRef, submissionData);

    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      lastSubmissionAt: new Date().toISOString(),
      hasSubmittedDocuments: true,
      uploads: submissionData.uploads || {},
      lastSubmissionTerm: `${term}`,
    });

    return true;
  } catch (error) {
    console.error("Error submitting documents to Firebase:", error);
    throw error;
  }
};
