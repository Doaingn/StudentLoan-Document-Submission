// documents_ai/SalaryCertAI.js - AI validation for Salary Certificate documents
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from "expo-file-system/legacy";
import { Alert } from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../../database/firebase";

// Configuration
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const AI_BACKEND_URL =
  process.env.EXPO_PUBLIC_AI_BACKEND_URL || "http://192.168.1.102:3001";
const USE_BACKEND_SERVER = process.env.EXPO_PUBLIC_USE_AI_BACKEND === "true";

// Salary validation constants
const MAX_SALARY_LIMIT = 30000; // เงินเดือนต้องไม่เกิน 30,000 บาท
const MAX_DOCUMENT_AGE_DAYS = 90; // เอกสารอายุไม่เกิน 3 เดือน

let genAI = null;
let model = null;

console.log("🔧 SalaryCertAI Configuration:");
console.log("- Backend URL:", AI_BACKEND_URL);
console.log("- Use Backend:", USE_BACKEND_SERVER);
console.log("- API Key configured:", !!GEMINI_API_KEY);
console.log("- Max Salary Limit:", MAX_SALARY_LIMIT);
console.log("- Max Document Age:", MAX_DOCUMENT_AGE_DAYS, "days");

// Initialize Gemini AI for client-side processing
const initializeGemini = () => {
  if (!genAI && GEMINI_API_KEY) {
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      console.log("✓ Gemini AI initialized successfully for SalaryCert");
      return true;
    } catch (error) {
      console.error("Failed to initialize Gemini AI for SalaryCert:", error);
      return false;
    }
  }
  return !!genAI;
};

// *** เพิ่ม: ฟังก์ชันดึงข้อมูลโปรไฟล์ผู้ใช้ ***
const fetchUserProfileData = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn("⚠️ No authenticated user found");
      return null;
    }

    console.log("🔥 Fetching user profile data from Firebase...");
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (!userDoc.exists()) {
      console.warn("⚠️ User document not found");
      return null;
    }

    const userData = userDoc.data();
    console.log("✅ User profile data fetched successfully");

    // ตรวจสอบว่าผู้ใช้อยู่กับบิดามารดาหรือไม่
    const livesWithParents = userData.livesWithParents !== false;

    // สร้างข้อมูลผู้ปกครองเฉพาะกรณีที่ไม่ได้อยู่กับบิดามารดา
    const guardianData = livesWithParents
      ? null
      : {
          name: userData.guardian_info?.name || null,
          citizen_id: userData.guardian_info?.citizen_id || null,
          monthlyIncome: userData.guardian_info?.income || null,
          annualIncome: (userData.guardian_info?.income || 0) * 12,
          occupation: userData.guardian_info?.occupation || null,
        };

    return {
      student: {
        name: userData.name || null,
        studentId: userData.studentId || null,
        citizen_id: userData.citizen_id || null,
      },
      father: {
        name: userData.father_info?.name || null,
        citizen_id: userData.father_info?.citizen_id || null,
        monthlyIncome: userData.father_info?.income || null,
        annualIncome: (userData.father_info?.income || 0) * 12,
        occupation: userData.father_info?.occupation || null,
      },
      mother: {
        name: userData.mother_info?.name || null,
        citizen_id: userData.mother_info?.citizen_id || null,
        monthlyIncome: userData.mother_info?.income || null,
        annualIncome: (userData.mother_info?.income || 0) * 12,
        occupation: userData.mother_info?.occupation || null,
      },
      guardian: guardianData,
      livesWithParents,
    };
  } catch (error) {
    console.error("✗ Error fetching user profile data:", error);
    return null;
  }
};

// *** เพิ่ม: ฟังก์ชันเปรียบเทียบข้อมูลกับโปรไฟล์ผู้ใช้ ***
const compareSalaryCertWithUserData = (
  extractedData,
  profileData,
  certType
) => {
  if (!profileData || !extractedData) {
    return {
      matchStatus: "no_profile_data",
      matches: {},
      mismatches: [],
      warnings: ["ไม่มีข้อมูลโปรไฟล์สำหรับเปรียบเทียบ"],
    };
  }

  const normalizeText = (text) => {
    if (!text) return "";
    return text
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^\u0E00-\u0E7Fa-z0-9\s]/g, "");
  };

  const parseNumber = (value) => {
    if (!value) return 0;
    const str = value.toString().replace(/[^\d]/g, "");
    return parseInt(str, 10) || 0;
  };

  // กำหนดข้อมูลโปรไฟล์ที่ต้องเปรียบเทียบตามประเภทเอกสาร
  let profileSection = null;
  let personLabel = "";

  if (certType === "father" || certType === "father_income") {
    profileSection = profileData.father;
    personLabel = "บิดา";
  } else if (certType === "mother" || certType === "mother_income") {
    profileSection = profileData.mother;
    personLabel = "มารดา";
  } else if (certType === "guardian" || certType === "guardian_income") {
    profileSection = profileData.guardian;
    personLabel = "ผู้ปกครอง";
  } else if (
    certType === "single_parent" ||
    certType === "single_parent_income"
  ) {
    // สำหรับ single_parent ให้ AI ช่วยระบุว่าเป็นบิดาหรือมารดา
    const matchedProfileType = extractedData.matchedProfile;
    if (matchedProfileType === "father") {
      profileSection = profileData.father;
      personLabel = "บิดา (ผู้ปกครองเดี่ยว)";
    } else if (matchedProfileType === "mother") {
      profileSection = profileData.mother;
      personLabel = "มารดา (ผู้ปกครองเดี่ยว)";
    } else {
      // ถ้า AI ระบุไม่ได้ ให้ลองจับคู่ชื่อด้วยตนเอง
      const extractedName = normalizeText(extractedData.employeeName || "");
      const fatherName = normalizeText(profileData.father?.name || "");
      const motherName = normalizeText(profileData.mother?.name || "");

      if (
        fatherName &&
        (extractedName.includes(fatherName) ||
          fatherName.includes(extractedName))
      ) {
        profileSection = profileData.father;
        personLabel = "บิดา (ผู้ปกครองเดี่ยว)";
      } else if (
        motherName &&
        (extractedName.includes(motherName) ||
          motherName.includes(extractedName))
      ) {
        profileSection = profileData.mother;
        personLabel = "มารดา (ผู้ปกครองเดี่ยว)";
      } else {
        return {
          matchStatus: "no_match",
          matches: {},
          mismatches: [],
          warnings: ["ไม่สามารถระบุว่าเอกสารนี้เป็นของบิดาหรือมารดาได้"],
        };
      }
    }
  }

  if (!profileSection || !profileSection.name) {
    return {
      matchStatus: "no_profile_data",
      matches: {},
      mismatches: [],
      warnings: [`ไม่มีข้อมูล${personLabel}ในโปรไฟล์สำหรับเปรียบเทียบ`],
    };
  }

  return compareSinglePersonData(
    extractedData,
    profileSection,
    personLabel,
    normalizeText,
    parseNumber
  );
};

