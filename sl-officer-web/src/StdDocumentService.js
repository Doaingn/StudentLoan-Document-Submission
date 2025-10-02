// StdDocumentService.js
import React, { useState, useEffect, useCallback } from "react";
import { db } from "./database/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import {
  FaCog,
  FaCalendarAlt,
  FaClock,
  FaPowerOff,
  FaSave,
  FaToggleOn,
  FaToggleOff,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaHistory,
} from "react-icons/fa";

// Document สำหรับเก็บประวัติปีการศึกษาและเทอมที่เคยมีการตั้งค่า
const PERIODS_HISTORY_PATH = ["DocumentService", "submission_periods_history"];

const logAcademicPeriod = async (year, term) => {
  try {
    const [collectionName, docId] = PERIODS_HISTORY_PATH;
    const periodsRef = doc(db, collectionName, docId);

    await setDoc(
      periodsRef,
      {
        availableYears: arrayUnion(year.toString()),
        availableTerms: arrayUnion(term.toString()),
      },
      { merge: true }
    );

    console.log(`Period ${year}/${term} logged to history successfully.`);
  } catch (error) {
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

  // สร้าง styles object ที่กะทัดรัดกว่า
  const styles = {
    container: {
      minHeight: "100vh",
      padding: "1.5rem",
      fontFamily: "'Kanit', sans-serif",
    },
    innerContainer: {
      maxWidth: "1000px",
      margin: "0 auto",
    },
    card: {
      background: "rgba(255, 255, 255, 0.95)",
      backdropFilter: "blur(10px)",
      borderRadius: "16px",
      padding: "1.5rem",
      marginBottom: "1.5rem",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "1.5rem",
      flexWrap: "wrap",
      gap: "1rem",
    },
    titleSection: {
      display: "flex",
      alignItems: "center",
      gap: "0.8rem",
    },
    title: {
      color: "#1e293b",
      margin: 0,
      fontSize: "1.8rem",
      fontWeight: "700",
    },
    titleIcon: {
      fontSize: "2rem",
      color: "#667eea",
    },
    currentTime: {
      color: "#64748b",
      fontSize: "0.9rem",
      fontWeight: "500",
      display: "flex",
      alignItems: "center",
      gap: "0.4rem",
    },
    systemStatusSection: {
      display: "flex",
      alignItems: "center",
      gap: "0.8rem",
      marginBottom: "1.5rem",
      padding: "1rem",
      background: "#f8fafc",
      borderRadius: "12px",
    },
    systemStatusLabel: {
      fontSize: "1rem",
      fontWeight: "600",
      color: "#374151",
    },
    statusBadge: {
      padding: "0.5rem 1rem",
      borderRadius: "20px",
      fontSize: "0.85rem",
      fontWeight: "600",
      display: "flex",
      alignItems: "center",
      gap: "0.4rem",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
    },
    systemToggleButton: {
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white",
      border: "none",
      padding: "0.8rem 1.5rem",
      borderRadius: "10px",
      cursor: "pointer",
      fontSize: "0.9rem",
      fontWeight: "600",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      transition: "all 0.3s ease",
      boxShadow: "0 3px 10px rgba(102, 126, 234, 0.3)",
      marginBottom: "1.5rem",
    },
    dangerButton: {
      background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
      color: "white",
      border: "none",
      padding: "0.8rem 1.5rem",
      borderRadius: "10px",
      cursor: "pointer",
      fontSize: "0.9rem",
      fontWeight: "600",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      transition: "all 0.3s ease",
      boxShadow: "0 3px 10px rgba(239, 68, 68, 0.3)",
      marginBottom: "1.5rem",
    },
    section: {
      marginBottom: "1.5rem",
    },
    sectionTitle: {
      display: "flex",
      alignItems: "center",
      gap: "0.6rem",
      marginTop: 0,
      marginBottom: "1rem",
      color: "#1e293b",
      fontSize: "1.2rem",
      fontWeight: "600",
    },
    sectionIcon: {
      color: "#667eea",
      fontSize: "1.3rem",
    },
    formRow: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
      gap: "1rem",
      marginBottom: "1rem",
    },
    field: {
      marginBottom: "1rem",
    },
    label: {
      display: "flex",
      alignItems: "center",
      gap: "0.4rem",
      marginBottom: "0.5rem",
      fontWeight: "500",
      color: "#374151",
      fontSize: "0.9rem",
    },
    labelIcon: {
      color: "#667eea",
      fontSize: "0.8rem",
    },
    input: {
      width: "100%",
      padding: "0.7rem 0.9rem",
      borderRadius: "8px",
      border: "2px solid #e2e8f0",
      fontSize: "0.85rem",
      fontWeight: "400",
      transition: "all 0.3s ease",
      background: "white",
    },
    saveButton: {
      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      color: "white",
      border: "none",
      padding: "0.8rem 1.8rem",
      borderRadius: "10px",
      cursor: "pointer",
      fontSize: "0.9rem",
      fontWeight: "600",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      transition: "all 0.3s ease",
      boxShadow: "0 3px 10px rgba(16, 185, 129, 0.3)",
      marginTop: "0.5rem",
    },
    toggleContainer: {
      display: "flex",
      alignItems: "center",
      gap: "0.8rem",
      marginBottom: "1rem",
      padding: "0.8rem",
      backgroundColor: "white",
      borderRadius: "8px",
      border: "2px solid #e2e8f0",
    },
    switchLabel: {
      fontSize: "0.9rem",
      fontWeight: "500",
      color: "#374151",
      display: "flex",
      alignItems: "center",
      gap: "0.8rem",
      cursor: "pointer",
      flex: 1,
    },
    toggleIcon: {
      fontSize: "1.2rem",
      color: "#667eea",
    },
    checkbox: {
      width: "16px",
      height: "16px",
      margin: 0,
      cursor: "pointer",
    },
    disabledSection: {
      opacity: 0.6,
      pointerEvents: "none",
    },
    noteText: {
      fontSize: "0.8rem",
      color: "#64748b",
      fontStyle: "italic",
      marginTop: "0.5rem",
      display: "flex",
      alignItems: "center",
      gap: "0.4rem",
    },
    lastUpdated: {
      textAlign: "center",
      fontSize: "0.8rem",
      color: "#64748b",
      marginTop: "1rem",
      padding: "0.8rem",
      backgroundColor: "#f1f5f9",
      borderRadius: "8px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "0.4rem",
    },
    loadingContainer: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "40vh",
    },
    spinner: {
      width: "40px",
      height: "40px",
      border: "4px solid #f3f3f3",
      borderTop: "4px solid #667eea",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
      marginBottom: "1rem",
    },
    loadingText: {
      fontSize: "1rem",
      color: "#64748b",
      fontWeight: "500",
    },
  };

  // เพิ่ม CSS animation
  const spinnerStyle = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .toggle-container:hover {
      border-color: #667eea;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
    }
    
    .save-btn:hover, .toggle-btn:hover, .danger-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    }
    
    @media (max-width: 768px) {
      .form-row {
        grid-template-columns: 1fr !important;
      }
      
      .header {
        flex-direction: column;
        align-items: flex-start;
      }
      
      .system-status-section {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }
    }
    
    @media (max-width: 480px) {
      .container {
        padding: 1rem !important;
      }
      
      .card {
        padding: 1rem !important;
      }
    }
  `;

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
      return {
        status: "ปิดใช้งาน",
        color: "#dc3545",
        bgColor: "#f8d7da",
        icon: <FaTimesCircle />,
      };
    }

    if (config.immediateAccess) {
      return {
        status: "เปิดใช้งาน (ทันที)",
        color: "#28a745",
        bgColor: "#d4edda",
        icon: <FaCheckCircle />,
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
      return {
        status: "รอเปิดใช้งาน",
        color: "#ffc107",
        bgColor: "#fff3cd",
        icon: <FaExclamationTriangle />,
      };
    } else if (bangkokTime >= startDateTime && bangkokTime <= endDateTime) {
      return {
        status: "เปิดใช้งาน (ตามเวลา)",
        color: "#28a745",
        bgColor: "#d4edda",
        icon: <FaCheckCircle />,
      };
    } else {
      return {
        status: "หมดเวลาใช้งาน",
        color: "#dc3545",
        bgColor: "#f8d7da",
        icon: <FaTimesCircle />,
      };
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <style>{spinnerStyle}</style>
        <div style={styles.innerContainer}>
          <div style={styles.card}>
            <div style={styles.loadingContainer}>
              <div style={styles.spinner}></div>
              <div style={styles.loadingText}>กำลังโหลดข้อมูล...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const systemStatus = getSystemStatus();

  return (
    <div style={styles.container}>
      <style>{spinnerStyle}</style>

      <div style={styles.innerContainer}>
        {/* Header Card */}
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.titleSection}>
              <FaCog style={styles.titleIcon} />
              <h1 style={styles.title}>จัดการระบบเอกสารนักศึกษา</h1>
            </div>
            <div style={styles.currentTime}>
              <FaClock /> เวลาปัจจุบัน: {currentTime}
            </div>
          </div>

          {/* System Status */}
          <div
            style={styles.systemStatusSection}
            className="system-status-section"
          >
            <div style={styles.systemStatusLabel}>สถานะระบบ:</div>
            <div
              style={{
                ...styles.statusBadge,
                color: systemStatus.color,
                backgroundColor: systemStatus.bgColor,
              }}
            >
              {systemStatus.icon}
              {systemStatus.status}
            </div>
          </div>

          {/* Quick Toggle */}
          {config.isEnabled ? (
            <button
              className="danger-btn"
              style={styles.dangerButton}
              onClick={() => handleToggleSystem(!config.isEnabled)}
            >
              <FaPowerOff /> ปิดระบบทันที
            </button>
          ) : (
            <button
              className="toggle-btn"
              style={styles.systemToggleButton}
              onClick={() => handleToggleSystem(!config.isEnabled)}
            >
              <FaPowerOff /> เปิดระบบทันที
            </button>
          )}
        </div>

        {/* Basic Settings Card */}
        <div style={styles.card}>
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <FaCalendarAlt style={styles.sectionIcon} />
              ข้อมูลพื้นฐาน
            </h3>
            <div style={styles.formRow} className="form-row">
              <div style={styles.field}>
                <label style={styles.label}>
                  <FaCalendarAlt style={styles.labelIcon} />
                  ปีการศึกษา
                </label>
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
                <label style={styles.label}>
                  <FaCalendarAlt style={styles.labelIcon} />
                  เทอม
                </label>
                <input
                  style={styles.input}
                  type="text"
                  value={config.term}
                  onChange={(e) =>
                    setConfig({ ...config, term: e.target.value })
                  }
                  placeholder="เช่น 1"
                />
              </div>
            </div>
          </div>

          {/* System Control Section */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <FaCog style={styles.sectionIcon} />
              การควบคุมระบบ
            </h3>

            <div style={styles.toggleContainer} className="toggle-container">
              <label style={styles.switchLabel}>
                {config.isEnabled ? (
                  <FaToggleOn
                    style={{ ...styles.toggleIcon, color: "#28a745" }}
                  />
                ) : (
                  <FaToggleOff style={styles.toggleIcon} />
                )}
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

            <div
              style={{
                ...styles.toggleContainer,
                ...(config.isEnabled ? {} : styles.disabledSection),
              }}
              className="toggle-container"
            >
              <label style={styles.switchLabel}>
                {config.immediateAccess ? (
                  <FaToggleOn
                    style={{ ...styles.toggleIcon, color: "#28a745" }}
                  />
                ) : (
                  <FaToggleOff style={styles.toggleIcon} />
                )}
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

          {/* Time Settings Section */}
          <div
            style={{
              ...styles.section,
              ...(config.immediateAccess ? styles.disabledSection : {}),
            }}
          >
            <h3 style={styles.sectionTitle}>
              <FaClock style={styles.sectionIcon} />
              ตั้งเวลาเปิด-ปิดระบบ
            </h3>

            <div style={styles.formRow} className="form-row">
              <div style={styles.field}>
                <label style={styles.label}>
                  <FaCalendarAlt style={styles.labelIcon} />
                  วันที่เริ่ม
                </label>
                <input
                  style={styles.input}
                  type="date"
                  value={config.startDate}
                  onChange={(e) =>
                    setConfig({ ...config, startDate: e.target.value })
                  }
                  disabled={config.immediateAccess}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>
                  <FaClock style={styles.labelIcon} />
                  เวลาเริ่ม
                </label>
                <input
                  style={styles.input}
                  type="time"
                  value={config.startTime}
                  onChange={(e) =>
                    setConfig({ ...config, startTime: e.target.value })
                  }
                  disabled={config.immediateAccess}
                />
              </div>
            </div>

            <div style={styles.formRow} className="form-row">
              <div style={styles.field}>
                <label style={styles.label}>
                  <FaCalendarAlt style={styles.labelIcon} />
                  วันที่สิ้นสุด
                </label>
                <input
                  style={styles.input}
                  type="date"
                  value={config.endDate}
                  onChange={(e) =>
                    setConfig({ ...config, endDate: e.target.value })
                  }
                  disabled={config.immediateAccess}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>
                  <FaClock style={styles.labelIcon} />
                  เวลาสิ้นสุด
                </label>
                <input
                  style={styles.input}
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
              <div style={styles.noteText}>
                <FaExclamationTriangle />* ระบบจะปิดอัตโนมัติเมื่อถึงเวลาสิ้นสุด
                (เขตเวลา: Asia/Bangkok)
              </div>
            )}
          </div>

          {/* Save Button */}
          <button
            className="save-btn"
            style={styles.saveButton}
            onClick={saveConfig}
          >
            <FaSave /> บันทึกการตั้งค่า
          </button>
        </div>

        {config.lastUpdated && (
          <div style={styles.lastUpdated}>
            <FaHistory />
            อัพเดทล่าสุด:{" "}
            {config.lastUpdated.seconds
              ? new Date(config.lastUpdated.seconds * 1000).toLocaleString(
                  "th-TH"
                )
              : "ไม่ทราบ"}
          </div>
        )}
      </div>
    </div>
  );
};

export default StdDocumentService;
