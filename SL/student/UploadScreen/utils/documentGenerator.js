// documentGenerator.js - Document list generator and handler (Updated for Term 2 & 3 support)
import { Alert, Linking } from "react-native";
import { InsertForm101 } from "../../documents/InsertForm101";
import { ConsentFrom_student } from "../../documents/ConsentFrom_student";
import { ConsentFrom_father } from "../../documents/ConsentFrom_father";
import { ConsentFrom_mother } from "../../documents/ConsentFrom_mother";
import { Income102 } from "../../documents/income102";
import { FamStatus_cert } from "../../documents/FamStatus_cert";

// -----------------------------------------------------
// 1. Utility: คำนวดอายุจาก Firebase Timestamp 
// -----------------------------------------------------
const calculateAge = (birthDateTimestamp) => {
    if (!birthDateTimestamp) return null;
    
    // ตรวจสอบและแปลงจาก Firebase Timestamp object หรือ Unix timestamp (milliseconds)
    let birthDate;
    if (typeof birthDateTimestamp.toDate === 'function') {
        birthDate = birthDateTimestamp.toDate();
    } else if (typeof birthDateTimestamp === 'number') {
        birthDate = new Date(birthDateTimestamp);
    } else if (birthDateTimestamp instanceof Date) {
        birthDate = birthDateTimestamp;
    } else {
        console.warn('Invalid birth date format:', birthDateTimestamp);
        return null; 
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    
    // ปรับอายุถ้าวันเกิดยังไม่ถึง
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

export { calculateAge }; 

// -----------------------------------------------------
// 2. Logic: สร้างรายการเอกสารสำหรับเทอม 2 และ 3
// -----------------------------------------------------
const generateTerm2And3Documents = (birthDateTimestamp) => {
    const documents = [];
    const age = calculateAge(birthDateTimestamp);
    
    console.log(`📋 Generating documents for Term 2/3. Calculated age: ${age} years`);
    
    // เอกสารบังคับ 3 รายการหลัก
    // 1. ใบเบิกเงินกู้ยืม
    documents.push({
        id: "disbursement_form",
        title: "ใบเบิกเงินกู้ยืม",
        description: "แบบฟอร์มเบิกเงินกู้ยืมที่กรอกและลงลายมือชื่อเรียบร้อย",
        required: true,
        type: "upload",
        needsAIValidation: false,
        canGenerate: false,
    });

    // 2. ใบภาระค่าใช้จ่ายทุน
    documents.push({
        id: "expense_burden_form",
        title: "ใบภาระค่าใช้จ่าย",
        description: "ใบภาระค่าใช้จ่ายในการเรียน/ทุนการศึกษา",
        required: true,
        type: "upload",
        needsAIValidation: false,
        canGenerate: false,
    });

    // 3. สำเนาบัตรประจำตัวประชาชนผู้กู้
    documents.push({
        id: "borrower_id_card",
        title: "สำเนาบัตรประจำตัวประชาชนผู้กู้",
        description: "สำเนาบัตรประชาชนของผู้กู้ที่ชัดเจนและรับรองสำเนาถูกต้อง",
        required: true,
        type: "upload",
        needsAIValidation: true,
        canGenerate: false,
    });

    // 4. เงื่อนไข: สำเนาบัตรประชาชนผู้ปกครอง (ถ้าผู้กู้อายุต่ำกว่า 20 ปี)
    if (age !== null && age < 20) {
        console.log(`👶 Student is under 20 years old (${age}), adding guardian ID card requirement`);
        documents.push({
            id: "guardian_id_card",
            title: "สำเนาบัตรประจำตัวประชาชนผู้ปกครอง",
            description: "สำเนาบัตรประชาชนของผู้ปกครอง (บิดา/มารดา หรือผู้ที่ดูแลตามกฎหมาย) พร้อมรับรองสำเนาถูกต้อง",
            required: true,
            type: "upload",
            needsAIValidation: true,
            canGenerate: false,
        });
    } else {
        console.log(`👨‍🎓 Student is 20 years or older (${age}), guardian ID not required`);
    }

    console.log(`📝 Generated ${documents.length} documents for Term 2/3`);
    return documents;
};

/**
 * Generate documents list based on survey data
 * @param {Object} data - Survey data from the user
 * @returns {Array} Array of document objects
 */
export const generateDocumentsList = ({ term, familyStatus, fatherIncome, motherIncome, guardianIncome, birth_date }) => {
    
    // ***** Logic ใหม่สำหรับ เทอม 2 และ 3 *****
    if (term === '2' || term === '3') {
        console.log(`🎓 Generating documents for Term ${term}`);
        return generateTerm2And3Documents(birth_date);
    }
    
    // ***** Logic เดิมสำหรับ เทอม 1 *****
    console.log(`🎓 Generating documents for Term 1`);
    const documents = [];

    // Base required documents for all users in Term 1
    documents.push(
        {
            id: "form_101",
            title: "แบบฟอร์ม กยศ.101",
            description: "กรอกข้อมูลตามจริงให้ครบถ้วน ก่อนอัพโหลดเอกสาร",
            required: true,
            canGenerate: true,
            needsAIValidation: true,
        },
        {
            id: "volunteer_doc",
            title: "เอกสารจิตอาสา",
            description: "กิจกรรมในปีการศึกษา 2567 อย่างน้อย 1 รายการ",
            required: true,
            canGenerate: false,
            needsAIValidation: false,
        },
        {
            id: "consent_student_form",
            title: "หนังสือยินยอมเปิดเผยข้อมูลของผู้กู้",
            description: "กรอกข้อมูลตามจริงให้ครบถ้วน ก่อนอัพโหลดเอกสาร",
            required: true,
            canGenerate: true,
            needsAIValidation: true,
        },
        {
            id: "id_copies_student",
            title: "สำเนาบัตรประชาชนพร้อมรับรองสำเนาถูกต้องของผู้กู้",
            description: "บัตรประชาชนต้องไม่หมดอายุ",
            required: true,
            canGenerate: false,
            needsAIValidation: true,
        }
    );

    // Documents based on family status (Term 1 logic)
    if (familyStatus === "ก") {
        // Both parents alive - add parent documents
        documents.push(
            {
                id: "consent_father_form",
                title: "หนังสือยินยอมเปิดเผยข้อมูลของบิดา",
                description: "กรอกข้อมูลตามจริงให้ครบถ้วน ก่อนอัพโหลดเอกสาร",
                required: true,
                canGenerate: true,
                needsAIValidation: true,
            },
            {
                id: "id_copies_father",
                title: "สำเนาบัตรประชาชนพร้อมรับรองสำเนาถูกต้องของบิดา",
                description: "บัตรประชาชนต้องไม่หมดอายุ",
                required: true,
                canGenerate: false,
                needsAIValidation: true,
            },
            {
                id: "consent_mother_form",
                title: "หนังสือยินยอมเปิดเผยข้อมูลของมารดา",
                description: "กรอกข้อมูลตามจริงให้ครบถ้วน ก่อนอัพโหลดเอกสาร",
                required: true,
                canGenerate: true,
                needsAIValidation: true,
            },
            {
                id: "id_copies_mother",
                title: "สำเนาบัตรประชาชนพร้อมรับรองสำเนาถูกต้องของมารดา",
                description: "บัตรประชาชนต้องไม่หมดอายุ",
                required: true,
                canGenerate: false,
                needsAIValidation: true,
            }
        );

        // Income documents for both parents
        if (fatherIncome !== "มีรายได้ประจำ" && motherIncome !== "มีรายได้ประจำ") {
            documents.push(
                {
                    id: "famo_income_cert",
                    title: "หนังสือรับรองรายได้ กยศ. 102 ของบิดา มารดา",
                    description: "กรอกข้อมูลตามจริงให้ครบถ้วน ก่อนอัพโหลดเอกสาร",
                    required: true,
                    canGenerate: true,
                },
                {
                    id: "famo_id_copies_gov",
                    title: "สำเนาบัตรข้าราชการผู้รับรอง",
                    description: "สำหรับรับรองรายได้ เอกสารจัดทำในปี พ.ศ. 2568 เท่านั้น",
                    required: true,
                    canGenerate: false,
                }
            );
        } else {
            // Individual income documents
            if (fatherIncome === "มีรายได้ประจำ") {
                documents.push({
                    id: "father_income",
                    title: "หนังสือรับรองเงินเดือน หรือ สลิปเงินเดือน ของบิดา",
                    description: "เอกสารอายุไม่เกิน 3 เดือน",
                    required: true,
                    canGenerate: false,
                });
            } else {
                documents.push(
                    {
                        id: "father_income_cert",
                        title: "หนังสือรับรองรายได้ กยศ. 102 ของบิดา",
                        description: "กรอกข้อมูลตามจริงให้ครบถ้วน ก่อนอัพโหลดเอกสาร",
                        required: true,
                        canGenerate: true,
                    },
                    {
                        id: "fa_id_copies_gov",
                        title: "สำเนาบัตรข้าราชการผู้รับรอง",
                        description: "สำหรับรับรองรายได้ เอกสารจัดทำในปี พ.ศ. 2568 เท่านั้น",
                        required: true,
                        canGenerate: false,
                    }
                );
            }

            if (motherIncome === "มีรายได้ประจำ") {
                documents.push({
                    id: "mother_income",
                    title: "หนังสือรับรองเงินเดือน หรือ สลิปเงินเดือน ของมารดา",
                    description: "เอกสารอายุไม่เกิน 3 เดือน",
                    required: true,
                    canGenerate: false,
                });
            } else {
                documents.push(
                    {
                        id: "mother_income_cert",
                        title: "หนังสือรับรองรายได้ กยศ. 102 ของมารดา",
                        description: "กรอกข้อมูลตามจริงให้ครบถ้วน ก่อนอัพโหลดเอกสาร",
                        required: true,
                        canGenerate: true,
                    },
                    {
                        id: "ma_id_copies_gov",
                        title: "สำเนาบัตรข้าราชการผู้รับรอง",
                        description: "สำหรับรับรองรายได้ เอกสารจัดทำในปี พ.ศ. 2568 เท่านั้น",
                        required: true,
                        canGenerate: false,
                    }
                );
            }
        }
    } else if (familyStatus === "ข") {
        // Single parent logic (existing code)
        let parent = familyStatus.livingWith === "บิดา" ? "บิดา" : "มารดา";
        let consentFormId = familyStatus.livingWith === "บิดา" ? "consent_father_form" : "consent_mother_form";

        documents.push(
            {
                id: consentFormId,
                title: `หนังสือยินยอมเปิดเผยข้อมูลของ ${parent}`,
                description: "กรอกข้อมูลตามจริงให้ครบถ้วน ก่อนอัพโหลดเอกสาร",
                required: true,
                canGenerate: true,
            },
            {
                id: `id_copies_${consentFormId}`,
                title: `สำเนาบัตรประชาชนพร้อมรับรองสำเนาถูกต้องของ ${parent}`,
                description: "บัตรประชาชนต้องไม่หมดอายุ",
                required: true,
                canGenerate: false,
            }
        );

        // Additional documents for single parent (existing logic continues...)
        // ... (rest of single parent logic)
    } else if (familyStatus === "ค") {
        // Guardian logic (existing code)
        // ... (rest of guardian logic)
    }

    return documents;
};

/**
 * Handle document download based on document type
 * @param {string} docId - Document ID
 * @param {string} downloadUrl - Optional download URL for external documents
 */
export const handleDownloadDocument = (docId, downloadUrl = null) => {
    if (docId === "form_101") {
        InsertForm101();
    } else if (docId === "consent_student_form") {
        ConsentFrom_student();
    } else if (docId === "consent_father_form") {
        ConsentFrom_father();
    } else if (docId === "consent_mother_form") {
        ConsentFrom_mother();
    } else if ([
        "guardian_income_cert",
        "father_income_cert", 
        "mother_income_cert",
        "single_parent_income_cert",
        "famo_income_cert"
    ].includes(docId)) {
        Income102();
    } else if (docId === "family_status_cert") {
        FamStatus_cert();
    } else if (downloadUrl) {
        Linking.openURL(downloadUrl).catch(() =>
            Alert.alert("ไม่สามารถดาวน์โหลดไฟล์ได้")
        );
    } else {
        // สำหรับเอกสารเทอม 2/3 ที่ไม่มี template
        Alert.alert("ไม่พบไฟล์", "เอกสารนี้ไม่มีแบบฟอร์มให้ดาวน์โหลด กรุณาดาวน์โหลดจากแหล่งอื่นหรือสร้างขึ้นเอง");
    }
};

/**
 * Get list of document IDs that can generate forms
 * @returns {Array} Array of document IDs that have downloadable forms
 */
export const getGeneratableDocuments = () => {
    return [
        // เทอม 1 documents ที่มี template
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
};

/**
 * Check if a document can be generated/downloaded  
 * @param {string} docId - Document ID to check
 * @returns {boolean} True if document can be generated
 */
export const canGenerateDocument = (docId) => {
    return getGeneratableDocuments().includes(docId);
};

/**
 * Get documents that need AI validation
 * @returns {Array} Array of document IDs that need AI validation
 */
export const getAIValidationDocuments = () => {
    return [
        // เทอม 1
        "form_101",
        "consent_student_form",
        "consent_father_form",
        "consent_mother_form",
        "id_copies_student",
        "id_copies_father", 
        "id_copies_mother",
        
        // เทอม 2/3
        "borrower_id_card",
        "guardian_id_card"
    ];
};

/**
 * Check if document needs AI validation
 * @param {string} docId - Document ID to check
 * @returns {boolean} True if document needs AI validation
 */
export const needsAIValidation = (docId) => {
    return getAIValidationDocuments().includes(docId);
};
