// documents_ai/ConsentFormAI.js - Enhanced with profile data verification
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../../database/firebase";

// Configuration
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const AI_BACKEND_URL = process.env.EXPO_PUBLIC_AI_BACKEND_URL || 'http://192.168.1.103:3001';
const USE_BACKEND_SERVER = process.env.EXPO_PUBLIC_USE_AI_BACKEND === 'true';

let genAI = null;
let model = null;

console.log('🔧 ConsentFormAI Configuration:');
console.log('- Backend URL:', AI_BACKEND_URL);
console.log('- Use Backend:', USE_BACKEND_SERVER);
console.log('- API Key configured:', !!GEMINI_API_KEY);

// Initialize Gemini AI
const initializeGemini = () => {
  if (!genAI && GEMINI_API_KEY) {
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      console.log('✓ Gemini AI initialized successfully for ConsentForm');
      return true;
    } catch (error) {
      console.error('Failed to initialize Gemini AI for ConsentForm:', error);
      return false;
    }
  }
  return !!genAI;
};

// *** แก้ไข: ปรับปรุงการดึงข้อมูลโปรไฟล์ให้ครบถ้วนตามที่ต้องการ ***
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
        citizen_id: userData.citizen_id || null,
        birth_date: userData.birth_date || null,
        phone_num: userData.phone_num || null,
        email: userData.email || null,
        address_current: userData.address_current || null,
        address_perm: userData.address_perm || null,
      },
      father: {
        name: userData.father_info?.name || null,
        citizen_id: userData.father_info?.citizen_id || null,
        birth_date: userData.father_info?.birth_date || null,
        phone_number: userData.father_info?.phone_number || null,
        email: userData.father_info?.email || null,
        address_perm: userData.father_info?.address_perm || null,
        address_current: userData.father_info?.address_current || null,
      },
      mother: {
        name: userData.mother_info?.name || null,
        citizen_id: userData.mother_info?.citizen_id || null,
        birth_date: userData.mother_info?.birth_date || null,
        phone_number: userData.mother_info?.phone_number || null,
        email: userData.mother_info?.email || null,
        address_perm: userData.mother_info?.address_perm || null,
        address_current: userData.mother_info?.address_current || null,
      },
      guardian: {
        name: userData.guardian_info?.name || null,
        citizen_id: userData.guardian_info?.citizen_id || null,
        birth_date: userData.guardian_info?.birth_date || null,
        phone_number: userData.guardian_info?.phone_number || null,
        email: userData.guardian_info?.email || null,
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

// *** แก้ไข: ปรับปรุงฟังก์ชันเปรียบเทียบข้อมูลตามประเภทฟอร์ม ***
const compareWithProfile = (extractedData, profileData, formType) => {
  if (!profileData || !extractedData) {
    return {
      matchStatus: 'no_profile_data',
      matches: {},
      mismatches: [],
      warnings: ['ไม่มีข้อมูลโปรไฟล์สำหรับเปรียบเทียบ']
    };
  }

  const relevantProfile = profileData[formType];
  if (!relevantProfile) {
    return {
      matchStatus: 'no_profile_data',
      matches: {},
      mismatches: [],
      warnings: [`ไม่พบข้อมูลโปรไฟล์สำหรับ ${formType}`]
    };
  }

  const matches = {};
  const mismatches = [];
  const warnings = [];

  // Helper function to normalize text
  const normalizeText = (text) => {
    if (!text) return '';
    return text.toString().trim().toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\u0E00-\u0E7Fa-z0-9\s]/g, '');
  };

  // *** แก้ไข: ปรับปรุงฟังก์ชัน normalizeAddress ให้แข็งแกร่งและเพิ่ม Log ***
  const normalizeAddress = (address) => {
    if (!address) return '';
    // ใช้ฟังก์ชันใหม่ในการแปลงที่อยู่เป็นข้อความก่อน normalize
    const textAddr = formatAddressForDisplay(address);
    
    // *** เพิ่ม Log เพื่อตรวจสอบค่าดิบ ***
    console.log('🔍 Normalizing Address (Input):', textAddr);
    
    // แทนที่คำย่อที่พบบ่อยก่อนการทำงานหลัก
    let normalized = textAddr
      .replace(/ถนน\.?/g, 'ถนน') // จัดการ "ถนน." และ "ถนน"
      .replace(/ถ\./g, 'ถนน')   // จัดการ "ถ."
      .replace(/อำเภอ\.?/g, 'อำเภอ') // จัดการ "อำเภอ." และ "อำเภอ"
      .replace(/อ\./g, 'อำเภอ')      // จัดการ "อ."
      .replace(/ตำบล\.?/g, 'ตำบล') // จัดการ "ตำบล." และ "ตำบล"
      .replace(/ต\./g, 'ตำบล')      // จัดการ "ต."
      .replace(/แขวง\.?/g, 'แขวง') // จัดการ "แขวง." และ "แขวง"
      .replace(/เขต\.?/g, 'เขต')     // จัดการ "เขต." และ "เขต"
      .replace(/จังหวัด\.?/g, 'จังหวัด') // จัดการ "จังหวัด." และ "จังหวัด"
      .replace(/จ\./g, 'จังหวัด')     // จัดการ "จ."
      .replace(/รหัสไปรษณีย์\.?/g, 'รหัสไปรษณีย์') // จัดการ "รหัสไปรษณีย์."
      .replace(/ร\.?ป\./g, 'รหัสไปรษณีย์'); // จัดการ "ร.ป."
    
    // ทำการ normalize แบบเดิม
    normalized = normalizeText(normalized);
    
    console.log('🔍 Normalizing Address (Output):', normalized);
    
    return normalized;
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
    
    const norm1 = normalizeAddress(addr1);
    const norm2 = normalizeAddress(addr2);
    
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
  if (extractedData.idCard && relevantProfile.citizen_id) {
    const extractedId = extractedData.idCard.replace(/\D/g, '');
    const profileId = relevantProfile.citizen_id.replace(/\D/g, '');
    
    if (extractedId === profileId) {
      matches.citizen_id = true;
    } else {
      matches.citizen_id = false;
      mismatches.push({
        field: 'เลขบัตรประชาชน',
        extracted: extractedData.idCard,
        profile: relevantProfile.citizen_id
      });
    }
  }

  // Compare birth date
  if (extractedData.birthDate && relevantProfile.birth_date) {
    if (compareDates(extractedData.birthDate, relevantProfile.birth_date)) {
      matches.birth_date = true;
    } else {
      matches.birth_date = false;
      mismatches.push({
        field: 'วันเกิด',
        extracted: formatDateForDisplay(extractedData.birthDate), // *** ใช้ฟังก์ชันใหม่ ***
        profile: formatDateForDisplay(relevantProfile.birth_date) // *** ใช้ฟังก์ชันใหม่ ***
      });
    }
  }

  // Compare phone number
  if (extractedData.phone && (relevantProfile.phone_num || relevantProfile.phone_number)) {
    const extractedPhone = extractedData.phone.replace(/\D/g, '');
    const profilePhone = (relevantProfile.phone_num || relevantProfile.phone_number).replace(/\D/g, '');
    
    if (extractedPhone === profilePhone) {
      matches.phone = true;
    } else {
      matches.phone = false;
      mismatches.push({
        field: 'เบอร์โทรศัพท์',
        extracted: extractedData.phone,
        profile: relevantProfile.phone_num || relevantProfile.phone_number
      });
    }
  }

  // Compare email
  if (extractedData.email && relevantProfile.email) {
    const extractedEmail = normalizeText(extractedData.email);
    const profileEmail = normalizeText(relevantProfile.email);
    
    if (extractedEmail === profileEmail) {
      matches.email = true;
    } else {
      matches.email = false;
      mismatches.push({
        field: 'อีเมล',
        extracted: extractedData.email,
        profile: relevantProfile.email
      });
    }
  }

  // *** แก้ไขจุดสำคัญ: แยกตรรกะการเปรียบเทียบที่อยู่สำหรับฟอร์มนักเรียนและฟอร์มอื่นๆ ***
  if (extractedData.address && (relevantProfile.address_perm || relevantProfile.address_current)) {
    // กำหนดฟอร์มที่จะใช้ที่อยู่ปัจจุบันในการเปรียบเทียบ
    const isCurrentAddressForm = ['father', 'mother', 'guardian'].includes(formType);

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
      // สำหรับนักเรียน: เปรียบเทียบกับทั้งที่อยู่ทะเบียนบ้านและปัจจุบัน (เหมือนเดิม)
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

// Check backend server
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
const validateConsentFormViaServer = async (fileUri, formType, mimeType, profileData) => {
  try {
    console.log(`📤 Uploading to server for ${formType} consent validation...`);
    
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) throw new Error('File does not exist');

    const formData = new FormData();
    const file = {
      uri: fileUri,
      type: mimeType || 'image/jpeg',
      name: `consent_${formType}_${Date.now()}.${mimeType ? mimeType.split('/')[1] : 'jpg'}`,
    };
    
    formData.append('document', file);
    if (profileData) {
      formData.append('profileData', JSON.stringify(profileData));
    }

    const response = await fetch(`${AI_BACKEND_URL}/ai/validate/consent/${formType}`, {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Server ConsentForm validation completed');
    return result.validation;
  } catch (error) {
    console.error('❌ Server ConsentForm validation error:', error);
    throw error;
  }
};

// Prepare file for Gemini
const prepareFileForGemini = async (fileUri, mimeType) => {
  try {
    console.log('📁 Preparing ConsentForm file for Gemini AI...');
    
    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    let actualMimeType = mimeType || 'image/jpeg';
    if (!mimeType) {
      const ext = fileUri.split('.').pop()?.toLowerCase();
      if (ext === 'png') actualMimeType = 'image/png';
      else if (ext === 'pdf') actualMimeType = 'application/pdf';
    }

    console.log('✅ ConsentForm file prepared for Gemini');
    return {
      inlineData: {
        data: base64Data,
        mimeType: actualMimeType,
      },
    };
  } catch (error) {
    console.error('❌ Error preparing ConsentForm file:', error);
    throw new Error(`ไม่สามารถเตรียมไฟล์สำหรับการวิเคราะห์ได้: ${error.message}`);
  }
};

// *** แก้ไข: ปรับปรุงการตรวจสอบฝั่งไคลเอนต์ตามประเภทฟอร์ม ***
const validateConsentFormClientSide = async (fileUri, formType, mimeType, profileData) => {
  console.log(`🤖 Starting client-side ${formType} consent validation...`);
  
  if (!model) {
    const initialized = initializeGemini();
    if (!initialized) throw new Error('ระบบ AI ไม่พร้อมใช้งาน');
  }

  const filePart = await prepareFileForGemini(fileUri, mimeType);

  const formTypeText = {
    'student': 'นักเรียน',
    'father': 'บิดา',
    'mother': 'มารดา',
    'guardian': 'ผู้ปกครอง'
  };

  let profileInfo = '';
  if (profileData && profileData[formType]) {
    const profile = profileData[formType];
    profileInfo = `

**ข้อมูลโปรไฟล์สำหรับเปรียบเทียบ:**
- ชื่อ-นามสกุล: ${profile.name || 'ไม่ระบุ'}
- เลขบัตรประชาชน: ${profile.citizen_id || 'ไม่ระบุ'}
- วันเกิด: ${formatDateForDisplay(profile.birth_date) || 'ไม่ระบุ'}
- เบอร์โทรศัพท์: ${profile.phone_num || profile.phone_number || 'ไม่ระบุ'}
- อีเมล: ${profile.email || 'ไม่ระบุ'}
- ที่อยู่: ${formatAddressForDisplay(profile.address_perm) || 'ไม่ระบุ'}

กรุณาเปรียบเทียบข้อมูลที่สกัดได้กับข้อมูลโปรไฟล์ด้วย`;
  }

  // *** แก้ไข: ปรับปรุง Prompt ให้เน้นการสกัดที่อยู่ให้ครบถ้วนยิ่งขึ้น ***
  const prompt = `
ตรวจสอบเอกสารนี้ว่าเป็นหนังสือให้ความยินยอมในการเปิดเผยข้อมูลของ${formTypeText[formType] || 'นักเรียน'} หรือไม่
 ${profileInfo}

**คำสั่งพิเศษสำหรับการสกัดข้อมูล:**
- สกัดเฉพาะข้อมูลของ${formTypeText[formType]}เท่านั้น
- ห้ามสกัดข้อมูลของบุคคลอื่นที่ปรากฏในเอกสาร
- **วันเกิดให้สกัดเป็นตัวเลขในรูปแบบ dd/mm/yyyy เท่านั้น ถ้าเจอปี พ.ศ. (เช่น 2565) ให้แปลงเป็นปี ค.ศ. (2022) ก่อนส่งค่า**
- **ตัวอย่าง: ถ้าเจอ "15 ม.ค. 2565" ให้ส่งค่าเป็น "15/01/2022"**
- **ที่อยู่ให้สกัดข้อมูลให้ครบถ้วนที่สุด โดยรวมข้อมูลจากทุกบรรทัดที่เกี่ยวข้องกับที่อยู่ (หมู่, ซอย, ถนน, ตำบล/แขวง, อำเภอ/เขต, จังหวัด, รหัสไปรษณีย์) และนำมาขึ้นรูปแบบในฟิลด์ "full" ให้เป็นข้อความที่อ่านง่าย**
- **ตัวอย่างที่อยู่ที่สมบูรณ์: "123 หมู่ 4 ซอยสุขุมวิท ถนนพหลโยธิน ตำบลคลองเนื้อ เขตคลองสามวา กรุงเทพมหานคร 10110"**

กรุณาตรวจสอบและตอบในรูปแบบ JSON ดังนี้:
{
  "isConsentForm": true/false,
  "formType": "${formType}",
  "confidence": 0-100,
  "hasConsent": true/false,
  "consentType": "เปิดเผยข้อมูล/อื่นๆ",
  "hasSignature": true/false,
  "signatureQuality": "genuine/suspicious/unclear/none",
  "extractedData": {
    "name": "ชื่อ-นามสกุล (ต้องครบทั้งชื่อและนามสกุล)",
    "idCard": "เลขบัตรประชาชน 13 หลัก",
    "idCardValid": true/false,
    "birthDate": "วันเกิด (dd/mm/yyyy)",
    "age": "อายุ",
    "address": {
      "houseNumber": "บ้านเลขที่",
      "moo": "หมู่",
      "subDistrict": "แขวง/ตำบล",
      "district": "เขต/อำเภอ",
      "province": "จังหวัด",
      "postalCode": "รหัสไปรษณีย์",
      "full": "ที่อยู่เต็ม (ต้องสมบูรณ์และอ่านง่าย)"
    },
    "phone": "เบอร์โทรศัพท์",
    "email": "อีเมล",
    "consentorRole": "บทบาทผู้ยินยอม",
    "roleChecked": true/false,
    "writtenDate": "วันที่เขียนหนังสือ",
    "writtenLocation": "สถานที่เขียน",
    "signatureName": "ชื่อใต้ลายเซ็น",
    "signatureMatchesName": true/false
  },
  "dataCompleteness": {
    "hasFullName": true/false,
    "hasValidIdCard": true/false,
    "hasBirthDateOrAge": true/false,
    "hasCompleteAddress": true/false,
    "hasContactInfo": true/false,
    "hasRoleSelection": true/false,
    "hasWrittenDate": true/false,
    "hasWrittenLocation": true/false,
    "hasSignature": true/false,
    "hasSignatureName": true/false,
    "completenessScore": 0-100
  },
  "consentDetails": ["รายละเอียดความยินยอม"],
  "recommendations": ["คำแนะนำ"],
  "overall_status": "valid/invalid/needs_review"
}

**ความครบถ้วนของข้อมูล:**
1. ชื่อ–นามสกุล - ต้องกรอกครบทั้งชื่อและนามสกุล
2. เลขบัตรประชาชน - ต้องเป็น 13 หลัก
3. วัน/เดือน/ปีเกิด หรืออายุ
4. ที่อยู่สมบูรณ์ (ต้องมีข้อมูลครบถ้วน)
5. เบอร์โทรศัพท์และอีเมล
6. การทำเครื่องหมาย (☑) บทบาท
7. วันที่เขียนหนังสือ
8. สถานที่เขียน
9. ลายเซ็นชัดเจน
10. ชื่อกำกับใต้ลายเซ็น

**เกณฑ์การประเมิน:**
- overall_status = "valid" เมื่อ completenessScore >= 90 และมีลายเซ็น
- overall_status = "needs_review" เมื่อ completenessScore 70-89
- overall_status = "invalid" เมื่อ completenessScore < 70
`;

  try {
    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();

    console.log('🤖 ConsentForm AI Response received');

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
      parsed = analyzeConsentTextResponse(responseText, formType);
    }

    // *** แก้ไข: แปลงวันที่ให้อยู่ในรูปแบบที่อ่านง่าย ***
    if (parsed.extractedData?.birthDate) {
      // ถ้าเป็น timestamp ให้แปลงเป็นวันที่
      if (typeof parsed.extractedData.birthDate === 'number') {
        parsed.extractedData.birthDate = formatDateForDisplay(parsed.extractedData.birthDate);
      }
    }

    // Add profile comparison
    if (profileData) {
      const comparison = compareWithProfile(parsed.extractedData, profileData, formType);
      parsed.profileComparison = comparison;

      // Add comparison results to recommendations
      if (comparison.mismatches.length > 0) {
        parsed.recommendations = parsed.recommendations || [];
        comparison.mismatches.forEach(mismatch => {
          parsed.recommendations.push(
            `${mismatch.field}ไม่ตรงกับโปรไฟล์: เอกสาร="${mismatch.extracted}" โปรไฟล์="${mismatch.profile}"`
          );
        });
        
        if (parsed.overall_status === 'valid') {
          parsed.overall_status = 'needs_review';
        }
      }

      if (comparison.warnings.length > 0) {
        parsed.recommendations = parsed.recommendations || [];
        parsed.recommendations.push(...comparison.warnings);
      }
    }

    console.log('✅ Client-side ConsentForm validation completed');
    return parsed;
  } catch (error) {
    console.error('❌ Client-side validation failed:', error);
    throw error;
  }
};

// Fallback text analysis
const analyzeConsentTextResponse = (text, formType) => {
  const lowerText = text.toLowerCase();
  
  const isConsentForm = lowerText.includes('ความยินยอม') || 
                       lowerText.includes('เปิดเผยข้อมูล') ||
                       lowerText.includes('consent');
  
  const hasSignature = lowerText.includes('ลายเซ็น') || 
                      lowerText.includes('signature');

  return {
    isConsentForm,
    formType,
    confidence: isConsentForm ? 75 : 25,
    hasConsent: isConsentForm,
    consentType: isConsentForm ? 'เปิดเผยข้อมูล' : '',
    hasSignature,
    signatureQuality: hasSignature ? 'unclear' : 'none',
    extractedData: {},
    dataCompleteness: {
      completenessScore: isConsentForm ? 50 : 0
    },
    consentDetails: isConsentForm ? ['ความยินยอมในการเปิดเผยข้อมูล'] : [],
    recommendations: !isConsentForm ? ['กรุณาตรวจสอบว่าเป็นหนังสือยินยอม'] : [],
    overall_status: isConsentForm && hasSignature ? 'valid' : 'needs_review',
    rawResponse: text
  };
};

// *** แก้ไข: ปรับปรุงฟังก์ชันหลักให้รองรับการตรวจสอบตามประเภทเอกสาร ***
export const validateConsentForm = async (fileUri, formType = 'student', mimeType = null, includeProfileCheck = true) => {
  try {
    console.log(`🚀 Starting ${formType} consent form validation...`);

    const validFormTypes = ['student', 'father', 'mother', 'guardian'];
    if (!validFormTypes.includes(formType)) {
      throw new Error(`ประเภทฟอร์มไม่ถูกต้อง: ${formType}`);
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
          return await validateConsentFormViaServer(fileUri, formType, mimeType, profileData);
        }
      } catch (serverError) {
        console.log('⚠️ Server validation failed, using client-side');
      }
    }

    // Fall back to client-side
    console.log('✅ Using client-side validation');
    return await validateConsentFormClientSide(fileUri, formType, mimeType, profileData);

  } catch (error) {
    console.error('❌ ConsentForm validation error:', error);
    throw new Error(`การตรวจสอบล้มเหลว: ${error.message}`);
  }
};

