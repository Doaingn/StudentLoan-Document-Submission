// documents_ai/IncomeCertAI.js - AI validation for Income Certificate (กยศ 102) documents
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../../database/firebase";

// Configuration
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const AI_BACKEND_URL = process.env.EXPO_PUBLIC_AI_BACKEND_URL || 'http://192.168.1.102:3001';
const USE_BACKEND_SERVER = process.env.EXPO_PUBLIC_USE_AI_BACKEND === 'true';

let genAI = null;
let model = null;

console.log('🔧 IncomeCertAI Configuration:');
console.log('- Backend URL:', AI_BACKEND_URL);
console.log('- Use Backend:', USE_BACKEND_SERVER);
console.log('- API Key configured:', !!GEMINI_API_KEY);

// Initialize Gemini AI for client-side processing
const initializeGemini = () => {
  if (!genAI && GEMINI_API_KEY) {
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
      console.log('✓ Gemini AI initialized successfully for IncomeCert');
      return true;
    } catch (error) {
      console.error('Failed to initialize Gemini AI for IncomeCert:', error);
      return false;
    }
  }
  return !!genAI;
};

// *** แก้ไข: เพิ่มการตรวจสอบ livesWithParents เพื่อกำหนดว่าจะมีข้อมูลผู้ปกครองหรือไม่ ***
const fetchUserProfileData = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn('⚠️ No authenticated user found');
      return null;
    }

    console.log('🔥 Fetching user profile data from Firebase...');
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (!userDoc.exists()) {
      console.warn('⚠️ User document not found');
      return null;
    }

    const userData = userDoc.data();
    console.log('✅ User profile data fetched successfully');

    // ตรวจสอบว่าผู้ใช้อยู่กับบิดามารดาหรือไม่ (ถ้าไม่มีค่า ให้ถือว่าอยู่กับบิดามารดา)
    const livesWithParents = userData.livesWithParents !== false;

    // สร้างข้อมูลผู้ปกครองเฉพาะกรณีที่ไม่ได้อยู่กับบิดามารดา
    const guardianData = livesWithParents ? null : {
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
      livesWithParents // เพิ่มข้อมูลนี้เพื่อใช้ในการตรวจสอบ
    };
  } catch (error) {
    console.error('✗ Error fetching user profile data:', error);
    return null;
  }
};

// *** แก้ไข: แยกการเปรียบเทียบตามประเภทเอกสารให้ชัดเจน ***
const compareIncomeCertWithUserData = (extractedData, profileData, certType) => {
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

  const parseNumber = (value) => {
    if (!value) return 0;
    const str = value.toString().replace(/[^\d]/g, '');
    return parseInt(str, 10) || 0;
  };

  // *** แก้ไข: ปรับปรุงการเปรียบเทียบกรณีครอบครัว (famo_income_cert) ***
  if (certType === 'family' || certType === 'famo_income_cert') {
    console.log('🔍 Processing FAMILY income cert - comparing both father and mother');
    const fatherData = extractedData.fatherData || {};
    const motherData = extractedData.motherData || {};
    let fatherComparison = null;
    let motherComparison = null;
    const warnings = [];

    if (profileData.father && profileData.father.name && Object.keys(fatherData).length > 0) {
      fatherComparison = compareSinglePersonData(fatherData, profileData.father, 'บิดา', normalizeText, parseNumber);
    } else if (Object.keys(fatherData).length > 0) {
      warnings.push('พบข้อมูลบิดาในเอกสาร แต่ไม่มีข้อมูลบิดาในโปรไฟล์');
    }

    if (profileData.mother && profileData.mother.name && Object.keys(motherData).length > 0) {
      motherComparison = compareSinglePersonData(motherData, profileData.mother, 'มารดา', normalizeText, parseNumber);
    } else if (Object.keys(motherData).length > 0) {
      warnings.push('พบข้อมูลมารดาในเอกสาร แต่ไม่มีข้อมูลมารดาในโปรไฟล์');
    }

    const allMatches = {};
    if (fatherComparison?.matches) {
      Object.entries(fatherComparison.matches).forEach(([key, value]) => {
        allMatches[`father_${key}`] = value;
      });
    }
    if (motherComparison?.matches) {
      Object.entries(motherComparison.matches).forEach(([key, value]) => {
        allMatches[`mother_${key}`] = value;
      });
    }

    const allMismatches = [...(fatherComparison?.mismatches || []), ...(motherComparison?.mismatches || [])];
    const allWarnings = [...warnings, ...(fatherComparison?.warnings || []), ...(motherComparison?.warnings || [])];

    const fatherFields = fatherComparison?.comparisonDetails?.fieldsCompared || 0;
    const motherFields = motherComparison?.comparisonDetails?.fieldsCompared || 0;
    const totalFields = fatherFields + motherFields;
    const matchedCount = Object.values(allMatches).filter(v => v === true).length;
    const mismatchedCount = allMismatches.length;
    let matchStatus = 'unknown';
    let matchPercentage = 0;

    if (totalFields > 0) {
      matchPercentage = Math.round((matchedCount / totalFields) * 100);
    }

    if (certType === 'famo_income_cert' && mismatchedCount === 0 && allWarnings.length === 0) {
      matchStatus = 'full_match';
      matchPercentage = 100;
    } else if (mismatchedCount === 0 && allWarnings.length === 0) {
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
      matchStatus, matches: allMatches, mismatches: allMismatches, warnings: allWarnings,
      comparisonDetails: {
        fieldsCompared: totalFields, fieldsMatched: matchedCount, fieldsMismatched: mismatchedCount,
        personType: 'ครอบครัว (บิดา + มารดา)', fatherComparison, motherComparison
      }, matchPercentage
    };
  }

  if (certType === 'father' || certType === 'father_income_cert') {
    console.log('🔍 Processing FATHER income cert');
    if (!profileData.father || !profileData.father.name) {
      return {
        matchStatus: 'no_profile_data',
        matches: {},
        mismatches: [],
        warnings: ['ไม่มีข้อมูลบิดาในโปรไฟล์สำหรับเปรียบเทียบ']
      };
    }
    return compareSinglePersonData(extractedData, profileData.father, 'บิดา', normalizeText, parseNumber);
  }

  else if (certType === 'mother' || certType === 'mother_income_cert') {
    console.log('🔍 Processing MOTHER income cert');
    if (!profileData.mother || !profileData.mother.name) {
      return {
        matchStatus: 'no_profile_data',
        matches: {},
        mismatches: [],
        warnings: ['ไม่มีข้อมูลมารดาในโปรไฟล์สำหรับเปรียบเทียบ']
      };
    }
    return compareSinglePersonData(extractedData, profileData.mother, 'มารดา', normalizeText, parseNumber);
  }

  // *** กรณีเปรียบเทียบเฉพาะผู้ปกครอง (มีอยู่แล้ว และถูกต้อง) ***
  else if (certType === 'guardian' || certType === 'guardian_income_cert') {
    console.log('🔍 Processing GUARDIAN income cert');
    if (!profileData.guardian || !profileData.guardian.name) {
      return {
        matchStatus: 'no_profile_data',
        matches: {},
        mismatches: [],
        warnings: ['ไม่มีข้อมูลผู้ปกครองในโปรไฟล์สำหรับเปรียบเทียบ หรือ นักเรียนอาจจะอยู่กับบิดามารดา']
      };
    }
    return compareSinglePersonData(extractedData, profileData.guardian, 'ผู้ปกครอง', normalizeText, parseNumber);
  }

  // *** แก้ไข: ปรับปรุงการจับคู่สำหรับ single_parent_income_cert โดยเฉพาะสำหรับมารดา ***
  else if (certType === 'single_parent' || certType === 'single_parent_income_cert') {
    console.log('🔍 Processing SINGLE_PARENT income cert - AI has pre-matched the profile');
    const matchedProfileType = extractedData.matchedProfile;
    if (!matchedProfileType || matchedProfileType === 'unknown') {
      // *** แก้ไข: เพิ่ม Fallback การจับคู่ชื่อสำหรับ single_parent ***
      console.log('🤖 AI ไม่สามารถระบุตัวตนได้ กำลังลองจับคู่ชื่อด้วยตนเอง (Fallback)...');
      
      const extractedName = normalizeText(extractedData.personName || '');
      const fatherName = normalizeText(profileData.father?.name || '');
      const motherName = normalizeText(profileData.mother?.name || '');

      // พยายามจับคู่กับชื่อบิดา
      if (fatherName && (extractedName.includes(fatherName) || fatherName.includes(extractedName))) {
        console.log('✅ จับคู่ชื่อกับบิดาสำเร็จ (Fallback)');
        const personLabel = 'บิดา (ผู้ปกครองเดี่ยว)';
        return compareSinglePersonData(extractedData, profileData.father, personLabel, normalizeText, parseNumber);
      }
      // พยายามจับคู่กับชื่อมารดา
      else if (motherName && (extractedName.includes(motherName) || motherName.includes(extractedName))) {
        console.log('✅ จับคู่ชื่อกับมารดาสำเร็จ (Fallback)');
        const personLabel = 'มารดา (ผู้ปกครองเดี่ยว)';
        return compareSinglePersonData(extractedData, profileData.mother, personLabel, normalizeText, parseNumber);
      }
      // *** แก้ไข: เพิ่มการตรวจสอบคำว่า "มารดา" ในข้อความที่สกัดได้ ***
      else if (extractedData.rawResponse && normalizeText(extractedData.rawResponse).includes('มารดาของผู้ขอกู้ยืมเงิน')) {
        console.log('✅ ตรวจพบคำว่า "มารดาของผู้ขอกู้ยืมเงิน" ในข้อความ จับคู่กับมารดา (Fallback)');
        const personLabel = 'มารดา (ผู้ปกครองเดี่ยว)';
        return compareSinglePersonData(extractedData, profileData.mother, personLabel, normalizeText, parseNumber);
      }
      // *** แก้ไข: เพิ่มการตรวจสอบคำว่า "บิดา" ในข้อความที่สกัดได้ ***
      else if (extractedData.rawResponse && normalizeText(extractedData.rawResponse).includes('บิดาของผู้ขอกู้ยืมเงิน')) {
        console.log('✅ ตรวจพบคำว่า "บิดาของผู้ขอกู้ยืมเงิน" ในข้อความ จับคู่กับบิดา (Fallback)');
        const personLabel = 'บิดา (ผู้ปกครองเดี่ยว)';
        return compareSinglePersonData(extractedData, profileData.father, personLabel, normalizeText, parseNumber);
      }
      // ถ้าจับคู่ไม่ได้ทั้งบิดาและมารดา
      else {
        console.log('⚠️ ไม่สามารถจับคู่ชื่อได้แม้จะลองด้วยตนเอง');
        return {
          matchStatus: 'no_match',
          matches: {},
          mismatches: [],
          warnings: ['AI ไม่สามารถระบุว่าเอกสารนี้เป็นของบิดาหรือมารดาได้ และไม่สามารถจับคู่ชื่อกับข้อมูลในโปรไฟล์ได้ กรุณาตรวจสอบชื่อในเอกสาร']
        };
      }
    }
    const profileSection = profileData[matchedProfileType];
    const personLabel = matchedProfileType === 'father' ? 'บิดา (ผู้ปกครองเดี่ยว)' : 'มารดา (ผู้ปกครองเดี่ยว)';
    if (!profileSection || !profileSection.name) {
      return {
        matchStatus: 'no_profile_data',
        matches: {},
        mismatches: [],
        warnings: [`ไม่มีข้อมูล${personLabel}ในโปรไฟล์สำหรับเปรียบเทียบ แม้ว่า AI ระบุตัวตนแล้ว`]
      };
    }
    return compareSinglePersonData(extractedData, profileSection, personLabel, normalizeText, parseNumber);
  }

  return {
    matchStatus: 'no_profile_data',
    matches: {},
    mismatches: [],
    warnings: ['ไม่สามารถระบุประเภทเอกสารสำหรับเปรียบเทียบได้']
  };
};

