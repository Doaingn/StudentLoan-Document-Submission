import React, { useState, useEffect } from "react";
import { db } from "./database/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { useAuth } from "./AuthContext";
import {
  FaUserTie,
  FaPlus,
  FaEdit,
  FaTrash,
  FaSearch,
  FaSave,
  FaTimes,
  FaUserShield,
  FaUsers,
  FaEnvelope,
  FaPhone,
  FaIdCard,
  FaCalendarAlt,
} from "react-icons/fa";

export default function EmployeeManagement() {
  const { userRole } = useAuth();
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [selectedOfficer, setSelectedOfficer] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    employeeId: "",
    role: "admin",
    department: "",
    position: "",
  });
  const [stats, setStats] = useState({
    total: 0,
    superadmin: 0,
    admin: 0,
  });

  useEffect(() => {
    fetchOfficers();
  }, []);

  const fetchOfficers = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "users_officer"),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const officersData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setOfficers(officersData);
      calculateStats(officersData);
    } catch (error) {
      console.error("Error fetching officers:", error);
      alert("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data) => {
    const total = data.length;
    const superadmin = data.filter((o) => o.role === "superadmin").length;
    const admin = data.filter((o) => o.role === "admin").length;
    setStats({ total, superadmin, admin });
  };

  const handleAdd = () => {
    setModalMode("add");
    setFormData({
      name: "",
      email: "",
      phone: "",
      employeeId: "",
      role: "admin",
      department: "",
      position: "",
    });
    setSelectedOfficer(null);
    setShowModal(true);
  };

  const handleEdit = (officer) => {
    setModalMode("edit");
    setFormData({
      name: officer.name || "",
      email: officer.email || "",
      phone: officer.phone || "",
      employeeId: officer.employeeId || "",
      role: officer.role || "admin",
      department: officer.department || "",
      position: officer.position || "",
    });
    setSelectedOfficer(officer);
    setShowModal(true);
  };

  const handleDelete = async (officer) => {
    if (window.confirm(`คุณต้องการลบเจ้าหน้าที่ ${officer.name} ใช่หรือไม่?`)) {
      try {
        await deleteDoc(doc(db, "users_officer", officer.id));
        alert("ลบข้อมูลสำเร็จ");
        fetchOfficers();
      } catch (error) {
        console.error("Error deleting officer:", error);
        alert("เกิดข้อผิดพลาดในการลบข้อมูล");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.employeeId) {
      alert("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
      return;
    }

    try {
      if (modalMode === "add") {
        await addDoc(collection(db, "users_officer"), {
          ...formData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        alert("เพิ่มเจ้าหน้าที่สำเร็จ");
      } else {
        await updateDoc(doc(db, "users_officer", selectedOfficer.id), {
          ...formData,
          updatedAt: Timestamp.now(),
        });
        alert("แก้ไขข้อมูลสำเร็จ");
      }
      setShowModal(false);
      fetchOfficers();
    } catch (error) {
      console.error("Error saving officer:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  const filteredOfficers = officers.filter(
    (officer) =>
      officer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      officer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      officer.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      officer.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleText = (role) => {
    return role === "superadmin" ? "ผู้ดูแล" : "เจ้าหน้าที่";
  };

  const getRoleColor = (role) => {
    return role === "superadmin" ? "#667eea" : "#10b981";
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    let date;
    if (timestamp instanceof Timestamp) {
      date = timestamp.toDate();
    } else if (typeof timestamp === "string") {
      date = new Date(timestamp);
    } else {
      return "N/A";
    }
    return date.toLocaleString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const styles = {
    container: {
      minHeight: "100vh",
      padding: "2rem",
      fontFamily: "'Kanit', sans-serif",
    },
    header: {
      background: "rgba(255, 255, 255, 0.95)",
      backdropFilter: "blur(10px)",
      borderRadius: "20px",
      padding: "2rem",
      marginBottom: "2rem",
      boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
    },
    headerTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "2rem",
      flexWrap: "wrap",
      gap: "1rem",
    },
    title: {
      fontSize: "2rem",
      fontWeight: "700",
      color: "#1e293b",
      margin: 0,
      display: "flex",
      alignItems: "center",
      gap: "0.75rem",
    },
    addButton: {
      padding: "0.8rem 1.5rem",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white",
      border: "none",
      borderRadius: "12px",
      fontSize: "1rem",
      fontWeight: "600",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      transition: "all 0.3s ease",
      boxShadow: "0 4px 15px rgba(102, 126, 234, 0.3)",
    },
    statsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "1rem",
      marginBottom: "1.5rem",
    },
    statCard: {
      background: "#f8fafc",
      padding: "1.5rem",
      borderRadius: "15px",
      display: "flex",
      alignItems: "center",
      gap: "1rem",
    },
    statIcon: {
      fontSize: "2.5rem",
      color: "#667eea",
    },
    statContent: {
      flex: 1,
    },
    statLabel: {
      fontSize: "0.9rem",
      color: "#64748b",
      fontWeight: "600",
      marginBottom: "0.25rem",
    },
    statValue: {
      fontSize: "2rem",
      fontWeight: "700",
      color: "#1e293b",
    },
    searchContainer: {
      position: "relative",
      width: "100%",
    },
    searchIcon: {
      position: "absolute",
      left: "1rem",
      top: "50%",
      transform: "translateY(-50%)",
      color: "#94a3b8",
      fontSize: "1.2rem",
    },
    searchInput: {
      width: "100%",
      padding: "0.8rem 1rem 0.8rem 3rem",
      border: "2px solid #e2e8f0",
      borderRadius: "12px",
      fontSize: "1rem",
      outline: "none",
      transition: "all 0.3s ease",
    },
    tableContainer: {
      background: "white",
      borderRadius: "20px",
      padding: "2rem",
      boxShadow: "0 10px 40px rgba(0, 0, 0, 0.08)",
      overflowX: "auto",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
    },
    th: {
      padding: "1rem",
      textAlign: "left",
      fontWeight: "700",
      color: "#1e293b",
      borderBottom: "2px solid #f1f5f9",
      fontSize: "0.95rem",
    },
    td: {
      padding: "1rem",
      borderBottom: "1px solid #f1f5f9",
      color: "#475569",
      fontSize: "0.95rem",
    },
    roleBadge: (role) => ({
      display: "inline-block",
      padding: "0.4rem 1rem",
      borderRadius: "10px",
      fontSize: "0.85rem",
      fontWeight: "600",
      background: getRoleColor(role),
      color: "white",
    }),
    actionButtons: {
      display: "flex",
      gap: "0.5rem",
    },
    actionButton: (color) => ({
      padding: "0.5rem 0.8rem",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "0.9rem",
      fontWeight: "600",
      color: "white",
      background: color,
      transition: "all 0.3s ease",
      display: "flex",
      alignItems: "center",
      gap: "0.3rem",
    }),
    modal: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "1rem",
    },
    modalContent: {
      background: "white",
      borderRadius: "20px",
      padding: "2rem",
      maxWidth: "600px",
      width: "100%",
      maxHeight: "90vh",
      overflowY: "auto",
      boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
    },
    modalHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "2rem",
      paddingBottom: "1rem",
      borderBottom: "2px solid #f1f5f9",
    },
    modalTitle: {
      fontSize: "1.5rem",
      fontWeight: "700",
      color: "#1e293b",
      margin: 0,
    },
    closeButton: {
      background: "none",
      border: "none",
      fontSize: "1.5rem",
      color: "#94a3b8",
      cursor: "pointer",
      transition: "color 0.3s ease",
    },
    form: {
      display: "flex",
      flexDirection: "column",
      gap: "1.5rem",
    },
    formGroup: {
      display: "flex",
      flexDirection: "column",
      gap: "0.5rem",
    },
    label: {
      fontSize: "0.95rem",
      fontWeight: "600",
      color: "#475569",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    },
    input: {
      padding: "0.8rem 1rem",
      border: "2px solid #e2e8f0",
      borderRadius: "10px",
      fontSize: "1rem",
      outline: "none",
      transition: "all 0.3s ease",
    },
    select: {
      padding: "0.8rem 1rem",
      border: "2px solid #e2e8f0",
      borderRadius: "10px",
      fontSize: "1rem",
      outline: "none",
      transition: "all 0.3s ease",
      background: "white",
      cursor: "pointer",
    },
    modalButtons: {
      display: "flex",
      gap: "1rem",
      marginTop: "1rem",
    },
    submitButton: {
      flex: 1,
      padding: "0.8rem 1.5rem",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white",
      border: "none",
      borderRadius: "12px",
      fontSize: "1rem",
      fontWeight: "600",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "0.5rem",
      transition: "all 0.3s ease",
    },
    cancelButton: {
      flex: 1,
      padding: "0.8rem 1.5rem",
      background: "#e2e8f0",
      color: "#475569",
      border: "none",
      borderRadius: "12px",
      fontSize: "1rem",
      fontWeight: "600",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "0.5rem",
      transition: "all 0.3s ease",
    },
    loadingContainer: {
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    },
    spinner: {
      width: "60px",
      height: "60px",
      border: "6px solid #f3f4f6",
      borderTop: "6px solid #667eea",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
    },
    loadingText: {
      marginTop: "1rem",
      fontSize: "1.2rem",
      color: "#64748b",
      fontWeight: "600",
    },
    emptyState: {
      textAlign: "center",
      padding: "4rem 2rem",
      color: "#94a3b8",
    },
    emptyIcon: {
      fontSize: "4rem",
      marginBottom: "1rem",
    },
    emptyText: {
      fontSize: "1.2rem",
      fontWeight: "600",
    },
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <style>{`
        .add-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(102, 126, 234, 0.4) !important;
        }
        .search-input:focus {
          border-color: #667eea !important;
        }
        .action-btn:hover {
          opacity: 0.8;
          transform: scale(1.05);
        }
        .close-btn:hover {
          color: #ef4444 !important;
        }
        .submit-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(102, 126, 234, 0.4);
        }
        .cancel-btn:hover {
          background: #cbd5e1 !important;
        }
        .table-row:hover {
          background: #f8fafc;
        }
        input:focus, select:focus {
          border-color: #667eea !important;
        }
      `}</style>

      <div style={styles.header}>
        <div style={styles.headerTop}>
          <h1 style={styles.title}>
            <FaUserTie /> จัดการเจ้าหน้าที่
          </h1>
          {userRole === "superadmin" && (
            <button
              className="add-btn"
              style={styles.addButton}
              onClick={handleAdd}
            >
              <FaPlus /> เพิ่มเจ้าหน้าที่
            </button>
          )}
        </div>

        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>
              <FaUsers />
            </div>
            <div style={styles.statContent}>
              <div style={styles.statLabel}>ทั้งหมด</div>
              <div style={styles.statValue}>{stats.total}</div>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statIcon, color: "#667eea" }}>
              <FaUserShield />
            </div>
            <div style={styles.statContent}>
              <div style={styles.statLabel}>ผู้ดูแล</div>
              <div style={styles.statValue}>{stats.superadmin}</div>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statIcon, color: "#10b981" }}>
              <FaUserTie />
            </div>
            <div style={styles.statContent}>
              <div style={styles.statLabel}>เจ้าหน้าที่</div>
              <div style={styles.statValue}>{stats.admin}</div>
            </div>
          </div>
        </div>

        <div style={styles.searchContainer}>
          <FaSearch style={styles.searchIcon} />
          <input
            className="search-input"
            type="text"
            placeholder="ค้นหาด้วยชื่อ, อีเมล, รหัสพนักงาน, หรือหน่วยงาน..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      </div>

      <div style={styles.tableContainer}>
        {filteredOfficers.length > 0 ? (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>รหัสพนักงาน</th>
                <th style={styles.th}>ชื่อ-นามสกุล</th>
                <th style={styles.th}>อีเมล</th>
                <th style={styles.th}>เบอร์โทร</th>
                <th style={styles.th}>หน่วยงาน</th>
                <th style={styles.th}>ตำแหน่ง</th>
                <th style={styles.th}>บทบาท</th>
                <th style={styles.th}>วันที่สร้าง</th>
                {userRole === "superadmin" && <th style={styles.th}>จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {filteredOfficers.map((officer) => (
                <tr key={officer.id} className="table-row">
                  <td style={styles.td}>{officer.employeeId}</td>
                  <td style={styles.td}>{officer.name}</td>
                  <td style={styles.td}>{officer.email}</td>
                  <td style={styles.td}>{officer.phone || "-"}</td>
                  <td style={styles.td}>{officer.department || "-"}</td>
                  <td style={styles.td}>{officer.position || "-"}</td>
                  <td style={styles.td}>
                    <span style={styles.roleBadge(officer.role)}>
                      {getRoleText(officer.role)}
                    </span>
                  </td>
                  <td style={styles.td}>{formatDate(officer.createdAt)}</td>
                  {userRole === "superadmin" && (
                    <td style={styles.td}>
                      <div style={styles.actionButtons}>
                        <button
                          className="action-btn"
                          style={styles.actionButton("#f59e0b")}
                          onClick={() => handleEdit(officer)}
                        >
                          <FaEdit /> แก้ไข
                        </button>
                        <button
                          className="action-btn"
                          style={styles.actionButton("#ef4444")}
                          onClick={() => handleDelete(officer)}
                        >
                          <FaTrash /> ลบ
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <FaSearch />
            </div>
            <div style={styles.emptyText}>
              {searchTerm ? "ไม่พบข้อมูลที่ค้นหา" : "ยังไม่มีข้อมูลเจ้าหน้าที่"}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div style={styles.modal} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {modalMode === "add" ? "เพิ่มเจ้าหน้าที่" : "แก้ไขข้อมูล"}
              </h2>
              <button
                className="close-btn"
                style={styles.closeButton}
                onClick={() => setShowModal(false)}
              >
                <FaTimes />
              </button>
            </div>

            <form style={styles.form} onSubmit={handleSubmit}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <FaUserTie /> ชื่อ-นามสกุล *
                </label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="กรอกชื่อ-นามสกุล"
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <FaEnvelope /> อีเมล *
                </label>
                <input
                  type="email"
                  style={styles.input}
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="กรอกอีเมล"
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <FaPhone /> เบอร์โทร
                </label>
                <input
                  type="tel"
                  style={styles.input}
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="กรอกเบอร์โทร"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <FaUserTie /> ตำแหน่ง
                </label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.position}
                  onChange={(e) =>
                    setFormData({ ...formData, position: e.target.value })
                  }
                  placeholder="กรอกตำแหน่ง"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <FaUserShield /> บทบาท *
                </label>
                <select
                  style={styles.select}
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  required
                >
                  <option value="admin">เจ้าหน้าที่</option>
                  <option value="superadmin">ผู้ดูแล</option>
                </select>
              </div>

              <div style={styles.modalButtons}>
                <button
                  type="button"
                  className="cancel-btn"
                  style={styles.cancelButton}
                  onClick={() => setShowModal(false)}
                >
                  <FaTimes /> ยกเลิก
                </button>
                <button
                  type="submit"
                  className="submit-btn"
                  style={styles.submitButton}
                >
                  <FaSave /> บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
