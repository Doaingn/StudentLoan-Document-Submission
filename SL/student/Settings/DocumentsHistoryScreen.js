import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { db, auth, storage } from "../../database/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { ref, listAll, getDownloadURL, getMetadata } from "firebase/storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

const DocumentsHistoryScreen = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [historyData, setHistoryData] = useState({});
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [downloadingFiles, setDownloadingFiles] = useState({});
  const [showFileModal, setShowFileModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [contentType, setContentType] = useState("");
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Document types mapping
  const documentTypes = {
    form_101: "กยศ 101",
    volunteer_doc: "เอกสารจิตอาสา",
    id_copies_student: "สำเนาบัตรประชาชนนักศึกษา",
    consent_student_form: "หนังสือยินยอมเปิดเผยข้อมูลนักศึกษา",
    consent_father_form: "หนังสือยินยอมเปิดเผยข้อมูลบิดา",
    id_copies_consent_father_form: "สำเนาบัตรประชาชนมารดา",
    id_copies_father: "สำเนาบัตรประชาชนบิดา",
    consent_mother_form: "หนังสือยินยอมเปิดเผยข้อมูลมารดา",
    id_copies_mother: "สำเนาบัตรประชาชนมารดา",
    id_copies_consent_mother_form: "สำเนาบัตรประชาชนมารดา",
    guardian_consent: "หนังสือยินยอมเปิดเผยข้อมูลผู้ปกครอง",
    guardian_income_cert: "หนังสือรับรองรายได้ผู้ปกครอง",
    father_income_cert: "หนังสือรับรองรายได้บิดา",
    fa_id_copies_gov: "สำเนาบัตรข้าราชการผู้รับรอง",
    mother_income_cert: "หนังสือรับรองรายได้มารดา",
    mo_id_copies_gov: "สำเนาบัตรข้าราชการผู้รับรอง",
    single_parent_income_cert: "หนังสือรับรองรายได้",
    single_parent_income: "หนังสือรับรองเงินเดือน",
    famo_income_cert: "หนังสือรับรองรายได้บิดามารดา",
    famo_id_copies_gov: "สำเนาบัตรข้าราชการผู้รับรอง",
    family_status_cert: "หนังสือรับรองสถานภาพครอบครัว",
    father_income: "หนังสือรับรองเงินเดือนบิดา",
    mother_income: "หนังสือรับรองเงินเดือนมารดา",
    legal_status:
      "สำเนาใบหย่า (กรณีหย่าร้าง) หรือ สำเนาใบมรณบัตร (กรณีเสียชีวิต)",
    fam_id_copies_gov: "สำเนาบัตรข้าราชการผู้รับรอง",
    "102_id_copies_gov": "สำเนาบัตรข้าราชการผู้รับรอง",
    guardian_id_copies: "สำเนาบัตรประชาชนผู้ปกครอง",
    guardian_income: "หนังสือรับรองเงินเดือนผู้ปกครอง",
    guar_id_copies_gov: "สำเนาบัตรข้าราชการผู้รับรอง",
  };

  useEffect(() => {
    fetchDocumentsHistory();
  }, []);

  const fetchDocumentsHistory = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert("ข้อผิดพลาด", "ไม่พบข้อมูลผู้ใช้");
        return;
      }

      // Get user info
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const name =
          userData.profile?.student_name ||
          userData.name ||
          userData.nickname ||
          "Unknown_Student";
        const id = userData.student_id || "Unknown_Student";
        setStudentName(name);
        setStudentId(id);

        // Sanitize name for storage path
        const sanitizedName = name
          .replace(/[.#$[\]/\\]/g, "_")
          .replace(/\s+/g, "_");

        // Fetch documents from Firebase Storage
        await fetchStorageDocuments(sanitizedName);
      }
    } catch (error) {
      console.error("Error fetching documents history:", error);
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถโหลดประวัติเอกสารได้");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStorageDocuments = async (sanitizedName) => {
    try {
      const basePath = `student_documents/${sanitizedName}`;
      const baseRef = ref(storage, basePath);

      // List all items in the student's folder
      const result = await listAll(baseRef);

      // Process folders (years)
      const history = {};

      for (const folderRef of result.prefixes) {
        const year = folderRef.name;
        history[year] = {};

        // List terms in this year
        const yearResult = await listAll(folderRef);

        for (const termRef of yearResult.prefixes) {
          const term = termRef.name;
          history[year][term] = {};

          // List files in this term
          const termResult = await listAll(termRef);

          for (const fileRef of termResult.items) {
            try {
              const metadata = await getMetadata(fileRef);
              const downloadURL = await getDownloadURL(fileRef);

              // Extract document type from filename
              const filename = fileRef.name;
              const docType = extractDocTypeFromFilename(filename);

              if (!history[year][term][docType]) {
                history[year][term][docType] = [];
              }

              history[year][term][docType].push({
                filename,
                downloadURL,
                size: metadata.size,
                timeCreated: metadata.timeCreated,
                contentType: metadata.contentType,
                fullPath: fileRef.fullPath,
              });
            } catch (fileError) {
              console.warn(`Error processing file ${fileRef.name}:`, fileError);
            }
          }
        }
      }

      setHistoryData(history);
    } catch (error) {
      console.error("Error fetching storage documents:", error);
      throw error;
    }
  };

  const extractDocTypeFromFilename = (filename) => {
    // Extract document type from filename format: {student_id}_{doc_type}.extension
    // Remove file extension first
    const nameWithoutExt = filename.replace(/\.[^.]+$/, "");

    // Find the first underscore to separate student_id from doc_type
    const underscoreIndex = nameWithoutExt.indexOf("_");
    if (underscoreIndex === -1) {
      // If no underscore found, return the whole name
      return nameWithoutExt;
    }

    // Extract the document type part after the student_id
    const docType = nameWithoutExt.substring(underscoreIndex + 1);
    return docType;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDownloadFile = async (file) => {
    try {
      setDownloadingFiles((prev) => ({ ...prev, [file.fullPath]: true }));

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(
          "ไม่สามารถดาวน์โหลดได้",
          "อุปกรณ์ของคุณไม่รองรับการดาวน์โหลดไฟล์"
        );
        return;
      }

      // สร้าง path สำหรับเก็บไฟล์
      const localUri = FileSystem.documentDirectory + file.filename;

      // ดาวน์โหลดไฟล์ใหม่
      const { uri } = await FileSystem.downloadAsync(
        file.downloadURL,
        localUri
      );

      await Sharing.shareAsync(uri);
    } catch (error) {
      console.error("Download error:", error);
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถดาวน์โหลดไฟล์ได้");
    } finally {
      setDownloadingFiles((prev) => {
        const newState = { ...prev };
        delete newState[file.fullPath];
        return newState;
      });
    }
  };

  const handleViewFile = async (file) => {
    setSelectedFile(file);
    setShowFileModal(true);
    setIsLoadingContent(true);

    try {
      await loadFileContent(file);
    } catch (error) {
      console.error("Error loading file content:", error);
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถโหลดเนื้อหาไฟล์ได้");
    } finally {
      setIsLoadingContent(false);
    }
  };

  const loadFileContent = async (file) => {
    try {
      const contentType = file.contentType?.toLowerCase() || "";
      const fileName = file.filename?.toLowerCase() || "";

      if (
        contentType.startsWith("image/") ||
        fileName.endsWith(".jpg") ||
        fileName.endsWith(".jpeg") ||
        fileName.endsWith(".png") ||
        fileName.endsWith(".gif")
      ) {
        setContentType("image");
        setFileContent(file.downloadURL);
      } else if (contentType.includes("pdf") || fileName.endsWith(".pdf")) {
        setContentType("pdf");
        setFileContent(
          'ไฟล์ PDF ต้องใช้แอปพลิเคชันภายนอกในการดู คลิก "เปิดด้วยแอปภายนอก" เพื่อดูไฟล์'
        );
      } else if (contentType.includes("text/")) {
        setContentType("text");
        // Download and read text content
        const localUri = FileSystem.cacheDirectory + file.filename;
        const downloadResult = await FileSystem.downloadAsync(
          file.downloadURL,
          localUri
        );
        const content = await FileSystem.readAsStringAsync(downloadResult.uri);
        setFileContent(content);
      } else {
        setContentType("other");
        setFileContent(
          `ไฟล์ประเภท ${contentType || "ไม่ทราบ"} ไม่สามารถแสดงผลในแอปได้`
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
    setFileContent(null);
    setContentType("");
    setIsLoadingContent(false);
  };

  const renderYearsList = () => {
    const years = Object.keys(historyData).sort((a, b) => b.localeCompare(a));

    if (years.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="document-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyStateTitle}>ไม่พบประวัติเอกสาร</Text>
          <Text style={styles.emptyStateText}>
            คุณยังไม่เคยอัพโหลดเอกสารใดๆ
          </Text>
        </View>
      );
    }

    return (
      <View>
        {years.map((year) => (
          <TouchableOpacity
            key={year}
            style={styles.yearCard}
            onPress={() => setSelectedYear(year)}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardLeft}>
                <Ionicons name="calendar-outline" size={24} color="#3b82f6" />
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>ปีการศึกษา {year}</Text>
                  <Text style={styles.cardSubtitle}>
                    {Object.keys(historyData[year]).length} เทอม
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderTermsList = () => {
    const terms = Object.keys(historyData[selectedYear]).sort();

    return (
      <View>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => setSelectedYear(null)}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={20} color="#3b82f6" />
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>ปีการศึกษา {selectedYear}</Text>
        </View>

        {terms.map((term) => {
          const termData = historyData[selectedYear][term];
          const docCount = Object.keys(termData).length;
          const fileCount = Object.values(termData).reduce(
            (sum, files) => sum + files.length,
            0
          );

          return (
            <TouchableOpacity
              key={term}
              style={styles.termCard}
              onPress={() => setSelectedTerm(term)}
            >
              <View style={styles.cardContent}>
                <View style={styles.cardLeft}>
                  <Ionicons name="folder-outline" size={24} color="#10b981" />
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>
                      {term.replace("term_", "เทอม ")}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                      {docCount} ประเภทเอกสาร • {fileCount} ไฟล์
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#64748b" />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderDocumentsList = () => {
    const documents = historyData[selectedYear][selectedTerm];
    const docTypes = Object.keys(documents);

    return (
      <View>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => setSelectedTerm(null)}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={20} color="#3b82f6" />
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>
            {selectedTerm.replace("term_", "เทอม ")} ปี {selectedYear}
          </Text>
        </View>

        {docTypes.map((docType) => {
          const files = documents[docType];
          const docName = documentTypes[docType] || docType;
          // Show document name with student ID prefix
          const displayName = docName;

          return (
            <View key={docType} style={styles.documentCard}>
              <View style={styles.documentHeader}>
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color="#6366f1"
                />
                <Text style={styles.documentTitle}>{displayName}</Text>
                {/* <Text style={styles.fileCount}>{files.length} ไฟล์</Text> */}
              </View>

              {files.map((file, index) => (
                <View key={index} style={styles.fileItem}>
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName}>{file.filename}</Text>
                    <Text style={styles.fileDetails}>
                      {formatFileSize(file.size)} •{" "}
                      {formatDate(file.timeCreated)}
                    </Text>
                  </View>

                  <View style={styles.fileActions}>
                    <TouchableOpacity
                      onPress={() => handleViewFile(file)}
                      style={styles.actionButton}
                    >
                      <Ionicons name="eye-outline" size={16} color="#3b82f6" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDownloadFile(file)}
                      style={styles.actionButton}
                      disabled={downloadingFiles[file.fullPath]}
                    >
                      {downloadingFiles[file.fullPath] ? (
                        <ActivityIndicator size="small" color="#10b981" />
                      ) : (
                        <Ionicons
                          name="download-outline"
                          size={16}
                          color="#10b981"
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          );
        })}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>กำลังโหลดประวัติเอกสาร...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {!selectedYear && renderYearsList()}
      {selectedYear && !selectedTerm && renderTermsList()}
      {selectedYear && selectedTerm && renderDocumentsList()}

      {/* File Detail Modal */}
      <Modal
        visible={showFileModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedFile?.filename || "ไฟล์เอกสาร"}
            </Text>
            <TouchableOpacity
              onPress={handleCloseModal}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {isLoadingContent ? (
              <View style={styles.loadingContent}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>กำลังโหลดเนื้อหา...</Text>
              </View>
            ) : (
              <View>
                {contentType === "image" && fileContent && (
                  <View style={styles.imageContainer}>
                    <Text style={styles.contentText}>
                      รูปภาพจะแสดงในแอปพลิเคชันภายนอก
                    </Text>
                  </View>
                )}

                {contentType === "text" && (
                  <Text style={styles.textContent}>{fileContent}</Text>
                )}

                {(contentType === "pdf" ||
                  contentType === "other" ||
                  contentType === "error") && (
                  <Text style={styles.contentText}>{fileContent}</Text>
                )}

                <View style={styles.fileMetadata}>
                  <Text style={styles.metadataTitle}>รายละเอียดไฟล์</Text>
                  <Text style={styles.metadataText}>
                    ชื่อไฟล์: {selectedFile?.filename}
                  </Text>
                  <Text style={styles.metadataText}>
                    ขนาด: {formatFileSize(selectedFile?.size || 0)}
                  </Text>
                  <Text style={styles.metadataText}>
                    วันที่อัพโหลด: {formatDate(selectedFile?.timeCreated || "")}
                  </Text>
                  <Text style={styles.metadataText}>
                    ประเภท: {selectedFile?.contentType || "ไม่ทราบ"}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={() => selectedFile && handleDownloadFile(selectedFile)}
              style={styles.modalActionButton}
            >
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.modalActionText}>ดาวน์โหลด</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9", // สีพื้นอ่อน
    padding: 10,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748b",
  },

  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateText: {
    fontSize: 16,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 22,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  backButton: {
    marginRight: 12,
    padding: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1e293b",
    flex: 1,
  },

  // Card Styles
  yearCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  termCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardText: {
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },

  // Document Card
  documentCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  documentHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f8fafc",
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    flex: 1,
    marginLeft: 8,
  },
  fileCount: {
    fontSize: 12,
    color: "#64748b",
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },

  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1e293b",
  },
  fileDetails: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  fileActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  loadingContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  imageContainer: {
    alignItems: "center",
    padding: 20,
  },
  textContent: {
    fontSize: 14,
    lineHeight: 22,
    color: "#374151",
    fontFamily: "monospace",
  },
  contentText: {
    fontSize: 15,
    lineHeight: 24,
    color: "#64748b",
    textAlign: "center",
    padding: 20,
  },
  fileMetadata: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
  },
  metadataTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 10,
  },
  metadataText: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 4,
  },

  modalActions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  modalActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    padding: 12,
    borderRadius: 8,
  },
  modalActionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});

export default DocumentsHistoryScreen;
