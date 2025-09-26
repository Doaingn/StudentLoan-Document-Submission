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
import LoginScreen from "./LoginScreen";
import SignUpScreen from "./SignUpScreen";
import DocumentStatusScreen from "./student/DocumentStatusScreen/DocumentStatusScreen";
import DocCooldown from "./student/components/DocCooldown";
import LoanProcessStatus from "./student/LoanProcessStatus";
import NewsContentScreen from "./student/NewsContent";
import ChangePassword from "./student/Settings/ChangePassword";
import ForgotPassword from "./ForgotPassword";
import LoanRequestUpload from "./student/term2/Upload/LoanRequestUpload";
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

// Component to check document approval status and render appropriate screen
// Component to check document approval status and render appropriate screen
const DocumentManagement = () => {
  const [allDocsApproved, setAllDocsApproved] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentConfig, setCurrentConfig] = useState(null); // เก็บ config ปัจจุบัน

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setCurrentUser(user);
      
      // Listen to config changes
      const configRef = doc(db, "DocumentService", "config");
      const configUnsubscribe = onSnapshot(configRef, (configDoc) => {
        if (configDoc.exists()) {
          const newConfig = configDoc.data();
          
          // ถ้า config เปลี่ยน (เทอมหรือปีการศึกษา)
          if (currentConfig && 
              (currentConfig.term !== newConfig.term || 
               currentConfig.academicYear !== newConfig.academicYear)) {
            
            console.log(`🔄 Config changed - Term: ${currentConfig.term} -> ${newConfig.term}, Year: ${currentConfig.academicYear} -> ${newConfig.academicYear}`);
            
            // Reset states ทันที
            setAllDocsApproved(false);
            setIsCheckingStatus(true);
            
            console.log(`🔄 Reset allDocsApproved to false due to config change`);
          }
          
          setCurrentConfig(newConfig);
        }
      });

      return () => {
        configUnsubscribe();
      };
    } else {
      setIsCheckingStatus(false);
    }
  }, []); // ไม่ต้องใส่ currentConfig ใน dependency

  // useEffect แยกสำหรับเช็คสถานะเอกสาร
  useEffect(() => {
    if (currentUser && currentConfig) {
      console.log(`📋 Checking document status for user ${currentUser.uid}, term ${currentConfig.term}, year ${currentConfig.academicYear}`);
      checkDocumentApprovalStatus(currentUser.uid, currentConfig.academicYear, currentConfig.term);
    }
  }, [currentUser, currentConfig]); // จะทำงานใหม่เมื่อ config เปลี่ยน

  const checkDocumentApprovalStatus = async (userId, academicYear, term) => {
    try {
      setIsCheckingStatus(true);
      
      const termId = `${academicYear}_${term}`;
      const collectionName = `document_submissions_${termId}`;

      console.log(`🔍 Checking submissions in: ${collectionName} for user: ${userId}`);

      // Set up listener สำหรับเทอมปัจจุบัน
      const userDocRef = doc(db, collectionName, userId);
      const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        console.log(`📄 Document snapshot received for ${collectionName}`);
        
        if (docSnap.exists()) {
          const submissionData = docSnap.data();
          const isAllApproved = checkIfAllDocumentsApproved(submissionData);
          
          console.log(`✅ Document data exists. All approved: ${isAllApproved}`);
          console.log(`📊 Submission data:`, submissionData.documentStatuses);
          
          setAllDocsApproved(isAllApproved);
        } else {
          console.log(`❌ No document submission found for ${collectionName}`);
          setAllDocsApproved(false);
        }
        setIsCheckingStatus(false);
      }, (error) => {
        console.error("❌ Error listening to document status:", error);
        setAllDocsApproved(false);
        setIsCheckingStatus(false);
      });

      // Return unsubscribe function สำหรับ cleanup
      return unsubscribe;

    } catch (error) {
      console.error("❌ Error in checkDocumentApprovalStatus:", error);
      setAllDocsApproved(false);
      setIsCheckingStatus(false);
    }
  };

  const checkIfAllDocumentsApproved = (submissionData) => {
    if (!submissionData) {
      console.log("❌ No submission data");
      return false;
    }

    // Check using new documentStatuses structure
    if (submissionData.documentStatuses) {
      const statuses = Object.values(submissionData.documentStatuses);
      console.log(`📋 Document statuses found: ${statuses.length} documents`);
      
      if (statuses.length === 0) {
        console.log("❌ No documents in documentStatuses");
        return false;
      }

      const allApproved = statuses.every((doc) => doc.status === "approved");
      console.log(`✅ All documents approved: ${allApproved}`);
      
      // Log individual document statuses
      statuses.forEach((doc, index) => {
        console.log(`📄 Document ${index}: ${doc.status}`);
      });
      
      return allApproved;
    }

    // Fallback to old structure
    if (submissionData.uploads) {
      console.log("📋 Using legacy uploads structure");
      const uploads = Object.values(submissionData.uploads);
      if (uploads.length === 0) return false;

      return uploads.every((upload) => {
        const files = Array.isArray(upload) ? upload : [upload];
        return files.every((file) => file.status === "approved");
      });
    }

    console.log("❌ No valid document structure found");
    return false;
  };

  // Debug logging
  console.log(`🔍 DocumentManagement render - isCheckingStatus: ${isCheckingStatus}, allDocsApproved: ${allDocsApproved}`);
  console.log(`📋 Current config:`, currentConfig);

  if (isCheckingStatus) {
    console.log("⏳ Showing loading screen");
    return <LoadingScreen />;
  }

  if (allDocsApproved) {
    console.log("✅ All documents approved - showing LoanProcessStatus");
    return <LoanProcessStatus />;
  }

  console.log("📄 Documents not all approved - showing DocumentStatusScreen");
  return <DocumentStatusScreen />;
};

