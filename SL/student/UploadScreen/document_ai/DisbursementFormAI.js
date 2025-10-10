// documents_ai/DisbursementFormAI.js - Enhanced with profile data verification and term validation
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from "expo-file-system/legacy";
import { Alert } from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../../database/firebase";

// Configuration
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

let genAI = null;
let model = null;

console.log("🔧 DisbursementFormAI Configuration:");
console.log("- Client-side only (no backend server)");
console.log("- API Key configured:", !!GEMINI_API_KEY);

// Initialize Gemini AI
const initializeGemini = () => {
  if (
    !genAI &&
    GEMINI_API_KEY &&
    GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY_HERE"
  ) {
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      console.log("✓ Gemini AI initialized successfully for DisbursementForm");
      return true;
    } catch (error) {
      console.error(
        "Failed to initialize Gemini AI for DisbursementForm:",
        error
      );
      return false;
    }
  }
  return !!genAI;
};

// Fetch current submission period config from Firebase
export const fetchCurrentSubmissionPeriod = async () => {
  try {
    console.log("📥 Fetching current submission period from Firebase...");
    const configDoc = await getDoc(doc(db, "DocumentService", "config"));

    if (!configDoc.exists()) {
      console.warn("⚠️ Config document not found");
      return null;
    }

    const configData = configDoc.data();
    console.log("✅ Submission period config fetched:", configData);

    return {
      term: configData.term || null,
      academicYear: configData.academicYear || null,
      isEnabled: configData.isEnabled || false,
      immediateAccess: configData.immediateAccess || false,
    };
  } catch (error) {
    console.error("❌ Error fetching submission period config:", error);
    return null;
  }
};

// Fetch user profile data from Firebase
export const fetchUserProfileData = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn("⚠️ No authenticated user found");
      return null;
    }

    console.log("📥 Fetching user profile data from Firebase...");
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (!userDoc.exists()) {
      console.warn("⚠️ User document not found");
      return null;
    }

    const userData = userDoc.data();
    console.log("✅ User profile data fetched successfully");

    return {
      name: userData.name || null,
      student_id: userData.student_id || null,
      citizen_id: userData.citizen_id || null,
      birth_date: userData.birth_date || null,
      school: userData.school || null,
      major: userData.major || null,
      phone_num: userData.phone_num || null,
      email: userData.email || null,
    };
  } catch (error) {
    console.error("❌ Error fetching user profile data:", error);
    return null;
  }
};

