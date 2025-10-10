// documents_ai/LegalStatusAI.js - AI validation for Legal Status documents (Divorce Certificate/Death Certificate)
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../../database/firebase";

// Configuration - Client-side only
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

let genAI = null;
let model = null;

console.log('🔧 LegalStatusAI Configuration:');
console.log('- Client-side only (no backend server)');
console.log('- API Key configured:', !!GEMINI_API_KEY);

// Initialize Gemini AI for client-side processing
const initializeGemini = () => {
  if (!genAI && GEMINI_API_KEY && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      console.log('✓ Gemini AI initialized successfully for LegalStatus');
      return true;
    } catch (error) {
      console.error('Failed to initialize Gemini AI for LegalStatus:', error);
      return false;
    }
  }
  return !!genAI;
};

// *** เพิ่มใหม่: ฟังก์ชันสำหรับดึงข้อมูลโปรไฟล์ของผู้ใช้ ***
const fetchUserProfileData = async () => {
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
        citizen_id: userData.citizen_id || null,
        birth_date: userData.birth_date || null,
      },
      father: {
        name: userData.father_info?.name || null,
        citizen_id: userData.father_info?.citizen_id || null,
        birth_date: userData.father_info?.birth_date || null,
      },
      mother: {
        name: userData.mother_info?.name || null,
        citizen_id: userData.mother_info?.citizen_id || null,
        birth_date: userData.mother_info?.birth_date || null,
      },
      guardian: {
        name: userData.guardian_info?.name || null,
        citizen_id: userData.guardian_info?.citizen_id || null,
        birth_date: userData.guardian_info?.birth_date || null,
      }
    };
  } catch (error) {
    console.error('❌ Error fetching user profile data:', error);
    return null;
  }
};

