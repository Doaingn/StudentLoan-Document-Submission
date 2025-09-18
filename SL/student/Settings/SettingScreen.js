import {
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { signOut } from "firebase/auth";
import { auth, db } from "../../database/firebase";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

const SettingsScreen = ({ navigation }) => {
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) {
        navigation.navigate("LoginScreen");
        return;
      }

      try {
        // ดึงข้อมูลจาก Firestore เหมือนกับ ProfileScreen
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setStudentName(userData.name || "ผู้ใช้งาน");
        } else {
          // ถ้าไม่มีข้อมูลใน Firestore ให้ใช้จาก Firebase Auth
          setStudentName(user.displayName || "ผู้ใช้งาน");
        }
      } catch (error) {
        console.error("Fetch user data error:", error);
        // ถ้าเกิดข้อผิดพลาดในการดึงข้อมูล ให้ใช้จาก Firebase Auth เป็น fallback
        setStudentName(user.displayName || "ผู้ใช้งาน");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigation]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.reset({
        index: 0,
        routes: [{ name: "LoginScreen" }],
      });
    } catch (error) {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถออกจากระบบได้");
      console.error("Logout error:", error);
    }
  };

  const confirmLogout = () => {
    Alert.alert("ยืนยันการออกจากระบบ", "คุณต้องการออกจากระบบใช่หรือไม่?", [
      {
        text: "ยกเลิก",
        style: "cancel",
      },
      {
        text: "ออกจากระบบ",
        style: "destructive",
        onPress: handleLogout,
      },
    ]);
  };

  const navigateToProfile = () => {
    navigation.navigate("ProfileScreen");
  };

  const navigateToDocumentsHistoryScreen = () => {
    navigation.navigate("DocumentsHistoryScreen");
  };

  const navigateToChangePassword = () => {
    navigation.navigate("ChangePassword");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ข้อมูลผู้ใช้</Text>
      <View style={styles.studentNameContainer}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color="#333"
            style={styles.loadingIndicator}
          />
        ) : (
          <Text style={styles.studentName}>{studentName}</Text>
        )}
      </View>

      <View style={styles.settingsContainer}>
        <TouchableOpacity
          style={styles.settingItem}
          onPress={navigateToProfile}
        >
          <View style={styles.leftContent}>
            <Ionicons name="person-outline" size={16} color="blue" />
            <Text style={styles.settingText}>ข้อมูลส่วนตัว</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingsContainer}>
        <TouchableOpacity
          style={styles.settingItem}
          onPress={navigateToDocumentsHistoryScreen}
        >
          <View style={styles.leftContent}>
            <Ionicons name="document-text-outline" size={16} color="blue" />
            <Text style={styles.settingText}>ประวัติเอกสาร</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingsContainer}>
        <TouchableOpacity
          style={styles.settingItem}
          onPress={navigateToChangePassword}
        >
          <View style={styles.leftContent}>
            <Ionicons name="key-outline" size={16} color="blue" />
            <Text style={styles.settingText}>เปลี่ยนรหัสผ่าน</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.logoutContainer}>
        <Button title="ออกจากระบบ" onPress={confirmLogout} color="#ff4444" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 50,
    flex: 1,
    padding: 20,
    backgroundColor: "#f0f2f5",
  },
  leftContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  studentNameContainer: {
    alignItems: "center",
    marginBottom: 20,
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    alignItems: "left",
  },
  welcomeText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 5,
  },
  studentName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    alignItems: "left",
    justifyContent: "left",
    selfAlign: "left",
  },
  loadingIndicator: {
    marginTop: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
    color: "#333",
  },
  settingsContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  settingText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
    marginLeft: 10,
  },
  arrow: {
    fontSize: 20,
    color: "#ccc",
    fontWeight: "bold",
  },
  logoutContainer: {
    marginTop: "auto",
    marginBottom: 50,
  },
});

export default SettingsScreen;
