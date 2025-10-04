import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { Alert } from "react-native";

export const handleSignUp = async (
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
  navigation,
  auth,
  db
) => {
  // Basic validation
  if (
    !email ||
    !password ||
    !name ||
    !citizenId ||
    !studentId ||
    !birthDate ||
    !phoneNum
  ) {
    Alert.alert("กรุณากรอกข้อมูล", "โปรดกรอกข้อมูลพื้นฐานให้ครบถ้วน");
    return;
  }

  setIsLoading(true);

  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    const fatherIncome = parseInt(fatherInfo.income) || 0;
    const motherIncome = parseInt(motherInfo.income) || 0;
    const guardianIncome = parseInt(guardianInfo.income) || 0;

    // Prepare data for Firestore
    const userData = {
      citizen_id: citizenId,
      name: name,
      email: email,
      student_id: studentId,
      birth_date: birthDate,
      phone_num: phoneNum,
      major: major,
      school: school,
      siblings_count: parseInt(siblingsCount) || 0,
      address_current: currentAddress,
      address_perm: permAddress,
      father_info: {
        ...fatherInfo,
        income: fatherIncome,
      },
      mother_info: {
        ...motherInfo,
        income: motherIncome,
      },
      guardian_info: {
        ...guardianInfo,
        income: guardianIncome,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      profileComplete: true,
      status: "active",
    };

    await setDoc(doc(db, "users", user.uid), userData);

    Alert.alert(
      "สำเร็จ",
      "ลงทะเบียนเรียบร้อยแล้ว กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี",
      [
        {
          text: "ตกลง",
          onPress: () => navigation.navigate("MainTabs"),
        },
      ]
    );
  } catch (error) {
    console.error("Sign up error:", error);

    let errorMessage = "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";

    switch (error.code) {
      case "auth/invalid-email":
        errorMessage = "รูปแบบอีเมลไม่ถูกต้อง";
        break;
      case "auth/weak-password":
        errorMessage = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
        break;
      case "auth/email-already-in-use":
        errorMessage = "อีเมลนี้ถูกใช้งานแล้ว";
        break;
      case "auth/operation-not-allowed":
        errorMessage = "การลงทะเบียนด้วยอีเมล/รหัสผ่านถูกปิดใช้งานชั่วคราว";
        break;
      case "auth/network-request-failed":
        errorMessage = "ปัญหาการเชื่อมต่ออินเทอร์เน็ต โปรดลองอีกครั้ง";
        break;
      case "permission-denied":
        errorMessage = "ไม่มีสิทธิ์ในการบันทึกข้อมูล";
        break;
      default:
        errorMessage = error.message || "เกิดข้อผิดพลาดในการลงทะเบียน";
    }

    Alert.alert("การลงทะเบียนไม่สำเร็จ", errorMessage);
  } finally {
    setIsLoading(false);
  }
};

export const handleLogin = async (
  email,
  password,
  setIsLoading,
  navigation,
  auth
) => {
  if (!email || !password) {
    Alert.alert("กรุณากรอกข้อมูล", "โปรดกรอกอีเมลและรหัสผ่าน");
    return;
  }

  setIsLoading(true);

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    // Navigate to main app after successful login
    navigation.navigate("MainTabs");
  } catch (error) {
    console.error("Login error:", error);

    let errorMessage = "เกิดข้อผิดพลาดในการเข้าสู่ระบบ";

    switch (error.code) {
      case "auth/invalid-email":
        errorMessage = "รูปแบบอีเมลไม่ถูกต้อง";
        break;
      case "auth/user-disabled":
        errorMessage = "บัญชีผู้ใช้นี้ถูกปิดใช้งาน";
        break;
      case "auth/user-not-found":
        errorMessage = "ไม่พบบัญชีผู้ใช้ที่ตรงกับอีเมลนี้";
        break;
      case "auth/wrong-password":
        errorMessage = "รหัสผ่านไม่ถูกต้อง";
        break;
      case "auth/network-request-failed":
        errorMessage = "ปัญหาการเชื่อมต่ออินเทอร์เน็ต โปรดลองอีกครั้ง";
        break;
      default:
        errorMessage = error.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ";
    }

    Alert.alert("เข้าสู่ระบบไม่สำเร็จ", errorMessage);
  } finally {
    setIsLoading(false);
  }
};

export const handlePasswordReset = async (email, setIsLoading, auth) => {
  if (!email) {
    Alert.alert("กรุณากรอกอีเมล", "โปรดกรอกอีเมลเพื่อรีเซ็ตรหัสผ่าน");
    return;
  }

  setIsLoading(true);

  try {
    await sendPasswordResetEmail(auth, email);
    Alert.alert(
      "ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว",
      "กรุณาตรวจสอบอีเมลของคุณเพื่อรีเซ็ตรหัสผ่าน"
    );
  } catch (error) {
    console.error("Password reset error:", error);

    let errorMessage = "เกิดข้อผิดพลาดในการส่งอีเมลรีเซ็ตรหัสผ่าน";

    switch (error.code) {
      case "auth/invalid-email":
        errorMessage = "รูปแบบอีเมลไม่ถูกต้อง";
        break;
      case "auth/user-not-found":
        errorMessage = "ไม่พบบัญชีผู้ใช้ที่ตรงกับอีเมลนี้";
        break;
      case "auth/network-request-failed":
        errorMessage = "ปัญหาการเชื่อมต่ออินเทอร์เน็ต โปรดลองอีกครั้ง";
        break;
      default:
        errorMessage =
          error.message || "เกิดข้อผิดพลาดในการส่งอีเมลรีเซ็ตรหัสผ่าน";
    }

    Alert.alert("ส่งอีเมลไม่สำเร็จ", errorMessage);
  } finally {
    setIsLoading(false);
  }
};

export const handleUpdateProfile = async (
  userData,
  userId,
  setIsLoading,
  db
) => {
  if (!userData.name || !userData.email) {
    Alert.alert("กรุณากรอกข้อมูล", "โปรดกรอกชื่อและอีเมล");
    return;
  }

  setIsLoading(true);

  try {
    const updatedData = {
      ...userData,
      updatedAt: new Date(),
    };

    await setDoc(doc(db, "users", userId), updatedData, { merge: true });

    Alert.alert("สำเร็จ", "อัพเดทข้อมูลโปรไฟล์เรียบร้อยแล้ว");
    return true;
  } catch (error) {
    console.error("Update profile error:", error);
    Alert.alert("อัพเดทไม่สำเร็จ", "เกิดข้อผิดพลาดในการอัพเดทข้อมูลโปรไฟล์");
    return false;
  } finally {
    setIsLoading(false);
  }
};

export const handleLogout = async (setIsLoading, navigation, auth) => {
  setIsLoading(true);

  try {
    await auth.signOut();
    navigation.navigate("LoginScreen");
  } catch (error) {
    console.error("Logout error:", error);
    Alert.alert("ออกจากระบบไม่สำเร็จ", "เกิดข้อผิดพลาดในการออกจากระบบ");
  } finally {
    setIsLoading(false);
  }
};

export default {
  handleSignUp,
  handleLogin,
  handlePasswordReset,
  handleUpdateProfile,
  handleLogout,
};