// *** เพิ่ม: ฟังก์ชันเปรียบเทียบข้อมูลบุคคลเดี่ยว ***
const compareSinglePersonData = (
  extractedData,
  profileSection,
  personLabel,
  normalizeText,
  parseNumber
) => {
  const matches = {};
  const mismatches = [];
  const warnings = [];
  const fieldMapping = [
    {
      formKey: "employeeName",
      profileKey: "name",
      label: `ชื่อ-นามสกุล ${personLabel}`,
      normalize: true,
      required: true,
    },
    {
      formKey: "occupation",
      profileKey: "occupation",
      label: `อาชีพ ${personLabel}`,
      normalize: true,
      required: false,
      flexibleMatch: true,
    },
  ];

  fieldMapping.forEach(
    ({ formKey, profileKey, label, normalize, required, flexibleMatch }) => {
      const formValue = extractedData[formKey];
      const profileValue = profileSection[profileKey];

      if (!formValue || formValue === "" || formValue === "-") {
        if (profileValue && required) {
          mismatches.push({
            field: formKey,
            label,
            extracted: "ไม่มีข้อมูล",
            profile: profileValue,
            severity: required ? "high" : "low",
          });
        }
        return;
      }

      if (!profileValue || profileValue === "") {
        if (required)
          warnings.push(`ไม่มีข้อมูล ${label} ในโปรไฟล์เพื่อเปรียบเทียบ`);
        return;
      }

      let isMatch = false;

      if (normalize) {
        const normalizedForm = normalizeText(formValue);
        const normalizedProfile = normalizeText(profileValue);

        if (flexibleMatch) {
          // การเปรียบเทียบอาชีพแบบยืดหยุ่น
          const flexibleOccupationMatch = (form, profile) => {
            if (form === profile) return true;
            if (form.includes(profile) || profile.includes(form)) return true;

            // ตรวจสอบอาชีพที่เกี่ยวข้องกัน
            const relatedOccupations = {
              อิสระ: [
                "ธุรกิจส่วนตัว",
                "เจ้าของกิจการ",
                "ค้าขาย",
                "รับจ้าง",
                "อาชีพอิสระ",
              ],
              ธุรกิจส่วนตัว: [
                "อิสระ",
                "เจ้าของกิจการ",
                "ค้าขาย",
                "รับจ้าง",
                "อาชีพอิสระ",
              ],
              เจ้าของกิจการ: [
                "อิสระ",
                "ธุรกิจส่วนตัว",
                "ค้าขาย",
                "รับจ้าง",
                "อาชีพอิสระ",
              ],
              รับจ้าง: [
                "อิสระ",
                "ธุรกิจส่วนตัว",
                "เจ้าของกิจการ",
                "ค้าขาย",
                "อาชีพอิสระ",
              ],
              ค้าขาย: [
                "อิสระ",
                "ธุรกิจส่วนตัว",
                "เจ้าของกิจการ",
                "รับจ้าง",
                "อาชีพอิสระ",
              ],
              บริษัท: ["พนักงาน", "ลูกจ้าง", "รับจ้าง"],
              พนักงาน: ["บริษัท", "ลูกจ้าง", "รับจ้าง"],
              ลูกจ้าง: ["บริษัท", "พนักงาน", "รับจ้าง"],
              ข้าราชการ: ["รัฐวิสาหกิจ", "พนักงานรัฐวิสาหกิจ"],
              รัฐวิสาหกิจ: ["ข้าราชการ", "พนักงานรัฐวิสาหกิจ"],
              พนักงานรัฐวิสาหกิจ: ["ข้าราชการ", "รัฐวิสาหกิจ"],
              เกษตรกร: ["เกษตร", "ทำนา", "ทำไร่", "เลี้ยงสัตว์"],
              เกษตร: ["เกษตรกร", "ทำนา", "ทำไร่", "เลี้ยงสัตว์"],
              ทำนา: ["เกษตรกร", "เกษตร", "ทำไร่", "เลี้ยงสัตว์"],
              ทำไร่: ["เกษตรกร", "เกษตร", "ทำนา", "เลี้ยงสัตว์"],
              เลี้ยงสัตว์: ["เกษตรกร", "เกษตร", "ทำนา", "ทำไร่"],
            };

            for (const [key, related] of Object.entries(relatedOccupations)) {
              if (
                (form.includes(key) || profile.includes(key)) &&
                related.some(
                  (occ) => form.includes(occ) || profile.includes(occ)
                )
              ) {
                return true;
              }
            }

            return false;
          };

          if (flexibleOccupationMatch(normalizedForm, normalizedProfile)) {
            isMatch = true;
            if (normalizedForm !== normalizedProfile) {
              warnings.push(
                `${label} ใกล้เคียงกัน: เอกสาร="${formValue}" โปรไฟล์="${profileValue}"`
              );
            }
          }
        } else {
          // การเปรียบเทียบแบบปกติ
          if (normalizedForm === normalizedProfile) isMatch = true;
          else if (
            normalizedForm.includes(normalizedProfile) ||
            normalizedProfile.includes(normalizedForm)
          )
            isMatch = true;
        }
      }

      if (isMatch) matches[formKey] = true;
      else {
        matches[formKey] = false;
        mismatches.push({
          field: formKey,
          label,
          extracted: formValue,
          profile: profileValue,
          severity: required ? "medium" : "low",
        });
      }
    }
  );

  const totalFields = fieldMapping.length;
  const matchedCount = Object.values(matches).filter((v) => v === true).length;
  const mismatchedCount = mismatches.length;
  let matchStatus = "unknown";
  let matchPercentage = 0;

  if (totalFields > 0)
    matchPercentage = Math.round((matchedCount / totalFields) * 100);

  if (mismatchedCount === 0 && warnings.length === 0)
    matchStatus = "full_match";
  else if (mismatchedCount === 0 && warnings.length <= 2)
    matchStatus = "good_match";
  else if (mismatchedCount === 0) matchStatus = "partial_match";
  else if (matchPercentage >= 70) matchStatus = "good_match";
  else if (matchPercentage >= 50) matchStatus = "partial_match";
  else matchStatus = "mismatch";

  return {
    matchStatus,
    matches,
    mismatches,
    warnings,
    comparisonDetails: {
      fieldsCompared: totalFields,
      fieldsMatched: matchedCount,
      fieldsMismatched: mismatchedCount,
      personType: personLabel,
    },
    matchPercentage,
  };
};

