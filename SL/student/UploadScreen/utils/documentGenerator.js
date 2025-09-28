// documentGenerator.js - Document list generator and handler (Updated for Term 2 & 3 support, and AI validation)
import { Alert, Linking } from "react-native";
import { InsertForm101 } from "../../documents/InsertForm101";
import { ConsentFrom_student } from "../../documents/ConsentFrom_student";
import { ConsentFrom_father } from "../../documents/ConsentFrom_father";
import { ConsentFrom_mother } from "../../documents/ConsentFrom_mother";
import { Income102 } from "../../documents/income102";
import { FamStatus_cert } from "../../documents/FamStatus_cert";

// -----------------------------------------------------
// 1. Utility: คำนวณอายุจาก Firebase Timestamp
// -----------------------------------------------------
/**
 * คำนวณอายุจาก Firebase Timestamp object หรือ Unix timestamp
 * @param {import('@firebase/firestore').Timestamp | number | Date | null} birthDateTimestamp - วันเกิดในรูปแบบ Firebase Timestamp, Unix timestamp (ms) หรือ Date object
 * @returns {number | null} อายุเป็นปี หรือ null ถ้าข้อมูลไม่ถูกต้อง
 */
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
/**
 * สร้างรายการเอกสารสำหรับเทอม 2 และ 3
 * @param {import('@firebase/firestore').Timestamp | number | Date | null} birthDateTimestamp - วันเกิดในรูปแบบ Timestamp
 * @returns {Array} Array of document objects
 */
