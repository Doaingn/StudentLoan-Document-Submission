// ClientSideAI.js - Direct client-side AI implementation without backend
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from "expo-file-system/legacy";
import { Alert } from "react-native";

// Configuration - เปลี่ยนจากการใช้ backend มาเป็น client-side เท่านั้น
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

let genAI = null;
let model = null;

console.log("🔧 Client-Side AI Configuration:");
console.log("- API Key configured:", !!GEMINI_API_KEY);

// Initialize Gemini AI for client-side processing only
const initializeGemini = () => {
  if (!genAI && GEMINI_API_KEY) {
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      console.log("✅ Gemini AI initialized successfully");
      return true;
    } catch (error) {
      console.error("Failed to initialize Gemini AI:", error);
      return false;
    }
  }
  return !!genAI;
};

// Convert file to format suitable for Gemini
const prepareFileForGemini = async (fileUri, mimeType) => {
  try {
    console.log("📁 Preparing file for Gemini AI...");

    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    let actualMimeType = mimeType;
    if (!actualMimeType) {
      const fileExtension = fileUri.split(".").pop()?.toLowerCase();
      switch (fileExtension) {
        case "jpg":
        case "jpeg":
          actualMimeType = "image/jpeg";
          break;
        case "png":
          actualMimeType = "image/png";
          break;
        case "pdf":
          actualMimeType = "application/pdf";
          break;
        default:
          actualMimeType = "image/jpeg";
      }
    }

    console.log("✅ File prepared for Gemini");
    return {
      inlineData: {
        data: base64Data,
        mimeType: actualMimeType,
      },
    };
  } catch (error) {
    console.error("❌ Error preparing file for Gemini:", error);
    throw new Error(
      `ไม่สามารถเตรียมไฟล์สำหรับการวิเคราะห์ได้: ${error.message}`
    );
  }
};

// Validate Form 101 Document
export const validateForm101Document = async (fileUri, mimeType = null) => {
  try {
    console.log("🚀 Starting Form 101 validation...");

    if (!model) {
      const initialized = initializeGemini();
      if (!initialized) {
        throw new Error("ระบบ AI ไม่พร้อมใช้งาน - กรุณาตรวจสอบ API Key");
      }
    }

    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error("ไฟล์ไม่พบ - กรุณาเลือกไฟล์ใหม่");
    }

    const filePart = await prepareFileForGemini(fileUri, mimeType);

    const prompt = `
ตรวจสอบเอกสารนี้ว่าเป็นแบบฟอร์ม 101 (แบบคำขอรับทุนการศึกษา) หรือไม่

กรุณาตรวจสอบและตอบในรูปแบบ JSON ดังนี้:
{
  "isForm101": true/false,
  "confidence": 0-100,
  "foundElements": ["รายการที่พบในเอกสาร"],
  "missingElements": ["รายการที่ขาดหายไป"],
  "hasSignature": true/false,
  "signatureQuality": "genuine/suspicious/unclear/none",
  "extractedData": {
    "studentName": "ชื่อนักเรียน",
    "studentId": "รหัสนักเรียน",
    "idCard": "เลขบัตรประชาชน",
    "address": "ที่อยู่",
    "phone": "เบอร์โทรศัพท์",
    "email": "อีเมล"
  },
  "recommendations": ["คำแนะนำสำหรับการแก้ไข"],
  "overall_status": "valid/invalid/needs_review"
}

ให้ความสำคัญกับ:
1. การมีอยู่ของหัวเอกสาร "แบบฟอร์ม 101" หรือ "แบบคำขอรับทุนการศึกษา"
2. ช่องกรอกข้อมูลส่วนตัวของนักเรียน
3. ลายเซ็นหรือการลงชื่อ
4. ความชัดเจนและความสมบูรณ์ของข้อมูล
`;

    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();

    // Try to parse JSON response
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log("✅ Form101 validation completed");
        return parsed;
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.warn(
        "⚠️ Failed to parse AI response as JSON, using text analysis"
      );
      return analyzeForm101TextResponse(responseText);
    }
  } catch (error) {
    console.error("❌ Form 101 validation error:", error);
    throw new Error(`การตรวจสอบแบบฟอร์ม 101 ล้มเหลว: ${error.message}`);
  }
};