// Extract term number from text
const extractTermNumber = (text) => {
  if (!text) return null;

  const normalized = text.toString().toLowerCase();

  const trimmedText = text.toString().trim();
  if (/^[123]$/.test(trimmedText)) {
    return trimmedText;
  }
  //

  // Try to find term number patterns
  const patterns = [
    /ภาค(?:เรียน)?(?:การศึกษา)?(?:ที่)?\s*(\d+)/,
    /semester\s*(\d+)/i,
    /term\s*(\d+)/i,
    /เทอม\s*(\d+)/,
    /ภาคที่\s*(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // Check for standalone numbers after specific keywords
  if (normalized.includes("ภาค") || normalized.includes("เทอม")) {
    const numbers = text.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      const num = numbers[0];
      if (num === "1" || num === "2" || num === "3") {
        return num;
      }
    }
  }

  return null;
};

// Extract academic year from text
const extractAcademicYear = (text) => {
  if (!text) return null;

  const normalized = text.toString();

  // Try to find academic year patterns
  const patterns = [
    /ปีการศึกษา\s*(\d{4})/,
    /(\d{4})\s*-\s*\d{4}/, // 2567-2568 format
    /academic\s*year\s*(\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // Find any 4-digit year (25XX format for Thai Buddhist calendar)
  const yearMatch = normalized.match(/25\d{2}/);
  if (yearMatch) {
    return yearMatch[0];
  }

  return null;
};

// Compare extracted data with profile data and submission period
const compareWithProfile = (
  extractedData,
  profileData,
  submissionPeriod = null
) => {
  if (!profileData || !extractedData) {
    return {
      matchStatus: "no_profile_data",
      matches: {},
      mismatches: [],
      warnings: ["ไม่มีข้อมูลโปรไฟล์สำหรับเปรียบเทียบ"],
      termCheckResult: null,
    };
  }

  const matches = {};
  const mismatches = [];
  const warnings = [];
  let termCheckResult = null;

  // Helper function to normalize text
  const normalizeText = (text) => {
    if (!text) return "";
    return text
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^\u0E00-\u0E7Fa-z0-9\s]/g, "");
  };

  // Helper function to extract numbers
  const extractNumbers = (text) => {
    if (!text) return "";
    return text.toString().replace(/\D/g, "");
  };

  // ✅ Check term and academic year if submission period is provided
  if (
    submissionPeriod &&
    submissionPeriod.term &&
    submissionPeriod.academicYear
  ) {
    const docTerm = extractTermNumber(extractedData.semester);
    const docYear = extractAcademicYear(extractedData.academic_year);

    console.log("🔍 Term Validation:", {
      expectedTerm: submissionPeriod.term,
      extractedTerm: docTerm,
      expectedYear: submissionPeriod.academicYear,
      extractedYear: docYear,
    });

    const termMatches = docTerm === String(submissionPeriod.term);
    const yearMatches = docYear === String(submissionPeriod.academicYear);

    termCheckResult = {
      termMatches,
      yearMatches,
      expectedTerm: submissionPeriod.term,
      expectedYear: submissionPeriod.academicYear,
      extractedTerm: docTerm,
      extractedYear: docYear,
      overall: termMatches && yearMatches,
    };

    if (!termMatches || !yearMatches) {
      let mismatchMsg = "";
      if (!termMatches && !yearMatches) {
        mismatchMsg = `เอกสารเป็นของภาคเรียนที่ ${
          docTerm || "ไม่ระบุ"
        } ปีการศึกษา ${docYear || "ไม่ระบุ"} แต่ระบบเปิดรับเฉพาะภาคเรียนที่ ${
          submissionPeriod.term
        } ปีการศึกษา ${submissionPeriod.academicYear}`;
      } else if (!termMatches) {
        mismatchMsg = `เอกสารเป็นของภาคเรียนที่ ${
          docTerm || "ไม่ระบุ"
        } แต่ระบบเปิดรับเฉพาะภาคเรียนที่ ${submissionPeriod.term}`;
      } else if (!yearMatches) {
        mismatchMsg = `เอกสารเป็นของปีการศึกษา ${
          docYear || "ไม่ระบุ"
        } แต่ระบบเปิดรับเฉพาะปีการศึกษา ${submissionPeriod.academicYear}`;
      }

      mismatches.push({
        field: "ภาคการศึกษา/ปีการศึกษา",
        extracted: `ภาคเรียนที่ ${docTerm || "ไม่ระบุ"} ปีการศึกษา ${
          docYear || "ไม่ระบุ"
        }`,
        profile: `ภาคเรียนที่ ${submissionPeriod.term} ปีการศึกษา ${submissionPeriod.academicYear}`,
        reason: mismatchMsg,
        severity: "critical",
      });
    } else {
      matches.term = true;
      matches.academicYear = true;
    }
  }

  // Compare student name
  if (extractedData.studentName && profileData.name) {
    const extractedName = normalizeText(extractedData.studentName);
    const profileName = normalizeText(profileData.name);

    if (extractedName === profileName) {
      matches.name = true;
    } else if (
      extractedName.includes(profileName) ||
      profileName.includes(extractedName)
    ) {
      matches.name = true;
      warnings.push("ชื่อในเอกสารและโปรไฟล์ใกล้เคียงกัน แต่ไม่ตรงทุกตัวอักษร");
    } else {
      matches.name = false;
      mismatches.push({
        field: "ชื่อ-นามสกุล",
        extracted: extractedData.studentName,
        profile: profileData.name,
      });
    }
  }

  // Compare student ID
  if (extractedData.studentId && profileData.student_id) {
    const extractedId = extractNumbers(extractedData.studentId);
    const profileId = extractNumbers(profileData.student_id);

    if (extractedId === profileId) {
      matches.student_id = true;
    } else {
      matches.student_id = false;
      mismatches.push({
        field: "รหัสนักศึกษา",
        extracted: extractedData.studentId,
        profile: profileData.student_id,
      });
    }
  }

  // Compare citizen ID
  if (extractedData.idNumber && profileData.citizen_id) {
    const extractedCitizenId = extractNumbers(extractedData.idNumber);
    const profileCitizenId = extractNumbers(profileData.citizen_id);

    if (extractedCitizenId === profileCitizenId) {
      matches.citizen_id = true;
    } else {
      matches.citizen_id = false;
      mismatches.push({
        field: "เลขบัตรประชาชน",
        extracted: extractedData.idNumber,
        profile: profileData.citizen_id,
      });
    }
  }

  // Compare university/school
  if (extractedData.university && profileData.school) {
    const extractedUni = normalizeText(extractedData.university);
    const profileSchool = normalizeText(profileData.school);

    const isUniversityName =
      extractedUni.includes("มหาวิทยาลัย") ||
      extractedUni.includes("university");

    if (!isUniversityName) {
      if (
        extractedUni.includes(profileSchool) ||
        profileSchool.includes(extractedUni)
      ) {
        matches.school = true;
      }
    }
  }

  // Compare faculty
  if (extractedData.faculty && profileData.school) {
    const extractedFaculty = normalizeText(extractedData.faculty);
    const profileSchool = normalizeText(profileData.school);

    if (
      extractedFaculty.includes(profileSchool) ||
      profileSchool.includes(extractedFaculty)
    ) {
      matches.school = true;
    } else {
      matches.school = false;
      mismatches.push({
        field: "สำนักวิชา/คณะ",
        extracted: extractedData.faculty,
        profile: profileData.school,
      });
    }
  }

  // Determine overall match status
  let matchStatus = "full_match";

  // Check for critical term mismatch first
  const hasTermMismatch = mismatches.some((m) => m.severity === "critical");

  if (hasTermMismatch) {
    matchStatus = "term_mismatch";
  } else if (mismatches.length > 0) {
    matchStatus = "mismatch";
  } else if (warnings.length > 0) {
    matchStatus = "partial_match";
  } else if (Object.keys(matches).length === 0) {
    matchStatus = "insufficient_data";
    warnings.push("ข้อมูลในเอกสารไม่เพียงพอสำหรับการเปรียบเทียบ");
  }

  return {
    matchStatus,
    matches,
    mismatches,
    warnings,
    termCheckResult,
    comparisonDetails: {
      fieldsCompared: Object.keys(matches).length,
      fieldsMatched: Object.values(matches).filter((v) => v === true).length,
      fieldsMismatched: mismatches.length,
    },
  };
};

// Prepare file for Gemini
const prepareFileForGemini = async (fileUri, mimeType) => {
  try {
    console.log("📁 Preparing DisbursementForm file for Gemini AI...");

    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    let actualMimeType = mimeType || "image/jpeg";
    if (!mimeType) {
      const ext = fileUri.split(".").pop()?.toLowerCase();
      if (ext === "png") actualMimeType = "image/png";
      else if (ext === "pdf") actualMimeType = "application/pdf";
    }

    console.log("✅ DisbursementForm file prepared for Gemini");
    return {
      inlineData: {
        data: base64Data,
        mimeType: actualMimeType,
      },
    };
  } catch (error) {
    console.error("❌ Error preparing DisbursementForm file:", error);
    throw new Error(
      `ไม่สามารถเตรียมไฟล์สำหรับการวิเคราะห์ได้: ${error.message}`
    );
  }
};

// Client-side validation
const validateDisbursementFormClientSide = async (
  fileUri,
  mimeType,
  profileData,
  submissionPeriod
) => {
  console.log("🤖 Starting client-side disbursement form validation...");

  if (!model) {
    const initialized = initializeGemini();
    if (!initialized) throw new Error("ระบบ AI ไม่พร้อมใช้งาน");
  }

  const filePart = await prepareFileForGemini(fileUri, mimeType);

  let profileInfo = "";
  if (profileData) {
    profileInfo = `

**ข้อมูลโปรไฟล์นักศึกษาสำหรับเปรียบเทียบ:**
- ชื่อ-นามสกุล: ${profileData.name || "ไม่ระบุ"}
- รหัสนักศึกษา: ${profileData.student_id || "ไม่ระบุ"}
- เลขบัตรประชาชน: ${profileData.citizen_id || "ไม่ระบุ"}
- สำนักวิชา: ${profileData.school || "ไม่ระบุ"}
- สาขาวิชา: ${profileData.major || "ไม่ระบุ"}

กรุณาเปรียบเทียบข้อมูลที่สกัดได้กับข้อมูลโปรไฟล์ด้วย`;
  }

  let submissionPeriodInfo = "";
  if (submissionPeriod) {
    submissionPeriodInfo = `

**ช่วงเวลาการส่งเอกสารที่เปิดรับ:**
- ภาคเรียนที่: ${submissionPeriod.term}
- ปีการศึกษา: ${submissionPeriod.academicYear}

⚠️ **สำคัญมาก:** เอกสารต้องเป็นของภาคเรียนที่ ${submissionPeriod.term} ปีการศึกษา ${submissionPeriod.academicYear} เท่านั้น`;
  }

  const prompt = `
ตรวจสอบเอกสารนี้ว่าเป็นแบบยืนยันการเบิกเงินกู้ยืม (Disbursement Form) หรือไม่
${profileInfo}
${submissionPeriodInfo}

กรุณาตรวจสอบและตอบในรูปแบบ JSON ดังนี้:
{
  "isDisbursementForm": true/false,
  "confidence": 0-100,
  "documentType": "แบบยืนยันการเบิกเงินกู้ยืม/ใบยืนยันการรับเงิน/หนังสือรับรองการเบิกเงิน/อื่นๆ",
  "loanType": "ทุนการศึกษา/เงินกู้ยืม/ทุนส่วนตัว/ทุนภาครัฐ/อื่นๆ",
  "hasOfficialSeal": true/false,
  "hasSignature": true/false,
  "signatureQuality": "clear/unclear/missing",
  "hasStudentSignature": true/false,
  "extractedData": {
    "studentName": "ชื่อ-นามสกุลนักศึกษา",
    "studentId": "รหัสนักศึกษา",
    "idNumber": "เลขบัตรประชาชน",
    "loanAmount": "จำนวนเงินกู้",
    "disbursementAmount": "จำนวนเงินที่เบิก",
    "academic_year": "ปีการศึกษา",
    "semester": "ภาคการศึกษา",
    "university": "สถาบันการศึกษา",
    "faculty": "คณะ",
    "program": "สาขาวิชา",
    "disbursementDate": "วันที่เบิกเงิน",
    "issueDate": "วันที่ออกเอกสาร",
    "bankAccount": "เลขที่บัญชีธนาคาร",
    "bankName": "ชื่อธนาคาร",
    "officerName": "ชื่อเจ้าหน้าที่ผู้รับรอง",
    "officerPosition": "ตำแหน่งเจ้าหน้าที่",
    "referenceNumber": "เลขที่อ้างอิง"
  },
  "loanDetails": {
    "purpose": "วัตถุประสงค์การกู้",
    "repaymentPeriod": "ระยะเวลาผ่อนชำระ",
    "interestRate": "อัตราดอกเบี้ย",
    "guarantor": "ผู้ค้ำประกัน",
    "totalLoanAmount": "จำนวนเงินกู้ทั้งหมด",
    "remainingAmount": "จำนวนเงินคงเหลือ"
  },
  "documentQuality": {
    "isExpired": true/false/null,
    "isLegible": true/false,
    "hasWatermark": true/false,
    "imageQuality": "clear/blurry/poor/excellent",
    "isComplete": true/false
  },
  "validityChecks": {
    "hasValidDates": true/false,
    "hasConsistentInfo": true/false,
    "hasRequiredFields": true/false,
    "hasValidAmount": true/false,
    "isOfficialDocument": true/false
  },
  "qualityIssues": ["ปัญหาที่พบ"],
  "recommendations": ["คำแนะนำ"],
  "overall_status": "valid/invalid/needs_review"
}

ให้ความสำคัญกับ:
1. การระบุว่าเป็นแบบยืนยันการเบิกเงินกู้ยืมจริง
2. ข้อมูลนักศึกษา (ชื่อ, รหัส, เลขประชาชน) - ต้องตรงกับโปรไฟล์
3. ภาคเรียนและปีการศึกษา - สำคัญที่สุด! ต้องตรงกับช่วงเวลาที่เปิดรับที่กำหนดให้
   - หากเจอข้อความในรูปแบบ "1/2568" ให้แยกข้อมูลอย่างชัดเจน โดยใส่ "1" ใน field 'semester' และ "2568" ใน field 'academic_year'
   - ห้ามนำค่า "1/2568" ทั้งหมดไปใส่ใน field ใด field หนึ่งโดยเด็ดขาด
4. จำนวนเงินที่เบิกและรายละเอียดเงินกู้
5. วันที่เบิกเงินและวันที่ออกเอกสาร
6. ตราประทับหน่วยงาน
7. ลายเซ็นนักศึกษาและเจ้าหน้าที่
8. ข้อมูลบัญชีธนาคาร
9. ความสมบูรณ์และความถูกต้องของข้อมูล
`;

  try {
    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();

    console.log("🤖 DisbursementForm AI Response received");

    let parsed;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch (parseError) {
      console.warn("⚠️ Failed to parse JSON, using text analysis");
      parsed = analyzeDisbursementFormTextResponse(responseText);
    }

    // Add profile comparison with submission period
    if (profileData) {
      const comparison = compareWithProfile(
        parsed.extractedData,
        profileData,
        submissionPeriod
      );
      parsed.profileComparison = comparison;

      // Check for term mismatch (highest priority)
      const hasTermMismatch = comparison.mismatches.some(
        (m) => m.severity === "critical"
      );

      if (hasTermMismatch) {
        parsed.qualityIssues = parsed.qualityIssues || [];
        const termMismatch = comparison.mismatches.find(
          (m) => m.severity === "critical"
        );
        parsed.qualityIssues.unshift(`⛔ ${termMismatch.reason}`);

        parsed.recommendations = parsed.recommendations || [];
        parsed.recommendations.unshift(
          "กรุณาอัปโหลดเอกสารที่ตรงกับช่วงเวลาที่เปิดรับ"
        );

        // Force status to invalid
        parsed.overall_status = "invalid";
        parsed.confidence = Math.min(parsed.confidence || 0, 30);
      } else if (comparison.mismatches.length > 0) {
        // Other mismatches
        parsed.qualityIssues = parsed.qualityIssues || [];
        comparison.mismatches.forEach((mismatch) => {
          parsed.qualityIssues.push(
            `${mismatch.field}ไม่ตรงกับโปรไฟล์: เอกสาร="${mismatch.extracted}" โปรไฟล์="${mismatch.profile}"`
          );
        });

        parsed.recommendations = parsed.recommendations || [];
        parsed.recommendations.push(
          "กรุณาตรวจสอบว่าข้อมูลในเอกสารตรงกับข้อมูลในโปรไฟล์"
        );

        if (parsed.overall_status === "valid") {
          parsed.overall_status = "needs_review";
        }
      }

      if (comparison.warnings.length > 0) {
        parsed.recommendations = parsed.recommendations || [];
        parsed.recommendations.push(...comparison.warnings);
      }
    }

    console.log("✅ Client-side DisbursementForm validation completed");
    return parsed;
  } catch (error) {
    console.error("❌ Client-side validation failed:", error);
    throw error;
  }
};

// Fallback text analysis
const analyzeDisbursementFormTextResponse = (text) => {
  const lowerText = text.toLowerCase();

  const isDisbursementForm =
    lowerText.includes("แบบยืนยันการเบิกเงิน") ||
    lowerText.includes("ใบยืนยันการรับเงิน") ||
    lowerText.includes("disbursement") ||
    lowerText.includes("การเบิกเงิน") ||
    lowerText.includes("เงินกู้ยืม") ||
    lowerText.includes("ทุนการศึกษา");

  const hasOfficialSeal =
    lowerText.includes("ตราประทับ") ||
    lowerText.includes("ตราราชการ") ||
    lowerText.includes("official seal");

  const hasSignature =
    lowerText.includes("ลายเซ็น") ||
    lowerText.includes("ลงชื่อ") ||
    lowerText.includes("signature");

  let loanType = "ไม่ทราบ";
  if (lowerText.includes("ทุนการศึกษา")) loanType = "ทุนการศึกษา";
  else if (lowerText.includes("เงินกู้ยืม")) loanType = "เงินกู้ยืม";
  else if (lowerText.includes("กยศ")) loanType = "ทุนภาครัฐ";

  return {
    isDisbursementForm,
    confidence: isDisbursementForm ? 75 : 25,
    documentType: isDisbursementForm ? "แบบยืนยันการเบิกเงินกู้ยืม" : "ไม่ทราบ",
    loanType,
    hasOfficialSeal,
    hasSignature,
    signatureQuality: hasSignature ? "unclear" : "missing",
    hasStudentSignature: hasSignature,
    issuingAuthority: "ไม่ทราบ",
    extractedData: {},
    loanDetails: {},
    documentQuality: {
      isExpired: null,
      isLegible: true,
      hasWatermark: false,
      imageQuality: "unclear",
      isComplete: true,
    },
    validityChecks: {
      hasValidDates: null,
      hasConsistentInfo: null,
      hasRequiredFields: isDisbursementForm,
      hasValidAmount: null,
      isOfficialDocument: hasOfficialSeal,
    },
    qualityIssues: !isDisbursementForm
      ? ["ไม่พบแบบยืนยันการเบิกเงินกู้ยืม"]
      : [],
    recommendations: !isDisbursementForm
      ? ["กรุณาอัปโหลดแบบยืนยันการเบิกเงินกู้ยืม"]
      : [],
    overall_status:
      isDisbursementForm && hasOfficialSeal && hasSignature
        ? "valid"
        : "needs_review",
    rawResponse: text,
  };
};

// Main validation function
export const validateDisbursementForm = async (
  fileUri,
  mimeType = null,
  includeProfileCheck = true,
  includeTermCheck = true
) => {
  try {
    console.log("🚀 Starting disbursement form validation...");

    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error("ไฟล์ไม่พบ");
    }

    // Fetch profile data if requested
    let profileData = null;
    if (includeProfileCheck) {
      profileData = await fetchUserProfileData();
      if (profileData) {
        console.log("✅ Profile data loaded for comparison");
      }
    }

    // Fetch submission period if requested
    let submissionPeriod = null;
    if (includeTermCheck) {
      submissionPeriod = await fetchCurrentSubmissionPeriod();
      if (
        submissionPeriod &&
        submissionPeriod.term &&
        submissionPeriod.academicYear
      ) {
        console.log("✅ Submission period loaded:", submissionPeriod);
      } else {
        console.warn("⚠️ Submission period not configured");
      }
    }

    console.log("✅ Using client-side DisbursementForm validation");
    return await validateDisbursementFormClientSide(
      fileUri,
      mimeType,
      profileData,
      submissionPeriod
    );
  } catch (error) {
    console.error("❌ DisbursementForm validation error:", error);
    throw new Error(`การตรวจสอบล้มเหลว: ${error.message}`);
  }
};

