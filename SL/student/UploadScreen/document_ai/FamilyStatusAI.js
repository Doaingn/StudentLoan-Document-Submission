// documents_ai/FamilyStatusAI.js - Enhanced with profile data verification
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../../database/firebase";

// Configuration
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

let genAI = null;
let model = null;

console.log('🔧 FamilyStatusAI Configuration:');
console.log('- Client-side only (no backend server)');
console.log('- API Key configured:', !!GEMINI_API_KEY);

// Initialize Gemini AI
const initializeGemini = () => {
  if (!genAI && GEMINI_API_KEY && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      console.log('✓ Gemini AI initialized successfully for FamilyStatus');
      return true;
    } catch (error) {
      console.error('Failed to initialize Gemini AI for FamilyStatus:', error);
      return false;
    }
  }
  return !!genAI;
};

// Fetch user profile data from Firebase
export const fetchUserProfileData = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn('⚠️ No authenticated user found');
      return null;
    }

    console.log('📥 Fetching user profile data from Firebase...');
    const userDoc = await getDoc(doc(db, "users", user.uid));
    
    if (!userDoc.exists()) {
      console.warn('⚠️ User document not found');
      return null;
    }

    const userData = userDoc.data();
    console.log('✅ User profile data fetched successfully');
    
    return {
      student: {
        name: userData.name || null,
        student_id: userData.student_id || null,
        citizen_id: userData.citizen_id || null,
        siblings_count: userData.siblings_count || null,
      },
      father: {
        name: userData.father_info?.name || null,
        citizen_id: userData.father_info?.citizen_id || null,
        occupation: userData.father_info?.occupation || null,
        income: userData.father_info?.income || null,
        phone_number: userData.father_info?.phone_number || null,
        address_perm: userData.father_info?.address_perm || null,
      },
      mother: {
        name: userData.mother_info?.name || null,
        citizen_id: userData.mother_info?.citizen_id || null,
        occupation: userData.mother_info?.occupation || null,
        income: userData.mother_info?.income || null,
        phone_number: userData.mother_info?.phone_number || null,
        address_perm: userData.mother_info?.address_perm || null,
      },
      guardian: {
        name: userData.guardian_info?.name || null,
        citizen_id: userData.guardian_info?.citizen_id || null,
        occupation: userData.guardian_info?.occupation || null,
        income: userData.guardian_info?.income || null,
        phone_number: userData.guardian_info?.phone_number || null,
        address_perm: userData.guardian_info?.address_perm || null,
        guardian_relation: userData.guardian_info?.guardian_relation || null,
      }
    };
  } catch (error) {
    console.error('❌ Error fetching user profile data:', error);
    return null;
  }
};

