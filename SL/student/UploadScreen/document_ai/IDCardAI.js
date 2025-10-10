// documents_ai/IDCardAI.js - Enhanced with profile data verification
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../../database/firebase";

// Configuration
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const AI_BACKEND_URL = process.env.EXPO_PUBLIC_AI_BACKEND_URL || 'http://192.168.1.103:3001';
const USE_BACKEND_SERVER = process.env.EXPO_PUBLIC_USE_AI_BACKEND === 'true';

// Certification validation requirements
const CERTIFICATION_REQUIREMENTS = {
  requiredText: ['สำเนาถูกต้อง', 'สำเนา ถูกต้อง', 'certified true copy'],
  requiredSignature: true,
  allowedCertifiers: [
    'เจ้าหน้าที่', 'ครู', 'อาจารย์', 'ผู้อำนวยการ', 'หัวหน้างาน',
    'นายก', 'กำนัน', 'ผู้ใหญ่บ้าน', 'เจ้าพนักงาน', 'นักเรียน', 'นักศึกษา'
  ]
};

let genAI = null;
let model = null;

console.log('🔧 IDCardAI Configuration:');
console.log('- Backend URL:', AI_BACKEND_URL);
console.log('- Use Backend:', USE_BACKEND_SERVER);
console.log('- API Key configured:', !!GEMINI_API_KEY);

// Initialize Gemini AI
const initializeGemini = () => {
  if (!genAI && GEMINI_API_KEY) {
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
      console.log('✓ Gemini AI initialized successfully for IDCard');
      return true;
    } catch (error) {
      console.error('Failed to initialize Gemini AI for IDCard:', error);
      return false;
    }
  }
  return !!genAI;
};

// *** แก้ไข: ปรับปรุงการดึงข้อมูลโปรไฟล์ให้ครบถ้วนตามที่ต้องการ ***
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
        address_current: userData.address_current || null,
        address_perm: userData.address_perm || null,
      },
      father: {
        name: userData.father_info?.name || null,
        citizen_id: userData.father_info?.citizen_id || null,
        birth_date: userData.father_info?.birth_date || null,
        occupation: userData.father_info?.occupation || null,
        address_perm: userData.father_info?.address_perm || null,
        address_current: userData.father_info?.address_current || null,
      },
      mother: {
        name: userData.mother_info?.name || null,
        citizen_id: userData.mother_info?.citizen_id || null,
        birth_date: userData.mother_info?.birth_date || null,
        occupation: userData.mother_info?.occupation || null,
        address_perm: userData.mother_info?.address_perm || null,
        address_current: userData.mother_info?.address_current || null,
      },
      guardian: {
        name: userData.guardian_info?.name || null,
        citizen_id: userData.guardian_info?.citizen_id || null,
        birth_date: userData.guardian_info?.birth_date || null,
        occupation: userData.guardian_info?.occupation || null,
        address_perm: userData.guardian_info?.address_perm || null,
        address_current: userData.guardian_info?.address_current || null,
      }
    };
  } catch (error) {
    console.error('❌ Error fetching user profile data:', error);
    return null;
  }
};

// *** แก้ไข: แก้ไขฟังก์ชันจัดรูปแบบวันที่ให้ใช้งานได้กับทุก platform และรองรับวันที่ภาษาไทย ***
const formatDateForDisplay = (date) => {
  if (!date) return null;
  
  // *** เพิ่ม Log เพื่อตรวจสอบค่าที่ได้รับมา ***
  console.log('formatDateForDisplay received input:', date);
  
  let d = date;
  if (date.toDate) {
    d = date.toDate();
  } else if (typeof date === 'string') {
    // พยายามแปลงวันที่ในรูปแบบต่างๆ ให้เป็น Date object
    const parts = date.split(/[\/\-\s]/); // แยกด้วย /, - หรือ ช่องว่าง
    if (parts.length === 3) {
      let day = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-11
      let year = parseInt(parts[2], 10);

      // ตรวจสอบว่าเป็นปี พ.ศ. หรือไม่ (ถ้ามากกว่า 2500)
      if (year > 2500) {
        year -= 543; // แปลงเป็นปี ค.ศ.
      }
      
      // ตรวจสอบว่าค่าที่ได้เป็นตัวเลขที่ถูกต้องหรือไม่
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        d = new Date(year, month, day);
      } else {
        d = new Date(date); // ใช้วิธีเดิมถ้าแปลงไม่ได้
      }
    } else {
      d = new Date(date); // ใช้วิธีเดิมถ้าแยกส่วนไม่ได้
    }
  } else if (typeof date === 'number') {
    d = new Date(date * 1000); // Convert timestamp to milliseconds
  }
  
  if (isNaN(d.getTime())) {
    console.warn('Invalid date after parsing:', date);
    return null;
  }
  
  // แยกวัน เดือน ปี
  const day = d.getDate();
  const month = d.getMonth() + 1; // getMonth() returns 0-11
  const year = d.getFullYear() + 543; // Convert to Buddhist year
  
  // แปลงเดือนเป็นภาษาไทย
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const thaiMonth = thaiMonths[month - 1];
  
  return `${day} ${thaiMonth} ${year}`;
};

