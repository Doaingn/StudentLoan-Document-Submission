// components/DocumentsSection.js - Updated with Term 2/3 support and AI validation
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const DocumentsSection = ({
  documents,
  uploads,
  onFileUpload,
  onRemoveFile,
  onShowFileModal,
  onDownloadDocument,
  formatFileSize,
  isValidatingAI = {},
  aiBackendAvailable = false,
  isConvertingToPDF = {},
  term = "1", // เพิ่ม term prop
  volunteerHours = 0,
}) => {
  const isProcessing = () => {
    return (
      (isValidatingAI && Object.keys(isValidatingAI).length > 0) ||
      (isConvertingToPDF && Object.keys(isConvertingToPDF).length > 0)
    );
  };
  console.log("isValidatingAI keys:", Object.keys(isValidatingAI));
  console.log("isConvertingToPDF keys:", Object.keys(isConvertingToPDF));
  const getProcessingStatus = (docId) => {
    const currentlyProcessing = isDocumentProcessing(docId);
    const otherProcessing = isProcessing() && !currentlyProcessing;
    return { currentlyProcessing, otherProcessing };
  };

  // ตรวจสอบว่า document นี้กำลัง process อยู่หรือไม่
  const isDocumentProcessing = (docId) => {
    return (
      isValidatingAI[docId] ||
      isConvertingToPDF[docId] ||
      isConvertingToPDF[`${docId}_merge`]
    );
  };
  // เอกสารที่มี AI validation แตกต่างกันตาม term
  const getAIEnabledDocuments = () => {
    switch (term) {
      case "1":
        return [
          "form_101",
          "consent_student_form",
          "consent_father_form",
          "consent_mother_form",
          "id_copies_student",
          "id_copies_father",
          "id_copies_mother",
        ];
      case "2":
      case "3":
        return ["id_copies_student", "guardian_id_copies"];
      default:
        return [];
    }
  };

  const AI_ENABLED_DOCUMENTS = getAIEnabledDocuments();

  // เอกสารที่สามารถ generate ได้แตกต่างกันตาม term
  const getGeneratableDocuments = () => {
    switch (term) {
      case "1":
        return [
          "form_101",
          "consent_student_form",
          "consent_father_form",
          "consent_mother_form",
          "guardian_income_cert",
          "father_income_cert",
          "mother_income_cert",
          "single_parent_income_cert",
          "famo_income_cert",
          "family_status_cert",
        ];
      case "2":
      case "3":
        return []; // เทอม 2/3 ไม่มี template ให้ generate
      default:
        return [];
    }
  };

  const GENERATABLE_DOCUMENTS = getGeneratableDocuments();

  const renderDocumentActions = (doc) => {
    const docFiles = uploads[doc.id] || [];
    const { currentlyProcessing, otherProcessing } = getProcessingStatus(
      doc.id
    );

    // Show validation spinner for AI checking
    if (isValidatingAI[doc.id]) {
      return (
        <View style={styles.actionButtons}>
          <View style={styles.validatingButton}>
            <ActivityIndicator size="small" color="#8b5cf6" />
            <Text style={styles.validatingText}>กำลังตรวจสอบ</Text>
          </View>
        </View>
      );
    }

    // Show PDF conversion spinner
    if (isConvertingToPDF[doc.id] || isConvertingToPDF[`${doc.id}_merge`]) {
      return (
        <View style={styles.actionButtons}>
          <View style={styles.convertingButton}>
            <ActivityIndicator size="small" color="#06b6d4" />
            <Text style={styles.convertingText}>กำลังแปลงเป็น PDF...</Text>
          </View>
        </View>
      );
    }

    // ถ้า document อื่นกำลัง process อยู่ แสดงข้อความ disabled
    if (otherProcessing) {
      return (
        <View style={styles.actionButtons}>
          <View style={styles.disabledButton}>
            <Ionicons name="lock-closed-outline" size={16} color="#9ca3af" />
            <Text style={styles.disabledText}>รอการประมวลผลเสร็จสิ้น...</Text>
          </View>
        </View>
      );
    }

    if (docFiles.length > 0) {
      return (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.addMoreButton}
            onPress={() => onFileUpload(doc.id, true)}
            disabled={otherProcessing}
          >
            <Ionicons name="add-circle-outline" size={16} color="#2563eb" />
            <Text style={styles.buttonText}>เพิ่มไฟล์</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeAllButton}
            onPress={() => onRemoveFile(doc.id)}
            disabled={otherProcessing}
          >
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text style={styles.buttonText}>ลบทั้งหมด</Text>
          </TouchableOpacity>
        </View>
      );
    } else {
      return (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => onFileUpload(doc.id, true)}
            disabled={otherProcessing}
          >
            <Ionicons name="cloud-upload-outline" size={16} color="#2563eb" />
            <Text style={styles.uploadButtonText}>อัปโหลด</Text>
          </TouchableOpacity>
          {GENERATABLE_DOCUMENTS.includes(doc.id) && (
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => onDownloadDocument(doc.id)}
              disabled={otherProcessing}
            >
              <Ionicons name="download-outline" size={16} color="#10b981" />
              <Text style={styles.buttonText}>ดาวน์โหลด</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
  };

  const getDocumentCardStyle = (doc) => {
    const baseStyle = [styles.documentCard];
    const docFiles = uploads[doc.id] || [];

    // ประกาศตัวแปรภายในฟังก์ชันนี้
    const currentlyProcessing = isDocumentProcessing(doc.id);
    const otherProcessing = isProcessing() && !currentlyProcessing;

    if (otherProcessing) {
      baseStyle.push(styles.disabledCard);
      return baseStyle;
    }

    if (currentlyProcessing) {
      baseStyle.push(styles.processingCard);
      return baseStyle;
    }

    if (docFiles.length > 0) {
      baseStyle.push({ borderLeftColor: "#10b981" });
    } else if (doc.required) {
      baseStyle.push({ borderLeftColor: "#ef4444" });
    } else {
      baseStyle.push({ borderLeftColor: "#e2e8f0" });
    }

    return baseStyle;
  };

  const getFileIcon = (mimeType, filename) => {
    const type = mimeType?.toLowerCase() || "";
    const name = filename?.toLowerCase() || "";

    if (
      type.startsWith("image/") ||
      name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)
    ) {
      return "image";
    } else if (type.includes("pdf") || name.endsWith(".pdf")) {
      return "document-text";
    } else if (type.includes("word") || name.match(/\.(doc|docx)$/)) {
      return "document";
    } else if (type.includes("excel") || name.match(/\.(xls|xlsx)$/)) {
      return "grid";
    } else if (type.includes("text") || name.match(/\.(txt|json)$/)) {
      return "document-text-outline";
    } else {
      return "document-outline";
    }
  };

  const renderFilesList = (doc) => {
    const docFiles = uploads[doc.id] || [];

    if (docFiles.length === 0) return null;

    // 🔄 แสดงชั่วโมงรวมสำหรับเอกสารจิตอาสา
    const showVolunteerHours = doc.id === "volunteer_doc";
    let totalHours = 0;

    if (showVolunteerHours) {
      totalHours = docFiles.reduce((sum, file) => sum + (file.hours || 0), 0);
    }

    return (
      <View style={styles.filesContainer}>
        <Text style={styles.filesHeader}>
          ไฟล์ที่อัปโหลด ({docFiles.length} ไฟล์)
        </Text>
        {showVolunteerHours && totalHours > 0 && (
          <View style={styles.volunteerHoursBadge}>
            <Ionicons name="time-outline" size={12} color="#059669" />
            <Text style={styles.volunteerHoursText}>{totalHours} ชั่วโมง</Text>
          </View>
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filesScrollView}
        >
          {docFiles.map((file, index) => (
            <View key={`${doc.id}_${index}`} style={styles.fileCard}>
              <TouchableOpacity
                style={styles.filePreview}
                onPress={() => onShowFileModal(doc.id, doc.title, index)}
              >
                <View style={styles.fileIconContainer}>
                  <Ionicons
                    name={getFileIcon(file.mimeType, file.filename)}
                    size={24}
                    color="#2563eb"
                  />
                </View>
                <Text style={styles.fileIndex}>#{index + 1}</Text>
                {showVolunteerHours && file.hours > 0 && (
                  <View style={styles.fileHoursBadge}>
                    <Text style={styles.fileHoursText}>{file.hours}h</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.fileDetails}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.filename}
                </Text>
                <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>

                {/* AI validation badges */}
                {renderAIValidationBadge(doc, file)}
              </View>

              <TouchableOpacity
                style={styles.removeFileButton}
                onPress={() => onRemoveFile(doc.id, index)}
              >
                <Ionicons name="close-circle" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderAIValidationBadge = (doc, file) => {
    // AI validation badge for different document types based on term
    if (term === "1") {
      // Term 1 AI validation badges
      if (doc.id === "form_101" && file.aiValidated) {
        return (
          <View style={styles.aiValidatedBadge}>
            <Ionicons name="sparkles" size={10} color="#8b5cf6" />
            <Text style={styles.aiValidatedText}>AI ตรวจสอบแล้ว</Text>
          </View>
        );
      }

      if (
        [
          "consent_student_form",
          "consent_father_form",
          "consent_mother_form",
        ].includes(doc.id) &&
        file.aiValidated
      ) {
        return (
          <View style={styles.consentAiValidatedBadge}>
            <Ionicons name="shield-checkmark" size={10} color="#059669" />
            <Text style={styles.consentAiValidatedText}>
              ยินยอม AI ตรวจสอบแล้ว
            </Text>
          </View>
        );
      }

      if (
        ["id_copies_student", "id_copies_father", "id_copies_mother"].includes(
          doc.id
        ) &&
        file.aiValidated
      ) {
        return (
          <View style={styles.idAiValidatedBadge}>
            <Ionicons name="card" size={10} color="#dc2626" />
            <Text style={styles.idAiValidatedText}>บัตร AI ตรวจสอบแล้ว</Text>
          </View>
        );
      }
    } else if (term === "2" || term === "3") {
      // Term 2/3 AI validation badges
      if (
        ["id_copies_student", "guardian_id_copies"].includes(doc.id) &&
        file.aiValidated
      ) {
        return (
          <View style={styles.idAiValidatedBadge}>
            <Ionicons name="card" size={10} color="#dc2626" />
            <Text style={styles.idAiValidatedText}>บัตร AI ตรวจสอบแล้ว</Text>
          </View>
        );
      }
    }

    // Show converted from image badge
    if (file.convertedFromImage) {
      return (
        <View style={styles.convertedBadge}>
          <Ionicons name="image" size={10} color="#0ea5e9" />
          <Text style={styles.convertedText}>แปลงจากรูปภาพ</Text>
        </View>
      );
    }

    return null;
  };

  const renderDocumentStatusBadge = (doc) => {
    const docFiles = uploads[doc.id] || [];

    if (docFiles.length === 0) return null;

    // Show total files count
    return (
      <View style={styles.filesCountBadge}>
        <Ionicons name="documents" size={12} color="#2563eb" />
        <Text style={styles.filesCountText}>{docFiles.length} ไฟล์</Text>
      </View>
    );
  };

  const getAIBadgeForDocument = (docId) => {
    if (AI_ENABLED_DOCUMENTS.includes(docId)) {
      // Different AI badge styles for different document types
      if (term === "1") {
        if (docId === "form_101") {
          return (
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles-outline" size={12} color="#8b5cf6" />
              <Text style={styles.aiBadgeText}>AI ตรวจสอบ</Text>
            </View>
          );
        }

        if (
          [
            "consent_student_form",
            "consent_father_form",
            "consent_mother_form",
          ].includes(docId)
        ) {
          return (
            <View style={[styles.aiBadge, styles.consentAiBadge]}>
              <Ionicons
                name="shield-checkmark-outline"
                size={12}
                color="#059669"
              />
              <Text style={[styles.aiBadgeText, styles.consentAiBadgeText]}>
                ยินยอม AI
              </Text>
            </View>
          );
        }

        if (
          [
            "id_copies_student",
            "id_copies_father",
            "id_copies_mother",
          ].includes(docId)
        ) {
          return (
            <View style={[styles.aiBadge, styles.idAiBadge]}>
              <Ionicons name="card-outline" size={12} color="#dc2626" />
              <Text style={[styles.aiBadgeText, styles.idAiBadgeText]}>
                บัตร AI
              </Text>
            </View>
          );
        }
      } else if (term === "2" || term === "3") {
        if (["id_copies_student", "guardian_id_copies"].includes(docId)) {
          return (
            <View style={[styles.aiBadge, styles.idAiBadge]}>
              <Ionicons name="card-outline" size={12} color="#dc2626" />
              <Text style={[styles.aiBadgeText, styles.idAiBadgeText]}>
                บัตร AI
              </Text>
            </View>
          );
        }
      }
    }

    return null;
  };

  const renderAIUnavailableWarning = (doc) => {
    if (!AI_ENABLED_DOCUMENTS.includes(doc.id)) return null;
    if (aiBackendAvailable) return null;

    const docFiles = uploads[doc.id] || [];
    if (docFiles.length === 0) return null;

    let warningText = "AI ไม่พร้อมใช้งาน";

    // Different warning messages based on document type and term
    if (term === "1") {
      if (doc.id === "form_101") {
        warningText = "AI ตรวจสอบฟอร์มไม่พร้อมใช้งาน";
      } else if (
        [
          "consent_student_form",
          "consent_father_form",
          "consent_mother_form",
        ].includes(doc.id)
      ) {
        warningText = "AI ตรวจสอบยินยอมไม่พร้อมใช้งาน";
      } else if (
        ["id_copies_student", "id_copies_father", "id_copies_mother"].includes(
          doc.id
        )
      ) {
        warningText = "AI ตรวจสอบบัตรประชาชนไม่พร้อมใช้งาน";
      }
    } else if (term === "2" || term === "3") {
      if (["id_copies_student", "guardian_id_copies"].includes(doc.id)) {
        warningText = "AI ตรวจสอบบัตรประชาชนไม่พร้อมใช้งาน";
      }
    }

    return (
      <View style={styles.aiUnavailableBadge}>
        <Ionicons name="warning-outline" size={12} color="#f59e0b" />
        <Text style={styles.aiUnavailableText}>{warningText}</Text>
      </View>
    );
  };

  const getSectionTitle = () => {
    switch (term) {
      case "1":
        return "รายการเอกสารสำหรับการสมัคร";
      case "2":
        return "รายการเอกสารสำหรับการเบิกเงินกู้ยืม เทอม 2";
      case "3":
        return "รายการเอกสารสำหรับการเบิกเงินกู้ยืม เทอม 3";
      default:
        return "รายการเอกสาร";
    }
  };

  return (
    <View style={styles.documentsSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{getSectionTitle()}</Text>
        {!aiBackendAvailable && AI_ENABLED_DOCUMENTS.length > 0 && (
          <View style={styles.aiStatusWarning}>
            <Ionicons name="warning-outline" size={16} color="#f59e0b" />
            <Text style={styles.aiStatusText}>
              ระบบ AI ตรวจสอบเอกสารไม่พร้อมใช้งาน
            </Text>
          </View>
        )}
        {isProcessing() && (
          <View style={styles.processingWarning}>
            <ActivityIndicator size="small" color="#8b5cf6" />
            <Text style={styles.processingWarningText}>
              กำลังประมวลผลเอกสาร กรุณารอสักครู่...
            </Text>
          </View>
        )}
      </View>

      {documents.map((doc, index) => {
        const { currentlyProcessing, otherProcessing } = getProcessingStatus(
          doc.id
        );

        return (
          <View
            key={doc.id}
            style={getDocumentCardStyle(doc)}
            pointerEvents={otherProcessing ? "none" : "auto"}
          >
            <View
              style={[
                styles.documentContent,
                otherProcessing && styles.disabledContent,
              ]}
            >
              <View style={styles.documentInfo}>
                <View style={styles.documentIcon}>
                  <Ionicons
                    name={
                      uploads[doc.id]?.length > 0
                        ? "checkmark-circle"
                        : doc.required
                        ? "document-text-outline"
                        : "document-outline"
                    }
                    size={24}
                    color={
                      otherProcessing
                        ? "#d1d5db"
                        : uploads[doc.id]?.length > 0
                        ? "#10b981"
                        : doc.required
                        ? "#2563eb"
                        : "#9ca3af"
                    }
                  />
                </View>
                <View style={styles.documentDetails}>
                  <View style={styles.documentTitleContainer}>
                    <Text
                      style={[
                        styles.documentTitle,
                        otherProcessing && styles.disabledText,
                      ]}
                      numberOfLines={2}
                    >
                      {doc.title}
                      {doc.required && (
                        <Text style={styles.requiredMark}> *</Text>
                      )}
                    </Text>
                    {getAIBadgeForDocument(doc.id)}
                  </View>

                  {doc.description && (
                    <Text
                      style={[
                        styles.documentDescription,
                        otherProcessing && styles.disabledText,
                      ]}
                      numberOfLines={2}
                    >
                      {doc.description}
                    </Text>
                  )}

                  {renderDocumentStatusBadge(doc)}
                  {renderAIUnavailableWarning(doc)}
                </View>
              </View>
            </View>

            {renderFilesList(doc)}

            <View style={styles.documentActions}>
              {renderDocumentActions(doc)}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  volunteerStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  volunteerHours: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
  },
  documentsSection: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    color: "#1e293b",
  },
  aiStatusWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  aiStatusText: {
    fontSize: 12,
    color: "#92400e",
    marginLeft: 4,
    fontWeight: "500",
  },
  documentCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderLeftWidth: 4,
    borderLeftColor: "#e2e8f0",
  },
  documentContent: {
    marginBottom: 12,
  },
  documentInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  documentIcon: {
    marginRight: 12,
    paddingTop: 2,
  },
  documentDetails: {
    flex: 1,
  },
  documentTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1e293b",
    marginRight: 8,
  },
  requiredMark: {
    color: "#ef4444",
    fontWeight: "bold",
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#8b5cf6",
    marginRight: 6,
  },
  aiBadgeText: {
    fontSize: 10,
    color: "#8b5cf6",
    fontWeight: "600",
    marginLeft: 2,
  },
  consentAiBadge: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  consentAiBadgeText: {
    color: "#059669",
  },
  idAiBadge: {
    backgroundColor: "#fef2f2",
    borderColor: "#dc2626",
  },
  idAiBadgeText: {
    color: "#dc2626",
  },
  documentDescription: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
    marginBottom: 8,
  },
  filesCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  filesCountText: {
    fontSize: 11,
    color: "#2563eb",
    fontWeight: "600",
    marginLeft: 4,
  },
  aiUnavailableBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  aiUnavailableText: {
    fontSize: 11,
    color: "#92400e",
    fontWeight: "600",
    marginLeft: 4,
  },
  filesContainer: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  filesHeader: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  filesScrollView: {
    maxHeight: 120,
  },
  fileCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginRight: 12,
    padding: 8,
    minWidth: 100,
    maxWidth: 120,
    position: "relative",
  },
  filePreview: {
    alignItems: "center",
    marginBottom: 6,
  },
  fileIconContainer: {
    backgroundColor: "#eff6ff",
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  fileIndex: {
    fontSize: 10,
    color: "#6b7280",
    fontWeight: "500",
  },
  fileDetails: {
    alignItems: "center",
  },
  fileName: {
    fontSize: 11,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 2,
    textAlign: "center",
  },
  fileSize: {
    fontSize: 10,
    color: "#9ca3af",
    textAlign: "center",
  },
  aiValidatedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3e8ff",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  aiValidatedText: {
    fontSize: 9,
    color: "#7c3aed",
    fontWeight: "600",
    marginLeft: 2,
  },
  consentAiValidatedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#d1fae5",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  consentAiValidatedText: {
    fontSize: 9,
    color: "#065f46",
    fontWeight: "600",
    marginLeft: 2,
  },
  idAiValidatedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  idAiValidatedText: {
    fontSize: 9,
    color: "#991b1b",
    fontWeight: "600",
    marginLeft: 2,
  },
  convertedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  convertedText: {
    fontSize: 9,
    color: "#0369a1",
    fontWeight: "600",
    marginLeft: 2,
  },
  removeFileButton: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#fff",
    borderRadius: 10,
  },
  documentActions: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 12,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 8,
    flexWrap: "wrap",
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2563eb",
    minWidth: 100,
    justifyContent: "center",
  },
  uploadButtonText: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  addMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0ea5e9",
    minWidth: 100,
    justifyContent: "center",
  },
  validatingButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3e8ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#8b5cf6",
    minWidth: 120,
    justifyContent: "center",
  },
  validatingText: {
    color: "#7c3aed",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  convertingButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#06b6d4",
    minWidth: 120,
    justifyContent: "center",
  },
  convertingText: {
    color: "#0891b2",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  removeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ef4444",
    minWidth: 110,
    justifyContent: "center",
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#10b981",
    minWidth: 110,
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
    color: "inherit",
  },
  filesHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  volunteerHoursBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#d1fae5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#059669",
  },
  volunteerHoursText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
    marginLeft: 4,
  },
  fileHoursBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#10b981",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  fileHoursText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "white",
  },
  disabledCard: {
    backgroundColor: "#f9fafb",
    opacity: 0.6,
  },
  processingCard: {
    borderLeftColor: "#8b5cf6",
    borderLeftWidth: 4,
    backgroundColor: "#faf5ff",
  },
  disabledContent: {
    opacity: 0.5,
  },
  disabledButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    minWidth: 100,
    justifyContent: "center",
  },
  disabledText: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  processingWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#faf5ff",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#8b5cf6",
    marginTop: 8,
  },
  processingWarningText: {
    fontSize: 12,
    color: "#7c3aed",
    marginLeft: 8,
    fontWeight: "500",
  },
});

export default DocumentsSection;
