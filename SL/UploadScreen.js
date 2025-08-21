import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  Linking,
  Platform
} from "react-native";

const UploadScreen = ({ navigation, route }) => {
  const initialSurveyData = route?.params?.surveyData || {
    familyStatus: "",
    livingWith: "",
    fatherIncome: "",
    motherIncome: "",
    legalStatus: "",
    guardianIncome: "",
    parentLegalStatus: "",
  };

  const [hasCompletedSurvey, setHasCompletedSurvey] = useState(!!route?.params?.surveyData);
  const [surveyData, setSurveyData] = useState(initialSurveyData);
  const [uploads, setUploads] = useState({});
  const [uploadProgress, setUploadProgress] = useState({});

  // เพิ่ม downloadUrl สำหรับเอกสารดาวน์โหลดได้
  const generateDocumentsList = (data) => {
    let documents = [];

    documents.push(
      {
        id: 'form_101',
        title: 'แบบฟอร์ม กยศ. 101',
        description: '(กรอกข้อมูลตามจริงให้ครบถ้วน)',
        required: true,
        downloadUrl: 'https://drive.google.com/file/d/1ylB6AxaPg4qgvBqWWMwQ54LiLCkFTw1-/view?usp=drive_link'
      },
      {
        id: 'volunteer_doc',
        title: 'เอกสารจิตอาสา',
        description: '(กิจกรรมในปีการศึกษา 2567 อย่างน้อย 1 รายการ)',
        required: true
      },
      {
        id: 'consent_student_form',
        title: 'หนังสือยินยอมเปิดเผยข้อมูลของผู้กู้',
        downloadUrl:'https://drive.google.com/file/d/1ZpgUsagMjrxvyno7Jwu1LO3r9Y82GAv4/view?usp=sharing',
        required: true
      },
      {
        id: 'id_copies_student',
        title: 'สำเนาบัตรประชาชนพร้อมรับรองสำเนาถูกต้องของผู้กู้',
        required: true
      }
    );


    // กรณี ก: ครอบครัวปกติ
    if (data.familyStatus === "ก") {
      documents.push(
        {
          id: 'consent_fahter_form',
          title: 'หนังสือยินยอมเปิดเผยข้อมูลของบิดา',
          downloadUrl:'https://drive.google.com/file/d/1ZpgUsagMjrxvyno7Jwu1LO3r9Y82GAv4/view?usp=sharing',
          required: true
        },
        {
          id: 'id_copies_father',
          title: 'สำเนาบัตรประชาชนพร้อมรับรองสำเนาถูกต้องของบิดา',
          required: true
        },
        {
          id: 'consent_mother_form',
          title: 'หนังสือยินยอมเปิดเผยข้อมูลของมารดา',
          downloadUrl:'https://drive.google.com/file/d/1ZpgUsagMjrxvyno7Jwu1LO3r9Y82GAv4/view?usp=sharing',
          required: true
        },
        {
          id: 'id_copies_mother',
          title: 'สำเนาบัตรประชาชนพร้อมรับรองสำเนาถูกต้องของมารดา',
          required: true
        },
      );
      
      // เอกสารรายได้บิดา
      if (data.fatherIncome === "มี") {
        documents.push({
          id: 'father_income',
          title: 'หนังสือรับรองเงินเดือน หรือ สลิปเงินเดือน ของบิดา',
          description: '(เอกสารอายุไม่เกิน 3 เดือน)',
          required: true
        });
      } else {
        documents.push({
          id: 'father_income_cert',
          title: 'หนังสือรับรองรายได้ กยศ. 102 ของบิดา',
          description: 'พร้อมแนบสำเนาบัตรข้าราชการผู้รับรอง (เอกสารจัดทำในปี พ.ศ. 2568 เท่านั้น)',
          downloadUrl: 'https://drive.google.com/file/d/1ylB6AxaPg4qgvBqWWMwQ54LiLCkFTw1-/view?usp=drive_link',
          required: true
        });
      }
      
      // เอกสารรายได้มารดา
      if (data.motherIncome === "มี") {
        documents.push({
          id: 'mother_income',
          title: 'หนังสือรับรองเงินเดือน หรือ สลิปเงินเดือน ของมารดา',
          description: '(เอกสารอายุไม่เกิน 3 เดือน)',
          required: true
        });
      } else {
        documents.push({
          id: 'mother_income_cert',
          title: 'หนังสือรับรองรายได้ กยศ. 102 ของมารดา',
          description: 'พร้อมแนบสำเนาบัตรข้าราชการผู้รับรอง (เอกสารจัดทำในปี พ.ศ. 2568 เท่านั้น)',
          downloadUrl: 'https://drive.google.com/file/d/1ylB6AxaPg4qgvBqWWMwQ54LiLCkFTw1-/view?usp=drive_link',
          required: true
        });
      }
    } 
    // กรณี ข: พ่อแม่หย่าร้าง/เลิกร้าง/เสียชีวิต
    else if (data.familyStatus === "ข") {
      let parent = data.livingWith === "บิดา" ? "บิดา" : "มารดา";
      documents.push(
        {
          id: 'consent_form_single_parent',
          title: `หนังสือยินยอมเปิดเผยข้อมูลของ ${parent}`,
          downloadUrl:'https://drive.google.com/file/d/1ZpgUsagMjrxvyno7Jwu1LO3r9Y82GAv4/view?usp=sharing',
          required: true
        },
        {
          id: 'id_copies_single_parent',
          title: `สำเนาบัตรประชาชนพร้อมรับรองสำเนาถูกต้องของ ${parent}`,
          required: true
        }
      );
      
      // เอกสารแสดงสถานะทางกฎหมาย
      if (data.legalStatus === "มี") {
        documents.push({
          id: 'legal_status',
          title: 'สำเนาใบหย่า (กรณีหย่าร้าง) หรือ สำเนาใบมรณบัตร (กรณีเสียชีวิต)',
          required: true
        });
      } else {
        documents.push({
          id: 'family_status_cert',
          title: 'หนังสือรับรองสถานภาพครอบครัว',
          description: 'พร้อมแนบสำเนาบัตรข้าราชการผู้รับรอง (เอกสารจัดทำในปี พ.ศ. 2568 เท่านั้น)',
          downloadUrl:'https://drive.google.com/file/d/1m98sSlZqAi_YK3PQ2-a9FMIEri1RlENB/view?usp=drive_link',
          required: true
        });
      }
      
      // เอกสารรายได้พ่อ/แม่เดี่ยว
      const hasIncome = (data.livingWith === "บิดา" && data.fatherIncome === "มี") ||
                       (data.livingWith === "มารดา" && data.motherIncome === "มี");
      
      if (hasIncome) {
        documents.push({
          id: 'single_parent_income',
          title: `หนังสือรับรองเงินเดือน หรือ สลิปเงินเดือน ของ${parent}`,
          description: '(เอกสารอายุไม่เกิน 3 เดือน)',
          required: true
        });
      } else {
        documents.push({
          id: 'single_parent_income_cert',
          title: `หนังสือรับรองรายได้ กยศ. 102 ของ${parent}`,
          
          description: 'พร้อมแนบสำเนาบัตรข้าราชการผู้รับรอง (เอกสารจัดทำในปี พ.ศ. 2568 เท่านั้น)',
          downloadUrl: 'https://drive.google.com/file/d/1ylB6AxaPg4qgvBqWWMwQ54LiLCkFTw1-/view?usp=drive_link',
          required: true
        });
      }
    } 
    // กรณี ค: มีผู้ปกครอง
    else if (data.familyStatus === "ค") {
      documents.push(
        {
          id: 'guardian_consent',
          title: 'หนังสือยินยอมเปิดเผยข้อมูล ของผู้ปกครอง',
          downloadUrl:'https://drive.google.com/file/d/1ZpgUsagMjrxvyno7Jwu1LO3r9Y82GAv4/view?usp=sharing',
          required: true
        },
        {
          id: 'guardian_id_copies',
          title: 'สำเนาบัตรประชาชนพร้อมรับรองสำเนาถูกต้อง ของผู้ปกครอง',
          required: true
        }
      );
      
      // เอกสารรายได้ผู้ปกครอง
      if (data.guardianIncome === "มี") {
        documents.push({
          id: 'guardian_income',
          title: 'หนังสือรับรองเงินเดือน หรือ สลิปเงินเดือน ของผู้ปกครอง',
          description: '(เอกสารอายุไม่เกิน 3 เดือน)',
          required: true
        });
      } else {
        documents.push({
          id: 'guardian_income_cert',
          title: 'หนังสือรับรองรายได้ กยศ. 102 ของผู้ปกครอง',
          description: 'พร้อมแนบสำเนาบัตรข้าราชการผู้รับรอง (เอกสารจัดทำในปี พ.ศ. 2568 เท่านั้น)',
          downloadUrl: 'https://drive.google.com/file/d/1ylB6AxaPg4qgvBqWWMwQ54LiLCkFTw1-/view?usp=drive_link',
          required: true
        });
      }
      
      // เอกสารสถานะกฎหมายของบิดามารดา
      if (data.parentLegalStatus === "มี") {
        documents.push({
          id: 'parent_legal_status',
          title: 'สำเนาใบหย่า (กรณีหย่าร้าง) หรือ สำเนาใบมรณบัตร (กรณีเสียชีวิต)',
          description: '',
          required: true
        });
      }
      // เอกสารแสดงสถานภาพครอบครัว (บังคับสำหรับกรณี ค)
      documents.push({
        id: 'family_status_required',
        title: 'หนังสือรับรองสถานภาพครอบครัว',
        description: 'พร้อมแนบสำเนาบัตรข้าราชการผู้รับรอง (เอกสารจัดทำในปี พ.ศ. 2568 เท่านั้น)',
        required: true
      });
    }
    
    return documents;
  };

  // Mock ฟังก์ชันสำหรับจำลองการทำแบบสอบถาม
  const handleStartSurvey = () => {
    // ไปหน้า DocRecScreen เพื่อทำแบบสอบถามจริง
    navigation.navigate('Doccument Reccommend', {
      // ส่ง callback กลับมารับข้อมูล surveyData หลังทำแบบสอบถามเสร็จ
      onSurveyComplete: (data) => {
        setSurveyData(data);
        setHasCompletedSurvey(true);
      }
    });
  };

  // ฟังก์ชันจำลองการอัพโหลดไฟล์
   const handleFileUpload = async (docId) => {
    Alert.prompt(
      "อัพโหลดไฟล์",
      "พิมพ์ชื่อไฟล์เพื่อจำลองการอัพโหลด:",
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "อัพโหลด",
          onPress: async (filename) => {
            if (filename && filename.trim()) {
              setUploadProgress(prev => ({ ...prev, [docId]: 0 }));
              for (let i = 0; i <= 100; i += 10) {
                await new Promise(resolve => setTimeout(resolve, 100));
                setUploadProgress(prev => ({ ...prev, [docId]: i }));
              }
              setUploads(prev => ({
                ...prev,
                [docId]: {
                  filename: filename.trim(),
                  uploadDate: new Date().toLocaleString('th-TH'),
                  status: 'completed'
                }
              }));
              setUploadProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[docId];
                return newProgress;
              });
            }
          }
        }
      ],
      "plain-text"
    );
  };

  // ฟังก์ชันลบไฟล์ที่อัพโหลดแล้ว
  const handleRemoveFile = (docId) => {
    Alert.alert(
      "ลบไฟล์",
      "คุณต้องการลบไฟล์นี้หรือไม่?",
      [
        { text: "ยกเลิก", style: "cancel" },
        { text: "ลบ", style: "destructive", onPress: () => {
          setUploads(prev => {
            const newUploads = { ...prev };
            delete newUploads[docId];
            return newUploads;
          });
        }}
      ]
    );
  };

  // ฟังก์ชันส่งเอกสาร
  const handleSubmitDocuments = () => {
    const documents = generateDocumentsList(surveyData);
    const requiredDocs = documents.filter(doc => doc.required);
    const uploadedRequiredDocs = requiredDocs.filter(doc => uploads[doc.id]);
    
    if (uploadedRequiredDocs.length < requiredDocs.length) {
      Alert.alert(
        "เอกสารไม่ครบ",
        `คุณยังอัพโหลดเอกสารไม่ครบ (${uploadedRequiredDocs.length}/${requiredDocs.length})`,
        [{ text: "ตกลง" }]
      );
      return;
    }

    Alert.alert(
      "ส่งเอกสารสำเร็จ",
      "เอกสารของคุณได้ถูกส่งเรียบร้อยแล้ว",
      [
        { text: "ตกลง", onPress: () => {
          setHasCompletedSurvey(false);
          setSurveyData({});
          setUploads({});
          setUploadProgress({});
        }}
      ]
    );
  };

  // ฟังก์ชันรีเซ็ตและทำแบบสอบถามใหม่
  const handleRetakeSurvey = () => {
    Alert.alert(
      "ทำแบบสอบถามใหม่",
      "การทำแบบสอบถามใหม่จะลบข้อมูลและไฟล์ที่อัพโหลดทั้งหมด\nคุณแน่ใจหรือไม่?",
      [
        { text: "ยกเลิก", style: "cancel" },
        { text: "ตกลง", style: "destructive", onPress: () => {
          setHasCompletedSurvey(false);
          setSurveyData({});
          setUploads({});
          setUploadProgress({});
        }}
      ]
    );
  };
  // คำนวณสถิติการอัพโหลด
  const getUploadStats = () => {
    const documents = generateDocumentsList(surveyData);
    const requiredDocs = documents.filter(doc => doc.required);
    const uploadedDocs = documents.filter(doc => uploads[doc.id]);
    const uploadedRequiredDocs = requiredDocs.filter(doc => uploads[doc.id]);
    
    return {
      total: documents.length,
      required: requiredDocs.length,
      uploaded: uploadedDocs.length,
      uploadedRequired: uploadedRequiredDocs.length
    };
  };

  if (!hasCompletedSurvey) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>ระบบอัพโหลดเอกสาร กยศ.</Text>
          <Text style={styles.welcomeSubtitle}>
            จัดเตรียมและส่งเอกสารสำหรับการสมัครกู้ยืมเงิน กยศ. ได้ง่ายๆ ใน 3 ขั้นตอน
          </Text>
          
          <View style={styles.stepContainer}>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>ทำแบบสอบถามเพื่อตรวจสอบเอกสารที่จำเป็น</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>อัพโหลดเอกสารตามรายการที่ระบุ</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>ส่งเอกสารและรอการตรวจสอบ</Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.primaryButton} onPress={handleStartSurvey}>
            <Text style={styles.primaryButtonText}>เริ่มทำแบบสอบถาม</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const documents = generateDocumentsList(surveyData);
  const stats = getUploadStats();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header Card */}
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>อัพโหลดเอกสาร</Text>
        <Text style={styles.headerSubtitle}>
          <Text style={{ fontWeight: 'bold', color: '#3b82f6' }}>สถานภาพครอบครัว:</Text>{" "}
          {surveyData.familyStatus === 'ก' ? 'บิดามารดาอยู่ด้วยกัน' : 
            surveyData.familyStatus === 'ข' ? 'บิดา/มารดาหย่าร้าง/เสียชีวิต' : 
            'มีผู้ปกครองดูแล'}
        </Text>
        <TouchableOpacity style={styles.retakeButton} onPress={handleRetakeSurvey}>
          <Text style={styles.retakeButtonText}>ทำแบบสอบถามใหม่</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Card */}
      <View style={styles.progressCard}>
        <Text style={styles.progressTitle}>สถานะการอัพโหลด</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.uploadedRequired}</Text>
            <Text style={styles.statLabel}>อัพโหลดแล้ว</Text>
          </View>
          <Text style={styles.statDivider}>/</Text>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.required}</Text>
            <Text style={styles.statLabel}>ที่ต้องส่ง</Text>
          </View>
        </View>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${(stats.uploadedRequired / stats.required) * 100}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          {Math.round((stats.uploadedRequired / stats.required) * 100)}% เสร็จสิ้น
        </Text>
      </View>

   {/* Documents List */}