// Parse result
export const parseDisbursementFormResult = (result) => {
  if (!result) return null;

  const hasTermMismatch =
    result.profileComparison?.matchStatus === "term_mismatch";

  return {
    isValid:
      result.overall_status === "valid" &&
      result.isDisbursementForm &&
      !hasTermMismatch &&
      result.profileComparison?.matchStatus !== "mismatch",
    confidence: result.confidence || 0,
    status: result.overall_status || "unknown",
    documentType: result.documentType || "ไม่ทราบ",
    loanType: result.loanType || "ไม่ทราบ",
    hasOfficialSeal: result.hasOfficialSeal || false,
    hasSignature: result.hasSignature || false,
    hasStudentSignature: result.hasStudentSignature || false,
    signatureQuality: result.signatureQuality || "missing",
    issuingAuthority: result.issuingAuthority || "ไม่ทราบ",
    extractedData: result.extractedData || {},
    loanDetails: result.loanDetails || {},
    documentQuality: result.documentQuality || {},
    validityChecks: result.validityChecks || {},
    profileComparison: result.profileComparison || null,
    qualityIssues: result.qualityIssues || [],
    recommendations: result.recommendations || [],
    hasTermMismatch: hasTermMismatch,
    rawResult: result,
  };
};

// Show validation alert
export const showDisbursementFormValidationAlert = (
  result,
  onAccept,
  onReject
) => {
  let title, message;

  const hasTermMismatch =
    result.profileComparison?.matchStatus === "term_mismatch";
  const profileMismatch = result.profileComparison?.matchStatus === "mismatch";

  if (hasTermMismatch) {
    title = "⛔ เอกสารไม่ตรงกับช่วงเวลาที่เปิดรับ";
  } else if (profileMismatch) {
    title = "⚠️ ข้อมูลไม่ตรงกับโปรไฟล์";
  } else if (result.overall_status === "valid") {
    title = "✅ ตรวจสอบแบบยืนยันการเบิกเงินกู้ยืมสำเร็จ";
  } else {
    title = "⚠️ ตรวจพบปัญหา";
  }

  let statusText = "";
  statusText += result.isDisbursementForm
    ? "✅ ตรวจพบแบบยืนยันการเบิกเงินกู้ยืม\n"
    : "❌ ไม่พบแบบยืนยันการเบิกเงินกู้ยืม\n";

  if (result.loanType && result.loanType !== "ไม่ทราบ") {
    statusText += `💰 ประเภทเงินกู้: ${result.loanType}\n`;
  }

  statusText += result.hasOfficialSeal
    ? "✅ ตรวจพบตราประทับหน่วยงาน\n"
    : "❌ ไม่พบตราประทับหน่วยงาน\n";
  statusText += result.hasStudentSignature
    ? `✅ ตรวจพบลายเซ็นนักศึกษา (${result.signatureQuality})\n`
    : "❌ ไม่พบลายเซ็นนักศึกษา\n";
  statusText += result.hasSignature
    ? "✅ ตรวจพบลายเซ็นเจ้าหน้าที่\n"
    : "❌ ไม่พบลายเซ็นเจ้าหน้าที่\n";

  statusText += `\n🎯 ความเชื่อมั่น: ${result.confidence}%`;
  statusText += `\nประเภทเอกสาร: ${result.documentType}`;

  if (result.issuingAuthority && result.issuingAuthority !== "ไม่ทราบ") {
    statusText += `\nหน่วยงานที่ออก: ${result.issuingAuthority}`;
  }

  // Term check result
  if (result.profileComparison?.termCheckResult) {
    const termCheck = result.profileComparison.termCheckResult;
    statusText += "\n\n📅 ตรวจสอบภาคเรียน/ปีการศึกษา:\n";

    if (hasTermMismatch) {
      statusText += `⛔ เอกสารเป็นของ: ภาคเรียนที่ ${
        termCheck.extractedTerm || "ไม่ระบุ"
      } ปีการศึกษา ${termCheck.extractedYear || "ไม่ระบุ"}\n`;
      statusText += `✅ ระบบเปิดรับ: ภาคเรียนที่ ${termCheck.expectedTerm} ปีการศึกษา ${termCheck.expectedYear}\n`;
      statusText += "\n❌ เอกสารนี้ไม่สามารถใช้งานได้ในช่วงเวลานี้";
    } else if (termCheck.overall) {
      statusText += `✅ เอกสารตรงกับช่วงเวลาที่เปิดรับ (ภาคเรียนที่ ${termCheck.expectedTerm} ปีการศึกษา ${termCheck.expectedYear})`;
    }
  }

  // Profile comparison
  if (result.profileComparison && !hasTermMismatch) {
    const comp = result.profileComparison;
    statusText += "\n\n👤 เปรียบเทียบกับโปรไฟล์:\n";

    if (comp.matchStatus === "full_match") {
      statusText += "✅ ข้อมูลตรงกับโปรไฟล์ทุกประการ\n";
    } else if (comp.matchStatus === "partial_match") {
      statusText += "⚠️ ข้อมูลตรงบางส่วน\n";
    } else if (comp.matchStatus === "mismatch") {
      statusText += "❌ พบข้อมูลไม่ตรงกัน:\n";
      comp.mismatches.forEach((m) => {
        if (m.severity !== "critical") {
          statusText += `  • ${m.field}\n`;
          statusText += `    เอกสาร: ${m.extracted}\n`;
          statusText += `    โปรไฟล์: ${m.profile}\n`;
        }
      });
    }

    if (comp.comparisonDetails) {
      statusText += `\nเปรียบเทียบ: ${comp.comparisonDetails.fieldsMatched}/${comp.comparisonDetails.fieldsCompared} รายการ\n`;
    }
  }

  if (result.extractedData && Object.keys(result.extractedData).length > 0) {
    statusText += "\n\n📋 ข้อมูลที่พบ:";
    if (result.extractedData.studentName)
      statusText += `\n• ชื่อ: ${result.extractedData.studentName}`;
    if (result.extractedData.studentId)
      statusText += `\n• รหัส: ${result.extractedData.studentId}`;
    if (result.extractedData.disbursementAmount)
      statusText += `\n• จำนวนเงิน: ${result.extractedData.disbursementAmount}`;
    if (result.extractedData.academic_year)
      statusText += `\n• ปีการศึกษา: ${result.extractedData.academic_year}`;
    if (result.extractedData.semester)
      statusText += `\n• ภาคการศึกษา: ${result.extractedData.semester}`;
  }

  if (result.qualityIssues?.length > 0) {
    statusText += "\n\n⚠️ ปัญหา:\n• " + result.qualityIssues.join("\n• ");
  }

  if (result.recommendations?.length > 0) {
    statusText += "\n\n💡 คำแนะนำ:\n• " + result.recommendations.join("\n• ");
  }

  message = statusText;

  const isValid =
    result.overall_status === "valid" &&
    result.isDisbursementForm &&
    !hasTermMismatch &&
    !profileMismatch;

  const buttons = [
    {
      text: "ลองใหม่",
      style: "cancel",
      onPress: onReject,
    },
  ];

  if (hasTermMismatch) {
    // Only show OK button for term mismatch - cannot use this document
    buttons.push({
      text: "ตกลง",
      style: "default",
      onPress: onReject,
    });
  } else if (profileMismatch) {
    buttons.push({
      text: "ตกลง",
      style: "default",
      onPress: onReject,
    });
  } else if (isValid || result.overall_status === "needs_review") {
    buttons.push({
      text:
        result.overall_status === "valid"
          ? "ใช้ไฟล์นี้"
          : "ใช้ไฟล์นี้ (ต้องตรวจสอบ)",
      onPress: () => onAccept(result),
    });
  }

  Alert.alert(title, message, buttons);
};