// *** เพิ่มใหม่: ฟังก์ชันสำหรับเปรียบเทียบข้อมูลกับโปรไฟล์ ***
const compareWithProfile = (extractedData, profileData) => {
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

  // Helper function to normalize text for comparison
  const normalizeText = (text) => {
    if (!text) return '';
    return text.toString().trim().toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\u0E00-\u0E7Fa-z0-9\s]/g, '');
  };

  // Helper function to remove titles from names
  const removeTitle = (name) => {
    let n = name;
    // แปลงคำนำหน้าที่เป็นไปได้ทั้งหมดให้เป็นรูปแบบมาตรฐานเดียวกัน
    n = n.replace(/^น\.ส\.?\s?/, 'นางสาว ');
    n = n.replace(/^นางสาว\s?/, 'นางสาว ');
    n = n.replace(/^นาง\s?/, 'นาง ');
    n = n.replace(/^นาย\s?/, 'นาย ');
    n = n.replace(/^ด\.ช\.?\s?/, 'เด็กชาย ');
    n = n.replace(/^ด\.ญ\.?\s?/, 'เด็กหญิง ');
    return n.trim();
  };

  // *** ตรวจสอบชื่อและเลขบัตรประชาชนของบิดา ***
  if (extractedData.personName && profileData.father?.name) {
    const extractedName = normalizeText(removeTitle(extractedData.personName));
    const profileName = normalizeText(removeTitle(profileData.father.name));

    if (extractedName === profileName) {
      matches.fatherName = true;
    } else if (extractedName.includes(profileName) || profileName.includes(extractedName)) {
      matches.fatherName = true;
      warnings.push('ชื่อบิดาในเอกสารและโปรไฟล์ใกล้เคียงกัน แต่ไม่ตรงทุกตัวอักษร');
    } else {
      matches.fatherName = false;
      mismatches.push({
        field: 'ชื่อบิดา',
        extracted: extractedData.personName,
        profile: profileData.father.name
      });
    }
  }

  if (extractedData.personIDNumber && profileData.father?.citizen_id) {
    const extractedId = extractedData.personIDNumber.replace(/\D/g, '');
    const profileId = profileData.father.citizen_id.replace(/\D/g, '');
    
    if (extractedId === profileId) {
      matches.fatherId = true;
    } else {
      matches.fatherId = false;
      mismatches.push({
        field: 'เลขบัตรประชาชนบิดา',
        extracted: extractedData.personIDNumber,
        profile: profileData.father.citizen_id
      });
    }
  }

  // *** ตรวจสอบชื่อและเลขบัตรประชาชนของมารดา (ถ้ามีในเอกสาร) ***
  if (extractedData.spouseName && profileData.mother?.name) {
    const extractedName = normalizeText(removeTitle(extractedData.spouseName));
    const profileName = normalizeText(removeTitle(profileData.mother.name));

    if (extractedName === profileName) {
      matches.motherName = true;
    } else if (extractedName.includes(profileName) || profileName.includes(extractedName)) {
      matches.motherName = true;
      warnings.push('ชื่อมารดาในเอกสารและโปรไฟล์ใกล้เคียงกัน แต่ไม่ตรงทุกตัวอักษร');
    } else {
      matches.motherName = false;
      mismatches.push({
        field: 'ชื่อมารดา',
        extracted: extractedData.spouseName,
        profile: profileData.mother.name
      });
    }
  }

  if (extractedData.spouseIDNumber && profileData.mother?.citizen_id) {
    const extractedId = extractedData.spouseIDNumber.replace(/\D/g, '');
    const profileId = profileData.mother.citizen_id.replace(/\D/g, '');
    
    if (extractedId === profileId) {
      matches.motherId = true;
    } else {
      matches.motherId = false;
      mismatches.push({
        field: 'เลขบัตรประชาชนมารดา',
        extracted: extractedData.spouseIDNumber,
        profile: profileData.mother.citizen_id
      });
    }
  }

  // *** ตรวจสอบชื่อและเลขบัตรประชาชนของผู้เสียชีวิต (กรณีใบมรณบัตร) ***
  if (extractedData.personName && profileData.father?.name) {
    const extractedName = normalizeText(removeTitle(extractedData.personName));
    const profileName = normalizeText(removeTitle(profileData.father.name));

    if (extractedName === profileName) {
      matches.deceasedFatherName = true;
    } else if (extractedName.includes(profileName) || profileName.includes(extractedName)) {
      matches.deceasedFatherName = true;
      warnings.push('ชื่อบิดาในเอกสารและโปรไฟล์ใกล้เคียงกัน แต่ไม่ตรงทุกตัวอักษร');
    }
  }

  if (extractedData.personIDNumber && profileData.father?.citizen_id) {
    const extractedId = extractedData.personIDNumber.replace(/\D/g, '');
    const profileId = profileData.father.citizen_id.replace(/\D/g, '');
    
    if (extractedId === profileId) {
      matches.deceasedFatherId = true;
    }
  }

  // *** ตรวจสอบชื่อและเลขบัตรประชาชนของผู้เสียชีวิต (กรณีมารดา) ***
  if (extractedData.personName && profileData.mother?.name) {
    const extractedName = normalizeText(removeTitle(extractedData.personName));
    const profileName = normalizeText(removeTitle(profileData.mother.name));

    if (extractedName === profileName) {
      matches.deceasedMotherName = true;
    } else if (extractedName.includes(profileName) || profileName.includes(extractedName)) {
      matches.deceasedMotherName = true;
      warnings.push('ชื่อมารดาในเอกสารและโปรไฟล์ใกล้เคียงกัน แต่ไม่ตรงทุกตัวอักษร');
    }
  }

  if (extractedData.personIDNumber && profileData.mother?.citizen_id) {
    const extractedId = extractedData.personIDNumber.replace(/\D/g, '');
    const profileId = profileData.mother.citizen_id.replace(/\D/g, '');
    
    if (extractedId === profileId) {
      matches.deceasedMotherId = true;
    }
  }

  // Determine overall match status
  let matchStatus = 'full_match';
  if (mismatches.length > 0) {
    matchStatus = 'mismatch';
  } else if (warnings.length > 0) {
    matchStatus = 'partial_match';
  } else if (Object.keys(matches).length === 0) {
    matchStatus = 'insufficient_data';
    warnings.push('ข้อมูลในเอกสารไม่เพียงพอสำหรับการเปรียบเทียบ');
  }

  return {
    matchStatus,
    matches,
    mismatches,
    warnings,
    comparisonDetails: {
      fieldsCompared: Object.keys(matches).length,
      fieldsMatched: Object.values(matches).filter(v => v === true).length,
      fieldsMismatched: mismatches.length
    }
  };
};

