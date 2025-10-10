import { Alert, Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { ref, getDownloadURL } from "firebase/storage";
import { Buffer } from "buffer";
import { db, storage } from "../../database/firebase";

// ===== PDF Helper =====
let PDFDocument, rgb, fontkit;
if (Platform.OS !== "web") {
  const pdfLib = require("pdf-lib");
  PDFDocument = pdfLib.PDFDocument;
  rgb = pdfLib.rgb;
  fontkit = require("@pdf-lib/fontkit");
}

// ฟังก์ชันคำนวณรายได้ต่อปี
const calculateAnnualIncome = (monthlyIncome) => {
  if (typeof monthlyIncome === 'number') {
    return monthlyIncome * 12;  // คูณรายได้ต่อเดือนด้วย 12 เพื่อหาค่ารายได้ต่อปี
  } else {
    console.error('Invalid monthly income value');
    return 0;
  }
};

// ฟังก์ชันการวาดข้อความที่มีการเลื่อนตำแหน่ง x และ y ตามการคำนวณระยะห่าง
function drawTextWithCharacterSpacing(page, text, x, y, font, size) {
      let currentX = x;

      // อักษรที่มีวรรณยุกต์ที่ต้องการปรับตำแหน่ง
      const accentChars = ["่", "้", "๊", "๋"];
      // อักษรที่มีสระ อิ, อี, อึ, อื
      const vowelChars = ["ิ", "ี", "ึ", "ื", "ั"];

      // กำหนดการเลื่อนตำแหน่ง y สำหรับตัวอักษรที่มีวรรณยุกต์และสระ
      const accentShift = 1; // ปรับตำแหน่ง y สำหรับวรรณยุกต์
      const vowelShift = 0.5;  // ปรับตำแหน่ง y สำหรับตัวอักษรที่มีสระ
      const extraAccentShift = 3; // การเลื่อนตำแหน่ง y สำหรับวรรณยุกต์ที่ต้องการให้สูงมากขึ้นเมื่อมีสระ

      for (let i = 0; i < text.length; i++) {
        const char = text.charAt(i); // ดึงตัวอักษรทีละตัว
        
        // ตรวจสอบว่ามีสระหรือไม่
        const hasVowel = vowelChars.some(vowel => text.includes(vowel));
        
        // กำหนดตำแหน่ง y สำหรับตัวอักษรที่มีวรรณยุกต์หรือสระ
        let adjustedY = y;

        if (accentChars.some(accent => char.includes(accent))) {
          if (hasVowel) {
            adjustedY += accentShift + extraAccentShift;  // ถ้ามีสระเลื่อนตำแหน่ง y ของวรรณยุกต์มากขึ้น
          } else {
            adjustedY += accentShift;  // ถ้าไม่มีสระ เลื่อนตามปกติ
          }
        } else if (vowelChars.some(vowel => char.includes(vowel))) {
          adjustedY += vowelShift;  // ปรับตำแหน่ง y สำหรับตัวอักษรที่มีสระ
        }

        // วาดตัวอักษร
        page.drawText(char, { x: currentX, y: adjustedY, size: size, font: font });

        // คำนวณความกว้างของตัวอักษรและเลื่อนไปตามนั้น
        const charWidth = font.widthOfTextAtSize(char, size);
        currentX += charWidth; // เลื่อนไปตามขนาดตัวอักษร
      }
    }


function drawCitizenId(pdfPage, citizenId, font, startY) {
  if (!citizenId || citizenId === undefined || citizenId === null || citizenId.toString().trim() === "") {
    citizenId = "-------------"; // 13 ช่องเป็นขีด
  }
  const digits = citizenId.toString().split("");
  const positionsX = [167.2, 190.08, 207.8, 223.8, 242.36, 265, 283, 301.56, 319.56, 336.84, 362.8, 381.8, 404.52];
  digits.forEach((digit, index) => {
    if (positionsX[index] !== undefined) {
      pdfPage.drawText(digit, { x: positionsX[index], y: startY, size: 12, font: font });
    }
  });
}

function drawCitizenIdfather(pdfPage, citizenId, font, startY) {
  if (!citizenId || citizenId === undefined || citizenId === null || citizenId.toString().trim() === "") {
    citizenId = "-------------"; // 13 ช่องเป็นขีด
  }
  const digits = citizenId.toString().split("");
  const positionsX = [187.2, 211, 228, 246.5, 264.5, 286, 303, 321.5, 340, 357, 379, 397, 419];
  digits.forEach((digit, index) => {
    if (positionsX[index] !== undefined) {
      pdfPage.drawText(digit, { x: positionsX[index], y: startY, size: 12, font: font });
    }
  });
}

// แปลงวันเกิดเป็น DDMMYYYY
function formatDateToDDMMYYYY(date) {
  if (!date) return "--------";
  let d;
  if (date.toDate) {
    d = date.toDate(); // Firestore Timestamp
  } else {
    d = new Date(date);
  }
  if (isNaN(d.getTime())) return "--------";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear());
  return `${day}${month}${year}`;
}