// Check if AI backend server is available
const checkBackendServer = async () => {
  try {
    console.log(
      "🔍 Checking backend server for SalaryCert at:",
      AI_BACKEND_URL
    );

    const response = await fetch(`${AI_BACKEND_URL}/health`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    if (response.ok) {
      const data = await response.json();
      console.log(
        "✓ AI Backend Server is available for SalaryCert:",
        data.status
      );
      return true;
    } else {
      console.log("❌ Backend server responded with error:", response.status);
      return false;
    }
  } catch (error) {
    console.log(
      "❌ AI Backend Server not available for SalaryCert:",
      error.message
    );
    return false;
  }
};

// Server-side validation for Salary Certificate
const validateSalaryCertViaServer = async (
  fileUri,
  certType,
  mimeType,
  profileData
) => {
  try {
    console.log(
      `📤 Uploading to server for ${certType} salary cert validation...`
    );

    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error("File does not exist");
    }

    const formData = new FormData();
    const file = {
      uri: fileUri,
      type: mimeType || "image/jpeg",
      name: `salarycert_${certType}_${Date.now()}.${
        mimeType ? mimeType.split("/")[1] : "jpg"
      }`,
    };

    formData.append("document", file);
    if (profileData)
      formData.append("profileData", JSON.stringify(profileData));

    const response = await fetch(
      `${AI_BACKEND_URL}/ai/validate/salarycert/${certType}`,
      {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Server validation error:", errorText);
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log("✅ Server SalaryCert validation completed");

    // Apply salary validation on server result
    return applySalaryValidation(result.validation);
  } catch (error) {
    console.error("❌ Server SalaryCert validation error:", error);
    throw error;
  }
};

// Convert file to format suitable for Gemini (client-side)
const prepareFileForGemini = async (fileUri, mimeType) => {
  try {
    console.log("📁 Preparing SalaryCert file for Gemini AI...");

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

    console.log("✅ SalaryCert file prepared for Gemini");
    return {
      inlineData: {
        data: base64Data,
        mimeType: actualMimeType,
      },
    };
  } catch (error) {
    console.error("❌ Error preparing SalaryCert file for Gemini:", error);
    throw new Error(
      `ไม่สามารถเตรียมไฟล์สำหรับการวิเคราะห์ได้: ${error.message}`
    );
  }
};

// Extract numeric value from salary string
const extractSalaryAmount = (salaryText) => {
  if (!salaryText) return null;

  // Remove commas and extract numbers
  const numericText = salaryText.toString().replace(/[,\s]/g, "");
  const matches = numericText.match(/[\d,]+\.?\d*/);

  if (matches && matches[0]) {
    const amount = parseFloat(matches[0].replace(/,/g, ""));
    return isNaN(amount) ? null : amount;
  }

  return null;
};

// Check if document is within 3 months
const checkDocumentAge = (issueDate) => {
  if (!issueDate) return { isValid: null, ageInDays: null, issueDate: null };

  try {
    // แปลงวันที่จากรูปแบบต่างๆ ที่อาจพบในเอกสาร
    let parsedDate;
    let rawDate = issueDate;

    // ฟังก์ชันแปลง พ.ศ. เป็น ค.ศ.
    const convertBuddhistToChristian = (buddhistYear) => {
      return buddhistYear - 543;
    };

    // ลองแปลงจากรูปแบบมาตรฐาน ค.ศ. (YYYY-MM-DD)
    parsedDate = new Date(issueDate);

    // ถ้าไม่สำเร็จ ลองตรวจสอบว่าเป็น พ.ศ. หรือไม่
    if (isNaN(parsedDate.getTime())) {
      // รูปแบบ พ.ศ. (YYYY-MM-DD) โดยที่ YYYY > 2500
      const buddhistPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
      const buddhistMatch = issueDate.match(buddhistPattern);

      if (buddhistMatch) {
        const year = parseInt(buddhistMatch[1]);
        const month = parseInt(buddhistMatch[2]) - 1; // เดือนใน JavaScript เริ่มจาก 0
        const day = parseInt(buddhistMatch[3]);

        // ถ้าปีมากกว่า 2500 ให้ถือว่าเป็น พ.ศ.
        if (year > 2500) {
          const christianYear = convertBuddhistToChristian(year);
          parsedDate = new Date(christianYear, month, day);
          console.log(`🔄 แปลง พ.ศ. ${year} เป็น ค.ศ. ${christianYear}`);
        }
      }
    }

    // ถ้าไม่สำเร็จ ลองแปลงจากรูปแบบไทย (DD/MM/YYYY)
    if (isNaN(parsedDate.getTime())) {
      const thaiPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
      const thaiMatch = issueDate.match(thaiPattern);

      if (thaiMatch) {
        const day = parseInt(thaiMatch[1]);
        const month = parseInt(thaiMatch[2]) - 1;
        const year = parseInt(thaiMatch[3]);

        // ถ้าปีมากกว่า 2500 ให้ถือว่าเป็น พ.ศ.
        if (year > 2500) {
          const christianYear = convertBuddhistToChristian(year);
          parsedDate = new Date(christianYear, month, day);
          console.log(
            `🔄 แปลง พ.ศ. ${year} เป็น ค.ศ. ${christianYear} (รูปแบบไทย)`
          );
        } else {
          parsedDate = new Date(year, month, day);
        }
      }
    }

    // ถ้าไม่สำเร็จ ลองแปลงจากรูปแบบอื่น
    if (isNaN(parsedDate.getTime())) {
      // ลองหา pattern วันที่ในข้อความ
      const datePatterns = [
        /\d{1,2}\/\d{1,2}\/\d{4}/, // DD/MM/YYYY
        /\d{4}-\d{1,2}-\d{1,2}/, // YYYY-MM-DD
        /\d{1,2}\s+[ก-ฮ]+\s+\d{4}/, // DD Month YYYY (ไทย)
      ];

      for (const pattern of datePatterns) {
        const match = issueDate.match(pattern);
        if (match) {
          const dateStr = match[0];

          // ตรวจสอบว่าเป็น พ.ศ. หรือไม่ (ปีมากกว่า 2500)
          const yearMatch = dateStr.match(/\d{4}/);
          if (yearMatch) {
            const year = parseInt(yearMatch[0]);
            if (year > 2500) {
              // แปลง พ.ศ. เป็น ค.ศ.
              const christianYear = convertBuddhistToChristian(year);
              const convertedDateStr = dateStr.replace(
                yearMatch[0],
                christianYear.toString()
              );
              parsedDate = new Date(convertedDateStr);
              console.log(
                `🔄 แปลง พ.ศ. ${year} เป็น ค.ศ. ${christianYear} (รูปแบบอื่น)`
              );
            } else {
              parsedDate = new Date(dateStr);
            }
          } else {
            parsedDate = new Date(dateStr);
          }

          if (!isNaN(parsedDate.getTime())) break;
        }
      }
    }

    if (isNaN(parsedDate.getTime())) {
      console.warn("⚠️ ไม่สามารถแปลงวันที่ได้:", issueDate);
      return {
        isValid: null,
        ageInDays: null,
        issueDate: issueDate,
        rawDate: rawDate,
      };
    }

    const now = new Date();
    const ageInDays = Math.floor((now - parsedDate) / (1000 * 60 * 60 * 24));
    const isValid = ageInDays <= MAX_DOCUMENT_AGE_DAYS && ageInDays >= 0;

    console.log(
      `📅 ตรวจสอบอายุเอกสาร: ${
        parsedDate.toISOString().split("T")[0]
      } (${ageInDays} วัน)`
    );

    return {
      isValid,
      ageInDays,
      issueDate: parsedDate.toISOString().split("T")[0],
      rawDate: rawDate,
      convertedFromBuddhist: rawDate !== parsedDate.toISOString().split("T")[0],
    };
  } catch (error) {
    console.error("❌ Error checking document age:", error);
    return {
      isValid: null,
      ageInDays: null,
      issueDate: issueDate,
      rawDate: issueDate,
    };
  }
};

const getSalaryCertPrompt = (certType, certTypeText, profileInfo) => {
  return `
ตรวจสอบเอกสารนี้ว่าเป็นหนังสือรับรองเงินเดือนของ${
    certTypeText[certType] || "บุคคล"
  } หรือไม่

${profileInfo}

**ข้อกำหนดสำคัญ:**
1. ต้องเป็นสลิปเงินเดือนหรือหนังสือรับรองเงินเดือนจากหน่วยงาน
2. ต้องมีผู้มีอำนาจของหน่วยงานลงนาม
3. ต้องมีชื่อบริษัทหรือองค์กรที่ทำงาน
4. เงินเดือนต้องไม่เกิน 30,000 บาท
5. **เอกสารต้องมีอายุไม่เกิน 3 เดือน (${MAX_DOCUMENT_AGE_DAYS} วัน) - สำคัญมาก**
6. **ไม่บังคับต้องมีตราประทับหรือตราครุฑ**

${
  certType === "single_parent" || certType === "single_parent_income"
    ? `**คำสั่งพิเศษสำหรับเอกสารผู้ปกครองเดี่ยว:**
- ระบุว่าเอกสารนี้เป็นของ "บิดา" หรือ "มารดา" โดยดูจากชื่อที่ปรากฏ
- ใช้ข้อมูลจากโปรไฟล์ที่ให้ไว้ข้างต้นเพื่อช่วยระบุตัวตน
- ส่งคืนค่า "matchedProfile" เป็น "father" หรือ "mother" หรือ "unknown"`
    : ""
}

**คำสั่งพิเศษสำหรับการสกัดวันที่ออกเอกสาร:**
- ให้ค้นหาและสกัด "วันที่ออกเอกสาร" จากทุกส่วนของเอกสาร
- วันที่อาจอยู่ในรูปแบบ: DD/MM/YYYY, YYYY-MM-DD, หรือรูปแบบข้อความ
- หากพบหลายวันที่ ให้เลือกวันที่ที่ใกล้เคียงกับปัจจุบันมากที่สุด
- **สำคัญ: ต้องสกัดวันที่ออกเอกสารให้ได้ ไม่ใช่วันที่อื่น**

กรุณาตรวจสอบและตอบในรูปแบบ JSON ดังนี้:
{
  "isSalaryCert": true/false,
  "certType": "${certType}",
  ${
    certType === "single_parent" || certType === "single_parent_income"
      ? '"matchedProfile": "father/mother/unknown",'
      : ""
  }
  "confidence": 0-100,
  "documentType": "หนังสือรับรองเงินเดือน/ใบเงินเดือน/สลิปเงินเดือน/อื่นๆ",
  "employmentType": "ข้าราชการ/พนักงานรัฐวิสาหกิจ/พนักงานเอกชน/ลูกจ้างชั่วคราว/อื่นๆ",
  "hasOfficialSeal": true/false,
  "hasSignature": true/false,
  "signatureQuality": "clear/unclear/missing",
  "hasAuthorizedSignature": true/false,
  "hasCompanyName": true/false,
  "authorizedSignerName": "ชื่อผู้มีอำนาจลงนาม",
  "authorizedSignerPosition": "ตำแหน่งผู้มีอำนาจลงนาม",
  "issuingAuthority": "หน่วยงาน/บริษัทที่ออกเอกสาร",
  "extractedData": {
    "employeeName": "ชื่อ-นามสกุลพนักงาน",
    "employeeId": "รหัสพนักงาน",
    "idNumber": "เลขบัตรประชาชน",
    "position": "ตำแหน่ง",
    "department": "แผนก/หน่วยงาน",
    "employmentDate": "วันที่เริ่มงาน",
    "payPeriod": "งวดเงินเดือน",
    "issueDate": "วันที่ออกเอกสาร (สำคัญมาก - ต้องสกัดให้ได้)",
    "hrOfficerName": "ชื่อเจ้าหน้าที่ HR",
    "hrOfficerPosition": "ตำแหน่งเจ้าหน้าที่ HR"
  },
  "salaryDetails": {
    "baseSalary": "เงินเดือนพื้นฐาน (ตัวเลข)",
    "allowances": "เบี้ยเลี้ยง/ค่าครองชีพ (ตัวเลข)",
    "overtimePay": "ค่าล่วงเวลา (ตัวเลข)",
    "bonus": "โบนัส/เงินรางวัล (ตัวเลข)",
    "deductions": "รายการหัก (ตัวเลข)",
    "socialSecurity": "ประกันสังคม (ตัวเลข)",
    "tax": "ภาษีหัก ณ ที่จ่าย (ตัวเลข)",
    "netSalary": "เงินเดือนสุทธิ (ตัวเลข)",
    "totalIncome": "รายได้รวม (ตัวเลข)"
  },
  "documentQuality": {
    "isComplete": true/false,
    "isLegible": true/false,
    "hasWatermark": true/false,
    "imageQuality": "clear/blurry/poor/excellent"
  },
  "validityChecks": {
    "hasValidPeriod": true/false,
    "isCurrentMonth": true/false,
    "hasConsistentData": true/false,
    "salaryWithinLimit": true/false,
    "hasAuthorizedSigner": true/false,
    "hasCompanyName": true/false,
    "documentWithinAge": true/false
  },
  "qualityIssues": ["ปัญหาที่พบ"],
  "recommendations": ["คำแนะนำ"],
  "overall_status": "valid/invalid/needs_review"
}

**สำคัญ:** 
- ให้สกัดตัวเลขเงินเดือนออกมาให้ชัดเจน (เฉพาะตัวเลข ไม่ต้องมีสัญลักษณ์)
- ตรวจสอบว่าเงินเดือนไม่เกิน 30,000 บาท
- ตรวจสอบการมีลายเซ็นผู้มีอำนาจ
- ตรวจสอบว่ามีชื่อบริษัทหรือองค์กร
- **ต้องสกัดวันที่ออกเอกสารให้ได้เพื่อตรวจสอบอายุ**
- ระบุปัญหาและข้อเสนอแนะอย่างชัดเจน
- **ไม่บังคับต้องมีตราประทับหรือตราครุฑ**
`;
};

// Apply salary validation rules
const applySalaryValidation = (result) => {
  if (!result) return result;

  // Extract salary amounts for validation
  const baseSalary = extractSalaryAmount(result.salaryDetails?.baseSalary);
  const netSalary = extractSalaryAmount(result.salaryDetails?.netSalary);
  const totalIncome = extractSalaryAmount(result.salaryDetails?.totalIncome);

  // Check salary limits
  const salaryExceeded = {
    baseSalary: baseSalary && baseSalary > MAX_SALARY_LIMIT,
    netSalary: netSalary && netSalary > MAX_SALARY_LIMIT,
    totalIncome: totalIncome && totalIncome > MAX_SALARY_LIMIT,
  };

  const anySalaryExceeded = Object.values(salaryExceeded).some(
    (exceeded) => exceeded
  );

  // *** แก้ไข: ตรวจสอบอายุเอกสารจากวันที่ที่ AI สกัดได้ ***
  const documentAge = checkDocumentAge(result.extractedData?.issueDate);

  // Update quality issues and recommendations
  const updatedQualityIssues = [...(result.qualityIssues || [])];
  const updatedRecommendations = [...(result.recommendations || [])];

  if (anySalaryExceeded) {
    updatedQualityIssues.push(
      `เงินเดือนเกินกำหนด (เกิน ${MAX_SALARY_LIMIT.toLocaleString()} บาท)`
    );
    updatedRecommendations.push(
      "กรุณาใช้หนังสือรับรองเงินเดือนที่มีจำนวนไม่เกิน 30,000 บาท"
    );
  }

  if (documentAge.isValid === false) {
    updatedQualityIssues.push(
      `เอกสารอายุเกิน ${MAX_DOCUMENT_AGE_DAYS} วัน (ออกเมื่อ ${documentAge.issueDate})`
    );
    updatedRecommendations.push("กรุณาใช้เอกสารที่ออกไม่เกิน 3 เดือน");
  } else if (documentAge.isValid === null && result.extractedData?.issueDate) {
    // ถ้ามีวันที่แต่ตรวจสอบอายุไม่ได้
    updatedQualityIssues.push("ไม่สามารถตรวจสอบอายุเอกสารได้");
    updatedRecommendations.push(
      "กรุณาตรวจสอบว่าวันที่ออกเอกสารถูกต้องและไม่เกิน 3 เดือน"
    );
  } else if (!result.extractedData?.issueDate) {
    // ถ้าไม่มีวันที่ในเอกสาร
    updatedQualityIssues.push("ไม่พบวันที่ออกเอกสาร");
    updatedRecommendations.push("กรุณาใชเอกสารที่มีวันที่ออกเอกสารชัดเจน");
  }

  // Update validation checks
  const updatedValidityChecks = {
    ...result.validityChecks,
    salaryWithinLimit: !anySalaryExceeded,
    documentWithinAge: documentAge.isValid,
    hasValidSalaryAmount: baseSalary || netSalary || totalIncome ? true : false,
    hasIssueDate: !!result.extractedData?.issueDate,
    salaryAmountCheck: {
      baseSalary: baseSalary,
      netSalary: netSalary,
      totalIncome: totalIncome,
      exceedsLimit: anySalaryExceeded,
      maxLimit: MAX_SALARY_LIMIT,
    },
    documentAgeCheck: documentAge,
  };

  // *** แก้ไข: ปรับ logic การกำหนด overall_status ให้รวมการตรวจสอบอายุเอกสาร ***
  let updatedOverallStatus = result.overall_status;

  // ถ้าเอกสารไม่ใช่ salary cert ให้เป็น invalid
  if (!result.isSalaryCert) {
    updatedOverallStatus = "invalid";
  }
  // ถ้าเงินเดือนเกินหรือเอกสารอายุเกิน ให้เป็น invalid
  else if (anySalaryExceeded || documentAge.isValid === false) {
    updatedOverallStatus = "invalid";
  }
  // ถ้าขาดข้อมูลสำคัญ (ไม่มีลายเซ็นผู้มีอำนาจ, ไม่มีชื่อบริษัท) ให้เป็น needs_review
  else if (
    !result.hasAuthorizedSignature ||
    !result.hasCompanyName ||
    !result.extractedData?.issueDate
  ) {
    updatedOverallStatus = "needs_review";
  }
  // ถ้าผ่านทั้งหมดให้เป็น valid
  else if (
    result.isSalaryCert &&
    !anySalaryExceeded &&
    documentAge.isValid === true &&
    result.hasAuthorizedSignature &&
    result.hasCompanyName
  ) {
    updatedOverallStatus = "valid";
  }

  return {
    ...result,
    qualityIssues: updatedQualityIssues,
    recommendations: updatedRecommendations,
    validityChecks: updatedValidityChecks,
    overall_status: updatedOverallStatus,
    salaryValidation: {
      withinLimit: !anySalaryExceeded,
      maxLimit: MAX_SALARY_LIMIT,
      extractedAmounts: {
        baseSalary,
        netSalary,
        totalIncome,
      },
      exceedsLimit: salaryExceeded,
    },
    documentAgeValidation: documentAge,
  };
};

// *** แก้ไข: ปรับปรุงฟังก์ชันตรวจสอบฝั่งไคลเอ็นต์ให้รองรับการเปรียบเทียบโปรไฟล์ ***
const validateSalaryCertClientSide = async (
  fileUri,
  certType,
  mimeType,
  profileData
) => {
  console.log(`🤖 Starting client-side ${certType} salary cert validation...`);

  if (!model) {
    const initialized = initializeGemini();
    if (!initialized) {
      throw new Error("ระบบ AI ไม่พร้อมใช้งาน - กรุณาตรวจสอบ API Key");
    }
  }

  const filePart = await prepareFileForGemini(fileUri, mimeType);

  const certTypeText = {
    father: "บิดา",
    mother: "มารดา",
    guardian: "ผู้ปกครอง",
    single_parent: "ผู้ปกครองเดี่ยว",
    father_income: "บิดา",
    mother_income: "มารดา",
    guardian_income: "ผู้ปกครอง",
    single_parent_income: "ผู้ปกครองเดี่ยว",
  };

  let profileInfo = "";
  if (profileData) {
    if (certType === "father" || certType === "father_income") {
      profileInfo = `\n**ข้อมูลโปรไฟล์สำหรับเปรียบเทียบ (บิดา):**\n- ชื่อ-นามสกุล: ${
        profileData.father?.name || "ไม่ระบุ"
      }\n- อาชีพ: ${
        profileData.father?.occupation || "ไม่ระบุ"
      }\n\nกรุณาเปรียบเทียบข้อมูลที่สกัดได้กับข้อมูลโปรไฟล์ของบิดา\n**หมายเหตุ: ไม่ต้องตรวจสอบเลขบัตรประชาชน**`;
    } else if (certType === "mother" || certType === "mother_income") {
      profileInfo = `\n**ข้อมูลโปรไฟล์สำหรับเปรียบเทียบ (มารดา):**\n- ชื่อ-นามสกุล: ${
        profileData.mother?.name || "ไม่ระบุ"
      }\n- อาชีพ: ${
        profileData.mother?.occupation || "ไม่ระบุ"
      }\n\nกรุณาเปรียบเทียบข้อมูลที่สกัดได้กับข้อมูลโปรไฟล์ของมารดา\n**หมายเหตุ: ไม่ต้องตรวจสอบเลขบัตรประชาชน**`;
    } else if (certType === "guardian" || certType === "guardian_income") {
      profileInfo = `\n**ข้อมูลโปรไฟล์สำหรับเปรียบเทียบ (ผู้ปกครอง):**\n- ชื่อ-นามสกุล: ${
        profileData.guardian?.name || "ไม่ระบุ"
      }\n- อาชีพ: ${
        profileData.guardian?.occupation || "ไม่ระบุ"
      }\n\nกรุณาเปรียบเทียบข้อมูลที่สกัดได้กับข้อมูลโปรไฟล์ของผู้ปกครอง\n**หมายเหตุ: ไม่ต้องตรวจสอบเลขบัตรประชาชน**`;
    } else if (
      certType === "single_parent" ||
      certType === "single_parent_income"
    ) {
      profileInfo = `
**ข้อมูลโปรไฟล์สำหรับเปรียบเทียบ (ผู้ปกครองเดี่ยว):**
- ชื่อบิดา (จากโปรไฟล์): ${profileData.father?.name || "ไม่มีข้อมูล"}
- ชื่อมารดา (จากโปรไฟล์): ${profileData.mother?.name || "ไม่มีข้อมูล"}
`;
    }
  }

  const prompt = getSalaryCertPrompt(certType, certTypeText, profileInfo);

  try {
    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();

    console.log("🤖 SalaryCert AI Response received");

    // Try to parse JSON response
    let parsed;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.warn(
        "⚠️ Failed to parse SalaryCert AI response as JSON, using text analysis"
      );
      parsed = analyzeSalaryCertTextResponse(responseText, certType);
    }

    // *** แก้ไข: ตรวจสอบวันที่ก่อน apply validation ***
    console.log("📅 ข้อมูลวันที่ที่สกัดได้:", parsed.extractedData?.issueDate);

    // Apply salary and document age validation
    const validatedResult = applySalaryValidation(parsed);

    // Add profile comparison if profile data is available
    if (profileData) {
      const comparison = compareSalaryCertWithUserData(
        validatedResult.extractedData,
        profileData,
        certType
      );
      validatedResult.profileComparison = comparison;

      // Add meaningful mismatches to quality issues
      if (comparison.mismatches.length > 0) {
        validatedResult.qualityIssues = validatedResult.qualityIssues || [];
        comparison.mismatches.forEach((mismatch) => {
          const severity = mismatch.severity === "high" ? "❌" : "⚠️";
          validatedResult.qualityIssues.push(
            `${severity} ${mismatch.label}ไม่ตรงกับโปรไฟล์: เอกสาร="${mismatch.extracted}" โปรไฟล์="${mismatch.profile}"`
          );
        });

        if (comparison.mismatches.length > 0) {
          validatedResult.recommendations =
            validatedResult.recommendations || [];
          validatedResult.recommendations.push(
            "กรุณาตรวจสอบว่าข้อมูลในเอกสารตรงกับข้อมูลในโปรไฟล์"
          );
          if (validatedResult.overall_status === "valid")
            validatedResult.overall_status = "needs_review";
        }
      }

      // Add meaningful warnings
      const meaningfulWarnings = comparison.warnings.filter(
        (warning) =>
          !warning.includes("ไม่มีข้อมูล รายได้ต่อเดือน") &&
          !warning.includes("ใกล้เคียงกัน แต่ไม่ตรงทุกตัวอักษร")
      );
      if (meaningfulWarnings.length > 0) {
        validatedResult.recommendations = validatedResult.recommendations || [];
        validatedResult.recommendations.push(...meaningfulWarnings);
      }
    }

    console.log("✅ Client-side SalaryCert validation completed");
    return validatedResult;
  } catch (error) {
    console.error("❌ Client-side SalaryCert validation failed:", error);
    throw error;
  }
};

// Fallback text analysis for Salary Certificate
const analyzeSalaryCertTextResponse = (text, certType) => {
  const lowerText = text.toLowerCase();

  const isSalaryCert =
    lowerText.includes("หนังสือรับรองเงินเดือน") ||
    lowerText.includes("ใบเงินเดือน") ||
    lowerText.includes("สลิปเงินเดือน") ||
    lowerText.includes("salary certificate") ||
    lowerText.includes("payslip") ||
    lowerText.includes("เงินเดือน");

  const hasOfficialSeal =
    lowerText.includes("ตราประทับ") ||
    lowerText.includes("ตราราชการ") ||
    lowerText.includes("official seal");

  const hasSignature =
    lowerText.includes("ลายเซ็น") ||
    lowerText.includes("ลงชื่อ") ||
    lowerText.includes("signature");

  const hasCompanyName =
    lowerText.includes("บริษัท") ||
    lowerText.includes("องค์กร") ||
    lowerText.includes("company") ||
    lowerText.includes("organization");

  // Try to extract salary information from text
  const salaryMatches = text.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g);
  let extractedSalary = null;
  if (salaryMatches && salaryMatches.length > 0) {
    // Take the largest number found as potential salary
    const numbers = salaryMatches.map((match) =>
      parseFloat(match.replace(/,/g, ""))
    );
    extractedSalary = Math.max(...numbers);
  }

  const fallbackData = {
    isSalaryCert,
    certType,
    confidence: isSalaryCert ? 75 : 25,
    documentType: isSalaryCert ? "หนังสือรับรองเงินเดือน" : "ไม่ทราบ",
    employmentType: "ไม่ทราบ",
    hasOfficialSeal,
    hasSignature,
    signatureQuality: hasSignature ? "unclear" : "missing",
    hasAuthorizedSignature: false,
    hasCompanyName,
    authorizedSignerName: "ไม่ทราบ",
    authorizedSignerPosition: "ไม่ทราบ",
    issuingAuthority: "ไม่ทราบ",
    extractedData: {},
    salaryDetails: {
      baseSalary: extractedSalary ? extractedSalary.toString() : "",
      netSalary: extractedSalary ? extractedSalary.toString() : "",
      totalIncome: extractedSalary ? extractedSalary.toString() : "",
    },
    documentQuality: {
      isComplete: true,
      isLegible: true,
      hasWatermark: false,
      imageQuality: "unclear",
    },
    validityChecks: {
      hasValidPeriod: null,
      isCurrentMonth: null,
      hasConsistentData: null,
      salaryWithinLimit: extractedSalary
        ? extractedSalary <= MAX_SALARY_LIMIT
        : null,
      hasAuthorizedSigner: false,
      hasCompanyName,
      documentWithinAge: null,
    },
    qualityIssues: !isSalaryCert ? ["ไม่พบหนังสือรับรองเงินเดือน"] : [],
    recommendations: !isSalaryCert
      ? ["กรุณาอัปโหลดหนังสือรับรองเงินเดือน"]
      : [],
    overall_status:
      isSalaryCert && hasSignature && hasCompanyName ? "valid" : "needs_review",
    rawResponse: text,
  };

  // สำหรับ single_parent ให้พยายามระบุ matchedProfile
  if (certType === "single_parent" || certType === "single_parent_income") {
    if (lowerText.includes("บิดา") || lowerText.includes("father")) {
      fallbackData.matchedProfile = "father";
    } else if (lowerText.includes("มารดา") || lowerText.includes("mother")) {
      fallbackData.matchedProfile = "mother";
    } else {
      fallbackData.matchedProfile = "unknown";
    }
  }

  return fallbackData;
};

