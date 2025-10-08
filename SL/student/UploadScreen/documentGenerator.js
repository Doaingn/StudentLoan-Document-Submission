// documentGenerator.js - Document list generator with Phase support
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
const calculateAge = (birthDateTimestamp) => {
    console.log(`🔍 calculateAge called with:`, birthDateTimestamp);
    console.log(`🔍 Type:`, typeof birthDateTimestamp);
    
    if (!birthDateTimestamp) {
        console.log(`❌ Birth date is null/undefined`);
        return null;
    }

    let birthDate;
    if (typeof birthDateTimestamp.toDate === 'function') {
        birthDate = birthDateTimestamp.toDate();
        console.log(`✅ Converted from Firestore Timestamp:`, birthDate);
    } else if (typeof birthDateTimestamp === 'number') {
        birthDate = new Date(birthDateTimestamp);
        console.log(`✅ Converted from Unix timestamp:`, birthDate);
    } else if (birthDateTimestamp instanceof Date) {
        birthDate = birthDateTimestamp;
        console.log(`✅ Already Date object:`, birthDate);
    } else {
        console.warn('❌ Invalid birth date format:', birthDateTimestamp);
        return null;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    console.log(`✅ Calculated age: ${age} years`);
    return age;
};

export { calculateAge };

// -----------------------------------------------------
// 2. สร้างเอกสารชุด Disbursement (เหมือนกันทุกเทอม)
// -----------------------------------------------------
const generateDisbursementDocuments = (birthDateTimestamp) => {
    const documents = [];
    const age = calculateAge(birthDateTimestamp);
    
    console.log(`💰 Generating Disbursement documents. Age: ${age}`);
    
    documents.push(
        {
            id: "disbursement_form",
            title: "แบบยืนยันการเบิกเงินกู้ยืม",
            description: "ฟอร์มเบิกเงินที่กรอกและลงลายมือชื่อเรียบร้อย",
            required: true,
            type: "upload",
            needsAIValidation: false,
            canGenerate: false,
        },
        {
            id: "expense_burden_form",
            title: "ใบภาระค่าใช้จ่ายทุน",
            description: "ใบภาระค่าใช้จ่ายในการเรียน/ทุนการศึกษา",
            required: true,
            type: "upload",
            needsAIValidation: false,
            canGenerate: false,
        },
        {
            id: "id_copies_student",
            title: "สำเนาบัตรประชาชนพร้อมรับรองสำเนาถูกต้องของผู้กู้",
            description: "บัตรประชาชนต้องไม่หมดอายุ",
            required: true,
            type: "upload",
            needsAIValidation: true,
            canGenerate: false,
        }
    );
    
    if (age !== null && age < 20) {
        console.log(`👶 Age < 20: Adding guardian ID requirement`);
        documents.push({
            id: "guardian_id_copies",
            title: "สำเนาบัตรประชาชนพร้อมรับรองสำเนาถูกต้องของผู้ปกครอง",
            description: "บัตรประชาชนต้องไม่หมดอายุ",
            required: true,
            type: "upload",
            needsAIValidation: true,
            canGenerate: false,
        });
    }
    
    console.log(`📦 Generated ${documents.length} Disbursement documents`);
    return documents;
};

// -----------------------------------------------------
// 3. สร้างเอกสารเทอม 1 - Initial Application
// -----------------------------------------------------
const generateTerm1Documents = ({ familyStatus, fatherIncome, motherIncome, guardianIncome, livingWith, legalStatus }) => {
    console.log(`🎓 Generating Term 1 Initial Application documents`);
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
                needsAIValidation: true,
            },
            {
                id: idCopiesId,
                title: `สำเนาบัตรประชาชนพร้อมรับรองสำเนาถูกต้องของ ${parent}`,
                description: "บัตรประชาชนต้องไม่หมดอายุ",
                required: true,
                canGenerate: false,
                needsAIValidation: true,
            }
        );

        // Legal status documents
        if (legalStatus === "มีเอกสาร") {
            documents.push({
                id: "legal_status",
                title: "สำเนาใบหย่า (กรณีหย่าร้าง) หรือ สำเนาใบมรณะบัตร (กรณีเสียชีวิต)",
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
                canGenerate: true,
                needsAIValidation: false,
            },
            {
                id: "guardian_id_copies",
                title: "สำเนาบัตรประชาชนพร้อมรับรองสำเนาถูกต้อง ของผู้ปกครอง",
                description: "บัตรประชาชนต้องไม่หมดอายุ",
                required: true,
                canGenerate: false,
                needsAIValidation: true,
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
                title: "สำเนาใบหย่า (กรณีหย่าร้าง) หรือ สำเนาใบมรณะบัตร (กรณีเสียชีวิต)",
                description: "",
                required: true,
                canGenerate: false,
                needsAIValidation: false,
            });
        }

        // ต้องมีหนังสือรับรองสถานภาพครอบครัวสำหรับผู้ปกครองเสมอ
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

    console.log(`📦 Generated ${documents.length} Term 1 documents`);
    return documents;
};

// -----------------------------------------------------
// 4. Main Export: generateDocumentsList
// -----------------------------------------------------
export const generateDocumentsList = (data) => {
  console.log(`📋 generateDocumentsList called with data:`, data);
  
  if (!data) {
    console.log(`❌ No data provided`);
    return [];
  }
  
  const { 
    term, 
    phase,  // ✅ ต้องมีค่านี้จาก useFirebaseData
    familyStatus, 
    fatherIncome, 
    motherIncome, 
    guardianIncome, 
    birth_date, 
    livingWith, 
    legalStatus
  } = data;
  
  console.log(`📊 Parameters:`, { term, phase });

  // ✅ ลำดับความสำคัญ 1: เช็ค phase ก่อนเสมอ
  if (phase === "disbursement") {
    console.log(`💰 Phase: Disbursement (from loanHistory)`);
    return generateDisbursementDocuments(birth_date);
  }
  
  // ✅ ลำดับความสำคัญ 2: เทอม 2/3
  if (term === "2" || term === "3") {
    console.log(`🎓 Term ${term}: Direct to Disbursement`);
    return generateDisbursementDocuments(birth_date);
  }
  
  // ✅ ลำดับความสำคัญ 3: เทอม 1 - Initial Application
  console.log(`🎓 Term 1: Initial Application Phase`);
  return generateTerm1Documents({ 
    familyStatus, 
    fatherIncome, 
    motherIncome, 
    guardianIncome, 
    livingWith, 
    legalStatus 
  });
};

// -----------------------------------------------------
// 5. Document Download Handler
// -----------------------------------------------------
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
        Alert.alert("ไม่พบไฟล์", "เอกสารนี้ไม่มีแบบฟอร์มให้ดาวน์โหลด กรุณาดาวน์โหลดจากแหล่งอื่นหรือสร้างขึ้นเอง");
    }
};

// -----------------------------------------------------
// 6. Utility Functions
// -----------------------------------------------------
export const getGeneratableDocuments = () => {
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
};

export const canGenerateDocument = (docId) => {
    return getGeneratableDocuments().includes(docId);
};

export const getAIValidationDocuments = () => {
    return [
        "form_101",
        "consent_student_form",
        "consent_father_form",
        "consent_mother_form",
        "id_copies_student",
        "id_copies_father",
        "id_copies_mother",
        "guardian_id_copies",
    ];
};

export const needsAIValidation = (docId) => {
    return getAIValidationDocuments().includes(docId);
};