// Format data for database
export const formatDisbursementFormDataForDB = (
  result,
  documentType,
  fileName
) => {
  return {
    documentType: documentType,
    fileName: fileName,

    basicInfo: {
      isValid: result.isValid || false,
      confidence: result.confidence || 0,
      overall_status: result.overall_status || "unknown",
      documentType: result.documentType || "unknown",
      loanType: result.loanType || "unknown",
      issuingAuthority: result.issuingAuthority || "unknown",
    },

    signatureInfo: {
      hasOfficialSeal: result.hasOfficialSeal || false,
      hasSignature: result.hasSignature || false,
      hasStudentSignature: result.hasStudentSignature || false,
      signatureQuality: result.signatureQuality || "missing",
    },

    extractedData: {
      studentName: result.extractedData?.studentName || null,
      studentId: result.extractedData?.studentId || null,
      idNumber: result.extractedData?.idNumber || null,
      loanAmount: result.extractedData?.loanAmount || null,
      disbursementAmount: result.extractedData?.disbursementAmount || null,
      academic_year: result.extractedData?.academic_year || null,
      semester: result.extractedData?.semester || null,
      university: result.extractedData?.university || null,
      faculty: result.extractedData?.faculty || null,
      program: result.extractedData?.program || null,
      disbursementDate: result.extractedData?.disbursementDate || null,
      issueDate: result.extractedData?.issueDate || null,
      bankAccount: result.extractedData?.bankAccount || null,
      bankName: result.extractedData?.bankName || null,
      officerName: result.extractedData?.officerName || null,
      officerPosition: result.extractedData?.officerPosition || null,
      referenceNumber: result.extractedData?.referenceNumber || null,
    },

    loanDetails: result.loanDetails || {},
    documentQuality: result.documentQuality || {},
    validityChecks: result.validityChecks || {},

    profileComparison: result.profileComparison
      ? {
          matchStatus: result.profileComparison.matchStatus,
          matches: result.profileComparison.matches,
          mismatches: result.profileComparison.mismatches,
          warnings: result.profileComparison.warnings,
          comparisonDetails: result.profileComparison.comparisonDetails,
          termCheckResult: result.profileComparison.termCheckResult || null,
        }
      : null,

    qualityIssues: result.qualityIssues || [],
    recommendations: result.recommendations || [],

    metadata: {
      validatedAt: new Date().toISOString(),
      aiModel: "gemini-2.0-flash",
      profileCheckEnabled: !!result.profileComparison,
      termCheckEnabled: !!result.profileComparison?.termCheckResult,
    },
  };
};

