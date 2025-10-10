// documents_ai/GovIDCertAI.js - AI validation for Government Officer ID Card documents
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';

// Configuration - Client-side only
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

let genAI = null;
let model = null;

console.log('🔧 GovIDCertAI Configuration:');
console.log('- Client-side only (no backend server)');
console.log('- API Key configured:', !!GEMINI_API_KEY);

// Initialize Gemini AI for client-side processing
const initializeGemini = () => {
  if (!genAI && GEMINI_API_KEY && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      console.log('✓ Gemini AI initialized successfully for GovIDCert');
      return true;
    } catch (error) {
      console.error('Failed to initialize Gemini AI for GovIDCert:', error);
      return false;
    }
  }
  return !!genAI;
};

// Convert file to format suitable for Gemini
const prepareFileForGemini = async (fileUri, mimeType) => {
  try {
    console.log('📁 Preparing GovIDCert file for Gemini AI...');
    
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

    console.log('✅ GovIDCert file prepared for Gemini');
    return {
      inlineData: {
        data: base64Data,
        mimeType: actualMimeType,
      },
    };
  } catch (error) {
    console.error('❌ Error preparing GovIDCert file for Gemini:', error);
    throw new Error(`ไม่สามารถเตรียมไฟล์สำหรับการวิเคราะห์ได้: ${error.message}`);
  }
};

// Client-side Government Officer ID Card validation
const validateGovIDCertClientSide = async (fileUri, certType, mimeType) => {
  console.log(`🤖 Starting client-side ${certType} government ID cert validation...`);
  
  if (!model) {
    const initialized = initializeGemini();
    if (!initialized) {
      throw new Error('ระบบ AI ไม่พร้อมใช้งาน - กรุณาตรวจสอบ API Key');
    }
  }

  const filePart = await prepareFileForGemini(fileUri, mimeType);

  const certTypeText = {
    'father': 'ข้าราชการผู้รับรองบิดา',
    'mother': 'ข้าราชการผู้รับรองมารดา',
    'family': 'ข้าราชการผู้รับรองครอบครัว',
    'parents': 'ข้าราชการผู้รับรองบิดามารดา',
    'guardian': 'ข้าราชการผู้รับรองผู้ปกครอง',
    'income_cert': 'ข้าราชการผู้รับรอง (กยศ 102)'
  };

  const prompt = `
ตรวจสอบเอกสารนี้ว่าเป็นสำเนาบัตรประจำตัวข้าราชการของ${certTypeText[certType] || 'ข้าราชการ'} หรือไม่

กรุณาตรวจสอบและตอบในรูปแบบ JSON ดังนี้:
{
  "isGovIDCard": true/false,
  "certType": "${certType}",
  "confidence": 0-100,
  "cardType": "บัตรประจำตัวข้าราชการ/บัตรประจำตัวพนักงานรัฐวิสาหกิจ/บัตรประชาชน/อื่นๆ",
  "govType": "ข้าราชการ/พนักงานรัฐวิสาหกิจ/ลูกจ้างประจำ/พนักงานราชการ/อื่นๆ",
  "isValidIDNumber": true/false,
  "isExpired": true/false/null,
  "imageQuality": "clear/blurry/poor/excellent",
  "extractedData": {
    "idNumber": "เลขประจำตัว",
    "govIDNumber": "เลขประจำตัวข้าราชการ",
    "name": "ชื่อ-นามสกุล",
    "nameEn": "ชื่อ-นามสกุลภาษาอังกฤษ",
    "dateOfBirth": "วันเกิด",
    "position": "ตำแหน่ง",
    "rank": "ยศ/ระดับ",
    "department": "กรม/หน่วยงาน",
    "ministry": "กระทรวง",
    "issueDate": "วันที่ออกบัตร",
    "expiryDate": "วันหมดอายุ",
    "address": "ที่อยู่"
  },
  "officialFeatures": {
    "hasOfficialSeal": true/false,
    "hasGovLogo": true/false,
    "hasWatermark": true/false,
    "hasHologram": true/false,
    "hasOfficialFormat": true/false
  },
  "validityChecks": {
    "hasValidFormat": true/false,
    "hasRequiredFields": true/false,
    "isLegitimateGovCard": true/false
  },
  "qualityIssues": ["ปัญหาที่พบ"],
  "recommendations": ["คำแนะนำ"],
  "overall_status": "valid/invalid/needs_review"
}

ให้ความสำคัญกับ:
1. การตรวจสอบว่าเป็นบัตรประจำตัวข้าราชการไทยจริง
2. เลขประจำตัวประชาชน 13 หลัก และเลขประจำตัวข้าราชการ
3. ตำแหน่งและหน่วยงานที่ระบุ
4. ตราหน่วยงานและลายเซ็นราชการ
5. วันหมดอายุของบัตร
6. ลักษณะการรักษาความปลอดภัย (watermark, hologram, ตราประทับ)
7. ความสมบูรณ์และความถูกต้องของข้อมูล
8. รูปแบบมาตรฐานของบัตรข้าราชการ
9. ชื่อกรมและกระทรวงที่สังกัด
`;

  try {
    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();

    console.log('🤖 GovIDCert AI Response received');

    // Try to parse JSON response
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('✅ Client-side GovIDCert validation completed');
        return parsed;
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.warn('⚠️ Failed to parse GovIDCert AI response as JSON, using text analysis');
      return analyzeGovIDCertTextResponse(responseText, certType);
    }
  } catch (error) {
    console.error('❌ Client-side GovIDCert validation failed:', error);
    throw error;
  }
};