// Convert file to format suitable for Gemini
const prepareFileForGemini = async (fileUri, mimeType) => {
  try {
    console.log('📁 Preparing LegalStatus file for Gemini AI...');
    
    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    let actualMimeType = mimeType;
    if (!actualMimeType) {
      const fileExtension = fileUri.split('.').pop()?.toLowerCase();
      switch (fileExtension) {
        case 'jpg':
        case 'jpeg':
          actualMimeType = 'image/jpeg';
          break;
        case 'png':
          actualMimeType = 'image/png';
          break;
        case 'pdf':
          actualMimeType = 'application/pdf';
          break;
        default:
          actualMimeType = 'image/jpeg';
      }
    }

    console.log('✅ LegalStatus file prepared for Gemini');
    return {
      inlineData: {
        data: base64Data,
        mimeType: actualMimeType,
      },
    };
  } catch (error) {
    console.error('❌ Error preparing LegalStatus file for Gemini:', error);
    throw new Error(`ไม่สามารถเตรียมไฟล์สำหรับการวิเคราะห์ได้: ${error.message}`);
  }
};

// Client-side Legal Status validation
const validateLegalStatusClientSide = async (fileUri, statusType, mimeType, profileData) => {
  console.log(`🤖 Starting client-side ${statusType} legal status validation...`);
  
  if (!model) {
    const initialized = initializeGemini();
    if (!initialized) {
      throw new Error('ระบบ AI ไม่พร้อมใช้งาน - กรุณาตรวจสอบ API Key');
    }
  }

  const filePart = await prepareFileForGemini(fileUri, mimeType);

  const statusTypeText = {
    'divorce': 'ใบหย่า',
    'death': 'ใบมรณบัตร',
    'legal_status': 'เอกสารสถานะทางกฎหมาย'
  };

  let profileInfo = '';
  if (profileData) {
    profileInfo = `

**ข้อมูลโปรไฟล์สำหรับเปรียบเทียบ:**
- ชื่อบิดา: ${profileData.father?.name || 'ไม่ระบุ'}
- เลขบัตรประชาชนบิดา: ${profileData.father?.citizen_id || 'ไม่ระบุ'}
- ชื่อมารดา: ${profileData.mother?.name || 'ไม่ระบุ'}
- เลขบัตรประชาชนมารดา: ${profileData.mother?.citizen_id || 'ไม่ระบุ'}

กรุณาเปรียบเทียบข้อมูลที่สกัดได้กับข้อมูลโปรไฟล์ด้วย`;
  }

 const prompt = `
คุณเป็นผู้เชี่ยวชาญในการตรวจสอบเอกสารทางกฎหมายของประเทศไทย กรุณาตรวจสอบเอกสารนี้อย่างละเอียดว่าเป็น${statusTypeText[statusType] || 'เอกสารสถานะทางกฎหมาย'}ที่ถูกต้องและครบถ้วนหรือไม่
 ${profileInfo}

📋 **สำหรับใบหย่า ให้ตรวจสอบ:**

1. **ข้อมูลบุคคลที่หย่า**
   - ชื่อ-นามสกุลของคู่สมรสทั้งสองฝ่าย (ภาษาไทย)
   - เลขประจำตัวประชาชนของคู่สมรสทั้งสอง (13 หลัก)
     * ตรวจสอบรูปแบบที่ถูกต้อง (ตัวเลข 13 หลัก)
     * ตรวจสอบ checksum digit (หลักที่ 13)
   - วัน/เดือน/ปี เกิดของคู่สมรสทั้งสอง
   - ความสมบูรณ์ของข้อมูล (ไม่มีช่องว่าง)

2. **ข้อมูลทางกฎหมาย**
   - เลขทะเบียนหย่า (เลขที่เอกสาร)
   - วันที่จดทะเบียนหย่า (ต้องไม่เป็นวันในอนาคต)
   - สถานที่จดทะเบียน (สำนักงานเขต/อำเภอ/กิ่งอำเภอ)
   - จังหวัด

3. **ลายเซ็นและเจ้าหน้าที่**
   - ลายเซ็นของคู่สมรสทั้งสองฝ่าย (ต้องมี)
   - ลายเซ็นพยาน 2 คน (ชื่อ-นามสกุลพยาน)
   - ชื่อเจ้าพนักงานทะเบียน
   - ลายเซ็นเจ้าพนักงานทะเบียน
   - ตราประทับราชการ (ต้องมีและชัดเจน)

4. **ความถูกต้องและครบถ้วน**
   - ไม่มีช่องว่างที่ควรมีข้อมูล
   - ข้อมูลไม่ขัดแย้งกัน
   - รูปแบบเอกสารตรงตามมาตรฐานราชการ
   - คุณภาพการถ่ายเอกสาร (ชัดเจน/อ่านได้)

---

📋 **สำหรับใบมรณบัตร ให้ตรวจสอบ:**

1. **ข้อมูลผู้เสียชีวิต**
   - ชื่อ-นามสกุลผู้เสียชีวิต (ภาษาไทย)
   - เลขบัตรประชาชนผู้เสียชีวิต (13 หลัก)
     * ตรวจสอบรูปแบบที่ถูกต้อง
     * ตรวจสอบ checksum digit
   - วัน/เดือน/ปี เกิด
   - วัน/เดือน/ปี ที่เสียชีวิต (ต้องไม่เป็นวันในอนาคต)
   - อายุ (ต้องคำนวณตรงกับวันเกิด-วันเสียชีวิต)
   - เพศ

2. **รายละเอียดการเสียชีวิต**
   - สถานที่เสียชีวิต (โรงพยาบาล/บ้าน/ที่เกิดเหตุ - ต้องระบุชัดเจน)
   - สาเหตุการเสียชีวิต (ต้องไม่เว้นว่าง)
   - แพทย์ผู้รับรอง (กรณีเสียชีวิตในโรงพยาบาล)
   - เวลาเสียชีวิต (ถ้ามี)

3. **ข้อมูลผู้แจ้ง**
   - ชื่อ-นามสกุลผู้นำแจ้ง
   - ความสัมพันธ์กับผู้เสียชีวิต (บุตร/คู่สมรส/ญาติ)
   - เลขบัตรประชาชนผู้แจ้ง (13 หลัก)
   - ที่อยู่ผู้แจ้ง

4. **ข้อมูลเจ้าหน้าที่**
   - ชื่อเจ้าพนักงานทะเบียนผู้รับแจ้ง
   - วัน/เดือน/ปี ที่ออกเอกสาร
   - สำนักงานเขต/อำเภอที่ออกเอกสาร
   - ลายเซ็นเจ้าพนักงานทะเบียน
   - ตราประทับราชการ (ต้องมีและชัดเจน)

5. **ความถูกต้องและครบถ้วน**
   - ข้อมูลทุกช่องต้องมีการกรอก (ไม่เว้นว่าง)
   - วันที่ต้องสมเหตุสมผล (เสียชีวิต < ออกเอกสาร)
   - อายุต้องคำนวณถูกต้อง
   - รูปแบบเอกสารตรงตามมาตรฐาน

---

🔍 **การตรวจสอบเลขประจำตัวประชาชน 13 หลัก:**
- รูปแบบ: X-XXXX-XXXXX-XX-X
- 12 หลักแรก: ข้อมูลประชากร
- หลักที่ 13: Checksum (คำนวณจากหลัก 1-12)
- วิธีตรวจ: ใช้สูตร MOD 11 checksum

---

กรุณาตอบในรูปแบบ JSON เท่านั้น:
{
  "isLegalStatusDoc": true/false,
  "statusType": "${statusType}",
  "documentType": "ใบหย่า/ใบมรณบัตร/เอกสารอื่น",
  "confidence": 0-100,
  "isValidDocument": true/false,
  "isExpired": true/false/null,
  "imageQuality": "excellent/clear/blurry/poor",
  "extractedData": {
    "documentNumber": "เลขที่เอกสาร",
    "personName": "ชื่อ-นามสกุล",
    "personIDNumber": "เลขประจำตัวประชาชน",
    "personBirthDate": "วันเกิด",
    "spouseName": "ชื่อคู่สมรส (กรณีใบหย่า)",
    "spouseIDNumber": "เลขประจำตัวคู่สมรส (กรณีใบหย่า)",
    "spouseBirthDate": "วันเกิดคู่สมรส (กรณีใบหย่า)",
    "divorceDate": "วันที่หย่า (กรณีใบหย่า)",
    "divorceLocation": "สถานที่จดทะเบียนหย่า",
    "witness1Name": "ชื่อพยานคนที่ 1 (กรณีใบหย่า)",
    "witness2Name": "ชื่อพยานคนที่ 2 (กรณีใบหย่า)",
    "deathDate": "วันที่เสียชีวิต (กรณีใบมรณบัตร)",
    "deathTime": "เวลาเสียชีวิต",
    "deathLocation": "สถานที่เสียชีวิต",
    "causeOfDeath": "สาเหตุการเสียชีวิต",
    "age": "อายุ (กรณีใบมรณบัตร)",
    "reporterName": "ชื่อผู้แจ้ง (กรณีใบมรณบัตร)",
    "reporterIDNumber": "เลขประจำตัวผู้แจ้ง",
    "reporterRelation": "ความสัมพันธ์กับผู้เสียชีวิต",
    "doctorName": "ชื่อแพทย์ผู้รับรอง",
    "issueDate": "วันที่ออกเอกสาร",
    "issuingOffice": "หน่วยงานที่ออก",
    "registrarName": "ชื่อนายทะเบียน",
    "province": "จังหวัด"
  },
  "officialFeatures": {
    "hasOfficialSeal": true/false,
    "hasRegistrarSignature": true/false,
    "hasGovLogo": true/false,
    "hasWatermark": true/false,
    "hasOfficialFormat": true/false,
    "hasWitnessSignatures": true/false,
    "hasSpouseSignatures": true/false
  },
  "validityChecks": {
    "hasValidFormat": true/false,
    "hasRequiredFields": true/false,
    "isLegitimateDocument": true/false,
    "hasProperAuthority": true/false,
    "idNumberValid": true/false,
    "idChecksumValid": true/false,
    "dateLogical": true/false,
    "ageCalculationCorrect": true/false,
    "noMissingFields": true/false,
    "noConflictingData": true/false
  },
  "qualityIssues": ["รายการปัญหาที่พบ"],
  "recommendations": ["คำแนะนำในการแก้ไข"],
  "detailedFindings": {
    "missingFields": ["ช่องที่ขาดหายไป"],
    "invalidFields": ["ช่องที่มีข้อมูลผิดพลาด"],
    "warnings": ["คำเตือน"]
  },
  "overall_status": "valid/invalid/needs_review"
}

**หมายเหตุสำคัญ:**
1. ตรวจสอบความครบถ้วนของข้อมูลทุกช่องที่จำเป็น
2. ตรวจสอบความถูกต้องของเลขประจำตัวประชาชน (รูปแบบและ checksum)
3. ตรวจสอบความสมเหตุสมผลของวันที่
4. ตรวจสอบการมีอยู่และความชัดเจนของตราประทับและลายเซ็น
5. หากพบปัญหาใดๆ ให้ระบุอย่างชัดเจนใน qualityIssues และ detailedFindings
6. ให้ confidence score ที่สะท้อนความมั่นใจในการตรวจสอบจริง
7. หากมีข้อมูลไม่ครบหรือไม่ชัดเจน ให้ระบุใน missingFields หรือ invalidFields
`;

  try {
    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();

    console.log('🤖 LegalStatus AI Response received');

    // Try to parse JSON response
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Add profile comparison if profile data is available
        if (profileData) {
          const comparison = compareWithProfile(parsed.extractedData, profileData);
          parsed.profileComparison = comparison;

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
        
        console.log('✅ Client-side LegalStatus validation completed');
        return parsed;
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.warn('⚠️ Failed to parse LegalStatus AI response as JSON, using text analysis');
      return analyzeLegalStatusTextResponse(responseText, statusType);
    }
  } catch (error) {
    console.error('❌ Client-side LegalStatus validation failed:', error);
    throw error;
  }
};