// Validate ID Card
export const validateIDCard = async (
  fileUri,
  idType = "student",
  mimeType = null
) => {
  try {
    console.log(`🚀 Starting ${idType} ID card validation...`);

    if (!model) {
      const initialized = initializeGemini();
      if (!initialized) {
        throw new Error("ระบบ AI ไม่พร้อมใช้งาน - กรุณาตรวจสอบ API Key");
      }
    }

    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error("ไฟล์ไม่พบ - กรุณาเลือกไฟล์ใหม่");
    }

    const filePart = await prepareFileForGemini(fileUri, mimeType);

    const idTypeText = {
      student: "นักเรียน/นักศึกษา",
      father: "บิดา",
      mother: "มารดา",
      guardian: "ผู้ปกครong",
    };

    const prompt = `
ตรวจสอบเอกสารนี้ว่าเป็นสำเนาบัตรประชาชนของ${
      idTypeText[idType] || "บุคคล"
    } หรือไม่

กรุณาตรวจสอบและตอบในรูปแบบ JSON ดังนี้:
{
  "isIDCard": true/false,
  "idType": "${idType}",
  "confidence": 0-100,
  "cardType": "บัตรประชาชน/บัตรข้าราชการ/พาสปอร์ต/อื่นๆ",
  "isValidIDNumber": true/false,
  "isExpired": true/false/null,
  "imageQuality": "clear/blurry/poor/excellent",
  "extractedData": {
    "idNumber": "เลขบัตรประชาชน",
    "name": "ชื่อ-นามสกุล",
    "nameEn": "ชื่อ-นามสกุลภาษาอังกฤษ",
    "dateOfBirth": "วันเกิด",
    "issueDate": "วันที่ออกบัตร",
    "expiryDate": "วันหมดอายุ",
    "address": "ที่อยู่",
    "religion": "ศาสนา"
  },
  "securityFeatures": {
    "hasWatermark": true/false,
    "hasHologram": true/false,
    "hasMRZCode": true/false
  },
  "qualityIssues": ["ปัญหาที่พบ"],
  "recommendations": ["คำแนะนำ"],
  "overall_status": "valid/invalid/needs_review"
}

ให้ความสำคัญกับ:
1. การตรวจสอบว่าเป็นบัตรประชาชนไทยจริง
2. เลขประจำตัวประชาชน 13 หลัก
3. ความชัดเจนของข้อมูลและรูปภาพ
4. วันหมดอายุของบัตร
5. ลักษณะการรักษาความปลอดภัยของบัตร (watermark, hologram)
6. ความสมบูรณ์ของข้อมูลที่จำเป็น
`;

    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log("✅ IDCard validation completed");
        return parsed;
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.warn(
        "⚠️ Failed to parse IDCard AI response as JSON, using text analysis"
      );
      return analyzeIDCardTextResponse(responseText, idType);
    }
  } catch (error) {
    console.error("❌ IDCard validation error:", error);
    throw new Error(`การตรวจสอบบัตรประชาชน ล้มเหลว: ${error.message}`);
  }
};

// Validate Consent Form
export const validateConsentForm = async (
  fileUri,
  formType = "student",
  mimeType = null
) => {
  try {
    console.log(`🚀 Starting ${formType} consent form validation...`);

    if (!model) {
      const initialized = initializeGemini();
      if (!initialized) {
        throw new Error("ระบบ AI ไม่พร้อมใช้งาน - กรุณาตรวจสอบ API Key");
      }
    }

    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error("ไฟล์ไม่พบ - กรุณาเลือกไฟล์ใหม่");
    }

    const filePart = await prepareFileForGemini(fileUri, mimeType);

    const formTypeText = {
      student: "นักเรียน",
      father: "บิดา",
      mother: "มารดา",
      guardian: "ผู้ปกครอง",
    };

    const prompt = `
ตรวจสอบเอกสารนี้ว่าเป็นหนังสือให้ความยินยอมในการเปิดเผยข้อมูลของ${
      formTypeText[formType] || "นักเรียน"
    } หรือไม่

กรุณาตรวจสอบและตอบในรูปแบบ JSON ดังนี้:
{
  "isConsentForm": true/false,
  "formType": "${formType}",
  "confidence": 0-100,
  "hasConsent": true/false,
  "consentType": "เปิดเผยข้อมูล/อื่นๆ",
  "hasSignature": true/false,
  "signatureQuality": "genuine/suspicious/unclear/none",
  "extractedData": {
    "name": "ชื่อ-นามสกุล",
    "idCard": "เลขบัตรประชาชน",
    "address": "ที่อยู่",
    "phone": "เบอร์โทรศัพท์",
    "email": "อีเมล",
    "relationship": "ความสัมพันธ์กับนักเรียน"
  },
  "consentDetails": ["รายละเอียดความยินยอม"],
  "recommendations": ["คำแนะนำ"],
  "overall_status": "valid/invalid/needs_review"
}

ให้ความสำคัญกับ:
1. การระบุว่าเป็นหนังสือให้ความยินยอม
2. การระบุประเภทของความยินยอม (เปิดเผยข้อมูล)
3. ข้อมูลส่วนตัวที่สมบูรณ์
4. ลายเซ็นหรือการลงชื่อที่ชัดเจน
5. วันที่ในเอกสาร
`;

    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log("✅ ConsentForm validation completed");
        return parsed;
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.warn(
        "⚠️ Failed to parse ConsentForm AI response as JSON, using text analysis"
      );
      return analyzeConsentTextResponse(responseText, formType);
    }
  } catch (error) {
    console.error("❌ ConsentForm validation error:", error);
    throw new Error(`การตรวจสอบหนังสือยินยอม ล้มเหลว: ${error.message}`);
  }
};

