// Studentinfo.js
import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "./database/firebase";
import {
  FaUsers,
  FaSearch,
  FaFilter,
  FaPlus,
  FaEye,
  FaEdit,
  FaTrash,
  FaTimes,
  FaSave,
  FaRandom,
  FaSchool,
  FaGraduationCap,
  FaIdCard,
  FaPhone,
  FaEnvelope,
  FaHome,
  FaUser,
  FaUserFriends,
} from "react-icons/fa";

export default function StudentInfo() {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);

  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSchool, setFilterSchool] = useState("");
  const [filterMajor, setFilterMajor] = useState("");
  const [schools, setSchools] = useState([]);
  const [majors, setMajors] = useState([]);

  // Form states (คงเดิม)
  const [formData, setFormData] = useState({
    name: "",
    nickname: "",
    student_id: "",
    citizen_id: "",
    phone_num: "",
    email: "",
    school: "",
    major: "",
    siblings_count: "",
    address_current: {
      house_no: "",
      moo: "",
      village: "",
      soi: "",
      road: "",
      sub_district: "",
      district: "",
      province: "",
      zipcode: "",
    },
    address_perm: {
      house_no: "",
      moo: "",
      village: "",
      soi: "",
      road: "",
      sub_district: "",
      district: "",
      province: "",
      zipcode: "",
    },
    father_info: {
      name: "",
      citizen_id: "",
      phone_number: "",
      education_level: "",
      email: "",
      address_current: {
        house_no: "",
        moo: "",
        village: "",
        soi: "",
        road: "",
        sub_district: "",
        district: "",
        province: "",
        zipcode: "",
      },
    },
    mother_info: {
      name: "",
      citizen_id: "",
      phone_number: "",
      education_level: "",
      email: "",
      address_current: {
        house_no: "",
        moo: "",
        village: "",
        soi: "",
        road: "",
        sub_district: "",
        district: "",
        province: "",
        zipcode: "",
      },
    },
    guardian_info: {
      name: "",
      citizen_id: "",
      phone_number: "",
      education_level: "",
      email: "",
      address_current: {
        house_no: "",
        moo: "",
        village: "",
        soi: "",
        road: "",
        sub_district: "",
        district: "",
        province: "",
        zipcode: "",
      },
    },
    survey: {
      familyStatus: "",
      fatherIncome: "",
      motherIncome: "",
      guardianIncome: "",
      legalStatus: "",
      livingWith: "",
      parentLegalStatus: "",
      timestamp: new Date(),
    },
  });

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm, filterSchool, filterMajor]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown && !event.target.closest(".dropdown-container")) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDropdown]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, "users"));
      const studentsData = [];
      const schoolsSet = new Set();
      const majorsSet = new Set();

      querySnapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        studentsData.push(data);

        if (data.school) schoolsSet.add(data.school);
        if (data.major) majorsSet.add(data.major);
      });

      setStudents(studentsData);
      setSchools([...schoolsSet].sort());
      setMajors([...majorsSet].sort());
    } catch (error) {
      console.error("Error fetching students:", error);
      alert("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const filterStudents = () => {
    let filtered = students;

    // Search by name, student_id, or email
    if (searchTerm) {
      filtered = filtered.filter(
        (student) =>
          student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.student_id
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          student.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by school
    if (filterSchool) {
      filtered = filtered.filter((student) => student.school === filterSchool);
    }

    // Filter by major
    if (filterMajor) {
      filtered = filtered.filter((student) => student.major === filterMajor);
    }

    setFilteredStudents(filtered);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      nickname: "",
      student_id: "",
      citizen_id: "",
      phone_num: "",
      email: "",
      school: "",
      major: "",
      siblings_count: "",
      address_current: {
        house_no: "",
        moo: "",
        village: "",
        soi: "",
        road: "",
        sub_district: "",
        district: "",
        province: "",
        zipcode: "",
      },
      address_perm: {
        house_no: "",
        moo: "",
        village: "",
        soi: "",
        road: "",
        sub_district: "",
        district: "",
        province: "",
        zipcode: "",
      },
      father_info: {
        name: "",
        citizen_id: "",
        phone_number: "",
        education_level: "",
        email: "",
        address_current: {
          house_no: "",
          moo: "",
          village: "",
          soi: "",
          road: "",
          sub_district: "",
          district: "",
          province: "",
          zipcode: "",
        },
      },
      mother_info: {
        name: "",
        citizen_id: "",
        phone_number: "",
        education_level: "",
        email: "",
        address_current: {
          house_no: "",
          moo: "",
          village: "",
          soi: "",
          road: "",
          sub_district: "",
          district: "",
          province: "",
          zipcode: "",
        },
      },
      guardian_info: {
        name: "",
        citizen_id: "",
        phone_number: "",
        education_level: "",
        email: "",
        address_current: {
          house_no: "",
          moo: "",
          village: "",
          soi: "",
          road: "",
          sub_district: "",
          district: "",
          province: "",
          zipcode: "",
        },
      },
      survey: {
        familyStatus: "",
        fatherIncome: "",
        motherIncome: "",
        guardianIncome: "",
        legalStatus: "",
        livingWith: "",
        parentLegalStatus: "",
        timestamp: new Date(),
      },
    });
  };

  const openModal = (mode, student = null) => {
    setModalMode(mode);
    setSelectedStudent(student);
    setOpenDropdown(null);

    if (mode === "add") {
      resetForm();
    } else if (student) {
      setFormData({ ...student });
    }

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedStudent(null);
    resetForm();
  };

  const handleInputChange = (path, value) => {
    const keys = path.split(".");
    setFormData((prev) => {
      const newData = { ...prev };
      let current = newData;

      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const handleSubmit = async () => {
    try {
      if (modalMode === "add") {
        await addDoc(collection(db, "users"), {
          ...formData,
          createdAt: new Date(),
        });
        alert("เพิ่มข้อมูลนักศึกษาสำเร็จ!");
      } else if (modalMode === "edit") {
        await updateDoc(doc(db, "users", selectedStudent.id), {
          ...formData,
          updatedAt: new Date(),
        });
        alert("แก้ไขข้อมูลนักศึกษาสำเร็จ!");
      }

      closeModal();
      fetchStudents();
    } catch (error) {
      console.error("Error saving student:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  const handleDelete = async (studentId) => {
    if (window.confirm("ต้องการลบข้อมูลนักศึกษานี้ใช่หรือไม่?")) {
      try {
        await deleteDoc(doc(db, "users", studentId));
        alert("ลบข้อมูลนักศึกษาสำเร็จ!");
        fetchStudents();
        setOpenDropdown(null);
      } catch (error) {
        console.error("Error deleting student:", error);
        alert("เกิดข้อผิดพลาดในการลบข้อมูล");
      }
    }
  };

  const toggleDropdown = (studentId) => {
    setOpenDropdown(openDropdown === studentId ? null : studentId);
  };

  const handleDropdownAction = (action, student) => {
    setOpenDropdown(null);

    switch (action) {
      case "view":
        openModal("view", student);
        break;
      case "edit":
        openModal("edit", student);
        break;
      case "delete":
        handleDelete(student.id);
        break;
      default:
        break;
    }
  };

  const renderFormField = (label, path, placeholder = "", icon = null) => (
    <div style={styles.field}>
      <label style={styles.label}>
        {icon && React.cloneElement(icon, { style: styles.labelIcon })}
        {label}:
      </label>
      <input
        type="text"
        value={getNestedValue(formData, path) || ""}
        onChange={(e) => handleInputChange(path, e.target.value)}
        placeholder={placeholder}
        style={styles.input}
        disabled={modalMode === "view"}
      />
    </div>
  );

  const getNestedValue = (obj, path) => {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  };

  const renderAddressForm = (title, basePath) => (
    <div style={styles.section}>
      <h4 style={styles.sectionTitle}>
        <FaHome style={styles.sectionIcon} /> {title}
      </h4>
      {renderFormField("บ้านเลขที่", `${basePath}.house_no`, "", <FaHome />)}
      {renderFormField("หมู่", `${basePath}.moo`)}
      {renderFormField("หมู่บ้าน", `${basePath}.village`)}
      {renderFormField("ซอย", `${basePath}.soi`)}
      {renderFormField("ถนน", `${basePath}.road`)}
      {renderFormField("ตำบล/แขวง", `${basePath}.sub_district`)}
      {renderFormField("อำเภอ/เขต", `${basePath}.district`)}
      {renderFormField("จังหวัด", `${basePath}.province`)}
      {renderFormField("รหัสไปรษณีย์", `${basePath}.zipcode`)}
    </div>
  );

  const renderParentForm = (title, basePath) => (
    <div style={styles.section}>
      <h4 style={styles.sectionTitle}>
        <FaUser style={styles.sectionIcon} /> {title}
      </h4>
      {renderFormField("ชื่อ-นามสกุล", `${basePath}.name`, "", <FaUser />)}
      {renderFormField(
        "เลขบัตรประชาชน",
        `${basePath}.citizen_id`,
        "",
        <FaIdCard />
      )}
      {renderFormField(
        "เบอร์โทรศัพท์",
        `${basePath}.phone_number`,
        "",
        <FaPhone />
      )}
      {renderFormField(
        "ระดับการศึกษา",
        `${basePath}.education_level`,
        "",
        <FaGraduationCap />
      )}
      {renderFormField("อีเมล", `${basePath}.email`, "", <FaEnvelope />)}
      {renderAddressForm("ที่อยู่", `${basePath}.address_current`)}
    </div>
  );

  // Random data helpers (คงเดิม)
  const randomHelpers = {
    thaiFirstNames: [
      "ธนกร",
      "ภูมิ",
      "กันตพงศ์",
      "ณัฐวุฒิ",
      "ศุภณัฐ",
      "วรรณิดา",
      "ปิยะดา",
      "กัญญา",
      "ณัฐธิดา",
      "ชนิกา",
    ],
    thaiLastNames: [
      "รักษ์ไทย",
      "สุขสันต์",
      "ใจดี",
      "รุ่งเรือง",
      "มั่นคง",
      "สว่างวงศ์",
      "ศรีสุข",
      "บุญมี",
      "วงศ์ทอง",
      "จันทร์เพ็ญ",
    ],
    schools: [
      "สำนักวิชาวิศวกรรมศาสตร์",
      "สำนักวิชาวิทยาศาสตร์",
      "สำนักวิชาเทคโนโลยีสังคม",
    ],
    majors: {
      สำนักวิชาวิศวกรรมศาสตร์: [
        "วิศวกรรมคอมพิวเตอร์",
        "วิศวกรรมไฟฟ้า",
        "วิศวกรรมโยธา",
      ],
      สำนักวิชาวิทยาศาสตร์: ["คณิตศาสตร์", "ฟิสิกส์", "เคมี"],
      สำนักวิชาเทคโนโลยีสังคม: ["เทคโนโลยีสารสนเทศ", "นิเทศศาสตร์"],
    },
    locations: {
      นครราชสีมา: {
        เมืองนครราชสีมา: [
          "ในเมือง",
          "หัวทะเล",
          "โพธิ์กลาง",
          "หนองจะบก",
          "หนองไผ่ล้อม",
        ],
        ปากช่อง: ["ปากช่อง", "หนองสาหร่าย", "กลางดง", "จันทึก", "วังไทร"],
        พิมาย: ["ในเมือง", "กระชอน", "ท่าหลวง", "รังกาใหญ่", "ชีวาน"],
        สีคิ้ว: ["สีคิ้ว", "บ้านหัน", "กุดน้อย", "หนองบัวน้อย", "มิตรภาพ"],
      },
      ขอนแก่น: {
        เมืองขอนแก่น: ["ในเมือง", "บ้านเป็ด", "ศิลา", "บ้านทุ่ม", "สำราญ"],
        น้ำพอง: ["น้ำพอง", "วังชัย", "ท่ากระเสริม", "หนองกุง", "บัวเงิน"],
        ชุมแพ: ["ชุมแพ", "โนนหัน", "นาหนองทุ่ม", "หนองไผ่", "ไชยสอ"],
      },
      สุรินทร์: {
        เมืองสุรินทร์: ["ในเมือง", "นอกเมือง", "แสลงพันธ์", "เฉนียง", "ตั้งใจ"],
        ปราสาท: ["กังแอน", "ทุ่งมน", "ไพล", "สมุด", "โคกยาง"],
        ศีขรภูมิ: ["ระแงง", "หนองขวาว", "ตรึม", "แตล", "หนองบัว"],
      },
    },
    randomNumber: (min, max) =>
      Math.floor(Math.random() * (max - min + 1)) + min,
    randomFromArray: (arr) => arr[Math.floor(Math.random() * arr.length)],
    randomPhoneNumber: () => {
      const prefix = ["06", "08", "09"];
      return `${randomHelpers.randomFromArray(prefix)}${Array(8)
        .fill(0)
        .map(() => randomHelpers.randomNumber(0, 9))
        .join("")}`;
    },
    randomAddress: () => {
      const province = randomHelpers.randomFromArray(
        Object.keys(randomHelpers.locations)
      );
      const district = randomHelpers.randomFromArray(
        Object.keys(randomHelpers.locations[province])
      );
      const subDistrict = randomHelpers.randomFromArray(
        randomHelpers.locations[province][district]
      );
      return {
        house_no: randomHelpers.randomNumber(1, 999).toString(),
        moo: randomHelpers.randomNumber(1, 12).toString(),
        village: `หมู่บ้านสุขสันต์ ${randomHelpers.randomNumber(1, 5)}`,
        soi: `ซอย ${randomHelpers.randomNumber(1, 20)}`,
        road: randomHelpers.randomFromArray([
          "ถนนมิตรภาพ",
          "ถนนสุรนารี",
          "ถนนราชดำเนิน",
          "ถนนชยางกูร",
          "ถนนมหาดไทย",
        ]),
        sub_district: subDistrict,
        district: district,
        province: province,
        zipcode: randomHelpers.randomNumber(30000, 39999).toString(),
      };
    },
  };

  const generateRandomData = () => {
    const randomSchool = randomHelpers.randomFromArray(randomHelpers.schools);
    const randomMajor = randomHelpers.randomFromArray(
      randomHelpers.majors[randomSchool]
    );
    setFormData({
      name: `${randomHelpers.randomFromArray(
        randomHelpers.thaiFirstNames
      )} ${randomHelpers.randomFromArray(randomHelpers.thaiLastNames)}`,
      nickname: randomHelpers.randomFromArray([
        "นิด",
        "หน่อย",
        "ต้น",
        "บี",
        "เอ",
        "แบงค์",
        "มด",
      ]),
      student_id: `B${randomHelpers.randomNumber(6000000, 6999999)}`,
      citizen_id: Array(13)
        .fill(0)
        .map(() => randomHelpers.randomNumber(0, 9))
        .join(""),
      phone_num: randomHelpers.randomPhoneNumber(),
      email: `b${randomHelpers.randomNumber(6000000, 6999999)}@g.sut.ac.th`,
      school: randomSchool,
      major: randomMajor,
      siblings_count: randomHelpers.randomNumber(0, 5).toString(),
      address_current: randomHelpers.randomAddress(),
      address_perm: randomHelpers.randomAddress(),
      father_info: {
        name: `${randomHelpers.randomFromArray(
          randomHelpers.thaiFirstNames
        )} ${randomHelpers.randomFromArray(randomHelpers.thaiLastNames)}`,
        citizen_id: Array(13)
          .fill(0)
          .map(() => randomHelpers.randomNumber(0, 9))
          .join(""),
        phone_number: randomHelpers.randomPhoneNumber(),
        education_level: randomHelpers.randomFromArray([
          "ปริญญาตรี",
          "ปริญญาโท",
          "มัธยมศึกษา",
          "ประถมศึกษา",
        ]),
        email: `father${randomHelpers.randomNumber(1000, 9999)}@email.com`,
        address_current: randomHelpers.randomAddress(),
      },
      mother_info: {
        name: `${randomHelpers.randomFromArray(
          randomHelpers.thaiFirstNames
        )} ${randomHelpers.randomFromArray(randomHelpers.thaiLastNames)}`,
        citizen_id: Array(13)
          .fill(0)
          .map(() => randomHelpers.randomNumber(0, 9))
          .join(""),
        phone_number: randomHelpers.randomPhoneNumber(),
        education_level: randomHelpers.randomFromArray([
          "ปริญญาตรี",
          "ปริญญาโท",
          "มัธยมศึกษา",
          "ประถมศึกษา",
        ]),
        email: `mother${randomHelpers.randomNumber(1000, 9999)}@email.com`,
        address_current: randomHelpers.randomAddress(),
      },
      guardian_info: {
        name: `${randomHelpers.randomFromArray(
          randomHelpers.thaiFirstNames
        )} ${randomHelpers.randomFromArray(randomHelpers.thaiLastNames)}`,
        citizen_id: Array(13)
          .fill(0)
          .map(() => randomHelpers.randomNumber(0, 9))
          .join(""),
        phone_number: randomHelpers.randomPhoneNumber(),
        education_level: randomHelpers.randomFromArray([
          "ปริญญาตรี",
          "ปริญญาโท",
          "มัธยมศึกษา",
          "ประถมศึกษา",
        ]),
        email: `guardian${randomHelpers.randomNumber(1000, 9999)}@email.com`,
        address_current: randomHelpers.randomAddress(),
      },
      survey: {
        familyStatus: null,
        fatherIncome: null,
        motherIncome: null,
        guardianIncome: null,
        legalStatus: null,
        livingWith: null,
        parentLegalStatus: null,
        timestamp: new Date(),
      },
    });
  };

  const styles = {
    container: {
      minHeight: "100vh",
      padding: "2rem",
      fontFamily: "'Kanit', sans-serif",
    },
    innerContainer: {
      maxWidth: "1400px",
      margin: "0 auto",
    },
    card: {
      background: "rgba(255, 255, 255, 0.95)",
      backdropFilter: "blur(10px)",
      borderRadius: "20px",
      padding: "2rem",
      boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "2rem",
    },
    title: {
      display: "flex",
      alignItems: "center",
      gap: "1rem",
      color: "#1e293b",
      fontSize: "2rem",
      fontWeight: "700",
      margin: 0,
    },
    titleIcon: {
      fontSize: "2.5rem",
      color: "#667eea",
    },
    addButton: {
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white",
      border: "none",
      padding: "1rem 1.5rem",
      borderRadius: "12px",
      cursor: "pointer",
      fontSize: "1rem",
      fontWeight: "600",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      transition: "all 0.3s ease",
      boxShadow: "0 4px 15px rgba(102, 126, 234, 0.3)",
    },
    filterSection: {
      backgroundColor: "white",
      padding: "1.5rem",
      borderRadius: "15px",
      marginBottom: "2rem",
      boxShadow: "0 10px 40px rgba(0, 0, 0, 0.08)",
    },
    searchContainer: {
      marginBottom: "1rem",
    },
    searchInput: {
      width: "100%",
      padding: "1rem 1.2rem",
      borderRadius: "12px",
      border: "2px solid #e2e8f0",
      fontSize: "1rem",
      fontWeight: "500",
      background: "white",
    },
    filterContainer: {
      display: "flex",
      gap: "1rem",
      alignItems: "center",
      flexWrap: "wrap",
    },
    filterSelect: {
      padding: "0.8rem 1rem",
      border: "2px solid #e2e8f0",
      borderRadius: "10px",
      minWidth: "200px",
      background: "white",
      fontSize: "0.9rem",
      fontWeight: "500",
    },
    clearButton: {
      background: "linear-gradient(135deg, #6c757d 0%, #495057 100%)",
      color: "white",
      border: "none",
      padding: "0.8rem 1.2rem",
      borderRadius: "10px",
      cursor: "pointer",
      fontSize: "0.9rem",
      fontWeight: "600",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    },
    tableContainer: {
      backgroundColor: "white",
      borderRadius: "15px",
      overflow: "hidden",
      boxShadow: "0 10px 40px rgba(0, 0, 0, 0.08)",
    },
    tableHeader: {
      padding: "1.5rem",
      borderBottom: "2px solid #f1f5f9",
    },
    resultsCount: {
      color: "#64748b",
      fontSize: "1rem",
      fontWeight: "600",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
    },
    tableRow: {
      borderBottom: "1px solid #f1f5f9",
      transition: "all 0.3s ease",
    },
    tableHeaderCell: {
      padding: "1.2rem",
      textAlign: "left",
      fontSize: "1rem",
      fontWeight: "700",
      backgroundColor: "#f8fafc",
      color: "#374151",
    },
    tableCell: {
      padding: "1.2rem",
      textAlign: "left",
      fontSize: "0.95rem",
      color: "#4b5563",
    },
    dropdownContainer: {
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
    },
    dotsButton: {
      backgroundColor: "transparent",
      border: "none",
      fontSize: "1.5rem",
      cursor: "pointer",
      padding: "0.5rem",
      borderRadius: "8px",
      color: "#64748b",
      fontWeight: "bold",
      lineHeight: 1,
      transition: "all 0.3s ease",
    },
    dropdownMenu: {
      position: "absolute",
      top: "100%",
      right: 0,
      backgroundColor: "white",
      border: "1px solid #e2e8f0",
      borderRadius: "12px",
      boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
      zIndex: 9999,
      minWidth: "150px",
      overflow: "hidden",
    },
    dropdownItem: {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      width: "100%",
      padding: "0.8rem 1rem",
      border: "none",
      backgroundColor: "white",
      cursor: "pointer",
      fontSize: "0.9rem",
      textAlign: "left",
      color: "#374151",
      borderBottom: "1px solid #f1f5f9",
      transition: "all 0.3s ease",
    },
    dropdownItemDelete: {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      width: "100%",
      padding: "0.8rem 1rem",
      border: "none",
      backgroundColor: "white",
      cursor: "pointer",
      fontSize: "0.9rem",
      textAlign: "left",
      color: "#dc3545",
      transition: "all 0.3s ease",
    },
    noData: {
      textAlign: "center",
      padding: "3rem",
      color: "#94a3b8",
      fontSize: "1.1rem",
    },
    modalOverlay: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
      padding: "2rem",
    },
    modal: {
      backgroundColor: "white",
      borderRadius: "20px",
      maxWidth: "90vw",
      maxHeight: "90vh",
      width: "800px",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 25px 50px rgba(0, 0, 0, 0.25)",
    },
    modalHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "1.5rem 2rem",
      borderBottom: "2px solid #f1f5f9",
      backgroundColor: "#f8fafc",
    },
    modalTitle: {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      margin: 0,
      color: "#1e293b",
      fontSize: "1.5rem",
      fontWeight: "700",
    },
    closeButton: {
      background: "none",
      border: "none",
      fontSize: "1.5rem",
      cursor: "pointer",
      color: "#64748b",
      padding: "0.5rem",
      borderRadius: "8px",
      transition: "all 0.3s ease",
    },
    modalContent: {
      padding: "2rem",
      overflow: "auto",
      flex: 1,
    },
    modalFooter: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "1.5rem 2rem",
      borderTop: "2px solid #f1f5f9",
      backgroundColor: "#f8fafc",
    },
    cancelButton: {
      background: "linear-gradient(135deg, #6c757d 0%, #495057 100%)",
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
    },
    saveButton: {
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
    },
    section: {
      marginBottom: "2rem",
      padding: "1.5rem",
      backgroundColor: "#f8fafc",
      borderRadius: "12px",
      border: "1px solid #e2e8f0",
    },
    sectionTitle: {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      marginTop: 0,
      marginBottom: "1.5rem",
      color: "#374151",
      fontSize: "1.2rem",
      fontWeight: "700",
    },
    sectionIcon: {
      color: "#667eea",
    },
    field: {
      marginBottom: "1.2rem",
    },
    label: {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      marginBottom: "0.5rem",
      fontWeight: "600",
      color: "#374151",
      fontSize: "0.95rem",
    },
    labelIcon: {
      color: "#667eea",
      fontSize: "0.9rem",
    },
    input: {
      width: "100%",
      padding: "0.8rem 1rem",
      border: "2px solid #e2e8f0",
      borderRadius: "8px",
      fontSize: "0.9rem",
      background: "white",
      transition: "all 0.3s ease",
    },
    loadingContainer: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "50vh",
    },
    loading: {
      fontSize: "1.2rem",
      color: "#64748b",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    },
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.innerContainer}>
          <div style={styles.card}>
            <div style={styles.loadingContainer}>
              <div style={styles.loading}>
                <FaUsers /> กำลังโหลดข้อมูล...
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.innerContainer}>
        <div style={styles.card}>
          <div style={styles.header}>
            <h1 style={styles.title}>
              <FaUsers style={styles.titleIcon} /> จัดการข้อมูลนักศึกษา
            </h1>
            <button onClick={() => openModal("add")} style={styles.addButton}>
              <FaPlus /> เพิ่มนักศึกษาใหม่
            </button>
          </div>

          {/* Search and Filter Section */}
          <div style={styles.filterSection}>
            <div style={styles.searchContainer}>
              <input
                type="text"
                placeholder="ค้นหาด้วย ชื่อ, รหัสนักศึกษา หรือ อีเมล"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
            </div>

            <div style={styles.filterContainer}>
              <select
                value={filterSchool}
                onChange={(e) => setFilterSchool(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="">ทุกสำนักวิชา</option>
                {schools.map((school) => (
                  <option key={school} value={school}>
                    {school}
                  </option>
                ))}
              </select>

              <select
                value={filterMajor}
                onChange={(e) => setFilterMajor(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="">ทุกสาขาวิชา</option>
                {majors.map((major) => (
                  <option key={major} value={major}>
                    {major}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterSchool("");
                  setFilterMajor("");
                }}
                style={styles.clearButton}
              >
                <FaTimes /> ล้างการกรอง
              </button>
            </div>
          </div>

          {/* Students Table */}
          <div style={styles.tableContainer}>
            <div style={styles.tableHeader}>
              <div style={styles.resultsCount}>
                <FaSearch /> พบข้อมูล {filteredStudents.length} รายการ
                จากทั้งหมด {students.length} รายการ
              </div>
            </div>

            <table style={styles.table}>
              <thead>
                <tr style={styles.tableRow}>
                  <th style={styles.tableHeaderCell}>รหัสนักศึกษา</th>
                  <th style={styles.tableHeaderCell}>ชื่อ-นามสกุล</th>
                  <th style={styles.tableHeaderCell}>คณะ</th>
                  <th style={styles.tableHeaderCell}>สาขา</th>
                  <th style={styles.tableHeaderCell}></th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id} style={styles.tableRow}>
                    <td style={styles.tableCell}>{student.student_id}</td>
                    <td style={styles.tableCell}>{student.name}</td>
                    <td style={styles.tableCell}>{student.school}</td>
                    <td style={styles.tableCell}>{student.major}</td>
                    <td style={styles.tableCell}>
                      <div
                        style={styles.dropdownContainer}
                        className="dropdown-container"
                      >
                        <button
                          style={styles.dotsButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDropdown(student.id);
                          }}
                        >
                          ⋮
                        </button>
                        {openDropdown === student.id && (
                          <div style={styles.dropdownMenu}>
                            <button
                              style={styles.dropdownItem}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDropdownAction("view", student);
                              }}
                            >
                              <FaEye /> ดูข้อมูล
                            </button>
                            <button
                              style={styles.dropdownItem}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDropdownAction("edit", student);
                              }}
                            >
                              <FaEdit /> แก้ไข
                            </button>
                            <button
                              style={styles.dropdownItemDelete}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDropdownAction("delete", student);
                              }}
                            >
                              <FaTrash /> ลบ
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredStudents.length === 0 && (
              <div style={styles.noData}>
                <FaSearch style={{ fontSize: "3rem", marginBottom: "1rem" }} />
                <div>ไม่พบข้อมูลนักศึกษา</div>
              </div>
            )}
          </div>

          {/* Modal */}
          {showModal && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <div style={styles.modalHeader}>
                  <h2 style={styles.modalTitle}>
                    <FaUsers />
                    {modalMode === "add" && "เพิ่มนักศึกษาใหม่"}
                    {modalMode === "edit" && "แก้ไขข้อมูลนักศึกษา"}
                    {modalMode === "view" && "ดูข้อมูลนักศึกษา"}
                  </h2>
                  <button onClick={closeModal} style={styles.closeButton}>
                    <FaTimes />
                  </button>
                </div>

                <div style={styles.modalContent}>
                  {/* Basic Information */}
                  <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>
                      <FaUser /> ข้อมูลส่วนตัว
                    </h3>
                    {renderFormField("ชื่อ-นามสกุล", "name", "", <FaUser />)}
                    {renderFormField("ชื่อเล่น", "nickname")}
                    {renderFormField(
                      "รหัสนักศึกษา",
                      "student_id",
                      "",
                      <FaIdCard />
                    )}
                    {renderFormField(
                      "เลขบัตรประชาชน",
                      "citizen_id",
                      "",
                      <FaIdCard />
                    )}
                    {renderFormField(
                      "เบอร์โทรศัพท์",
                      "phone_num",
                      "",
                      <FaPhone />
                    )}
                    {renderFormField("อีเมล", "email", "", <FaEnvelope />)}
                    {renderFormField("สำนักวิชา", "school", "", <FaSchool />)}
                    {renderFormField(
                      "สาขาวิชา",
                      "major",
                      "",
                      <FaGraduationCap />
                    )}
                    {renderFormField(
                      "จำนวนพี่น้อง",
                      "siblings_count",
                      "",
                      <FaUserFriends />
                    )}
                  </div>

                  {/* Address Information */}
                  {renderAddressForm("ที่อยู่ปัจจุบัน", "address_current")}
                  {renderAddressForm("ที่อยู่ตามทะเบียนบ้าน", "address_perm")}

                  {/* Parent Information */}
                  {renderParentForm("ข้อมูลบิดา", "father_info")}
                  {renderParentForm("ข้อมูลมารดา", "mother_info")}
                  {renderParentForm("ข้อมูลผู้ปกครอง", "guardian_info")}

                  {/* Survey Information */}
                  <div style={styles.section}>
                    <h4 style={styles.sectionTitle}>
                      <FaUser /> ข้อมูลแบบสอบถาม
                    </h4>
                    {renderFormField("สถานภาพครอบครัว", "survey.familyStatus")}
                    {renderFormField("รายได้บิดา", "survey.fatherIncome")}
                    {renderFormField("รายได้มารดา", "survey.motherIncome")}
                    {renderFormField(
                      "รายได้ผู้ปกครอง",
                      "survey.guardianIncome"
                    )}
                    {renderFormField("สถานะทางกฎหมาย", "survey.legalStatus")}
                    {renderFormField(
                      "ผู้ที่อาศัยอยู่ด้วย",
                      "survey.livingWith"
                    )}
                    {renderFormField(
                      "เอกสารทางกฎหมายของบิดามารดา",
                      "survey.parentLegalStatus"
                    )}
                  </div>
                </div>

                <div style={styles.modalFooter}>
                  {modalMode !== "view" && (
                    <button
                      onClick={generateRandomData}
                      style={{
                        ...styles.saveButton,
                        background:
                          "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                        marginRight: "auto",
                      }}
                    >
                      <FaRandom /> สุ่มข้อมูล
                    </button>
                  )}
                  <button onClick={closeModal} style={styles.cancelButton}>
                    <FaTimes /> ยกเลิก
                  </button>
                  {modalMode !== "view" && (
                    <button onClick={handleSubmit} style={styles.saveButton}>
                      <FaSave /> {modalMode === "add" ? "เพิ่ม" : "บันทึก"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
