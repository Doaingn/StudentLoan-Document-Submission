import { db, auth } from "../../../database/firebase";
import { collection, addDoc, doc, getDoc, updateDoc } from "firebase/firestore";

export const saveAIValidationResult = async (validationData) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error("No authenticated user found");
      return null;
    }

    const validationResult = {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      documentType: validationData.documentType,
      fileName: validationData.fileName,
      fileUri: validationData.fileUri,
      mimeType: validationData.mimeType,
      validatedAt: new Date().toISOString(),
      aiResult: validationData.aiResult,
      academicYear: validationData.academicYear || null,
      term: validationData.term || null,
      userAction: "accepted",
      metadata: {
        appVersion: "1.0.0",
        platform: "react-native",
        validationTimestamp: Date.now(),
      },
    };

    // Save to ai_validation_results collection
    const validationRef = await addDoc(
      collection(db, "ai_validation_results"),
      validationResult
    );

    console.log("✅ AI validation result saved with ID:", validationRef.id);

    // Update user document with reference
    const userRef = doc(db, "users", currentUser.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      const aiValidations = userData.aiValidations || [];

      aiValidations.push({
        validationId: validationRef.id,
        documentType: validationData.documentType,
        fileName: validationData.fileName,
        validatedAt: new Date().toISOString(),
        status: validationData.aiResult.overall_status,
      });

      // Keep only last 50 entries
      if (aiValidations.length > 50) {
        aiValidations.splice(0, aiValidations.length - 50);
      }

      await updateDoc(userRef, {
        aiValidations: aiValidations,
        lastAIValidation: new Date().toISOString(),
      });
    }

    return validationRef.id;
  } catch (error) {
    console.error("❌ Error saving AI validation result:", error);
    return null;
  }
};