// Validate Volunteer Document
export const validateVolunteerDocument = async (
  fileUri,
  docType = "form",
  mimeType = null
) => {
  try {
    console.log(`🚀 Starting ${docType} volunteer document validation...`);

    if (!model) {
      const initialized = initializeGemini();
      if (!initialized) {
        throw new Error("ระบบ AI ไม่พร้อมใช้งาน - กรุณาตรวจสอบ API Key");
      }
    }

    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error("ไฟล์ไม่พบ - กรุณาเลือกไฟล์ใหม่");
    }

    const filePart = await prepareFileForGemini(fileUri, mimeType);

    const docTypeText = {
      form: "แบบฟอร์มบันทึกชั่วโมง",
      certificate: "เกียรติบัตร",
      summary: "สรุปชั่วโมง",
      participation: "หนังสือรับรอง",
    };

    let prompt;
    if (docType === "certificate") {
      prompt = `
ตรวจสอบเอกสารนี้ว่าเป็นเกียรติบัตรกิจอาสาหรือไม่ และดึงข้อมูลชั่วโมงจากเกียรติบัตร

กรุณาตรวจสอบและตอบในรูปแบบ JSON ดังนี้:
{
  "isVolunteerCertificate": true/false,
  "documentType": "certificate",
  "confidence": 0-100,
  "hasHours": true/false,
  "hours": จำนวนชั่วโมง,
  "hasQRCode": true/false,
  "qrCodeData": "ข้อมูลใน QR Code ถ้ามี",
  "extractedData": {
    "activityName": "ชื่อกิจกรรม",
    "organizationName": "หน่วยงานที่จัด",
    "participantName": "ชื่อผู้เข้าร่วม",
    "date": "วันที่",
    "location": "สถานที่",
    "hours": จำนวนชั่วโมง,
    "certificateNumber": "เลขที่เกียรติบัตร"
  },
  "validation": {
    "isValid": true/false,
    "issues": ["ปัญหาที่พบ"],
    "recommendations": ["คำแนะนำ"]
  },
  "overall_status": "valid/invalid/needs_review"
}

ให้ความสำคัญกับ:
1. การระบุว่าเป็นเกียรติบัตรจริง
2. การดึงชั่วโมงที่ชัดเจน
3. การตรวจจับ QR Code และอ่านข้อมูล
4. ข้อมูลผู้เข้าร่วม องค์กร และกิจกรรม
5. วันที่และสถานที่จัดกิจกรรม
6. เลขที่เกียรติบัตรหรือรหัสอ้างอิง
`;
    } else {
      prompt = `
ตรวจสอบเอกสารนี้ว่าเป็นแบบฟอร์มบันทึกชั่วโมงกิจอาสาหรือไม่ และคำนวดชั่วโมงรวม

กรุณาตรวจสอบและตอบในรูปแบบ JSON ดังนี้:
{
  "isVolunteerForm": true/false,
  "documentType": "form",
  "confidence": 0-100,
  "hasHourRecords": true/false,
  "totalHours": ชั่วโมงรวมทั้งหมด,
  "extractedData": {
    "studentName": "ชื่อนักเรียน",
    "studentId": "รหัสนักเรียน",
    "academicYear": "ปีการศึกษา",
    "term": "เทอม"
  },
  "hourRecords": [
    {
      "date": "วันที่",
      "activity": "กิจกรรม",
      "hours": ชั่วโมง,
      "location": "สถานที่",
      "supervisor": "ผู้ดูแล"
    }
  ],
  "validation": {
    "isValid": true/false,
    "calculationCorrect": true/false,
    "issues": ["ปัญหาที่พบ"],
    "recommendations": ["คำแนะนำ"]
  },
  "overall_status": "valid/invalid/needs_review"
}

ให้ความสำคัญกับ:
1. การระบุประเภทเอกสาร
2. การนับและคำนวดชั่วโมงรวมให้ถูกต้อง
3. รายละเอียดกิจกรรมแต่ละรายการ
4. ข้อมูลนักเรียนและช่วงเวลา
5. การตรวจสอบความถูกต้องของการคำนวด
`;
    }

    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log("✅ VolunteerDocument validation completed");
        return parsed;
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.warn(
        "⚠️ Failed to parse VolunteerDocument AI response as JSON, using text analysis"
      );
      return analyzeVolunteerTextResponse(responseText, docType);
    }
  } catch (error) {
    console.error("❌ VolunteerDocument validation error:", error);
    throw new Error(`การตรวจสอบเอกสารกิจอาสา ล้มเหลว: ${error.message}`);
  }
};