// *** แก้ไข: ฟังก์ชันเปรียบเทียบข้อมูลกับโปรไฟล์แบบใหม่ เฉพาะชื่อ ***
const compareWithProfile = (extractedData, profileData) => {
  if (!profileData || !extractedData) {
    return {
      matchStatus: 'no_profile_data',
      matches: {},
      mismatches: [],
      warnings: ['ไม่มีข้อมูลโปรไฟล์สำหรับเปรียบเทียบ']
    };
  }

  const normalizeText = (text) => {
    if (!text) return '';
    return text.toString().trim().toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\u0E00-\u0E7Fa-z0-9\s]/g, '');
  };

  // *** แก้ไข: ฟังก์ชันเปรียบเทียบชื่อเฉพาะ ***
  const compareNameOnly = (extractedName, profileName, personLabel) => {
    if (!extractedName || !profileName) {
      return {
        match: false,
        warning: `ไม่มีข้อมูล${personLabel}สำหรับเปรียบเทียบ`
      };
    }
    
    const extracted = normalizeText(extractedName);
    const profile = normalizeText(profileName);
    
    if (extracted === profile) {
      return {
        match: true,
        warning: null
      };
    } else if (extracted.includes(profile) || profile.includes(extracted)) {
      return {
        match: true,
        warning: `ชื่อ${personLabel}ในเอกสารและโปรไฟล์ใกล้เคียงกัน`
      };
    } else {
      return {
        match: false,
        warning: null
      };
    }
  };

  // *** แก้ไข: เริ่มต้นการเปรียบเทียบข้อมูลนักศึกษา ***
  const studentComparison = {
    matches: {},
    mismatches: [],
    warnings: []
  };
  
  // เปรียบเทียบชื่อนักศึกษา
  if (extractedData.borrowerInfo?.name && profileData.student?.name) {
    const result = compareNameOnly(extractedData.borrowerInfo.name, profileData.student.name, 'นักศึกษา');
    studentComparison.matches.student_name = result.match;
    if (result.warning) {
      studentComparison.warnings.push(result.warning);
    }
    
    if (!result.match) {
      studentComparison.mismatches.push({
        field: 'ชื่อนักศึกษา',
        extracted: extractedData.borrowerInfo.name,
        profile: profileData.student.name
      });
    }
  }
  
  // เปรียบเทียบรหัสนักศึกษา
  if (extractedData.borrowerInfo?.studentId && profileData.student?.student_id) {
    const extractedId = extractedData.borrowerInfo.studentId.replace(/\D/g, '');
    const profileId = profileData.student.student_id.replace(/\D/g, '');
    
    if (extractedId === profileId) {
      studentComparison.matches.student_id = true;
    } else {
      studentComparison.matches.student_id = false;
      studentComparison.mismatches.push({
        field: 'รหัสนักศึกษา',
        extracted: extractedData.borrowerInfo.studentId,
        profile: profileData.student.student_id
      });
    }
  }
  
  // เปรียบเทียบเลขบัตรประชาชนนักศึกษา
  if (extractedData.borrowerInfo?.idCard && profileData.student?.citizen_id) {
    const extractedId = extractedData.borrowerInfo.idCard.replace(/\D/g, '');
    const profileId = profileData.student.citizen_id.replace(/\D/g, '');
    
    if (extractedId === profileId) {
      studentComparison.matches.student_citizen_id = true;
    } else {
      studentComparison.matches.student_citizen_id = false;
      studentComparison.mismatches.push({
        field: 'เลขบัตรประชาชนนักศึกษา',
        extracted: extractedData.borrowerInfo.idCard,
        profile: profileData.student.citizen_id
      });
    }
  }
  
  // *** แก้ไข: เปรียบเทียบข้อมูลบิดาและมารดาเฉพาะชื่อ ***
  let fatherComparison = null;
  let motherComparison = null;
  
  // *** แก้ไข: ใช้ข้อมูลจาก fatherInfo และ motherInfo แทน certifierInfo ***
  // เปรียบเทียบชื่อบิดา
  if (extractedData.fatherInfo?.name && profileData.father?.name) {
    const result = compareNameOnly(extractedData.fatherInfo.name, profileData.father.name, 'บิดา');
    fatherComparison = {
      matches: { name: result.match },
      mismatches: result.match ? [] : [{
        field: 'ชื่อบิดา',
        extracted: extractedData.fatherInfo.name,
        profile: profileData.father.name
      }],
      warnings: result.warning ? [result.warning] : [],
      comparisonDetails: {
        fieldsCompared: 1,
        fieldsMatched: result.match ? 1 : 0,
        fieldsMismatched: result.match ? 0 : 1,
        personType: 'บิดา'
      },
      matchPercentage: result.match ? 100 : 0
    };
  } else if (profileData.father?.name) {
    // มีชื่อบิดาในโปรไฟล์แต่ไม่มีในเอกสาร
    fatherComparison = {
      matches: { name: false },
      mismatches: [{
        field: 'ชื่อบิดา',
        extracted: 'ไม่พบในเอกสาร',
        profile: profileData.father.name
      }],
      warnings: ['ไม่พบชื่อบิดาในเอกสาร'],
      comparisonDetails: {
        fieldsCompared: 1,
        fieldsMatched: 0,
        fieldsMismatched: 1,
        personType: 'บิดา'
      },
      matchPercentage: 0
    };
  }
  
  // เปรียบเทียบชื่อมารดา
  if (extractedData.motherInfo?.name && profileData.mother?.name) {
    const result = compareNameOnly(extractedData.motherInfo.name, profileData.mother.name, 'มารดา');
    motherComparison = {
      matches: { name: result.match },
      mismatches: result.match ? [] : [{
        field: 'ชื่อมารดา',
        extracted: extractedData.motherInfo.name,
        profile: profileData.mother.name
      }],
      warnings: result.warning ? [result.warning] : [],
      comparisonDetails: {
        fieldsCompared: 1,
        fieldsMatched: result.match ? 1 : 0,
        fieldsMismatched: result.match ? 0 : 1,
        personType: 'มารดา'
      },
      matchPercentage: result.match ? 100 : 0
    };
  } else if (profileData.mother?.name) {
    // มีชื่อมารดาในโปรไฟล์แต่ไม่มีในเอกสาร
    motherComparison = {
      matches: { name: false },
      mismatches: [{
        field: 'ชื่อมารดา',
        extracted: 'ไม่พบในเอกสาร',
        profile: profileData.mother.name
      }],
      warnings: ['ไม่พบชื่อมารดาในเอกสาร'],
      comparisonDetails: {
        fieldsCompared: 1,
        fieldsMatched: 0,
        fieldsMismatched: 1,
        personType: 'มารดา'
      },
      matchPercentage: 0
    };
  }
  
  // *** แก้ไข: รวมผลการเปรียบเทียบทั้งหมด ***
  const allMatches = { ...studentComparison.matches };
  const allMismatches = [...studentComparison.mismatches];
  const allWarnings = [...studentComparison.warnings];
  
  // เพิ่มผลการเปรียบเทียบของบิดา
  if (fatherComparison) {
    Object.entries(fatherComparison.matches).forEach(([key, value]) => {
      allMatches[`father_${key}`] = value;
    });
    
    allMismatches.push(...fatherComparison.mismatches);
    allWarnings.push(...fatherComparison.warnings);
  }
  
  // เพิ่มผลการเปรียบเทียบของมารดา
  if (motherComparison) {
    Object.entries(motherComparison.matches).forEach(([key, value]) => {
      allMatches[`mother_${key}`] = value;
    });
    
    allMismatches.push(...motherComparison.mismatches);
    allWarnings.push(...motherComparison.warnings);
  }
  
  // กำหนดสถานะการเปรียบเทียบโดยรวม
  let matchStatus = 'unknown';
  const totalFields = Object.keys(allMatches).length;
  const matchedCount = Object.values(allMatches).filter(v => v === true).length;
  const mismatchedCount = allMismatches.length;
  const matchPercentage = totalFields > 0 ? Math.round((matchedCount / totalFields) * 100) : 0;
  
  if (mismatchedCount === 0 && allWarnings.length === 0) {
    matchStatus = 'full_match';
  } else if (mismatchedCount === 0 && allWarnings.length <= 2) {
    matchStatus = 'good_match';
  } else if (mismatchedCount === 0) {
    matchStatus = 'partial_match';
  } else if (matchPercentage >= 70) {
    matchStatus = 'good_match';
  } else if (matchPercentage >= 50) {
    matchStatus = 'partial_match';
  } else {
    matchStatus = 'mismatch';
  }
  
  return {
    matchStatus,
    matches: allMatches,
    mismatches: allMismatches,
    warnings: allWarnings,
    comparisonDetails: {
      fieldsCompared: totalFields,
      fieldsMatched: matchedCount,
      fieldsMismatched: mismatchedCount,
      studentComparison,
      fatherComparison,
      motherComparison
    },
    matchPercentage
  };
};

