import { Alert } from "react-native";
import { db, auth } from "../../../database/firebase";
import { doc, updateDoc, deleteField } from "firebase/firestore";

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
    Alert.alert("Error", "Failed to delete survey data.");
  }
};