// Fallback text analysis for Legal Status
const analyzeLegalStatusTextResponse = (text, statusType) => {
  const lowerText = text.toLowerCase();
  
  const isDivorceDoc = lowerText.includes('ใบหย่า') || 
                      lowerText.includes('หย่า') ||
                      lowerText.includes('divorce') ||
                      lowerText.includes('การสมรส');
  
  const isDeathDoc = lowerText.includes('ใบมรณบัตร') || 
                     lowerText.includes('มรณบัตร') ||
                     lowerText.includes('เสียชีวิต') ||
                     lowerText.includes('death certificate');

  const isLegalStatusDoc = isDivorceDoc || isDeathDoc;
  
  const hasOfficialSeal = lowerText.includes('ตราประทับ') || 
                          lowerText.includes('ตราราชการ') ||
                          lowerText.includes('นายทะเบียน');

  const hasValidID = lowerText.includes('เลขประจำตัว') || 
                     lowerText.includes('หมายเลข') ||
                     lowerText.includes('13 หลัก');

  // Determine document type
  let documentType = 'เอกสารอื่น';
  if (isDivorceDoc) documentType = 'ใบหย่า';
  else if (isDeathDoc) documentType = 'ใบมรณบัตร';

  return {
    isLegalStatusDoc,
    statusType,
    documentType,
    confidence: isLegalStatusDoc ? 75 : 25,
    isValidDocument: isLegalStatusDoc,
    isExpired: null,
    imageQuality: 'unclear',
    extractedData: {},
    officialFeatures: {
      hasOfficialSeal,
      hasRegistrarSignature: false,
      hasGovLogo: false,
      hasWatermark: false,
      hasOfficialFormat: isLegalStatusDoc
    },
    validityChecks: {
      hasValidFormat: isLegalStatusDoc,
      hasRequiredFields: hasValidID,
      isLegitimateDocument: isLegalStatusDoc && hasOfficialSeal,
      hasProperAuthority: hasOfficialSeal
    },
    qualityIssues: !isLegalStatusDoc ? ['ไม่พบเอกสารสถานะทางกฎหมาย'] : [],
    recommendations: !isLegalStatusDoc ? ['กรุณาอัปโหลดใบหย่าหรือใบมรณบัตร'] : [],
    overall_status: isLegalStatusDoc && hasOfficialSeal && hasValidID ? 'valid' : 'needs_review',
    rawResponse: text
  };
};

