import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./database/firebase";
import { doc, onSnapshot, getDoc } from "firebase/firestore";

// Import all screens
import HomeScreen from "./student/HomeScreen";
import UploadScreen from "./student/UploadScreen/UploadScreen";
import SettingsScreen from "./student/Settings/SettingScreen";
import DocRecScreen from "./student/DocRecScreen/DocRecScreen";
import NewsContent from "./student/NewsContent";
import ProfileScreen from "./student/Settings/ProfileScreen";
import DocumentsHistoryScreen from "./student/Settings/DocumentsHistoryScreen";
import LoginScreen from "./authentication/LoginScreen";
import SignUpScreen from "./authentication/SignUpScreen/SignUpScreen";
import DocumentStatusScreen from "./student/DocumentStatusScreen/DocumentStatusScreen";
import DocCooldown from "./student/components/DocCooldown";
import LoanProcessStatus from "./student/LoanProcessStatus";
import NewsContentScreen from "./student/NewsContent";
import ChangePassword from "./student/Settings/ChangePassword";
import ForgotPassword from "./authentication/ForgotPassword";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Loading Screen Component
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#007AFF" />
    <Text style={styles.loadingText}>กำลังตรวจสอบการเข้าสู่ระบบ...</Text>
  </View>
);

// Create Stack Navigator for each Tab
const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="HomeMain" component={HomeScreen} />
    <Stack.Screen name="NewsContent" component={NewsContent} />
  </Stack.Navigator>
);

const DocumentManagement = () => {
  const [allDocsApproved, setAllDocsApproved] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPhase, setCurrentPhase] = useState(null);
  const [loanHistory, setLoanHistory] = useState(null);
  const [currentTerm, setCurrentTerm] = useState(null); // ✅ เพิ่ม state นี้

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setCurrentUser(user);
      
      // ✅ โหลดข้อมูลเทอมปัจจุบันจาก config
      const configRef = doc(db, "DocumentService", "config");
      getDoc(configRef).then((configDoc) => {
        if (configDoc.exists()) {
          const config = configDoc.data();
          setCurrentTerm(config.term);
        }
      });
      
      checkDocumentApprovalStatus(user.uid);
    } else {
      setIsCheckingStatus(false);
    }
  }, []);

  // ✅ แก้ไขเงื่อนไขให้ตรวจสอบเทอมปัจจุบันด้วย
  if (loanHistory?.disbursementApproved === true && 
      loanHistory.lastDisbursementApprovedTerm === currentTerm) {
    return <LoanProcessStatus />;
  }

  return <DocumentStatusScreen />;
};

