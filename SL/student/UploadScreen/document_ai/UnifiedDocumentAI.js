import { Alert } from "react-native";
import {
  validateForm101Document,
  showForm101ValidationAlert,
  checkForm101AIStatus,
} from "./Form101AI";
import {
  validateConsentForm,
  showConsentFormValidationAlert,
  checkConsentFormAIStatus,
  getConsentFormTypeName,
} from "./ConsentFormAI";
import {
  validateIDCard,
  showIDCardValidationAlert,
  checkIDCardAIStatus,
  getIDCardTypeName,
} from "./IDCardAI";

import {
  validateIncomeCert,
  showIncomeCertValidationAlert,
  checkIncomeCertAIStatus,
  getIncomeCertTypeName,
} from "./IncomeCertAI";
import {
  validateSalaryCert,
  showSalaryCertValidationAlert,
  checkSalaryCertAIStatus,
  getSalaryCertTypeName,
} from "./SalaryCertAI";
import {
  validateFamilyStatusCert,
  showFamilyStatusCertValidationAlert,
  checkFamilyStatusCertAIStatus,
} from "./FamilyStatusAI";
import {
  validateGovIDCert,
  showGovIDCertValidationAlert,
  checkGovIDCertAIStatus,
  getGovIDCertTypeName,
} from "./GovIDCertAI";
import {
  validateLegalStatus,
  showLegalStatusValidationAlert,
  checkLegalStatusAIStatus,
  getLegalStatusTypeName,
} from "./LegalStatusAI";
import {
  validateVolunteerDocument,
  showVolunteerDocValidationAlert,
  checkVolunteerDocumentAIStatus,
} from "./VolunteerDocumentAI";
import {
  validateDisbursementForm,
  showDisbursementFormValidationAlert,
  checkDisbursementFormAIStatus,
} from "./DisbursementFormAI";
import {
  validateTuitionExpense,
  showTuitionExpenseValidationAlert,
  checkTuitionExpenseAIStatus,
  getTuitionExpenseTypeName,
} from "./TuitionExpenseAI";

// Combined AI status check
export const checkAIBackendStatus = async () => {
  console.log("🤖 Checking unified AI backend status...");

  try {
    const [
      form101Status,
      consentFormStatus,
      idCardStatus,
      incomeCertStatus,
      salaryCertStatus,
      familyStatusStatus,
      govIDCertStatus,
      legalStatusStatus,
      volunteerStatus,
      disbursementFormStatus,
      tuitionExpenseStatus,
    ] = await Promise.all([
      checkForm101AIStatus(),
      checkConsentFormAIStatus(),
      checkIDCardAIStatus(),
      checkIncomeCertAIStatus(),
      checkSalaryCertAIStatus(),
      checkFamilyStatusCertAIStatus(),
      checkGovIDCertAIStatus(),
      checkLegalStatusAIStatus(),
      checkVolunteerDocumentAIStatus(),
      checkDisbursementFormAIStatus(),
      checkTuitionExpenseAIStatus(),
    ]);

    console.log("Form101 AI Status:", form101Status);
    console.log("ConsentForm AI Status:", consentFormStatus);
    console.log("IDCard AI Status:", idCardStatus);
    console.log("IncomeCert AI Status:", incomeCertStatus);
    console.log("SalaryCert AI Status:", salaryCertStatus);
    console.log("FamilyStatus AI Status:", familyStatusStatus);
    console.log("GovIDCert AI Status:", govIDCertStatus);
    console.log("LegalStatus AI Status:", legalStatusStatus);
    console.log("VolunteerDocument AI Status:", volunteerStatus);
    console.log("DisbursementForm AI Status:", disbursementFormStatus);
    console.log("TuitionExpense AI Status:", tuitionExpenseStatus);

    const isAvailable =
      form101Status ||
      consentFormStatus ||
      idCardStatus ||
      incomeCertStatus ||
      salaryCertStatus ||
      familyStatusStatus ||
      govIDCertStatus ||
      legalStatusStatus ||
      volunteerStatus ||
      disbursementFormStatus ||
      tuitionExpenseStatus;
    console.log(
      "✓ Unified AI Backend Status:",
      isAvailable ? "Available" : "Unavailable"
    );

    return isAvailable;
  } catch (error) {
    console.error("❌ Unified AI backend check failed:", error);
    return false;
  }
};