// Prepare file for Gemini
const prepareFileForGemini = async (fileUri, mimeType) => {
  try {
    console.log('📁 Preparing FamilyStatus file for Gemini AI...');
    
    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    let actualMimeType = mimeType || 'image/jpeg';
    if (!mimeType) {
      const ext = fileUri.split('.').pop()?.toLowerCase();
      if (ext === 'png') actualMimeType = 'image/png';
      else if (ext === 'pdf') actualMimeType = 'application/pdf';
    }

    console.log('✅ FamilyStatus file prepared for Gemini');
    return {
      inlineData: {
        data: base64Data,
        mimeType: actualMimeType,
      },
    };
  } catch (error) {
    console.error('❌ Error preparing FamilyStatus file:', error);
    throw new Error(`ไม่สามารถเตรียมไฟล์สำหรับการวิเคราะห์ได้: ${error.message}`);
  }
};

// Client-side validation
const validateFamilyStatusCertClientSide = async (fileUri, mimeType, profileData) => {
  console.log('🤖 Starting client-side family status cert validation...');
  
  if (!model) {
    const initialized = initializeGemini();
    if (!initialized) throw new Error('ระบบ AI ไม่พร้อมใช้งาน');
  }

  const filePart = await prepareFileForGemini(fileUri, mimeType);

  let profileInfo = '';
  if (profileData) {
    profileInfo = `

**ข้อมูลโปรไฟล์สำหรับเปรียบเทียบ:**

นักศึกษา:
- ชื่อ-นามสกุล: ${profileData.student?.name || 'ไม่ระบุ'}
- รหัสนักศึกษา: ${profileData.student?.student_id || 'ไม่ระบุ'}
- เลขบัตรประชาชน: ${profileData.student?.citizen_id || 'ไม่ระบุ'}

บิดา:
- ชื่อ-นามสกุล: ${profileData.father?.name || 'ไม่ระบุ'}

มารดา:
- ชื่อ-นามสกุล: ${profileData.mother?.name || 'ไม่ระบุ'}

กรุณาเปรียบเทียบข้อมูลที่สกัดได้กับข้อมูลโปรไฟล์ด้วย โดยเฉพาะ:
- ชื่อนักศึกษา, รหัสนักศึกษา, เลขบัตรประชาชนนักศึกษา
- ชื่อบิดาและมารดาเท่านั้น`;
  }

  const prompt = `
ตรวจสอบเอกสารนี้ว่าเป็นหนังสือรับรองสถานภาพครอบครัว หรือไม่
 ${profileInfo}

**คำสั่งพิเศษสำหรับเอกสารสถานภาพครอบครัว:**
- ให้สกัดข้อมูลเฉพาะชื่อของบิดาและมารดาเท่านั้น
- ในเอกสารนี้มีเพียงชื่อบิดาและมารดา ไม่มีข้อมูลอื่นๆ เช่น เบอร์โทร ที่อยู่
- *** สำคัญมาก: ให้ค้นหาข้อความ "บิดาของนักศึกษา" และสกัดชื่อที่ตามหลังมาเป็นชื่อบิดา ***
- *** สำคัญมาก: ให้ค้นหาข้อความ "มารดาของนักศึกษา" และสกัดชื่อที่ตามหลังมาเป็นชื่อมารดา ***
- ห้ามใช้ชื่อจากส่วนผู้รับรองทั่วไปมาเป็นชื่อบิดาหรือมารดา

กรุณาตรวจสอบและตอบในรูปแบบ JSON ดังนี้:
{
  "isFamilyStatusCert": true/false,
  "confidence": 0-100,
  "documentType": "หนังสือรับรองสถานภาพครอบครัว/หนังสือรับรองการหย่า/หนังสือรับรองการสมรส/อื่นๆ",
  "familyStatus": "สมรสแล้ว/โสด/หย่าร้าง/หม้าย/แยกกันอยู่/อื่นๆ",
  "hasOfficialSeal": true/false,
  "hasSignature": true/false,
  "signatureQuality": "clear/unclear/missing",
  "issuingAuthority": "หน่วยงานที่ออกเอกสาร",
  "borrowerInfo": {
    "studentId": "รหัสนักศึกษา",
    "idCard": "เลขบัตรประชาชน 13 หลัก",
    "idCardValid": true/false,
    "name": "ชื่อ-นามสกุลผู้กู้"
  },
  "certifierInfo": {
    "name": "ชื่อ-นามสกุลผู้รับรองทั่วไป (ถ้ามี)",
    "idCard": "เลขบัตรประชาชนผู้รับรอง 13 หลัก",
    "idCardValid": true/false,
    "relationship": "บิดา/มารดา",
    "address": {
      "houseNumber": "บ้านเลขที่",
      "moo": "หมู่",
      "road": "ถนน",
      "subDistrict": "ตำบล",
      "district": "อำเภอ",
      "province": "จังหวัด",
      "postalCode": "รหัสไปรษณีย์",
      "full": "ที่อยู่เต็ม"
    },
    "phone": "เบอร์โทรศัพท์ติดต่อ"
  },
  "fatherInfo": {
    "name": "ชื่อ-นามสกุลบิดา (สกัดจากข้อความ 'บิดาของนักศึกษา')",
    "idCard": "เลขบัตรประชาชนบิดา 13 หลัก (ถ้ามี)",
    "idCardValid": true/false
  },
  "motherInfo": {
    "name": "ชื่อ-นามสกุลมารดา (สกัดจากข้อความ 'มารดาของนักศึกษา')",
    "idCard": "เลขบัตรประชาชนมารดา 13 หลัก (ถ้ามี)",
    "idCardValid": true/false
  },
  "familyFinancialInfo": {
    "monthlyIncome": "รายได้ต่อเดือน (ตัวเลข)",
    "monthlyIncomeValid": true/false,
    "yearlyIncome": "รายได้เฉลี่ยต่อปี",
    "familyMembers": "จำนวนสมาชิกครอบครัว (ตัวเลข)",
    "familyMembersValid": true/false,
    "incomePerCapita": "รายได้ต่อหัว"
  },
  "legalStatus": {
    "parentsLiveTogether": true/false,
    "parentsDivorced": true/false,
    "parentsSeparated": true/false,
    "fatherDeceased": true/false,
    "motherDeceased": true/false,
    "statusChecked": true/false,
    "statusType": "บิดามารดาอยู่ด้วยกัน/หย่าร้าง/แยกกันอยู่/บิดาเสียชีวิต/มารดาเสียชีวิต"
  },
  "dataConsistency": {
    "addressMatch": true/false,
    "phoneConsistent": true/false,
    "dateValid": true/false,
    "signerNameMatch": true/false,
    "yearConsistent": true/false
  },
  "signatures": {
    "certifierSignature": true/false,
    "certifierNameWritten": true/false,
    "certifierNameMatch": true/false,
    "witnessSignature1": true/false,
    "witnessSignature2": true/false,
    "witnessRequired": true/false
  },
  "extractedData": {
    "issueDate": "วันที่ออกเอกสาร",
    "expiryDate": "วันหมดอายุ",
    "signingDate": "วันที่ลงนาม",
    "signingYear": "ปี พ.ศ.",
    "officerName": "ชื่อเจ้าหน้าที่ผู้รับรอง",
    "officerPosition": "ตำแหน่งเจ้าหน้าที่"
  },
  "dataCompleteness": {
    "hasBorrowerInfo": true/false,
    "hasCertifierInfo": true/false,
    "hasFinancialInfo": true/false,
    "hasLegalStatus": true/false,
    "hasConsistentData": true/false,
    "hasSignatures": true/false,
    "completenessScore": 0-100
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
    "idCardsValid": true/false,
    "financialDataValid": true/false
  },
  "qualityIssues": ["ปัญหาที่พบ"],
  "recommendations": ["คำแนะนำ"],
  "overall_status": "valid/invalid/needs_review"
}

**เกณฑ์การตรวจสอบ:**
1. ข้อมูลผู้กู้: รหัส, เลขบัตร 13 หลัก, ชื่อครบถ้วน
2. ผู้รับรองสถานภาพ: ชื่อ, เลขบัตร 13 หลัก, ความสัมพันธ์ (บิดา/มารดา)
3. รายละเอียดครอบครัว/การเงิน: รายได้, จำนวนสมาชิก
4. สถานภาพทางกฎหมาย: ช่องเลือกต้องติ๊กชัดเจน
5. ความสอดคล้องของข้อมูล
6. ลายเซ็นและชื่อกำกับ

**เกณฑ์การประเมิน:**
- completenessScore = (จำนวนข้อที่ผ่าน / 6) × 100
- overall_status = "valid" เมื่อ >= 90% และมีลายเซ็น
- overall_status = "needs_review" เมื่อ 70-89%
- overall_status = "invalid" เมื่อ < 70%
`;

  try {
    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();

    console.log('🤖 FamilyStatus AI Response received');

    let parsed;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      console.warn('⚠️ Failed to parse JSON, using text analysis');
      parsed = analyzeFamilyStatusTextResponse(responseText);
    }

    // Add profile comparison
    if (profileData) {
      const comparison = compareWithProfile(parsed, profileData);
      parsed.profileComparison = comparison;
      
      // Store profile data for display in alert
      parsed.rawResult = {
        profileData: profileData
      };

      // Add comparison results to quality issues and recommendations
      if (comparison.mismatches.length > 0) {
        parsed.qualityIssues = parsed.qualityIssues || [];
        comparison.mismatches.forEach(mismatch => {
          parsed.qualityIssues.push(
            `${mismatch.field}ไม่ตรงกับโปรไฟล์: เอกสาร="${mismatch.extracted}" โปรไฟล์="${mismatch.profile}"`
          );
        });
        
        parsed.recommendations = parsed.recommendations || [];
        parsed.recommendations.push('กรุณาตรวจสอบว่าข้อมูลในเอกสารตรงกับข้อมูลในโปรไฟล์');
        
        if (parsed.overall_status === 'valid') {
          parsed.overall_status = 'needs_review';
        }
      }

      if (comparison.warnings.length > 0) {
        parsed.recommendations = parsed.recommendations || [];
        parsed.recommendations.push(...comparison.warnings);
      }
    }

    console.log('✅ Client-side FamilyStatus validation completed');
    return parsed;
  } catch (error) {
    console.error('❌ Client-side validation failed:', error);
    throw error;
  }
};

