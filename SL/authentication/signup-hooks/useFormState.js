import { useState } from "react";
import { Timestamp } from "firebase/firestore";

export const useFormState = () => {
  // Basic Info
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [citizenId, setCitizenId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phoneNum, setPhoneNum] = useState("");
  const [major, setMajor] = useState("");
  const [school, setSchool] = useState("");
  const [siblingsCount, setSiblingsCount] = useState("");

  // Date Picker state
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [isFatherDatePickerVisible, setFatherDatePickerVisible] =
    useState(false);
  const [isMotherDatePickerVisible, setMotherDatePickerVisible] =
    useState(false);
  const [isGuardianDatePickerVisible, setGuardianDatePickerVisible] =
    useState(false);

  // Current Address
  const [currentAddress, setCurrentAddress] = useState({
    sub_district: "",
    moo: "",
    village: "",
    province: "",
    road: "",
    soi: "",
    district: "",
    house_no: "",
    zipcode: "",
  });

  // Permanent Address
  const [permAddress, setPermAddress] = useState({
    sub_district: "",
    moo: "",
    village: "",
    province: "",
    road: "",
    soi: "",
    district: "",
    house_no: "",
    zipcode: "",
  });

  // Father Info
  const [fatherInfo, setFatherInfo] = useState({
    name: "",
    citizen_id: "",
    birth_date: "",
    occupation: "",
    education_level: "",
    phone_number: "",
    email: "",
    nationality: "",
    income: "",
    address_current: {
      sub_district: "",
      moo: "",
      village: "",
      province: "",
      road: "",
      soi: "",
      district: "",
      house_no: "",
      zipcode: "",
    },
    address_perm: {
      sub_district: "",
      moo: "",
      village: "",
      province: "",
      road: "",
      soi: "",
      district: "",
      house_no: "",
      zipcode: "",
    },
    workplace: {
      name: "",
      district: "",
      house_no: "",
      moo: "",
      province: "",
      road: "",
      soi: "",
      sub_district: "",
      zipcode: "",
    },
  });

  // Mother Info
  const [motherInfo, setMotherInfo] = useState({
    name: "",
    citizen_id: "",
    birth_date: "",
    occupation: "",
    education_level: "",
    phone_number: "",
    email: "",
    nationality: "",
    income: "",
    address_current: {
      sub_district: "",
      moo: "",
      village: "",
      province: "",
      road: "",
      soi: "",
      district: "",
      house_no: "",
      zipcode: "",
    },
    address_perm: {
      sub_district: "",
      moo: "",
      village: "",
      province: "",
      road: "",
      soi: "",
      district: "",
      house_no: "",
      zipcode: "",
    },
    workplace: {
      name: "",
      district: "",
      house_no: "",
      moo: "",
      province: "",
      road: "",
      soi: "",
      sub_district: "",
      zipcode: "",
    },
  });

  // Guardian Info
  const [guardianInfo, setGuardianInfo] = useState({
    name: "",
    citizen_id: "",
    birth_date: "",
    occupation: "",
    education_level: "",
    phone_number: "",
    email: "",
    nationality: "",
    income: "",
    guardian_relation: "",
    address_current: {
      sub_district: "",
      moo: "",
      village: "",
      province: "",
      road: "",
      soi: "",
      district: "",
      house_no: "",
      zipcode: "",
    },
    address_perm: {
      sub_district: "",
      moo: "",
      village: "",
      province: "",
      road: "",
      soi: "",
      district: "",
      house_no: "",
      zipcode: "",
    },
    workplace: {
      name: "",
      district: "",
      house_no: "",
      moo: "",
      province: "",
      road: "",
      soi: "",
      sub_district: "",
      zipcode: "",
    },
  });

  // Helper functions for updating nested objects
  const updateCurrentAddress = (field, value) => {
    setCurrentAddress((prev) => ({ ...prev, [field]: value }));
  };

  const updatePermAddress = (field, value) => {
    setPermAddress((prev) => ({ ...prev, [field]: value }));
  };

  const updateFatherInfo = (field, value) => {
    setFatherInfo((prev) => ({ ...prev, [field]: value }));
  };

  const updateFatherAddress = (type, field, value) => {
    setFatherInfo((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }));
  };

  const updateMotherInfo = (field, value) => {
    setMotherInfo((prev) => ({ ...prev, [field]: value }));
  };

  const updateMotherAddress = (type, field, value) => {
    setMotherInfo((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }));
  };

  const updateGuardianInfo = (field, value) => {
    setGuardianInfo((prev) => ({ ...prev, [field]: value }));
  };

  const updateGuardianAddress = (type, field, value) => {
    setGuardianInfo((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }));
  };

  // Copy permanent address to current address
  const copyPermToCurrent = (setter, permData) => {
    setter((prev) => ({ ...prev, address_current: { ...permData } }));
  };

  // Date Picker Functions
  const showDatePicker = () => {
    setDatePickerVisible(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisible(false);
  };

  const handleConfirm = (date) => {
    setBirthDate(Timestamp.fromDate(date));
    hideDatePicker();
  };

  const showFatherDatePicker = () => setFatherDatePickerVisible(true);
  const hideFatherDatePicker = () => setFatherDatePickerVisible(false);
  const handleFatherConfirm = (date) => {
    updateFatherInfo("birth_date", Timestamp.fromDate(date));
    hideFatherDatePicker();
  };

  const showMotherDatePicker = () => setMotherDatePickerVisible(true);
  const hideMotherDatePicker = () => setMotherDatePickerVisible(false);
  const handleMotherConfirm = (date) => {
    updateMotherInfo("birth_date", Timestamp.fromDate(date));
    hideMotherDatePicker();
  };

  const showGuardianDatePicker = () => setGuardianDatePickerVisible(true);
  const hideGuardianDatePicker = () => setGuardianDatePickerVisible(false);
  const handleGuardianConfirm = (date) => {
    updateGuardianInfo("birth_date", Timestamp.fromDate(date));
    hideGuardianDatePicker();
  };

  // Reset all form data
  const resetForm = () => {
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setName("");
    setCitizenId("");
    setStudentId("");
    setBirthDate("");
    setPhoneNum("");
    setMajor("");
    setSchool("");
    setSiblingsCount("");

    setCurrentAddress({
      sub_district: "",
      moo: "",
      village: "",
      province: "",
      road: "",
      soi: "",
      district: "",
      house_no: "",
      zipcode: "",
    });

    setPermAddress({
      sub_district: "",
      moo: "",
      village: "",
      province: "",
      road: "",
      soi: "",
      district: "",
      house_no: "",
      zipcode: "",
    });

    setFatherInfo({
      name: "",
      citizen_id: "",
      birth_date: "",
      occupation: "",
      education_level: "",
      phone_number: "",
      email: "",
      nationality: "",
      income: "",
      address_current: {
        sub_district: "",
        moo: "",
        village: "",
        province: "",
        road: "",
        soi: "",
        district: "",
        house_no: "",
        zipcode: "",
      },
      address_perm: {
        sub_district: "",
        moo: "",
        village: "",
        province: "",
        road: "",
        soi: "",
        district: "",
        house_no: "",
        zipcode: "",
      },
      workplace: {
        name: "",
        district: "",
        house_no: "",
        moo: "",
        province: "",
        road: "",
        soi: "",
        sub_district: "",
        zipcode: "",
      },
    });

    setMotherInfo({
      name: "",
      citizen_id: "",
      birth_date: "",
      occupation: "",
      education_level: "",
      phone_number: "",
      email: "",
      nationality: "",
      income: "",
      address_current: {
        sub_district: "",
        moo: "",
        village: "",
        province: "",
        road: "",
        soi: "",
        district: "",
        house_no: "",
        zipcode: "",
      },
      address_perm: {
        sub_district: "",
        moo: "",
        village: "",
        province: "",
        road: "",
        soi: "",
        district: "",
        house_no: "",
        zipcode: "",
      },
      workplace: {
        name: "",
        district: "",
        house_no: "",
        moo: "",
        province: "",
        road: "",
        soi: "",
        sub_district: "",
        zipcode: "",
      },
    });

    setGuardianInfo({
      name: "",
      citizen_id: "",
      birth_date: "",
      occupation: "",
      education_level: "",
      phone_number: "",
      email: "",
      nationality: "",
      income: "",
      guardian_relation: "",
      address_current: {
        sub_district: "",
        moo: "",
        village: "",
        province: "",
        road: "",
        soi: "",
        district: "",
        house_no: "",
        zipcode: "",
      },
      address_perm: {
        sub_district: "",
        moo: "",
        village: "",
        province: "",
        road: "",
        soi: "",
        district: "",
        house_no: "",
        zipcode: "",
      },
      workplace: {
        name: "",
        district: "",
        house_no: "",
        moo: "",
        province: "",
        road: "",
        soi: "",
        sub_district: "",
        zipcode: "",
      },
    });
  };

  // Get all form data for submission
  const getAllFormData = () => {
    return {
      email,
      password,
      name,
      citizenId,
      studentId,
      birthDate,
      phoneNum,
      major,
      school,
      siblingsCount,
      currentAddress,
      permAddress,
      fatherInfo,
      motherInfo,
      guardianInfo,
    };
  };

  return {
    // Basic Info State
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    name,
    setName,
    citizenId,
    setCitizenId,
    studentId,
    setStudentId,
    birthDate,
    setBirthDate,
    phoneNum,
    setPhoneNum,
    major,
    setMajor,
    school,
    setSchool,
    siblingsCount,
    setSiblingsCount,

    // Date Picker State
    isDatePickerVisible,
    setDatePickerVisible,
    isFatherDatePickerVisible,
    setFatherDatePickerVisible,
    isMotherDatePickerVisible,
    setMotherDatePickerVisible,
    isGuardianDatePickerVisible,
    setGuardianDatePickerVisible,

    // Address State
    currentAddress,
    setCurrentAddress,
    permAddress,
    setPermAddress,

    // Parent Info State
    fatherInfo,
    setFatherInfo,
    motherInfo,
    setMotherInfo,
    guardianInfo,
    setGuardianInfo,

    // Update Functions
    updateCurrentAddress,
    updatePermAddress,
    updateFatherInfo,
    updateFatherAddress,
    updateMotherInfo,
    updateMotherAddress,
    updateGuardianInfo,
    updateGuardianAddress,

    // Helper Functions
    copyPermToCurrent,

    // Date Picker Functions
    showDatePicker,
    hideDatePicker,
    handleConfirm,
    showFatherDatePicker,
    hideFatherDatePicker,
    handleFatherConfirm,
    showMotherDatePicker,
    hideMotherDatePicker,
    handleMotherConfirm,
    showGuardianDatePicker,
    hideGuardianDatePicker,
    handleGuardianConfirm,

    // Form Management
    resetForm,
    getAllFormData,
  };
};

export default useFormState;
