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

// Component to check document approval status and render appropriate screen
const DocumentManagement = () => {
  const [allDocsApproved, setAllDocsApproved] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setCurrentUser(user);
      checkDocumentApprovalStatus(user.uid);
    } else {
      setIsCheckingStatus(false);
    }
  }, []);

  const checkDocumentApprovalStatus = async (userId) => {
    try {
      // Get app config to determine current term
      const configRef = doc(db, "DocumentService", "config");
      const configDoc = await getDoc(configRef);
      let collectionName = "document_submissions";

      if (configDoc.exists()) {
        const config = configDoc.data();
        const termId = `${config.academicYear}_${config.term}`;
        collectionName = `document_submissions_${termId}`;
      }

      // Set up real-time listener for user's document submissions
      const userDocRef = doc(db, collectionName, userId);
      const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const submissionData = docSnap.data();
          const isAllApproved = checkIfAllDocumentsApproved(submissionData);
          setAllDocsApproved(isAllApproved);
        } else {
          setAllDocsApproved(false);
        }
        setIsCheckingStatus(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error("Error checking document approval status:", error);
      setAllDocsApproved(false);
      setIsCheckingStatus(false);
    }
  };

  const checkIfAllDocumentsApproved = (submissionData) => {
    if (!submissionData) return false;

    // Check using new documentStatuses structure
    if (submissionData.documentStatuses) {
      const statuses = Object.values(submissionData.documentStatuses);
      if (statuses.length === 0) return false;

      // All documents must be approved
      return statuses.every((doc) => doc.status === "approved");
    }

    // Fallback to old structure for backward compatibility
    if (submissionData.uploads) {
      const uploads = Object.values(submissionData.uploads);
      if (uploads.length === 0) return false;

      return uploads.every((upload) => {
        const files = Array.isArray(upload) ? upload : [upload];
        return files.every((file) => file.status === "approved");
      });
    }

    return false;
  };

  if (isCheckingStatus) {
    return <LoadingScreen />;
  }

  // If all documents are approved, show loan process status
  if (allDocsApproved) {
    return <LoanProcessStatus />;
  }

  // Otherwise, show document status screen
  return <DocumentStatusScreen />;
};

const UploadStack = () => {
  const [isEnabled, setIsEnabled] = useState(null);
  const [hasSubmittedDocs, setHasSubmittedDocs] = useState(false);
  const [isCheckingSubmission, setIsCheckingSubmission] = useState(true);

  useEffect(() => {
    // Listen for changes in Firestore config
    const docRef = doc(db, "DocumentService", "config");

    const configUnsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const config = docSnap.data();
        // Check immediateAccess and isEnabled values
        setIsEnabled(config.immediateAccess || config.isEnabled);
      } else {
        setIsEnabled(false);
      }
    });

    // Check if user has submitted documents
    const checkUserSubmission = () => {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userUnsubscribe = onSnapshot(userRef, (userDoc) => {
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setHasSubmittedDocs(userData.hasSubmittedDocuments || false);
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
  }, []);

  // Show loading screen while fetching data
  if (isEnabled === null || isCheckingSubmission) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Loading" component={LoadingScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="UploadMain"
        component={
          hasSubmittedDocs
            ? DocumentManagement
            : isEnabled
            ? UploadScreen
            : DocCooldown
        }
      />
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
