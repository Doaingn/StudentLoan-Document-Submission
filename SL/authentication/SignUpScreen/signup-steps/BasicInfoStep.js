import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { Ionicons } from "@expo/vector-icons";
import styles from "../signup-styles/styles";

const BasicInfoStep = ({
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

  // Date Picker
  isDatePickerVisible,
  showDatePicker,
  hideDatePicker,
  handleConfirm,
}) => {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>เลขบัตรประชาชน</Text>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="card-outline"
            size={20}
            color="#666"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="กรุณาป้อนเลขบัตรประชาชน"
            value={citizenId}
            onChangeText={setCitizenId}
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>รหัสนักศึกษา</Text>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="school-outline"
            size={20}
            color="#666"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="กรุณาป้อนรหัสนักศึกษา"
            value={studentId}
            onChangeText={setStudentId}
          />
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>ชื่อ-นามสกุล</Text>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="person-outline"
            size={20}
            color="#666"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="กรุณาป้อนชื่อ-นามสกุล"
            value={name}
            onChangeText={setName}
          />
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>วันเกิด</Text>
        <TouchableOpacity style={styles.inputWrapper} onPress={showDatePicker}>
          <Ionicons
            name="calendar-outline"
            size={20}
            color="#666"
            style={styles.inputIcon}
          />
          <Text style={[styles.dateText, !birthDate && styles.placeholderText]}>
            {birthDate
              ? birthDate.toDate().toLocaleDateString("th-TH")
              : "เลือกวันเกิด"}
          </Text>
        </TouchableOpacity>
      </View>

      {Platform.OS === "ios" ? (
        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          onConfirm={handleConfirm}
          onCancel={hideDatePicker}
          display="inline"
          locale="th-TH"
          maximumDate={new Date()}
          themeVariant="light"
          accentColor="#007AFF"
        />
      ) : (
        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          onConfirm={handleConfirm}
          onCancel={hideDatePicker}
          display="spinner"
          locale="th-TH"
          maximumDate={new Date()}
          themeVariant="light"
          textColor="#000000"
          accentColor="#007AFF"
        />
      )}

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>เบอร์โทรศัพท์</Text>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="call-outline"
            size={20}
            color="#666"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="กรุณาป้อนเบอร์โทรศัพท์"
            value={phoneNum}
            onChangeText={setPhoneNum}
            keyboardType="phone-pad"
          />
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>สำนัก</Text>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="business-outline"
            size={20}
            color="#666"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="กรุณาป้อนสำนัก"
            value={school}
            onChangeText={setSchool}
          />
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>สาขาวิชา</Text>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="book-outline"
            size={20}
            color="#666"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="กรุณาป้อนสาขาวิชา"
            value={major}
            onChangeText={setMajor}
          />
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>จำนวนพี่น้อง</Text>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="people-outline"
            size={20}
            color="#666"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="กรุณาป้อนจำนวนพี่น้องหากไม่มีให้ใส่ '0'"
            value={siblingsCount}
            onChangeText={setSiblingsCount}
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>อีเมล</Text>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="mail-outline"
            size={20}
            color="#666"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="กรุณาป้อนอีเมลหากไม่มีอีเมลให้ป้อน '-'"
            value={email}
            onChangeText={(text) => setEmail(text.trim())}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>รหัสผ่าน</Text>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color="#666"
            style={styles.inputIcon}
          />
          <TextInput
            style={[styles.input, { paddingRight: 50 }]}
            placeholder="กรุณาป้อนรหัสผ่าน (อย่างน้อย 6 ตัวอักษร)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.passwordToggle}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="#666"
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default BasicInfoStep;
