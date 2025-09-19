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
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "./database/firebase";

const ForgotPassword = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSendResetEmail = async () => {
    if (!email.trim()) {
      Alert.alert("ข้อผิดพลาด", "กรุณากรอกอีเมล");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("ข้อผิดพลาด", "รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setEmailSent(true);
      Alert.alert(
        "ส่งลิงก์เรียบร้อย",
        "กรุณาตรวจสอบอีเมลของคุณและคลิกลิงก์เพื่อรีเซ็ตรหัสผ่าน"
      );
    } catch (error) {
      console.error("Send reset email error:", error);

      let errorMessage = "เกิดข้อผิดพลาดในการส่งอีเมล";

      if (error.code === "auth/user-not-found") {
        errorMessage = "ไม่พบผู้ใช้ที่มีอีเมลนี้ในระบบ";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "รูปแบบอีเมลไม่ถูกต้อง";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "คำขอมากเกินไป กรุณาลองใหม่ภายหลัง";
      }

      Alert.alert("ข้อผิดพลาด", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setEmailSent(false);
    await handleSendResetEmail();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F1F5F9" />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {!emailSent ? (
            <>
              {/* Info Card */}
              <View style={styles.infoCard}>
                <View style={styles.infoIcon}>
                  <Ionicons name="mail-outline" size={32} color="#2563eb" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>ลืมรหัสผ่าน</Text>
                  <Text style={styles.infoDescription}>
                    กรอกอีเมลของคุณ เราจะส่งลิงก์สำหรับรีเซ็ตรหัสผ่านให้คุณ
                  </Text>
                </View>
              </View>

              {/* Email Form */}
              <View style={styles.formCard}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>อีเมล</Text>
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputIconContainer}>
                      <Ionicons name="mail-outline" size={20} color="#2563eb" />
                    </View>
                    <TextInput
                      style={styles.textInput}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="กรอกอีเมลของคุณ"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                    />
                  </View>
                </View>
              </View>

              {/* Send Button */}
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  (!email.trim() || loading) && styles.disabledButton,
                ]}
                onPress={handleSendResetEmail}
                disabled={!email.trim() || loading}
              >
                {loading ? (
                  <>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={styles.buttonText}>กำลังส่ง...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="send-outline" size={20} color="white" />
                    <Text style={styles.buttonText}>
                      ส่งลิงก์รีเซ็ตรหัสผ่าน
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Success Card */}
              <View style={styles.successCard}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={48} color="#10B981" />
                </View>
                <Text style={styles.successTitle}>ส่งลิงก์เรียบร้อยแล้ว!</Text>
                <Text style={styles.successDescription}>
                  เราได้ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปที่อีเมล
                </Text>
                <Text style={styles.emailText}>{email}</Text>
                <Text style={styles.successDescription}>
                  กรุณาตรวจสอบอีเมล (รวมถึงกล่องจดหมายขยะ)
                  และคลิกลิงก์เพื่อตั้งรหัสผ่านใหม่
                </Text>
              </View>
              {/* Resend Button */}
              <TouchableOpacity
                style={styles.resendButton}
                onPress={handleResendEmail}
              >
                <Ionicons name="refresh-outline" size={20} color="#2563eb" />
                <Text style={styles.resendButtonText}>ส่งลิงก์อีกครั้ง</Text>
              </TouchableOpacity>

              {/* Back to Login */}
              <TouchableOpacity
                style={styles.backToLoginButton}
                onPress={() => navigation.navigate("LoginScreen")}
              >
                <Text style={styles.backToLoginText}>
                  กลับไปหน้าเข้าสู่ระบบ
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    paddingTop: 50,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2563eb",
    marginLeft: 4,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 10,
  },
  infoCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  infoIcon: {
    marginBottom: 16,
  },
  infoContent: {
    alignItems: "center",
  },
  infoTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
    textAlign: "center",
  },
  infoDescription: {
    fontSize: 16,
    color: "#64748B",
    lineHeight: 24,
    textAlign: "center",
  },
  formCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  inputContainer: {
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  inputIconContainer: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
    paddingVertical: 0,
  },
  actionButton: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 18,
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
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "white",
    marginLeft: 4,
  },
  successCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    marginBottom: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 12,
    textAlign: "center",
  },
  successDescription: {
    fontSize: 16,
    color: "#64748B",
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 8,
  },
  emailText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2563eb",
    marginBottom: 12,
    textAlign: "center",
  },
  instructionsCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 16,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: "700",
    color: "white",
  },
  stepText: {
    fontSize: 16,
    color: "#374151",
    flex: 1,
  },
  resendButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  resendButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2563eb",
  },
  backToLoginButton: {
    paddingVertical: 16,
    alignItems: "center",
  },
  backToLoginText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#64748B",
    textDecorationLine: "underline",
  },
});

export default ForgotPassword;