// *** แก้ไข: ฟังก์ชันหลักให้รองรับการตรวจสอบโปรไฟล์ ***
export const validateSalaryCert = async (
  fileUri,
  certType = "father",
  mimeType = null,
  includeProfileCheck = true
) => {
  try {
    console.log(`🚀 Starting ${certType} salary cert validation...`);
    console.log("File URI:", fileUri);
    console.log("MIME Type:", mimeType);
    console.log("Max Salary Limit:", MAX_SALARY_LIMIT);
    console.log("Max Document Age:", MAX_DOCUMENT_AGE_DAYS, "days");

    // Validate certType parameter
    const validCertTypes = [
      "father",
      "mother",
      "guardian",
      "single_parent",
      "father_income",
      "mother_income",
      "guardian_income",
      "single_parent_income",
    ];
    if (!validCertTypes.includes(certType)) {
      throw new Error(
        `ประเภทใบรับรองไม่ถูกต้อง: ${certType}. ต้องเป็น: ${validCertTypes.join(
          ", "
        )}`
      );
    }

    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error("ไฟล์ไม่พบ - กรุณาเลือกไฟล์ใหม่");
    }

    // Fetch profile data if needed
    let profileData = null;
    if (includeProfileCheck) {
      profileData = await fetchUserProfileData();
      if (profileData) console.log("✅ Profile data loaded for comparison");
    }

    // Try server-side validation first if enabled
    if (USE_BACKEND_SERVER) {
      try {
        const serverAvailable = await checkBackendServer();
        if (serverAvailable) {
          console.log("✅ Using server-side SalaryCert validation");
          return await validateSalaryCertViaServer(
            fileUri,
            certType,
            mimeType,
            profileData
          );
        }
      } catch (serverError) {
        console.log(
          "⚠️ Server SalaryCert validation failed, falling back to client-side:",
          serverError.message
        );
      }
    }

    // Fall back to client-side validation
    console.log("✅ Using client-side SalaryCert validation");
    return await validateSalaryCertClientSide(
      fileUri,
      certType,
      mimeType,
      profileData
    );
  } catch (error) {
    console.error("❌ SalaryCert validation error:", error);
    throw new Error(
      `การตรวจสอบหนังสือรับรองเงินเดือน ล้มเหลว: ${error.message}`
    );
  }
};

