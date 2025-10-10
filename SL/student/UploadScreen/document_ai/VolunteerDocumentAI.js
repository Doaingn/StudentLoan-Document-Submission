// documents_ai/VolunteerDocumentAI.js - AI validation for Volunteer Work documents
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from "expo-file-system/legacy";
import { Alert } from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../../database/firebase";
import jsQR from "jsqr"; // For QR code reading

// Configuration
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

let genAI = null;
let model = null;

console.log("🔧 VolunteerDocumentAI Configuration:");
console.log("- API Key configured:", !!GEMINI_API_KEY);

/**
 * ดึงชื่อผู้ใช้จาก Firestore
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} - ชื่อผู้ใช้หรือ null
 */
export const getUserNameFromFirestore = async (userId) => {
  try {
    console.log(`👤 Fetching user name for ID: ${userId}`);

    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      const userName = userData.name;
      console.log(`✅ Found user name: ${userName}`);
      return userName;
    } else {
      console.warn(`⚠️ User document not found for ID: ${userId}`);
      return null;
    }
  } catch (error) {
    console.error("❌ Error fetching user name:", error);
    return null;
  }
};

/**
 * เปรียบเทียบชื่อใน 2 รูปแบบ (อนุโลม)
 * @param {string} name1 - ชื่อที่ 1
 * @param {string} name2 - ชื่อที่ 2
 * @returns {object} - ผลการเปรียบเทียบ
 */
export const compareNames = (name1, name2) => {
  if (!name1 || !name2) {
    return {
      isMatch: false,
      similarity: 0,
      reason: "ชื่อหนึ่งหรือทั้งสองไม่มีข้อมูล",
    };
  }

  // ทำให้เป็นตัวพิมพ์เล็กและตัด whitespace
  const cleanName1 = name1.toLowerCase().trim().replace(/\s+/g, " ");
  const cleanName2 = name2.toLowerCase().trim().replace(/\s+/g, " ");

  // เช็คว่าตรงกันเป็น exact match
  if (cleanName1 === cleanName2) {
    return {
      isMatch: true,
      similarity: 100,
      reason: "ชื่อตรงกันทุกประการ",
    };
  }

  // เช็คว่าชื่อหนึ่งอยู่ในอีกชื่อหนึ่ง (เช่น "สมชาย" อยู่ใน "นายสมชาย ใจดี")
  if (cleanName1.includes(cleanName2) || cleanName2.includes(cleanName1)) {
    return {
      isMatch: true,
      similarity: 85,
      reason: "ชื่อบางส่วนตรงกัน",
    };
  }

  // เช็คคำแรกและคำสุดท้าย (เช่น "สมชาย ใจดี" vs "นายสมชาย ใจดี")
  const words1 = cleanName1.split(" ");
  const words2 = cleanName2.split(" ");

  const firstName1 = words1[0];
  const lastName1 = words1[words1.length - 1];
  const firstName2 = words2[0];
  const lastName2 = words2[words2.length - 1];

  // ตรวจสอบว่าชื่อจริงและนามสกุลตรงกัน
  if (words1.length >= 2 && words2.length >= 2) {
    const firstNameMatch = words1.some((w) => words2.includes(w));
    const lastNameMatch = lastName1 === lastName2;

    if (firstNameMatch && lastNameMatch) {
      return {
        isMatch: true,
        similarity: 90,
        reason: "ชื่อจริงและนามสกุลตรงกัน",
      };
    }

    if (lastNameMatch) {
      return {
        isMatch: true,
        similarity: 70,
        reason: "นามสกุลตรงกัน",
      };
    }
  }

  // Calculate similarity percentage using Levenshtein distance
  const similarity = calculateSimilarity(cleanName1, cleanName2);

  if (similarity >= 70) {
    return {
      isMatch: true,
      similarity,
      reason: "ชื่อคล้ายกันมาก (อาจมีตัวสะกดผิดเล็กน้อย)",
    };
  }

  return {
    isMatch: false,
    similarity,
    reason: "ชื่อไม่ตรงกัน",
  };
};

/**
 * คำนวณความคล้ายคลึงระหว่าง 2 string (0-100%)
 */
const calculateSimilarity = (str1, str2) => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 100;

  const editDistance = getEditDistance(longer, shorter);
  return ((longer.length - editDistance) / longer.length) * 100;
};

/**
 * คำนวณ Levenshtein distance
 */
const getEditDistance = (str1, str2) => {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
};