// Check requirements
export const checkDisbursementFormRequirements = (result) => {
  if (!result) return { passed: false, issues: ["ไม่มีข้อมูลผลการตรวจสอบ"] };

  const issues = [];

  if (!result.isDisbursementForm)
    issues.push("ไม่ใช่แบบยืนยันการเบิกเงินกู้ยืม");
  if (!result.hasOfficialSeal) issues.push("ไม่พบตราประทับหน่วยงาน");
  if (!result.hasStudentSignature) issues.push("ไม่พบลายเซ็นนักศึกษา");
  if (!result.hasSignature) issues.push("ไม่พบลายเซ็นเจ้าหน้าที่");

  if (result.validityChecks) {
    if (!result.validityChecks.hasValidDates) issues.push("วันที่ไม่ถูกต้อง");
    if (!result.validityChecks.hasRequiredFields)
      issues.push("ข้อมูลไม่ครบถ้วน");
    if (!result.validityChecks.hasValidAmount)
      issues.push("จำนวนเงินไม่ถูกต้อง");
    if (!result.validityChecks.isOfficialDocument)
      issues.push("ไม่ใช่เอกสารราชการ");
  }

  // Check for term/period mismatch
  const hasTermMismatch =
    result.profileComparison?.matchStatus === "term_mismatch";

  if (hasTermMismatch) {
    const termMismatch = result.profileComparison.mismatches.find(
      (m) => m.severity === "critical"
    );
    if (termMismatch) {
      issues.push(`⛔ ${termMismatch.reason}`);
    } else {
      issues.push(
        "⛔ เอกสารไม่ตรงกับช่วงเวลาที่เปิดรับ (ส่งได้เฉพาะเทอมที่กำหนด)"
      );
    }
  } else if (result.profileComparison?.matchStatus === "mismatch") {
    issues.push("ข้อมูลไม่ตรงกับโปรไฟล์");
  }

  return {
    passed: issues.length === 0,
    issues: issues,
    requirements: {
      isDisbursementForm: result.isDisbursementForm,
      hasOfficialSeal: result.hasOfficialSeal,
      hasSignatures: result.hasStudentSignature && result.hasSignature,
      validDocument: result.validityChecks?.isOfficialDocument,
      profileMatches: result.profileComparison?.matchStatus !== "mismatch",
      correctTerm: !hasTermMismatch,
    },
  };
};