// *** แก้ไข: ปรับปรุงฟังก์ชันเปรียบเทียบข้อมูลบุคคลเดี่ยว โดยเพิ่มความอดทนในการเปรียบเทียบรายได้ ***
const compareSinglePersonData = (extractedData, profileSection, personLabel, normalizeText, parseNumber) => {
  const matches = {};
  const mismatches = [];
  const warnings = [];
  const fieldMapping = [
    { formKey: 'personName', profileKey: 'name', label: `ชื่อ-นามสกุล ${personLabel}`, normalize: true, required: true },
    { formKey: 'occupation', profileKey: 'occupation', label: `อาชีพ ${personLabel}`, normalize: true, required: false, flexibleMatch: true },
    { formKey: 'annualIncome', profileKey: 'annualIncome', label: `รายได้ต่อปี ${personLabel}`, normalize: false, required: true, isNumeric: true },
  ];

  fieldMapping.forEach(({ formKey, profileKey, label, normalize, required, isNumeric, flexibleMatch }) => {
    const formValue = extractedData[formKey];
    const profileValue = profileSection[profileKey];
    if (!formValue || formValue === '' || formValue === '-') {
      if (profileValue && required) {
        mismatches.push({ field: formKey, label, extracted: 'ไม่มีข้อมูล', profile: profileValue, severity: required ? 'high' : 'low' });
      }
      return;
    }
    if (!profileValue || profileValue === '') {
      if (required) warnings.push(`ไม่มีข้อมูล ${label} ในโปรไฟล์เพื่อเปรียบเทียบ`);
      return;
    }

    let isMatch = false;
    if (isNumeric) {
      const formNum = parseNumber(formValue);
      const profileNum = parseNumber(profileValue);
      const tolerance = profileNum * 0.2;
      if (Math.abs(formNum - profileNum) <= tolerance) {
        isMatch = true;
      } else if (Math.abs(formNum - profileNum) <= profileNum * 0.3) { 
        isMatch = true; 
        warnings.push(`${label} ใกล้เคียงกัน แต่ต่างกัน ${Math.abs(formNum - profileNum).toLocaleString()} บาท`); 
      }
    } else if (normalize) {
      const normalizedForm = normalizeText(formValue);
      const normalizedProfile = normalizeText(profileValue);
      
      if (flexibleMatch) {
        // การเปรียบเทียบอาชีพแบบยืดหยุ่น
        const flexibleOccupationMatch = (form, profile) => {
          // ถ้าตรงกันทุกตัวอักษร
          if (form === profile) return true;
          
          // ถ้ามีคำที่ตรงกันบางส่วน
          if (form.includes(profile) || profile.includes(form)) return true;
          
          // ถ้าเป็นอาชีพที่เกี่ยวข้องกัน
          const relatedOccupations = {
            'อิสระ': ['ธุรกิจส่วนตัว', 'เจ้าของกิจการ', 'ค้าขาย', 'รับจ้าง', 'อาชีพอิสระ', 'freelance'],
            'ธุรกิจส่วนตัว': ['อิสระ', 'เจ้าของกิจการ', 'ค้าขาย', 'รับจ้าง', 'อาชีพอิสระ', 'freelance'],
            'เจ้าของกิจการ': ['อิสระ', 'ธุรกิจส่วนตัว', 'ค้าขาย', 'รับจ้าง', 'อาชีพอิสระ', 'freelance'],
            'รับจ้าง': ['อิสระ', 'ธุรกิจส่วนตัว', 'เจ้าของกิจการ', 'ค้าขาย', 'อาชีพอิสระ', 'freelance'],
            'ค้าขาย': ['อิสระ', 'ธุรกิจส่วนตัว', 'เจ้าของกิจการ', 'รับจ้าง', 'อาชีพอิสระ', 'freelance'],
            'บริษัท': ['พนักงาน', 'ลูกจ้าง', 'รับจ้าง'],
            'พนักงาน': ['บริษัท', 'ลูกจ้าง', 'รับจ้าง'],
            'ลูกจ้าง': ['บริษัท', 'พนักงาน', 'รับจ้าง'],
            'ข้าราชการ': ['รัฐวิสาหกิจ', 'พนักงานรัฐวิสาหกิจ'],
            'รัฐวิสาหกิจ': ['ข้าราชการ', 'พนักงานรัฐวิสาหกิจ'],
            'พนักงานรัฐวิสาหกิจ': ['ข้าราชการ', 'รัฐวิสาหกิจ'],
            'เกษตรกร': ['เกษตร', 'ทำนา', 'ทำไร่', 'เลี้ยงสัตว์'],
            'เกษตร': ['เกษตรกร', 'ทำนา', 'ทำไร่', 'เลี้ยงสัตว์'],
            'ทำนา': ['เกษตรกร', 'เกษตร', 'ทำไร่', 'เลี้ยงสัตว์'],
            'ทำไร่': ['เกษตรกร', 'เกษตร', 'ทำนา', 'เลี้ยงสัตว์'],
            'เลี้ยงสัตว์': ['เกษตรกร', 'เกษตร', 'ทำนา', 'ทำไร่']
          };
          
          // ตรวจสอบว่ามีคำที่เกี่ยวข้องกันหรือไม่
          for (const [key, related] of Object.entries(relatedOccupations)) {
            if ((form.includes(key) || profile.includes(key)) && 
                related.some(occ => form.includes(occ) || profile.includes(occ))) {
              return true;
            }
          }
          
          return false;
        };
        
        if (flexibleOccupationMatch(normalizedForm, normalizedProfile)) {
          isMatch = true;
          // ถ้าเป็นการจับคู่แบบยืดหยุ่น ให้เพิ่มคำเตือน
          if (normalizedForm !== normalizedProfile) {
            warnings.push(`${label} ใกล้เคียงกัน: เอกสาร="${formValue}" โปรไฟล์="${profileValue}"`);
          }
        }
      } else {
        // การเปรียบเทียบแบบปกติ
        if (normalizedForm === normalizedProfile) isMatch = true;
        else if (normalizedForm.includes(normalizedProfile) || normalizedProfile.includes(normalizedForm)) isMatch = true;
      }
    } else {
      const cleanForm = formValue.toString().replace(/\D/g, '');
      const cleanProfile = profileValue.toString().replace(/\D/g, '');
      isMatch = cleanForm === cleanProfile;
    }

    if (isMatch) matches[formKey] = true;
    else {
      matches[formKey] = false;
      mismatches.push({ field: formKey, label, extracted: formValue, profile: profileValue, severity: required ? 'medium' : 'low' });
    }
  });

  const totalFields = fieldMapping.length;
  const matchedCount = Object.values(matches).filter(v => v === true).length;
  const mismatchedCount = mismatches.length;
  let matchStatus = 'unknown';
  let matchPercentage = 0;

  if (totalFields > 0) matchPercentage = Math.round((matchedCount / totalFields) * 100);

  if (mismatchedCount === 0 && warnings.length === 0) matchStatus = 'full_match';
  else if (mismatchedCount === 0 && warnings.length <= 2) matchStatus = 'good_match';
  else if (mismatchedCount === 0) matchStatus = 'partial_match';
  else if (matchPercentage >= 70) matchStatus = 'good_match';
  else if (matchPercentage >= 50) matchStatus = 'partial_match';
  else matchStatus = 'mismatch';

  return {
    matchStatus, matches, mismatches, warnings,
    comparisonDetails: { fieldsCompared: totalFields, fieldsMatched: matchedCount, fieldsMismatched: mismatchedCount, personType: personLabel },
    matchPercentage
  };
};

