import { storage } from "../../../database/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

export const uploadFileToStorage = async (
  file,
  docId,
  fileIndex,
  userId,
  studentName,
  config,
  studentId,
  onProgress
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
          onProgress?.(docId, fileIndex, Math.round(progress));
        },
        (error) => {
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            onProgress?.(docId, fileIndex, null); // Clear progress

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