// Fallback text analysis
const analyzeFamilyStatusTextResponse = (text) => {
  const lowerText = text.toLowerCase();
  
  const isFamilyStatusCert = lowerText.includes('หนังสือรับรองสถานภาพ') || 
                             lowerText.includes('สถานภาพครอบครัว') ||
                             lowerText.includes('family status') ||
                             lowerText.includes('สมรส') ||
                             lowerText.includes('หย่าร้าง') ||
                             lowerText.includes('หม้าย');
  
  const hasOfficialSeal = lowerText.includes('ตราประทับ') || 
                          lowerText.includes('ตราราชการ') ||
                          lowerText.includes('official seal');

  const hasSignature = lowerText.includes('ลายเซ็น') || 
                       lowerText.includes('ลงชื่อ') ||
                       lowerText.includes('signature');

  let familyStatus = 'ไม่ทราบ';
  if (lowerText.includes('โสด')) familyStatus = 'โสด';
  else if (lowerText.includes('สมรสแล้ว') || lowerText.includes('สมรส')) familyStatus = 'สมรสแล้ว';
  else if (lowerText.includes('หย่าร้าง') || lowerText.includes('หย่า')) familyStatus = 'หย่าร้าง';
  else if (lowerText.includes('หม้าย')) familyStatus = 'หม้าย';

  return {
    isFamilyStatusCert,
    confidence: isFamilyStatusCert ? 75 : 25,
    documentType: isFamilyStatusCert ? 'หนังสือรับรองสถานภาพครอบครัว' : 'ไม่ทราบ',
    familyStatus,
    hasOfficialSeal,
    hasSignature,
    signatureQuality: hasSignature ? 'unclear' : 'missing',
    issuingAuthority: 'ไม่ทราบ',
    borrowerInfo: {},
    certifierInfo: {},
    fatherInfo: {},
    motherInfo: {},
    familyFinancialInfo: {},
    legalStatus: {},
    dataConsistency: {},
    signatures: {},
    extractedData: {},
    dataCompleteness: {
      completenessScore: isFamilyStatusCert ? 50 : 0
    },
    documentQuality: {
      isExpired: null,
      isLegible: true,
      hasWatermark: false,
      imageQuality: 'unclear',
      isComplete: true
    },
    validityChecks: {
      hasValidDates: null,
      hasConsistentInfo: null,
      hasRequiredFields: null
    },
    qualityIssues: !isFamilyStatusCert ? ['ไม่พบหนังสือรับรองสถานภาพครอบครัว'] : [],
    recommendations: !isFamilyStatusCert ? ['กรุณาอัปโหลดหนังสือรับรองสถานภาพครอบครัว'] : [],
    overall_status: isFamilyStatusCert && hasOfficialSeal && hasSignature ? 'valid' : 'needs_review',
    rawResponse: text
  };
};

