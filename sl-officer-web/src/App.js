import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  Navigate,
} from "react-router-dom";
import { useAuth } from "./AuthContext";
import HomeScreen from "./HomeScreen.web";
import PostScreen from "./PostScreen.web";
import AllPostsScreen from "./AllPostsScreen";
import PostEditScreen from "./PostEditScreen.web";
import StudentInfo from "./Studentinfo";
import StudentDocument from "./StdDocumentService";
import DocumentSubmission from "./StudentDocumentSubmission";
import LoanProcessManagement from "./LoanProcessManagement";
import LoginScreen from "./LoginScreen";
import EmployeeManagement from "./officerManagement";
import {
  FaHome,
  FaUserGraduate,
  FaNewspaper,
  FaFileAlt,
  FaCog,
  FaChevronDown,
  FaChevronRight,
  FaSignOutAlt,
  FaUserShield,
} from "react-icons/fa";

// Component สำหรับป้องกัน Route
function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

// Component Layout หลักหลังจากล็อกอิน
function MainLayout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <div style={{ flex: 1, background: "#f3f4f6" }}>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/create-post" element={<PostScreen />} />
          <Route path="/all-posts" element={<AllPostsScreen />} />
          <Route path="/edit" element={<PostEditScreen />} />
          <Route path="/studentinfo" element={<StudentInfo />} />
          <Route path="/docs" element={<StudentDocument />} />
          <Route path="/document-submission" element={<DocumentSubmission />} />
          <Route path="/loan-process" element={<LoanProcessManagement />} />
          <Route path="/officer-management" element={<EmployeeManagement />} />
        </Routes>
      </div>
    </div>
  );
}