// Check if AI backend server is available - คงเดิม
const checkBackendServer = async () => {
  try {
    console.log('🔍 Checking backend server for IncomeCert at:', AI_BACKEND_URL);
    const response = await fetch(`${AI_BACKEND_URL}/health`, { method: 'GET', headers: { 'Content-Type': 'application/json', }, timeout: 10000, });
    if (response.ok) { const data = await response.json(); console.log('✓ AI Backend Server is available for IncomeCert:', data.status); return true; }
    else { console.log('❌ Backend server responded with error:', response.status); return false; }
  } catch (error) { console.log('❌ AI Backend Server not available for IncomeCert:', error.message); return false; }
};

// Server-side validation for Income Certificate - คงเดิม
const validateIncomeCertViaServer = async (fileUri, certType, mimeType, profileData) => {
  try {
    console.log(`📤 Uploading to server for ${certType} income cert validation...`);
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) throw new Error('File does not exist');
    const formData = new FormData();
    const file = { uri: fileUri, type: mimeType || 'image/jpeg', name: `incomecert_${certType}_${Date.now()}.${mimeType ? mimeType.split('/')[1] : 'jpg'}`, };
    formData.append('document', file);
    if (profileData) formData.append('profileData', JSON.stringify(profileData));
    const response = await fetch(`${AI_BACKEND_URL}/ai/validate/incomecert/${certType}`, { method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data', }, });
    if (!response.ok) { const errorText = await response.text(); console.error('Server validation error:', errorText); throw new Error(`Server returned ${response.status}: ${errorText}`); }
    const result = await response.json();
    console.log('✅ Server IncomeCert validation completed');
    return { ...result.validation, requestedCertType: certType };
  } catch (error) { console.error('❌ Server IncomeCert validation error:', error); throw error; }
};

// Convert file to format suitable for Gemini (client-side) - คงเดิม
const prepareFileForGemini = async (fileUri, mimeType) => {
  try {
    console.log('📁 Preparing IncomeCert file for Gemini AI...');
    const base64Data = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64, });
    let actualMimeType = mimeType;
    if (!actualMimeType) { const fileExtension = fileUri.split('.').pop()?.toLowerCase(); switch (fileExtension) { case 'jpg': case 'jpeg': actualMimeType = 'image/jpeg'; break; case 'png': actualMimeType = 'image/png'; break; case 'pdf': actualMimeType = 'application/pdf'; break; default: actualMimeType = 'image/jpeg'; } }
    console.log('✅ IncomeCert file prepared for Gemini');
    return { inlineData: { data: base64Data, mimeType: actualMimeType, }, };
  } catch (error) { console.error('❌ Error preparing IncomeCert file for Gemini:', error); throw new Error(`ไม่สามารถเตรียมไฟล์สำหรับการวิเคราะห์ได้: ${error.message}`); }
};