// Universal validation function that routes to appropriate validator
export const validateDocument = async (
  fileUri,
  documentType,
  formType = null,
  mimeType = null,
  userId = null
) => {
  try {
    console.log(`🚀 Starting document validation for type: ${documentType}`);
    console.log(`📁 File URI: ${fileUri}`);
    console.log(`📋 MIME Type: ${mimeType}`);

    switch (documentType) {
      case "form_101":
        console.log("🔥 FORM 101 - Starting AI validation...");
        const result = await validateForm101Document(fileUri, mimeType);
        console.log("🔥 FORM 101 - AI validation result:", result);
        return result;

      // === TUITION EXPENSE (ภาระค่าใช้จ่ายทุนการศึกษา) VALIDATION ===
      case "expense_burden_form":
      case "tuition_expense":
      case "tuition_burden":
      case "scholarship_expense":
        console.log("🎓 TUITION EXPENSE - Starting AI validation...");
        const tuitionExpenseResult = await validateTuitionExpense(fileUri, mimeType);
        console.log("🎓 TUITION EXPENSE - AI validation result:", tuitionExpenseResult);
        return tuitionExpenseResult;

      // === DISBURSEMENT FORM VALIDATION ===
      case "disbursement_form":
      case "disbursement_receipt":
      case "loan_disbursement":
      case "fund_disbursement":
        console.log("💳 DISBURSEMENT FORM - Starting AI validation...");
        const disbursementResult = await validateDisbursementForm(fileUri, mimeType);
        console.log("💳 DISBURSEMENT FORM - AI validation result:", disbursementResult);
        return disbursementResult;

      // === ID CARD VALIDATIONS - COMPLETE MAPPING ===
      case "id_copies_student":
        console.log("🆔 ID STUDENT - Starting AI validation...");
        return await validateIDCard(fileUri, "student", mimeType);

      case "id_copies_father":
      case "id_copies_consent_father_form":
        console.log("🆔 ID FATHER - Starting AI validation...");
        return await validateIDCard(fileUri, "father", mimeType);

      case "id_copies_mother":
      case "id_copies_consent_mother_form":
        console.log("🆔 ID MOTHER - Starting AI validation...");
        return await validateIDCard(fileUri, "mother", mimeType);

      case "guardian_id_copies":
        console.log("🆔 ID GUARDIAN - Starting AI validation...");
        return await validateIDCard(fileUri, "guardian", mimeType);

      // === INCOME CERTIFICATE VALIDATIONS ===
      // <<< ส่วนนี้มีอยู่แล้วและทำงานถูกต้อง >>>
      case "father_income_cert":
        console.log("💰 INCOME FATHER - Starting AI validation...");
        return await validateIncomeCert(fileUri, "father", mimeType);

      case "mother_income_cert":
        console.log("💰 INCOME MOTHER - Starting AI validation...");
        return await validateIncomeCert(fileUri, "mother", mimeType);

      case "guardian_income_cert":
        console.log("💰 INCOME GUARDIAN - Starting AI validation...");
        return await validateIncomeCert(fileUri, "guardian", mimeType);

      case "single_parent_income_cert":
        console.log("💰 INCOME SINGLE PARENT - Starting AI validation...");
        return await validateIncomeCert(fileUri, "single_parent", mimeType);

      case "famo_income_cert":
        console.log("💰 INCOME FAMILY - Starting AI validation...");
        return await validateIncomeCert(fileUri, "family", mimeType);
      // <<< จบส่วนที่มีอยู่แล้ว >>>

      // === SALARY CERTIFICATE VALIDATIONS ===
      case "father_income":
        console.log("💵 SALARY FATHER - Starting AI validation...");
        return await validateSalaryCert(fileUri, "father", mimeType, true);

      case "mother_income":
        console.log("💵 SALARY MOTHER - Starting AI validation...");
        return await validateSalaryCert(fileUri, "mother", mimeType, true);

      case "guardian_income":
        console.log("💵 SALARY GUARDIAN - Starting AI validation...");
        return await validateSalaryCert(fileUri, "guardian", mimeType, true);

      case "single_parent_income":
        console.log("💵 SALARY SINGLE PARENT - Starting AI validation...");
        return await validateSalaryCert(fileUri, "single_parent", mimeType, true);

      // === CONSENT FORM VALIDATIONS ===
      case "consent_student_form":
        console.log("📝 CONSENT STUDENT - Starting AI validation...");
        return await validateConsentForm(fileUri, "student", mimeType);

      case "consent_father_form":
        console.log("📝 CONSENT FATHER - Starting AI validation...");
        return await validateConsentForm(fileUri, "father", mimeType);

      case "consent_mother_form":
        console.log("📝 CONSENT MOTHER - Starting AI validation...");
        return await validateConsentForm(fileUri, "mother", mimeType);

      case "guardian_consent":
        console.log("📝 GUARDIAN CONSENT - Starting AI validation...");
        return await validateConsentForm(fileUri, "guardian", mimeType);

      case "consent_form":
        console.log("📝 GENERIC CONSENT - Starting AI validation...");
        const consentType = formType || "student";
        return await validateConsentForm(fileUri, consentType, mimeType);

      // === GOVERNMENT ID CERTIFICATE VALIDATIONS ===
      case "fa_id_copies_gov":
        console.log("🏛️ GOV ID FATHER - Starting AI validation...");
        return await validateGovIDCert(fileUri, "father", mimeType);

      case "mo_id_copies_gov":
        console.log("🏛️ GOV ID MOTHER - Starting AI validation...");
        return await validateGovIDCert(fileUri, "mother", mimeType);

      case "famo_id_copies_gov":
        console.log("🏛️ GOV ID PARENTS - Starting AI validation...");
        return await validateGovIDCert(fileUri, "parents", mimeType);

      case "fam_id_copies_gov":
        console.log("🏛️ GOV ID FAMILY - Starting AI validation...");
        return await validateGovIDCert(fileUri, "family", mimeType);

      case "102_id_copies_gov":
        console.log("🏛️ GOV ID INCOME_CERT - Starting AI validation...");
        return await validateGovIDCert(fileUri, "income_cert", mimeType);

      case "guar_id_copies_gov":
        console.log("🏛️ GOV ID GUARDIAN - Starting AI validation...");
        return await validateGovIDCert(fileUri, "guardian", mimeType);

      // === LEGAL STATUS VALIDATIONS ===
      case "legal_status":
        console.log("⚖️ LEGAL STATUS - Starting AI validation...");
        return await validateLegalStatus(fileUri, "legal_status", mimeType);

      // === FAMILY STATUS VALIDATIONS ===
      case "family_status_cert":
        console.log("👨‍👩‍👧‍👦 FAMILY STATUS - Starting AI validation...");
        return await validateFamilyStatusCert(fileUri, mimeType);

      case "volunteer_doc":
        console.log("❤️ VOLUNTEER DOCUMENT - Starting AI validation...");
        return await validateVolunteerDocument(
          fileUri,
          "certificate",
          mimeType,
          false,
          userId
        );

      default:
        console.log(
          `❌ Document type ${documentType} does not require AI validation`
        );
        return {
          isValid: true,
          confidence: 100,
          overall_status: "valid",
          message: `เอกสาร ${documentType} ไม่ต้องตรวจสอบด้วย AI`,
        };
    }
  } catch (error) {
    console.error(`❌ Document validation failed for ${documentType}:`, error);
    throw error;
  }
};