// *** แก้ไข: ปรับปรุงฟังก์ชัน parse result ให้แสดงการเปรียบเทียบโปรไฟล์ ***
export const parseSalaryCertResult = (result) => {
  if (!result) return null;

  return {
    isValid:
      result.overall_status === "valid" &&
      result.isSalaryCert &&
      result.salaryValidation?.withinLimit !== false &&
      result.validityChecks?.documentWithinAge !== false &&
      result.profileComparison?.matchStatus !== "mismatch",
    confidence: result.confidence || 0,
    status: result.overall_status || "unknown",
    certType: result.certType || "unknown",
    documentType: result.documentType || "ไม่ทราบ",
    employmentType: result.employmentType || "ไม่ทราบ",
    hasOfficialSeal: result.hasOfficialSeal || false,
    hasSignature: result.hasSignature || false,
    hasAuthorizedSignature: result.hasAuthorizedSignature || false,
    hasCompanyName: result.hasCompanyName || false,
    signatureQuality: result.signatureQuality || "missing",
    issuingAuthority: result.issuingAuthority || "ไม่ทราบ",
    authorizedSignerName: result.authorizedSignerName || "ไม่ทราบ",
    authorizedSignerPosition: result.authorizedSignerPosition || "ไม่ทราบ",
    extractedData: result.extractedData || {},
    salaryDetails: result.salaryDetails || {},
    salaryValidation: result.salaryValidation || {},
    documentAgeValidation: result.documentAgeValidation || {},
    documentQuality: result.documentQuality || {},
    validityChecks: result.validityChecks || {},
    qualityIssues: result.qualityIssues || [],
    recommendations: result.recommendations || [],
    profileComparison: result.profileComparison || null,
    rawResult: result,
  };
};