// *** แก้ไข: ปรับ Prompt ให้ส่งข้อมูลโปรไฟล์ที่เกี่ยวข้องกับ certType ที่เลือก และเน้นการสกัดรายได้เป็นรายปี ***
const validateIncomeCertClientSide = async (fileUri, certType, mimeType, profileData) => {
  console.log(`🤖 Starting client-side ${certType} income cert validation...`);
  if (!model) { const initialized = initializeGemini(); if (!initialized) throw new Error('ระบบ AI ไม่พร้อมใช้งาน'); }
  const filePart = await prepareFileForGemini(fileUri, mimeType);
  const certTypeText = { 
    'father': 'บิดา', 
    'mother': 'มารดา', 
    'guardian': 'ผู้ปกครอง', 
    'single_parent': 'ผู้ปกครองเดี่ยว', 
    'family': 'ครอบครัว', 
    'famo_income_cert': 'ครอบครัว',
    'father_income_cert': 'บิดา (มีรายได้ไม่ประจำ)',
    'mother_income_cert': 'มารดา (มีรายได้ไม่ประจำ)',
    // *** เพิ่ม: กรณีผู้ปกครอง (มีรายได้ไม่ประจำ) ***
    'guardian_income_cert': 'ผู้ปกครอง (มีรายได้ไม่ประจำ)',
    'single_parent_income_cert': 'ผู้ปกครองเดี่ยว (มีรายได้ไม่ประจำ)'
  };

  let profileInfo = '';
  if (profileData) {
    if (certType === 'father' || certType === 'father_income_cert') {
      profileInfo = `\n**ข้อมูลโปรไฟล์สำหรับเปรียบเทียบ (บิดา):**\n- ชื่อ-นามสกุล: ${profileData.father?.name || 'ไม่ระบุ'}\n- อาชีพ: ${profileData.father?.occupation || 'ไม่ระบุ'}\n- รายได้ต่อปี: ${profileData.father?.annualIncome || 'ไม่ระบุ'}\n\nกรุณาเปรียบเทียบข้อมูลที่สกัดได้กับข้อมูลโปรไฟล์ของบิดา\n**หมายเหตุ: ไม่ต้องตรวจสอบเลขบัตรประชาชน**`;
    } else if (certType === 'mother' || certType === 'mother_income_cert') {
      profileInfo = `\n**ข้อมูลโปรไฟล์สำหรับเปรียบเทียบ (มารดา):**\n- ชื่อ-นามสกุล: ${profileData.mother?.name || 'ไม่ระบุ'}\n- อาชีพ: ${profileData.mother?.occupation || 'ไม่ระบุ'}\n- รายได้ต่อปี: ${profileData.mother?.annualIncome || 'ไม่ระบุ'}\n\nกรุณาเปรียบเทียบข้อมูลที่สกัดได้กับข้อมูลโปรไฟล์ของมารดา\น**หมายเหตุ: ไม่ต้องตรวจสอบเลขบัตรประชาชน**`;
    } else if (certType === 'guardian' || certType === 'guardian_income_cert') {
      profileInfo = `\n**ข้อมูลโปรไฟล์สำหรับเปรียบเทียบ (ผู้ปกครอง):**\n- ชื่อ-นามสกุล: ${profileData.guardian?.name || 'ไม่ระบุ'}\n- อาชีพ: ${profileData.guardian?.occupation || 'ไม่ระบุ'}\n- รายได้ต่อปี: ${profileData.guardian?.annualIncome || 'ไม่ระบุ'}\n\nกรุณาเปรียบเทียบข้อมูลที่สกัดได้กับข้อมูลโปรไฟล์ของผู้ปกครอง\n**หมายเหตุ: ไม่ต้องตรวจสอบเลขบัตรประชาชน**`;
    } else if (certType === 'family' || certType === 'famo_income_cert') {
      profileInfo = `\n**ข้อมูลโปรไฟล์สำหรับเปรียบเทียบ (ครอบครัว - บิดาและมารดา):**\n**บิดา:**\n- ชื่อ-นามสกุล: ${profileData.father?.name || 'ไม่ระบุ'}\n- อาชีพ: ${profileData.father?.occupation || 'ไม่ระบุ'}\n- รายได้ต่อปี: ${profileData.father?.annualIncome || 'ไม่ระบุ'}\n\n**มารดา:**\n- ชื่อ-นามสกุล: ${profileData.mother?.name || 'ไม่ระบุ'}\n- อาชีพ: ${profileData.mother?.occupation || 'ไม่ระบุ'}\n- รายได้ต่อปี: ${profileData.mother?.annualIncome || 'ไม่ระบุ'}\n\nกรุณาเปรียบเทียบข้อมูลที่สกัดได้กับข้อมูลโปรไฟล์ทั้งบิดาและมารดา\น**หมายเหตุ: ไม่ต้องตรวจสอบเลขบัตรประชาชน**`;
    } else if (certType === 'single_parent' || certType === 'single_parent_income_cert') {
      profileInfo = `
**ข้อมูลโปรไฟล์สำหรับเปรียบเทียบ (ผู้ปกครองเดี่ยว):**
- ชื่อบิดา (จากโปรไฟล์): ${profileData.father?.name || 'ไม่มีข้อมูล'}
- ชื่อมารดา (จากโปรไฟล์): ${profileData.mother?.name || 'ไม่มีข้อมูล'}
`;
    }
  }

  // *** แก้ไข: เพิ่มคำสั่งที่ชัดเจนสำหรับการสกัดข้อมูลอาชีพและสถานที่ทำงาน ***
  const extractionInstructions = `
**คำสั่งพิเศษสำหรับการสกัดข้อมูล:**
- ให้สกัดข้อมูล 'occupation' จากข้อความที่อยู่ถัดจากคำว่า 'อาชีพ:' โดยตรงเท่านั้น
- **ห้ามสกัดข้อมูลจากส่วนของ 'สถานที่ทำงาน' หรือ 'ที่อยู่' ภายใต้กรณีใดๆ ก็ตาม**
- ให้สกัดข้อมูล 'workplace' จากข้อความที่อยู่ถัดจากคำว่า 'สถานที่ทำงาน:' หรือ 'ที่ทำงาน:' เท่านั้น
- อาจมีชื่อสถานที่ที่เป็นชื่ออาชีพ (เช่น "ร้านอิสระ") ให้ตรวจสอบให้ดีว่าเป็นข้อมูลในส่วนไหน
`;

  let prompt = '';
  if (certType === 'family' || certType === 'famo_income_cert') {
    prompt = `ตรวจสอบเอกสารนี้ว่าเป็นหนังสือรับรองรายได้ (กยศ 102) หรือไม่

 ${profileInfo}

 ${extractionInstructions}

**สำคัญ: เอกสารนี้เป็นหนังสือรับรองรายได้ครอบครัว**
**หมายเหตุ: ไม่ต้องดึงหรือตรวจสอบเลขบัตรประชาชน**
**สำคัญมาก: กรุณาสกัดข้อมูลรายได้เป็นรายได้ต่อปีเท่านั้น หากพบข้อมูลรายได้ต่อเดือนให้คูณด้วย 12**

**คำสั่งพิเศษสำหรับการระบุตัวตน:**
- ชื่อบิดาจะมีคำว่า "บิดาของผู้ขอกู้ยืมเงิน" นำหน้าชื่อ
- ชื่อมารดาจะมีคำว่า "มารดาของผู้ขอกู้ยืมเงิน" นำหน้าชื่อ
- **ห้ามสกัดชื่อผู้รับรอง (เจ้าหน้าที่)** ให้สกัดเฉพาะชื่อบิดาและมารดาเท่านั้น

กรุณาแยกข้อมูลของบิดาและมารดาออกจากกัน และส่งกลับมาในรูปแบบ:
{
  "isIncomeCert": true/false,
  "certType": "family",
  "confidence": 0-100,
  "documentType": "กยศ 102/หนังสือรับรองรายได้/อื่นๆ",
  "hasOfficialSeal": true/false,
  "hasSignature": true/false,
  "signatureQuality": "clear/unclear/missing",
  "issuingAuthority": "หน่วยงานที่ออกเอกสาร",
  "extractedData": {
    "fatherData": {
      "personName": "ชื่อ-นามสกุลของบิดา (ไม่รวมคำว่า 'บิดาของผู้ขอกู้ยืมเงิน')",
      "annualIncome": "รายได้ต่อปี (ตัวเลขเท่านั้น)",
      "occupation": "อาชีพ",
      "workplace": "สถานที่ทำงาน"
    },
    "motherData": {
      "personName": "ชื่อ-นามสกุลของมารดา (ไม่รวมคำว่า 'มารดาของผู้ขอกู้ยืมเงิน')",
      "annualIncome": "รายได้ต่อปี (ตัวเลขเท่านั้น)",
      "occupation": "อาชีพ",
      "workplace": "สถานที่ทำงาน"
    }
  },
  "incomeDetails": {
    "salary": "เงินเดือน",
    "allowance": "เบี้ยเลี้ยง/ค่าตอบแทน",
    "bonus": "โบนัส",
    "otherIncome": "รายได้อื่น",
    "totalIncome": "รายได้รวม"
  },
  "documentQuality": {
    "isExpired": true/false/null,
    "isLegible": true/false,
    "hasWatermark": true/false,
    "imageQuality": "clear/blurry/poor/excellent"
  },
  "qualityIssues": ["ปัญหาที่พบ"],
  "recommendations": ["คำแนะนำ"],
  "overall_status": "valid/invalid/needs_review"
}`;
  }
  else if (certType === 'father_income_cert') {
    prompt = `ตรวจสอบเอกสารนี้ว่าเป็นหนังสือรับรองรายได้ (กยศ 102) หรือไม่

 ${profileInfo}

 ${extractionInstructions}

**คำสั่งสำคัญสำหรับเอกสารรายได้บิดา (father_income_cert):**
1. เอกสารนี้เป็นหนังสือรับรองรายได้ของบิดาเท่านั้น แม้ว่าในเอกสารอาจมีชื่อมารดาปรากฏอยู่ด้วย
2. **ห้ามสกัดข้อมูลของมารดา** ให้สกัดเฉพาะข้อมูลของบิดาเท่านั้น
3. **สำคัญมาก: กรุณาสกัดข้อมูลรายได้เป็นรายได้ต่อปีเท่านั้น หากพบข้อมูลรายได้ต่อเดือนให้คูณด้วย 12**
4. จับคู่ชื่อที่สกัดได้กับชื่อบิดาจากโปรไฟล์ที่ให้ไว้ข้างต้น

**คำสั่งพิเศษสำหรับการระบุตัวตน:**
- ชื่อบิดาจะมีคำว่า "บิดาของผู้ขอกู้ยืมเงิน" นำหน้าชื่อ
- **ห้ามสกัดชื่อผู้รับรอง (เจ้าหน้าที่)** ให้สกัดเฉพาะชื่อบิดาเท่านั้น

กรุณาตอบในรูปแบบ JSON ดังนี้:
{
  "isIncomeCert": true/false,
  "certType": "father",
  "confidence": 0-100,
  "documentType": "กยศ 102/หนังสือรับรองรายได้/อื่นๆ",
  "hasOfficialSeal": true/false,
  "hasSignature": true/false,
  "signatureQuality": "clear/unclear/missing",
  "issuingAuthority": "หน่วยงานที่ออกเอกสาร",
  "extractedData": {
    "personName": "ชื่อ-นามสกุลของบิดาเท่านั้น (ไม่รวมคำว่า 'บิดาของผู้ขอกู้ยืมเงิน')",
    "annualIncome": "รายได้ต่อปีของบิดา (ตัวเลขเท่านั้น)",
    "occupation": "อาชีพของบิดา",
    "workplace": "สถานที่ทำงานของบิดา",
    "issueDate": "วันที่ออกเอกสาร",
    "officerName": "ชื่อเจ้าหน้าที่ผู้รับรอง",
    "officerPosition": "ตำแหน่งเจ้าหน้าที่"
  },
  "incomeDetails": {
    "salary": "เงินเดือน",
    "allowance": "เบี้ยเลี้ยง/ค่าตอบแทน",
    "bonus": "โบนัส",
    "otherIncome": "รายได้อื่น",
    "totalIncome": "รายได้รวม"
  },
  "documentQuality": {
    "isExpired": true/false/null,
    "isLegible": true/false,
    "hasWatermark": true/false,
    "imageQuality": "clear/blurry/poor/excellent"
  },
  "qualityIssues": ["ปัญหาที่พบ"],
  "recommendations": ["คำแนะนำ"],
  "overall_status": "valid/invalid/needs_review"
}

**คำเตือน:** อย่าสกัดข้อมูลของมารดาโดยเด็ดขาด ให้สกัดเฉพาะข้อมูลของบิดาเท่านั้น`;
  }
  else if (certType === 'mother_income_cert') {
    prompt = `ตรวจสอบเอกสารนี้ว่าเป็นหนังสือรับรองรายได้ (กยศ 102) หรือไม่

 ${profileInfo}

 ${extractionInstructions}

**คำสั่งสำคัญสำหรับเอกสารรายได้มารดา (mother_income_cert):**
1. เอกสารนี้เป็นหนังสือรับรองรายได้ของมารดาเท่านั้น แม้ว่าในเอกสารอาจมีชื่อบิดาปรากฏอยู่ด้วย
2. **ห้ามสกัดข้อมูลของบิดา** ให้สกัดเฉพาะข้อมูลของมารดาเท่านั้น
3. **สำคัญมาก: กรุณาสกัดข้อมูลรายได้เป็นรายได้ต่อปีเท่านั้น หากพบข้อมูลรายได้ต่อเดือนให้คูณด้วย 12**
4. จับคู่ชื่อที่สกัดได้กับชื่อมารดาจากโปรไฟล์ที่ให้ไว้ข้างต้น

**คำสั่งพิเศษสำหรับการระบุตัวตน:**
- ชื่อมารดาจะมีคำว่า "มารดาของผู้ขอกู้ยืมเงิน" นำหน้าชื่อ
- **ห้ามสกัดชื่อผู้รับรอง (เจ้าหน้าที่)** ให้สกัดเฉพาะชื่อมารดาเท่านั้น

กรุณาตอบในรูปแบบ JSON ดังนี้:
{
  "isIncomeCert": true/false,
  "certType": "mother",
  "confidence": 0-100,
  "documentType": "กยศ 102/หนังสือรับรองรายได้/อื่นๆ",
  "hasOfficialSeal": true/false,
  "hasSignature": true/false,
  "signatureQuality": "clear/unclear/missing",
  "issuingAuthority": "หน่วยงานที่ออกเอกสาร",
  "extractedData": {
    "personName": "ชื่อ-นามสกุลของมารดาเท่านั้น (ไม่รวมคำว่า 'มารดาของผู้ขอกู้ยืมเงิน')",
    "annualIncome": "รายได้ต่อปีของมารดา (ตัวเลขเท่านั้น)",
    "occupation": "อาชีพของมารดา",
    "workplace": "สถานที่ทำงานของมารดา",
    "issueDate": "วันที่ออกเอกสาร",
    "officerName": "ชื่อเจ้าหน้าที่ผู้รับรอง",
    "officerPosition": "ตำแหน่งเจ้าหน้าที่"
  },
  "incomeDetails": {
    "salary": "เงินเดือน",
    "allowance": "เบี้ยเลี้ยง/ค่าตอบแทน",
    "bonus": "โบนัส",
    "otherIncome": "รายได้อื่น",
    "totalIncome": "รายได้รวม"
  },
  "documentQuality": {
    "isExpired": true/false/null,
    "isLegible": true/false,
    "hasWatermark": true/false,
    "imageQuality": "clear/blurry/poor/excellent"
  },
  "qualityIssues": ["ปัญหาที่พบ"],
  "recommendations": ["คำแนะนำ"],
  "overall_status": "valid/invalid/needs_review"
}

**คำเตือน:** อย่าสกัดข้อมูลของบิดาโดยเด็ดขาด ให้สกัดเฉพาะข้อมูลของมารดาเท่านั้น`;
  }
  // *** เพิ่ม: Prompt สำหรับเอกสารผู้ปกครอง (มีรายได้ไม่ประจำ) ***
  else if (certType === 'guardian_income_cert') {
    prompt = `ตรวจสอบเอกสารนี้ว่าเป็นหนังสือรับรองรายได้ (กยศ 102) หรือไม่

 ${profileInfo}

 ${extractionInstructions}

**คำสั่งสำคัญสำหรับเอกสารรายได้ผู้ปกครอง (guardian_income_cert):**
1. เอกสารนี้เป็นหนังสือรับรองรายได้ของผู้ปกครองเท่านั้น แม้ว่าในเอกสารอาจมีชื่อบิดาหรือมารดาปรากฏอยู่ด้วย
2. **ห้ามสกัดข้อมูลของบิดาหรือมารดา** ให้สกัดเฉพาะข้อมูลของผู้ปกครองเท่านั้น
3. **สำคัญมาก: กรุณาสกัดข้อมูลรายได้เป็นรายได้ต่อปีเท่านั้น หากพบข้อมูลรายได้ต่อเดือนให้คูณด้วย 12**
4. จับคู่ชื่อที่สกัดได้กับชื่อผู้ปกครองจากโปรไฟล์ที่ให้ไว้ข้างต้น

**คำสั่งพิเศษสำหรับการระบุตัวตน:**
- ชื่อผู้ปกครองจะมีคำว่า "ผู้ปกครองของผู้ขอกู้ยืมเงิน" นำหน้าชื่อ
- **ห้ามสกัดชื่อผู้รับรอง (เจ้าหน้าที่)** ให้สกัดเฉพาะชื่อผู้ปกครองเท่านั้น

กรุณาตอบในรูปแบบ JSON ดังนี้:
{
  "isIncomeCert": true/false,
  "certType": "guardian",
  "confidence": 0-100,
  "documentType": "กยศ 102/หนังสือรับรองรายได้/อื่นๆ",
  "hasOfficialSeal": true/false,
  "hasSignature": true/false,
  "signatureQuality": "clear/unclear/missing",
  "issuingAuthority": "หน่วยงานที่ออกเอกสาร",
  "extractedData": {
    "personName": "ชื่อ-นามสกุลของผู้ปกครองเท่านั้น (ไม่รวมคำว่า 'ผู้ปกครองของผู้ขอกู้ยืมเงิน')",
    "annualIncome": "รายได้ต่อปีของผู้ปกครอง (ตัวเลขเท่านั้น)",
    "occupation": "อาชีพของผู้ปกครอง",
    "workplace": "สถานที่ทำงานของผู้ปกครอง",
    "issueDate": "วันที่ออกเอกสาร",
    "officerName": "ชื่อเจ้าหน้าที่ผู้รับรอง",
    "officerPosition": "ตำแหน่งเจ้าหน้าที่"
  },
  "incomeDetails": {
    "salary": "เงินเดือน",
    "allowance": "เบี้ยเลี้ยง/ค่าตอบแทน",
    "bonus": "โบนัส",
    "otherIncome": "รายได้อื่น",
    "totalIncome": "รายได้รวม"
  },
  "documentQuality": {
    "isExpired": true/false/null,
    "isLegible": true/false,
    "hasWatermark": true/false,
    "imageQuality": "clear/blurry/poor/excellent"
  },
  "qualityIssues": ["ปัญหาที่พบ"],
  "recommendations": ["คำแนะนำ"],
  "overall_status": "valid/invalid/needs_review"
}

**คำเตือน:** อย่าสกัดข้อมูลของบิดาหรือมารดาโดยเด็ดขาด ให้สกัดเฉพาะข้อมูลของผู้ปกครองเท่านั้น`;
  }
  else if (certType === 'single_parent' || certType === 'single_parent_income_cert') {
    prompt = `ตรวจสอบเอกสารนี้ว่าเป็นหนังสือรับรองรายได้ (กยศ 102) สำหรับผู้ปกครองเดี่ยวหรือไม่

 ${profileInfo}

 ${extractionInstructions}

**ภารกิจหลักของคุณ: ระบุว่าเอกสารนี้เป็นของ "บิดา" หรือ "มารดา"**

**วิธีการระบุ:**
1. ค้นหาข้อมูล (ชื่อ, อาชีพ, รายได้) ที่อยู่ถัดจากคำใดคำหนึ่งต่อไปนี้:
    - **สำหรับบิดา:** "บิดาของผู้ขอกู้ยืมเงิน", "บิดาของผู้กู้ยืม", "ชื่อบิดา", หรือคำว่า **"บิดา"** ที่อยู่ก่อนชื่อบุคคล
    - **สำหรับมารดา:** "มารดาของผู้ขอกู้ยืมเงิน", "มารดาของผู้กู้ยืม", "ชื่อมารดา", หรือคำว่า **"มารดา"** ที่อยู่ก่อนชื่อบุคคล

2. ถ้าคุณพบข้อมูลที่เกี่ยวข้องกับ "บิดา" จากเกณฑ์ข้างต้น ให้กำหนด \`matchedProfile\` เป็น "father" และสกัดข้อมูลเฉพาะของบิดาคนนั้น

3. ถ้าคุณพบข้อมูลที่เกี่ยวข้องกับ "มารดา" จากเกณฑ์ข้างต้น ให้กำหนด \`matchedProfile\` เป็น "mother" และสกัดข้อมูลเฉพาะของมารดาคนนั้น

4. **สำคัญมาก:** สกัดข้อมูลรายได้เป็นรายได้ต่อปีเท่านั้น หากพบรายได้ต่อเดือนให้คูณด้วย 12

**คำเตือน:**
- สกัดข้อมูลเพียงคนเดียวเท่านั้น (บิดา หรือ มารดา)
- ห้ามสกัดข้อมูลของเจ้าหน้าที่ผู้รับรอง
- หากไม่สามารถระบุได้ชัดเจนว่าเป็นของบิดาหรือมารดา ให้กำหนด \`matchedProfile\` เป็น "unknown"

กรุณาตอบในรูปแบบ JSON ดังนี้:
{
  "isIncomeCert": true/false,
  "certType": "single_parent",
  "matchedProfile": "father" หรือ "mother" หรือ "unknown",
  "confidence": 0-100,
  "documentType": "กยศ 102/หนังสือรับรองรายได้/อื่นๆ",
  "hasOfficialSeal": true/false,
  "hasSignature": true/false,
  "signatureQuality": "clear/unclear/missing",
  "issuingAuthority": "หน่วยงานที่ออกเอกสาร",
  "extractedData": {
    "personName": "ชื่อ-นามสกุลที่สกัดได้",
    "annualIncome": "รายได้ต่อปี (ตัวเลขเท่านั้น)",
    "occupation": "อาชีพ",
    "workplace": "สถานที่ทำงาน",
    "issueDate": "วันที่ออกเอกสาร",
    "officerName": "ชื่อเจ้าหน้าที่ผู้รับรอง",
    "officerPosition": "ตำแหน่งเจ้าหน้าที่"
  },
  "incomeDetails": {
    "salary": "เงินเดือน",
    "allowance": "เบี้ยเลี้ยง/ค่าตอบแทน",
    "bonus": "โบนัส",
    "otherIncome": "รายได้อื่น",
    "totalIncome": "รายได้รวม"
  },
  "documentQuality": {
    "isExpired": true/false/null,
    "isLegible": true/false,
    "hasWatermark": true/false,
    "imageQuality": "clear/blurry/poor/excellent"
  },
  "qualityIssues": ["ปัญหาที่พบ"],
  "recommendations": ["คำแนะนำ"],
  "overall_status": "valid/invalid/needs_review"
}`;
  }
  else {
    prompt = `ตรวจสอบเอกสารนี้ว่าเป็นหนังสือรับรองรายได้ (กยศ 102) หรือไม่

 ${profileInfo}

 ${extractionInstructions}

**คำสั่งพิเศษสำหรับการระบุตัวตน:**
- ชื่อบิดาจะมีคำว่า "บิดาของผู้ขอกู้ยืมเงิน" นำหน้าชื่อ
- ชื่อมารดาจะมีคำว่า "มารดาของผู้ขอกู้ยืมเงิน" นำหน้าชื่อ
- **ห้ามสกัดชื่อผู้รับรอง (เจ้าหน้าที่)** ให้สกัดเฉพาะชื่อบิดาหรือมารดาเท่านั้น

กรุณาตรวจสอบและตอบในรูปแบบ JSON ดังนี้:
{
  "isIncomeCert": true/false,
  "certType": "person",
  "confidence": 0-100,
  "documentType": "กยศ 102/หนังสือรับรองรายได้/หนังสือรับรองเงินเดือน/อื่นๆ",
  "hasOfficialSeal": true/false,
  "hasSignature": true/false,
  "signatureQuality": "clear/unclear/missing",
  "issuingAuthority": "หน่วยงานที่ออกเอกสาร",
  "extractedData": {
    "personName": "ชื่อ-นามสกุลผู้รับรอง (ไม่รวมคำว่า 'บิดาของผู้ขอกู้ยืมเงิน' หรือ 'มารดาของผู้ขอกู้ยืมเงิน')",
    "annualIncome": "รายได้ต่อปี (ตัวเลขเท่านั้น)",
    "occupation": "อาชีพ",
    "workplace": "สถานที่ทำงาน",
    "issueDate": "วันที่ออกเอกสาร",
    "expiryDate": "วันหมดอายุ",
    "officerName": "ชื่อเจ้าหน้าที่ผู้รับรอง",
    "officerPosition": "ตำแหน่งเจ้าหน้าที่"
  },
  "incomeDetails": {
    "salary": "เงินเดือน",
    "allowance": "เบี้ยเลี้ยง/ค่าตอบแทน",
    "bonus": "โบนัส",
    "otherIncome": "รายได้อื่น",
    "totalIncome": "รายได้รวม"
  },
  "documentQuality": {
    "isExpired": true/false/null,
    "isLegible": true/false,
    "hasWatermark": true/false,
    "imageQuality": "clear/blurry/poor/excellent"
  },
  "qualityIssues": ["ปัญหาที่พบ"],
  "recommendations": ["คำแนะนำ"],
  "overall_status": "valid/invalid/needs_review"
}

**หมายเหตุสำคัญ:** อย่าพยายามระบุประเภทของผู้รับรอง (ว่าเป็นบิดา มารดา หรือผู้ปกครอง) ในช่อง "certType" ให้ใส่ค่าเป็น "person" ระบบจะทำการจับคู่โดยอัตโนมัติ
**สำคัญมาก: กรุณาสกัดข้อมูลรายได้เป็นรายได้ต่อปีเท่านั้น หากพบข้อมูลรายได้ต่อเดือนให้คูณด้วย 12**`;
  }

  // เพิ่มคำสั่งทั่วไปที่ใช้กับทุกประเภท
  prompt += `

ให้ความสำคัญกับ:
1. การระบุว่าเป็นหนังสือรับรองรายได้ (กยศ 102)
2. ตราประทับหน่วยงานราชการ
3. ลายเซ็นเจ้าหน้าที่ผู้รับรอง
4. ข้อมูลรายได้ที่ชัดเจนและสมบูรณ์
5. วันที่ออกเอกสารและวันหมดอายุ
6. ชื่อและตำแหน่งเจ้าหน้าที่ผู้รับรอง
7. หน่วยงานที่ออกเอกสาร
8. **สำคัญมาก: ถ้าเป็นเอกสารครอบครัว ให้แยกข้อมูลบิดาและมารดาออกจากกัน**
9. **ห้ามดึงหรือตรวจสอบเลขบัตรประชาชน**
10. **เปรียบเทียบข้อมูลกับโปรไฟล์ที่ให้มา** - ถ้าข้อมูลไม่ตรงให้ระบุใน qualityIssues
11. **รายได้ให้ดึงเป็นรายปี (บาท/ปี) เท่านั้น**
12. **ถ้ารายได้ตรงกับโปรไฟล์ ให้หลีกเลี่ยงคำแนะนำให้ตรวจสอบรายได้**`;

  try {
    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();
    let parsed;
    try { const jsonMatch = responseText.match(/\{[\s\S]*\}/); if (jsonMatch) parsed = JSON.parse(jsonMatch[0]); else throw new Error('No JSON found'); }
    catch (parseError) { 
      parsed = analyzeIncomeCertTextResponse(responseText, certType); 
    }

    // *** แก้ไข: บังคับให้ certType เป็นค่าที่เราส่งไป ***
    parsed = { ...parsed, requestedCertType: certType, certType: certType };

    // *** แก้ไข: เพิ่มการตรวจสอบ Fallback สำหรับ single_parent ถ้า AI ระบุไม่ได้ ***
    if ((certType === 'single_parent' || certType === 'single_parent_income_cert') && parsed.matchedProfile === 'unknown') {
      console.log('🤖 AI could not identify parent, attempting manual fallback...');
      const lowerText = responseText.toLowerCase();
      if (lowerText.includes('บิดาของผู้ขอกู้ยืมเงิน')) {
        parsed.matchedProfile = 'father';
        console.log('✅ Fallback: Identified as FATHER');
      } else if (lowerText.includes('มารดาของผู้ขอกู้ยืมเงิน')) {
        parsed.matchedProfile = 'mother';
        console.log('✅ Fallback: Identified as MOTHER');
      } else {
        console.log('⚠️ Fallback: Could not identify parent from text.');
      }
    }

    // *** แก้ไข: ตรวจสอบและแปลงข้อมูลรายได้ให้เป็นรายปี ***
    if ((certType === 'family' || certType === 'famo_income_cert') && parsed.extractedData) {
      if (parsed.extractedData.fatherData && !parsed.extractedData.fatherData.annualIncome && parsed.incomeDetails && parsed.incomeDetails.salary) { const monthlyIncome = parseNumber(parsed.incomeDetails.salary); parsed.extractedData.fatherData.annualIncome = monthlyIncome * 12; }
      if (parsed.extractedData.motherData && !parsed.extractedData.motherData.annualIncome && parsed.incomeDetails && parsed.incomeDetails.salary) { const monthlyIncome = parseNumber(parsed.incomeDetails.salary); parsed.extractedData.motherData.annualIncome = monthlyIncome * 12; }
    } else if (parsed.extractedData && certType !== 'family' && certType !== 'famo_income_cert') {
      if (!parsed.extractedData.annualIncome && parsed.incomeDetails && parsed.incomeDetails.salary) { const monthlyIncome = parseNumber(parsed.incomeDetails.salary); parsed.extractedData.annualIncome = monthlyIncome * 12; }
    }

    if (profileData) {
      const comparison = compareIncomeCertWithUserData(parsed.extractedData, profileData, certType);
      parsed.profileComparison = comparison;
      if (comparison.mismatches.length > 0) {
        parsed.qualityIssues = parsed.qualityIssues || [];
        const meaningfulMismatches = comparison.mismatches.filter(mismatch => {
          if (mismatch.field === 'annualIncome') { const formNum = parseNumber(mismatch.extracted); const profileNum = parseNumber(mismatch.profile); const tolerance = profileNum * 0.2; if (Math.abs(formNum - profileNum) <= tolerance) { console.log(`✅ Income within tolerance, skipping mismatch: ${formNum} vs ${profileNum}`); return false; } } return true;
        });
        meaningfulMismatches.forEach(mismatch => { const severity = mismatch.severity === 'high' ? '❌' : '⚠️'; parsed.qualityIssues.push(`${severity} ${mismatch.label}ไม่ตรงกับโปรไฟล์: เอกสาร="${mismatch.extracted}" โปรไฟล์="${mismatch.profile}"`); });
        if (meaningfulMismatches.length > 0) { parsed.recommendations = parsed.recommendations || []; parsed.recommendations.push('กรุณาตรวจสอบว่าข้อมูลในเอกสารตรงกับข้อมูลในโปรไฟล์'); if (parsed.overall_status === 'valid') parsed.overall_status = 'needs_review'; }
      }
      const meaningfulWarnings = comparison.warnings.filter(warning => !warning.includes('ไม่มีข้อมูล รายได้ต่อเดือน') && !warning.includes('ใกล้เคียงกัน แต่ไม่ตรงทุกตัวอักษร'));
      if (meaningfulWarnings.length > 0) { parsed.recommendations = parsed.recommendations || []; parsed.recommendations.push(...meaningfulWarnings); }
    }
    if (parsed.recommendations) { parsed.recommendations = filterRedundantRecommendations(parsed.recommendations, parsed.extractedData, profileData); }
    console.log('✅ Client-side IncomeCert validation completed');
    return parsed;
  } catch (error) { console.error('❌ Client-side IncomeCert validation failed:', error); throw error; }
};