// Main validation function for Legal Status
export const validateLegalStatus = async (fileUri, statusType = 'legal_status', mimeType = null, includeProfileCheck = true) => {
  try {
    console.log(`🚀 Starting ${statusType} legal status validation...`);
    console.log('File URI:', fileUri);
    console.log('MIME Type:', mimeType);

    // Validate statusType parameter
    const validStatusTypes = ['divorce', 'death', 'legal_status'];
    if (!validStatusTypes.includes(statusType)) {
      throw new Error(`ประเภทเอกสารสถานะไม่ถูกต้อง: ${statusType}. ต้องเป็น: ${validStatusTypes.join(', ')}`);
    }

    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error('ไฟล์ไม่พบ - กรุณาเลือกไฟล์ใหม่');
    }

    // Fetch profile data if requested
    let profileData = null;
    if (includeProfileCheck) {
      profileData = await fetchUserProfileData();
      if (profileData) {
        console.log('✅ Profile data loaded for comparison');
      }
    }

    // Use client-side validation only
    console.log('✅ Using client-side LegalStatus validation');
    return await validateLegalStatusClientSide(fileUri, statusType, mimeType, profileData);

  } catch (error) {
    console.error('❌ LegalStatus validation error:', error);
    throw new Error(`การตรวจสอบเอกสารสถานะทางกฎหมาย ล้มเหลว: ${error.message}`);
  }
};