// Helper function to determine if document needs AI validation - UPDATED
export const needsAIValidation = (documentType) => {
  const aiEnabledDocs = [
    "form_101",
    // Tuition Expense documents (ภาระค่าใช้จ่ายทุนการศึกษา)
    "expense_burden_form",
    "tuition_expense",
    "tuition_burden",
    "scholarship_expense",
    // Disbursement Form documents
    "disbursement_form",
    "disbursement_receipt",
    "loan_disbursement",
    "fund_disbursement",
    // ID Card documents
    "id_copies_student",
    "id_copies_father",
    "id_copies_mother",
    "id_copies_consent_father_form",
    "id_copies_consent_mother_form",
    "guardian_id_copies",
    // Income Certificate documents (<<< มีอยู่แล้ว >>>)
    "father_income_cert",
    "mother_income_cert",
    "guardian_income_cert",
    "single_parent_income_cert",
    "famo_income_cert",
    // Salary Certificate documents
    "father_income",
    "mother_income",
    "guardian_income",
    "single_parent_income",
    // Family and Legal Status documents
    "family_status_cert",
    "legal_status",
    // Consent Form documents
    "consent_student_form",
    "consent_father_form",
    "consent_mother_form",
    "guardian_consent",
    // Government ID Certificates
    "fa_id_copies_gov",
    "mo_id_copies_gov",
    "famo_id_copies_gov",
    "fam_id_copies_gov",
    "102_id_copies_gov",
    "guar_id_copies_gov",
    // Volunteer documents
    "volunteer_doc",
  ];

  const needsAI = aiEnabledDocs.includes(documentType);
  console.log(`🤖 Document ${documentType} needs AI validation: ${needsAI}`);
  return needsAI;
};