// *** เพิ่มใหม่: ฟังก์ชันสำหรับจัดรูปแบบที่อยู่ให้เป็นข้อความ ***
const formatAddressForDisplay = (address) => {
  if (!address) return 'ไม่ระบุ';
  
  // ถ้าที่อยู่เป็น String อยู่แล้ว ให้ส่งค่ากลับไปเลย
  if (typeof address === 'string') {
    return address;
  }
  
  // ถ้าที่อยู่เป็น Object ให้ทำการจัดรูปแบบ
  if (typeof address === 'object') {
    // สมมติว่าโครงสร้างของที่อยู่คือ { houseNumber, street, subdistrict, district, province, postalCode }
    const parts = [
      address.houseNumber || address.house_no,
      address.street || address.road,
      address.subDistrict || address.sub_district,
      address.district,
      address.province,
      address.postalCode || address.zipcode
    ];
    
    // กรองเอาเฉพาะส่วนที่ไม่ใช่ค่าว่าง แล้วต่อกันด้วยช่องว่าง
    return parts.filter(part => part && part.trim() !== '').join(' ');
  }
  
  // ถ้าไม่ใช่ทั้ง String และ Object ให้คืนค่าว่าง
  return 'ไม่ระบุ';
};

// *** แก้ไข: ปรับปรุงฟังก์ชันเปรียบเทียบข้อมูลตามประเภทบัตร ***
const compareWithProfile = (extractedData, profileData, idType) => {
  if (!profileData || !extractedData) {
    return {
      matchStatus: 'no_profile_data',
      matches: {},
      mismatches: [],
      warnings: ['ไม่มีข้อมูลโปรไฟล์สำหรับเปรียบเทียบ']
    };
  }

  const relevantProfile = profileData[idType];
  if (!relevantProfile) {
    return {
      matchStatus: 'no_profile_data',
      matches: {},
      mismatches: [],
      warnings: [`ไม่พบข้อมูลโปรไฟล์สำหรับ ${idType}`]
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

  // *** แก้ไข: ปรับปรุงฟังก์ชันเปรียบเทียบวันที่ให้รองรับปี พ.ศ. ***
  const compareDates = (date1, date2) => {
    if (!date1 || !date2) return false;
    
    let d1 = date1;
    let d2 = date2;
    
    if (date1.toDate) d1 = date1.toDate();
    if (date2.toDate) d2 = date2.toDate();
    
    if (typeof d1 === 'string') {
      const parts1 = d1.split(/[\/\-\s]/);
      if (parts1.length === 3) {
        let year1 = parseInt(parts1[2], 10);
        if (year1 > 2500) year1 -= 543;
        d1 = new Date(year1, parseInt(parts1[1], 10) - 1, parseInt(parts1[0], 10));
      } else {
        d1 = new Date(d1);
      }
    }
    if (typeof d2 === 'string') {
      const parts2 = d2.split(/[\/\-\s]/);
      if (parts2.length === 3) {
        let year2 = parseInt(parts2[2], 10);
        if (year2 > 2500) year2 -= 543;
        d2 = new Date(year2, parseInt(parts2[1], 10) - 1, parseInt(parts2[0], 10));
      } else {
        d2 = new Date(d2);
      }
    }
    
    if (typeof d1 === 'number') d1 = new Date(d1 * 1000);
    if (typeof d2 === 'number') d2 = new Date(d2 * 1000);
    
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;

    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  // *** แก้ไขจุดสำคัญ: แก้ไขฟังก์ชันเปรียบเทียบที่อยู่ให้ฉลาดขึ้น ***
  // เพิ่มฟังก์ชันช่วยสำหรับแยกส่วนประกอบหลักของที่อยู่
  const extractKeyElements = (addr) => {
    if (!addr) return { district: '', amphoe: '', province: '', postalCode: '' };
    const textAddr = formatAddressForDisplay(addr);
    const districtMatch = textAddr.match(/(?:ตำบล|แขวง)\s*([^\s,]+)/);
    const amphoeMatch = textAddr.match(/(?:อำเภอ|เขต)\s*([^\s,]+)/);
    const provinceMatch = textAddr.match(/จังหวัด\s*([^\s,]+)/);
    const postalCodeMatch = textAddr.match(/(\d{5})/);
    
    return {
      district: districtMatch ? districtMatch[1] : '',
      amphoe: amphoeMatch ? amphoeMatch[1] : '',
      province: provinceMatch ? provinceMatch[1] : '',
      postalCode: postalCodeMatch ? postalCodeMatch[1] : ''
    };
  };

  // แก้ไขฟังก์ชันเปรียบเทียบที่อยู่
  const compareAddresses = (addr1, addr2) => {
    if (!addr1 || !addr2) return false;
    
    const normalizeAddr = (addr) => {
      // ใช้ฟังก์ชันใหม่ในการแปลงที่อยู่เป็นข้อความก่อน normalize
      const textAddr = formatAddressForDisplay(addr);
      return normalizeText(textAddr)
        .replace(/จ\./g, 'จังหวัด')
        .replace(/อ\./g, 'อำเภอ')
        .replace(/ต\./g, 'ตำบล');
    };
    
    const norm1 = normalizeAddr(addr1);
    const norm2 = normalizeAddr(addr2);
    
    console.log('🔍 Comparing Addresses:');
    console.log('- Normalized Address 1 (from document):', norm1);
    console.log('- Normalized Address 2 (from profile):', norm2);
    
    // ระดับที่ 1: ตรวจสอบแบบข้อความธรรมดาก่อน (เร็วและแม่นยำสำหรับกรณีที่ตรงกันเป๊ะๆ)
    if (norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1)) {
      console.log('- Is Match: Direct string match');
      return true;
    }
    
    // ระดับที่ 2: ถ้าไม่ผ่าน ให้แยกส่วนประกอบหลักมาเปรียบเทียบ
    console.log('- Direct string match failed, trying key element comparison...');
    const key1 = extractKeyElements(norm1);
    const key2 = extractKeyElements(norm2);
    
    console.log('- Key elements from document:', key1);
    console.log('- Key elements from profile:', key2);

    const districtMatch = !key1.district || !key2.district || key1.district === key2.district;
    const amphoeMatch = !key1.amphoe || !key2.amphoe || key1.amphoe === key2.amphoe;
    const provinceMatch = !key1.province || !key2.province || key1.province === key2.province;
    const postalCodeMatch = !key1.postalCode || !key2.postalCode || key1.postalCode === key2.postalCode;
    
    // ถ้าส่วนประกอบหลักตรงกัน ให้ถือว่าที่อยู่ตรงกัน
    if (districtMatch && amphoeMatch && provinceMatch && postalCodeMatch) {
      console.log('- Is Match: Key elements match');
      return true;
    }
    
    console.log('- Is Match: No match');
    return false;
  };

  // *** แก้ไข: ปรับปรุงการเปรียบเทียบชื่อโดยลบคำนำหน้า ***
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

  // Compare name
  if (extractedData.name && relevantProfile.name) {
    const extractedName = normalizeText(removeTitle(extractedData.name));
    const profileName = normalizeText(removeTitle(relevantProfile.name));

    if (extractedName === profileName) {
      matches.name = true;
    } else if (extractedName.includes(profileName) || profileName.includes(extractedName)) {
      matches.name = true;
      warnings.push('ชื่อในเอกสารและโปรไฟล์ใกล้เคียงกัน แต่ไม่ตรงทุกตัวอักษร');
    } else {
      matches.name = false;
      mismatches.push({
        field: 'ชื่อ-นามสกุล',
        extracted: extractedData.name,
        profile: relevantProfile.name
      });
    }
  }

  // Compare citizen ID
  if (extractedData.idNumber && relevantProfile.citizen_id) {
    const extractedId = extractedData.idNumber.replace(/\D/g, '');
    const profileId = relevantProfile.citizen_id.replace(/\D/g, '');
    
    if (extractedId === profileId) {
      matches.citizen_id = true;
    } else {
      matches.citizen_id = false;
      mismatches.push({
        field: 'เลขบัตรประชาชน',
        extracted: extractedData.idNumber,
        profile: relevantProfile.citizen_id
      });
    }
  }

  // Compare birth date
  if (extractedData.dateOfBirth && relevantProfile.birth_date) {
    if (compareDates(extractedData.dateOfBirth, relevantProfile.birth_date)) {
      matches.birth_date = true;
    } else {
      matches.birth_date = false;
      mismatches.push({
        field: 'วันเกิด',
        extracted: formatDateForDisplay(extractedData.dateOfBirth),
        profile: formatDateForDisplay(relevantProfile.birth_date)
      });
    }
  }

  // *** แก้ไข: เพิ่มการเปรียบเทียบที่อยู่แบบใหม่ ***
  if (extractedData.address && (relevantProfile.address_perm || relevantProfile.address_current)) {
    // กำหนดประเภทบัตรที่จะใช้ที่อยู่ปัจจุบันในการเปรียบเทียบ
    const isCurrentAddressForm = ['father', 'mother', 'guardian'].includes(idType);

    if (isCurrentAddressForm) {
      // สำหรับบิดา, มารดา, ผู้ปกครอง: เปรียบเทียบเฉพาะกับที่อยู่ปัจจุบัน
      const matchesCurrent = compareAddresses(extractedData.address, relevantProfile.address_current);

      if (matchesCurrent) {
        matches.address = true;
      } else {
        matches.address = false;
        const profileAddrCurrentText = formatAddressForDisplay(relevantProfile.address_current) || 'ไม่มีข้อมูล';
        mismatches.push({
          field: 'ที่อยู่',
          extracted: formatAddressForDisplay(extractedData.address),
          profile: `ที่อยู่ปัจจุบัน: "${profileAddrCurrentText}"`
        });
      }
    } else {
      // สำหรับนักเรียน: เปรียบเทียบกับทั้งที่อยู่ทะเบียนบ้านและปัจจุบัน
      const matchesPerm = compareAddresses(extractedData.address, relevantProfile.address_perm);
      const matchesCurrent = compareAddresses(extractedData.address, relevantProfile.address_current);

      if (matchesPerm || matchesCurrent) {
        matches.address = true;
        if (!matchesPerm && matchesCurrent) {
          warnings.push('ที่อยู่ตรงกับที่อยู่ปัจจุบันในโปรไฟล์');
        } else if (matchesPerm && !matchesCurrent) {
          warnings.push('ที่อยู่ตรงกับที่อยู่ตามทะเบียนบ้านในโปรไฟล์');
        }
      } else {
        matches.address = false;
        const profileAddrPermText = formatAddressForDisplay(relevantProfile.address_perm) || 'ไม่มีข้อมูล';
        const profileAddrCurrentText = formatAddressForDisplay(relevantProfile.address_current) || 'ไม่มีข้อมูล';
        
        mismatches.push({
          field: 'ที่อยู่',
          extracted: formatAddressForDisplay(extractedData.address),
          profile: `ที่อยู่ทะเบียนบ้าน: "${profileAddrPermText}" | ที่อยู่ปัจจุบัน: "${profileAddrCurrentText}"`
        });
      }
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

// Validate copy certification
const validateCopyCertification = (result) => {
  if (!result) return result;

  const hasCertificationText = CERTIFICATION_REQUIREMENTS.requiredText.some(text => {
    const foundInText = result.extractedData?.certificationText?.toLowerCase().includes(text.toLowerCase());
    const foundInRaw = result.rawResponse?.toLowerCase().includes(text.toLowerCase());
    return foundInText || foundInRaw;
  });

  const certificationStatus = {
    hasCertificationText,
    hasSignature: result.certificationInfo?.hasSignature || false,
    signerName: result.certificationInfo?.signerName || '',
    signerPosition: result.certificationInfo?.signerPosition || '',
    certificationDate: result.certificationInfo?.certificationDate || '',
    isValidCertification: false
  };

  certificationStatus.isValidCertification = hasCertificationText && certificationStatus.hasSignature;

  const updatedQualityIssues = [...(result.qualityIssues || [])];
  const updatedRecommendations = [...(result.recommendations || [])];

  if (!hasCertificationText) {
    updatedQualityIssues.push('ไม่พบคำว่า "สำเนาถูกต้อง"');
    updatedRecommendations.push('กรุณาให้ผู้มีอำนาจรับรองสำเนาถูกต้องและเซ็นลายมือชื่อ');
  }

  if (!certificationStatus.hasSignature) {
    updatedQualityIssues.push('ไม่พบลายเซ็นรับรองสำเนาถูกต้อง');
    updatedRecommendations.push('กรุณาให้ผู้มีอำนาจลงลายมือชื่อรับรองสำเนาถูกต้อง');
  }

  let updatedOverallStatus = result.overall_status;
  if (!certificationStatus.isValidCertification && result.isIDCard) {
    if (updatedOverallStatus === 'valid') {
      updatedOverallStatus = 'needs_review';
    }
  }

  return {
    ...result,
    certificationInfo: certificationStatus,
    qualityIssues: updatedQualityIssues,
    recommendations: updatedRecommendations,
    overall_status: updatedOverallStatus
  };
};

// Check backend server availability
const checkBackendServer = async () => {
  try {
    console.log('🔍 Checking backend server at:', AI_BACKEND_URL);
    const response = await fetch(`${AI_BACKEND_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✓ AI Backend Server is available:', data.status);
      return true;
    }
    return false;
  } catch (error) {
    console.log('❌ AI Backend Server not available:', error.message);
    return false;
  }
};

// Server-side validation
const validateIDCardViaServer = async (fileUri, idType, mimeType, profileData) => {
  try {
    console.log(`📤 Uploading to server for ${idType} ID card validation...`);
    
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) throw new Error('File does not exist');

    const formData = new FormData();
    const file = {
      uri: fileUri,
      type: mimeType || 'image/jpeg',
      name: `idcard_${idType}_${Date.now()}.${mimeType ? mimeType.split('/')[1] : 'jpg'}`,
    };
    
    formData.append('document', file);
    if (profileData) {
      formData.append('profileData', JSON.stringify(profileData));
    }

    const response = await fetch(`${AI_BACKEND_URL}/ai/validate/idcard/${idType}`, {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Server IDCard validation completed');
    
    return validateCopyCertification(result.validation);
  } catch (error) {
    console.error('❌ Server IDCard validation error:', error);
    throw error;
  }
};

// Prepare file for Gemini
const prepareFileForGemini = async (fileUri, mimeType) => {
  try {
    console.log('📁 Preparing IDCard file for Gemini AI...');
    
    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    let actualMimeType = mimeType || 'image/jpeg';
    if (!mimeType) {
      const ext = fileUri.split('.').pop()?.toLowerCase();
      if (ext === 'png') actualMimeType = 'image/png';
      else if (ext === 'pdf') actualMimeType = 'application/pdf';
    }

    console.log('✅ IDCard file prepared for Gemini');
    return {
      inlineData: {
        data: base64Data,
        mimeType: actualMimeType,
      },
    };
  } catch (error) {
    console.error('❌ Error preparing IDCard file:', error);
    throw new Error(`ไม่สามารถเตรียมไฟล์สำหรับการวิเคราะห์ได้: ${error.message}`);
  }
};

// *** แก้ไข: ปรับปรุงการตรวจสอบฝั่งไคลเอนต์ตามประเภทบัตร ***
const validateIDCardClientSide = async (fileUri, idType, mimeType, profileData) => {
  console.log(`🤖 Starting client-side ${idType} ID card validation...`);
  
  if (!model) {
    const initialized = initializeGemini();
    if (!initialized) throw new Error('ระบบ AI ไม่พร้อมใช้งาน');
  }

  const filePart = await prepareFileForGemini(fileUri, mimeType);

  const idTypeText = {
    'student': 'นักเรียน/นักศึกษา',
    'father': 'บิดา',
    'mother': 'มารดา',
    'guardian': 'ผู้ปกครอง'
  };

  let profileInfo = '';
  if (profileData && profileData[idType]) {
    const profile = profileData[idType];
    profileInfo = `

**ข้อมูลโปรไฟล์สำหรับเปรียบเทียบ:**
- ชื่อ-นามสกุล: ${profile.name || 'ไม่ระบุ'}
- เลขบัตรประชาชน: ${profile.citizen_id || 'ไม่ระบุ'}
- วันเกิด: ${formatDateForDisplay(profile.birth_date) || 'ไม่ระบุ'}
- ที่อยู่: ${formatAddressForDisplay(profile.address_perm) || 'ไม่ระบุ'}

กรุณาเปรียบเทียบข้อมูลที่สกัดได้กับข้อมูลโปรไฟล์ด้วย`;
  }

  // *** แก้ไข: ปรับปรุง Prompt ให้เหมาะสมกับการตรวจสอบแต่ละประเภท และให้ความสำคัญกับการแปลงวันที่ ***
  const prompt = `
ตรวจสอบเอกสารนี้ว่าเป็นสำเนาบัตรประชาชนของ${idTypeText[idType] || 'บุคคล'} หรือไม่
 ${profileInfo}

**ข้อกำหนดสำคัญ:**
1. ต้องเป็นสำเนาบัตรประชาชนไทย
2. ต้องมีคำว่า "สำเนาถูกต้อง" หรือ "certified true copy"
3. ต้องมีลายเซ็นและชื่อผู้รับรองสำเนาถูกต้อง
4. เลขประจำตัวประชาชนต้องชัดเจนและถูกต้อง
5. บัตรต้องยังไม่หมดอายุ

**คำสั่งพิเศษสำหรับการสกัดข้อมูล:**
- สกัดเฉพาะข้อมูลของ${idTypeText[idType]}เท่านั้น
- ห้ามสกัดข้อมูลของบุคคลอื่นที่ปรากฏในเอกสาร
- **วันเกิดให้สกัดเป็นตัวเลขในรูปแบบ dd/mm/yyyy เท่านั้น ถ้าเจอปี พ.ศ. (เช่น 2565) ให้แปลงเป็นปี ค.ศ. (2022) ก่อนส่งค่า**
- **ตัวอย่าง: ถ้าเจอ "15 ม.ค. 2565" ให้ส่งค่าเป็น "15/01/2022"**

**สำคัญสำหรับการเปรียบเทียบ:**
- ชื่อ-นามสกุลของ${idTypeText[idType]}
- เลขบัตรประชาชนของ${idTypeText[idType]}
- วันเกิดของ${idTypeText[idType]}
- ที่อยู่ของ${idTypeText[idType]}

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
    "idNumber": "เลขบัตรประชาชนของ${idTypeText[idType]}",
    "name": "ชื่อ-นามสกุลของ${idTypeText[idType]}",
    "nameEn": "ชื่อภาษาอังกฤษ",
    "dateOfBirth": "วันเกิด (dd/mm/yyyy)",
    "issueDate": "วันออกบัตร",
    "expiryDate": "วันหมดอายุ",
    "address": "ที่อยู่ของ${idTypeText[idType]}",
    "religion": "ศาสนา",
    "certificationText": "ข้อความรับรองสำเนา"
  },
  "certificationInfo": {
    "hasCertificationText": true/false,
    "hasSignature": true/false,
    "signerName": "ชื่อผู้รับรอง",
    "signerPosition": "ตำแหน่ง",
    "certificationDate": "วันที่รับรอง"
  },
  "qualityIssues": ["ปัญหาที่พบ"],
  "recommendations": ["คำแนะนำ"],
  "overall_status": "valid/invalid/needs_review"
}
`;

  try {
    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();

    console.log('🤖 IDCard AI Response received');

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
      parsed = analyzeIDCardTextResponse(responseText, idType);
    }

    // *** แก้ไข: แปลงวันที่ให้อยู่ในรูปแบบที่อ่านง่าย ***
    if (parsed.extractedData?.dateOfBirth) {
      // ถ้าเป็น timestamp ให้แปลงเป็นวันที่
      if (typeof parsed.extractedData.dateOfBirth === 'number') {
        parsed.extractedData.dateOfBirth = formatDateForDisplay(parsed.extractedData.dateOfBirth);
      }
    }

    // Add profile comparison
    if (profileData) {
      const comparison = compareWithProfile(parsed.extractedData, profileData, idType);
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

    const validatedResult = validateCopyCertification(parsed);
    console.log('✅ Client-side IDCard validation completed');
    return validatedResult;
  } catch (error) {
    console.error('❌ Client-side validation failed:', error);
    throw error;
  }
};

// Fallback text analysis
const analyzeIDCardTextResponse = (text, idType) => {
  const lowerText = text.toLowerCase();
  
  const isIDCard = lowerText.includes('บัตรประชาชน') || 
                   lowerText.includes('id card');
  
  const hasValidID = lowerText.includes('เลขประจำตัว') || 
                     lowerText.includes('13 หลัก');

  const hasCertificationText = CERTIFICATION_REQUIREMENTS.requiredText.some(text => 
    lowerText.includes(text.toLowerCase())
  );

  const hasSignature = lowerText.includes('ลายเซ็น') || 
                       lowerText.includes('signature');

  return {
    isIDCard,
    idType,
    confidence: isIDCard ? 75 : 25,
    cardType: isIDCard ? 'บัตรประชาชน' : 'ไม่ทราบ',
    isValidIDNumber: hasValidID,
    isExpired: null,
    imageQuality: 'unclear',
    extractedData: {
      certificationText: hasCertificationText ? 'พบข้อความรับรอง' : ''
    },
    certificationInfo: {
      hasCertificationText,
      hasSignature,
      signerName: '',
      signerPosition: '',
      certificationDate: ''
    },
    qualityIssues: !isIDCard ? ['ไม่พบบัตรประชาชน'] : [],
    recommendations: !isIDCard ? ['กรุณาอัปโหลดสำเนาบัตรประชาชน'] : [],
    overall_status: isIDCard && hasValidID ? 'valid' : 'needs_review',
    rawResponse: text
  };
};

// *** แก้ไข: ปรับปรุงฟังก์ชันหลักให้รองรับการตรวจสอบตามประเภทเอกสาร ***
export const validateIDCard = async (fileUri, idType = 'student', mimeType = null, includeProfileCheck = true) => {
  try {
    console.log(`🚀 Starting ${idType} ID card validation...`);

    const validIDTypes = ['student', 'father', 'mother', 'guardian'];
    if (!validIDTypes.includes(idType)) {
      throw new Error(`ประเภท ID ไม่ถูกต้อง: ${idType}`);
    }

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

    // Try server-side validation first
    if (USE_BACKEND_SERVER) {
      try {
        const serverAvailable = await checkBackendServer();
        if (serverAvailable) {
          console.log('✅ Using server-side validation');
          return await validateIDCardViaServer(fileUri, idType, mimeType, profileData);
        }
      } catch (serverError) {
        console.log('⚠️ Server validation failed, using client-side');
      }
    }

    // Fall back to client-side
    console.log('✅ Using client-side validation');
    return await validateIDCardClientSide(fileUri, idType, mimeType, profileData);

  } catch (error) {
    console.error('❌ IDCard validation error:', error);
    throw new Error(`การตรวจสอบล้มเหลว: ${error.message}`);
  }
};

// *** แก้ไข: ปรับปรุงการแสดงผลการตรวจสอบ ***
export const showIDCardValidationAlert = (result, onAccept, onReject) => {
  let title, message;

  const certificationMissing = result.certificationInfo && !result.certificationInfo.isValidCertification;
  const profileMismatch = result.profileComparison?.matchStatus === 'mismatch';
  
  if (certificationMissing) {
    title = '❌ ไม่พบการรับรองสำเนาถูกต้อง';
  } else if (profileMismatch) {
    title = '⚠️ ข้อมูลไม่ตรงกับโปรไฟล์';
  } else if (result.overall_status === 'valid') {
    title = '✅ ตรวจสอบบัตรประชาชนสำเร็จ';
  } else {
    title = '⚠️ ตรวจพบปัญหา';
  }
  
  let statusText = '';
  
  // Basic checks
  statusText += result.isIDCard ? '✅ ตรวจพบบัตรประชาชน\n' : '❌ ไม่พบบัตรประชาชน\n';
  statusText += result.isValidIDNumber ? '✅ เลขประจำตัวถูกต้อง\n' : '❌ เลขประจำตัวไม่ชัดเจน\n';
  
  if (result.isExpired === true) statusText += '⚠️ บัตรหมดอายุแล้ว\n';
  else if (result.isExpired === false) statusText += '✅ บัตรยังไม่หมดอายุ\n';

  // Certification status
  if (result.certificationInfo) {
    statusText += '\n📋 การรับรองสำเนา:\n';
    statusText += result.certificationInfo.hasCertificationText ? 
      '✅ พบคำว่า "สำเนาถูกต้อง"\n' : '❌ ไม่พบคำรับรอง\n';
    statusText += result.certificationInfo.hasSignature ? 
      '✅ พบลายเซ็น\n' : '❌ ไม่พบลายเซ็น\n';
  }

  // *** แก้ไข: ปรับปรุงการแสดงผลการเปรียบเทียบข้อมูล ***
  if (result.profileComparison) {
    const comp = result.profileComparison;
    statusText += '\n👤 เปรียบเทียบกับโปรไฟล์:\n';
    
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

  // *** แก้ไข: เพิ่มการแสดงข้อมูลที่สกัดได้ ***
  if (result.extractedData) {
    statusText += '\n\n📋 ข้อมูลที่สกัดได้:\n';
    if (result.extractedData.name) statusText += `• ชื่อ: ${result.extractedData.name}\n`;
    if (result.extractedData.idNumber) statusText += `• เลขบัตร: ${result.extractedData.idNumber}\n`;
    if (result.extractedData.dateOfBirth) statusText += `• วันเกิด: ${result.extractedData.dateOfBirth}\n`;
    if (result.extractedData.address) statusText += `• ที่อยู่: ${formatAddressForDisplay(result.extractedData.address)}\n`; // *** ใช้ฟังก์ชันใหม่ ***
  }

  statusText += `\n🎯 ความเชื่อมั่น: ${result.confidence}%`;
  statusText += `\nคุณภาพรูป: ${result.imageQuality}`;

  if (result.qualityIssues?.length > 0) {
    statusText += '\n\n⚠️ ปัญหา:\n• ' + result.qualityIssues.join('\n• ');
  }

  if (result.recommendations?.length > 0) {
    statusText += '\n\n💡 คำแนะนำ:\n• ' + result.recommendations.join('\n• ');
  }

  message = statusText;
  
  const isValid = result.overall_status === 'valid' && 
                 result.isIDCard && 
                 !certificationMissing &&
                 !profileMismatch;

  const buttons = [
    {
      text: 'ลองใหม่',
      style: 'cancel',
      onPress: onReject,
    },
  ];

  if (certificationMissing || profileMismatch) {
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

// Parse ID Card result
export const parseIDCardResult = (result) => {
  if (!result) return null;

  return {
    isValid: result.overall_status === 'valid' && 
             result.isIDCard && 
             (result.certificationInfo?.isValidCertification !== false) &&
             (result.profileComparison?.matchStatus !== 'mismatch'),
    confidence: result.confidence || 0,
    status: result.overall_status || 'unknown',
    idType: result.idType || 'unknown',
    cardType: result.cardType || 'ไม่ทราบ',
    isValidIDNumber: result.isValidIDNumber || false,
    isExpired: result.isExpired,
    imageQuality: result.imageQuality || 'unclear',
    extractedData: result.extractedData || {},
    certificationInfo: result.certificationInfo || {},
    profileComparison: result.profileComparison || null,
    securityFeatures: result.securityFeatures || {},
    qualityIssues: result.qualityIssues || [],
    recommendations: result.recommendations || [],
    rawResult: result
  };
};

// Get ID card type display name
export const getIDCardTypeName = (idType) => {
  const idTypeNames = {
    'student': 'นักเรียน/นักศึกษา',
    'father': 'บิดา',
    'mother': 'มารดา',
    'guardian': 'ผู้ปกครอง'
  };
  return idTypeNames[idType] || 'ไม่ทราบ';
};

// Format data for database
export const formatIDCardDataForDB = (result, documentType, fileName) => {
  return {
    documentType: documentType,
    fileName: fileName,
    
    basicInfo: {
      isValid: result.isValid || false,
      confidence: result.confidence || 0,
      overall_status: result.overall_status || 'unknown',
      cardType: result.cardType || 'unknown',
      idType: result.idType || 'unknown',
      imageQuality: result.imageQuality || 'unclear'
    },
    
    extractedData: {
      idNumber: result.extractedData?.idNumber || null,
      name: result.extractedData?.name || null,
      nameEn: result.extractedData?.nameEn || null,
      dateOfBirth: result.extractedData?.dateOfBirth || null,
      issueDate: result.extractedData?.issueDate || null,
      expiryDate: result.extractedData?.expiryDate || null,
      address: result.extractedData?.address || null,
      religion: result.extractedData?.religion || null
    },
    
    certificationInfo: {
      isValidCertification: result.certificationInfo?.isValidCertification || false,
      hasCertificationText: result.certificationInfo?.hasCertificationText || false,
      hasSignature: result.certificationInfo?.hasSignature || false,
      signerName: result.certificationInfo?.signerName || null,
      signerPosition: result.certificationInfo?.signerPosition || null,
      certificationDate: result.certificationInfo?.certificationDate || null
    },

    profileComparison: result.profileComparison ? {
      matchStatus: result.profileComparison.matchStatus,
      matches: result.profileComparison.matches,
      mismatches: result.profileComparison.mismatches,
      warnings: result.profileComparison.warnings,
      comparisonDetails: result.profileComparison.comparisonDetails
    } : null,
    
    securityFeatures: {
      hasWatermark: result.securityFeatures?.hasWatermark || false,
      hasHologram: result.securityFeatures?.hasHologram || false,
      hasMRZCode: result.securityFeatures?.hasMRZCode || false
    },
    
    expiryStatus: {
      isExpired: result.isExpired,
      isValidIDNumber: result.isValidIDNumber || false
    },
    
    issues: {
      qualityIssues: result.qualityIssues || [],
      recommendations: result.recommendations || []
    },
    
    metadata: {
      validatedAt: new Date().toISOString(),
      aiModel: 'gemini-2.0-flash',
      profileCheckEnabled: !!result.profileComparison,
      certificationRequirements: CERTIFICATION_REQUIREMENTS
    }
  };
};

// Check certification requirements
export const checkIDCardCertificationRequirements = (result) => {
  if (!result) return { passed: false, issues: ['ไม่มีข้อมูลผลการตรวจสอบ'] };

  const issues = [];
  
  if (!result.isIDCard) issues.push('ไม่ใช่บัตรประชาชน');
  if (!result.isValidIDNumber) issues.push('เลขประจำตัวไม่ชัดเจน');
  if (result.isExpired === true) issues.push('บัตรหมดอายุแล้ว');
  if (!result.certificationInfo?.hasCertificationText) issues.push('ไม่พบคำว่า "สำเนาถูกต้อง"');
  if (!result.certificationInfo?.hasSignature) issues.push('ไม่พบลายเซ็น');
  if (result.imageQuality === 'poor' || result.imageQuality === 'blurry') issues.push('คุณภาพรูปไม่ชัดเจน');
  
  // Check profile comparison
  if (result.profileComparison?.matchStatus === 'mismatch') {
    issues.push('ข้อมูลไม่ตรงกับโปรไฟล์');
  }

  return {
    passed: issues.length === 0,
    issues: issues,
    requirements: {
      isIDCard: result.isIDCard,
      hasValidIDNumber: result.isValidIDNumber,
      notExpired: result.isExpired !== true,
      hasCertificationText: result.certificationInfo?.hasCertificationText,
      hasSignature: result.certificationInfo?.hasSignature,
      goodImageQuality: result.imageQuality !== 'poor' && result.imageQuality !== 'blurry',
      profileMatches: result.profileComparison?.matchStatus !== 'mismatch'
    }
  };
};

// Generate summary
export const generateIDCardSummary = (result) => {
  if (!result) return 'ไม่มีข้อมูลผลการตรวจสอบ';

  const requirements = checkIDCardCertificationRequirements(result);
  
  let summary = `📋 สรุปผลการตรวจสอบบัตรประชาชน\n\n`;
  summary += `สถานะ: ${result.overall_status === 'valid' ? '✅ ผ่าน' : result.overall_status === 'needs_review' ? '⚠️ ต้องตรวจสอบ' : '❌ ไม่ผ่าน'}\n`;
  summary += `ประเภท: ${getIDCardTypeName(result.idType)}\n`;
  summary += `ความเชื่อมั่น: ${result.confidence}%\n\n`;

  summary += `✅ ข้อกำหนด:\n`;
  summary += `${requirements.requirements.isIDCard ? '✅' : '❌'} เป็นบัตรประชาชนไทย\n`;
  summary += `${requirements.requirements.hasValidIDNumber ? '✅' : '❌'} เลขประจำตัวถูกต้อง\n`;
  summary += `${requirements.requirements.notExpired ? '✅' : '❌'} บัตรยังไม่หมดอายุ\n`;
  summary += `${requirements.requirements.hasCertificationText ? '✅' : '❌'} มีคำว่า "สำเนาถูกต้อง"\n`;
  summary += `${requirements.requirements.hasSignature ? '✅' : '❌'} มีลายเซ็นรับรอง\n`;
  summary += `${requirements.requirements.goodImageQuality ? '✅' : '❌'} คุณภาพรูปชัดเจน\n`;
  summary += `${requirements.requirements.profileMatches ? '✅' : '❌'} ข้อมูลตรงกับโปรไฟล์\n`;

  if (result.extractedData && Object.keys(result.extractedData).length > 0) {
    summary += `\n📋 ข้อมูลในบัตร:\n`;
    if (result.extractedData.idNumber) summary += `• เลขประจำตัว: ${result.extractedData.idNumber}\n`;
    if (result.extractedData.name) summary += `• ชื่อ-นามสกุล: ${result.extractedData.name}\n`;
    if (result.extractedData.dateOfBirth) summary += `• วันเกิด: ${result.extractedData.dateOfBirth}\n`;
    if (result.extractedData.expiryDate) summary += `• วันหมดอายุ: ${result.extractedData.expiryDate}\n`;
  }

  if (result.certificationInfo) {
    summary += `\n📝 การรับรองสำเนา:\n`;
    if (result.certificationInfo.signerName) summary += `• ผู้รับรอง: ${result.certificationInfo.signerName}\n`;
    if (result.certificationInfo.signerPosition) summary += `• ตำแหน่ง: ${result.certificationInfo.signerPosition}\n`;
    if (result.certificationInfo.certificationDate) summary += `• วันที่รับรอง: ${result.certificationInfo.certificationDate}\n`;
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

// Check AI backend status
export const checkIDCardAIStatus = async () => {
  try {
    console.log('🤖 Checking IDCard AI backend status...');

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
              certificationRequirements: CERTIFICATION_REQUIREMENTS,
              profileCheckEnabled: true,
              config: {
                backendUrl: AI_BACKEND_URL,
                useBackend: USE_BACKEND_SERVER
              }
            };
          }
        } catch (error) {
          console.log('❌ Server test failed:', error.message);
        }
      }
    }

    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      return { 
        available: false, 
        error: 'API key not configured',
        certificationRequirements: CERTIFICATION_REQUIREMENTS 
      };
    }

    const initialized = initializeGemini();
    if (!initialized) {
      return { 
        available: false, 
        error: 'Failed to initialize AI',
        certificationRequirements: CERTIFICATION_REQUIREMENTS 
      };
    }

    try {
      const testResult = await model.generateContent("Test connection - respond with OK");
      const testResponse = await testResult.response;
      testResponse.text();
      
      return { 
        available: true, 
        method: 'client',
        certificationRequirements: CERTIFICATION_REQUIREMENTS,
        profileCheckEnabled: true,
        config: {
          apiKey: '***configured***',
          model: 'gemini-2.0-flash'
        }
      };
    } catch (testError) {
      return { 
        available: false, 
        error: testError.message,
        certificationRequirements: CERTIFICATION_REQUIREMENTS 
      };
    }
    
  } catch (error) {
    return { 
      available: false, 
      error: error.message,
      certificationRequirements: CERTIFICATION_REQUIREMENTS 
    };
  }
};

// Validate multiple ID cards
export const validateMultipleIDCards = async (files, includeProfileCheck = true) => {
  const results = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await validateIDCard(
        file.uri, 
        file.idType || 'student', 
        file.mimeType,
        includeProfileCheck
      );
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        idType: file.idType || 'student',
        validation: result,
        success: true,
        certificationValid: result.certificationInfo?.isValidCertification !== false,
        profileMatch: result.profileComparison?.matchStatus !== 'mismatch'
      });
    } catch (error) {
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        idType: file.idType || 'student',
        error: error.message,
        success: false,
        certificationValid: false,
        profileMatch: false
      });
    }
  }
  
  return results;
};

export const CERTIFICATION_VALIDATION_CONFIG = {
  CERTIFICATION_REQUIREMENTS,
  REQUIRED_ELEMENTS: {
    certificationText: true,
    signature: true,
    validIDNumber: true,
    notExpired: true,
    profileMatch: true
  }
};