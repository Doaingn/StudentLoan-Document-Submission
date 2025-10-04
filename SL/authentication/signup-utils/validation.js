// Validation functions for signup form

export const validateStep1 = (
  email,
  password,
  name,
  citizenId,
  studentId,
  birthDate,
  phoneNum
) => {
  return (
    email && password && name && citizenId && studentId && birthDate && phoneNum
  );
};

export const validateStep2 = (currentAddress, permAddress) => {
  const required = [
    "house_no",
    "sub_district",
    "district",
    "province",
    "zipcode",
  ];
  return required.every((field) => currentAddress[field] && permAddress[field]);
};

// Enhanced validation functions
export const validateEmail = (email) => {
  if (!email) return "กรุณากรอกอีเมล";
  if (email === "-") return null; // Allow dash for no email

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "รูปแบบอีเมลไม่ถูกต้อง";
  }
  return null;
};

export const validatePassword = (password) => {
  if (!password) return "กรุณากรอกรหัสผ่าน";
  if (password.length < 6) {
    return "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
  }
  return null;
};

export const validateCitizenId = (citizenId) => {
  if (!citizenId) return "กรุณากรอกเลขบัตรประชาชน";

  // Remove any non-digit characters
  const cleanId = citizenId.replace(/\D/g, "");

  if (cleanId.length !== 13) {
    return "เลขบัตรประชาชนต้องมี 13 หลัก";
  }

  // Basic validation for Thai citizen ID
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanId.charAt(i)) * (13 - i);
  }
  const checkDigit = (11 - (sum % 11)) % 10;

  if (checkDigit !== parseInt(cleanId.charAt(12))) {
    return "เลขบัตรประชาชนไม่ถูกต้อง";
  }

  return null;
};

export const validatePhoneNumber = (phoneNum) => {
  if (!phoneNum) return "กรุณากรอกเบอร์โทรศัพท์";

  const phoneRegex = /^[0-9]{9,10}$/;
  const cleanPhone = phoneNum.replace(/\D/g, "");

  if (!phoneRegex.test(cleanPhone)) {
    return "เบอร์โทรศัพท์ต้องมี 9-10 หลัก";
  }

  return null;
};

export const validateRequiredField = (value, fieldName) => {
  if (!value || value.trim() === "") {
    return `กรุณากรอก${fieldName}`;
  }
  return null;
};

export const validateNumberField = (value, fieldName) => {
  if (!value) return `กรุณากรอก${fieldName}`;

  const numValue = parseInt(value);
  if (isNaN(numValue) || numValue < 0) {
    return `${fieldName}ต้องเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0`;
  }

  return null;
};

export const validateParentInfo = (parentData, parentType) => {
  const errors = {};

  if (!parentData.name) {
    errors.name = `กรุณากรอกชื่อ${parentType}`;
  }

  if (parentData.citizen_id) {
    const citizenError = validateCitizenId(parentData.citizen_id);
    if (citizenError) {
      errors.citizen_id = citizenError;
    }
  }

  if (parentData.phone_number) {
    const phoneError = validatePhoneNumber(parentData.phone_number);
    if (phoneError) {
      errors.phone_number = phoneError;
    }
  }

  if (parentData.email && parentData.email !== "-") {
    const emailError = validateEmail(parentData.email);
    if (emailError) {
      errors.email = emailError;
    }
  }

  if (parentData.income) {
    const incomeError = validateNumberField(parentData.income, "รายได้");
    if (incomeError) {
      errors.income = incomeError;
    }
  }

  return Object.keys(errors).length === 0 ? null : errors;
};

export const validateGuardianInfo = (guardianData) => {
  const errors = validateParentInfo(guardianData, "ผู้ปกครอง") || {};

  if (!guardianData.guardian_relation) {
    errors.guardian_relation = "กรุณากรอกความสัมพันธ์กับนักศึกษา";
  }

  return Object.keys(errors).length === 0 ? null : errors;
};

export const validateAddress = (address, addressType) => {
  const errors = {};

  const requiredFields = [
    "house_no",
    "sub_district",
    "district",
    "province",
    "zipcode",
  ];

  requiredFields.forEach((field) => {
    if (!address[field]) {
      const fieldNames = {
        house_no: "บ้านเลขที่",
        sub_district: "ตำบล/แขวง",
        district: "อำเภอ/เขต",
        province: "จังหวัด",
        zipcode: "รหัสไปรษณีย์",
      };
      errors[field] = `กรุณากรอก${fieldNames[field]}สำหรับ${addressType}`;
    }
  });

  return Object.keys(errors).length === 0 ? null : errors;
};

// Comprehensive form validation
export const validateAllSteps = (formData) => {
  const errors = {};

  // Step 1 validation
  if (
    !validateStep1(
      formData.email,
      formData.password,
      formData.name,
      formData.citizenId,
      formData.studentId,
      formData.birthDate,
      formData.phoneNum
    )
  ) {
    errors.step1 = "กรุณากรอกข้อมูลพื้นฐานให้ครบถ้วน";
  } else {
    const emailError = validateEmail(formData.email);
    if (emailError) errors.email = emailError;

    const passwordError = validatePassword(formData.password);
    if (passwordError) errors.password = passwordError;

    const citizenError = validateCitizenId(formData.citizenId);
    if (citizenError) errors.citizenId = citizenError;

    const phoneError = validatePhoneNumber(formData.phoneNum);
    if (phoneError) errors.phoneNum = phoneError;
  }

  // Step 2 validation
  if (!validateStep2(formData.currentAddress, formData.permAddress)) {
    errors.step2 = "กรุณากรอกข้อมูลที่อยู่ให้ครบถ้วน";
  } else {
    const currentAddressError = validateAddress(
      formData.currentAddress,
      "ที่อยู่ปัจจุบัน"
    );
    if (currentAddressError) errors.currentAddress = currentAddressError;

    const permAddressError = validateAddress(
      formData.permAddress,
      "ที่อยู่ตามทะเบียนบ้าน"
    );
    if (permAddressError) errors.permAddress = permAddressError;
  }

  // Step 3 validation (Father)
  const fatherError = validateParentInfo(formData.fatherInfo, "บิดา");
  if (fatherError) errors.fatherInfo = fatherError;

  // Step 4 validation (Mother)
  const motherError = validateParentInfo(formData.motherInfo, "มารดา");
  if (motherError) errors.motherInfo = motherError;

  // Step 5 validation (Guardian)
  const guardianError = validateGuardianInfo(formData.guardianInfo);
  if (guardianError) errors.guardianInfo = guardianError;

  return Object.keys(errors).length === 0 ? null : errors;
};

export default {
  validateStep1,
  validateStep2,
  validateEmail,
  validatePassword,
  validateCitizenId,
  validatePhoneNumber,
  validateRequiredField,
  validateNumberField,
  validateParentInfo,
  validateGuardianInfo,
  validateAddress,
  validateAllSteps,
};