// Main validation function
export const validateFamilyStatusCert = async (fileUri, mimeType = null, includeProfileCheck = true) => {
  try {
    console.log('🚀 Starting family status cert validation...');

    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error('ไฟล์ไม่พบ');
    }

    // Fetch profile data if requested
    let profileData = null;
    if (includeProfileCheck) {
      profileData = await fetchUserProfileData();
      if (profileData) {
        console.log('✅ Profile data loaded for comparison');
      }
    }

    console.log('✅ Using client-side FamilyStatus validation');
    return await validateFamilyStatusCertClientSide(fileUri, mimeType, profileData);

  } catch (error) {
    console.error('❌ FamilyStatus validation error:', error);
    throw new Error(`การตรวจสอบล้มเหลว: ${error.message}`);
  }
};

// Parse result
export const parseFamilyStatusCertResult = (result) => {
  if (!result) return null;

  return {
    isValid: result.overall_status === 'valid' && 
             result.isFamilyStatusCert &&
             (result.profileComparison?.matchStatus !== 'mismatch'),
    confidence: result.confidence || 0,
    status: result.overall_status || 'unknown',
    documentType: result.documentType || 'ไม่ทราบ',
    familyStatus: result.familyStatus || 'ไม่ทราบ',
    hasOfficialSeal: result.hasOfficialSeal || false,
    hasSignature: result.hasSignature || false,
    signatureQuality: result.signatureQuality || 'missing',
    issuingAuthority: result.issuingAuthority || 'ไม่ทราบ',
    borrowerInfo: result.borrowerInfo || {},
    certifierInfo: result.certifierInfo || {},
    fatherInfo: result.fatherInfo || {},
    motherInfo: result.motherInfo || {},
    familyFinancialInfo: result.familyFinancialInfo || {},
    legalStatus: result.legalStatus || {},
    dataConsistency: result.dataConsistency || {},
    signatures: result.signatures || {},
    extractedData: result.extractedData || {},
    dataCompleteness: result.dataCompleteness || {},
    documentQuality: result.documentQuality || {},
    validityChecks: result.validityChecks || {},
    profileComparison: result.profileComparison || null,
    qualityIssues: result.qualityIssues || [],
    recommendations: result.recommendations || [],
    rawResult: result
  };
};