// Parse result
export const parseConsentFormResult = (result) => {
  if (!result) return null;

  return {
    isValid: result.overall_status === 'valid' && 
             result.isConsentForm &&
             (result.profileComparison?.matchStatus !== 'mismatch'),
    confidence: result.confidence || 0,
    status: result.overall_status || 'unknown',
    formType: result.formType || 'unknown',
    hasConsent: result.hasConsent || false,
    consentType: result.consentType || '',
    hasSignature: result.hasSignature || false,
    signatureQuality: result.signatureQuality || 'none',
    extractedData: result.extractedData || {},
    dataCompleteness: result.dataCompleteness || {},
    profileComparison: result.profileComparison || null,
    consentDetails: result.consentDetails || [],
    recommendations: result.recommendations || [],
    rawResult: result
  };
};

// *** แก้ไข: ปรับปรุงการแสดงผลการตรวจสอบ ***
export const showConsentFormValidationAlert = (result, onAccept, onReject) => {
  let title, message;

  const profileMismatch = result.profileComparison?.matchStatus === 'mismatch';
  const incompleteness = result.dataCompleteness?.completenessScore < 90;
  
  if (profileMismatch) {
    title = '⚠️ ข้อมูลไม่ตรงกับโปรไฟล์';
  } else if (incompleteness) {
    title = '⚠️ ข้อมูลไม่ครบถ้วน';
  } else if (result.overall_status === 'valid') {
    title = '✅ ตรวจสอบหนังสือยินยอมสำเร็จ';
  } else {
    title = '⚠️ ตรวจพบปัญหา';
  }
  
  let statusText = '';
  statusText += result.isConsentForm ? '✅ ตรวจพบหนังสือยินยอม\n' : '❌ ไม่พบหนังสือยินยอม\n';

  if (result.hasSignature) {
    statusText += `✅ ตรวจพบลายเซ็น (${result.signatureQuality})\n`;
  } else {
    statusText += '❌ ไม่พบลายเซ็น\n';
  }

  // Data completeness
  if (result.dataCompleteness) {
    statusText += `\n📊 ความครบถ้วน: ${result.dataCompleteness.completenessScore}%\n`;
    if (result.dataCompleteness.completenessScore >= 90) {
      statusText += '✅ ข้อมูลครบถ้วน\n';
    } else if (result.dataCompleteness.completenessScore >= 70) {
      statusText += '⚠️ ข้อมูลครบบางส่วน\n';
    } else {
      statusText += '❌ ข้อมูลไม่ครบถ้วน\n';
    }
  }

  statusText += `\n🎯 ความเชื่อมั่น: ${result.confidence}%`;
  statusText += `\nประเภท: ${result.formType}`;

  // Extracted data summary
  if (result.extractedData && Object.keys(result.extractedData).length > 0) {
    statusText += '\n\n📋 ข้อมูลที่พบ:';
    if (result.extractedData.name) statusText += `\n• ชื่อ: ${result.extractedData.name}`;
    if (result.extractedData.idCard) statusText += `\n• เลขบัตร: ${result.extractedData.idCard}`;
    if (result.extractedData.birthDate) statusText += `\n• วันเกิด: ${result.extractedData.birthDate}`;
    if (result.extractedData.phone) statusText += `\n• โทร: ${result.extractedData.phone}`;
    if (result.extractedData.email) statusText += `\n• อีเมล: ${result.extractedData.email}`;
    if (result.extractedData.address) statusText += `\n• ที่อยู่: ${formatAddressForDisplay(result.extractedData.address)}`; // *** ใช้ฟังก์ชันใหม่ ***
  }

  // Profile comparison
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

  if (result.consentDetails?.length > 0) {
    statusText += '\n\n📄 รายละเอียดความยินยอม:\n• ' + result.consentDetails.join('\n• ');
  }

  if (result.recommendations?.length > 0) {
    statusText += '\n\n💡 คำแนะนำ:\n• ' + result.recommendations.join('\n• ');
  }

  message = statusText;
  
  const isValid = result.overall_status === 'valid' && 
                 result.isConsentForm &&
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

// Get consent form type display name
export const getConsentFormTypeName = (formType) => {
  const formTypeNames = {
    'student': 'นักเรียน',
    'father': 'บิดา',
    'mother': 'มารดา',
    'guardian': 'ผู้ปกครอง'
  };
  return formTypeNames[formType] || 'ไม่ทราบ';
};

// Format data for database
export const formatConsentFormDataForDB = (result, documentType, fileName) => {
  return {
    documentType: documentType,
    fileName: fileName,
    
    basicInfo: {
      isValid: result.isValid || false,
      confidence: result.confidence || 0,
      overall_status: result.overall_status || 'unknown',
      formType: result.formType || 'unknown',
      hasConsent: result.hasConsent || false,
      consentType: result.consentType || '',
    },
    
    signatureInfo: {
      hasSignature: result.hasSignature || false,
      signatureQuality: result.signatureQuality || 'none',
    },
    
    extractedData: {
      name: result.extractedData?.name || null,
      idCard: result.extractedData?.idCard || null,
      idCardValid: result.extractedData?.idCardValid || false,
      birthDate: result.extractedData?.birthDate || null,
      age: result.extractedData?.age || null,
      address: result.extractedData?.address || null,
      phone: result.extractedData?.phone || null,
      email: result.extractedData?.email || null,
      consentorRole: result.extractedData?.consentorRole || null,
      roleChecked: result.extractedData?.roleChecked || false,
      writtenDate: result.extractedData?.writtenDate || null,
      writtenLocation: result.extractedData?.writtenLocation || null,
      signatureName: result.extractedData?.signatureName || null,
      signatureMatchesName: result.extractedData?.signatureMatchesName || false,
    },
    
    dataCompleteness: result.dataCompleteness || {},

    profileComparison: result.profileComparison ? {
      matchStatus: result.profileComparison.matchStatus,
      matches: result.profileComparison.matches,
      mismatches: result.profileComparison.mismatches,
      warnings: result.profileComparison.warnings,
      comparisonDetails: result.profileComparison.comparisonDetails
    } : null,
    
    consentDetails: result.consentDetails || [],
    recommendations: result.recommendations || [],
    
    metadata: {
      validatedAt: new Date().toISOString(),
      aiModel: 'gemini-2.0-flash',
      profileCheckEnabled: !!result.profileComparison
    }
  };
};

// Check completeness requirements
export const checkConsentFormRequirements = (result) => {
  if (!result) return { passed: false, issues: ['ไม่มีข้อมูลผลการตรวจสอบ'] };

  const issues = [];
  
  if (!result.isConsentForm) issues.push('ไม่ใช่หนังสือยินยอม');
  if (!result.hasSignature) issues.push('ไม่พบลายเซ็น');
  
  if (result.dataCompleteness) {
    if (!result.dataCompleteness.hasFullName) issues.push('ไม่มีชื่อ-นามสกุลครบถ้วน');
    if (!result.dataCompleteness.hasValidIdCard) issues.push('เลขบัตรประชาชนไม่ถูกต้อง');
    if (!result.dataCompleteness.hasBirthDateOrAge) issues.push('ไม่มีวันเกิดหรืออายุ');
    if (!result.dataCompleteness.hasCompleteAddress) issues.push('ที่อยู่ไม่ครบถ้วน');
    if (!result.dataCompleteness.hasContactInfo) issues.push('ไม่มีข้อมูลติดต่อ');
    if (!result.dataCompleteness.hasRoleSelection) issues.push('ไม่มีการเลือกบทบาท');
    if (!result.dataCompleteness.hasWrittenDate) issues.push('ไม่มีวันที่เขียน');
    if (!result.dataCompleteness.hasSignatureName) issues.push('ไม่มีชื่อใต้ลายเซ็น');
  }
  
  if (result.profileComparison?.matchStatus === 'mismatch') {
    issues.push('ข้อมูลไม่ตรงกับโปรไฟล์');
  }

  return {
    passed: issues.length === 0,
    issues: issues,
    requirements: {
      isConsentForm: result.isConsentForm,
      hasSignature: result.hasSignature,
      dataComplete: result.dataCompleteness?.completenessScore >= 90,
      profileMatches: result.profileComparison?.matchStatus !== 'mismatch'
    }
  };
};

// Generate summary
export const generateConsentFormSummary = (result) => {
  if (!result) return 'ไม่มีข้อมูลผลการตรวจสอบ';

  const requirements = checkConsentFormRequirements(result);
  
  let summary = `📋 สรุปผลการตรวจสอบหนังสือยินยอม\n\n`;
  summary += `สถานะ: ${result.overall_status === 'valid' ? '✅ ผ่าน' : result.overall_status === 'needs_review' ? '⚠️ ต้องตรวจสอบ' : '❌ ไม่ผ่าน'}\n`;
  summary += `ประเภท: ${getConsentFormTypeName(result.formType)}\n`;
  summary += `ความเชื่อมั่น: ${result.confidence}%\n`;
  
  if (result.dataCompleteness) {
    summary += `ความครบถ้วน: ${result.dataCompleteness.completenessScore}%\n`;
  }

  summary += `\n✅ ข้อกำหนด:\n`;
  summary += `${requirements.requirements.isConsentForm ? '✅' : '❌'} เป็นหนังสือยินยอม\n`;
  summary += `${requirements.requirements.hasSignature ? '✅' : '❌'} มีลายเซ็น\n`;
  summary += `${requirements.requirements.dataComplete ? '✅' : '❌'} ข้อมูลครบถ้วน\n`;
  summary += `${requirements.requirements.profileMatches ? '✅' : '❌'} ข้อมูลตรงกับโปรไฟล์\n`;

  if (result.extractedData && Object.keys(result.extractedData).length > 0) {
    summary += `\n📋 ข้อมูลในเอกสาร:\n`;
    if (result.extractedData.name) summary += `• ชื่อ: ${result.extractedData.name}\n`;
    if (result.extractedData.idCard) summary += `• เลขบัตร: ${result.extractedData.idCard}\n`;
    if (result.extractedData.birthDate) summary += `• วันเกิด: ${result.extractedData.birthDate}\n`;
    if (result.extractedData.phone) summary += `• โทร: ${result.extractedData.phone}\n`;
    if (result.extractedData.email) summary += `• อีเมล: ${result.extractedData.email}\n`;
    if (result.extractedData.writtenDate) summary += `• วันที่เขียน: ${result.extractedData.writtenDate}\n`;
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

// Validate multiple consent forms
export const validateMultipleConsentForms = async (files, includeProfileCheck = true) => {
  const results = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await validateConsentForm(
        file.uri, 
        file.formType || 'student', 
        file.mimeType,
        includeProfileCheck
      );
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        formType: file.formType || 'student',
        validation: result,
        success: true,
        dataComplete: result.dataCompleteness?.completenessScore >= 90,
        profileMatch: result.profileComparison?.matchStatus !== 'mismatch'
      });
    } catch (error) {
      results.push({
        fileIndex: i,
        fileName: file.name || file.filename,
        formType: file.formType || 'student',
        error: error.message,
        success: false,
        dataComplete: false,
        profileMatch: false
      });
    }
  }
  
  return results;
};

// Check AI backend status
export const checkConsentFormAIStatus = async () => {
  try {
    console.log('🤖 Checking ConsentForm AI backend status...');

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
          console.log('❌ Server test failed:', error.message);
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