const UploadStack = () => {
  const [isEnabled, setIsEnabled] = useState(null);
  const [hasSubmittedDocs, setHasSubmittedDocs] = useState(false);
  const [isCheckingSubmission, setIsCheckingSubmission] = useState(true);
  const [currentConfig, setCurrentConfig] = useState(null);

  useEffect(() => {
    // Listen for changes in Firestore config
    const docRef = doc(db, "DocumentService", "config");

    const configUnsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const newConfig = docSnap.data();
        
        console.log("🔧 Config update received:", newConfig);
        
        // ถ้า config เปลี่ยน (เทอมหรือปีการศึกษา)
        if (currentConfig && 
            (currentConfig.term !== newConfig.term || 
             currentConfig.academicYear !== newConfig.academicYear)) {
          
          console.log(`🔄 Config changed in UploadStack - Term: ${currentConfig.term} -> ${newConfig.term}, Year: ${currentConfig.academicYear} -> ${newConfig.academicYear}`);
          
          // Reset submission status ทันที
          setHasSubmittedDocs(false);
          setIsCheckingSubmission(true);
          
          console.log("🔄 Reset hasSubmittedDocs to false in UploadStack");
        }
        
        setCurrentConfig(newConfig);
        setIsEnabled(newConfig.immediateAccess || newConfig.isEnabled);
        
      } else {
        setIsEnabled(false);
        setIsCheckingSubmission(false);
      }
    });

    return () => {
      configUnsubscribe();
    };
  }, []); // ไม่ใส่ currentConfig ใน dependencies

  // useEffect แยกสำหรับเช็คสถานะ submission
  useEffect(() => {
    if (currentConfig) {
      console.log(`🔍 Checking submission status for config:`, currentConfig);
      checkUserSubmissionForTerm(currentConfig.academicYear, currentConfig.term);
    }
  }, [currentConfig]); // จะทำงานใหม่เมื่อ config เปลี่ยน

  const checkUserSubmissionForTerm = async (academicYear, term) => {
    const user = auth.currentUser;
    if (!user) {
      console.log("❌ No current user");
      setIsCheckingSubmission(false);
      return;
    }

    try {
      setIsCheckingSubmission(true);
      
      const termId = `${academicYear}_${term}`;
      const collectionName = `document_submissions_${termId}`;
      const submissionRef = doc(db, collectionName, user.uid);
      
      console.log(`🔍 Checking submission in: ${collectionName} for user: ${user.uid}`);
      
      const submissionUnsubscribe = onSnapshot(submissionRef, (submissionDoc) => {
        const hasSubmitted = submissionDoc.exists();
        
        console.log(`📄 Submission check result for ${collectionName}: ${hasSubmitted}`);
        
        if (submissionDoc.exists()) {
          console.log("📊 Submission data:", submissionDoc.data());
        }
        
        setHasSubmittedDocs(hasSubmitted);
        setIsCheckingSubmission(false);
      }, (error) => {
        console.error("❌ Error checking submission:", error);
        setHasSubmittedDocs(false);
        setIsCheckingSubmission(false);
      });

      return submissionUnsubscribe;
    } catch (error) {
      console.error("❌ Error in checkUserSubmissionForTerm:", error);
      setHasSubmittedDocs(false);
      setIsCheckingSubmission(false);
    }
  };

  // Debug logging
  console.log(`🔍 UploadStack render - isEnabled: ${isEnabled}, hasSubmittedDocs: ${hasSubmittedDocs}, isCheckingSubmission: ${isCheckingSubmission}`);
  console.log(`📋 Current config in UploadStack:`, currentConfig);

  // Show loading screen while fetching data
  if (isEnabled === null || isCheckingSubmission) {
    console.log("⏳ UploadStack showing loading screen");
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Loading" component={LoadingScreen} />
      </Stack.Navigator>
    );
  }

  let targetComponent;
  if (hasSubmittedDocs) {
    console.log("📄 Has submitted docs - showing DocumentManagement");
    targetComponent = DocumentManagement;
  } else if (isEnabled) {
    console.log("✅ Upload enabled - showing UploadScreen");
    targetComponent = UploadScreen;
  } else {
    console.log("🚫 Upload disabled - showing DocCooldown");
    targetComponent = DocCooldown;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="UploadMain" component={targetComponent} />
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
