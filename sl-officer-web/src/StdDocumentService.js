import React, { useState, useEffect, useCallback } from "react";
import { db } from "./database/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion
} from "firebase/firestore";

// Document สำหรับเก็บประวัติปีการศึกษาและเทอมที่เคยมีการตั้งค่า
const PERIODS_HISTORY_PATH = ["DocumentService", "submission_periods_history"];

const logAcademicPeriod = async (year, term) => {
  try {
    const [collectionName, docId] = PERIODS_HISTORY_PATH;
    const periodsRef = doc(db, collectionName, docId);

    await setDoc(periodsRef, { 
      availableYears: arrayUnion(year.toString()),
      availableTerms: arrayUnion(term.toString()),
    }, { merge: true }); // merge: true จะยังคง Array เดิมไว้และเพิ่มค่าใหม่เข้าไป

    console.log(`Period ${year}/${term} logged to history successfully.`);
  } catch (error) {
    // บันทึก Error เพื่อตรวจสอบใน Console
    console.error("Error logging academic period (History):", error); 
  }
};

const StdDocumentService = () => {
  const [config, setConfig] = useState({
    academicYear: "2567",
    term: "1",
    isEnabled: false,
    immediateAccess: false,
    startDate: "2025-09-06",
    startTime: "23:59",
    endDate: "2025-09-30",
    endTime: "23:59",
    lastUpdated: null,
  });
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");

  // สร้าง styles object
  const styles = {
    container: {
      padding: 20,
      fontFamily: "Arial, sans-serif",
      backgroundColor: "#f8f9fa",
      minHeight: "100vh",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
      flexWrap: "wrap",
      gap: "15px",
    },
    title: {
      color: "#333",
      margin: 0,
      marginBottom: 5,
      fontSize: 24,
      fontWeight: "bold",
    },
    currentTime: {
      color: "#666",
      fontSize: 14,
      marginBottom: 5,
    },
    systemStatus: {
      color: "#333",
      fontSize: 16,
      fontWeight: "bold",
      marginBottom: 20,
    },
    systemToggleButton: {
      color: "white",
      border: "none",
      padding: "12px 24px",
      borderRadius: 8,
      cursor: "pointer",
      fontSize: 16,
      fontWeight: "bold",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      transition: "all 0.3s ease",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      marginBottom: 20,
    },
    section: {
      marginBottom: 25,
      padding: 15,
      backgroundColor: "#ffffff",
      borderRadius: 8,
      border: "1px solid #e9ecef",
      boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    },
    sectionTitle: {
      marginTop: 0,
      marginBottom: 15,
      color: "#495057",
      fontSize: 18,
      fontWeight: "bold",
    },
    formRow: {
      display: "flex",
      gap: 15,
      marginBottom: 15,
      flexWrap: "wrap",
    },
    field: {
      flex: 1,
      marginBottom: 15,
      minWidth: 250,
    },
    label: {
      display: "block",
      marginBottom: 8,
      fontWeight: "bold",
      color: "#333",
    },
    input: {
      width: "100%",
      padding: 12,
      border: "2px solid #ddd",
      borderRadius: 8,
      fontSize: 14,
      transition: "border-color 0.3s ease",
      boxSizing: "border-box",
    },
    saveButton: {
      backgroundColor: "#007bff",
      color: "white",
      border: "none",
      padding: "12px 24px",
      borderRadius: 8,
      cursor: "pointer",
      fontSize: 16,
      fontWeight: "bold",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      transition: "all 0.3s ease",
    },
    toggleContainer: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 15,
    },
    switchLabel: {
      fontSize: 16,
      fontWeight: "bold",
      color: "#333",
      display: "flex",
      alignItems: "center",
      gap: 8,
      cursor: "pointer",
    },
    statusIndicator: {
      padding: "8px 16px",
      borderRadius: 20,
      fontSize: 14,
      fontWeight: "bold",
      display: "inline-block",
      marginLeft: 10,
    },
    loading: {
      fontSize: 18,
      color: "#666",
      textAlign: "center",
      marginTop: 50,
    },
    checkbox: {
      margin: 0,
      transform: "scale(1.2)",
    },
  };

  // อัพเดทเวลาปัจจุบันทุกวินาที
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const bangkokTime = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
      );
      setCurrentTime(
        bangkokTime.toLocaleString("th-TH", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // โหลดข้อมูล config จาก Firebase
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const docRef = doc(db, "DocumentService", "config");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig({
          academicYear: data.academicYear || "2567",
          term: data.term || "1",
          isEnabled: data.isEnabled || false,
          immediateAccess: data.immediateAccess || false,
          startDate: data.startDate || "2025-09-06",
          startTime: data.startTime || "23:59",
          endDate: data.endDate || "2025-09-30",
          endTime: data.endTime || "23:59",
          lastUpdated: data.lastUpdated,
        });
      } else {
        // สร้างเอกสารใหม่ถ้าไม่มี
        const defaultConfig = {
          academicYear: "2567",
          term: "1",
          isEnabled: false,
          immediateAccess: false,
          startDate: "2025-09-06",
          startTime: "23:59",
          endDate: "2025-09-30",
          endTime: "23:59",
          lastUpdated: serverTimestamp(),
        };
        await setDoc(docRef, defaultConfig);
        setConfig(defaultConfig);
      }
    } catch (error) {
      console.error("Error loading config:", error);
      alert("ข้อผิดพลาด: ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, []);

  // โหลดข้อมูล config จาก Firebase
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // ฟังก์ชันสำหรับ toggle ระบบ
  const handleToggleSystem = useCallback(
    async (newValue, isAutomatic = false) => {
      const action = newValue ? "เปิด" : "ปิด";

      if (!isAutomatic) {
        const confirmed = window.confirm(`คุณต้องการ${action}ระบบหรือไม่?`);

        if (confirmed) {
          try {
            const newConfig = {
              ...config,
              isEnabled: newValue,
              immediateAccess: newValue,
              lastUpdated: serverTimestamp(),
            };

            const docRef = doc(db, "DocumentService", "config");
            await updateDoc(docRef, newConfig);
            setConfig(newConfig);

            alert(`${action}ระบบเรียบร้อย`);
          } catch (error) {
            console.error("Error toggling system:", error);
            alert("ข้อผิดพลาด: ไม่สามารถเปลี่ยนสถานะระบบได้");
          }
        }
      } else {
        // ปิดอัตโนมัติ
        try {
          const newConfig = {
            ...config,
            isEnabled: false,
            immediateAccess: false,
            lastUpdated: serverTimestamp(),
          };

          const docRef = doc(db, "DocumentService", "config");
          await updateDoc(docRef, newConfig);
          setConfig(newConfig);

          alert("แจ้งเตือน: ระบบได้ปิดอัตโนมัติตามเวลาที่กำหนด");
        } catch (error) {
          console.error("Error auto-disabling system:", error);
        }
      }
    },
    [config]
  );

  // ตรวจสอบเวลาทุกนาทีเพื่อปิดระบบอัตโนมัติ
  useEffect(() => {
    const checkAutoDisable = () => {
      if (!config.isEnabled || config.immediateAccess) return;

      const now = new Date();
      const bangkokTime = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
      );
      const endDateTime = new Date(`${config.endDate}T${config.endTime}:00`);

      if (bangkokTime >= endDateTime) {
        handleToggleSystem(false, true); // ปิดระบบอัตโนมัติ
      }
    };

    const interval = setInterval(checkAutoDisable, 60000); // ตรวจสอบทุกนาที
    return () => clearInterval(interval);
  }, [config, handleToggleSystem]);

  const saveConfig = async () => {
    try {
      // 1. การทำงานเดิม: บันทึกการตั้งค่าปัจจุบัน
      const docRef = doc(db, "DocumentService", "config");
      const configToSave = {
        ...config, 
        lastUpdated: serverTimestamp(),
      };

      await updateDoc(docRef, configToSave);
      
      // 2. การทำงานใหม่: บันทึกปีการศึกษาและเทอมลงในทะเบียนประวัติ
      // ตรวจสอบว่ามีข้อมูลปีและเทอมก่อนบันทึก
      if (configToSave.academicYear && configToSave.term) {
          await logAcademicPeriod(configToSave.academicYear, configToSave.term);
      }
      
      alert("บันทึกการตั้งค่าเรียบร้อย");
    } catch (error) {
      console.error("Error saving config:", error);
      alert("ข้อผิดพลาด: ไม่สามารถบันทึกข้อมูลได้");
    }
};

  const getSystemStatus = () => {
    if (!config.isEnabled) {
      return { status: "ปิดใช้งาน", color: "#dc3545", bgColor: "#f8d7da" };
    }

    if (config.immediateAccess) {
      return {
        status: "เปิดใช้งาน (ทันที)",
        color: "#28a745",
        bgColor: "#d4edda",
      };
    }

    const now = new Date();
    const bangkokTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
    );
    const startDateTime = new Date(
      `${config.startDate}T${config.startTime}:00`
    );
    const endDateTime = new Date(`${config.endDate}T${config.endTime}:00`);

    if (bangkokTime < startDateTime) {
      return { status: "รอเปิดใช้งาน", color: "#ffc107", bgColor: "#fff3cd" };
    } else if (bangkokTime >= startDateTime && bangkokTime <= endDateTime) {
      return {
        status: "เปิดใช้งาน (ตามเวลา)",
        color: "#28a745",
        bgColor: "#d4edda",
      };
    } else {
      return { status: "หมดเวลาใช้งาน", color: "#dc3545", bgColor: "#f8d7da" };
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>กำลังโหลดข้อมูล...</div>
      </div>
    );
  }

  const systemStatus = getSystemStatus();

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>จัดการระบบเอกสารนักศึกษา</h1>
          <div style={styles.currentTime}>เวลาปัจจุบัน: {currentTime}</div>
        </div>
      </div>

      {/* System Status */}
      <div style={styles.systemStatus}>
        สถานะระบบ:
        <span
          style={{
            ...styles.statusIndicator,
            color: systemStatus.color,
            backgroundColor: systemStatus.bgColor,
          }}
        >
          {systemStatus.status}
        </span>
      </div>

      {/* Quick Toggle */}
      <button
        style={{
          ...styles.systemToggleButton,
          backgroundColor: config.isEnabled ? "#dc3545" : "#28a745",
        }}
        onClick={() => handleToggleSystem(!config.isEnabled)}
      >
        {config.isEnabled ? "ปิดระบบทันที" : " เปิดระบบทันที"}
      </button>

      {/* Basic Settings */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>ข้อมูลพื้นฐาน</h3>
        <div style={styles.formRow}>
          <div style={styles.field}>
            <label style={styles.label}>ปีการศึกษา</label>
            <input
              style={styles.input}
              type="text"
              value={config.academicYear}
              onChange={(e) =>
                setConfig({ ...config, academicYear: e.target.value })
              }
              placeholder="เช่น 2567"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>เทอม</label>
            <input
              style={styles.input}
              type="text"
              value={config.term}
              onChange={(e) => setConfig({ ...config, term: e.target.value })}
              placeholder="เช่น 1"
            />
          </div>
        </div>
      </div>

      {/* System Control */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>การควบคุมระบบ</h3>

        <div style={styles.toggleContainer}>
          <label style={styles.switchLabel}>
            <input
              type="checkbox"
              checked={config.isEnabled}
              onChange={(e) =>
                setConfig({ ...config, isEnabled: e.target.checked })
              }
              style={styles.checkbox}
            />
            เปิดใช้งานระบบ
          </label>
        </div>

        <div style={styles.toggleContainer}>
          <label
            style={{
              ...styles.switchLabel,
              color: config.isEnabled ? "#333" : "#999",
            }}
          >
            <input
              type="checkbox"
              checked={config.immediateAccess}
              onChange={(e) =>
                setConfig({ ...config, immediateAccess: e.target.checked })
              }
              disabled={!config.isEnabled}
              style={styles.checkbox}
            />
            เข้าใช้งานได้ทันที (ไม่จำกัดเวลา)
          </label>
        </div>
      </div>

      {/* Time Settings */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>ตั้งเวลาเปิด-ปิดระบบ</h3>

        <div style={styles.formRow}>
          <div style={styles.field}>
            <label style={styles.label}>วันที่เริ่ม</label>
            <input
              style={{
                ...styles.input,
                opacity: config.immediateAccess ? 0.5 : 1,
              }}
              type="date"
              value={config.startDate}
              onChange={(e) =>
                setConfig({ ...config, startDate: e.target.value })
              }
              disabled={config.immediateAccess}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>เวลาเริ่ม</label>
            <input
              style={{
                ...styles.input,
                opacity: config.immediateAccess ? 0.5 : 1,
              }}
              type="time"
              value={config.startTime}
              onChange={(e) =>
                setConfig({ ...config, startTime: e.target.value })
              }
              disabled={config.immediateAccess}
            />
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.field}>
            <label style={styles.label}>วันที่สิ้นสุด</label>
            <input
              style={{
                ...styles.input,
                opacity: config.immediateAccess ? 0.5 : 1,
              }}
              type="date"
              value={config.endDate}
              onChange={(e) =>
                setConfig({ ...config, endDate: e.target.value })
              }
              disabled={config.immediateAccess}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>เวลาสิ้นสุด</label>
            <input
              style={{
                ...styles.input,
                opacity: config.immediateAccess ? 0.5 : 1,
              }}
              type="time"
              value={config.endTime}
              onChange={(e) =>
                setConfig({ ...config, endTime: e.target.value })
              }
              disabled={config.immediateAccess}
            />
          </div>
        </div>

        {!config.immediateAccess && (
          <div
            style={{
              fontSize: 12,
              color: "#666",
              fontStyle: "italic",
              marginTop: 5,
            }}
          >
            * ระบบจะปิดอัตโนมัติเมื่อถึงเวลาสิ้นสุด (เขตเวลา: Asia/Bangkok)
          </div>
        )}
      </div>

      {/* Save Button */}
      <button style={styles.saveButton} onClick={saveConfig}>
        บันทึก
      </button>

      {config.lastUpdated && (
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#666",
            marginTop: 15,
            marginBottom: 20,
          }}
        >
          อัพเดทล่าสุด:{" "}
          {config.lastUpdated.seconds
            ? new Date(config.lastUpdated.seconds * 1000).toLocaleString(
                "th-TH"
              )
            : "ไม่ทราบ"}
        </div>
      )}
    </div>
  );
};

export default StdDocumentService;