// Generate summary
export const generateDisbursementFormSummary = (result) => {
  if (!result) return "ไม่มีข้อมูลผลการตรวจสอบ";

  const requirements = checkDisbursementFormRequirements(result);
  const hasTermMismatch =
    result.profileComparison?.matchStatus === "term_mismatch";

  let summary = `📋 สรุปผลการตรวจสอบแบบยืนยันการเบิกเงินกู้ยืม\n\n`;
  summary += `สถานะ: ${
    result.overall_status === "valid"
      ? "✅ ผ่าน"
      : result.overall_status === "needs_review"
      ? "⚠️ ต้องตรวจสอบ"
      : "❌ ไม่ผ่าน"
  }\n`;
  summary += `ประเภทเงินกู้: ${result.loanType}\n`;
  summary += `ความเชื่อมั่น: ${result.confidence}%\n\n`;

  summary += `✅ ข้อกำหนด:\n`;
  summary += `${
    requirements.requirements.isDisbursementForm ? "✅" : "❌"
  } เป็นแบบยืนยันการเบิกเงินกู้ยืม\n`;
  summary += `${
    requirements.requirements.hasOfficialSeal ? "✅" : "❌"
  } มีตราประทับหน่วยงาน\n`;
  summary += `${
    requirements.requirements.hasSignatures ? "✅" : "❌"
  } มีลายเซ็นครบถ้วน\n`;
  summary += `${
    requirements.requirements.validDocument ? "✅" : "❌"
  } เป็นเอกสารราชการ\n`;
  summary += `${
    requirements.requirements.profileMatches ? "✅" : "❌"
  } ข้อมูลตรงกับโปรไฟล์\n`;
  summary += `${
    requirements.requirements.correctTerm ? "✅" : "❌"
  } ตรงกับช่วงเวลาที่เปิดรับ\n`;

  if (result.extractedData && Object.keys(result.extractedData).length > 0) {
    summary += `\n📋 ข้อมูลในเอกสาร:\n`;
    if (result.extractedData.studentName)
      summary += `• ชื่อ: ${result.extractedData.studentName}\n`;
    if (result.extractedData.studentId)
      summary += `• รหัส: ${result.extractedData.studentId}\n`;
    if (result.extractedData.disbursementAmount)
      summary += `• จำนวนเงิน: ${result.extractedData.disbursementAmount}\n`;
    if (result.extractedData.academic_year)
      summary += `• ปีการศึกษา: ${result.extractedData.academic_year}\n`;
    if (result.extractedData.semester)
      summary += `• ภาคการศึกษา: ${result.extractedData.semester}\n`;
  }

  if (result.profileComparison?.termCheckResult) {
    const termCheck = result.profileComparison.termCheckResult;
    summary += `\n📅 ตรวจสอบภาคเรียน/ปีการศึกษา:\n`;
    if (hasTermMismatch) {
      summary += `⛔ เอกสาร: ภาคเรียนที่ ${
        termCheck.extractedTerm || "ไม่ระบุ"
      } ปีการศึกษา ${termCheck.extractedYear || "ไม่ระบุ"}\n`;
      summary += `✅ ระบบเปิดรับ: ภาคเรียนที่ ${termCheck.expectedTerm} ปีการศึกษา ${termCheck.expectedYear}\n`;
    } else if (termCheck.overall) {
      summary += `✅ ตรงกับช่วงเวลาที่เปิดรับ (ภาคเรียนที่ ${termCheck.expectedTerm} ปีการศึกษา ${termCheck.expectedYear})\n`;
    }
  }

  if (result.profileComparison && !hasTermMismatch) {
    summary += `\n👤 เปรียบเทียบกับโปรไฟล์:\n`;
    const comp = result.profileComparison;
    if (comp.matchStatus === "full_match") {
      summary += `✅ ข้อมูลตรงกับโปรไฟล์ทุกประการ\n`;
    } else if (comp.matchStatus === "mismatch") {
      summary += `❌ พบข้อมูลไม่ตรงกัน:\n`;
      comp.mismatches.forEach((m) => {
        if (m.severity !== "critical") {
          summary += `  • ${m.field}: เอกสาร="${m.extracted}" โปรไฟล์="${m.profile}"\n`;
        }
      });
    }
  }

  if (!requirements.passed) {
    summary += `\n⚠️ ปัญหาที่พบ:\n`;
    requirements.issues.forEach((issue) => {
      summary += `• ${issue}\n`;
    });
  }

  return summary;
};

