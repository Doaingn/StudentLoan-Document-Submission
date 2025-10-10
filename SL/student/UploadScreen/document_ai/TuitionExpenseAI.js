// documents_ai/TuitionExpenseAI.js - AI validation for Tuition Expense documents with profile comparison
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../../database/firebase";

// Configuration
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const AI_BACKEND_URL = process.env.EXPO_PUBLIC_AI_BACKEND_URL || 'http://192.168.1.103:3001';
const USE_BACKEND_SERVER = process.env.EXPO_PUBLIC_USE_AI_BACKEND === 'true';

// Validation requirements for Tuition Expense document
const TUITION_EXPENSE_REQUIREMENTS = {
  requiredColumns: [
    'ภาคการศึกษา',
    'หมายเหตุ',
    'ทุนการศึกษา',
    'จำนวนเงิน',
    'รับ',
    'ประเภท'
  ],
  mustHaveRInLatestTerm: true,
  validTypes: ['R', 'E', 'F', 'I', 'N', 'P']
};

let genAI = null;
let model = null;

console.log('🔧 TuitionExpenseAI Configuration:');
console.log('- Backend URL:', AI_BACKEND_URL);
console.log('- Use Backend:', USE_BACKEND_SERVER);
console.log('- API Key configured:', !!GEMINI_API_KEY);
console.log('- Validation requirements:', TUITION_EXPENSE_REQUIREMENTS);

// Initialize Gemini AI for client-side processing
const initializeGemini = () => {
  if (!genAI && GEMINI_API_KEY) {
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      console.log('✓ Gemini AI initialized successfully for TuitionExpense');
      return true;
    } catch (error) {
      console.error('Failed to initialize Gemini AI for TuitionExpense:', error);
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
      name: userData.name || null,
      student_id: userData.student_id || null,
      citizen_id: userData.citizen_id || null,
    };
  } catch (error) {
    console.error('❌ Error fetching user profile data:', error);
    return null;
  }
};