// Show validation alert with detailed profile comparison
export const showFamilyStatusCertValidationAlert = (result, onAccept, onReject, profileData = null) => {
  let title, message;

  const profileMismatch = result.profileComparison?.matchStatus === 'mismatch';
  const incompleteness = result.dataCompleteness?.completenessScore < 90;
  
  if (profileMismatch) {
    title = '⚠️ ข้อมูลไม่ตรงกับโปรไฟล์';
  } else if (incompleteness) {
    title = '⚠️ ข้อมูลไม่ครบถ้วน';
  } else if (result.overall_status === 'valid') {
    title = '✅ ตรวจสอบหนังสือรับรองสถานภาพครอบครัวสำเร็จ';
  } else {
    title = '⚠️ ตรวจพบปัญหา';
  }
  
  let statusText = '';
  statusText += result.isFamilyStatusCert ? '✅ ตรวจพบหนังสือรับรองสถานภาพครอบครัว\n' : '❌ ไม่พบหนังสือรับรองสถานภาพครอบครัว\n';

  if (result.familyStatus && result.familyStatus !== 'ไม่ทราบ') {
    statusText += `👨‍👩‍👧‍👦 สถานภาพ: ${result.familyStatus}\n`;
  }

  statusText += result.hasOfficialSeal ? '✅ ตรวจพบตราประทับราชการ\n' : '❌ ไม่พบตราประทับราชการ\n';
  statusText += result.hasSignature ? `✅ ตรวจพบลายเซ็น (${result.signatureQuality})\n` : '❌ ไม่พบลายเซ็น\n';

  // Data completeness
  if (result.dataCompleteness) {
    statusText += `\n📊 ความครบถ้วน: ${result.dataCompleteness.completenessScore}%\n`;
  }

  statusText += `\n🎯 ความเชื่อมั่น: ${result.confidence}%`;
  statusText += `\nประเภทเอกสาร: ${result.documentType}`;
  
  if (result.issuingAuthority && result.issuingAuthority !== 'ไม่ทราบ') {
    statusText += `\nหน่วยงานที่ออก: ${result.issuingAuthority}`;
  }

  // Extracted data summary
  if (result.borrowerInfo && Object.keys(result.borrowerInfo).length > 0) {
    statusText += '\n\n📋 ข้อมูลผู้กู้ในเอกสาร:';
    if (result.borrowerInfo.name) statusText += `\n• ชื่อ: ${result.borrowerInfo.name}`;
    if (result.borrowerInfo.studentId) statusText += `\n• รหัส: ${result.borrowerInfo.studentId}`;
    if (result.borrowerInfo.idCard) statusText += `\n• บัตรประชาชน: ${result.borrowerInfo.idCard}`;
  }

  // *** แก้ไข: แสดงข้อมูลบิดาและมารดาแยกกัน ***
  if (result.fatherInfo?.name) {
    statusText += '\n\n👨 บิดาในเอกสาร:';
    statusText += `\n• ชื่อ: ${result.fatherInfo.name}`;
    if (result.fatherInfo.idCard) statusText += `\n• บัตรประชาชน: ${result.fatherInfo.idCard}`;
  }

  if (result.motherInfo?.name) {
    statusText += '\n\n👩 มารดาในเอกสาร:';
    statusText += `\n• ชื่อ: ${result.motherInfo.name}`;
    if (result.motherInfo.idCard) statusText += `\n• บัตรประชาชน: ${result.motherInfo.idCard}`;
  }

  // *** แก้ไข: แสดงผลการเปรียบเทียบเฉพาะชื่อ ***
  if (result.profileComparison && result.rawResult?.profileData) {
    const comp = result.profileComparison;
    const profile = result.rawResult.profileData;
    
    statusText += '\n\n━━━━━━━━━━━━━━━━━━━━';
    statusText += '\n📊 เปรียบเทียบชื่อกับข้อมูลในโปรไฟล์:';
    statusText += '\n━━━━━━━━━━━━━━━━━━━━\n';
    
    // Student comparison
    if (profile.student) {
      statusText += '\n👨‍🎓 นักศึกษา:';
      
      if (result.borrowerInfo?.name && profile.student.name) {
        const match = comp.matches.student_name === true;
        statusText += `\n  ชื่อ: ${match ? '✅' : '❌'}`;
        statusText += `\n    เอกสาร: ${result.borrowerInfo.name}`;
        statusText += `\n    โปรไฟล์: ${profile.student.name}`;
      }
      
      if (result.borrowerInfo?.studentId && profile.student.student_id) {
        const match = comp.matches.student_id === true;
        statusText += `\n  รหัส: ${match ? '✅' : '❌'}`;
        statusText += `\n    เอกสาร: ${result.borrowerInfo.studentId}`;
        statusText += `\n    โปรไฟล์: ${profile.student.student_id}`;
      }
      
      if (result.borrowerInfo?.idCard && profile.student.citizen_id) {
        const match = comp.matches.student_citizen_id === true;
        statusText += `\n  บัตรประชาชน: ${match ? '✅' : '❌'}`;
        statusText += `\n    เอกสาร: ${result.borrowerInfo.idCard}`;
        statusText += `\n    โปรไฟล์: ${profile.student.citizen_id}`;
      }
    }
    
    // Father comparison - แสดงเฉพาะชื่อ
    if (profile.father && profile.father.name) {
      const fatherMatch = comp.comparisonDetails?.fatherComparison;
      
      statusText += '\n\n👨 บิดา:';
      
      if (result.fatherInfo?.name && profile.father.name) {
        const match = comp.matches.father_name === true;
        statusText += `\n  ชื่อ: ${match ? '✅' : '❌'}`;
        statusText += `\n    เอกสาร: ${result.fatherInfo.name}`;
        statusText += `\n    โปรไฟล์: ${profile.father.name}`;
      } else if (profile.father.name) {
        statusText += `\n  ชื่อ: ❌`;
        statusText += `\n    เอกสาร: ไม่พบ`;
        statusText += `\n    โปรไฟล์: ${profile.father.name}`;
      }
      
      if (fatherMatch && fatherMatch.matchPercentage) {
        statusText += `\n  คะแนน: ${fatherMatch.matchPercentage}%`;
      }
    }
    
    // Mother comparison - แสดงเฉพาะชื่อ
    if (profile.mother && profile.mother.name) {
      const motherMatch = comp.comparisonDetails?.motherComparison;
      
      statusText += '\n\n👩 มารดา:';
      
      if (result.motherInfo?.name && profile.mother.name) {
        const match = comp.matches.mother_name === true;
        statusText += `\n  ชื่อ: ${match ? '✅' : '❌'}`;
        statusText += `\n    เอกสาร: ${result.motherInfo.name}`;
        statusText += `\n    โปรไฟล์: ${profile.mother.name}`;
      } else if (profile.mother.name) {
        statusText += `\n  ชื่อ: ❌`;
        statusText += `\n    เอกสาร: ไม่พบ`;
        statusText += `\n    โปรไฟล์: ${profile.mother.name}`;
      }
      
      if (motherMatch && motherMatch.matchPercentage) {
        statusText += `\n  คะแนน: ${motherMatch.matchPercentage}%`;
      }
    }
    
    statusText += '\n\n━━━━━━━━━━━━━━━━━━━━';
    
    // Overall status
    if (comp.matchStatus === 'full_match') {
      statusText += '\n✅ สรุป: ชื่อตรงกับโปรไฟล์ทุกประการ';
    } else if (comp.matchStatus === 'partial_match') {
      statusText += '\n⚠️ สรุป: ชื่อตรงบางส่วน';
    } else if (comp.matchStatus === 'mismatch') {
      statusText += '\n❌ สรุป: พบชื่อไม่ตรงกัน';
    }
    
    if (comp.comparisonDetails) {
      statusText += `\nเปรียบเทียบ: ${comp.comparisonDetails.fieldsMatched}/${comp.comparisonDetails.fieldsCompared} รายการตรงกัน`;
    }
  }

  if (result.qualityIssues?.length > 0) {
    statusText += '\n\n⚠️ ปัญหาที่พบ:\n• ' + result.qualityIssues.join('\n• ');
  }

  if (result.recommendations?.length > 0) {
    statusText += '\n\n💡 คำแนะนำ:\n• ' + result.recommendations.join('\n• ');
  }

  message = statusText;
  
  const isValid = result.overall_status === 'valid' && 
                 result.isFamilyStatusCert &&
                 !profileMismatch &&
                 !incompleteness;

  const buttons = [
    {
      text: 'ลองใหม่',
      style: 'cancel',
      onPress: onReject,
    },
  ];

  if (profileMismatch || incompleteness) {
    buttons.push({
      text: 'ตกลง',
      style: 'default',
      onPress: onReject,
    });
  } else if (isValid || result.overall_status === 'needs_review') {
    buttons.push({
      text: result.overall_status === 'valid' ? 'ใช้ไฟล์นี้' : 'ใช้ไฟล์นี้ (ต้องตรวจสอบ)',
      onPress: () => onAccept(result),
    });
  }

  Alert.alert(title, message, buttons);
};

