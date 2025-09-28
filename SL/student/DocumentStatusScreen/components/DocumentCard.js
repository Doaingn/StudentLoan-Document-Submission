import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from './StatusBadge';
import FileItem from './FileItem';
import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../database/firebase';

const DocumentCard = ({ docId, filesData, submissionData, onFilePress, onReupload }) => {
  const [userData, setUserData] = useState(null);

  // ดึงข้อมูลจาก Firestore เมื่อ component โหลดครั้งแรก
  useEffect(() => {
    const fetchUserData = async () => {
      const currentUser = getAuth().currentUser;
      if (!currentUser) {
        Alert.alert("ข้อผิดพลาด", "ไม่พบข้อมูลผู้ใช้");
        return;
      }

      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userInfo = userSnap.data();
        setUserData({
          survey: userInfo.survey || null,  // เก็บข้อมูล survey
        });
      } else {
        Alert.alert("ข้อผิดพลาด", "ไม่พบข้อมูลผู้ใช้ในฐานข้อมูล");
      }
    };

    fetchUserData();
  }, []);

  // เช็คข้อมูล 'livingWith' ใน survey และแสดงชื่อเอกสาร
  const getDocumentDisplayName = (docId) => {
    if (!userData) return 'กำลังโหลดข้อมูล...';

    const livingWith = userData?.survey?.livingWith || 'Unknown'; // ถ้าไม่มีข้อมูลจะใช้ "ไม่ระบุ"
    const livingWithText = livingWith === 'บิดา' ? 'บิดา' : (livingWith === 'มารดา' ? 'มารดา' : 'ไม่ระบุ');

    const docNames = {
      'form_101': 'กยศ 101',
      'volunteer_doc' : 'เอกสารจิตอาสา',
      'id_copies_student': 'สำเนาบัตรประชาชนนักศึกษา',
      'consent_student_form': 'หนังสือยินยอมเปิดเผยข้อมูลนักศึกษา',
      'consent_father_form': 'หนังสือยินยอมเปิดเผยข้อมูลบิดา',
      'id_copies_consent_father_form':'สำเนาบัตรประชาชนมารดา',
      'id_copies_father': 'สำเนาบัตรประชาชนบิดา',
      'consent_mother_form': 'หนังสือยินยอมเปิดเผยข้อมูลมารดา',
      'id_copies_mother': 'สำเนาบัตรประชาชนมารดา',
      'id_copies_consent_mother_form':'สำเนาบัตรประชาชนมารดา',
      'guardian_consent' : 'หนังสือยินยอมเปิดเผยข้อมูลผู้ปกครอง',
      'guardian_income_cert': 'หนังสือรับรองรายได้ผู้ปกครอง',
      'father_income_cert': 'หนังสือรับรองรายได้บิดา',
      'fa_id_copies_gov' : 'สำเนาบัตรข้าราชการผู้รับรอง',
      'mother_income_cert': 'หนังสือรับรองรายได้มารดา',
      'mo_id_copies_gov' : 'สำเนาบัตรข้าราชการผู้รับรอง',
      'single_parent_income_cert': 'หนังสือรับรองรายได้',
      'single_parent_income': 'หนังสือรับรองเงินเดือน',
      'famo_income_cert': 'หนังสือรับรองรายได้บิดามารดา',
      'famo_id_copies_gov': 'สำเนาบัตรข้าราชการผู้รับรอง',
      'family_status_cert': 'หนังสือรับรองสถานภาพครอบครัว',
      'father_income': 'หนังสือรับรองเงินเดือนบิดา',
      'mother_income': 'หนังสือรับรองเงินเดือนมารดา',
      'legal_status' : 'สำเนาใบหย่า (กรณีหย่าร้าง) หรือ สำเนาใบมรณบัตร (กรณีเสียชีวิต)',
      'fam_id_copies_gov' : 'สำเนาบัตรข้าราชการผู้รับรอง',
      '102_id_copies_gov' : 'สำเนาบัตรข้าราชการผู้รับรอง',
      'guardian_id_copies' : 'สำเนาบัตรประชาชนผู้ปกครอง',
      'guardian_income' : 'หนังสือรับรองเงินเดือนผู้ปกครอง',
      'guar_id_copies_gov' : 'สำเนาบัตรข้าราชการผู้รับรอง',
      'disbursement_form' : 'แบบยืนยันการเบิกเงินกู้ยืม',
      'expense_burden_form' : 'ใบภาระค่าใช้จ่ายทุน',
    };

    // เพิ่มข้อความ 'บิดา' หรือ 'มารดา' สำหรับเอกสาร 'single_parent_income_cert' และ 'single_parent_income'
    if (docId === 'single_parent_income_cert' || docId === 'single_parent_income') {
      return `${docNames[docId]}ของ${livingWithText}`;
    }

    // สำหรับเอกสารทั่วไป
    return `${docNames[docId] || docId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
  };

  // รองรับทั้ง single file และ multiple files
  const files = Array.isArray(filesData) ? filesData : [filesData];
  const docStatus = submissionData.documentStatuses?.[docId]?.status || files[0]?.status || "pending";
  const reviewComments = submissionData.documentStatuses?.[docId]?.comments || "";

  // ตรวจสอบว่าเอกสารนี้ถูกปฏิเสธหรือไม่
  const isRejected = docStatus === "rejected";

  return (
    <View style={styles.documentCard}>
      {/* Document header */}
      <View style={styles.documentHeader}>
        <View style={styles.documentTitleContainer}>
          <Ionicons name="folder-outline" size={24} color="#2563eb" />
          <Text style={styles.documentTitle}>
            {getDocumentDisplayName(docId)}
          </Text>
        </View>

        {/* Files count and status badge on the next line */}
        <View style={styles.documentFooter}>
          <StatusBadge status={docStatus} />
        </View>
      </View>

      {/* Files list */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filesScrollContainer}
      >
        {files.map((file, index) => (
          <FileItem
            key={`${docId}_${index}`}
            file={file}
            onPress={() => onFilePress(file)}
          />
        ))}
      </ScrollView>

      {/* Review comments */}
      {reviewComments ? (
        <View style={styles.commentSection}>
          <Text style={styles.commentLabel}>หมายเหตุจากเจ้าหน้าที่:</Text>
          <Text style={styles.commentText}>{reviewComments}</Text>
        </View>
      ) : null}

      {/* Reupload button for rejected documents */}
      {isRejected && onReupload && (
        <View style={styles.reuploadSection}>
          <TouchableOpacity
            style={styles.reuploadButton}
            onPress={() => onReupload(docId, getDocumentDisplayName(docId))}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="#ffffff" />
            <Text style={styles.reuploadButtonText}>อัปโหลดใหม่</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  documentCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderLeftWidth: 4,
    borderLeftColor: "#2563eb",
  },
  documentHeader: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'left',
    marginBottom: 12,
  },
  documentFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  documentTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginLeft: 8,
    marginRight: 8,
    flex: 1,
  },
  filesScrollContainer: {
    maxHeight: 120,
    marginBottom: 12,
  },
  commentSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  commentLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  reuploadSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  reuploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: "#ef4444",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  reuploadButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
});

export default DocumentCard;