// Universal alert display function - UPDATED
export const showValidationAlert = (
  result,
  documentType,
  onAccept,
  onReject
) => {
  try {
    console.log(`🚨 Showing validation alert for ${documentType}`);
    console.log(`🚨 Result:`, result);

    if (!needsAIValidation(documentType)) {
      console.log(
        `⏭️ Document ${documentType} does not need AI validation - auto accepting`
      );
      onAccept();
      return;
    }

    switch (documentType) {
      case "form_101":
        console.log("🔥 FORM 101 - Showing validation alert");
        return showForm101ValidationAlert(result, onAccept, onReject);

      // === TUITION EXPENSE ALERTS ===
      case "expense_burden_form":
      case "tuition_expense":
      case "tuition_burden":
      case "scholarship_expense":
        console.log("🎓 TUITION EXPENSE - Showing validation alert");
        return showTuitionExpenseValidationAlert(result, onAccept, onReject);

      // === DISBURSEMENT FORM ALERTS ===
      case "disbursement_form":
      case "disbursement_receipt":
      case "loan_disbursement":
      case "fund_disbursement":
        console.log("💳 DISBURSEMENT FORM - Showing validation alert");
        return showDisbursementFormValidationAlert(result, onAccept, onReject);

      // === ID CARD ALERTS ===
      case "id_copies_student":
        console.log("🆔 ID STUDENT - Showing validation alert");
        return showIDCardValidationAlert(result, onAccept, onReject);

      case "id_copies_father":
      case "id_copies_consent_father_form":
        console.log("🆔 ID FATHER - Showing validation alert");
        return showIDCardValidationAlert(result, onAccept, onReject);

      case "id_copies_mother":
      case "id_copies_consent_mother_form":
        console.log("🆔 ID MOTHER - Showing validation alert");
        return showIDCardValidationAlert(result, onAccept, onReject);

      case "guardian_id_copies":
        console.log("🆔 ID GUARDIAN - Showing validation alert");
        return showIDCardValidationAlert(result, onAccept, onReject);

      // === INCOME CERTIFICATE ALERTS ===
      // <<< แก้ไขจุดที่ 1: เพิ่ม case สำหรับเอกสารรายได้ทุกประเภทที่ขาดหายไป >>>
      case "father_income_cert":
      case "mother_income_cert":
      case "guardian_income_cert":
      case "single_parent_income_cert":
      case "famo_income_cert":
        console.log("💰 INCOME CERT - Showing validation alert");
        return showIncomeCertValidationAlert(result, onAccept, onReject);
      // <<< จบส่วนที่แก้ไข >>>

      // === SALARY CERTIFICATE ALERTS ===
      case "father_income":
      case "mother_income":
      case "guardian_income":
      case "single_parent_income":
        console.log("💵 SALARY CERT - Showing validation alert");
        return showSalaryCertValidationAlert(result, onAccept, onReject);

      // === FAMILY STATUS ALERTS ===
      case "family_status_cert":
        console.log("👨‍👩‍👧‍👦 FAMILY STATUS - Showing validation alert");
        return showFamilyStatusCertValidationAlert(result, onAccept, onReject);

      // === GOVERNMENT ID CERTIFICATE ALERTS ===
      case "fa_id_copies_gov":
      case "mo_id_copies_gov":
      case "famo_id_copies_gov":
      case "fam_id_copies_gov":
      case "102_id_copies_gov":
      case "guar_id_copies_gov":
        console.log("🏛️ GOV ID CERT - Showing validation alert");
        return showGovIDCertValidationAlert(result, onAccept, onReject);

      // === LEGAL STATUS ALERTS ===
      case "legal_status":
        console.log("⚖️ LEGAL STATUS - Showing validation alert");
        return showLegalStatusValidationAlert(result, onAccept, onReject);

      // === CONSENT FORM ALERTS ===
      case "consent_student_form":
      case "consent_father_form":
      case "consent_mother_form":
      case "guardian_consent":
      case "consent_form":
        console.log("📝 CONSENT - Showing validation alert");
        return showConsentFormValidationAlert(result, onAccept, onReject);

      // === VOLUNTEER DOCUMENT ALERTS ===
      case "volunteer_doc":
        console.log("❤️ VOLUNTEER DOCUMENT - Showing validation alert");
        return showVolunteerDocValidationAlert(result, onAccept, onReject);

      default:
        console.warn(`⚠️ Unknown document type for alert: ${documentType}`);
        Alert.alert(
          "ตรวจสอบเอกสารเสร็จสิ้น",
          "เอกสารผ่านการตรวจสอบเรียบร้อยแล้ว",
          [{ text: "ใช้ไฟล์นี้", onPress: onAccept }]
        );
    }
  } catch (error) {
    console.error("❌ Error showing validation alert:", error);
    Alert.alert(
      "เกิดข้อผิดพลาด",
      `ไม่สามารถแสดงผลการตรวจสอบได้: ${error.message}`,
      [
        { text: "ลองใหม่", style: "cancel", onPress: onReject },
        { text: "ดำเนินการต่อ", onPress: onAccept },
      ]
    );
  }
};