// Universal document validation function
export const validateDocument = async (
  fileUri,
  documentType,
  formType = null,
  mimeType = null
) => {
  try {
    console.log(`🚀 Starting document validation for type: ${documentType}`);

    switch (documentType) {
      case "form_101":
        return await validateForm101Document(fileUri, mimeType);

      case "volunteer_doc":
      case "volunteer_form":
      case "volunteer_certificate":
        const volunteerType = formType || "form";
        return await validateVolunteerDocument(
          fileUri,
          volunteerType,
          mimeType
        );

      case "id_copies_student":
        return await validateIDCard(fileUri, "student", mimeType);

      case "id_copies_father":
        return await validateIDCard(fileUri, "father", mimeType);

      case "id_copies_mother":
        return await validateIDCard(fileUri, "mother", mimeType);

      case "guardian_id_copies":
        return await validateIDCard(fileUri, "guardian", mimeType);

      case "consent_student_form":
        return await validateConsentForm(fileUri, "student", mimeType);

      case "consent_father_form":
        return await validateConsentForm(fileUri, "father", mimeType);

      case "consent_mother_form":
        return await validateConsentForm(fileUri, "mother", mimeType);

      case "guardian_consent":
        return await validateConsentForm(fileUri, "guardian", mimeType);

      case "consent_form":
        const consentType = formType || "student";
        return await validateConsentForm(fileUri, consentType, mimeType);

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

// Helper functions for text analysis fallback
const analyzeForm101TextResponse = (text) => {
  const lowerText = text.toLowerCase();
  const isForm101 =
    lowerText.includes("แบบฟอร์ม 101") ||
    lowerText.includes("แบบคำขอ") ||
    lowerText.includes("ทุนการศึกษา");

  const hasSignature =
    lowerText.includes("ลายเซ็น") ||
    lowerText.includes("ลงชื่อ") ||
    lowerText.includes("signature");

  return {
    isForm101,
    confidence: isForm101 ? 75 : 25,
    foundElements: isForm101 ? ["แบบฟอร์มทุนการศึกษา"] : [],
    missingElements: !isForm101 ? ["แบบฟอร์ม 101"] : [],
    hasSignature,
    signatureQuality: hasSignature ? "unclear" : "none",
    extractedData: {},
    recommendations: !isForm101 ? ["กรุณาตรวจสอบว่าเป็นแบบฟอร์ม 101"] : [],
    overall_status: isForm101 && hasSignature ? "valid" : "needs_review",
    rawResponse: text,
  };
};

const analyzeIDCardTextResponse = (text, idType) => {
  const lowerText = text.toLowerCase();
  const isIDCard =
    lowerText.includes("บัตรประชาชน") ||
    lowerText.includes("บัตรประจำตัว") ||
    lowerText.includes("id card");

  const hasValidID =
    lowerText.includes("เลขประจำตัว") ||
    lowerText.includes("หมายเลข") ||
    lowerText.includes("13 หลัก");

  return {
    isIDCard,
    idType,
    confidence: isIDCard ? 75 : 25,
    cardType: isIDCard ? "บัตรประชาชน" : "ไม่ทราบ",
    isValidIDNumber: hasValidID,
    isExpired: null,
    imageQuality: "unclear",
    extractedData: {},
    securityFeatures: {},
    qualityIssues: !isIDCard ? ["ไม่พบบัตรประชาชน"] : [],
    recommendations: !isIDCard ? ["กรุณาอัปโหลดสำเนาบัตรประชาชน"] : [],
    overall_status: isIDCard && hasValidID ? "valid" : "needs_review",
    rawResponse: text,
  };
};

const analyzeConsentTextResponse = (text, formType) => {
  const lowerText = text.toLowerCase();
  const isConsentForm =
    lowerText.includes("ความยินยอม") ||
    lowerText.includes("เปิดเผยข้อมูล") ||
    lowerText.includes("consent");

  const hasSignature =
    lowerText.includes("ลายเซ็น") ||
    lowerText.includes("ลงชื่อ") ||
    lowerText.includes("signature");

  return {
    isConsentForm,
    formType,
    confidence: isConsentForm ? 75 : 25,
    hasConsent: isConsentForm,
    consentType: isConsentForm ? "เปิดเผยข้อมูล" : "",
    hasSignature,
    signatureQuality: hasSignature ? "unclear" : "none",
    extractedData: {},
    consentDetails: isConsentForm ? ["ความยินยอมในการเปิดเผยข้อมูล"] : [],
    recommendations: !isConsentForm ? ["กรุณาตรวจสอบว่าเป็นหนังสือยินยอม"] : [],
    overall_status: isConsentForm && hasSignature ? "valid" : "needs_review",
    rawResponse: text,
  };
};

const analyzeVolunteerTextResponse = (text, docType) => {
  const lowerText = text.toLowerCase();
  const isVolunteerDoc =
    lowerText.includes("กิจอาสา") ||
    lowerText.includes("volunteer") ||
    lowerText.includes("ชั่วโมง") ||
    lowerText.includes("เกียรติบัตร");

  const hasHours =
    lowerText.includes("ชั่วโมง") ||
    lowerText.includes("hour") ||
    /\d+\s*(ชั่วโมง|hour)/i.test(text);

  // Extract hours from text
  const hourMatches = text.match(/(\d+(?:\.\d+)?)\s*(?:ชั่วโมง|hour)/gi);
  let totalHours = 0;
  if (hourMatches) {
    totalHours = hourMatches.reduce((sum, match) => {
      const number = parseFloat(match.match(/\d+(?:\.\d+)?/)[0]);
      return sum + number;
    }, 0);
  }

  const baseResult = {
    confidence: isVolunteerDoc ? 75 : 25,
    hasHours,
    totalHours,
    extractedData: {},
    validation: {
      isValid: isVolunteerDoc,
      issues: !isVolunteerDoc ? ["ไม่สามารถระบุประเภทเอกสารได้"] : [],
      recommendations: !isVolunteerDoc
        ? ["กรุณาตรวจสอบว่าเป็นเอกสารกิจอาสา"]
        : [],
    },
    overall_status: isVolunteerDoc && hasHours ? "valid" : "needs_review",
    rawResponse: text,
  };

  if (docType === "certificate") {
    return {
      ...baseResult,
      isVolunteerCertificate: isVolunteerDoc,
      documentType: "certificate",
      hasQRCode: lowerText.includes("qr") || lowerText.includes("คิวอาร์"),
      hours: totalHours,
    };
  } else {
    return {
      ...baseResult,
      isVolunteerForm: isVolunteerDoc,
      documentType: "form",
      hasHourRecords: hasHours,
      hourRecords: [],
      hoursSummary: {
        totalRecords: 0,
        totalHours,
        averageHours: 0,
        dateRange: { start: null, end: null },
      },
    };
  }
};

// Check AI status
export const checkAIStatus = async () => {
  try {
    console.log("🤖 Checking AI status...");

    if (
      !GEMINI_API_KEY ||
      GEMINI_API_KEY === "AIzaSyCB5CXsuKesDyB4564AHcv1z8RogeyDUOY"
    ) {
      console.error("❌ Gemini API key not configured");
      return false;
    }

    const initialized = initializeGemini();
    if (!initialized) {
      console.error("❌ Failed to initialize Gemini AI");
      return false;
    }

    // Test with a simple request
    try {
      console.log("🔬 Testing AI connection...");
      const testResult = await model.generateContent(
        "Test connection - respond with OK"
      );
      const testResponse = await testResult.response;
      const text = testResponse.text();

      console.log("✅ AI is available and working");
      return true;
    } catch (testError) {
      console.error("❌ AI test failed:", testError.message);
      return false;
    }
  } catch (error) {
    console.error("❌ AI status check failed:", error);
    return false;
  }
};

// Show validation alerts
export const showValidationAlert = (
  result,
  documentType,
  onAccept,
  onReject
) => {
  try {
    let title, message;

    const docTypeNames = {
      form_101: "แบบฟอร์ม 101",
      volunteer_doc: "เอกสารกิจอาสา",
      volunteer_form: "แบบฟอร์มบันทึกชั่วโมงจิตอาสา",
      volunteer_certificate: "เกียรติบัตรจิตอาสา",
      id_copies_student: "สำเนาบัตรประชาชนนักศึกษา",
      id_copies_father: "สำเนาบัตรประชาชนบิดา",
      id_copies_mother: "สำเนาบัตรประชาชนมารดา",
      guardian_id_copies: "สำเนาบัตรประชาชนผู้ปกครอง",
      consent_student_form: "หนังสือยินยอมเปิดเผยข้อมูลนักศึกษา",
      consent_father_form: "หนังสือยินยอมเปิดเผยข้อมูลบิดา",
      consent_mother_form: "หนังสือยินยอมเปิดเผยข้อมูลมารดา",
      guardian_consent: "หนังสือยินยอมเปิดเผยข้อมูลผู้ปกครอง",
      consent_form: "หนังสือยินยอม",
    };

    const docName = docTypeNames[documentType] || "เอกสาร";

    title =
      result.overall_status === "valid"
        ? `✅ ตรวจสอบ${docName}สำเร็จ`
        : `⚠️ ตรวจพบปัญหา`;

    let statusText = "";

    // Status for different document types
    if (documentType === "form_101") {
      statusText += result.isForm101
        ? "✅ ตรวจพบแบบฟอร์ม 101\n"
        : "❌ ไม่พบแบบฟอร์ม 101\n";
    } else if (documentType.includes("id_copies")) {
      statusText += result.isIDCard
        ? "✅ ตรวจพบบัตรประชาชน\n"
        : "❌ ไม่พบบัตรประชาชน\n";
      if (result.isValidIDNumber) {
        statusText += "✅ เลขประจำตัวประชาชนถูกต้อง\n";
      } else {
        statusText += "❌ เลขประจำตัวประชาชนไม่ชัดเจน\n";
      }
    } else if (documentType.includes("consent")) {
      statusText += result.isConsentForm
        ? "✅ ตรวจพบหนังสือยินยอม\n"
        : "❌ ไม่พบหนังสือยินยอม\n";
    } else if (documentType.includes("volunteer")) {
      const isVolunteer =
        result.isVolunteerForm || result.isVolunteerCertificate;
      statusText += isVolunteer
        ? "✅ ตรวจพบเอกสารกิจอาสา\n"
        : "❌ ไม่พบเอกสารกิจอาสา\n";

      const hours = result.totalHours || result.hours || 0;
      if (hours > 0) {
        statusText += `⏰ ชั่วโมงรวม: ${hours} ชั่วโมง\n`;
      }
    }

    if (result.hasSignature) {
      statusText += `✅ ตรวจพบลายเซ็น (${result.signatureQuality})\n`;
    } else if (result.hasSignature === false) {
      statusText += "❌ ไม่พบลายเซ็น\n";
    }

    statusText += `\n🎯 ความเชื่อมั่น: ${result.confidence}%`;

    if (result.extractedData && Object.keys(result.extractedData).length > 0) {
      statusText += "\n\n📋 ข้อมูลที่พบ:";
      Object.entries(result.extractedData).forEach(([key, value]) => {
        if (value) statusText += `\n• ${key}: ${value}`;
      });
    }

    if (result.recommendations && result.recommendations.length > 0) {
      statusText += "\n\n💡 คำแนะนำ:\n• " + result.recommendations.join("\n• ");
    }

    message = statusText;
    const isValid = result.overall_status === "valid";

    const buttons = [
      {
        text: "ลองใหม่",
        style: "cancel",
        onPress: onReject,
      },
    ];

    if (isValid || result.overall_status === "needs_review") {
      buttons.push({
        text:
          result.overall_status === "valid"
            ? "ใช้ไฟล์นี้"
            : "ใช้ไฟล์นี้ (ต้องตรวจสอบ)",
        onPress: onAccept,
      });
    }

    Alert.alert(title, message, buttons);
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

// Validate multiple documents
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