const generateTerm2And3Documents = (birthDateTimestamp) => {
    const documents = [];
    const age = calculateAge(birthDateTimestamp);

    console.log(`📋 Generating documents for Term 2/3. Calculated age: ${age} years`);

    // เอกสารบังคับ 3 รายการหลัก
    // 1. ใบเบิกเงินกู้ยืม (Disbursement Form)
    documents.push({
        id: "disbursement_form",
        title: "แบบยืนยันการเบิกเงินกู้ยืม",
        description: "แบบฟอร์มเบิกเงินกู้ยืมที่กรอกและลงลายมือชื่อเรียบร้อย",
        required: true,
        type: "upload",
        needsAIValidation: false,
        canGenerate: false,
    });

    // 2. ใบภาระค่าใช้จ่ายทุน (Expense Burden Form)
    documents.push({
        id: "expense_burden_form",
        title: "ใบภาระค่าใช้จ่ายทุน",
        description: "ใบภาระค่าใช้จ่ายในการเรียน/ทุนการศึกษา",
        required: true,
        type: "upload",
        needsAIValidation: false,
        canGenerate: false,
    });

    // 3. สำเนาบัตรประจำตัวประชาชนผู้กู้ (Borrower ID Card)
    documents.push({
        id: "id_copies_student",
        title: "สำเนาบัตรประชาชนพร้อมรับรองสำเนาถูกต้องของผู้กู้",
        description: "บัตรประชาชนต้องไม่หมดอายุ",
        required: true,
        type: "upload",
        needsAIValidation: true,
        canGenerate: false,
    });

    // 4. เงื่อนไข: สำเนาบัตรประชาชนผู้ปกครอง (ถ้าผู้กู้อายุต่ำกว่า 20 ปี)
    if (age !== null && age < 20) {
        console.log(`👶 Student is under 20 years old (${age}), adding guardian ID card requirement`);
        documents.push({
            id: "guardian_id_copies",
            title: "สำเนาบัตรประชาชนพร้อมรับรองสำเนาถูกต้อง ของผู้ปกครอง",
            description: "บัตรประชาชนต้องไม่หมดอายุ",
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

// -----------------------------------------------------
// 3. Logic: สร้างรายการเอกสารสำหรับเทอม 1 (ปรับปรุงจากโค้ดเก่า)
// -----------------------------------------------------
/**
 * สร้างรายการเอกสารสำหรับเทอม 1
 * @param {Object} data - Survey data from the user
 * @param {string} data.familyStatus - สถานภาพครอบครัว ("ก", "ข", "ค")
 * @param {string} data.fatherIncome - รายได้บิดา
 * @param {string} data.motherIncome - รายได้มารดา
 * @param {string} data.guardianIncome - รายได้ผู้ปกครอง
 * @param {string} data.livingWith - อยู่กับใคร (สำหรับ "ข")
 * @param {string} data.legalStatus - สถานะทางกฎหมาย (มี/ไม่มีเอกสาร)
 * @returns {Array} Array of document objects
 */
const generateTerm1Documents = ({ familyStatus, fatherIncome, motherIncome, guardianIncome, livingWith, legalStatus }) => {
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
        // Both parents alive
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
                    needsAIValidation: false,
                },
                {
                    id: "famo_id_copies_gov",
                    title: "สำเนาบัตรข้าราชการผู้รับรอง",
                    description: "สำหรับรับรองรายได้ เอกสารจัดทำในปี พ.ศ. 2568 เท่านั้น",
                    required: true,
                    canGenerate: false,
                    needsAIValidation: false,
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
                    needsAIValidation: false,
                });
            } else {
                documents.push(
                    {
                        id: "father_income_cert",
                        title: "หนังสือรับรองรายได้ กยศ. 102 ของบิดา",
                        description: "กรอกข้อมูลตามจริงให้ครบถ้วน ก่อนอัพโหลดเอกสาร",
                        required: true,
                        canGenerate: true,
                        needsAIValidation: false,
                    },
                    {
                        id: "fa_id_copies_gov",
                        title: "สำเนาบัตรข้าราชการผู้รับรอง",
                        description: "สำหรับรับรองรายได้ เอกสารจัดทำในปี พ.ศ. 2568 เท่านั้น",
                        required: true,
                        canGenerate: false,
                        needsAIValidation: false,
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
                    needsAIValidation: false,
                });
            } else {
                documents.push(
                    {
                        id: "mother_income_cert",
                        title: "หนังสือรับรองรายได้ กยศ. 102 ของมารดา",
                        description: "กรอกข้อมูลตามจริงให้ครบถ้วน ก่อนอัพโหลดเอกสาร",
                        required: true,
                        canGenerate: true,
                        needsAIValidation: false,
                    },
                    {
                        id: "ma_id_copies_gov",
                        title: "สำเนาบัตรข้าราชการผู้รับรอง",
                        description: "สำหรับรับรองรายได้ เอกสารจัดทำในปี พ.ศ. 2568 เท่านั้น",
                        required: true,
                        canGenerate: false,
                        needsAIValidation: false,
                    }
                );
            }
        }
    } else if (familyStatus === "ข") {
        // Single parent
        const parent = livingWith === "บิดา" ? "บิดา" : "มารดา";
        const consentFormId = livingWith === "บิดา" ? "consent_father_form" : "consent_mother_form";
        const idCopiesId = livingWith === "บิดา" ? "id_copies_father" : "id_copies_mother";

        documents.push(
            {
                id: consentFormId,
                title: `หนังสือยินยอมเปิดเผยข้อมูลของ ${parent}`,
                description: "กรอกข้อมูลตามจริงให้ครบถ้วน ก่อนอัพโหลดเอกสาร",
                required: true,
                canGenerate: true,
                needsAIValidation: true, // Assuming this parent consent needs validation
            },
            {
                id: idCopiesId,
                title: `สำเนาบัตรประชาชนพร้อมรับรองสำเนาถูกต้องของ ${parent}`,
                description: "บัตรประชาชนต้องไม่หมดอายุ",
                required: true,
                canGenerate: false,
                needsAIValidation: true, // Assuming this parent ID needs validation
            }
        );

        // Legal status documents
        if (legalStatus === "มีเอกสาร") {
            documents.push({
                id: "legal_status",
                title: "สำเนาใบหย่า (กรณีหย่าร้าง) หรือ สำเนาใบมรณบัตร (กรณีเสียชีวิต)",
                required: true,
                canGenerate: false,
                needsAIValidation: false,
            });
        } else {
            documents.push(
                {
                    id: "family_status_cert",
                    title: "หนังสือรับรองสถานภาพครอบครัว",
                    description: "กรอกข้อมูลตามจริงให้ครบถ้วน ก่อนอัพโหลดเอกสาร",
                    required: true,
                    canGenerate: true,
                    needsAIValidation: false,
                },
                {
                    id: "fam_id_copies_gov",
                    title: "สำเนาบัตรข้าราชการผู้รับรอง",
                    description: "สำหรับรับรองสถานภาพครอบครัว เอกสารจัดทำในปี พ.ศ. 2568 เท่านั้น",
                    required: true,
                    canGenerate: false,
                    needsAIValidation: false,
                }
            );
        }

        // Income documents for single parent
        const hasIncome =
            (livingWith === "บิดา" && fatherIncome === "มีรายได้ประจำ") ||
            (livingWith === "มารดา" && motherIncome === "มีรายได้ประจำ");
        const singleParentIncome = livingWith === "บิดา" ? fatherIncome : motherIncome;

        if (singleParentIncome === "มีรายได้ประจำ") {
            documents.push({
                id: "single_parent_income",
                title: `หนังสือรับรองเงินเดือน หรือ สลิปเงินเดือน ของ${parent}`,
                description: "เอกสารอายุไม่เกิน 3 เดือน",
                required: true,
                canGenerate: false,
                needsAIValidation: false,
            });
        } else {
            documents.push(
                {
                    id: "single_parent_income_cert",
                    title: `หนังสือรับรองรายได้ กยศ. 102 ของ${parent}`,
                    description: "กรอกข้อมูลตามจริงให้ครบถ้วน ก่อนอัพโหลดเอกสาร",
                    required: true,
                    canGenerate: true,
                    needsAIValidation: false,
                },
                {
                    id: "102_id_copies_gov",
                    title: "สำเนาบัตรข้าราชการผู้รับรอง",
                    description: `สำหรับรับรองรายได้ของ${parent} เอกสารจัดทำในปี พ.ศ. 2568 เท่านั้น`,
                    required: true,
                    canGenerate: false,
                    needsAIValidation: false,
                }
            );
        }
    } else if (familyStatus === "ค") {
        // Guardian
        documents.push(
            {
                id: "guardian_consent",
                title: "หนังสือยินยอมเปิดเผยข้อมูล ของผู้ปกครอง",
                description: "กรอกข้อมูลตามจริงให้ครบถ้วน ก่อนอัพโหลดเอกสาร",
                required: true,
                canGenerate: false, // Assuming no generate template for guardian consent
                needsAIValidation: false,
            },
            {
                id: "guardian_id_copies",
                title: "สำเนาบัตรประชาชนพร้อมรับรองสำเนาถูกต้อง ของผู้ปกครอง",
                description: "บัตรประชาชนต้องไม่หมดอายุ",
                required: true,
                canGenerate: false,
                needsAIValidation: true, // Assuming guardian ID needs validation
            }
        );

        if (guardianIncome === "มีรายได้ประจำ") {
            documents.push({
                id: "guardian_income",
                title: "หนังสือรับรองเงินเดือน หรือ สลิปเงินเดือน ของผู้ปกครอง",
                description: "เอกสารอายุไม่เกิน 3 เดือน",
                required: true,
                canGenerate: false,
                needsAIValidation: false,
            });
        } else {
            documents.push(
                {
                    id: "guardian_income_cert",
                    title: "หนังสือรับรองรายได้ กยศ. 102 ของผู้ปกครอง",
                    description: "กรอกข้อมูลตามจริงให้ครบถ้วน ก่อนอัพโหลดเอกสาร",
                    required: true,
                    canGenerate: true,
                    needsAIValidation: false,
                },
                {
                    id: "guar_id_copies_gov",
                    title: "สำเนาบัตรข้าราชการผู้รับรอง",
                    description: "สำหรับรับรองรายได้ เอกสารจัดทำในปี พ.ศ. 2568 เท่านั้น",
                    required: true,
                    canGenerate: false,
                    needsAIValidation: false,
                }
            );
        }

        if (legalStatus === "มีเอกสาร") {
            documents.push({
                id: "legal_status",
                title: "สำเนาใบหย่า (กรณีหย่าร้าง) หรือ สำเนาใบมรณบัตร (กรณีเสียชีวิต)",
                description: "",
                required: true,
                canGenerate: false,
                needsAIValidation: false,
            });
        }

        // ต้องมีหนังสือรับรองสถานภาพครอบครัวสำหรับผู้ปกครองเสมอ (ตามโค้ดเก่า)
        documents.push(
            {
                id: "family_status_cert",
                title: "หนังสือรับรองสถานภาพครอบครัว",
                description: "กรอกข้อมูลตามจริงให้ครบถ้วน ก่อนอัพโหลดเอกสาร",
                required: true,
                canGenerate: true,
                needsAIValidation: false,
            },
            {
                id: "fam_id_copies_gov",
                title: "สำเนาบัตรข้าราชการผู้รับรอง",
                description: "สำหรับรับรองสถานภาพครอบครัว เอกสารจัดทำในปี พ.ศ. 2568 เท่านั้น",
                required: true,
                canGenerate: false,
                needsAIValidation: false,
            }
        );
    }

    return documents;
};