function drawBirthDate(pdfPage, birthDate, font, startY) {
  const formatted = formatDateToDDMMYYYY(birthDate);
  const digits = formatted.split("");
  const positionsX = [135.36, 142.96, 175, 182, 234.72, 241, 248, 255];
  digits.forEach((digit, index) => {
    if (positionsX[index] !== undefined) {
      pdfPage.drawText(digit, { x: positionsX[index], y: startY, size: 12, font: font });
    }
  });
}

// ฟังก์ชันคำนวณอายุ
const calculateAge = (birthDate) => {
  if (!birthDate) return "Invalid Date";
  const birth = birthDate.toDate ? birthDate.toDate() : new Date(birthDate);
  if (isNaN(birth.getTime())) return "Invalid Date";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDifference = today.getMonth() - birth.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

// ฟังก์ชันสร้าง PDF
async function fillPdf(userData, existingPdfBytes, fontBytes) {
  if (Platform.OS === "web") {
    Alert.alert("ไม่รองรับ Web", "การสร้าง PDF บน Web ยังไม่รองรับ");
    return null;
  }

  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  pdfDoc.registerFontkit(fontkit);
  const customFont = await pdfDoc.embedFont(fontBytes);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const secondPage = pages[1];
  const threePage = pages[2];
  const fourthPage = pages[3];

  // ===== คำนวณอายุและวางลง PDF =====
  const age = calculateAge(userData.birth_date);
  if (age === "Invalid Date") {
    Alert.alert("ข้อผิดพลาด", "วันที่เกิดไม่ถูกต้อง");
    return null;
  }

  // ฟังก์ชันตัด B ออกจากรหัสนักศึกษา
const removePrefix = (studentID) => {
    const prefixes = ["B"];  // คำนำหน้าที่จะตัดออก
    for (let prefix of prefixes) {
        if (studentID.startsWith(prefix)) {
        return studentID.slice(prefix.length).trim();
        }
    }
    return studentID;
  };
  const studentID = userData.student_id;
  const studentIDwithoutB = removePrefix(studentID);

  

  // ข้อมูลส่วนตัว
  firstPage.drawText(age.toString(), { x: 345.6, y: 575.68, size: 12, font: customFont });
  firstPage.drawText(userData.name || "-", { x: 100.08, y: 614.88, size: 12, font: customFont });
  firstPage.drawText(userData.email || "-", { x: 411.12, y: 555.84, size: 12, font: customFont });
  firstPage.drawText(userData.phone_num || "-", { x: 285.12, y: 557.84, size: 12, font: customFont });
  firstPage.drawText(userData.major || "-", { x: 202.32, y: 484.56, size: 12, font: customFont });
  firstPage.drawText(userData.birthdate || "-", { x: 139.68, y: 573.12, size: 12, font: customFont });
  //firstPage.drawText(userData.school || "-", { x: 159.12, y: 503.28, size: 12, font: customFont }); อันนี้ข้อความมันห่าง
  drawTextWithCharacterSpacing(firstPage, userData.school, 159.12, 503.28, customFont, 12);
  firstPage.drawText(studentIDwithoutB.toString() || "-", { x: 165.56, y: 430, size: 12, font: customFont });
  firstPage.drawText(userData.siblings_count.toString() || "-", { x: 285.12, y: 412, size: 12, font: customFont });
  drawCitizenId(firstPage, userData.citizen_id, customFont, 596.88);
  drawBirthDate(firstPage, userData.birth_date, customFont, 578.16);
  // ข้อมูลที่อยู่ตามทะเบียนบ้าน
  firstPage.drawText(userData.address_perm.house_no || "-", { x: 194.4, y: 395, size: 12, font: customFont });
  firstPage.drawText(userData.address_perm.moo || "-", { x: 244.8, y: 395, size: 12, font: customFont });
  firstPage.drawText(userData.address_perm.village || "-", { x: 317.52, y: 395, size: 12, font: customFont });
  firstPage.drawText(userData.address_perm.soi || "-", { x: 460.8, y: 395, size: 12, font: customFont });
  firstPage.drawText(userData.address_perm.road || "-", { x: 75.6, y: 377, size: 12, font: customFont });
  firstPage.drawText(userData.address_perm.sub_district || "-", { x: 216, y: 377, size: 12, font: customFont });
  firstPage.drawText(userData.address_perm.district || "-", { x: 326.16, y: 377, size: 12, font: customFont });
  firstPage.drawText(userData.address_perm.province || "-", { x: 438, y: 377, size: 12, font: customFont });
  firstPage.drawText(userData.address_perm.zipcode || "-", { x: 113.76, y: 358.5, size: 12, font: customFont });
  // ข้อมูลที่อยู่ปัจจุบัน
  firstPage.drawText(userData.address_current.house_no || "-", { x: 153.36, y:341, size: 12, font: customFont });
  firstPage.drawText(userData.address_current.moo || "-", { x: 204.5, y: 341, size: 12, font: customFont });
  firstPage.drawText(userData.address_current.village || "-", { x: 278, y: 341, size: 12, font: customFont });
  firstPage.drawText(userData.address_current.soi || "-", { x: 419.04, y: 341, size: 12, font: customFont });
  firstPage.drawText(userData.address_current.road || "-", { x: 77.04, y: 323, size: 12, font: customFont });
  firstPage.drawText(userData.address_current.sub_district || "-", { x: 214, y: 323, size: 12, font: customFont });
  firstPage.drawText(userData.address_current.district || "-", { x: 326.16, y: 323, size: 12, font: customFont });
  firstPage.drawText(userData.address_current.province || "-", { x: 437.04, y: 323, size: 12, font: customFont });
  firstPage.drawText(userData.address_current.zipcode || "-", { x: 113.76, y: 304.5, size: 12, font: customFont });
  
  // ข้อมูลบิดา
  if (userData.survey.familyStatus === "ก" || userData.survey.livingWith === "บิดา") {
    secondPage.drawText(userData.father_info.name || "-", { x: 124.4, y: 495.104, size: 12, font: customFont });
    drawCitizenIdfather(secondPage, userData.father_info.citizen_id, customFont, 475.92);
    secondPage.drawText(userData.father_info.nationality || "-", { x: 259.2, y: 454, size: 12, font: customFont });
    secondPage.drawText(userData.father_info.phone_number || "-", { x: 320.4, y: 435.6, size: 12, font: customFont });
    secondPage.drawText(userData.father_info.email || "-", { x: 439.92, y: 435.6, size: 12, font: customFont });
    secondPage.drawText(userData.father_info.education_level || "-", { x: 136.8, y: 419, size: 12, font: customFont });
    const annualIncomefather = calculateAnnualIncome(userData.father_info.income);
    secondPage.drawText(annualIncomefather.toString() || "-", { x: 100.08, y: 237.5, size: 12, font: customFont });
    // ข้อมูลที่อยู่ตามทะเบียนบ้าน
    secondPage.drawText(userData.father_info.address_perm.house_no || "-", { x: 179, y: 220.5, size: 9, font: customFont });
    secondPage.drawText(userData.father_info.address_perm.moo || "-", { x: 231, y: 220.5, size: 12, font: customFont });
    //secondPage.drawText(userData.father_info.address_perm.village || "-", { x: 304.56, y: 220.5, size: 12, font: customFont });
    drawTextWithCharacterSpacing(secondPage, userData.father_info.address_perm.village, 304.56, 220.5, customFont, 12);
    secondPage.drawText(userData.father_info.address_perm.soi || "-", { x: 446.4, y: 220.5, size: 12, font: customFont });
    secondPage.drawText(userData.father_info.address_perm.road || "-", { x: 63.5, y: 203, size: 12, font: customFont });
    secondPage.drawText(userData.father_info.address_perm.sub_district || "-", { x: 205.2, y: 203, size: 12, font: customFont });
    secondPage.drawText(userData.father_info.address_perm.district || "-", { x: 315, y: 203, size: 12, font: customFont });
    secondPage.drawText(userData.father_info.address_perm.province || "-", { x: 425.52, y: 203, size: 12, font: customFont });
    secondPage.drawText(userData.father_info.address_perm.zipcode || "-", { x: 101.52, y: 184, size: 12, font: customFont });
    // ข้อมูลที่อยู่ปัจจุบัน
    secondPage.drawText(userData.father_info.address_current.house_no || "-", { x: 141, y: 166.5, size: 9, font: customFont });
    secondPage.drawText(userData.father_info.address_current.moo || "-", { x: 191.52, y: 166.5, size: 12, font: customFont });
    //secondPage.drawText(userData.father_info.address_current.village || "-", { x: 264.24, y: 166.5, size: 12, font: customFont });
    drawTextWithCharacterSpacing(secondPage, userData.father_info.address_current.village, 264.24, 166.5, customFont, 12);
    secondPage.drawText(userData.father_info.address_current.soi || "-", { x: 405.36, y: 166.5, size: 12, font: customFont });
    secondPage.drawText(userData.father_info.address_current.road || "-", { x: 65.52, y: 148.5, size: 12, font: customFont });
    secondPage.drawText(userData.father_info.address_current.sub_district || "-", { x: 203.76, y: 148.5, size: 12, font: customFont });
    secondPage.drawText(userData.father_info.address_current.district || "-", { x: 312.48, y: 148.5, size: 12, font: customFont });
    secondPage.drawText(userData.father_info.address_current.province || "-", { x: 424.8, y: 148.5, size: 12, font: customFont });
    secondPage.drawText(userData.father_info.address_current.zipcode || "-", { x: 113.76, y: 129.5, size: 12, font: customFont });
  }

  if (userData.survey.familyStatus === "ก" || userData.survey.livingWith === "มารดา") {
    secondPage.drawText(userData.mother_info.name || "-", { x: 127.44, y: 112, size: 12, font: customFont });
    drawCitizenIdfather(secondPage, userData.mother_info.citizen_id, customFont, 93);
    secondPage.drawText(userData.mother_info.nationality || "-", { x: 258.48, y: 71, size: 12, font: customFont });
    threePage.drawText(userData.mother_info.phone_number || "-", { x: 310.32, y: 777, size: 12, font: customFont });
    threePage.drawText(userData.mother_info.email || "-", { x: 439.92, y: 777, size: 12, font: customFont });
    threePage.drawText(userData.mother_info.education_level || "-", { x: 126, y: 759, size: 12, font: customFont });
    const annualIncomemother = calculateAnnualIncome(userData.mother_info.income);
    threePage.drawText(annualIncomemother.toString() || "-", { x: 100.8, y: 559.5, size: 12, font: customFont });
    // ข้อมูลที่อยู่ตามทะเบียนบ้าน
    threePage.drawText(userData.mother_info.address_perm.house_no || "-", { x: 192.24, y: 542.5, size: 12, font: customFont });
    threePage.drawText(userData.mother_info.address_perm.moo || "-", { x: 241.5, y: 542.5, size: 12, font: customFont });
    threePage.drawText(userData.mother_info.address_perm.village || "-", { x: 315.36, y: 542.5, size: 12, font: customFont });
    threePage.drawText(userData.mother_info.address_perm.soi || "-", { x: 457.2, y: 542.5, size: 12, font: customFont });
    threePage.drawText(userData.mother_info.address_perm.road || "-", { x: 76.32, y: 525, size: 12, font: customFont });
    threePage.drawText(userData.mother_info.address_perm.sub_district || "-", { x: 213.84, y: 525, size: 12, font: customFont });
    threePage.drawText(userData.mother_info.address_perm.district || "-", { x: 326.16, y: 525, size: 12, font: customFont });
    threePage.drawText(userData.mother_info.address_perm.province || "-", { x: 437.04, y: 525, size: 12, font: customFont });
    threePage.drawText(userData.mother_info.address_perm.zipcode || "-", { x: 111.6, y: 506.5, size: 12, font: customFont });
    // ข้อมูลที่อยู่ปัจจุบัน
    threePage.drawText(userData.mother_info.address_current.house_no || "-", { x: 152.64, y: 489, size: 12, font: customFont });
    threePage.drawText(userData.mother_info.address_current.moo || "-", { x: 203.04, y: 489, size: 12, font: customFont });
    threePage.drawText(userData.mother_info.address_current.village || "-", { x: 275.04, y: 489, size: 12, font: customFont });
    threePage.drawText(userData.mother_info.address_current.soi || "-", { x: 415.44, y: 489, size: 12, font: customFont });
    threePage.drawText(userData.mother_info.address_current.road || "-", { x: 76.32, y: 470.5, size: 12, font: customFont });
    threePage.drawText(userData.mother_info.address_current.sub_district || "-", { x: 213.84, y: 470.5, size: 12, font: customFont });
    threePage.drawText(userData.mother_info.address_current.district || "-", { x: 326.16, y: 470.5, size: 12, font: customFont });
    threePage.drawText(userData.mother_info.address_current.province || "-", { x: 437.04, y: 470.5, size: 12, font: customFont });
    threePage.drawText(userData.mother_info.address_current.zipcode || "-", { x: 111.6, y: 452, size: 12, font: customFont });
  }

  if (userData.survey.familyStatus === "ค") {
    threePage.drawText(userData.guardian_info.name || "-", { x: 137.52, y: 331, size: 12, font: customFont });
    drawCitizenIdfather(threePage, userData.guardian_info.citizen_id, customFont, 313.5);
    threePage.drawText(userData.guardian_info.nationality || "-", { x: 483.12, y: 309.5, size: 12, font: customFont });
    //threePage.drawText(userData.guardian_info.guardian_relation || "-", { x: 139.68, y: 291.5, size: 12, font: customFont });
    drawTextWithCharacterSpacing(threePage, userData.guardian_info.guardian_relation, 139.68, 291.5, customFont, 12);
    threePage.drawText(userData.guardian_info.phone_number || "-", { x: 313.2, y: 274, size: 12, font: customFont });
    threePage.drawText(userData.guardian_info.email || "-", { x: 439.2, y: 274, size: 12, font: customFont });
    threePage.drawText(userData.guardian_info.education_level || "-", { x: 128, y: 255.5, size: 12, font: customFont });
    const annualIncomemother = calculateAnnualIncome(userData.guardian_info.income);
    threePage.drawText(annualIncomemother.toString() || "-", { x: 103.68, y: 74.5, size: 12, font: customFont });
    // ข้อมูลที่อยู่ตามทะเบียนบ้าน
    fourthPage.drawText(userData.guardian_info.address_perm.house_no || "-", { x: 180.72, y: 778.5, size: 10, font: customFont });
    fourthPage.drawText(userData.guardian_info.address_perm.moo || "-", { x: 232.56, y: 778.5, size: 12, font: customFont });
    fourthPage.drawText(userData.guardian_info.address_perm.village || "-", { x: 304.56, y: 778.5, size: 12, font: customFont });
    fourthPage.drawText(userData.guardian_info.address_perm.soi || "-", { x: 447.12, y: 778.5, size: 12, font: customFont });
    fourthPage.drawText(userData.guardian_info.address_perm.road || "-", { x: 76.32, y: 759.5, size: 12, font: customFont });
    fourthPage.drawText(userData.guardian_info.address_perm.sub_district || "-", { x: 205.2, y: 759.5, size: 12, font: customFont });
    fourthPage.drawText(userData.guardian_info.address_perm.district || "-", { x: 315.36, y: 759.5, size: 12, font: customFont });
    fourthPage.drawText(userData.guardian_info.address_perm.province || "-", { x: 426.24, y: 759.5, size: 12, font: customFont });
    fourthPage.drawText(userData.guardian_info.address_perm.zipcode || "-", { x: 102.24, y: 741.5, size: 12, font: customFont });
    // ข้อมูลที่อยู่ปัจจุบัน
    fourthPage.drawText(userData.guardian_info.address_current.house_no || "-", { x: 140.4, y: 723.5, size: 10, font: customFont });
    fourthPage.drawText(userData.guardian_info.address_current.moo || "-", { x: 193.68, y: 723.5, size: 12, font: customFont });
    fourthPage.drawText(userData.guardian_info.address_current.village || "-", { x: 264.24, y: 723.5, size: 12, font: customFont });
    fourthPage.drawText(userData.guardian_info.address_current.soi || "-", { x: 406.08, y: 723.5, size: 12, font: customFont });
    fourthPage.drawText(userData.guardian_info.address_current.road || "-", { x: 76.32, y: 705.5, size: 12, font: customFont });
    fourthPage.drawText(userData.guardian_info.address_current.sub_district || "-", { x: 205.2, y: 705.5, size: 12, font: customFont });
    fourthPage.drawText(userData.guardian_info.address_current.district || "-", { x: 315.36, y: 705.5, size: 12, font: customFont });
    fourthPage.drawText(userData.guardian_info.address_current.province || "-", { x: 426.24, y: 705.5, size: 12, font: customFont });
    fourthPage.drawText(userData.guardian_info.address_current.zipcode || "-", { x: 102.24, y: 687.5, size: 12, font: customFont });
  }

  fourthPage.drawText(userData.name || "-", { x: 333.36, y: 513, size: 12, font: customFont });

  return pdfDoc.save();
}

// ===== ฟังก์ชันรวมทั้งหมดสำหรับ กยศ.101 =====
export const InsertForm101 = async () => {
  if (Platform.OS === "web") {
    Alert.alert("ไม่รองรับ Web", "การสร้าง PDF บน Web ยังไม่รองรับ");
    return;
  }

  try {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("ข้อผิดพลาด", "ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบก่อน");
      return;
    }

    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    let userData = {};

    if (userSnap.exists()) {
      const userInfo = userSnap.data();
      userData = {
        name: userInfo.name,
        email: userInfo.email,
        phone_num: userInfo.phone_num,
        citizen_id: userInfo.citizen_id,
        student_id: userInfo.student_id,
        major: userInfo.major,
        school: userInfo.school,
        siblings_count: userInfo.siblings_count,
        birth_date: userInfo.birth_date,
        birthdate: userInfo.birthdate,
        address_current: userInfo.address_current,
        address_perm: userInfo.address_perm,
        father_info: userInfo.father_info,
        mother_info: userInfo.mother_info,
        guardian_info: userInfo.guardian_info,
        survey: userInfo.survey,
      };
    } else {
      Alert.alert("ข้อผิดพลาด", "ไม่พบข้อมูลผู้ใช้ในฐานข้อมูล");
      return;
    }

    const pdfRef = ref(storage, "กยศ101.pdf");
    const pdfUrl = await getDownloadURL(pdfRef);
    const existingPdfBytes = await fetch(pdfUrl).then((res) => res.arrayBuffer());

    const fontRef = ref(storage, "assets/fonts/Sarabun-Thin.ttf");
    const fontUrl = await getDownloadURL(fontRef);
    const fontBytes = await fetch(fontUrl).then((res) => res.arrayBuffer());

    const pdfBytes = await fillPdf(userData, existingPdfBytes, fontBytes);
    if (!pdfBytes) return;

    const localFileName = "กยศ101.pdf";
    const filePath = `${FileSystem.documentDirectory}${localFileName}`;
    const base64Pdf = Buffer.from(pdfBytes).toString("base64");

    await FileSystem.writeAsStringAsync(filePath, base64Pdf, { encoding: FileSystem.EncodingType.Base64 });
    await Sharing.shareAsync(filePath);

    Alert.alert("สร้างสำเร็จ", `สร้างไฟล์ ${localFileName} เรียบร้อยแล้ว`);

  } catch (error) {
    console.error("Error generating filled PDF:", error);
    Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถสร้างเอกสารได้");
  }
};