// Parse and format Legal Status validation result
export const parseLegalStatusResult = (result) => {
  if (!result) return null;

  return {
    isValid: result.overall_status === 'valid' && result.isLegalStatusDoc,
    confidence: result.confidence || 0,
    status: result.overall_status || 'unknown',
    statusType: result.statusType || 'unknown',
    documentType: result.documentType || 'ไม่ทราบ',
    isValidDocument: result.isValidDocument || false,
    isExpired: result.isExpired,
    imageQuality: result.imageQuality || 'unclear',
    extractedData: result.extractedData || {},
    officialFeatures: result.officialFeatures || {},
    validityChecks: result.validityChecks || {},
    profileComparison: result.profileComparison || null,
    qualityIssues: result.qualityIssues || [],
    recommendations: result.recommendations || [],
    rawResult: result
  };
};

// Show Legal Status validation alert
export const showLegalStatusValidationAlert = (result, onAccept, onReject) => {
  let title, message, isValid;

  const profileMismatch = result.profileComparison?.matchStatus === 'mismatch';
  
  if (profileMismatch) {
    title = '⚠️ ข้อมูลไม่ตรงกับโปรไฟล์';
  } else if (result.overall_status === 'valid') {
    title = '✅ ตรวจสอบเอกสารสถานะสำเร็จ';
  } else {
    title = '⚠️ ตรวจพบปัญหา';
  }
  
  let statusText = '';
  if (result.isLegalStatusDoc) {
    statusText += `✅ ตรวจพบ${result.documentType}\n`;
  } else {
    statusText += '❌ ไม่พบเอกสารสถานะทางกฎหมาย\n';
  }

  if (result.documentType && result.documentType !== 'เอกสารอื่น') {
    statusText += `📄 ประเภท: ${result.documentType}\n`;
  }

  if (result.officialFeatures?.hasOfficialSeal) {
    statusText += '✅ ตรวจพบตราประทับราชการ\n';
  } else {
    statusText += '❌ ไม่พบตราประทับราชการ\n';
  }

  if (result.validityChecks?.hasRequiredFields) {
    statusText += '✅ ข้อมูลครบถ้วน\n';
  } else {
    statusText += '❌ ข้อมูลไม่ครบถ้วน\n';
  }

  if (result.isExpired === true) {
    statusText += '⚠️ เอกสารหมดอายุแล้ว\n';
  } else if (result.isExpired === false) {
    statusText += '✅ เอกสารยังไม่หมดอายุ\n';
  }

  statusText += `\n🎯 ความเชื่อมั่น: ${result.confidence}%`;
  statusText += `\nประเภท: ${result.statusType}`;
  statusText += `\nคุณภาพรูป: ${result.imageQuality}`;

  if (result.extractedData && Object.keys(result.extractedData).length > 0) {
    statusText += '\n\n📋 ข้อมูลที่พบ:';
    Object.entries(result.extractedData).forEach(([key, value]) => {
      if (value) statusText += `\n• ${key}: ${value}`;
    });
  }

  // *** เพิ่มใหม่: แสดงผลการเปรียบเทียบกับโปรไฟล์ ***
  if (result.profileComparison) {
    const comp = result.profileComparison;
    statusText += '\n\n👤 เปรียบเทียบกับโปรไฟล์:\n';
    
    if (comp.matchStatus === 'full_match') {
      statusText += '✅ ข้อมูลตรงกับโปรไฟล์ทุกประการ\n';
    } else if (comp.matchStatus === 'partial_match') {
      statusText += '⚠️ ข้อมูลตรงบางส่วน\n';
    } else if (comp.matchStatus === 'mismatch') {
      statusText += '❌ พบข้อมูลไม่ตรงกัน:\n';
      comp.mismatches.forEach(m => {
        statusText += `  • ${m.field}\n`;
        statusText += `    เอกสาร: ${m.extracted}\n`;
        statusText += `    โปรไฟล์: ${m.profile}\n`;
      });
    }
    
    if (comp.comparisonDetails) {
      statusText += `\nเปรียบเทียบ: ${comp.comparisonDetails.fieldsMatched}/${comp.comparisonDetails.fieldsCompared} รายการ\n`;
    }
  }

  if (result.officialFeatures && Object.keys(result.officialFeatures).some(key => result.officialFeatures[key])) {
    statusText += '\n\n🏛️ ลักษณะราชการ:';
    Object.entries(result.officialFeatures).forEach(([key, value]) => {
      if (value === true) statusText += `\n• ${key}: มี`;
    });
  }

  if (result.qualityIssues && result.qualityIssues.length > 0) {
    statusText += '\n\n⚠️ ปัญหาที่พบ:\n• ' + result.qualityIssues.join('\n• ');
  }

  if (result.recommendations && result.recommendations.length > 0) {
    statusText += '\n\n💡 คำแนะนำ:\n• ' + result.recommendations.join('\n• ');
  }

  message = statusText;
  isValid = result.overall_status === 'valid' && result.isLegalStatusDoc && !profileMismatch;

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
      onPress: onAccept,
    });
  }

  Alert.alert(title, message, buttons);
};