// Sidebar component (เพิ่มเมนูจัดการเจ้าหน้าที่)
function Sidebar() {
  const navigate = useNavigate();
  const { logout, userRole, currentUser, userName } = useAuth();
  const [openPosts, setOpenPosts] = useState(false);
  const [openDocuments, setOpenDocuments] = useState(false);
  const [openManagement, setOpenManagement] = useState(false);
  const [selected, setSelected] = useState("home");

  const handleNavigate = (path, key) => {
    setSelected(key);
    navigate(path);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // ดึงชื่อผู้ใช้จาก email หรือ displayName
  const displayName =
    userName ||
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    "ผู้ใช้งาน";
  const displayRole =
    userRole === "superadmin"
      ? "ผู้ดูแลระบบสูงสุด"
      : userRole === "admin"
      ? "ผู้ดูแลระบบ"
      : "เจ้าหน้าที่";

  const styles = {
    sidebar: {
      width: 260,
      background: "linear-gradient(180deg, #0C3169 0%, #1a4483 100%)",
      color: "#ffffff",
      display: "flex",
      flexDirection: "column",
      paddingTop: 20,
      boxShadow: "4px 0 15px rgba(0, 0, 0, 0.1)",
    },
    userInfo: {
      padding: "20px 24px",
      borderBottom: "1px solid rgba(255,255,255,0.15)",
      marginBottom: 20,
      background: "rgba(255, 255, 255, 0.05)",
      backdropFilter: "blur(10px)",
    },
    userName: {
      fontSize: 17,
      fontWeight: "700",
      marginBottom: 6,
      color: "#fff",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    userRole: {
      fontSize: 13,
      color: "rgba(255,255,255,0.8)",
      fontWeight: "500",
      display: "flex",
      alignItems: "center",
      gap: "6px",
    },
    menuSection: {
      flex: 1,
      overflowY: "auto",
      paddingBottom: "20px",
    },
    logoutSection: {
      marginTop: "auto",
      marginBottom: 20,
      padding: "0 12px",
    },
  };

  return (
    <div style={styles.sidebar}>
      <style>{`
        .sidebar-item {
          transition: all 0.3s ease;
        }
        .sidebar-item:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          transform: translateX(4px);
        }
        .sidebar-item.active {
          background: rgba(255, 255, 255, 0.15) !important;
          border-left: 4px solid #fff;
          padding-left: 20px !important;
        }
        .submenu-item {
          transition: all 0.2s ease;
        }
        .submenu-item:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }
        .submenu-item.active {
          background: rgba(255, 255, 255, 0.12) !important;
          font-weight: 600;
        }
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>

      {/* แสดงชื่อผู้ใช้และ Role */}
      <div style={styles.userInfo}>
        <div style={styles.userName}>
          <FaUserShield size={18} />
          {displayName}
        </div>
        <div style={styles.userRole}>
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#10b981",
            }}
          />
          {displayRole}
        </div>
      </div>

      <div style={styles.menuSection}>
        <SidebarItem
          icon={<FaHome />}
          label="หน้าหลัก"
          active={selected === "home"}
          onClick={() => handleNavigate("/", "home")}
        />
        <SidebarItem
          icon={<FaUserGraduate />}
          label="ข้อมูลนักศึกษา"
          active={selected === "studentsInfo"}
          onClick={() => handleNavigate("/studentinfo", "studentsInfo")}
        />

        <div>
          <SidebarItem
            icon={<FaNewspaper />}
            label="โพสต์"
            active={openPosts}
            onClick={() => setOpenPosts(!openPosts)}
            hasSubmenu
            isOpen={openPosts}
          />
          {openPosts && (
            <div style={{ marginLeft: 12 }}>
              <SidebarSubItem
                label="สร้างโพสต์"
                active={selected === "createPost"}
                onClick={() => handleNavigate("/create-post", "createPost")}
              />
              <SidebarSubItem
                label="โพสต์ทั้งหมด"
                active={selected === "allPosts"}
                onClick={() => handleNavigate("/all-posts", "allPosts")}
              />
            </div>
          )}
        </div>

        <div>
          <SidebarItem
            icon={<FaFileAlt />}
            label="เอกสาร"
            active={openDocuments}
            onClick={() => setOpenDocuments(!openDocuments)}
            hasSubmenu
            isOpen={openDocuments}
          />
          {openDocuments && (
            <div style={{ marginLeft: 12 }}>
              <SidebarSubItem
                label="ระบบจัดการการส่งเอกสาร"
                active={selected === "docs"}
                onClick={() => handleNavigate("/docs", "docs")}
              />
              <SidebarSubItem
                label="เอกสารนักศึกษา"
                active={selected === "DocumentSubmission"}
                onClick={() =>
                  handleNavigate("/document-submission", "DocumentSubmission")
                }
              />
              <SidebarSubItem
                label="จัดการสถานะกู้ยืม"
                active={selected === "LoanProcess"}
                onClick={() => handleNavigate("/loan-process", "LoanProcess")}
              />
            </div>
          )}
        </div>

        {(userRole === "admin" || userRole === "superadmin") && (
          <SidebarItem
            icon={<FaCog />}
            label="จัดการเจ้าหน้าที่"
            active={selected === "officer-management"}
            onClick={() =>
              handleNavigate("/officer-management", "officer-management")
            }
          />
        )}
      </div>

      {/* ปุ่มออกจากระบบ */}
      <div style={styles.logoutSection}>
        <SidebarItem
          icon={<FaSignOutAlt />}
          label="ออกจากระบบ"
          active={false}
          onClick={handleLogout}
          isLogout
        />
      </div>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active,
  onClick,
  hasSubmenu,
  isOpen,
  isLogout,
}) {
  const styles = {
    item: {
      padding: "14px 24px",
      background:
        active && !hasSubmenu ? "rgba(255, 255, 255, 0.15)" : "transparent",
      cursor: "pointer",
      fontWeight: active && !hasSubmenu ? "600" : "500",
      fontSize: 15,
      display: "flex",
      alignItems: "center",
      gap: "12px",
      borderLeft:
        active && !hasSubmenu ? "4px solid #fff" : "4px solid transparent",
      color: isLogout ? "#fca5a5" : "#fff",
    },
    iconWrapper: {
      fontSize: 18,
      display: "flex",
      alignItems: "center",
      minWidth: "20px",
    },
    label: {
      flex: 1,
    },
    chevron: {
      fontSize: 14,
      transition: "transform 0.3s ease",
      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
    },
  };

  return (
    <div className="sidebar-item" onClick={onClick} style={styles.item}>
      <div style={styles.iconWrapper}>{icon}</div>
      <span style={styles.label}>{label}</span>
      {hasSubmenu && (
        <div style={styles.chevron}>
          {isOpen ? <FaChevronDown /> : <FaChevronRight />}
        </div>
      )}
    </div>
  );
}

function SidebarSubItem({ label, active, onClick }) {
  const styles = {
    item: {
      padding: "12px 24px 12px 44px",
      background: active ? "rgba(255, 255, 255, 0.12)" : "transparent",
      cursor: "pointer",
      fontWeight: active ? "600" : "400",
      fontSize: 14,
      color: active ? "#fff" : "rgba(255, 255, 255, 0.85)",
      borderLeft: active
        ? "3px solid rgba(255, 255, 255, 0.5)"
        : "3px solid transparent",
      marginLeft: "12px",
    },
  };

  return (
    <div className="submenu-item" onClick={onClick} style={styles.item}>
      {label}
    </div>
  );
}