// Helper function to get document type display name - UPDATED
export const getDocumentTypeName = (documentType) => {
  const typeNames = {
    form_101: "กยศ 101",
    // Tuition Expense documents (ภาระค่าใช้จ่ายทุนการศึกษา)
    expense_burden_form: "ภาระค่าใช้จ่ายทุนการศึกษา",
    tuition_expense: "ภาระค่าใช้จ่ายทุนการศึกษา",
    tuition_burden: "ภาระค่าใช้จ่ายทุนการศึกษา",
    scholarship_expense: "ภาระค่าใช้จ่ายทุนการศึกษา",
    // Disbursement Form documents
    disbursement_form: "แบบยืนยันการเบิกเงินกู้ยืม",
    disbursement_receipt: "ใบยืนยันการรับเงิน",
    loan_disbursement: "เอกสารเบิกเงินกู้ยืม",
    fund_disbursement: "เอกสารเบิกทุนการศึกษา",
    // Volunteer documents
    volunteer_doc: "เอกสารจิตอาสา",
    // ID Card documents
    id_copies_student: "สำเนาบัตรประชาชนนักศึกษา",
    id_copies_father: "สำเนาบัตรประชาชนบิดา",
    id_copies_mother: "สำเนาบัตรประชาชนมารดา",
    id_copies_consent_father_form: "สำเนาบัตรประชาชนบิดา",
    id_copies_consent_mother_form: "สำเนาบัตรประชาชนมารดา",
    guardian_id_copies: "สำเนาบัตรประชาชนผู้ปกครอง",
    // Consent Form documents
    consent_student_form: "หนังสือยินยอมเปิดเผยข้อมูลนักศึกษา",
    consent_father_form: "หนังสือยินยอมเปิดเผยข้อมูลบิดา",
    consent_mother_form: "หนังสือยินยอมเปิดเผยข้อมูลมารดา",
    guardian_consent: "หนังสือยินยอมเปิดเผยข้อมูลผู้ปกครอง",
    // Income Certificate documents
    father_income_cert: "หนังสือรับรองรายได้บิดา",
    mother_income_cert: "หนังสือรับรองรายได้มารดา",
    guardian_income_cert: "หนังสือรับรองรายได้ผู้ปกครอง",
    single_parent_income_cert: "หนังสือรับรองรายได้ผู้ปกครองเดี่ยว",
    famo_income_cert: "หนังสือรับรองรายได้บิดามารดา",
    // Salary Certificate documents
    single_parent_income: "หนังสือรับรองเงินเดือน",
    father_income: "หนังสือรับรองเงินเดือนบิดา",
    mother_income: "หนังสือรับรองเงินเดือนมารดา",
    guardian_income: "หนังสือรับรองเงินเดือนผู้ปกครอง",
    // Family and Legal Status documents
    family_status_cert: "หนังสือรับรองสถานภาพครอบครัว",
    legal_status: "สำเนาใบหย่า (กรณีหย่าร้าง) หรือ สำเนาใบมรณบัตร (กรณีเสียชีวิต)",
    // Government ID Certificate documents
    fa_id_copies_gov: "สำเนาบัตรข้าราชการผู้รับรองบิดา",
    mo_id_copies_gov: "สำเนาบัตรข้าราชการผู้รับรองมารดา",
    famo_id_copies_gov: "สำเนาบัตรข้าราชการผู้รับรอง",
    fam_id_copies_gov: "สำเนาบัตรข้าราชการผู้รับรอง",
    "102_id_copies_gov": "สำเนาบัตรข้าราชการผู้รับรอง",
    guar_id_copies_gov: "สำเนาบัตรข้าราชการผู้รับรองผู้ปกครอง",
  };

  return typeNames[documentType] || "เอกสารไม่ทราบประเภท";
};