// Get Legal Status type display name
export const getLegalStatusTypeName = (statusType) => {
  const statusTypeNames = {
    'divorce': 'ใบหย่า',
    'death': 'ใบมรณบัตร',
    'legal_status': 'เอกสารสถานะทางกฎหมาย'
  };
  return statusTypeNames[statusType] || 'ไม่ทราบ';
};

// Validate multiple Legal Status documents
export const validateMultipleLegalStatus = async (files, includeProfileCheck = true) => {
  const results = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await validateLegalStatus(
        file.uri, 
        file.statusType || 'legal_status', 
        file.mimeType,
        includeProfileCheck
      );
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        statusType: file.statusType || 'legal_status',
        validation: result,
        success: true,
        profileMatch: result.profileComparison?.matchStatus !== 'mismatch'
      });
    } catch (error) {
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        statusType: file.statusType || 'legal_status',
        error: error.message,
        success: false,
        profileMatch: false
      });
    }
  }
  
  return results;
};

// Check Legal Status AI backend status
export const checkLegalStatusAIStatus = async () => {
  try {
    console.log('🤖 Checking LegalStatus AI backend status...');

    // Client-side only validation
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      console.error('❌ Gemini API key not configured for LegalStatus');
      return false;
    }

    const initialized = initializeGemini();
    if (!initialized) {
      console.error('❌ Failed to initialize Gemini AI for LegalStatus');
      return false;
    }

    // Test with a simple request
    try {
      console.log('🔬 Testing client-side LegalStatus AI connection...');
      const testResult = await model.generateContent("Test connection - respond with OK");
      const testResponse = await testResult.response;
      const text = testResponse.text();
      
      console.log('✓ Client-side LegalStatus AI is available');
      return true;
    } catch (testError) {
      console.error('❌ Client-side LegalStatus AI test failed:', testError.message);
      return false;
    }
    
  } catch (error) {
    console.error('❌ LegalStatus AI backend check failed:', error);
    return false;
  }
};