// *** แก้ไข: ปรับปรุงการแสดง Alert ให้แสดงการเปรียบเทียบโปรไฟล์ ***
export const showSalaryCertValidationAlert = (result, onAccept, onReject) => {
  let title, message;

  // Check validations
  const salaryExceedsLimit =
    result.salaryValidation && !result.salaryValidation.withinLimit;
  const documentExpired =
    result.documentAgeValidation &&
    result.documentAgeValidation.isValid === false;
  const profileMismatch = result.profileComparison?.matchStatus === "mismatch";

  if (salaryExceedsLimit) {
    title = "❌ เงินเดือนเกินกำหนด";
  } else if (documentExpired) {
    title = "❌ เอกสารหมดอายุ";
  } else if (profileMismatch) {
    title = "⚠️ ข้อมูลไม่ตรงกับโปรไฟล์";
  } else if (result.overall_status === "valid") {
    title = "✅ ตรวจสอบหนังสือรับรองเงินเดือนสำเร็จ";
  } else {
    title = "⚠️ ตรวจพบปัญหา";
  }

  let statusText = "";
  if (result.isSalaryCert) {
    statusText += "✅ ตรวจพบหนังสือรับรองเงินเดือน\n";
  } else {
    statusText += "❌ ไม่พบหนังสือรับรองเงินเดือน\n";
  }

  if (result.hasCompanyName) {
    statusText += "✅ ตรวจพบชื่อบริษัท/องค์กร\n";
  } else {
    statusText += "❌ ไม่พบชื่อบริษัท/องค์กร\n";
  }

  if (result.hasSignature) {
    statusText += `✅ ตรวจพบลายเซ็น (${result.signatureQuality})\n`;
  } else {
    statusText += "❌ ไม่พบลายเซ็น\n";
  }

  if (result.hasAuthorizedSignature) {
    statusText += "✅ มีลายเซ็นผู้มีอำนาจ\n";
  } else {
    statusText += "❌ ไม่มีลายเซ็นผู้มีอำนาจ\n";
  }

  // ไม่บังคับตราประทับ
  if (result.hasOfficialSeal) {
    statusText += "✅ ตรวจพบตราประทับ (มีเพิ่มเติม)\n";
  }

  // Salary validation status
  if (result.salaryValidation) {
    statusText += "\n💰 การตรวจสอบเงินเดือน:\n";
    if (result.salaryValidation.withinLimit === false) {
      statusText += `❌ เงินเดือนเกิน ${result.salaryValidation.maxLimit?.toLocaleString()} บาท\n`;
    } else if (result.salaryValidation.withinLimit === true) {
      statusText += `✅ เงินเดือนไม่เกิน ${result.salaryValidation.maxLimit?.toLocaleString()} บาท\n`;
    }

    // Show extracted salary amounts
    const amounts = result.salaryValidation.extractedAmounts;
    if (amounts) {
      if (amounts.baseSalary)
        statusText += `• เงินเดือนพื้นฐาน: ${amounts.baseSalary.toLocaleString()} บาท\n`;
      if (amounts.netSalary)
        statusText += `• เงินเดือนสุทธิ: ${amounts.netSalary.toLocaleString()} บาท\n`;
      if (amounts.totalIncome)
        statusText += `• รายได้รวม: ${amounts.totalIncome.toLocaleString()} บาท\n`;
    }
  }

  // Document age validation
  if (result.documentAgeValidation) {
    statusText += "\n📅 การตรวจสอบอายุเอกสาร:\n";
    if (result.documentAgeValidation.isValid === false) {
      statusText += `❌ เอกสารอายุ ${result.documentAgeValidation.ageInDays} วัน (เกิน ${MAX_DOCUMENT_AGE_DAYS} วัน)\n`;
      statusText += `• วันที่ออกเอกสาร: ${
        result.documentAgeValidation.issueDate ||
        result.documentAgeValidation.rawDate
      }\n`;
    } else if (result.documentAgeValidation.isValid === true) {
      statusText += `✅ เอกสารอายุ ${result.documentAgeValidation.ageInDays} วัน (ไม่เกิน ${MAX_DOCUMENT_AGE_DAYS} วัน)\n`;
      statusText += `• วันที่ออกเอกสาร: ${
        result.documentAgeValidation.issueDate ||
        result.documentAgeValidation.rawDate
      }\n`;
    } else {
      statusText += "⚠️ ไม่สามารถตรวจสอบอายุเอกสาร\n";
      if (result.documentAgeValidation.rawDate) {
        statusText += `• วันที่ที่พบ: ${result.documentAgeValidation.rawDate}\n`;
      }
    }
  }

  // Profile comparison
  if (result.profileComparison) {
    const comp = result.profileComparison;
    statusText += "\n👤 เปรียบเทียบกับโปรไฟล์:\n";
    if (comp.matchStatus === "full_match")
      statusText += "✅ ข้อมูลตรงกับโปรไฟล์ทุกประการ\n";
    else if (comp.matchStatus === "good_match")
      statusText += "✅ ข้อมูลตรงกับโปรไฟล์\n";
    else if (comp.matchStatus === "partial_match")
      statusText += "⚠️ ข้อมูลตรงบางส่วน\n";
    else if (comp.matchStatus === "mismatch")
      statusText += "❌ พบข้อมูลไม่ตรงกัน\n";

    if (comp.comparisonDetails) {
      const pct = comp.matchPercentage || 0;
      statusText += `\nเปรียบเทียบ: ${comp.comparisonDetails.fieldsMatched}/${comp.comparisonDetails.fieldsCompared} รายการ (${pct}%)\n`;
    }
  }

  statusText += `\n🎯 ความเชื่อมั่น: ${result.confidence}%`;
  statusText += `\nประเภท: ${getSalaryCertTypeName(result.certType)}`;
  statusText += `\nประเภทเอกสาร: ${result.documentType}`;

  if (result.employmentType && result.employmentType !== "ไม่ทราบ") {
    statusText += `\nประเภทการจ้าง: ${result.employmentType}`;
  }

  if (result.issuingAuthority && result.issuingAuthority !== "ไม่ทราบ") {
    statusText += `\nหน่วยงานที่ออก: ${result.issuingAuthority}`;
  }

  if (
    result.authorizedSignerName &&
    result.authorizedSignerName !== "ไม่ทราบ"
  ) {
    statusText += `\nผู้มีอำนาจลงนาม: ${result.authorizedSignerName}`;
    if (
      result.authorizedSignerPosition &&
      result.authorizedSignerPosition !== "ไม่ทราบ"
    ) {
      statusText += ` (${result.authorizedSignerPosition})`;
    }
  }

  if (result.extractedData && Object.keys(result.extractedData).length > 0) {
    statusText += "\n\n📋 ข้อมูลพนักงาน:";
    Object.entries(result.extractedData).forEach(([key, value]) => {
      if (value && key !== "idNumber") {
        const label =
          key === "employeeName"
            ? "ชื่อ-นามสกุล"
            : key === "employeeId"
            ? "รหัสพนักงาน"
            : key === "position"
            ? "ตำแหน่ง"
            : key === "department"
            ? "แผนก/หน่วยงาน"
            : key === "employmentDate"
            ? "วันที่เริ่มงาน"
            : key === "payPeriod"
            ? "งวดเงินเดือน"
            : key === "issueDate"
            ? "วันที่ออกเอกสาร"
            : key === "hrOfficerName"
            ? "ชื่อเจ้าหน้าที่ HR"
            : key === "hrOfficerPosition"
            ? "ตำแหน่งเจ้าหน้าที่ HR"
            : key;
        statusText += `\n• ${label}: ${value}`;
      }
    });
  }

  if (result.qualityIssues && result.qualityIssues.length > 0) {
    statusText += "\n\n⚠️ ปัญหาที่พบ:\n• " + result.qualityIssues.join("\n• ");
  }

  if (result.recommendations && result.recommendations.length > 0) {
    statusText += "\n\n💡 คำแนะนำ:\n• " + result.recommendations.join("\n• ");
  }

  message = statusText;

  // Determine validity based on all criteria
  const isValid =
    result.overall_status === "valid" &&
    result.isSalaryCert &&
    result.salaryValidation?.withinLimit !== false &&
    result.validityChecks?.documentWithinAge !== false &&
    !profileMismatch;

  const buttons = [
    {
      text: "ลองใหม่",
      style: "cancel",
      onPress: onReject,
    },
  ];

  // Only allow acceptance if all validations pass
  if (salaryExceedsLimit || documentExpired || profileMismatch) {
    // Don't add accept button for invalid documents
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

// Get Salary Certificate type display name
export const getSalaryCertTypeName = (certType) => {
  const certTypeNames = {
    father: "บิดา",
    mother: "มารดา",
    guardian: "ผู้ปกครอง",
    single_parent: "ผู้ปกครองเดี่ยว",
    father_income: "บิดา",
    mother_income: "มารดา",
    guardian_income: "ผู้ปกครอง",
    single_parent_income: "ผู้ปกครองเดี่ยว",
  };
  return certTypeNames[certType] || "ไม่ทราบ";
};

// Validate multiple Salary Certificates
export const validateMultipleSalaryCerts = async (
  files,
  includeProfileCheck = true
) => {
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await validateSalaryCert(
        file.uri,
        file.certType || "father",
        file.mimeType,
        includeProfileCheck
      );
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        certType: file.certType || "father",
        validation: result,
        success: true,
        salaryValid: result.salaryValidation?.withinLimit !== false,
        documentValid: result.documentAgeValidation?.isValid !== false,
        profileMatch: result.profileComparison?.matchStatus !== "mismatch",
      });
    } catch (error) {
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        certType: file.certType || "father",
        error: error.message,
        success: false,
        salaryValid: false,
        documentValid: false,
        profileMatch: false,
      });
    }
  }

  return results;
};

