import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  StatusBar,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { auth } from "../../database/firebase";

const ChangePassword = ({ navigation }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successAnimation] = useState(new Animated.Value(0));

  // Password validation
  const validatePassword = (password) => {
    const minLength = password.length >= 6;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);

    return {
      minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      isValid: minLength && hasUpperCase && hasLowerCase && hasNumbers,
    };
  };

  const passwordValidation = validatePassword(newPassword);

  const showSuccessAnimation = () => {
    Animated.sequence([
      Animated.timing(successAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(successAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("ข้อผิดพลาด", "กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("ข้อผิดพลาด", "รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    if (!passwordValidation.isValid) {
      Alert.alert(
        "รหัสผ่านไม่ปลอดภัย",
        "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร และประกอบด้วยตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข"
      );
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert("ข้อผิดพลาด", "รหัสผ่านใหม่ต้องแตกต่างจากรหัสผ่านปัจจุบัน");
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        Alert.alert("ข้อผิดพลาด", "ไม่พบข้อมูลผู้ใช้");
        return;
      }

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      // Show success animation
      showSuccessAnimation();

      // Reset form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        Alert.alert("สำเร็จ", "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว", [
          {
            text: "ตกลง",
            onPress: () => navigation.goBack(),
          },
        ]);
      }, 2300);
    } catch (error) {
      console.error("Change password error:", error);

      let errorMessage = "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน";

      if (error.code === "auth/wrong-password") {
        errorMessage = "รหัสผ่านปัจจุบันไม่ถูกต้อง";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "รหัสผ่านใหม่ไม่ปลอดภัยเพียงพอ";
      } else if (error.code === "auth/requires-recent-login") {
        errorMessage = "กรุณาเข้าสู่ระบบใหม่ก่อนเปลี่ยนรหัสผ่าน";
      }

      Alert.alert("ข้อผิดพลาด", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderPasswordInput = (
    label,
    value,
    onChangeText,
    placeholder,
    showPassword,
    setShowPassword,
    icon
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.passwordInputContainer}>
        <View style={styles.inputIconContainer}>
          <Ionicons name={icon} size={16} color="blue" />
        </View>
        <TextInput
          style={styles.passwordInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={() => setShowPassword(!showPassword)}
        >
          <Ionicons
            name={showPassword ? "eye-outline" : "eye-off-outline"}
            size={16}
            color="#blue"
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderValidationItem = (isValid, text) => (
    <View style={styles.validationItem}>
      <Ionicons
        name={isValid ? "checkmark-circle" : "ellipse-outline"}
        size={16}
        color={isValid ? "#10B981" : "#9CA3AF"}
      />
      <Text
        style={[
          styles.validationText,
          isValid ? styles.validText : styles.invalidText,
        ]}
      >
        {text}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2563eb" />

      {/* Success Animation Overlay */}
      <Animated.View
        style={[styles.successOverlay, { opacity: successAnimation }]}
        pointerEvents="none"
      >
        <View style={styles.successIndicator}>
          <Text style={styles.successText}>เปลี่ยนรหัสผ่านสำเร็จ</Text>
        </View>
      </Animated.View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Info Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons name="shield-checkmark" size={24} color="#2563eb" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>ความปลอดภัยของบัญชี</Text>
              <Text style={styles.infoDescription}>
                ควรเปลี่ยนรหัสให้คาดเดายยาก และไม่ใช้รหัสผ่านเดียวกับที่อื่นๆ
              </Text>
            </View>
          </View>

          {/* Password Form */}
          <View style={styles.formCard}>
            {renderPasswordInput(
              "รหัสผ่านปัจจุบัน",
              currentPassword,
              setCurrentPassword,
              "กรอกรหัสผ่านปัจจุบัน",
              showCurrentPassword,
              setShowCurrentPassword,
              "lock-closed-outline"
            )}

            {renderPasswordInput(
              "รหัสผ่านใหม่",
              newPassword,
              setNewPassword,
              "กรอกรหัสผ่านใหม่",
              showNewPassword,
              setShowNewPassword,
              "key-outline"
            )}

            {renderPasswordInput(
              "ยืนยันรหัสผ่านใหม่",
              confirmPassword,
              setConfirmPassword,
              "ยืนยันรหัสผ่านใหม่",
              showConfirmPassword,
              setShowConfirmPassword,
              "key-outline"
            )}

            {/* Password Validation */}
            {newPassword.length > 0 && (
              <View style={styles.validationContainer}>
                <Text style={styles.validationTitle}>
                  ความแข็งแกร่งของรหัสผ่าน:
                </Text>
                <View style={styles.validationList}>
                  {renderValidationItem(
                    passwordValidation.minLength,
                    "ความยาวอย่างน้อย 6 ตัวอักษร"
                  )}
                  {renderValidationItem(
                    passwordValidation.hasUpperCase,
                    "มีตัวพิมพ์ใหญ่"
                  )}
                  {renderValidationItem(
                    passwordValidation.hasLowerCase,
                    "มีตัวพิมพ์เล็ก"
                  )}
                  {renderValidationItem(
                    passwordValidation.hasNumbers,
                    "มีตัวเลข"
                  )}
                </View>

                {/* Password Strength Indicator */}
                <View style={styles.strengthContainer}>
                  <Text style={styles.strengthLabel}>ระดับความปลอดภัย:</Text>
                  <View style={styles.strengthBarContainer}>
                    <View
                      style={[
                        styles.strengthBar,
                        {
                          width: `${
                            (Object.values(passwordValidation).filter(Boolean)
                              .length -
                              1) *
                            25
                          }%`,
                          backgroundColor:
                            Object.values(passwordValidation).filter(Boolean)
                              .length -
                              1 <=
                            1
                              ? "#EF4444"
                              : Object.values(passwordValidation).filter(
                                  Boolean
                                ).length -
                                  1 <=
                                2
                              ? "#F59E0B"
                              : Object.values(passwordValidation).filter(
                                  Boolean
                                ).length -
                                  1 <=
                                3
                              ? "#10B981"
                              : "#059669",
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Confirm Password Match Indicator */}
            {confirmPassword.length > 0 && (
              <View style={styles.matchContainer}>
                <Ionicons
                  name={
                    newPassword === confirmPassword
                      ? "checkmark-circle"
                      : "close-circle"
                  }
                  size={16}
                  color={
                    newPassword === confirmPassword ? "#10B981" : "#EF4444"
                  }
                />
                <Text
                  style={[
                    styles.matchText,
                    {
                      color:
                        newPassword === confirmPassword ? "#10B981" : "#EF4444",
                    },
                  ]}
                >
                  {newPassword === confirmPassword
                    ? "รหัสผ่านตรงกัน"
                    : "รหัสผ่านไม่ตรงกัน"}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Change Password Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.changeButton,
              (!passwordValidation.isValid ||
                newPassword !== confirmPassword ||
                !currentPassword ||
                loading) &&
                styles.disabledButton,
            ]}
            onPress={handleChangePassword}
            disabled={
              !passwordValidation.isValid ||
              newPassword !== confirmPassword ||
              !currentPassword ||
              loading
            }
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.buttonText}>กำลังเปลี่ยนรหัสผ่าน...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.buttonText}>เปลี่ยนรหัสผ่าน</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  header: {
    backgroundColor: "#2563eb",
    paddingTop: 44,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 6,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "white",
    flex: 1,
    textAlign: "center",
  },
  headerRight: {
    width: 40,
  },
  successOverlay: {
    position: "absolute",
    top: 110,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: "center",
  },
  successIndicator: {
    backgroundColor: "white",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    elevation: 12,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  successText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#10B981",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  infoCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputIconContainer: {
    marginRight: 12,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
    paddingVertical: 4,
  },
  eyeButton: {
    padding: 4,
    marginLeft: 8,
  },
  validationContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  validationTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  validationList: {
    gap: 8,
  },
  validationItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  validationText: {
    fontSize: 14,
    fontWeight: "500",
  },
  validText: {
    color: "#10B981",
  },
  invalidText: {
    color: "#9CA3AF",
  },
  strengthContainer: {
    marginTop: 16,
  },
  strengthLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
  },
  strengthBarContainer: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
  },
  strengthBar: {
    height: "100%",
    borderRadius: 3,
    transition: "width 0.3s ease",
  },
  matchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  matchText: {
    fontSize: 14,
    fontWeight: "500",
  },
  tipsCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 16,
  },
  tipsList: {
    gap: 12,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  tipText: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
    flex: 1,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  changeButton: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    elevation: 3,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  disabledButton: {
    backgroundColor: "#9CA3AF",
    elevation: 0,
    shadowOpacity: 0,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "white",
  },
});

export default ChangePassword;
