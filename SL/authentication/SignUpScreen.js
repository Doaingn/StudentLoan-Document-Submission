import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { setDistricts, setSubDistricts } from "./signup-steps/AddressStep";
import { auth, db } from "../../database/firebase";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, Timestamp } from "firebase/firestore";

// Import components
import BasicInfoStep from "./signup-steps/BasicInfoStep";
import AddressStep from "./signup-steps/AddressStep";
import ParentInfoStep from "./signup-steps/ParentInfoStep";
import GuardianInfoStep from "./signup-steps/GuardianInfoStep";

// Import utilities
import { validateStep1, validateStep2 } from "./signup-utils/validation";
import { handleSignUp } from "./signup-utils/authHandlers";
import { useAddressData } from "./signup-hooks/useAddressData";
import { useFormState } from "./signup-hooks/useFormState";

// Import styles
import styles from "./signup-styles/styles";

const SignUpScreen = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Use custom hooks
  const {
    provinces,
    districts,
    subDistricts,
    permDistricts,
    permSubDistricts,
    addressLoading,
    addressError,
  } = useAddressData();
  const {
    // Basic Info
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

    // Date Pickers
    isDatePickerVisible,
    setDatePickerVisible,
    isFatherDatePickerVisible,
    setFatherDatePickerVisible,
    isMotherDatePickerVisible,
    setMotherDatePickerVisible,
    isGuardianDatePickerVisible,
    setGuardianDatePickerVisible,

    // Addresses
    currentAddress,
    setCurrentAddress,
    permAddress,
    setPermAddress,

    // Parent Info
    fatherInfo,
    setFatherInfo,
    motherInfo,
    setMotherInfo,
    guardianInfo,
    setGuardianInfo,

    // Helper functions
    updateCurrentAddress,
    updatePermAddress,
    updateFatherInfo,
    updateFatherAddress,
    updateMotherInfo,
    updateMotherAddress,
    updateGuardianInfo,
    updateGuardianAddress,
    copyPermToCurrent,
    handleProvinceChange,
    handleDistrictChange,
    handleSubDistrictChange,
    resetAddressSelection,
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
  } = useFormState();

  const handleSignUpPress = async () => {
    await handleSignUp(
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
      setIsLoading,
      navigation
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <BasicInfoStep
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            name={name}
            setName={setName}
            citizenId={citizenId}
            setCitizenId={setCitizenId}
            studentId={studentId}
            setStudentId={setStudentId}
            birthDate={birthDate}
            setBirthDate={setBirthDate}
            phoneNum={phoneNum}
            setPhoneNum={setPhoneNum}
            major={major}
            setMajor={setMajor}
            school={school}
            setSchool={setSchool}
            siblingsCount={siblingsCount}
            setSiblingsCount={setSiblingsCount}
            isDatePickerVisible={isDatePickerVisible}
            showDatePicker={showDatePicker}
            hideDatePicker={hideDatePicker}
            handleConfirm={handleConfirm}
          />
        );

      case 2:
        return (
          <AddressStep
            provinces={provinces}
            districts={districts}
            subDistricts={subDistricts}
            permDistricts={permDistricts}
            permSubDistricts={permSubDistricts}
            addressLoading={addressLoading}
            addressError={addressError}
            currentAddress={currentAddress}
            permAddress={permAddress}
            updateCurrentAddress={updateCurrentAddress}
            updatePermAddress={updatePermAddress}
            handleProvinceChange={handleProvinceChange}
            handleDistrictChange={handleDistrictChange}
            handleSubDistrictChange={handleSubDistrictChange}
            resetAddressSelection={resetAddressSelection}
            setCurrentAddress={setCurrentAddress}
            setDistricts={setDistricts}
            setSubDistricts={setSubDistricts}
          />
        );

      case 3:
        return (
          <ParentInfoStep
            personData={fatherInfo}
            updatePersonFunction={updateFatherInfo}
            updateAddressFunction={updateFatherAddress}
            title="ข้อมูลบิดา"
            type="father"
            isDatePickerVisible={isFatherDatePickerVisible}
            showDatePicker={showFatherDatePicker}
            hideDatePicker={hideFatherDatePicker}
            handleConfirm={handleFatherConfirm}
            provinces={provinces}
            districts={districts}
            subDistricts={subDistricts}
            addressLoading={addressLoading}
            addressError={addressError}
            handleProvinceChange={handleProvinceChange}
            handleDistrictChange={handleDistrictChange}
            handleSubDistrictChange={handleSubDistrictChange}
            resetAddressSelection={resetAddressSelection}
            copyPermToCurrent={copyPermToCurrent}
            setPersonInfo={setFatherInfo}
          />
        );

      case 4:
        return (
          <ParentInfoStep
            personData={motherInfo}
            updatePersonFunction={updateMotherInfo}
            updateAddressFunction={updateMotherAddress}
            title="ข้อมูลมารดา"
            type="mother"
            isDatePickerVisible={isMotherDatePickerVisible}
            showDatePicker={showMotherDatePicker}
            hideDatePicker={hideMotherDatePicker}
            handleConfirm={handleMotherConfirm}
            provinces={provinces}
            districts={districts}
            subDistricts={subDistricts}
            addressLoading={addressLoading}
            addressError={addressError}
            handleProvinceChange={handleProvinceChange}
            handleDistrictChange={handleDistrictChange}
            handleSubDistrictChange={handleSubDistrictChange}
            resetAddressSelection={resetAddressSelection}
            copyPermToCurrent={copyPermToCurrent}
            setPersonInfo={setMotherInfo}
          />
        );

      case 5:
        return (
          <GuardianInfoStep
            guardianInfo={guardianInfo}
            updateGuardianInfo={updateGuardianInfo}
            updateGuardianAddress={updateGuardianAddress}
            isDatePickerVisible={isGuardianDatePickerVisible}
            showDatePicker={showGuardianDatePicker}
            hideDatePicker={hideGuardianDatePicker}
            handleConfirm={handleGuardianConfirm}
            provinces={provinces}
            districts={districts}
            subDistricts={subDistricts}
            addressLoading={addressLoading}
            addressError={addressError}
            handleProvinceChange={handleProvinceChange}
            handleDistrictChange={handleDistrictChange}
            handleSubDistrictChange={handleSubDistrictChange}
            resetAddressSelection={resetAddressSelection}
            copyPermToCurrent={copyPermToCurrent}
            setGuardianInfo={setGuardianInfo}
          />
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>ลงทะเบียน</Text>
          <Text style={styles.subtitle}>กรุณากรอกข้อมูลให้ครบถ้วน</Text>
        </View>

        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          {[1, 2, 3, 4, 5].map((step) => (
            <View key={step} style={styles.progressWrapper}>
              <View
                style={[
                  styles.progressStep,
                  currentStep >= step && styles.activeStep,
                ]}
              >
                {currentStep > step ? (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : (
                  <Text style={styles.progressText}>{step}</Text>
                )}
              </View>
              {step < 5 && (
                <View
                  style={[
                    styles.progressLine,
                    currentStep > step && styles.progressLineActive,
                  ]}
                />
              )}
            </View>
          ))}
        </View>

        <View style={styles.stepTitleContainer}>
          <Text style={styles.stepTitle}>
            {currentStep === 1 && "ขั้นตอนที่ 1: ข้อมูลพื้นฐาน"}
            {currentStep === 2 && "ขั้นตอนที่ 2: ที่อยู่"}
            {currentStep === 3 && "ขั้นตอนที่ 3: ข้อมูลบิดา"}
            {currentStep === 4 && "ขั้นตอนที่ 4: ข้อมูลมารดา"}
            {currentStep === 5 && "ขั้นตอนที่ 5: ข้อมูลผู้ปกครอง"}
          </Text>
        </View>

        {renderStep()}

        {/* Navigation buttons */}
        <View style={styles.buttonContainer}>
          {currentStep > 1 && (
            <TouchableOpacity
              style={[styles.navButton, styles.prevButton]}
              onPress={() => setCurrentStep(currentStep - 1)}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color="#666"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.prevButtonText}>ก่อนหน้า</Text>
            </TouchableOpacity>
          )}

          {currentStep < 5 ? (
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.nextButton,
                currentStep === 1 && styles.fullWidth,
              ]}
              onPress={() => setCurrentStep(currentStep + 1)}
            >
              <Text style={styles.nextButtonText}>ถัดไป</Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color="#fff"
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navButton, styles.submitButton]}
              onPress={handleSignUpPress}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color="#fff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.submitButtonText}>ลงทะเบียน</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Login link */}
        <TouchableOpacity
          style={styles.loginContainer}
          onPress={() => navigation.navigate("LoginScreen")}
        >
          <Text style={styles.loginText}>
            มีบัญชีแล้ว? <Text style={styles.loginLink}>เข้าสู่ระบบ</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SignUpScreen;