// Compare extracted student name with profile data
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

  // Helper function to normalize Thai text for comparison
  const normalizeText = (text) => {
    if (!text) return '';
    return text.toString().trim().toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\u0E00-\u0E7Fa-z0-9\s]/g, '');
  };

  // Extract student name from the document header or title
  // The document should contain student ID and name (e.g., "B6641214 นายณัฐพงษ์ ชนะกี")
  const extractedName = extractedData.studentName;
  const extractedStudentId = extractedData.studentId;

  // Compare student name
  if (extractedName && profileData.name) {
    const normalizedExtracted = normalizeText(extractedName);
    const normalizedProfile = normalizeText(profileData.name);
    
    if (normalizedExtracted === normalizedProfile) {
      matches.name = true;
    } else if (normalizedExtracted.includes(normalizedProfile) || normalizedProfile.includes(normalizedExtracted)) {
      matches.name = true;
      warnings.push('ชื่อในเอกสารและโปรไฟล์ใกล้เคียงกัน แต่ไม่ตรงทุกตัวอักษร');
    } else {
      matches.name = false;
      mismatches.push({
        field: 'ชื่อ-นามสกุล',
        extracted: extractedName,
        profile: profileData.name
      });
    }
  }

  // Compare student ID
  if (extractedStudentId && profileData.student_id) {
    const normalizedExtractedId = extractedStudentId.replace(/\D/g, '');
    const normalizedProfileId = profileData.student_id.replace(/\D/g, '');
    
    if (normalizedExtractedId === normalizedProfileId) {
      matches.student_id = true;
    } else {
      matches.student_id = false;
      mismatches.push({
        field: 'รหัสนักศึกษา',
        extracted: extractedStudentId,
        profile: profileData.student_id
      });
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
    warnings.push('ไม่พบข้อมูลนักศึกษาในเอกสารสำหรับการเปรียบเทียบ');
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

// Check if AI backend server is available
const checkBackendServer = async () => {
  try {
    console.log('🔍 Checking backend server for TuitionExpense at:', AI_BACKEND_URL);
    
    const response = await fetch(`${AI_BACKEND_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✓ AI Backend Server is available for TuitionExpense:', data.status);
      return true;
    } else {
      console.log('❌ Backend server responded with error:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ AI Backend Server not available for TuitionExpense:', error.message);
    return false;
  }
};

// Server-side validation for Tuition Expense
const validateTuitionExpenseViaServer = async (fileUri, mimeType, profileData) => {
  try {
    console.log('📤 Uploading to server for tuition expense validation...');
    
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }

    const formData = new FormData();
    const file = {
      uri: fileUri,
      type: mimeType || 'image/jpeg',
      name: `tuition_expense_${Date.now()}.${mimeType ? mimeType.split('/')[1] : 'jpg'}`,
    };
    
    formData.append('document', file);
    if (profileData) {
      formData.append('profileData', JSON.stringify(profileData));
    }

    const response = await fetch(`${AI_BACKEND_URL}/ai/validate/tuition-expense`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server validation error:', errorText);
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Server TuitionExpense validation completed');
    
    return result.validation;

  } catch (error) {
    console.error('❌ Server TuitionExpense validation error:', error);
    throw error;
  }
};

// Convert file to format suitable for Gemini (client-side)
const prepareFileForGemini = async (fileUri, mimeType) => {
  try {
    console.log('📁 Preparing TuitionExpense file for Gemini AI...');
    
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

    console.log('✅ TuitionExpense file prepared for Gemini');
    return {
      inlineData: {
        data: base64Data,
        mimeType: actualMimeType,
      },
    };
  } catch (error) {
    console.error('❌ Error preparing TuitionExpense file for Gemini:', error);
    throw new Error(`ไม่สามารถเตรียมไฟล์สำหรับการวิเคราะห์ได้: ${error.message}`);
  }
};

// Client-side Tuition Expense validation
const validateTuitionExpenseClientSide = async (fileUri, mimeType, profileData) => {
  console.log('🤖 Starting client-side tuition expense validation...');
  
  if (!model) {
    const initialized = initializeGemini();
    if (!initialized) {
      throw new Error('ระบบ AI ไม่พร้อมใช้งาน - กรุณาตรวจสอบ API Key');
    }
  }

  const filePart = await prepareFileForGemini(fileUri, mimeType);

  let profileInfo = '';
  if (profileData) {
    profileInfo = `

**ข้อมูลโปรไฟล์สำหรับเปรียบเทียบ:**
- ชื่อ-นามสกุล: ${profileData.name || 'ไม่ระบุ'}
- รหัสนักศึกษา: ${profileData.student_id || 'ไม่ระบุ'}

กรุณาดึงข้อมูลนักศึกษาจากหัวเอกสาร (ชื่อและรหัสนักศึกษา) และเปรียบเทียบกับข้อมูลโปรไฟล์`;
  }

  const prompt = `
ตรวจสอบเอกสารนี้ว่าเป็นตารางภาระค่าใช้จ่ายทุนการศึกษา (ทุนการศึกษา) หรือไม่
${profileInfo}

**ข้อกำหนดสำคัญ:**
1. ต้องเป็นตารางที่มีคอลัมน์: ภาคการศึกษา, หมายเหตุ, ทุนการศึกษา, จำนวนเงิน, รับ, ประเภท
2. ในคอลัมน์ "ประเภท" ของภาคการศึกษาล่าสุด (เทอมล่าสุด) **ต้องมีตัว "R"**
3. ประเภทที่ถูกต้อง: R (ไม่ต้องชำระเงิน- กินส่วนหนึ่งหรือ ทุนทบวง), E, F, I, N, P
4. ต้องมีข้อมูลจำนวนเงินที่ชัดเจน
5. หมายเหตุควรอธิบายรายละเอียดทุน (เช่น "ทุนคณิต -คณจจ. - (ลงทะเบียน+ค่าธรรมเนียมการศึกษา)")
6. **ต้องดึงข้อมูลนักศึกษาจากหัวเอกสาร (รหัสนักศึกษาและชื่อ-นามสกุล) เช่น "B6641214 นายณัฐพงษ์ ชนะกี"**

**คำอธิบายประเภท:**
- E: ต้องชำระเงิน- ไม่กินส่วนหนึ่งหรือ (ภายนอก)
- F: ทุนบริษัท (ไม่ใช้รับตรงระดับปริญญาตรี)
- I: ทุนยกเว้น (ไม่ใช้รับตรงระดับปริญญาตรี)
- N: ไม่ต้องชำระเงิน- ไม่กินส่วนหนึ่งหรือ (ภายใน)
- P: คิดแบบเหมาจ่าย
- R: ไม่ต้องชำระเงิน- กินส่วนหนึ่งหรือ (ทุนทบวง)

กรุณาตรวจสอบและตอบในรูปแบบ JSON ดังนี้:
{
  "isTuitionExpenseDoc": true/false,
  "confidence": 0-100,
  "documentType": "ภาระค่าใช้จ่ายทุนการศึกษา/อื่นๆ",
  "hasRequiredColumns": true/false,
  "imageQuality": "clear/blurry/poor/excellent",
  "studentInfo": {
    "studentId": "รหัสนักศึกษา เช่น B6641214",
    "studentName": "ชื่อ-นามสกุล เช่น นายณัฐพงษ์ ชนะกี"
  },
  "extractedData": {
    "latestTerm": "ภาคล่าสุด เช่น 1/2568",
    "latestTermType": "ประเภทของภาคล่าสุด เช่น R",
    "latestTermScholarship": "ชื่อทุนของภาคล่าสุด",
    "latestTermAmount": "จำนวนเงินของภาคล่าสุด",
    "latestTermNote": "หมายเหตุของภาคล่าสุด",
    "totalTerms": "จำนวนภาคการศึกษาทั้งหมด",
    "allTerms": [
      {
        "term": "ภาคการศึกษา",
        "scholarship": "ทุนการศึกษา",
        "amount": "จำนวนเงิน",
        "received": "รับ",
        "type": "ประเภท",
        "note": "หมายเหตุ"
      }
    ]
  },
  "validation": {
    "hasRInLatestTerm": true/false,
    "latestTermTypeValid": true/false,
    "latestTermDetails": "รายละเอียดเทอมล่าสุด"
  },
  "qualityIssues": ["ปัญหาที่พบ"],
  "recommendations": ["คำแนะนำ"],
  "overall_status": "valid/invalid/needs_review"
}

**สำคัญมาก:**
- ดึงรหัสนักศึกษาและชื่อจากหัวเอกสาร (ด้านบนของตาราง)
- ตรวจสอบให้แน่ใจว่าภาคการศึกษาล่าสุด (เทอมล่าสุด) มีตัว "R" ในช่องประเภท
- ถ้าไม่มีตัว "R" ในภาคล่าสุด ให้ overall_status เป็น "invalid"
- ถ้ามีตัว "R" ในภาคล่าสุด ให้ overall_status เป็น "valid"
- ดึงข้อมูลทุกภาคการศึกษาที่พบในตาราง
- ระบุจำนวนเงินและประเภทของแต่ละภาค
`;

  try {
    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();

    console.log('🤖 TuitionExpense AI Response received');

    let parsed;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.warn('⚠️ Failed to parse TuitionExpense AI response as JSON, using text analysis');
      parsed = analyzeTuitionExpenseTextResponse(responseText);
    }

    // Add profile comparison
    if (profileData && parsed.studentInfo) {
      const comparison = compareWithProfile(parsed.studentInfo, profileData);
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
        parsed.recommendations.push('กรุณาตรวจสอบว่าข้อมูลนักศึกษาในเอกสารตรงกับข้อมูลในโปรไฟล์');
        
        if (parsed.overall_status === 'valid') {
          parsed.overall_status = 'needs_review';
        }
      }

      if (comparison.warnings.length > 0) {
        parsed.recommendations = parsed.recommendations || [];
        parsed.recommendations.push(...comparison.warnings);
      }
    }

    console.log('✅ Client-side TuitionExpense validation completed');
    return parsed;
  } catch (error) {
    console.error('❌ Client-side TuitionExpense validation failed:', error);
    throw error;
  }
};

// Fallback text analysis for Tuition Expense
const analyzeTuitionExpenseTextResponse = (text) => {
  const lowerText = text.toLowerCase();
  
  const isTuitionDoc = lowerText.includes('ทุนการศึกษา') || 
                       lowerText.includes('ภาระค่าใช้จ่าย') ||
                       lowerText.includes('ภาคการศึกษา') ||
                       lowerText.includes('tuition');
  
  const hasRequiredColumns = lowerText.includes('ประเภท') &&
                            lowerText.includes('จำนวนเงิน') &&
                            lowerText.includes('ภาคการศึกษา');

  const hasR = lowerText.includes(' r ') || 
               lowerText.includes('"r"') ||
               lowerText.includes('ประเภท r') ||
               /type.*r/i.test(text);

  return {
    isTuitionExpenseDoc: isTuitionDoc,
    confidence: isTuitionDoc ? 70 : 30,
    documentType: isTuitionDoc ? 'ภาระค่าใช้จ่ายทุนการศึกษา' : 'ไม่ทราบ',
    hasRequiredColumns,
    imageQuality: 'unclear',
    studentInfo: {
      studentId: null,
      studentName: null
    },
    extractedData: {
      latestTerm: null,
      latestTermType: hasR ? 'R' : null,
      latestTermScholarship: null,
      latestTermAmount: null,
      latestTermNote: null,
      totalTerms: 0,
      allTerms: []
    },
    validation: {
      hasRInLatestTerm: hasR,
      latestTermTypeValid: hasR,
      latestTermDetails: hasR ? 'พบตัว R ในเอกสาร' : 'ไม่พบตัว R'
    },
    qualityIssues: !isTuitionDoc ? ['ไม่พบตารางภาระค่าใช้จ่ายทุน'] : !hasR ? ['ไม่พบตัว R ในภาคล่าสุด'] : [],
    recommendations: !isTuitionDoc ? ['กรุณาอัปโหลดเอกสารภาระค่าใช้จ่ายทุนการศึกษา'] : !hasR ? ['ภาคล่าสุดต้องมีประเภท R'] : [],
    overall_status: isTuitionDoc && hasR ? 'valid' : 'invalid',
    rawResponse: text
  };
};

// Main validation function for Tuition Expense
export const validateTuitionExpense = async (fileUri, mimeType = null, includeProfileCheck = true) => {
  try {
    console.log('🚀 Starting tuition expense document validation...');
    console.log('File URI:', fileUri);
    console.log('MIME Type:', mimeType);
    console.log('Validation Requirements:', TUITION_EXPENSE_REQUIREMENTS);

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

    // Try server-side validation first if enabled
    if (USE_BACKEND_SERVER) {
      try {
        const serverAvailable = await checkBackendServer();
        if (serverAvailable) {
          console.log('✅ Using server-side TuitionExpense validation');
          return await validateTuitionExpenseViaServer(fileUri, mimeType, profileData);
        }
      } catch (serverError) {
        console.log('⚠️ Server TuitionExpense validation failed, falling back to client-side:', serverError.message);
      }
    }

    // Fall back to client-side validation
    console.log('✅ Using client-side TuitionExpense validation');
    return await validateTuitionExpenseClientSide(fileUri, mimeType, profileData);

  } catch (error) {
    console.error('❌ TuitionExpense validation error:', error);
    throw new Error(`การตรวจสอบภาระค่าใช้จ่ายทุนล้มเหลว: ${error.message}`);
  }
};

// Parse and format Tuition Expense validation result
export const parseTuitionExpenseResult = (result) => {
  if (!result) return null;

  return {
    isValid: result.overall_status === 'valid' && 
             result.isTuitionExpenseDoc && 
             result.validation?.hasRInLatestTerm &&
             (result.profileComparison?.matchStatus !== 'mismatch'),
    confidence: result.confidence || 0,
    status: result.overall_status || 'unknown',
    documentType: result.documentType || 'ไม่ทราบ',
    hasRequiredColumns: result.hasRequiredColumns || false,
    imageQuality: result.imageQuality || 'unclear',
    studentInfo: result.studentInfo || {},
    extractedData: result.extractedData || {},
    validation: result.validation || {},
    profileComparison: result.profileComparison || null,
    qualityIssues: result.qualityIssues || [],
    recommendations: result.recommendations || [],
    rawResult: result
  };
};

// Show validation alert for Tuition Expense
export const showTuitionExpenseValidationAlert = (result, onAccept, onReject) => {
  let title, message;

  const hasRInLatestTerm = result.validation?.hasRInLatestTerm;
  const profileMismatch = result.profileComparison?.matchStatus === 'mismatch';
  
  if (!result.isTuitionExpenseDoc) {
    title = '❌ เอกสารไม่ถูกต้อง';
  } else if (!hasRInLatestTerm) {
    title = '❌ ภาคล่าสุดไม่มีตัว R';
  } else if (profileMismatch) {
    title = '⚠️ ข้อมูลไม่ตรงกับโปรไฟล์';
  } else if (result.overall_status === 'valid') {
    title = '✅ ตรวจสอบภาระค่าใช้จ่ายทุนสำเร็จ';
  } else {
    title = '⚠️ ตรวจพบปัญหา';
  }
  
  let statusText = '';
  if (result.isTuitionExpenseDoc) {
    statusText += '✅ ตรวจพบเอกสารภาระค่าใช้จ่ายทุน\n';
  } else {
    statusText += '❌ ไม่พบเอกสารภาระค่าใช้จ่ายทุน\n';
  }

  if (result.hasRequiredColumns) {
    statusText += '✅ มีคอลัมน์ครบถ้วน\n';
  } else {
    statusText += '❌ คอลัมน์ไม่ครบถ้วน\n';
  }

  // Student info
  if (result.studentInfo) {
    statusText += '\n👤 ข้อมูลนักศึกษา:\n';
    if (result.studentInfo.studentId) {
      statusText += `• รหัสนักศึกษา: ${result.studentInfo.studentId}\n`;
    }
    if (result.studentInfo.studentName) {
      statusText += `• ชื่อ-นามสกุล: ${result.studentInfo.studentName}\n`;
    }
  }

  // Profile comparison
  if (result.profileComparison) {
    const comp = result.profileComparison;
    statusText += '\n🔍 เปรียบเทียบกับโปรไฟล์:\n';
    
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
    } else if (comp.matchStatus === 'insufficient_data') {
      statusText += '⚠️ ไม่พบข้อมูลนักศึกษาในเอกสาร\n';
    }
    
    if (comp.comparisonDetails) {
      statusText += `\nเปรียบเทียบ: ${comp.comparisonDetails.fieldsMatched}/${comp.comparisonDetails.fieldsCompared} รายการ\n`;
    }
  }

  // Latest term validation
  if (result.extractedData?.latestTerm) {
    statusText += `\n📋 ภาคการศึกษาล่าสุด: ${result.extractedData.latestTerm}\n`;
    
    if (result.extractedData.latestTermType) {
      statusText += `• ประเภท: ${result.extractedData.latestTermType}`;
      if (hasRInLatestTerm) {
        statusText += ' ✅\n';
      } else {
        statusText += ' ❌ (ต้องเป็น R)\n';
      }
    }
    
    if (result.extractedData.latestTermScholarship) {
      statusText += `• ทุน: ${result.extractedData.latestTermScholarship}\n`;
    }
    
    if (result.extractedData.latestTermAmount) {
      statusText += `• จำนวนเงิน: ${result.extractedData.latestTermAmount}\n`;
    }
    
    if (result.extractedData.latestTermNote) {
      statusText += `• หมายเหตุ: ${result.extractedData.latestTermNote}\n`;
    }
  }

  if (result.extractedData?.totalTerms) {
    statusText += `\n📊 จำนวนภาคการศึกษาทั้งหมด: ${result.extractedData.totalTerms} ภาค\n`;
  }

  statusText += `\n🎯 ความเชื่อมั่น: ${result.confidence}%`;
  statusText += `\nคุณภาพรูป: ${result.imageQuality}`;

  if (result.qualityIssues && result.qualityIssues.length > 0) {
    statusText += '\n\n⚠️ ปัญหาที่พบ:\n• ' + result.qualityIssues.join('\n• ');
  }

  if (result.recommendations && result.recommendations.length > 0) {
    statusText += '\n\n💡 คำแนะนำ:\n• ' + result.recommendations.join('\n• ');
  }

  message = statusText;
  
  const isValid = result.overall_status === 'valid' && 
                 result.isTuitionExpenseDoc && 
                 hasRInLatestTerm &&
                 !profileMismatch;

  const buttons = [
    {
      text: 'ลองใหม่',
      style: 'cancel',
      onPress: onReject,
    },
  ];

  if ((!hasRInLatestTerm && result.isTuitionExpenseDoc) || profileMismatch) {
    buttons.push({
      text: 'ตกลง',
      style: 'default',
      onPress: onReject,
    });
  } else if (isValid || result.overall_status === 'needs_review') {
    buttons.push({
      text: result.overall_status === 'valid' ? 'ใช้ไฟล์นี้' : 'ใช้ไฟล์นี้ (ต้องตรวจสอบ)',
      onPress: () => {
        onAccept(result);
      },
    });
  }

  Alert.alert(title, message, buttons);
};

// Get document type display name
export const getTuitionExpenseTypeName = () => {
  return 'ภาระค่าใช้จ่ายทุนการศึกษา';
};

// Check TuitionExpense AI backend status
export const checkTuitionExpenseAIStatus = async () => {
  try {
    console.log('🤖 Checking TuitionExpense AI backend status...');

    if (USE_BACKEND_SERVER) {
      const serverAvailable = await checkBackendServer();
      if (serverAvailable) {
        try {
          console.log('🔬 Testing TuitionExpense AI connection through server...');
          const response = await fetch(`${AI_BACKEND_URL}/ai/test`);
          if (response.ok) {
            const data = await response.json();
            console.log('✓ TuitionExpense AI backend server is available and working');
            return { 
              available: true, 
              method: 'server',
              requirements: TUITION_EXPENSE_REQUIREMENTS,
              profileCheckEnabled: true,
              config: {
                backendUrl: AI_BACKEND_URL,
                useBackend: USE_BACKEND_SERVER
              }
            };
          }
        } catch (error) {
          console.log('❌ Server TuitionExpense AI test failed:', error.message);
        }
      }
    }

    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      console.error('❌ Gemini API key not configured for TuitionExpense');
      return { 
        available: false, 
        error: 'API key not configured',
        requirements: TUITION_EXPENSE_REQUIREMENTS 
      };
    }

    const initialized = initializeGemini();
    if (!initialized) {
      console.error('❌ Failed to initialize Gemini AI for TuitionExpense');
      return { 
        available: false, 
        error: 'Failed to initialize AI',
        requirements: TUITION_EXPENSE_REQUIREMENTS 
      };
    }

    try {
      console.log('🔬 Testing client-side TuitionExpense AI connection...');
      const testResult = await model.generateContent("Test connection - respond with OK");
      const testResponse = await testResult.response;
      const text = testResponse.text();
      
      console.log('✓ Client-side TuitionExpense AI is available');
      return { 
        available: true, 
        method: 'client',
        requirements: TUITION_EXPENSE_REQUIREMENTS,
        profileCheckEnabled: true,
        config: {
          apiKey: '***configured***',
          model: 'gemini-2.0-flash'
        }
      };
    } catch (testError) {
      console.error('❌ Client-side TuitionExpense AI test failed:', testError.message);
      return { 
        available: false, 
        error: testError.message,
        requirements: TUITION_EXPENSE_REQUIREMENTS 
      };
    }
    
  } catch (error) {
    console.error('❌ TuitionExpense AI backend check failed:', error);
    return { 
      available: false, 
      error: error.message,
      requirements: TUITION_EXPENSE_REQUIREMENTS 
    };
  }
};

// Format data for database storage
export const formatTuitionExpenseDataForDB = (result, documentType, fileName) => {
  return {
    documentType: documentType,
    fileName: fileName,
    
    basicInfo: {
      isValid: result.isValid || false,
      confidence: result.confidence || 0,
      overall_status: result.overall_status || 'unknown',
      documentType: result.documentType || 'unknown',
      imageQuality: result.imageQuality || 'unclear'
    },
    
    studentInfo: {
      studentId: result.studentInfo?.studentId || null,
      studentName: result.studentInfo?.studentName || null
    },
    
    extractedData: {
      latestTerm: result.extractedData?.latestTerm || null,
      latestTermType: result.extractedData?.latestTermType || null,
      latestTermScholarship: result.extractedData?.latestTermScholarship || null,
      latestTermAmount: result.extractedData?.latestTermAmount || null,
      latestTermNote: result.extractedData?.latestTermNote || null,
      totalTerms: result.extractedData?.totalTerms || 0,
      allTerms: result.extractedData?.allTerms || []
    },
    
    validation: {
      hasRInLatestTerm: result.validation?.hasRInLatestTerm || false,
      latestTermTypeValid: result.validation?.latestTermTypeValid || false,
      latestTermDetails: result.validation?.latestTermDetails || ''
    },

    profileComparison: result.profileComparison ? {
      matchStatus: result.profileComparison.matchStatus,
      matches: result.profileComparison.matches,
      mismatches: result.profileComparison.mismatches,
      warnings: result.profileComparison.warnings,
      comparisonDetails: result.profileComparison.comparisonDetails
    } : null,
    
    requirements: {
      hasRequiredColumns: result.hasRequiredColumns || false,
      mustHaveRInLatestTerm: true
    },
    
    issues: {
      qualityIssues: result.qualityIssues || [],
      recommendations: result.recommendations || []
    },
    
    metadata: {
      validatedAt: new Date().toISOString(),
      aiModel: 'gemini-2.0-flash',
      profileCheckEnabled: !!result.profileComparison,
      validationRequirements: TUITION_EXPENSE_REQUIREMENTS
    }
  };
};

// Check tuition expense requirements
export const checkTuitionExpenseRequirements = (result) => {
  if (!result) return { passed: false, issues: ['ไม่มีข้อมูลผลการตรวจสอบ'] };

  const issues = [];
  
  if (!result.isTuitionExpenseDoc) issues.push('ไม่ใช่เอกสารภาระค่าใช้จ่ายทุน');
  if (!result.hasRequiredColumns) issues.push('คอลัมน์ไม่ครบถ้วน');
  if (!result.validation?.hasRInLatestTerm) issues.push('ภาคการศึกษาล่าสุดไม่มีตัว R');
  if (result.imageQuality === 'poor' || result.imageQuality === 'blurry') issues.push('คุณภาพรูปไม่ชัดเจน');
  
  // Check profile comparison
  if (result.profileComparison?.matchStatus === 'mismatch') {
    issues.push('ข้อมูลนักศึกษาไม่ตรงกับโปรไฟล์');
  }

  return {
    passed: issues.length === 0,
    issues: issues,
    requirements: {
      isTuitionExpenseDoc: result.isTuitionExpenseDoc,
      hasRequiredColumns: result.hasRequiredColumns,
      hasRInLatestTerm: result.validation?.hasRInLatestTerm,
      goodImageQuality: result.imageQuality !== 'poor' && result.imageQuality !== 'blurry',
      profileMatches: result.profileComparison?.matchStatus !== 'mismatch'
    }
  };
};

// Generate summary
export const generateTuitionExpenseSummary = (result) => {
  if (!result) return 'ไม่มีข้อมูลผลการตรวจสอบ';

  const requirements = checkTuitionExpenseRequirements(result);
  
  let summary = `📋 สรุปผลการตรวจสอบภาระค่าใช้จ่ายทุนการศึกษา\n\n`;
  summary += `สถานะ: ${result.overall_status === 'valid' ? '✅ ผ่าน' : result.overall_status === 'needs_review' ? '⚠️ ต้องตรวจสอบ' : '❌ ไม่ผ่าน'}\n`;
  summary += `ความเชื่อมั่น: ${result.confidence}%\n\n`;

  summary += `✅ ข้อกำหนด:\n`;
  summary += `${requirements.requirements.isTuitionExpenseDoc ? '✅' : '❌'} เป็นเอกสารภาระค่าใช้จ่ายทุน\n`;
  summary += `${requirements.requirements.hasRequiredColumns ? '✅' : '❌'} มีคอลัมน์ครบถ้วน\n`;
  summary += `${requirements.requirements.hasRInLatestTerm ? '✅' : '❌'} ภาคล่าสุดมีประเภท R\n`;
  summary += `${requirements.requirements.goodImageQuality ? '✅' : '❌'} คุณภาพรูปชัดเจน\n`;
  summary += `${requirements.requirements.profileMatches ? '✅' : '❌'} ข้อมูลตรงกับโปรไฟล์\n`;

  if (result.studentInfo) {
    summary += `\n👤 ข้อมูลนักศึกษา:\n`;
    if (result.studentInfo.studentId) summary += `• รหัสนักศึกษา: ${result.studentInfo.studentId}\n`;
    if (result.studentInfo.studentName) summary += `• ชื่อ-นามสกุล: ${result.studentInfo.studentName}\n`;
  }

  if (result.profileComparison) {
    summary += `\n🔍 เปรียบเทียบกับโปรไฟล์:\n`;
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

  if (result.extractedData) {
    summary += `\n📋 ภาคการศึกษาล่าสุด:\n`;
    if (result.extractedData.latestTerm) summary += `• ภาค: ${result.extractedData.latestTerm}\n`;
    if (result.extractedData.latestTermType) summary += `• ประเภท: ${result.extractedData.latestTermType}\n`;
    if (result.extractedData.latestTermScholarship) summary += `• ทุน: ${result.extractedData.latestTermScholarship}\n`;
    if (result.extractedData.latestTermAmount) summary += `• จำนวนเงิน: ${result.extractedData.latestTermAmount}\n`;
    if (result.extractedData.totalTerms) summary += `\n📊 จำนวนภาคทั้งหมด: ${result.extractedData.totalTerms} ภาค\n`;
  }

  if (!requirements.passed) {
    summary += `\n⚠️ ปัญหาที่พบ:\n`;
    requirements.issues.forEach(issue => {
      summary += `• ${issue}\n`;
    });
  }

  return summary;
};

// Validate multiple tuition expense documents
export const validateMultipleTuitionExpenses = async (files, includeProfileCheck = true) => {
  const results = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await validateTuitionExpense(
        file.uri, 
        file.mimeType,
        includeProfileCheck
      );
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        validation: result,
        success: true,
        hasRInLatestTerm: result.validation?.hasRInLatestTerm,
        profileMatch: result.profileComparison?.matchStatus !== 'mismatch'
      });
    } catch (error) {
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        error: error.message,
        success: false,
        hasRInLatestTerm: false,
        profileMatch: false
      });
    }
  }
  
  return results;
};

export const TUITION_VALIDATION_CONFIG = {
  TUITION_EXPENSE_REQUIREMENTS,
  REQUIRED_ELEMENTS: {
    requiredColumns: true,
    hasRInLatestTerm: true,
    profileMatch: true
  }
};