// Format data for database
export const formatFamilyStatusCertDataForDB = (result, documentType, fileName) => {
  return {
    documentType: documentType,
    fileName: fileName,
    
    basicInfo: {
      isValid: result.isValid || false,
      confidence: result.confidence || 0,
      overall_status: result.overall_status || 'unknown',
      documentType: result.documentType || 'unknown',
      familyStatus: result.familyStatus || 'unknown',
      issuingAuthority: result.issuingAuthority || 'unknown',
    },
    
    signatureInfo: {
      hasOfficialSeal: result.hasOfficialSeal || false,
      hasSignature: result.hasSignature || false,
      signatureQuality: result.signatureQuality || 'missing',
    },
    
    borrowerInfo: result.borrowerInfo || {},
    certifierInfo: result.certifierInfo || {},
    fatherInfo: result.fatherInfo || {},
    motherInfo: result.motherInfo || {},
    familyFinancialInfo: result.familyFinancialInfo || {},
    legalStatus: result.legalStatus || {},
    dataConsistency: result.dataConsistency || {},
    signatures: result.signatures || {},
    extractedData: result.extractedData || {},
    dataCompleteness: result.dataCompleteness || {},
    documentQuality: result.documentQuality || {},
    validityChecks: result.validityChecks || {},

    profileComparison: result.profileComparison ? {
      matchStatus: result.profileComparison.matchStatus,
      matches: result.profileComparison.matches,
      mismatches: result.profileComparison.mismatches,
      warnings: result.profileComparison.warnings,
      comparisonDetails: result.profileComparison.comparisonDetails
    } : null,
    
    qualityIssues: result.qualityIssues || [],
    recommendations: result.recommendations || [],
    
    metadata: {
      validatedAt: new Date().toISOString(),
      aiModel: 'gemini-2.0-flash',
      profileCheckEnabled: !!result.profileComparison
    }
  };
};

// Check requirements
export const checkFamilyStatusCertRequirements = (result) => {
  if (!result) return { passed: false, issues: ['ไม่มีข้อมูลผลการตรวจสอบ'] };

  const issues = [];
  
  if (!result.isFamilyStatusCert) issues.push('ไม่ใช่หนังสือรับรองสถานภาพครอบครัว');
  if (!result.hasOfficialSeal) issues.push('ไม่พบตราประทับราชการ');
  if (!result.hasSignature) issues.push('ไม่พบลายเซ็น');
  
  if (result.dataCompleteness) {
    if (!result.dataCompleteness.hasBorrowerInfo) issues.push('ข้อมูลผู้กู้ไม่ครบถ้วน');
    if (!result.dataCompleteness.hasCertifierInfo) issues.push('ข้อมูลผู้รับรองไม่ครบถ้วน');
    if (!result.dataCompleteness.hasFinancialInfo) issues.push('ข้อมูลการเงินไม่ครบถ้วน');
    if (!result.dataCompleteness.hasLegalStatus) issues.push('ไม่มีการระบุสถานภาพทางกฎหมาย');
  }
  
  if (result.validityChecks) {
    if (!result.validityChecks.idCardsValid) issues.push('เลขบัตรประชาชนไม่ถูกต้อง');
    if (!result.validityChecks.financialDataValid) issues.push('ข้อมูลการเงินไม่สมเหตุสมผล');
  }
  
  if (result.profileComparison?.matchStatus === 'mismatch') {
    issues.push('ข้อมูลไม่ตรงกับโปรไฟล์');
  }

  return {
    passed: issues.length === 0,
    issues: issues,
    requirements: {
      isFamilyStatusCert: result.isFamilyStatusCert,
      hasOfficialSeal: result.hasOfficialSeal,
      hasSignature: result.hasSignature,
      dataComplete: result.dataCompleteness?.completenessScore >= 90,
      profileMatches: result.profileComparison?.matchStatus !== 'mismatch'
    }
  };
};