// Batch validation for multiple documents
export const validateMultipleDocuments = async (documents) => {
  const results = [];

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    try {
      const result = await validateDocument(
        doc.fileUri,
        doc.documentType,
        doc.formType,
        doc.mimeType
      );

      results.push({
        index: i,
        fileName: doc.fileName,
        documentType: doc.documentType,
        formType: doc.formType,
        validation: result,
        success: true,
      });
    } catch (error) {
      results.push({
        index: i,
        fileName: doc.fileName,
        documentType: doc.documentType,
        formType: doc.formType,
        error: error.message,
        success: false,
      });
    }
  }

  return results;
};

// Export individual validation functions for direct use
export {
  validateForm101Document,
  validateConsentForm,
  validateIDCard,
  validateIncomeCert,
  validateSalaryCert,
  validateFamilyStatusCert,
  validateGovIDCert,
  validateLegalStatus,
  validateDisbursementForm,
  validateTuitionExpense,
  showForm101ValidationAlert,
  showConsentFormValidationAlert,
  showIDCardValidationAlert,
  showIncomeCertValidationAlert,
  showSalaryCertValidationAlert,
  showFamilyStatusCertValidationAlert,
  showGovIDCertValidationAlert,
  showLegalStatusValidationAlert,
  showDisbursementFormValidationAlert,
  showTuitionExpenseValidationAlert,
  getConsentFormTypeName,
  getIDCardTypeName,
  getIncomeCertTypeName,
  getSalaryCertTypeName,
  getGovIDCertTypeName,
  getLegalStatusTypeName,
  getTuitionExpenseTypeName,
};