// Check if salary certificate meets all requirements
export const checkSalaryCertRequirements = (result) => {
  if (!result) return { passed: false, issues: ["ไม่มีข้อมูลผลการตรวจสอบ"] };

  const issues = [];

  // Check if it's a valid salary certificate
  if (!result.isSalaryCert) {
    issues.push("ไม่ใช่หนังสือรับรองเงินเดือน");
  }

  // Check company name
  if (!result.hasCompanyName) {
    issues.push("ไม่มีชื่อบริษัทหรือองค์กรที่ทำงาน");
  }

  // Check authorized signature
  if (!result.hasAuthorizedSignature) {
    issues.push("ไม่มีลายเซ็นผู้มีอำนาจของหน่วยงาน");
  }

  // Check salary limit
  if (
    result.salaryValidation &&
    result.salaryValidation.withinLimit === false
  ) {
    issues.push(
      `เงินเดือนเกิน ${result.salaryValidation.maxLimit?.toLocaleString()} บาท`
    );
  }

  // Check document age
  if (
    result.documentAgeValidation &&
    result.documentAgeValidation.isValid === false
  ) {
    issues.push(`เอกสารอายุเกิน ${MAX_DOCUMENT_AGE_DAYS} วัน`);
  }

  // Check profile match
  if (
    result.profileComparison &&
    result.profileComparison.matchStatus === "mismatch"
  ) {
    issues.push("ข้อมูลไม่ตรงกับโปรไฟล์ผู้ใช้");
  }

  return {
    passed: issues.length === 0,
    issues: issues,
    requirements: {
      isSalaryCert: result.isSalaryCert,
      hasCompanyName: result.hasCompanyName,
      hasAuthorizedSignature: result.hasAuthorizedSignature,
      salaryWithinLimit: result.salaryValidation?.withinLimit !== false,
      documentWithinAge: result.documentAgeValidation?.isValid !== false,
      profileMatch: result.profileComparison?.matchStatus !== "mismatch",
    },
  };
};