const UploadStack = () => {
  const [isEnabled, setIsEnabled] = useState(null);
  const [hasSubmittedDocs, setHasSubmittedDocs] = useState(false);
  const [isCheckingSubmission, setIsCheckingSubmission] = useState(true);
  const [currentPhase, setCurrentPhase] = useState(null);
  const [currentTerm, setCurrentTerm] = useState(null);
  const [lastSubmissionTerm, setLastSubmissionTerm] = useState(null);
  const [loanHistory, setLoanHistory] = useState(null);

  useEffect(() => {
    const docRef = doc(db, "DocumentService", "config");

    const configUnsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const config = docSnap.data();
        setIsEnabled(config.immediateAccess || config.isEnabled);
        setCurrentTerm(config.term);
      } else {
        setIsEnabled(false);
      }
    });

    // ✅ เพิ่ม Real-time listener สำหรับ user data
    const checkUserSubmission = () => {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, "users", user.uid);
        
        // ✅ ใช้ onSnapshot แทน getDoc เพื่อฟังการเปลี่ยนแปลงแบบ real-time
        const userUnsubscribe = onSnapshot(userRef, (userDoc) => {
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const userLoanHistory = userData.loanHistory || {};
            
            console.log("=== UploadStack Real-time Update ===");
            console.log("hasSubmittedDocuments:", userData.hasSubmittedDocuments);
            console.log("currentPhase:", userLoanHistory.currentPhase);
            console.log("phase1Approved:", userLoanHistory.phase1Approved);
            console.log("disbursementSubmitted:", userLoanHistory.disbursementSubmitted);
            console.log("disbursementApproved:", userLoanHistory.disbursementApproved);
            console.log("lastSubmissionTerm:", userData.lastSubmissionTerm);
            console.log("currentTerm (from config):", currentTerm);
            console.log("=====================================");
            
            setHasSubmittedDocs(userData.hasSubmittedDocuments || false);
            setLastSubmissionTerm(userData.lastSubmissionTerm);
            setCurrentPhase(userLoanHistory.currentPhase);
            setLoanHistory(userLoanHistory);
          }
          setIsCheckingSubmission(false);
        });
        
        return userUnsubscribe;
      } else {
        setIsCheckingSubmission(false);
        return null;
      }
    };

    const userUnsubscribe = checkUserSubmission();

    return () => {
      configUnsubscribe();
      if (userUnsubscribe) userUnsubscribe();
    };
  }, [currentTerm]);

  if (isEnabled === null || isCheckingSubmission) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Loading" component={LoadingScreen} />
      </Stack.Navigator>
    );
  }

  console.log("=== UploadStack Decision ===");
  console.log("hasSubmittedDocs:", hasSubmittedDocs);
  console.log("currentPhase:", currentPhase);
  console.log("lastSubmissionTerm:", lastSubmissionTerm);
  console.log("currentTerm:", currentTerm);
  console.log("isEnabled:", isEnabled);
  console.log("loanHistory:", loanHistory);

  let mainComponent;
  let componentName = "";

  const isNewTerm = lastSubmissionTerm !== currentTerm;

  // ✅ ลำดับความสำคัญสูงสุด: ตรวจสอบว่าเป็นเทอมใหม่หรือไม่
  if (isNewTerm) {
    console.log(`🔄 New term detected: ${lastSubmissionTerm} → ${currentTerm}`);
    
    // เทอม 2/3 = ให้อัพโหลดเอกสารเบิกเงินได้เลย
    if (currentTerm === "2" || currentTerm === "3") {
      mainComponent = isEnabled ? UploadScreen : DocCooldown;
      componentName = isEnabled 
        ? `UploadScreen (New Term ${currentTerm} - Disbursement)` 
        : "DocCooldown";
    } 
    // เทอม 1 = ต้องทำ Phase 1 ก่อน
    else {
      mainComponent = isEnabled ? UploadScreen : DocCooldown;
      componentName = isEnabled 
        ? "UploadScreen (New Term 1 - Initial Application)" 
        : "DocCooldown";
    }
    
    console.log("isNewTerm:", isNewTerm);
    console.log("Selected component:", componentName);
    console.log("============================");
    
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="UploadMain" component={mainComponent} />
        <Stack.Screen name="DocumentStatusScreen" component={DocumentStatusScreen} />
        <Stack.Screen name="LoanProcessStatus" component={LoanProcessStatus} />
        <Stack.Screen name="UploadScreen" component={UploadScreen} />
      </Stack.Navigator>
    );
  }

  // ✅ กรณีที่อยู่ในเทอมเดียวกัน
  if (hasSubmittedDocs && !isNewTerm) {
    if (currentPhase === "completed") {
      mainComponent = LoanProcessStatus;
      componentName = "LoanProcessStatus (all approved)";
      
    } else if (currentPhase === "disbursement") {
      if (loanHistory?.disbursementSubmitted) {
        mainComponent = DocumentStatusScreen;
        componentName = "DocumentStatusScreen (awaiting disbursement approval)";
      } else {
        mainComponent = UploadScreen;
        componentName = "UploadScreen (upload disbursement docs)";
      }
      
    } else if (currentPhase === "initial_application") {
      mainComponent = DocumentStatusScreen;
      componentName = "DocumentStatusScreen (awaiting phase1 approval)";
      
    } else {
      mainComponent = DocumentStatusScreen;
      componentName = "DocumentStatusScreen (fallback)";
    }
    
  } else {
    if (currentPhase === "disbursement" && loanHistory?.phase1Approved) {
      mainComponent = isEnabled ? UploadScreen : DocCooldown;
      componentName = isEnabled 
        ? "UploadScreen (returning student - disbursement)" 
        : "DocCooldown";
        
    } else {
      mainComponent = isEnabled ? UploadScreen : DocCooldown;
      componentName = isEnabled 
        ? `UploadScreen (no submission)` 
        : "DocCooldown";
    }
  }

  console.log("isNewTerm:", isNewTerm);
  console.log("Selected component:", componentName);
  console.log("============================");

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="UploadMain" component={mainComponent} />
      <Stack.Screen name="DocumentStatusScreen" component={DocumentStatusScreen} />
      <Stack.Screen name="LoanProcessStatus" component={LoanProcessStatus} />
      <Stack.Screen name="UploadScreen" component={UploadScreen} />
    </Stack.Navigator>
  );
};

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: "#007AFF",
      tabBarInactiveTintColor: "gray",
      tabBarStyle: { paddingVertical: 5, height: 70 },
      tabBarLabelStyle: { fontSize: 12, marginBottom: 5 },
      tabBarIcon: ({ color, size }) => {
        let iconName;
        if (route.name === "หน้าหลัก") iconName = "home-outline";
        else if (route.name === "ส่งเอกสาร") iconName = "document-text-outline";
        else if (route.name === "ข้อมูลผู้ใช้") iconName = "person-outline";
        return <Ionicons name={iconName} size={size} color={color} />;
      },
    })}
  >
    <Tab.Screen name="หน้าหลัก" component={HomeStack} />
    <Tab.Screen name="ส่งเอกสาร" component={UploadStack} />
    <Tab.Screen name="ข้อมูลผู้ใช้" component={SettingsScreen} />
  </Tab.Navigator>
);

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChanged runs when the login status changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log(
        "Auth state changed:",
        user ? "User logged in" : "User logged out"
      );
      if (user) {
        // If user is logged in
        setIsAuthenticated(true);
      } else {
        // If user is logged out
        setIsAuthenticated(false);
      }
      setIsLoading(false); // Check is complete
    });

    // Return the unsubscribe function to clean up when the component unmounts
    return () => unsubscribe();
  }, []); // [] makes useEffect run only once on component mount

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <LoadingScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={isAuthenticated ? "MainTabs" : "LoginScreen"}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="LoginScreen" component={LoginScreen} />
          <Stack.Screen name="SignUpScreen" component={SignUpScreen} />
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ title: "" }}
          />
          <Stack.Screen
            name="Document Reccommend"
            component={DocRecScreen}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="ProfileScreen"
            component={ProfileScreen}
            options={{ title: "โปรไฟล์", headerShown: true }}
          />
          {/* Add DocumentStatusScreen */}
          <Stack.Screen
            name="DocumentStatusScreen"
            component={DocumentStatusScreen}
            options={{
              title: "สถานะเอกสาร",
              headerShown: false,
              headerStyle: {
                backgroundColor: "#2563eb",
              },
              headerTintColor: "#ffffff",
              headerTitleStyle: {
                fontWeight: "bold",
              },
            }}
          />
          {/* Add LoanProcessStatus */}
          <Stack.Screen
            name="LoanProcessStatus"
            component={LoanProcessStatus}
            options={{
              title: "สถานะการดำเนินการ",
              headerShown: true,
              headerStyle: {
                backgroundColor: "#2563eb",
              },
              headerTintColor: "#ffffff",
              headerTitleStyle: {
                fontWeight: "bold",
              },
            }}
          />
          {/* Add DocCooldown screen */}
          <Stack.Screen
            name="DocCooldown"
            component={DocCooldown}
            options={{
              headerShown: true,
              title: "สถานะระบบ",
              headerLeft: null, // Prevent going back
            }}
          />
          <Stack.Screen
            name="DocumentsHistoryScreen"
            component={DocumentsHistoryScreen}
            options={{ title: "ประวัติเอกสาร", headerShown: true }}
          />
          <Stack.Screen
            name="NewsContentScreen"
            component={NewsContentScreen}
            options={{ title: "รายละเอียดข่าวสาร", headerShown: true }}
          />
          <Stack.Screen
            name="ChangePassword"
            component={ChangePassword}
            options={{ title: "เปลี่ยนรหัสผ่าน", headerShown: true }}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPassword}
            options={{ title: "ลืมรหัสผ่าน", headerShown: true }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f2f5",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
});

export default App;