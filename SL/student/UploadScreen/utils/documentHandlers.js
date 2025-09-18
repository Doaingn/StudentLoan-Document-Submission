// utils/documentHandlers.js
import { Alert, Linking } from "react-native";
import { InsertForm101 } from "../../documents/InsertForm101";
import { ConsentFrom_student } from "../../documents/ConsentFrom_student";
import { ConsentFrom_father } from "../../documents/ConsentFrom_father";
import { ConsentFrom_mother } from "../../documents/ConsentFrom_mother";
import { Income102 } from "../../documents/income102";
import { FamStatus_cert } from "../../documents/FamStatus_cert";

export const handleDocumentDownload = (docId, downloadUrl) => {
  if (docId === "form_101") {
    InsertForm101();
  } else if (docId === "consent_student_form") {
    ConsentFrom_student();
  } else if (docId === "consent_father_form") {
    ConsentFrom_father();
  } else if (docId === "consent_mother_form") {
    ConsentFrom_mother();
  } else if (
    docId === "guardian_income_cert" ||
    docId === "father_income_cert" ||
    docId === "mother_income_cert" ||
    docId === "single_parent_income_cert" ||
    docId === "famo_income_cert"
  ) {
    Income102();
  } else if (docId === "family_status_cert") {
    FamStatus_cert();
  } else if (downloadUrl) {
    Linking.openURL(downloadUrl).catch(() =>
      Alert.alert("ไม่สามารถดาวน์โหลดไฟล์ได้")
    );
  } else {
    Alert.alert("ไม่พบไฟล์", "ไม่สามารถดาวน์โหลดไฟล์นี้ได้ในขณะนี้");
  }
};