// Fallback text analysis for Government Officer ID Card
const analyzeGovIDCertTextResponse = (text, certType) => {
  const lowerText = text.toLowerCase();
  
  const isGovIDCard = lowerText.includes('บัตรประจำตัวข้าราชการ') || 
                     lowerText.includes('บัตรข้าราชการ') ||
                     lowerText.includes('government id') ||
                     lowerText.includes('official id') ||
                     lowerText.includes('ข้าราชการ') ||
                     lowerText.includes('พนักงานรัฐวิสาหกิจ');
  
  const hasOfficialSeal = lowerText.includes('ตราประทับ') || 
                          lowerText.includes('ตราราชการ') ||
                          lowerText.includes('ตราหน่วยงาน');

  const hasValidID = lowerText.includes('เลขประจำตัว') || 
                     lowerText.includes('หมายเลข') ||
                     lowerText.includes('13 หลัก');

  // Determine government type
  let govType = 'ไม่ทราบ';
  if (lowerText.includes('ข้าราชการ')) govType = 'ข้าราชการ';
  else if (lowerText.includes('พนักงานรัฐวิสาหกิจ')) govType = 'พนักงานรัฐวิสาหกิจ';
  else if (lowerText.includes('พนักงานราชการ')) govType = 'พนักงานราชการ';

  return {
    isGovIDCard,
    certType,
    confidence: isGovIDCard ? 75 : 25,
    cardType: isGovIDCard ? 'บัตรประจำตัวข้าราชการ' : 'ไม่ทราบ',
    govType,
    isValidIDNumber: hasValidID,
    isExpired: null,
    imageQuality: 'unclear',
    extractedData: {},
    officialFeatures: {
      hasOfficialSeal,
      hasGovLogo: false,
      hasWatermark: false,
      hasHologram: false,
      hasOfficialFormat: isGovIDCard
    },
    validityChecks: {
      hasValidFormat: isGovIDCard,
      hasRequiredFields: hasValidID,
      isLegitimateGovCard: isGovIDCard && hasOfficialSeal
    },
    qualityIssues: !isGovIDCard ? ['ไม่พบบัตรประจำตัวข้าราชการ'] : [],
    recommendations: !isGovIDCard ? ['กรุณาอัปโหลดสำเนาบัตรประจำตัวข้าราชการ'] : [],
    overall_status: isGovIDCard && hasOfficialSeal && hasValidID ? 'valid' : 'needs_review',
    rawResponse: text
  };
};

// Main validation function for Government Officer ID Card
export const validateGovIDCert = async (fileUri, certType = 'father', mimeType = null) => {
  try {
    console.log(`🚀 Starting ${certType} government ID cert validation...`);
    console.log('File URI:', fileUri);
    console.log('MIME Type:', mimeType);

    // Validate certType parameter
    const validCertTypes = ['father', 'mother', 'family', 'parents', 'guardian', 'income_cert'];
    if (!validCertTypes.includes(certType)) {
      throw new Error(`ประเภทใบรับรองไม่ถูกต้อง: ${certType}. ต้องเป็น: ${validCertTypes.join(', ')}`);
    }

    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error('ไฟล์ไม่พบ - กรุณาเลือกไฟล์ใหม่');
    }

    // Use client-side validation only
    console.log('✅ Using client-side GovIDCert validation');
    return await validateGovIDCertClientSide(fileUri, certType, mimeType);

  } catch (error) {
    console.error('❌ GovIDCert validation error:', error);
    throw new Error(`การตรวจสอบบัตรประจำตัวข้าราชการ ล้มเหลว: ${error.message}`);
  }
};

// Parse and format Government Officer ID Card validation result
export const parseGovIDCertResult = (result) => {
  if (!result) return null;

  return {
    isValid: result.overall_status === 'valid' && result.isGovIDCard,
    confidence: result.confidence || 0,
    status: result.overall_status || 'unknown',
    certType: result.certType || 'unknown',
    cardType: result.cardType || 'ไม่ทราบ',
    govType: result.govType || 'ไม่ทราบ',
    isValidIDNumber: result.isValidIDNumber || false,
    isExpired: result.isExpired,
    imageQuality: result.imageQuality || 'unclear',
    extractedData: result.extractedData || {},
    officialFeatures: result.officialFeatures || {},
    validityChecks: result.validityChecks || {},
    qualityIssues: result.qualityIssues || [],
    recommendations: result.recommendations || [],
    rawResult: result
  };
};