// *** แก้ไข: อัปเดตรายการประเภทเอกสารที่รองรับ ***
const validateIncomeCert = async (fileUri, certType = 'father', mimeType = null, includeProfileCheck = true) => {
  try {
    console.log(`🚀 Starting ${certType} income cert validation...`);
    const validCertTypes = [
      'father', 'mother', 'guardian', 'single_parent', 'family', 'famo_income_cert',
      'father_income_cert', 'mother_income_cert', 
      // *** เพิ่ม: กรณีผู้ปกครอง (มีรายได้ไม่ประจำ) ***
      'guardian_income_cert', 
      'single_parent_income_cert'
    ];
    if (!validCertTypes.includes(certType)) throw new Error(`ประเภทใบรับรองไม่ถูกต้อง: ${certType}`);
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) throw new Error('ไฟล์ไม่พบ - กรุณาเลือกไฟล์ใหม่');
    let profileData = null;
    if (includeProfileCheck) { profileData = await fetchUserProfileData(); if (profileData) console.log('✅ Profile data loaded for comparison'); }
    if (USE_BACKEND_SERVER) {
      try { const serverAvailable = await checkBackendServer(); if (serverAvailable) { console.log('✅ Using server-side IncomeCert validation'); return await validateIncomeCertViaServer(fileUri, certType, mimeType, profileData); } }
      catch (serverError) { console.log('⚠️ Server IncomeCert validation failed, falling back to client-side:', serverError.message); }
    }
    console.log('✅ Using client-side IncomeCert validation');
    return await validateIncomeCertClientSide(fileUri, certType, mimeType, profileData);
  } catch (error) { console.error('❌ IncomeCert validation error:', error); throw new Error(`การตรวจสอบหนังสือรับรองรายได้ ล้มเหลว: ${error.message}`); }
};

