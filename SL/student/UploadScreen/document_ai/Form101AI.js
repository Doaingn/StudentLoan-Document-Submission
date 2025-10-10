// documents_ai/Form101AI.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../../database/firebase"; 

// Configuration
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const AI_BACKEND_URL = process.env.EXPO_PUBLIC_AI_BACKEND_URL || 'http://10.0.94.195:3001';
const USE_BACKEND_SERVER = process.env.EXPO_PUBLIC_USE_AI_BACKEND === 'true';

let genAI = null;
let model = null;

// Initialize Gemini AI
const initializeGemini = () => {
  if (!genAI && GEMINI_API_KEY) {
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
      console.log('✓ Gemini AI initialized successfully for Form101');
      return true;
    } catch (error) {
      console.error('Failed to initialize Gemini AI for Form101:', error);
      return false;
    }
  }
  return !!genAI;
};

// Check backend server
const checkBackendServer = async () => {
  try {
    console.log('🔍 Checking backend server for Form101 at:', AI_BACKEND_URL);
    const response = await fetch(`${AI_BACKEND_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✓ AI Backend Server is available for Form101:', data.status);
      return true;
    }
    return false;
  } catch (error) {
    console.log('✗ AI Backend Server not available for Form101:', error.message);
    return false;
  }
};

// Fetch user profile from Firebase (เหมือน IDCardAI)
export const fetchUserProfileData = async () => {
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
    
    return {
      student: {
        name: userData.name || null,
        studentId: userData.studentId || null,
        citizen_id: userData.citizen_id || null,
        phone: userData.phone || null,
        email: userData.email || null,
        educationLevel: userData.educationLevel || null,
        studyYear: userData.studyYear || null,
      },
      father: {
        name: userData.father_info?.name || null,
        annualIncome: userData.father_info?.income * 12 || null,
      },
      mother: {
        name: userData.mother_info?.name || null,
        annualIncome: userData.mother_info?.income * 12 || null,
      },
      guardian: {
        name: userData.guardian_info?.name || null,
        annualIncome: userData.guardian_info?.income * 12 || null,
      }
    };
  } catch (error) {
    console.error('✗ Error fetching user profile data:', error);
    return null;
  }
};

// Compare Form data with Firebase (เหมือน IDCardAI)
const compareFormWithUserData = (extractedData, profileData) => {
  if (!profileData || !extractedData) {
    return {
      matchStatus: 'no_profile_data',
      matches: {},
      mismatches: [],
      warnings: ['ไม่มีข้อมูลโปรไฟล์สำหรับเปรียบเทียบ']
    };
  }

  const matches = {};
  const mismatches = [];
  const warnings = [];

  // Helper: Normalize text
  const normalizeText = (text) => {
    if (!text) return '';
    return text.toString().trim().toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\u0E00-\u0E7Fa-z0-9\s]/g, '');
  };

  // Field mapping
  const fieldMapping = [
    // Student info
    { formKey: 'studentName', profileKey: 'student.name', label: 'ชื่อ-สกุล นักศึกษา', normalize: true },
    { formKey: 'studentId', profileKey: 'student.studentId', label: 'รหัสนักศึกษา', normalize: false },
    { formKey: 'idCard', profileKey: 'student.citizen_id', label: 'เลขบัตรประชาชน', normalize: false },
    { formKey: 'mobilePhone', profileKey: 'student.phone', label: 'เบอร์มือถือ', normalize: true },
    { formKey: 'email', profileKey: 'student.email', label: 'อีเมล', normalize: true },
    { formKey: 'educationLevel', profileKey: 'student.educationLevel', label: 'ระดับการศึกษา', normalize: true },
    { formKey: 'studyYear', profileKey: 'student.studyYear', label: 'ปีการศึกษา', normalize: false },
    
    // Father info
    { formKey: 'fatherName', profileKey: 'father.name', label: 'ชื่อ-สกุล บิดา', normalize: true },
    { formKey: 'fatherAnnualIncome', profileKey: 'father.annualIncome', label: 'รายได้ต่อปี บิดา', normalize: false },
    
    // Mother info
    { formKey: 'motherName', profileKey: 'mother.name', label: 'ชื่อ-สกุล มารดา', normalize: true },
    { formKey: 'motherAnnualIncome', profileKey: 'mother.annualIncome', label: 'รายได้ต่อปี มารดา', normalize: false },
    
    // Guardian info
    { formKey: 'guardianName', profileKey: 'guardian.name', label: 'ชื่อ-สกุล ผู้ปกครอง', normalize: true },
    { formKey: 'guardianAnnualIncome', profileKey: 'guardian.annualIncome', label: 'รายได้ต่อปี ผู้ปกครอง', normalize: false },
  ];

  // Get nested value from profileData
  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  // Compare each field
  fieldMapping.forEach(({ formKey, profileKey, label, normalize }) => {
    const formValue = extractedData[formKey];
    const firebaseValue = getNestedValue(profileData, profileKey);
    
    // Form ไม่มีข้อมูล
    if (!formValue || formValue === '' || formValue === '-') {
      if (firebaseValue) {
        mismatches.push({
          field: formKey,
          label: label,
          extracted: 'ไม่มีข้อมูล',
          profile: firebaseValue
        });
      }
      return;
    }

    // Firebase ไม่มีข้อมูล
    if (!firebaseValue || firebaseValue === '') {
      warnings.push({
        field: formKey,
        label: label,
        message: `ไม่มีข้อมูล ${label} ใน Firebase เพื่อเปรียบเทียบ`,
        formValue: formValue
      });
      return;
    }

    // เปรียบเทียบ
    let isMatch = false;
    
    if (normalize) {
      const normalizedForm = normalizeText(formValue);
      const normalizedProfile = normalizeText(firebaseValue);
      
      if (normalizedForm === normalizedProfile) {
        isMatch = true;
      } else if (normalizedForm.includes(normalizedProfile) || normalizedProfile.includes(normalizedForm)) {
        isMatch = true;
        warnings.push(`${label} ใกล้เคียงกัน แต่ไม่ตรงทุกตัวอักษร`);
      }
    } else {
      // สำหรับตัวเลข
      const cleanForm = formValue.toString().replace(/\D/g, '');
      const cleanProfile = firebaseValue.toString().replace(/\D/g, '');
      isMatch = cleanForm === cleanProfile;
    }

    if (isMatch) {
      matches[formKey] = true;
    } else {
      matches[formKey] = false;
      mismatches.push({
        field: formKey,
        label: label,
        extracted: formValue,
        profile: firebaseValue
      });
    }
  });

  // Calculate match status
  const totalFields = fieldMapping.length;
  const matchedCount = Object.values(matches).filter(v => v === true).length;
  const mismatchedCount = mismatches.length;
  
  let matchStatus = 'unknown';
  let matchPercentage = 0;

  if (totalFields > 0) {
    matchPercentage = Math.round((matchedCount / totalFields) * 100);
  }

  if (mismatchedCount === 0 && warnings.length <= 2) {
    matchStatus = 'full_match';
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
    matches,
    mismatches,
    warnings,
    comparisonDetails: {
      fieldsCompared: totalFields,
      fieldsMatched: matchedCount,
      fieldsMismatched: mismatchedCount
    },
    matchPercentage
  };
};

// Server-side validation
const validateForm101ViaServer = async (fileUri, mimeType, profileData) => {
  try {
    console.log('📤 Uploading to server for Form 101 validation...');
    
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) throw new Error('File does not exist');

    const formData = new FormData();
    const file = {
      uri: fileUri,
      type: mimeType || 'image/jpeg',
      name: `form101_${Date.now()}.${mimeType ? mimeType.split('/')[1] : 'jpg'}`,
    };
    
    formData.append('document', file);
    if (profileData) {
      formData.append('profileData', JSON.stringify(profileData));
    }

    const response = await fetch(`${AI_BACKEND_URL}/ai/validate/form101`, {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Server Form101 validation completed');
    return result.validation;

  } catch (error) {
    console.error('✗ Server Form101 validation error:', error);
    throw error;
  }
};

// Prepare file for Gemini
const prepareFileForGemini = async (fileUri, mimeType) => {
  try {
    console.log('📄 Preparing Form101 file for Gemini AI...');
    
    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    let actualMimeType = mimeType || 'image/jpeg';
    if (!mimeType) {
      const ext = fileUri.split('.').pop()?.toLowerCase();
      if (ext === 'png') actualMimeType = 'image/png';
      else if (ext === 'pdf') actualMimeType = 'application/pdf';
    }

    console.log('✅ Form101 file prepared for Gemini');
    return {
      inlineData: {
        data: base64Data,
        mimeType: actualMimeType,
      },
    };
  } catch (error) {
    console.error('✗ Error preparing Form101 file:', error);
    throw new Error(`ไม่สามารถเตรียมไฟล์สำหรับการวิเคราะห์ได้: ${error.message}`);
  }
};

const analyzeForm101TextResponse = (text) => {
  const lowerText = text.toLowerCase();
  
  const isForm101 = lowerText.includes('กยศ.101') || 
                   lowerText.includes('กู้ยืมเพื่อการศึกษา') ||
                   lowerText.includes('แบบคำขอ');
  
  // ต้องมีคำว่า "ลงชื่อ" พร้อมข้อความหรือลายเซ็นด้วย ไม่ใช่แค่บรรทัดว่าง
  const hasSignature = (lowerText.includes('ลายเซ็น') || 
                       lowerText.includes('ลงชื่อ')) &&
                       (lowerText.includes('เขียน') || 
                        lowerText.includes('พบ') ||
                        lowerText.includes('มี'));

  return {
    isForm101,
    confidence: isForm101 ? 75 : 25,
    foundElements: isForm101 ? ['แบบคำขอกู้ยืม กยศ.101'] : [],
    missingElements: !isForm101 ? ['แบบฟอร์ม กยศ.101'] : ['ลายเซ็นผู้ขอกู้ยืม'],
    hasSignature: false,  // เปลี่ยนเป็น false เป็นค่าเริ่มต้น
    signatureQuality: 'none',
    extractedData: {},
    recommendations: ['กรุณาตรวจสอบว่าเป็นแบบคำขอกู้ยืม กยศ.101', 'กรุณาลงลายเซ็นผู้ขอกู้ยืม'],
    overall_status: 'needs_review',
    rawResponse: text
  };
};

// เพิ่มฟังก์ชันนี้ก่อน validateForm101ClientSide
const validateSignatureResult = (parsed) => {
  // ถ้า AI บอกว่ามีลายเซ็น แต่ไม่มี signedDate หรือข้อมูลวันที่
  // แสดงว่าอาจตรวจผิด
  if (parsed.hasSignature && !parsed.extractedData?.signedDate) {
    console.warn('⚠️ Signature detection may be incorrect - no signed date found');
    parsed.hasSignature = false;
    parsed.signatureQuality = 'none';
    if (!parsed.recommendations) parsed.recommendations = [];
    parsed.recommendations.push('กรุณาลงลายเซ็นผู้ขอกู้ยืมและระบุวันที่');
  }

  // ถ้ามี signatureAnalysis และบอกว่าไม่มีลายเซ็นจริง
  if (parsed.signatureAnalysis?.hasActualSignature === false) {
    parsed.hasSignature = false;
    parsed.signatureQuality = 'none';
  }

  // ถ้า overall_status เป็น valid แต่ไม่มีลายเซ็น ให้เปลี่ยนเป็น needs_review
  if (parsed.overall_status === 'valid' && !parsed.hasSignature) {
    parsed.overall_status = 'needs_review';
    if (!parsed.missingElements) parsed.missingElements = [];
    parsed.missingElements.push('ลายเซ็นผู้ขอกู้ยืม');
  }

  return parsed;
};

// Client-side validation
const validateForm101ClientSide = async (fileUri, mimeType, profileData) => {
  console.log('🤖 Starting client-side Form 101 validation...');
  
  if (!model) {
    const initialized = initializeGemini();
    if (!initialized) throw new Error('ระบบ AI ไม่พร้อมใช้งาน');
  }

  const filePart = await prepareFileForGemini(fileUri, mimeType);

  let profileInfo = '';
  if (profileData && profileData.student) {
    const s = profileData.student;
    const f = profileData.father;
    const m = profileData.mother;
    const g = profileData.guardian;
    
    profileInfo = `

**ข้อมูลโปรไฟล์สำหรับเปรียบเทียบ:**
นักศึกษา:
- ชื่อ-สกุล: ${s.name || 'ไม่ระบุ'}
- รหัสนักศึกษา: ${s.studentId || 'ไม่ระบุ'}
- เลขบัตรประชาชน: ${s.citizen_id || 'ไม่ระบุ'}
- เบอร์มือถือ: ${s.phone || 'ไม่ระบุ'}
- อีเมล: ${s.email || 'ไม่ระบุ'}

บิดา:
- ชื่อ-สกุล: ${f?.name || 'ไม่ระบุ'}
- รายได้ต่อปี: ${f?.annualIncome || 'ไม่ระบุ'}

มารดา:
- ชื่อ-สกุล: ${m?.name || 'ไม่ระบุ'}
- รายได้ต่อปี: ${m?.annualIncome || 'ไม่ระบุ'}

ผู้ปกครอง:
- ชื่อ-สกุล: ${g?.name || 'ไม่ระบุ'}
- รายได้ต่อปี: ${g?.annualIncome || 'ไม่ระบุ'}

กรุณาเปรียบเทียบข้อมูลที่สกัดได้กับข้อมูลโปรไฟล์ด้วย`;
  }

  const prompt = `
ตรวจสอบเอกสารนี้ว่าเป็นแบบคำขอกู้ยืมเงินกองทุนเงินให้กู้ยืมเพื่อการศึกษา (กยศ.101) หรือไม่

**วิธีตรวจสอบลายเซ็นอย่างละเอียด:**

1. ดูที่ตำแหน่ง "ลงชื่อผู้ขอกู้ยืม" ในหน้า 4 (หน้าสุดท้าย)
2. ตรวจสอบว่ามีสิ่งใดต่อไปนี้หรือไม่:
   - ลายมือเขียนใดๆ ที่อยู่เหนือหรือใกล้บรรทัดประ
   - ตัวอักษรที่ดูเหมือนชื่อหรือลายเซ็น (แม้จะเขียนบางๆ)
   - หมึกสีน้ำเงิน สีดำ หรือสีใดๆ ที่ปรากฏในบริเวณช่องลงชื่อ
   - ลายมือเขียนภาษาไทยหรือภาษาอื่นๆ ในช่องลายเซ็น
   - เครื่องหมายหรือสัญลักษณ์ใดๆ ที่บ่งบอกว่ามีการลงนาม

3. **สิ่งที่ไม่ถือว่าเป็นลายเซ็น:**
   - บรรทัดเส้นประเปล่าๆ ที่ไม่มีอะไรเขียน
   - คำว่า "ลงชื่อผู้ขอกู้ยืม" หรือ (ข้อความที่พิมพ์ไว้ในฟอร์ม)
   - พื้นที่ว่างเปล่า

4. **การตัดสินใจ:**
   - ถ้าเห็นลายมือเขียนใดๆ ในช่องลงชื่อ → hasSignature: true
   - ถ้าช่องลงชื่อว่างเปล่า มีแค่บรรทัดเส้นประ → hasSignature: false
   - ถ้าไม่แน่ใจ ให้วิเคราะห์ละเอียดและอธิบายในส่วน signatureAnalysis

${profileInfo}

กรุณาตรวจสอบและตอบในรูปแบบ JSON ดังนี้:
{
  "isForm101": true/false,
  "confidence": 0-100,
  "foundElements": ["รายการที่พบในเอกสาร"],
  "missingElements": ["รายการที่ขาดหายไป"],
  "hasSignature": true/false,  // ต้องมีลายเซ็นจริงๆ ไม่ใช่แค่ช่องว่าง
  "signatureQuality": "genuine/suspicious/unclear/none",
  "extractedData": {
    "studentName": "ชื่อ-สกุล ผู้กู้ยืม (ข้อ 1)",
    "studentId": "รหัสประจำตัวนักศึกษา (ข้อ 11)",
    "idCard": "เลขประจำตัวประชาชน (ข้อ 2)",
    "mobilePhone": "เบอร์มือถือ (ข้อ 4)",
    "email": "E-mail (ข้อ 4)",
    "educationLevel": "ระดับการศึกษา (ข้อ 5)",
    "studyYear": "ปีการศึกษา (ข้อ 5)",
    "fatherName": "ชื่อ-สกุล บิดา (ข้อ 17)",
    "fatherAnnualIncome": "รายได้ต่อปี บิดา (ข้อ 17)",
    "motherName": "ชื่อ-สกุล มารดา (ข้อ 18)",
    "motherAnnualIncome": "รายได้ต่อปี มารดา (ข้อ 18)",
    "guardianName": "ชื่อ-สกุล ผู้ปกครอง (ข้อ 20)",
    "guardianAnnualIncome": "รายได้ต่อปี ผู้ปกครอง (ข้อ 20)",
    "signedDate": "วันที่/เดือน/พ.ศ. ที่ลงชื่อ",
    "hasActualSignature": true/false  // มีลายเซ็นจริงหรือไม่
  },
  "signatureAnalysis": {
    "foundSignatureArea": true/false,  // พบพื้นที่สำหรับเซ็นชื่อ
    "hasActualSignature": true/false,  // มีลายเซ็นจริงในพื้นที่นั้น
    "signatureLocation": "หน้า 4 ด้านล่าง",
    "details": "อธิบายว่าพบอะไรในช่องลายเซ็น"
  },
  "recommendations": ["คำแนะนำสำหรับการแก้ไข"],
  "overall_status": "valid/invalid/needs_review"
}

ให้ความสำคัญกับ:
1. หัวเอกสาร "กยศ.101" และ "แบบคำขอกู้ยืมเงิน"
2. ความสมบูรณ์ของข้อมูลผู้กู้ยืมและบิดา/มารดา/ผู้ปกครอง
3. **ลายเซ็นจริง** ในช่อง 'ลงชื่อผู้ขอกู้ยืม' ซึ่งจะอยู่ด้านล่างของหน้า 4
4. ถ้าช่องลายเซ็นว่างเปล่า ให้ตอบชัดเจนว่า "ยังไม่ได้ลงลายเซ็น" และแนะนำให้ลงลายเซ็นก่อนส่ง
5. ดึงข้อมูลตาม Key ที่กำหนดอย่างถูกต้อง
6. ตรวจสอบว่าข้อมูลที่สกัดได้ตรงกับข้อมูลโปรไฟล์หรือไม่

**กรณีพิเศษ:**
- ถ้าเห็นชื่ออื่นๆ ในวงเล็บ นั่นคือชื่อที่พิมพ์ไว้ในฟอร์ม ไม่ใช่ลายเซ็น
- ลายเซ็นจริงจะอยู่เหนือบรรทัดเส้นประ หรือในพื้นที่ว่างเหนือชื่อในวงเล็บ
- แม้ลายเซ็นจะเขียนบางหรือเบาก็ตาม ถ้ามองเห็นได้ว่ามีการเขียนอะไรก็ถือว่ามีลายเซ็น
`;

  try {
  const result = await model.generateContent([prompt, filePart]);
  const response = await result.response;
  const responseText = response.text();

  console.log('🤖 Form101 AI Response received');

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
    parsed = analyzeForm101TextResponse(responseText);
  }

  // *** เพิ่มการตรวจสอบลายเซ็นเพิ่มเติม ***
  parsed = validateSignatureResult(parsed);

  // Add profile comparison
  if (profileData) {
    const comparison = compareFormWithUserData(parsed.extractedData, profileData);
    parsed.profileComparison = comparison;

      // Add mismatches to quality issues
      if (comparison.mismatches.length > 0) {
        parsed.qualityIssues = parsed.qualityIssues || [];
        comparison.mismatches.forEach(mismatch => {
          parsed.qualityIssues.push(
            `${mismatch.label}ไม่ตรงกับโปรไฟล์: เอกสาร="${mismatch.extracted}" โปรไฟล์="${mismatch.profile}"`
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

    if (!parsed.hasSignature) {
    if (!parsed.qualityIssues) parsed.qualityIssues = [];
    parsed.qualityIssues.push('ยังไม่มีลายเซ็นผู้ขอกู้ยืม');
    
    if (!parsed.recommendations) parsed.recommendations = [];
    parsed.recommendations.push('กรุณาลงลายเซ็นผู้ขอกู้ยืมในช่องที่กำหนด (หน้า 4 ด้านล่าง) และระบุวันที่');
  }

  console.log('✅ Client-side Form101 validation completed');
  return parsed;
  } catch (error) {
    console.error('✗ Client-side validation failed:', error);
    throw error;
  }
};

// Main validation function
export const validateForm101Document = async (fileUri, mimeType = null, includeProfileCheck = true) => {
  try {
    console.log('🚀 Starting Form 101 validation...');

    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) throw new Error('ไฟล์ไม่พบ');

    // Fetch profile data
    let profileData = null;
    if (includeProfileCheck) {
      profileData = await fetchUserProfileData();
      if (profileData) {
        console.log('✅ Profile data loaded for comparison');
      }
    }

    // Try server-side first
    if (USE_BACKEND_SERVER) {
      try {
        const serverAvailable = await checkBackendServer();
        if (serverAvailable) {
          console.log('✅ Using server-side validation');
          return await validateForm101ViaServer(fileUri, mimeType, profileData);
        }
      } catch (serverError) {
        console.log('⚠️ Server validation failed, using client-side');
      }
    }

    // Fall back to client-side
    console.log('✅ Using client-side validation');
    return await validateForm101ClientSide(fileUri, mimeType, profileData);

  } catch (error) {
    console.error('✗ Form 101 validation error:', error);
    throw new Error(`การตรวจสอบล้มเหลว: ${error.message}`);
  }
};

// Enhanced alert with profile comparison
export const showForm101ValidationAlert = (result, onAccept, onReject) => {
  let title, message;

  const profileMismatch = result.profileComparison?.matchStatus === 'mismatch';
  
  if (profileMismatch) {
    title = '⚠️ ข้อมูลไม่ตรงกับโปรไฟล์';
  } else if (result.overall_status === 'valid') {
    title = '✅ ตรวจสอบแบบฟอร์ม กยศ.101 สำเร็จ';
  } else {
    title = '⚠️ ตรวจพบปัญหา';
  }
  
  let statusText = '';
  
  // Basic checks
  statusText += result.isForm101 ? '✅ ตรวจพบแบบฟอร์ม กยศ.101\n' : '✗ ไม่พบแบบฟอร์ม กยศ.101\n';
  
  if (result.hasSignature) {
  const qualityEmoji = result.signatureQuality === 'genuine' ? '✅' : 
                        result.signatureQuality === 'suspicious' ? '⚠️' : 
                        result.signatureQuality === 'unclear' ? 'ℹ️' : '❌';
    statusText += `${qualityEmoji} ลายเซ็น: ${result.signatureQuality}\n`;
  } else {
    statusText += '❌ ยังไม่มีลายเซ็นผู้ขอกู้ยืม\n';
    statusText += '   ⚠️ กรุณาลงลายเซ็นในช่องที่กำหนด (หน้า 4)\n';
  }

  // // Profile comparison
  // if (result.profileComparison) {
  //   const comp = result.profileComparison;
  //   statusText += '\n👤 เปรียบเทียบกับโปรไฟล์:\n';
    
  //   if (comp.matchStatus === 'full_match') {
  //     statusText += '✅ ข้อมูลตรงกับโปรไฟล์ทุกประการ\n';
  //   } else if (comp.matchStatus === 'partial_match') {
  //     statusText += '⚠️ ข้อมูลตรงบางส่วน\n';
  //   } else if (comp.matchStatus === 'mismatch') {
  //     statusText += '✗ พบข้อมูลไม่ตรงกัน:\n';
  //     comp.mismatches.slice(0, 3).forEach(m => {
  //       statusText += `  • ${m.label}\n`;
  //       statusText += `    เอกสาร: ${m.extracted}\n`;
  //       statusText += `    โปรไฟล์: ${m.profile}\n`;
  //     });
  //     if (comp.mismatches.length > 3) {
  //       statusText += `  • และอีก ${comp.mismatches.length - 3} รายการ\n`;
  //     }
  //   }
    
  //   if (comp.comparisonDetails) {
  //     const pct = comp.matchPercentage || 0;
  //     statusText += `\nเปรียบเทียบ: ${comp.comparisonDetails.fieldsMatched}/${comp.comparisonDetails.fieldsCompared} รายการ (${pct}%)\n`;
  //   }
  // }

  // statusText += `\n🎯 ความเชื่อมั่น: ${result.confidence}%`;

  if (result.qualityIssues?.length > 0) {
    statusText += '\n\n⚠️ ปัญหา:\n• ' + result.qualityIssues.slice(0, 3).join('\n• ');
    if (result.qualityIssues.length > 3) {
      statusText += `\n• และอีก ${result.qualityIssues.length - 3} รายการ`;
    }
  }

  if (result.recommendations?.length > 0) {
    statusText += '\n\n💡 คำแนะนำ:\n• ' + result.recommendations.slice(0, 2).join('\n• ');
  }

  message = statusText;
  
  const isValid = result.overall_status === 'valid' && 
                 result.isForm101 && 
                 !profileMismatch;

  const buttons = [
    {
      text: 'ลองใหม่',
      style: 'cancel',
      onPress: onReject,
    },
  ];

  if (profileMismatch) {
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

// Parse result
export const parseForm101Result = (result) => {
  if (!result) return null;

  return {
    isValid: result.overall_status === 'valid' && 
             result.isForm101 &&
             (result.profileComparison?.matchStatus !== 'mismatch'),
    confidence: result.confidence || 0,
    status: result.overall_status || 'unknown',
    hasSignature: result.hasSignature || false,
    signatureQuality: result.signatureQuality || 'none',
    extractedData: result.extractedData || {},
    foundElements: result.foundElements || [],
    missingElements: result.missingElements || [],
    recommendations: result.recommendations || [],
    profileComparison: result.profileComparison || null,
    qualityIssues: result.qualityIssues || [],
    rawResult: result
  };
};

// Format data for database
export const formatForm101DataForDB = (result, documentType, fileName) => {
  return {
    documentType: documentType,
    fileName: fileName,
    
    basicInfo: {
      isValid: result.isValid || false,
      confidence: result.confidence || 0,
      overall_status: result.overall_status || 'unknown',
      isForm101: result.isForm101 || false,
      hasSignature: result.hasSignature || false,
      signatureQuality: result.signatureQuality || 'none'
    },
    
    extractedData: {
      studentName: result.extractedData?.studentName || null,
      studentId: result.extractedData?.studentId || null,
      idCard: result.extractedData?.idCard || null,
      mobilePhone: result.extractedData?.mobilePhone || null,
      email: result.extractedData?.email || null,
      educationLevel: result.extractedData?.educationLevel || null,
      studyYear: result.extractedData?.studyYear || null,
      fatherName: result.extractedData?.fatherName || null,
      fatherAnnualIncome: result.extractedData?.fatherAnnualIncome || null,
      motherName: result.extractedData?.motherName || null,
      motherAnnualIncome: result.extractedData?.motherAnnualIncome || null,
      guardianName: result.extractedData?.guardianName || null,
      guardianAnnualIncome: result.extractedData?.guardianAnnualIncome || null,
      signedDate: result.extractedData?.signedDate || null
    },

    profileComparison: result.profileComparison ? {
      matchStatus: result.profileComparison.matchStatus,
      matchPercentage: result.profileComparison.matchPercentage || 0,
      matches: result.profileComparison.matches,
      mismatches: result.profileComparison.mismatches,
      warnings: result.profileComparison.warnings,
      comparisonDetails: result.profileComparison.comparisonDetails
    } : null,
    
    foundElements: result.foundElements || [],
    missingElements: result.missingElements || [],
    
    issues: {
      qualityIssues: result.qualityIssues || [],
      recommendations: result.recommendations || []
    },
    
    metadata: {
      validatedAt: new Date().toISOString(),
      aiModel: 'gemini-2.0-flash',
      profileCheckEnabled: !!result.profileComparison
    }
  };
};

// Check Form101 requirements
export const checkForm101Requirements = (result) => {
  if (!result) return { passed: false, issues: ['ไม่มีข้อมูลผลการตรวจสอบ'] };

  const issues = [];
  
  if (!result.isForm101) issues.push('ไม่ใช่แบบฟอร์ม กยศ.101');
  if (!result.hasSignature) issues.push('ไม่พบลายเซ็น');
  if (result.signatureQuality === 'none' || result.signatureQuality === 'suspicious') {
    issues.push('ลายเซ็นไม่ชัดเจนหรือน่าสงสัย');
  }
  
  // Check profile comparison
  if (result.profileComparison?.matchStatus === 'mismatch') {
    issues.push('ข้อมูลไม่ตรงกับโปรไฟล์');
  }

  // Check missing critical data
  const criticalFields = ['studentName', 'studentId', 'idCard'];
  const missingCritical = criticalFields.filter(field => 
    !result.extractedData?.[field] || result.extractedData[field] === ''
  );
  
  if (missingCritical.length > 0) {
    issues.push(`ขาดข้อมูลสำคัญ: ${missingCritical.join(', ')}`);
  }

  return {
    passed: issues.length === 0,
    issues: issues,
    requirements: {
      isForm101: result.isForm101,
      hasSignature: result.hasSignature,
      hasValidSignature: result.signatureQuality === 'genuine' || result.signatureQuality === 'unclear',
      profileMatches: result.profileComparison?.matchStatus !== 'mismatch',
      hasRequiredData: missingCritical.length === 0,
      confidence: result.confidence >= 70
    }
  };
};

// Generate summary
export const generateForm101Summary = (result) => {
  if (!result) return 'ไม่มีข้อมูลผลการตรวจสอบ';

  const requirements = checkForm101Requirements(result);
  
  let summary = `📋 สรุปผลการตรวจสอบแบบฟอร์ม กยศ.101\n\n`;
  summary += `สถานะ: ${result.overall_status === 'valid' ? '✅ ผ่าน' : result.overall_status === 'needs_review' ? '⚠️ ต้องตรวจสอบ' : '✗ ไม่ผ่าน'}\n`;
  summary += `ความเชื่อมั่น: ${result.confidence}%\n\n`;

  summary += `✅ ข้อกำหนด:\n`;
  summary += `${requirements.requirements.isForm101 ? '✅' : '✗'} เป็นแบบฟอร์ม กยศ.101\n`;
  summary += `${requirements.requirements.hasSignature ? '✅' : '✗'} มีลายเซ็น\n`;
  summary += `${requirements.requirements.hasValidSignature ? '✅' : '✗'} ลายเซ็นถูกต้อง\n`;
  summary += `${requirements.requirements.profileMatches ? '✅' : '✗'} ข้อมูลตรงกับโปรไฟล์\n`;
  summary += `${requirements.requirements.hasRequiredData ? '✅' : '✗'} มีข้อมูลครบถ้วน\n`;
  summary += `${requirements.requirements.confidence ? '✅' : '✗'} ความเชื่อมั่นสูง (≥70%)\n`;

  if (result.extractedData && Object.keys(result.extractedData).length > 0) {
    summary += `\n📋 ข้อมูลที่สกัดได้:\n`;
    if (result.extractedData.studentName) summary += `• ชื่อ-สกุล: ${result.extractedData.studentName}\n`;
    if (result.extractedData.studentId) summary += `• รหัสนักศึกษา: ${result.extractedData.studentId}\n`;
    if (result.extractedData.idCard) summary += `• เลขบัตรประชาชน: ${result.extractedData.idCard}\n`;
    if (result.extractedData.mobilePhone) summary += `• เบอร์มือถือ: ${result.extractedData.mobilePhone}\n`;
    if (result.extractedData.email) summary += `• อีเมล: ${result.extractedData.email}\n`;
  }

  if (result.profileComparison) {
    summary += `\n👤 เปรียบเทียบกับโปรไฟล์:\n`;
    const comp = result.profileComparison;
    if (comp.matchStatus === 'full_match') {
      summary += `✅ ข้อมูลตรงกับโปรไฟล์ทุกประการ\n`;
    } else if (comp.matchStatus === 'mismatch') {
      summary += `✗ พบข้อมูลไม่ตรงกัน:\n`;
      comp.mismatches.forEach(m => {
        summary += `  • ${m.label}: เอกสาร="${m.extracted}" โปรไฟล์="${m.profile}"\n`;
      });
    }
    if (comp.comparisonDetails) {
      summary += `\nเปรียบเทียบ: ${comp.comparisonDetails.fieldsMatched}/${comp.comparisonDetails.fieldsCompared} รายการ\n`;
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

// Check AI backend status
export const checkForm101AIStatus = async () => {
  try {
    if (USE_BACKEND_SERVER) {
      const serverAvailable = await checkBackendServer();
      if (serverAvailable) {
        try {
          const response = await fetch(`${AI_BACKEND_URL}/ai/test`);
          if (response.ok) {
            const data = await response.json();
            return { 
              available: true, 
              method: 'server',
              profileCheckEnabled: true,
              config: {
                backendUrl: AI_BACKEND_URL,
                useBackend: USE_BACKEND_SERVER
              }
            };
          }
        } catch (error) {
          console.log('✗ Server test failed:', error.message);
        }
      }
    }

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

// Validate multiple Form101 documents
export const validateMultipleForm101Documents = async (files, includeProfileCheck = true) => {
  const results = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await validateForm101Document(
        file.uri, 
        file.mimeType,
        includeProfileCheck
      );
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        validation: result,
        success: true,
        profileMatch: result.profileComparison?.matchStatus !== 'mismatch'
      });
    } catch (error) {
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        error: error.message,
        success: false,
        profileMatch: false
      });
    }
  }
  
  return results;
};