// Generate salary certificate validation summary
export const generateSalaryCertSummary = (result) => {
  if (!result) return "ไม่มีข้อมูลผลการตรวจสอบ";

  const requirements = checkSalaryCertRequirements(result);

  let summary = `📋 สรุปผลการตรวจสอบหนังสือรับรองเงินเดือน\n\n`;

  summary += `สถานะ: ${
    result.overall_status === "valid"
      ? "✅ ผ่าน"
      : result.overall_status === "needs_review"
      ? "⚠️ ต้องตรวจสอบ"
      : "❌ ไม่ผ่าน"
  }\n`;
  summary += `ประเภท: ${getSalaryCertTypeName(result.certType)}\n`;
  summary += `ความเชื่อมั่น: ${result.confidence}%\n\n`;

  // Requirements check
  summary += `✅ ข้อกำหนด:\n`;
  summary += `${
    requirements.requirements.isSalaryCert ? "✅" : "❌"
  } เป็นหนังสือรับรองเงินเดือน\n`;
  summary += `${
    requirements.requirements.hasCompanyName ? "✅" : "❌"
  } มีชื่อบริษัท/องค์กร\n`;
  summary += `${
    requirements.requirements.hasAuthorizedSignature ? "✅" : "❌"
  } มีลายเซ็นผู้มีอำนาจ\n`;
  summary += `${
    requirements.requirements.salaryWithinLimit ? "✅" : "❌"
  } เงินเดือนไม่เกิน ${MAX_SALARY_LIMIT.toLocaleString()} บาท\n`;
  summary += `${
    requirements.requirements.documentWithinAge ? "✅" : "❌"
  } เอกสารอายุไม่เกิน ${MAX_DOCUMENT_AGE_DAYS} วัน\n`;
  summary += `${
    requirements.requirements.profileMatch ? "✅" : "❌"
  } ข้อมูลตรงกับโปรไฟล์\n`;

  if (result.salaryValidation && result.salaryValidation.extractedAmounts) {
    const amounts = result.salaryValidation.extractedAmounts;
    summary += `\n💰 ข้อมูลเงินเดือน:\n`;
    if (amounts.baseSalary)
      summary += `• เงินเดือนพื้นฐาน: ${amounts.baseSalary.toLocaleString()} บาท\n`;
    if (amounts.netSalary)
      summary += `• เงินเดือนสุทธิ: ${amounts.netSalary.toLocaleString()} บาท\n`;
    if (amounts.totalIncome)
      summary += `• รายได้รวม: ${amounts.totalIncome.toLocaleString()} บาท\n`;
  }

  if (!requirements.passed) {
    summary += `\n⚠️ ปัญหาที่พบ:\n`;
    requirements.issues.forEach((issue) => {
      summary += `• ${issue}\n`;
    });
  }

  return summary;
};

// Check Salary Certificate AI backend status
export const checkSalaryCertAIStatus = async () => {
  try {
    console.log("🤖 Checking SalaryCert AI backend status...");

    // If configured to use backend server, check server first
    if (USE_BACKEND_SERVER) {
      const serverAvailable = await checkBackendServer();
      if (serverAvailable) {
        try {
          console.log("🔬 Testing SalaryCert AI connection through server...");
          const response = await fetch(`${AI_BACKEND_URL}/ai/test`);
          if (response.ok) {
            const data = await response.json();
            console.log(
              "✓ SalaryCert AI backend server is available and working"
            );
            return {
              available: true,
              method: "server",
              maxSalaryLimit: MAX_SALARY_LIMIT,
              maxDocumentAge: MAX_DOCUMENT_AGE_DAYS,
              profileCheckEnabled: true,
              config: {
                backendUrl: AI_BACKEND_URL,
                useBackend: USE_BACKEND_SERVER,
              },
            };
          }
        } catch (error) {
          console.log("❌ Server SalaryCert AI test failed:", error.message);
        }
      }
    }

    // Fall back to client-side AI
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
      console.error("❌ Gemini API key not configured for SalaryCert");
      return {
        available: false,
        error: "API key not configured",
        maxSalaryLimit: MAX_SALARY_LIMIT,
        maxDocumentAge: MAX_DOCUMENT_AGE_DAYS,
        profileCheckEnabled: true,
      };
    }

    const initialized = initializeGemini();
    if (!initialized) {
      console.error("❌ Failed to initialize Gemini AI for SalaryCert");
      return {
        available: false,
        error: "Failed to initialize AI",
        maxSalaryLimit: MAX_SALARY_LIMIT,
        maxDocumentAge: MAX_DOCUMENT_AGE_DAYS,
        profileCheckEnabled: true,
      };
    }

    // Test with a simple request
    try {
      console.log("🔬 Testing client-side SalaryCert AI connection...");
      const testResult = await model.generateContent(
        "Test connection - respond with OK"
      );
      const testResponse = await testResult.response;
      const text = testResponse.text();

      console.log("✓ Client-side SalaryCert AI is available");
      return {
        available: true,
        method: "client",
        maxSalaryLimit: MAX_SALARY_LIMIT,
        maxDocumentAge: MAX_DOCUMENT_AGE_DAYS,
        profileCheckEnabled: true,
        config: {
          apiKey: "***configured***",
          model: "gemini-2.0-flash",
        },
      };
    } catch (testError) {
      console.error(
        "❌ Client-side SalaryCert AI test failed:",
        testError.message
      );
      return {
        available: false,
        error: testError.message,
        maxSalaryLimit: MAX_SALARY_LIMIT,
        maxDocumentAge: MAX_DOCUMENT_AGE_DAYS,
        profileCheckEnabled: true,
      };
    }
  } catch (error) {
    console.error("❌ SalaryCert AI backend check failed:", error);
    return {
      available: false,
      error: error.message,
      maxSalaryLimit: MAX_SALARY_LIMIT,
      maxDocumentAge: MAX_DOCUMENT_AGE_DAYS,
      profileCheckEnabled: true,
    };
  }
};

// Export salary validation constants
export const SALARY_VALIDATION_CONFIG = {
  MAX_SALARY_LIMIT,
  MAX_DOCUMENT_AGE_DAYS,
  REQUIRED_ELEMENTS: {
    companyName: true,
    authorizedSignature: true,
    salaryWithinLimit: true,
    documentWithinAge: true,
    profileMatch: true,
  },
  OPTIONAL_ELEMENTS: {
    officialSeal: false, // ไม่บังคับตราประทับ
  },
};

// *** เพิ่ม: Export ฟังก์ชันดึงข้อมูลโปรไฟล์ ***
export { fetchUserProfileData };