// Fallback text analysis for Income Certificate - *** แก้ไขให้รองรับ matchedProfile ***
const analyzeIncomeCertTextResponse = (text, certType) => {
  const lowerText = text.toLowerCase();
  const isIncomeCert = lowerText.includes('หนังสือรับรองรายได้') || lowerText.includes('กยศ 102') || lowerText.includes('income certificate');
  const hasOfficialSeal = lowerText.includes('ตราประทับ') || lowerText.includes('ตราราชการ');
  const hasSignature = lowerText.includes('ลายเซ็น') || lowerText.includes('ลงชื่อ');
  let fallbackData = { isIncomeCert, certType, confidence: isIncomeCert ? 75 : 25, documentType: isIncomeCert ? 'หนังสือรับรองรายได้' : 'ไม่ทราบ', hasOfficialSeal, hasSignature, signatureQuality: hasSignature ? 'unclear' : 'missing', issuingAuthority: 'ไม่ทราบ', extractedData: {}, incomeDetails: {}, documentQuality: { isExpired: null, isLegible: true, hasWatermark: false, imageQuality: 'unclear' }, qualityIssues: !isIncomeCert ? ['ไม่พบหนังสือรับรองรายได้'] : [], recommendations: !isIncomeCert ? ['กรุณาอัปโหลดหนังสือรับรองรายได้'] : [], overall_status: isIncomeCert && hasOfficialSeal && hasSignature ? 'valid' : 'needs_review', rawResponse: text };
  if (certType === 'single_parent' || certType === 'single_parent_income_cert') {
    if (lowerText.includes('บิดาของผู้ขอกู้ยืมเงิน')) { fallbackData.matchedProfile = 'father'; }
    else if (lowerText.includes('มารดาของผู้ขอกู้ยืมเงิน')) { fallbackData.matchedProfile = 'mother'; }
    else { fallbackData.matchedProfile = 'unknown'; }
  }
  return fallbackData;
};

