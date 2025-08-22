import React from "react";
import {
  View,
  Text,
  Button,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { storage } from "../database/firebase";
import { ref, getDownloadURL } from "firebase/storage";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Buffer } from "buffer";

const InsertForm = () => {
  const formData = {
    fullName: "สมชาย ใจดี ญ ฏ ฐ ชู ชุ ญู ญุ",
    idCard: "1234567890123",
    address: "123/45 หมู่ 6 ต.ทดสอบ อ.เมือง จ.กรุงเทพฯ",
    phone: "0812345678",
    email: "somchai@example.com",
  };

  const handleSubmit = async () => {
    try {
      // 1. โหลด PDF template จาก Firebase Storage
      const pdfRef = ref(storage, "กยศ.102.pdf"); // ปรับ path ให้ตรงกับ Storage
      const pdfUrl = await getDownloadURL(pdfRef);
      const existingPdfBytes = await fetch(pdfUrl).then((res) =>
        res.arrayBuffer()
      );

      // 2. โหลดฟอนต์ไทยจาก Firebase Storage
      const fontRef = ref(storage, "assets/fonts/Sarabun-Thin.ttf"); // path ที่อัปโหลดฟอนต์
      const fontUrl = await getDownloadURL(fontRef);
      const fontBytes = await fetch(fontUrl).then((res) => res.arrayBuffer());

      // 3. โหลด PDF
      const pdfDoc = await PDFDocument.load(existingPdfBytes);

      // register fontkit สำหรับฟอนต์ custom
      pdfDoc.registerFontkit(fontkit);

      // embed ฟอนต์ไทย
      const customFont = await pdfDoc.embedFont(fontBytes);

      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      // 4. วางข้อมูลลง PDF (ปรับ x, y ตามช่องฟอร์ม)
      firstPage.drawText(formData.fullName, {
        x: 131.76,
        y: 679,
        size: 10,
        font: customFont,
        color: rgb(0, 0, 0),
      });
      //   firstPage.drawText(formData.idCard, {
      //     x: 100,
      //     y: 680,
      //     size: 12,
      //     font: customFont,
      //   });
      //   firstPage.drawText(formData.address, {
      //     x: 100,
      //     y: 660,
      //     size: 12,
      //     font: customFont,
      //   });
      //   firstPage.drawText(formData.phone, {
      //     x: 100,
      //     y: 640,
      //     size: 12,
      //     font: customFont,
      //   });
      //   firstPage.drawText(formData.email, {
      //     x: 100,
      //     y: 620,
      //     size: 12,
      //     font: customFont,
      //   });

      // 5. บันทึก PDF → แปลงเป็น Base64 ก่อนเขียน
      const pdfBytes = await pdfDoc.save();
      const base64Pdf = Buffer.from(pdfBytes).toString("base64");

      const filePath = FileSystem.documentDirectory + "filled-kyc102.pdf";
      await FileSystem.writeAsStringAsync(filePath, base64Pdf, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 6. แชร์/ดาวน์โหลด
      await Sharing.shareAsync(filePath);
      Alert.alert("สำเร็จ", "สร้าง PDF เรียบร้อยแล้ว");
    } catch (error) {
      console.error("Error filling PDF:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถสร้าง PDF ได้");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>ข้อมูลฟอร์ม กยศ 102</Text>
      {Object.entries(formData).map(([key, value]) => (
        <View key={key} style={styles.field}>
          <Text style={styles.label}>{key}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
      <Button title="บันทึกลง PDF" onPress={handleSubmit} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 20 },
  field: { marginBottom: 15 },
  label: { fontWeight: "bold", marginBottom: 5 },
  value: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#f9f9f9",
  },
});

export default InsertForm;