// -----------------------------------------------------
// 4. Main Export: generateDocumentsList (รวม Logic เทอม 1, 2, 3)
// -----------------------------------------------------
/**
 * Generate documents list based on survey data
 * @param {Object} data - Survey data from the user
 * @param {string} data.term - เทอมการศึกษา ("1", "2", "3")
 * @param {string} data.familyStatus - สถานภาพครอบครัว ("ก", "ข", "ค")
 * @param {string} data.fatherIncome - รายได้บิดา
 * @param {string} data.motherIncome - รายได้มารดา
 * @param {string} data.guardianIncome - รายได้ผู้ปกครอง
 * @param {import('@firebase/firestore').Timestamp | number | Date} data.birth_date - วันเกิดของผู้กู้
 * @returns {Array} Array of document objects
 */
export const generateDocumentsList = (data) => {
    if (!data) return [];
    
    const { term, familyStatus, fatherIncome, motherIncome, guardianIncome, birth_date, livingWith, legalStatus } = data;

    // ***** Logic ใหม่สำหรับ เทอม 2 และ 3 *****
    if (term === '2' || term === '3') {
        return generateTerm2And3Documents(birth_date);
    }

    // ***** Logic เดิมสำหรับ เทอม 1 *****
    return generateTerm1Documents({ familyStatus, fatherIncome, motherIncome, guardianIncome, livingWith, legalStatus });
};


// -----------------------------------------------------
// 5. Document Download Handler
// -----------------------------------------------------
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
        // สำหรับเอกสารที่ไม่มี template และไม่มี downloadUrl (เช่น เอกสารเทอม 2/3 ส่วนใหญ่)
        Alert.alert("ไม่พบไฟล์", "เอกสารนี้ไม่มีแบบฟอร์มให้ดาวน์โหลด กรุณาดาวน์โหลดจากแหล่งอื่นหรือสร้างขึ้นเอง");
    }
};

// -----------------------------------------------------
// 6. Utility Functions (Generatable/AI Validation)
// -----------------------------------------------------
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
        "expense_burden_form",
        "guardian_id_copies"
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