// Show Government Officer ID Card validation alert
export const showGovIDCertValidationAlert = (result, onAccept, onReject) => {
  let title, message, isValid;

  title = result.overall_status === 'valid' ? '✅ ตรวจสอบบัตรประจำตัวข้าราชการสำเร็จ' : '⚠️ ตรวจพบปัญหา';
  
  let statusText = '';
  if (result.isGovIDCard) {
    statusText += '✅ ตรวจพบบัตรประจำตัวข้าราชการ\n';
  } else {
    statusText += '❌ ไม่พบบัตรประจำตัวข้าราชการ\n';
  }

  if (result.govType && result.govType !== 'ไม่ทราบ') {
    statusText += `🏛️ ประเภท: ${result.govType}\n`;
  }

  if (result.officialFeatures?.hasOfficialSeal) {
    statusText += '✅ ตรวจพบตราหน่วยงาน\n';
  } else {
    statusText += '❌ ไม่พบตราหน่วยงาน\n';
  }

  if (result.isValidIDNumber) {
    statusText += '✅ เลขประจำตัวถูกต้อง\n';
  } else {
    statusText += '❌ เลขประจำตัวไม่ชัดเจน\n';
  }

  if (result.isExpired === true) {
    statusText += '⚠️ บัตรหมดอายุแล้ว\n';
  } else if (result.isExpired === false) {
    statusText += '✅ บัตรยังไม่หมดอายุ\n';
  }

  statusText += `\n🎯 ความเชื่อมั่น: ${result.confidence}%`;
  statusText += `\nประเภท: ${result.certType}`;
  statusText += `\nคุณภาพรูป: ${result.imageQuality}`;

  if (result.extractedData && Object.keys(result.extractedData).length > 0) {
    statusText += '\n\n📋 ข้อมูลที่พบ:';
    Object.entries(result.extractedData).forEach(([key, value]) => {
      if (value) statusText += `\n• ${key}: ${value}`;
    });
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
  isValid = result.overall_status === 'valid' && result.isGovIDCard;

  const buttons = [
    {
      text: 'ลองใหม่',
      style: 'cancel',
      onPress: onReject,
    },
  ];

  if (isValid || result.overall_status === 'needs_review') {
    buttons.push({
      text: result.overall_status === 'valid' ? 'ใช้ไฟล์นี้' : 'ใช้ไฟล์นี้ (ต้องตรวจสอบ)',
      onPress: onAccept,
    });
  }

  Alert.alert(title, message, buttons);
};

// Get Government Officer ID Card type display name
export const getGovIDCertTypeName = (certType) => {
  const certTypeNames = {
    'father': 'ข้าราชการผู้รับรองบิดา',
    'mother': 'ข้าราชการผู้รับรองมารดา',
    'family': 'ข้าราชการผู้รับรองครอบครัว',
    'parents': 'ข้าราชการผู้รับรองบิดามารดา',
    'guardian': 'ข้าราชการผู้รับรองผู้ปกครอง',
    'income_cert': 'ข้าราชการผู้รับรอง (กยศ 102)'
  };
  return certTypeNames[certType] || 'ไม่ทราบ';
};

// Validate multiple Government Officer ID Cards
export const validateMultipleGovIDCerts = async (files) => {
  const results = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await validateGovIDCert(file.uri, file.certType || 'father', file.mimeType);
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        certType: file.certType || 'father',
        validation: result,
        success: true
      });
    } catch (error) {
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        certType: file.certType || 'father',
        error: error.message,
        success: false
      });
    }
  }
  
  return results;
};

// Check Government Officer ID Card AI backend status
export const checkGovIDCertAIStatus = async () => {
  try {
    console.log('🤖 Checking GovIDCert AI backend status...');

    // Client-side only validation
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      console.error('❌ Gemini API key not configured for GovIDCert');
      return false;
    }

    const initialized = initializeGemini();
    if (!initialized) {
      console.error('❌ Failed to initialize Gemini AI for GovIDCert');
      return false;
    }

    // Test with a simple request
    try {
      console.log('🔬 Testing client-side GovIDCert AI connection...');
      const testResult = await model.generateContent("Test connection - respond with OK");
      const testResponse = await testResult.response;
      const text = testResponse.text();
      
      console.log('✓ Client-side GovIDCert AI is available');
      return true;
    } catch (testError) {
      console.error('❌ Client-side GovIDCert AI test failed:', testError.message);
      return false;
    }
    
  } catch (error) {
    console.error('❌ GovIDCert AI backend check failed:', error);
    return false;
  }
};