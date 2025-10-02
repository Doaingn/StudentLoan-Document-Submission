import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./database/firebase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setGeneralError("");
    let tempErrors = {};

    // Validation
    if (!email.trim()) {
      tempErrors.email = "กรุณากรอกอีเมล";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      tempErrors.email = "รูปแบบอีเมลไม่ถูกต้อง";
    }

    if (!password) {
      tempErrors.password = "กรุณากรอกรหัสผ่าน";
    } else if (password.length < 6) {
      tempErrors.password = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
    }

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    setLoading(true);

    try {
      // เข้าสู่ระบบด้วย Firebase Authentication
      const userCredential = await login(email, password);

      // ตรวจสอบ Role ของผู้ใช้จาก Firestore
      const userDoc = await getDoc(
        doc(db, "users_officer", userCredential.user.uid)
      );

      if (!userDoc.exists()) {
        // ถ้าไม่มีข้อมูลใน Firestore
        setGeneralError("ไม่พบข้อมูลผู้ใช้งานในระบบ");
        // Logout ผู้ใช้ออก
        await userCredential.user.auth.signOut();
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      const userRole = userData.role;

      // ตรวจสอบว่า Role เป็น admin หรือ superadmin เท่านั้น
      if (userRole !== "admin" && userRole !== "superadmin") {
        setGeneralError("คุณไม่มีสิทธิ์เข้าถึงระบบนี้");
        // Logout ผู้ใช้ออก
        await userCredential.user.auth.signOut();
        setLoading(false);
        return;
      }

      // ถ้า Role ถูกต้อง ให้เข้าสู่ระบบ
      navigate("/");
    } catch (err) {
      console.error(err);

      // จัดการ error messages
      switch (err.code) {
        case "auth/user-not-found":
          setGeneralError("ไม่พบผู้ใช้งานนี้ในระบบ");
          break;
        case "auth/wrong-password":
          setGeneralError("รหัสผ่านไม่ถูกต้อง");
          break;
        case "auth/invalid-email":
          setGeneralError("รูปแบบอีเมลไม่ถูกต้อง");
          break;
        case "auth/user-disabled":
          setGeneralError("บัญชีนี้ถูกระงับการใช้งาน");
          break;
        case "auth/too-many-requests":
          setGeneralError(
            "มีการพยายามเข้าสู่ระบบมากเกินไป กรุณาลองใหม่ภายหลัง"
          );
          break;
        case "auth/invalid-credential":
          setGeneralError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
          break;
        default:
          setGeneralError("เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.loginBox}>
        <div style={styles.logoContainer}>
          <h1 style={styles.header}>เข้าสู่ระบบ</h1>
        </div>

        {generalError && <div style={styles.errorBox}>{generalError}</div>}

        <div style={styles.field}>
          <label style={styles.label}>อีเมล:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            placeholder="กรอกอีเมล"
            disabled={loading}
          />
          {errors.email && <div style={styles.errorMsg}>{errors.email}</div>}
        </div>

        <div style={styles.field}>
          <label style={styles.label}>รหัสผ่าน:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            placeholder="กรอกรหัสผ่าน"
            disabled={loading}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handleSubmit(e);
              }
            }}
          />
          {errors.password && (
            <div style={styles.errorMsg}>{errors.password}</div>
          )}
        </div>

        <button
          type="button"
          style={{
            ...styles.button,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 800,
    margin: "0 auto",
    padding: 20,
    fontFamily: "'Kanit', sans-serif",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
  },
  loginBox: {
    width: "100%",
    maxWidth: 450,
    padding: 40,
    backgroundColor: "#fff",
    borderRadius: 20,
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
  },
  logoContainer: {
    textAlign: "center",
    marginBottom: 30,
  },
  logo: {
    fontSize: 60,
    marginBottom: 10,
  },
  header: {
    textAlign: "center",
    marginBottom: 10,
    color: "#1e293b",
    fontSize: 32,
    fontWeight: 700,
  },
  roleInfo: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 14,
    fontWeight: 500,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    display: "block",
    marginBottom: 8,
    fontWeight: 600,
    color: "#475569",
    fontSize: 14,
  },
  input: {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    border: "2px solid #e2e8f0",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    fontSize: 16,
    transition: "all 0.3s ease",
  },
  button: {
    padding: "14px 24px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 600,
    transition: "0.3s",
    width: "100%",
    marginTop: 10,
    boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
  },
  errorMsg: {
    color: "#ef4444",
    marginTop: 6,
    fontSize: 13,
    fontWeight: 500,
  },
  errorBox: {
    color: "#ef4444",
    marginBottom: 20,
    padding: 14,
    backgroundColor: "#fee2e2",
    border: "2px solid #fecaca",
    borderRadius: 10,
    textAlign: "center",
    fontWeight: 600,
    fontSize: 14,
  },
};