// Parse and format Income Certificate validation result - คงเดิม
const parseIncomeCertResult = (result) => {
  if (!result) return null;
  return { isValid: result.overall_status === 'valid' && result.isIncomeCert && (result.profileComparison?.matchStatus !== 'mismatch'), confidence: result.confidence || 0, status: result.overall_status || 'unknown', certType: result.certType || 'unknown', documentType: result.documentType || 'ไม่ทราบ', hasOfficialSeal: result.hasOfficialSeal || false, hasSignature: result.hasSignature || false, signatureQuality: result.signatureQuality || 'missing', issuingAuthority: result.issuingAuthority || 'ไม่ทราบ', extractedData: result.extractedData || {}, incomeDetails: result.incomeDetails || {}, documentQuality: result.documentQuality || {}, qualityIssues: result.qualityIssues || [], recommendations: result.recommendations || [], profileComparison: result.profileComparison || null, rawResult: result };
};

// *** แก้ไข: ปรับการแสดงผลให้รองรับการแสดงข้อมูลเฉพาะบุคคล ***
const showIncomeCertValidationAlert = (result, onAccept, onReject) => {
  let title, message;
  const profileMismatch = result.profileComparison?.matchStatus === 'mismatch';
  if (profileMismatch) title = '⚠️ ข้อมูลไม่ตรงกับโปรไฟล์';
  else if (result.overall_status === 'valid') title = '✅ ตรวจสอบหนังสือรับรองรายได้สำเร็จ';
  else title = '⚠️ ตรวจพบปัญหา';

  let statusText = '';
  if (result.isIncomeCert) statusText += '✅ ตรวจพบหนังสือรับรองรายได้\n'; else statusText += '❌ ไม่พบหนังสือรับรองรายได้\n';
  if (result.hasOfficialSeal) statusText += '✅ ตรวจพบตราประทับราชการ\n'; else statusText += '❌ ไม่พบตราประทับราชการ\n';
  if (result.hasSignature) statusText += `✅ ตรวจพบลายเซ็น (${result.signatureQuality})\n`; else statusText += '❌ ไม่พบลายเซ็น\n';
  
  statusText += `\n🎯 ความเชื่อมั่น: ${result.confidence}%\nประเภท: ${getIncomeCertTypeName(result.requestedCertType || result.certType)}\nประเภทเอกสาร: ${result.documentType}`;
  if (result.issuingAuthority && result.issuingAuthority !== 'ไม่ทราบ') statusText += `\nหน่วยงานที่ออก: ${result.issuingAuthority}`;

  if (result.profileComparison) {
    const comp = result.profileComparison;
    statusText += '\n\n👤 เปรียบเทียบกับโปรไฟล์:\n';
    if (comp.matchStatus === 'full_match') statusText += '✅ ข้อมูลตรงกับโปรไฟล์ทุกประการ\n';
    else if (comp.matchStatus === 'good_match') statusText += '✅ ข้อมูลตรงกับโปรไฟล์\n';
    else if (comp.matchStatus === 'partial_match') statusText += '⚠️ ข้อมูลตรงบางส่วน\n';
    else if (comp.matchStatus === 'mismatch') statusText += '❌ พบข้อมูลไม่ตรงกัน\n';
    if (comp.comparisonDetails) {
      const pct = comp.matchPercentage || 0;
      statusText += `\nเปรียบเทียบ: ${comp.comparisonDetails.fieldsMatched}/${comp.comparisonDetails.fieldsCompared} รายการ (${pct}%)\n`;
      if ((result.certType === 'family' || result.certType === 'famo_income_cert') && comp.comparisonDetails.fatherComparison && comp.comparisonDetails.motherComparison) {
        statusText += '\n📊 รายละเอียดการเปรียบเทียบ:\n';
        if (comp.comparisonDetails.fatherComparison) { const fatherPct = comp.comparisonDetails.fatherComparison.matchPercentage || 0; statusText += ` 👨 บิดา: ${fatherPct}% ${comp.comparisonDetails.fatherComparison.matchStatus === 'full_match' ? '✅\n' : comp.comparisonDetails.fatherComparison.matchStatus === 'mismatch' ? '❌\n' : '⚠️\n'}`; }
        if (comp.comparisonDetails.motherComparison) { const motherPct = comp.comparisonDetails.motherComparison.matchPercentage || 0; statusText += ` 👩 มารดา: ${motherPct}% ${comp.comparisonDetails.motherComparison.matchStatus === 'full_match' ? '✅\n' : comp.comparisonDetails.motherComparison.matchStatus === 'mismatch' ? '❌\n' : '⚠️\n'}`; }
      }
    }
  }

  if ((result.certType === 'family' || result.certType === 'famo_income_cert') && result.extractedData) {
    if (result.extractedData.fatherData && Object.keys(result.extractedData.fatherData).length > 0) {
      statusText += '\n\n📋 ข้อมูลบิดา:';
      Object.entries(result.extractedData.fatherData).forEach(([key, value]) => { if (value && key !== 'idNumber') { const label = key === 'personName' ? 'ชื่อ-นามสกุล' : key === 'annualIncome' ? 'รายได้ต่อปี' : key === 'occupation' ? 'อาชีพ' : key === 'workplace' ? 'สถานที่ทำงาน' : key; statusText += `\n• ${label}: ${value}`; } });
    }
    if (result.extractedData.motherData && Object.keys(result.extractedData.motherData).length > 0) {
      statusText += '\n\n📋 ข้อมูลมารดา:';
      Object.entries(result.extractedData.motherData).forEach(([key, value]) => { if (value && key !== 'idNumber') { const label = key === 'personName' ? 'ชื่อ-นามสกุล' : key === 'annualIncome' ? 'รายได้ต่อปี' : key === 'occupation' ? 'อาชีพ' : key === 'workplace' ? 'สถานที่ทำงาน' : key; statusText += `\n• ${label}: ${value}`; } });
    }
  } else if (result.extractedData && result.certType !== 'family' && result.certType !== 'famo_income_cert') {
    const effectiveCertType = result.requestedCertType || result.certType;
    let personLabel = result.profileComparison?.comparisonDetails?.personType;
    if (!personLabel) {
      if (effectiveCertType === 'single_parent' || effectiveCertType === 'single_parent_income_cert') {
        const identifiedParent = result.profileComparison?.comparisonDetails?.personType?.split(' ')[0];
        personLabel = `ผู้ปกครองเดี่ยว (${identifiedParent || 'ไม่ทราบ'})`;
      } else {
        personLabel = effectiveCertType === 'father' || effectiveCertType === 'father_income_cert' ? 'บิดา' : 
                      effectiveCertType === 'mother' || effectiveCertType === 'mother_income_cert' ? 'มารดา' : 
                      effectiveCertType === 'guardian' || effectiveCertType === 'guardian_income_cert' ? 'ผู้ปกครอง' : 
                      'ผู้รับรอง';
      }
    }
    statusText += `\n\n📋 ข้อมูล${personLabel}:`;
    Object.entries(result.extractedData).forEach(([key, value]) => {
      if (value && key !== 'idNumber') {
        const label = key === 'personName' ? 'ชื่อ-นามสกุล' : key === 'annualIncome' ? 'รายได้ต่อปี' : key === 'occupation' ? 'อาชีพ' : key === 'workplace' ? 'สถานที่ทำงาน' : key === 'issueDate' ? 'วันที่ออกเอกสาร' : key === 'officerName' ? 'ชื่อเจ้าหน้าที่' : key === 'officerPosition' ? 'ตำแหน่งเจ้าหน้าที่' : key;
        statusText += `\n• ${label}: ${value}`;
      }
    });
  }

  const meaningfulRecommendations = (result.recommendations || []).filter(rec => !rec.includes('ไม่มีข้อมูล รายได้ต่อเดือน') && !rec.includes('ใกล้เคียงกัน แต่ไม่ตรงทุกตัวอักษร'));
  if (meaningfulRecommendations.length > 0) { statusText += '\n\n💡 คำแนะนำ:\n• ' + meaningfulRecommendations.slice(0, 3).join('\n• '); }

  message = statusText;
  const isValid = result.overall_status === 'valid' && result.isIncomeCert && !profileMismatch;
  const buttons = [{ text: 'ลองใหม่', style: 'cancel', onPress: onReject, }];
  if (isValid || result.overall_status === 'needs_review') { buttons.push({ text: result.overall_status === 'valid' ? 'ใช้ไฟล์นี้' : 'ใช้ไฟล์นี้ (ต้องตรวจสอบ)', onPress: () => onAccept(result), }); }
  Alert.alert(title, message, buttons);
};