// Initialize Gemini AI for client-side processing
const initializeGemini = () => {
  if (!genAI && GEMINI_API_KEY && "AIzaSyCB5CXsuKesDyB4564AHcv1z8RogeyDUOY") {
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
      console.log(
        "✅ Gemini AI initialized successfully for VolunteerDocument"
      );
      return true;
    } catch (error) {
      console.error(
        "Failed to initialize Gemini AI for VolunteerDocument:",
        error
      );
      return false;
    }
  }
  return !!genAI;
};

export const createNoVolunteerHoursDocument = () => {
  return {
    isVolunteerCertificate: false,
    documentType: "no_volunteer",
    confidence: 100,
    hasHours: false,
    hours: -36, // ใช้ -36 เพื่อระบุว่าไม่มีชั่วโมงจิตอาสา
    hasQRCode: false,
    extractedData: {
      activityName: "ไม่มีชั่วโมงจิตอาสา",
      organizationName: "นักเรียนเลือกไม่มีชั่วโมงจิตอาสา",
      participantName: "",
      date: new Date().toISOString().split("T")[0],
      location: "",
      hours: -36,
      certificateNumber: "NO_VOLUNTEER",
    },
    validation: {
      isValid: true,
      issues: ["นักเรียนเลือกไม่มีชั่วโมงจิตอาสา"],
      recommendations: ["บันทึกสถานะไม่มีชั่วโมงจิตอาสาเรียบร้อย"],
    },
    overall_status: "valid",
    accumulatedHours: -36,
    noVolunteerHours: true, // เพิ่ม flag เพื่อระบุว่าเป็นกรณีไม่มีชั่วโมง
  };
};

// QR Code reader function
const readQRCode = async (imageUri) => {
  try {
    console.log("📱 Reading QR code from image...");

    // Convert image to canvas data for QR reading
    const base64Data = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Create image data from base64 (this would need platform-specific implementation)
    // For now, we'll use AI to detect and read QR codes
    return null; // Placeholder - actual QR reading would be implemented here
  } catch (error) {
    console.error("Error reading QR code:", error);
    return null;
  }
};

// Server-side validation for Volunteer Documents
const validateVolunteerDocViaServer = async (fileUri, docType, mimeType) => {
  try {
    console.log(
      `📤 Uploading to server for ${docType} volunteer validation...`
    );

    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error("File does not exist");
    }

    const formData = new FormData();
    const file = {
      uri: fileUri,
      type: mimeType || "image/jpeg",
      name: `volunteer_${docType}_${Date.now()}.${
        mimeType ? mimeType.split("/")[1] : "jpg"
      }`,
    };

    formData.append("document", file);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Server validation error:", errorText);
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log("✅ Server VolunteerDocument validation completed");
    return result.validation;
  } catch (error) {
    console.error("❌ Server VolunteerDocument validation error:", error);
    throw error;
  }
};

// Convert file to format suitable for Gemini (client-side)
const prepareFileForGemini = async (fileUri, mimeType) => {
  try {
    console.log("🔍 Preparing VolunteerDocument file for Gemini AI...");

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

    console.log("✅ VolunteerDocument file prepared for Gemini");
    return {
      inlineData: {
        data: base64Data,
        mimeType: actualMimeType,
      },
    };
  } catch (error) {
    console.error(
      "❌ Error preparing VolunteerDocument file for Gemini:",
      error
    );
    throw new Error(
      `ไม่สามารถเตรียมไฟล์สำหรับการวิเคราะห์ได้: ${error.message}`
    );
  }
};