// Validate multiple forms
export const validateMultipleDisbursementForms = async (
  files,
  includeProfileCheck = true,
  includeTermCheck = true
) => {
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await validateDisbursementForm(
        file.uri,
        file.mimeType,
        includeProfileCheck,
        includeTermCheck
      );
      const hasTermMismatch =
        result.profileComparison?.matchStatus === "term_mismatch";
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        validation: result,
        success: true,
        profileMatch: result.profileComparison?.matchStatus !== "mismatch",
        termMatch: !hasTermMismatch,
      });
    } catch (error) {
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        error: error.message,
        success: false,
        profileMatch: false,
        termMatch: false,
      });
    }
  }

  return results;
};

// Check AI status
export const checkDisbursementFormAIStatus = async () => {
  try {
    console.log("🤖 Checking DisbursementForm AI backend status...");

    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
      return {
        available: false,
        error: "API key not configured",
      };
    }

    const initialized = initializeGemini();
    if (!initialized) {
      return {
        available: false,
        error: "Failed to initialize AI",
      };
    }

    try {
      const testResult = await model.generateContent(
        "Test connection - respond with OK"
      );
      const testResponse = await testResult.response;
      testResponse.text();

      return {
        available: true,
        method: "client",
        profileCheckEnabled: true,
        termCheckEnabled: true,
        config: {
          apiKey: "***configured***",
          model: "gemini-2.0-flash",
        },
      };
    } catch (testError) {
      return {
        available: false,
        error: testError.message,
      };
    }
  } catch (error) {
    return {
      available: false,
      error: error.message,
    };
  }
};