<View style={styles.documentsCard}>
  <Text style={styles.documentsTitle}>รายการเอกสารที่ต้องอัพโหลด</Text>
  {documents.map((doc, idx) => (
    <View key={doc.id} style={[
      styles.documentItem, 
      idx % 2 === 0 ? styles.documentItemEven : styles.documentItemOdd
    ]}>
      <View style={styles.documentHeader}>
        <View style={styles.documentTitleContainer}>
          <Text style={styles.documentTitle}>{doc.title}</Text>
          {doc.required && <Text style={styles.requiredBadge}>*จำเป็น</Text>}
        </View>

        {/* เพิ่มปุ่มดาวน์โหลดเอกสาร */}
        {doc.downloadUrl && (
          <TouchableOpacity
            onPress={() => {
              Linking.openURL(doc.downloadUrl).catch(() =>
                Alert.alert("ไม่สามารถดาวน์โหลดไฟล์ได้")
              );
            }}
            style={styles.downloadButton}
          >
            <Text style={styles.downloadButtonText}>⬇️</Text>
          </TouchableOpacity>
        )}
      </View>

      {doc.description ? (
        <Text style={styles.documentDescription}>{doc.description}</Text>
      ) : null}

      {/* Upload Area เดิม */}
      <View style={styles.uploadArea}>
        {uploadProgress[doc.id] !== undefined ? (
          <View style={styles.uploadProgressContainer}>
            <Text style={styles.uploadProgressText}>
              กำลังอัพโหลด... {uploadProgress[doc.id]}%
            </Text>
            <View style={styles.uploadProgressBar}>
              <View 
                style={[
                  styles.uploadProgressFill, 
                  { width: `${uploadProgress[doc.id]}%` }
                ]} 
              />
            </View>
          </View>
        ) : uploads[doc.id] ? (
          <View style={styles.uploadedContainer}>
            <View style={styles.uploadedInfo}>
              <Text style={styles.uploadedFileName}>
                ✅ {uploads[doc.id].filename}
              </Text>
              <Text style={styles.uploadedDate}>
                อัพโหลดเมื่อ: {uploads[doc.id].uploadDate}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.removeButton} 
              onPress={() => handleRemoveFile(doc.id)}
            >
              <Text style={styles.removeButtonText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.uploadButton} 
            onPress={() => handleFileUpload(doc.id)}
          >
            <Text style={styles.uploadButtonText}>📁 เลือกไฟล์</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
    
    
  ))}
</View>



      {/* Submit Button */}
      <TouchableOpacity 
        style={[
          styles.submitButton,
          stats.uploadedRequired < stats.required && styles.submitButtonDisabled
        ]} 
        onPress={handleSubmitDocuments}
        disabled={stats.uploadedRequired < stats.required}
      >
        <Text style={styles.submitButtonText}>
          {stats.uploadedRequired >= stats.required ? 'ส่งเอกสาร' : `ส่งเอกสาร (${stats.uploadedRequired}/${stats.required})`}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f0f6ff',
    padding: 16,
    paddingBottom: 40,
  },
  // Welcome Screen Styles
  welcomeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 28,
    marginBottom: 16,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 7,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  welcomeSubtitle: {
    fontSize: 17,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 26,
  },
  stepContainer: {
    width: '100%',
    marginBottom: 32,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  stepNumberText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepText: {
    flex: 1,
    fontSize: 17,
    color: '#374151',
    lineHeight: 24,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 14,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  // Header Card Styles
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 22,
    marginBottom: 16,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 23,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  retakeButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 6,
  },
  retakeButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Progress Card Styles
  progressCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statItem: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#10b981',
  },
  statLabel: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  statDivider: {
    fontSize: 22,
    color: '#64748b',
    marginHorizontal: 2,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 10,
    backgroundColor: '#e0e7ef',
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 5,
  },
  progressText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  // Documents List Styles
  documentsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  documentsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 14,
    textAlign: 'left',
  },
  documentItem: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e0e7ef',
  },
  documentItemEven: {
    backgroundColor: '#f1f5f9',
  },
  documentItemOdd: {
    backgroundColor: '#f8fafc',
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  documentTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563eb',
    marginRight: 8,
  },
  requiredBadge: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: 'bold',
    marginLeft: 2,
  },
  documentDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 6,
    marginLeft: 2,
  },
  uploadArea: {
    marginTop: 6,
  },
  uploadButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  uploadProgressContainer: {
    marginTop: 2,
    marginBottom: 2,
  },
  uploadProgressText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 2,
  },
  uploadProgressBar: {
    height: 8,
    backgroundColor: '#e0e7ef',
    borderRadius: 4,
    overflow: 'hidden',
  },
  uploadProgressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  uploadedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    backgroundColor: '#e0f2fe',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  uploadedInfo: {
    flex: 1,
  },
  uploadedFileName: {
    fontSize: 15,
    color: '#059669',
    fontWeight: 'bold',
  },
  uploadedDate: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  removeButton: {
    marginLeft: 10,
    backgroundColor: '#ef4444',
    borderRadius: 6,
    padding: 6,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Submit Button
  submitButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#a7f3d0',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  downloadButton: {
  marginLeft: 10,
  backgroundColor: '#2563eb',
  paddingVertical: 6,
  paddingHorizontal: 10,
  borderRadius: 6,
},
downloadButtonText: {
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 'bold',
},
});

export default UploadScreen;