// *** แก้ไข: อัปเดตฟังก์ชันแสดงชื่อประเภทเอกสาร ***
const getIncomeCertTypeName = (certType) => { 
  const certTypeNames = { 
    'father': 'บิดา', 
    'mother': 'มารดา', 
    'guardian': 'ผู้ปกครอง', 
    'single_parent': 'ผู้ปกครองเดี่ยว', 
    'family': 'ครอบครัว', 
    'famo_income_cert': 'ครอบครัว',
    'father_income_cert': 'บิดา (มีรายได้ไม่ประจำ)',
    'mother_income_cert': 'มารดา (มีรายได้ไม่ประจำ)',
    // *** เพิ่ม: กรณีผู้ปกครอง (มีรายได้ไม่ประจำ) ***
    'guardian_income_cert': 'ผู้ปกครอง (มีรายได้ไม่ประจำ)',
    'single_parent_income_cert': 'ผู้ปกครองเดี่ยว (มีรายได้ไม่ประจำ)'
  }; 
  return certTypeNames[certType] || 'ไม่ทราบ'; 
};

// Validate multiple Income Certificates - คงเดิม
const validateMultipleIncomeCerts = async (files, includeProfileCheck = true) => {
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await validateIncomeCert(file.uri, file.certType || 'father', file.mimeType, includeProfileCheck);
      results.push({ fileIndex: i, fileName: file.name || file.filename, certType: file.certType || 'father', validation: result, success: true, profileMatch: result.profileComparison?.matchStatus !== 'mismatch' });
    } catch (error) { results.push({ fileIndex: i, fileName: file.name || file.filename, certType: file.certType || 'father', error: error.message, success: false, profileMatch: false }); }
  }
  return results;
};

// Check Income Certificate AI backend status - คงเดิม
const checkIncomeCertAIStatus = async () => {
  try {
    console.log('🤖 Checking IncomeCert AI backend status...');
    if (USE_BACKEND_SERVER) {
      const serverAvailable = await checkBackendServer();
      if (serverAvailable) {
        try { console.log('🔬 Testing IncomeCert AI connection through server...'); const response = await fetch(`${AI_BACKEND_URL}/ai/test`); if (response.ok) { console.log('✓ IncomeCert AI backend server is available and working'); return { available: true, method: 'server', profileCheckEnabled: true, config: { backendUrl: AI_BACKEND_URL, useBackend: USE_BACKEND_SERVER } }; } }
        catch (error) { console.log('❌ Server IncomeCert AI test failed:', error.message); }
      }
    }
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') { console.error('❌ Gemini API key not configured for IncomeCert'); return false; }
    const initialized = initializeGemini(); if (!initialized) { console.error('❌ Failed to initialize Gemini AI for IncomeCert'); return false; }
    try { console.log('🔬 Testing client-side IncomeCert AI connection...'); const testResult = await model.generateContent("Test connection - respond with OK"); const testResponse = await testResult.response; testResponse.text(); console.log('✓ Client-side IncomeCert AI is available'); return { available: true, method: 'client', profileCheckEnabled: true, config: { apiKey: '***configured***', model: 'gemini-2.0-flash-exp' } }; }
    catch (testError) { console.error('❌ Client-side IncomeCert AI test failed:', testError.message); return false; }
  } catch (error) { console.error('❌ IncomeCert AI backend check failed:', error); return false; }
};

// Helper functions - คงเดิม
const filterRedundantRecommendations = (recommendations, extractedData, profileData) => {
  if (!recommendations || recommendations.length === 0) return [];
  const filtered = []; const seen = new Set();
  const checkIncomeMatch = () => {
    if (!extractedData || !profileData) return false;
    let fatherIncomeMatch = true; let motherIncomeMatch = true;
    if (extractedData.fatherData && extractedData.fatherData.annualIncome && profileData.father) { const extractedIncome = parseNumber(extractedData.fatherData.annualIncome); const profileIncome = parseNumber(profileData.father.annualIncome); const tolerance = profileIncome * 0.15; fatherIncomeMatch = Math.abs(extractedIncome - profileIncome) <= tolerance; }
    if (extractedData.motherData && extractedData.motherData.annualIncome && profileData.mother) { const extractedIncome = parseNumber(extractedData.motherData.annualIncome); const profileIncome = parseNumber(profileData.mother.annualIncome); const tolerance = profileIncome * 0.15; motherIncomeMatch = Math.abs(extractedIncome - profileIncome) <= tolerance; }
    return fatherIncomeMatch && motherIncomeMatch;
  };
  const incomeMatches = checkIncomeMatch();
  recommendations.forEach(rec => { 
    const lowerRec = rec.toLowerCase(); 
    if (seen.has(lowerRec)) return; 
    if (lowerRec.includes('ai ไม่สามารถระบุประเภทเอกสารได้') && extractedData && (extractedData.personName || (extractedData.fatherData?.personName) || (extractedData.motherData?.personName))) { console.log('✅ Skipping document type recommendation - AI identified document type successfully'); return; }
    if (incomeMatches && (lowerRec.includes('รายได้') || lowerRec.includes('เงินเดือน') || lowerRec.includes('income') || lowerRec.includes('ตรวจสอบความถูกต้องของรายได้'))) { console.log('✅ Skipping income recommendation - income matches'); return; } 
    if (lowerRec.includes('ตรวจสอบความระบุใน') || lowerRec.includes('ตรวจสอบภายใต้') || lowerRec.includes('ตรวจสอบทั่วไป') || lowerRec.includes('ตรวจสอบเพิ่มเติม') || lowerRec.trim() === '') { return; }
    filtered.push(rec); 
    seen.add(lowerRec); 
  });
  return filtered;
};
const parseNumber = (value) => { if (!value) return 0; const str = value.toString().replace(/[^\d]/g, ''); return parseInt(str, 10) || 0; };


// <<< แก้ไขจุดที่ 2: รวบรวมการ export ทั้งหมดไว้ที่นี่ >>>
export {
  fetchUserProfileData,
  validateIncomeCert,
  parseIncomeCertResult,
  showIncomeCertValidationAlert,
  getIncomeCertTypeName,
  validateMultipleIncomeCerts,
  checkIncomeCertAIStatus,
};