// Client-side Volunteer Document validation
const validateVolunteerDocClientSide = async (fileUri, docType, mimeType) => {
  console.log(`🤖 Starting client-side ${docType} volunteer validation...`);

  if (!model) {
    const initialized = initializeGemini();
    if (!initialized) {
      throw new Error("ระบบ AI ไม่พร้อมใช้งาน - กรุณาตรวจสอบ API Key");
    }
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
    // Certificate-specific validation with QR code detection
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
  "qrCodeInfo": {
    "detected": true/false,
    "readable": true/false,
    "data": "ข้อมูลใน QR Code",
    "hoursFromQR": จำนวนชั่วโมงจาก QR,
    "verificationUrl": "URL สำหรับตรวจสอบ"
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

หาก QR Code มีข้อมูลชั่วโมง ให้ใช้ข้อมูลจาก QR Code เป็นหลัก
`;
  } else {
    // General form validation for hour tracking
    prompt = `
ตรวจสอบเอกสารนี้ว่าเป็นแบบฟอร์มบันทึกชั่วโมงกิจอาสาหรือไม่ และคำนวณชั่วโมงรวม

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
  "hoursSummary": {
    "totalRecords": จำนวนรายการ,
    "totalHours": ชั่วโมงรวม,
    "averageHours": ชั่วโมงเฉลี่ย,
    "dateRange": {
      "start": "วันที่เริ่มต้น",
      "end": "วันที่สิ้นสุด"
    }
  },
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
2. การนับและคำนวณชั่วโมงรวมให้ถูกต้อง
3. รายละเอียดกิจกรรมแต่ละรายการ
4. ข้อมูลนักเรียนและช่วงเวลา
5. การตรวจสอบความถูกต้องของการคำนวณ
`;
  }

  try {
    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();

    console.log("🤖 VolunteerDocument AI Response received");

    // Try to parse JSON response
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Additional QR code processing if detected
        if (parsed.hasQRCode && parsed.qrCodeInfo?.detected) {
          try {
            const qrData = await readQRCode(fileUri);
            if (qrData) {
              parsed.qrCodeInfo.data = qrData;
              parsed.qrCodeInfo.readable = true;
            }
          } catch (qrError) {
            console.warn("Could not read QR code:", qrError);
          }
        }

        console.log("✅ Client-side VolunteerDocument validation completed");
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
    console.error("❌ Client-side VolunteerDocument validation failed:", error);
    throw error;
  }
};

// Fallback text analysis for Volunteer Documents
const analyzeVolunteerTextResponse = (text, docType) => {
  const lowerText = text.toLowerCase();

  const isVolunteerDoc =
    lowerText.includes("กิจอาสา") ||
    lowerText.includes("volunteer") ||
    lowerText.includes("ชั่วโมง") ||
    lowerText.includes("เกียรติบัตร") ||
    lowerText.includes("certificate");

  const hasHours =
    lowerText.includes("ชั่วโมง") ||
    lowerText.includes("hour") ||
    /\d+\s*(ชั่วโมง|hour)/i.test(text);

  // Try to extract hours from text
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
      qrCodeInfo: {
        detected: false,
        readable: false,
        data: null,
        hoursFromQR: null,
        verificationUrl: null,
      },
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

export const extractVolunteerHours = (result) => {
  if (!result) return 0;

  console.log("🔍 Extracting hours from result:", result);

  // ลองดึงชั่วโมงจากหลายๆ ที่ในผลลัพธ์
  let hours = 0;

  if (result.documentType === "certificate") {
    hours =
      result.hours ||
      result.qrCodeInfo?.hoursFromQR ||
      result.extractedData?.hours ||
      result.accumulatedHours ||
      0;
  } else if (result.documentType === "form") {
    hours =
      result.totalHours ||
      result.hoursSummary?.totalHours ||
      result.accumulatedHours ||
      0;
  }

  // ถ้ายังไม่ได้ชั่วโมง，ลองหารูปแบบอื่น
  if (hours === 0) {
    // ลองหาเลขในผลลัพธ์
    const hourMatch = JSON.stringify(result).match(/"hours?":\s*(\d+)/);
    if (hourMatch) {
      hours = parseInt(hourMatch[1]);
    }
  }

  console.log(`✅ Extracted hours: ${hours}`);
  return hours;
};

// Main validation function for Volunteer Documents
export const validateVolunteerDocument = async (
  fileUri,
  docType = "certificate",
  mimeType = null,
  isNoVolunteerHours = false,
  userId = null
) => {
  try {
    console.log(`🚀 Starting ${docType} volunteer document validation...`);

    // หากเป็นกรณีไม่มีชั่วโมงจิตอาสา
    if (isNoVolunteerHours) {
      console.log("📝 Creating no volunteer hours document");
      const result = createNoVolunteerHoursDocument();
      return result;
    }

    // ตรวจสอบว่าจะใช้ server-side หรือ client-side validation
    console.log("File URI:", fileUri);
    console.log("MIME Type:", mimeType);

    let useServer = false;
    let result;

    if (useServer) {
      result = await validateVolunteerDocViaServer(fileUri, docType, mimeType);
    } else {
      console.log("✅ Using client-side VolunteerDocument validation");
      result = await validateVolunteerDocClientSide(fileUri, docType, mimeType);
    }

    console.log("📊 Raw AI result for volunteer document:", result);
    result.accumulatedHours = extractVolunteerHours(result);
    console.log("📊 Extracted hours:", result.accumulatedHours);

    // ============================================
    // เพิ่มการตรวจสอบชื่อ
    // ============================================
    if (userId && result.extractedData?.participantName) {
      console.log("👤 Verifying participant name...");

      const userNameFromDB = await getUserNameFromFirestore(userId);
      const nameFromDocument = result.extractedData.participantName;

      if (userNameFromDB) {
        const nameComparison = compareNames(userNameFromDB, nameFromDocument);

        // เพิ่มข้อมูลการตรวจสอบชื่อใน result
        result.nameVerification = {
          userNameFromDB,
          nameFromDocument,
          isMatch: nameComparison.isMatch,
          similarity: nameComparison.similarity,
          reason: nameComparison.reason,
        };

        console.log(`📝 Name verification result:`, nameComparison);

        // เพิ่ม warning ถ้าชื่อไม่ตรงกัน
        if (!nameComparison.isMatch) {
          if (!result.validation.issues) {
            result.validation.issues = [];
          }
          result.validation.issues.push(
            `⚠️ ชื่อในเอกสาร "${nameFromDocument}" ไม่ตรงกับชื่อในระบบ "${userNameFromDB}"`
          );

          if (!result.validation.recommendations) {
            result.validation.recommendations = [];
          }
          result.validation.recommendations.push(
            "กรุณาตรวจสอบว่าเอกสารเป็นของคุณจริง"
          );

          // ลดความเชื่อมั่น
          result.confidence = Math.max(0, (result.confidence || 0) - 20);

          // เปลี่ยนสถานะเป็น needs_review
          if (result.overall_status === "valid") {
            result.overall_status = "needs_review";
          }
        } else {
          console.log(
            `✅ Name verification passed (${nameComparison.similarity}% similarity)`
          );

          if (!result.validation.recommendations) {
            result.validation.recommendations = [];
          }
          result.validation.recommendations.push(
            `✓ ชื่อในเอกสารตรงกับชื่อในระบบ (${nameComparison.reason})`
          );
        }
      } else {
        console.warn("⚠️ Could not fetch user name from database");
        result.nameVerification = {
          userNameFromDB: null,
          nameFromDocument,
          isMatch: null,
          similarity: 0,
          reason: "ไม่สามารถดึงข้อมูลชื่อจากระบบได้",
        };
      }
    } else {
      console.log(
        "⚠️ Skipping name verification (missing userId or participantName)"
      );
    }

    return result;
  } catch (error) {
    console.error("❌ VolunteerDocument validation error:", error);
    throw new Error(`การตรวจสอบเอกสารกิจอาสา ล้มเหลว: ${error.message}`);
  }
};

// Show Volunteer Document validation alert
export const showVolunteerDocValidationAlert = (result, onAccept, onReject) => {
  let title, message, isValid;

  const docTypeName = {
    form: "แบบฟอร์มบันทึกชั่วโมง",
    certificate: "เกียรติบัตร",
    summary: "สรุปชั่วโมง",
    participation: "หนังสือรับรอง",
  };

  title =
    result.overall_status === "valid"
      ? "✅ ตรวจสอบเอกสารกิจอาสาสำเร็จ"
      : "⚠️ ตรวจพบปัญหา";

  let statusText = "";

  if (result.isVolunteerForm || result.isVolunteerCertificate) {
    statusText += `✅ ตรวจพบ${docTypeName[result.documentType] || "เอกสาร"}\n`;
  } else {
    statusText += "❌ ไม่พบเอกสารกิจอาสา\n";
  }

  const totalHours = result.totalHours || result.hours || 0;
  if (totalHours > 0) {
    statusText += `⏰ ชั่วโมงรวม: ${totalHours} ชั่วโมง\n`;
  }

  // ============================================
  // เพิ่มการแสดงผลการตรวจสอบชื่อ
  // ============================================
  if (result.nameVerification) {
    statusText += "\n👤 การตรวจสอบชื่อ:\n";
    statusText += `  ชื่อในระบบ: ${
      result.nameVerification.userNameFromDB || "ไม่พบข้อมูล"
    }\n`;
    statusText += `  ชื่อในเอกสาร: ${result.nameVerification.nameFromDocument}\n`;

    if (result.nameVerification.isMatch === true) {
      statusText += `  ✅ ตรวจสอบผ่าน (${result.nameVerification.similarity.toFixed(
        0
      )}%)\n`;
      statusText += `  ${result.nameVerification.reason}\n`;
    } else if (result.nameVerification.isMatch === false) {
      statusText += `  ❌ ชื่อไม่ตรงกัน (${result.nameVerification.similarity.toFixed(
        0
      )}%)\n`;
      statusText += `  ${result.nameVerification.reason}\n`;
    } else {
      statusText += `  ⚠️ ไม่สามารถตรวจสอบได้\n`;
    }
  }

  if (result.hasQRCode) {
    statusText += "\n📱 ตรวจพบ QR Code\n";
    if (result.qrCodeInfo?.readable) {
      statusText += `  └─ ข้อมูล: ${result.qrCodeInfo.data || "อ่านไม่ได้"}\n`;
      if (result.qrCodeInfo.hoursFromQR) {
        statusText += `  └─ ชั่วโมงจาก QR: ${result.qrCodeInfo.hoursFromQR}\n`;
      }
    }
  }

  statusText += `\n🎯 ความเชื่อมั่น: ${result.confidence}%`;

  if (result.extractedData && Object.keys(result.extractedData).length > 0) {
    statusText += "\n\n📋 ข้อมูลที่พบ:";
    Object.entries(result.extractedData).forEach(([key, value]) => {
      if (value) statusText += `\n• ${key}: ${value}`;
    });
  }

  if (result.hourRecords && result.hourRecords.length > 0) {
    statusText += `\n\n📝 รายการกิจกรรม (${result.hourRecords.length} รายการ):`;
    result.hourRecords.slice(0, 3).forEach((record, index) => {
      statusText += `\n${index + 1}. ${record.activity} - ${
        record.hours
      } ชั่วโมง`;
    });
    if (result.hourRecords.length > 3) {
      statusText += `\n... และอีก ${result.hourRecords.length - 3} รายการ`;
    }
  }

  if (result.validation?.issues && result.validation.issues.length > 0) {
    statusText +=
      "\n\n⚠️ ปัญหาที่พบ:\n• " + result.validation.issues.join("\n• ");
  }

  if (
    result.validation?.recommendations &&
    result.validation.recommendations.length > 0
  ) {
    statusText +=
      "\n\n💡 คำแนะนำ:\n• " + result.validation.recommendations.join("\n• ");
  }

  message = statusText;
  isValid =
    result.overall_status === "valid" &&
    (result.isVolunteerForm || result.isVolunteerCertificate);

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
};

// Calculate total hours from multiple documents
export const calculateTotalVolunteerHours = (documents) => {
  let totalHours = 0;
  let validDocuments = 0;

  documents.forEach((doc) => {
    if (doc.validation && doc.validation.isValid) {
      const hours = doc.totalHours || doc.hours || 0;
      totalHours += hours;
      validDocuments++;
    }
  });

  return {
    totalHours,
    validDocuments,
    averageHours: validDocuments > 0 ? totalHours / validDocuments : 0,
  };
};

// Validate multiple volunteer documents
export const validateMultipleVolunteerDocuments = async (files) => {
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await validateVolunteerDocument(
        file.uri,
        file.docType || "form",
        file.mimeType
      );
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        docType: file.docType || "form",
        validation: result,
        success: true,
      });
    } catch (error) {
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        docType: file.docType || "form",
        error: error.message,
        success: false,
      });
    }
  }

  return results;
};

// Check Volunteer Document AI backend status
export const checkVolunteerDocumentAIStatus = async () => {
  try {
    console.log("🤖 Checking VolunteerDocument AI backend status...");

    // If configured to use backend server, check server firs
    // Fall back to client-side AI
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
      console.error("❌ Gemini API key not configured for VolunteerDocument");
      return false;
    }

    const initialized = initializeGemini();
    if (!initialized) {
      console.error("❌ Failed to initialize Gemini AI for VolunteerDocument");
      return false;
    }

    // Test with a simple request
    try {
      console.log("🔬 Testing client-side VolunteerDocument AI connection...");
      const testResult = await model.generateContent(
        "Test connection - respond with OK"
      );
      const testResponse = await testResult.response;
      const text = testResponse.text();

      console.log("✅ Client-side VolunteerDocument AI is available");
      return true;
    } catch (testError) {
      console.error(
        "❌ Client-side VolunteerDocument AI test failed:",
        testError.message
      );
      return false;
    }
  } catch (error) {
    console.error("❌ VolunteerDocument AI backend check failed:", error);
    return false;
  }
};