// Generate summary
export const generateFamilyStatusCertSummary = (result) => {
  if (!result) return 'ไม่มีข้อมูลผลการตรวจสอบ';

  const requirements = checkFamilyStatusCertRequirements(result);
  
  let summary = `📋 สรุปผลการตรวจสอบหนังสือรับรองสถานภาพครอบครัว\n\n`;
  summary += `สถานะ: ${result.overall_status === 'valid' ? '✅ ผ่าน' : result.overall_status === 'needs_review' ? '⚠️ ต้องตรวจสอบ' : '❌ ไม่ผ่าน'}\n`;
  summary += `สถานภาพครอบครัว: ${result.familyStatus}\n`;
  summary += `ความเชื่อมั่น: ${result.confidence}%\n`;
  
  if (result.dataCompleteness) {
    summary += `ความครบถ้วน: ${result.dataCompleteness.completenessScore}%\n`;
  }

  summary += `\n✅ ข้อกำหนด:\n`;
  summary += `${requirements.requirements.isFamilyStatusCert ? '✅' : '❌'} เป็นหนังสือรับรองสถานภาพครอบครัว\n`;
  summary += `${requirements.requirements.hasOfficialSeal ? '✅' : '❌'} มีตราประทับราชการ\n`;
  summary += `${requirements.requirements.hasSignature ? '✅' : '❌'} มีลายเซ็น\n`;
  summary += `${requirements.requirements.dataComplete ? '✅' : '❌'} ข้อมูลครบถ้วน\n`;
  summary += `${requirements.requirements.profileMatches ? '✅' : '❌'} ข้อมูลตรงกับโปรไฟล์\n`;

  if (result.borrowerInfo && result.borrowerInfo.name) {
    summary += `\n📋 ข้อมูลผู้กู้:\n`;
    summary += `• ชื่อ: ${result.borrowerInfo.name}\n`;
    if (result.borrowerInfo.studentId) summary += `• รหัส: ${result.borrowerInfo.studentId}\n`;
  }

  if (result.fatherInfo?.name || result.motherInfo?.name) {
    summary += `\n👥 ผู้รับรอง:\n`;
    if (result.fatherInfo?.name) summary += `• บิดา: ${result.fatherInfo.name}\n`;
    if (result.motherInfo?.name) summary += `• มารดา: ${result.motherInfo.name}\n`;
  }

  if (result.profileComparison) {
    summary += `\n👤 เปรียบเทียบกับโปรไฟล์:\n`;
    const comp = result.profileComparison;
    if (comp.matchStatus === 'full_match') {
      summary += `✅ ข้อมูลตรงกับโปรไฟล์ทุกประการ\n`;
    } else if (comp.matchStatus === 'mismatch') {
      summary += `❌ พบข้อมูลไม่ตรงกัน:\n`;
      comp.mismatches.forEach(m => {
        summary += `  • ${m.field}: เอกสาร="${m.extracted}" โปรไฟล์="${m.profile}"\n`;
      });
    }
  }

  if (!requirements.passed) {
    summary += `\n⚠️ ปัญหาที่พบ:\n`;
    requirements.issues.forEach(issue => {
      summary += `• ${issue}\n`;
    });
  }

  return summary;
};

// Validate multiple certificates
export const validateMultipleFamilyStatusCerts = async (files, includeProfileCheck = true) => {
  const results = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await validateFamilyStatusCert(file.uri, file.mimeType, includeProfileCheck);
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        validation: result,
        success: true,
        dataComplete: result.dataCompleteness?.completenessScore >= 90,
        profileMatch: result.profileComparison?.matchStatus !== 'mismatch'
      });
    } catch (error) {
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        error: error.message,
        success: false,
        dataComplete: false,
        profileMatch: false
      });
    }
  }
  
  return results;
};

// Check AI status
export const checkFamilyStatusCertAIStatus = async () => {
  try {
    console.log('🤖 Checking FamilyStatus AI backend status...');

    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      return { 
        available: false, 
        error: 'API key not configured'
      };
    }

    const initialized = initializeGemini();
    if (!initialized) {
      return { 
        available: false, 
        error: 'Failed to initialize AI'
      };
    }

    try {
      const testResult = await model.generateContent("Test connection - respond with OK");
      const testResponse = await testResult.response;
      testResponse.text();
      
      return { 
        available: true, 
        method: 'client',
        profileCheckEnabled: true,
        config: {
          apiKey: '***configured***',
          model: 'gemini-2.0-flash'
        }
      };
    } catch (testError) {
      return { 
        available: false, 
        error: testError.message
      };
    }
    
  } catch (error) {
    return { 
      available: false, 
      error: error.message
    };
  }
};