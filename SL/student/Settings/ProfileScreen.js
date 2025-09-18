import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Animated,
  StatusBar,
  Platform,
} from "react-native";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../database/firebase";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Timestamp } from "firebase/firestore";

const ProfileScreen = ({ navigation }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({});

  // Inline edit state
  const [editingField, setEditingField] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [newValue, setNewValue] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saveAnimation] = useState(new Animated.Value(0));

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) {
        navigation.navigate("LoginScreen");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } catch (error) {
        console.error("Fetch user data error:", error);
        Alert.alert("ข้อผิดพลาด", "ไม่สามารถโหลดข้อมูลผู้ใช้ได้");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigation]);

  const saveEdit = async () => {
    if (!editingField) {
      setEditingField(null);
      return;
    }

    // Show save animation
    Animated.sequence([
      Animated.timing(saveAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(saveAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      const user = auth.currentUser;
      const userRef = doc(db, "users", user.uid);

      const keys = editingField.split(".");
      let finalValue = newValue;

      // Convert income to number if the field is income
      if (editingField === "income" || editingField.endsWith(".income")) {
        finalValue = parseInt(newValue, 10) || 0;
      }

      let updatedData = { ...userData };
      if (keys.length === 1) {
        updatedData[keys[0]] = finalValue;
      } else if (keys.length === 2) {
        if (updatedData[keys[0]]) {
          updatedData[keys[0]] = {
            ...updatedData[keys[0]],
            [keys[1]]: finalValue,
          };
        } else {
          updatedData[keys[0]] = { [keys[1]]: finalValue };
        }
      } else if (keys.length === 3) {
        if (updatedData[keys[0]] && updatedData[keys[0]][keys[1]]) {
          updatedData[keys[0]][keys[1]] = {
            ...updatedData[keys[0]][keys[1]],
            [keys[2]]: finalValue,
          };
        } else {
          updatedData[keys[0]][keys[1]] = { [keys[2]]: finalValue };
        }
      } else {
        Alert.alert("ข้อผิดพลาด", "ไม่สามารถแก้ไขข้อมูลนี้ได้");
        return;
      }

      await updateDoc(userRef, updatedData);
      setUserData(updatedData);
    } catch (error) {
      console.error("Update error:", error);
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถอัปเดตข้อมูลได้");
    } finally {
      setEditingField(null);
      setEditingSection(null);
    }
  };

  const toggleSection = (sectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const handleDateChange = useCallback(
    (event, selectedDate) => {
      setShowDatePicker(Platform.OS === "ios");
      if (selectedDate) {
        const dateTimestamp = Timestamp.fromDate(selectedDate);
        saveEditTimestamp(dateTimestamp);
      }
    },
    [editingField, editingSection, userData]
  );

  const saveEditTimestamp = async (dateTimestamp) => {
    if (!editingField) return;

    Animated.sequence([
      Animated.timing(saveAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(saveAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      const user = auth.currentUser;
      const userRef = doc(db, "users", user.uid);
      const keys = editingField.split(".");
      let updatedData = { ...userData };

      if (keys.length === 1) {
        updatedData[keys[0]] = dateTimestamp;
      } else if (keys.length === 2) {
        if (updatedData[keys[0]]) {
          updatedData[keys[0]] = {
            ...updatedData[keys[0]],
            [keys[1]]: dateTimestamp,
          };
        } else {
          updatedData[keys[0]] = { [keys[1]]: dateTimestamp };
        }
      } else if (keys.length === 3) {
        if (updatedData[keys[0]] && updatedData[keys[0]][keys[1]]) {
          updatedData[keys[0]][keys[1]] = {
            ...updatedData[keys[0]][keys[1]],
            [keys[2]]: dateTimestamp,
          };
        } else {
          updatedData[keys[0]][keys[1]] = { [keys[2]]: dateTimestamp };
        }
      } else {
        Alert.alert("ข้อผิดพลาด", "ไม่สามารถแก้ไขข้อมูลนี้ได้");
        return;
      }

      await updateDoc(userRef, updatedData);
      setUserData(updatedData);
    } catch (error) {
      console.error("Update error:", error);
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถอัปเดตข้อมูลได้");
    } finally {
      setEditingField(null);
      setEditingSection(null);
    }
  };

  const renderField = (
    label,
    value,
    section = null,
    field = null,
    icon = null,
    isLongText = false,
    inputType = "text"
  ) => {
    const fieldKey = section ? `${section}.${field}` : field;
    const isEditing = editingField === fieldKey;

    const displayValue =
      inputType === "date" && value instanceof Timestamp
        ? value.toDate().toLocaleDateString("th-TH")
        : value || "ยังไม่ได้กรอก";

    const handlePress = () => {
      setEditingSection(section);
      setEditingField(fieldKey);
      if (inputType === "date") {
        setShowDatePicker(true);
      } else {
        setNewValue(value ? value.toString() : "");
      }
    };

    return (
      <View
        style={[
          styles.fieldContainer,
          isLongText && styles.fieldContainerStacked,
        ]}
      >
        <View style={styles.fieldLabelContainer}>
          {icon && (
            <Ionicons
              name={icon}
              size={18}
              color="#2563eb"
              style={styles.fieldIcon}
            />
          )}
          <Text style={styles.fieldLabel}>{label}</Text>
        </View>

        {isEditing && inputType === "date" ? (
          <>
            <TouchableOpacity
              style={[styles.fieldValueContainer, { borderColor: "#2563eb" }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.fieldValue}>{displayValue}</Text>
              <Ionicons
                name="create-outline"
                size={16}
                color="#2563eb"
                style={styles.editIcon}
              />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={value instanceof Timestamp ? value.toDate() : new Date()}
                mode="date"
                display="default"
                onChange={handleDateChange}
              />
            )}
          </>
        ) : isEditing ? (
          <View style={styles.editContainer}>
            <TextInput
              value={newValue}
              onChangeText={setNewValue}
              style={[styles.inputInline, isLongText && styles.inputLongText]}
              autoFocus
              onBlur={saveEdit}
              returnKeyType="done"
              onSubmitEditing={saveEdit}
              placeholder="กรอกข้อมูล..."
              placeholderTextColor="#9CA3AF"
              multiline={isLongText}
              keyboardType={inputType === "numeric" ? "numeric" : "default"}
            />
            <TouchableOpacity onPress={saveEdit} style={styles.saveButton}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.fieldValueContainer,
              !value && styles.fieldValueContainerStacked,
            ]}
            onPress={handlePress}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.fieldValue,
                !value && styles.emptyValue,
                isLongText && styles.fieldValueLongText,
              ]}
            >
              {displayValue}
            </Text>
            <Ionicons
              name="create-outline"
              size={16}
              color="#9CA3AF"
              style={styles.editIcon}
            />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderAddress = (
    address,
    sectionPath,
    label,
    icon = "location-outline"
  ) => {
    if (!address) return null;

    return (
      <View style={styles.addressSection}>
        <View style={styles.addressHeader}>
          <View style={styles.addressHeaderIcon}>
            <Ionicons name={icon} size={16} color="#2563eb" />
          </View>
          <Text style={styles.addressTitle}>{label}</Text>
        </View>
        <View style={styles.addressGrid}>
          {renderField(
            "บ้านเลขที่",
            address.house_no,
            sectionPath,
            "house_no",
            "home-outline"
          )}
          {renderField("หมู่", address.moo, sectionPath, "moo")}
          {renderField("หมู่บ้าน", address.village, sectionPath, "village")}
          {renderField("ซอย", address.soi, sectionPath, "soi")}
          {renderField("ถนน", address.road, sectionPath, "road")}
          {renderField(
            "ตำบล/แขวง",
            address.sub_district,
            sectionPath,
            "sub_district"
          )}
          {renderField("อำเภอ/เขต", address.district, sectionPath, "district")}
          {renderField("จังหวัด", address.province, sectionPath, "province")}
          {renderField(
            "รหัสไปรษณีย์",
            address.zipcode,
            sectionPath,
            "zipcode",
            "mail-outline"
          )}
        </View>
      </View>
    );
  };

  const renderPersonInfo = (
    info,
    title,
    sectionPath,
    icon = "person-outline"
  ) => {
    if (!info) return null;

    const sectionKey = `person_${sectionPath}`;
    const isExpanded = expandedSections[sectionKey];

    return (
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection(sectionKey)}
          activeOpacity={0.7}
        >
          <View style={styles.sectionTitleContainer}>
            <View style={styles.sectionIconContainer}>
              <Ionicons name={icon} size={22} color="#2563eb" />
            </View>
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
          <View style={styles.chevronContainer}>
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color="#9CA3AF"
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <Animated.View style={styles.sectionContent}>
            <View style={styles.infoGrid}>
              {renderField(
                "ชื่อ-นามสกุล",
                info.name,
                sectionPath,
                "name",
                "person",
                true
              )}
              {renderField(
                "เลขบัตรประชาชน",
                info.citizen_id,
                sectionPath,
                "citizen_id",
                "card-outline"
              )}
              {renderField(
                "วันเกิด",
                info.birth_date,
                sectionPath,
                "birth_date",
                "calendar-outline",
                false,
                "date"
              )}
              {renderField(
                "สัญชาติ",
                info.nationality,
                sectionPath,
                "nationality",
                "flag-outline"
              )}
              {renderField(
                "อาชีพ",
                info.occupation,
                sectionPath,
                "occupation",
                "briefcase-outline"
              )}
              {renderField(
                "ระดับการศึกษา",
                info.education_level,
                sectionPath,
                "education_level",
                "school-outline"
              )}
              {renderField(
                "เบอร์โทรศัพท์",
                info.phone_number,
                sectionPath,
                "phone_number",
                "call-outline"
              )}
              {renderField(
                "อีเมล",
                info.email,
                sectionPath,
                "email",
                "mail-outline"
              )}
              {renderField(
                "รายได้ต่อเดือน",
                info.income,
                sectionPath,
                "income",
                "cash-outline",
                false,
                "numeric"
              )}
              {sectionPath === "guardian_info" &&
                renderField(
                  "ความสัมพันธ์",
                  info.guardian_relation,
                  sectionPath,
                  "guardian_relation",
                  "people-outline"
                )}
            </View>

            {renderAddress(
              info.address_perm,
              `${sectionPath}.address_perm`,
              "ที่อยู่ตามทะเบียนบ้าน",
              "home"
            )}
            {renderAddress(
              info.address_current,
              `${sectionPath}.address_current`,
              "ที่อยู่ปัจจุบัน",
              "location"
            )}

            {info.workplace && (
              <View style={styles.workplaceSection}>
                <View style={styles.workplaceHeader}>
                  <View style={styles.workplaceHeaderIcon}>
                    <Ionicons
                      name="business-outline"
                      size={16}
                      color="#2563eb"
                    />
                  </View>
                  <Text style={styles.workplaceTitle}>ข้อมูลที่ทำงาน</Text>
                </View>
                <View style={styles.workplaceGrid}>
                  {/* Use stacked layout for workplace name */}
                  {renderField(
                    "ชื่อสถานที่ทำงาน",
                    info.workplace.name,
                    `${sectionPath}.workplace`,
                    "name",
                    "business",
                    true
                  )}
                  {renderAddress(
                    info.workplace,
                    `${sectionPath}.workplace`,
                    "ที่อยู่ที่ทำงาน",
                    "business"
                  )}
                </View>
              </View>
            )}
          </Animated.View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#2563eb" />
        <View style={styles.loadingContent}>
          <View style={styles.loadingSpinner}>
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
          <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
        </View>
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#2563eb" />
        <View style={styles.errorIcon}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        </View>
        <Text style={styles.errorText}>ไม่พบข้อมูลผู้ใช้</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setLoading(true);
            // Retry logic here
          }}
        >
          <Text style={styles.retryButtonText}>ลองใหม่</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2563eb" />

      {/* Save Animation Overlay */}
      <Animated.View
        style={[styles.saveOverlay, { opacity: saveAnimation }]}
        pointerEvents="none"
      >
        <View style={styles.saveIndicator}>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          <Text style={styles.saveText}>บันทึกแล้ว</Text>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Enhanced Profile Summary Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person" size={32} color="#2563eb" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {userData.name || "ไม่ระบุชื่อ"}
              </Text>
              <View style={styles.profileDetails}>
                <View style={styles.profileDetailItem}>
                  <Ionicons name="school-outline" size={14} color="#6B7280" />
                  <Text style={styles.profileId}>
                    รหัส: {userData.student_id || "-"}
                  </Text>
                </View>
                <View style={styles.profileDetailItem}>
                  <Ionicons name="library-outline" size={14} color="#6B7280" />
                  <Text style={styles.profileSchool}>
                    {userData.school || "ไม่ระบุสำนักวิชา"}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Personal Information Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <View style={styles.sectionIconContainer}>
                <Ionicons
                  name="person-circle-outline"
                  size={22}
                  color="#2563eb"
                />
              </View>
              <Text style={styles.sectionTitle}>ข้อมูลส่วนตัว</Text>
            </View>
          </View>
          <View style={styles.sectionContent}>
            <View style={styles.infoGrid}>
              {renderField(
                "ชื่อ-นามสกุล",
                userData.name,
                null,
                "name",
                "person",
                true
              )}
              {renderField(
                "รหัสนักศึกษา",
                userData.student_id,
                null,
                "student_id",
                "school"
              )}
              {renderField(
                "เลขบัตรประชาชน",
                userData.citizen_id,
                null,
                "citizen_id",
                "card"
              )}
              {renderField(
                "วันเกิด",
                userData.birth_date,
                null,
                "birth_date",
                "calendar",
                false,
                "date"
              )}
              {renderField(
                "เบอร์โทรศัพท์",
                userData.phone_num,
                null,
                "phone_num",
                "call"
              )}
              {renderField("อีเมล", userData.email, null, "email", "mail")}
              {renderField(
                "สำนักวิชา",
                userData.school,
                null,
                "school",
                "library"
              )}
              {renderField("สาขาวิชา", userData.major, null, "major", "book")}
              {renderField(
                "จำนวนพี่น้อง",
                userData.siblings_count,
                null,
                "siblings_count",
                "people"
              )}
            </View>
          </View>
        </View>

        {/* Address Sections */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <View style={styles.sectionIconContainer}>
                <Ionicons name="location-outline" size={22} color="#2563eb" />
              </View>
              <Text style={styles.sectionTitle}>ที่อยู่</Text>
            </View>
          </View>
          <View style={styles.sectionContent}>
            {renderAddress(
              userData.address_current,
              "address_current",
              "ที่อยู่ปัจจุบัน",
              "location"
            )}
            {renderAddress(
              userData.address_perm,
              "address_perm",
              "ที่อยู่ตามทะเบียนบ้าน",
              "home"
            )}
          </View>
        </View>

        {/* Family Information */}
        {renderPersonInfo(
          userData.father_info,
          "ข้อมูลบิดา",
          "father_info",
          "man-outline"
        )}
        {renderPersonInfo(
          userData.mother_info,
          "ข้อมูลมารดา",
          "mother_info",
          "woman-outline"
        )}
        {renderPersonInfo(
          userData.guardian_info,
          "ข้อมูลผู้ปกครอง",
          "guardian_info",
          "people-outline"
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  header: {
    backgroundColor: "#2563eb",
    paddingTop: 44,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 6,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "white",
    flex: 1,
    textAlign: "center",
  },
  headerRight: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  loadingContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingSpinner: {
    padding: 20,
    backgroundColor: "white",
    borderRadius: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  loadingText: {
    marginTop: 24,
    fontSize: 16,
    fontWeight: "500",
    color: "#64748B",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    padding: 32,
  },
  errorIcon: {
    padding: 20,
    backgroundColor: "white",
    borderRadius: 30,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginTop: 24,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: "#2563eb",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  saveOverlay: {
    position: "absolute",
    top: 110,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: "center",
  },
  saveIndicator: {
    backgroundColor: "white",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    elevation: 12,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  saveText: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: "600",
    color: "#10B981",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  profileCard: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    padding: 24,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 20,
    borderWidth: 2,
    borderColor: "#E0E7FF",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  profileDetails: {
    gap: 4,
  },
  profileDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  profileId: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  profileSchool: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  section: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    backgroundColor: "#FAFBFC",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
  },
  chevronContainer: {
    padding: 4,
  },
  sectionContent: {
    padding: 20,
  },
  infoGrid: {
    gap: 4,
  },
  fieldContainer: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  fieldContainerStacked: {
    // For long text fields like names and workplace names
  },
  fieldLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  fieldIcon: {
    marginRight: 10,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#475569",
  },
  fieldValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    minHeight: 48,
  },
  fieldValueContainerStacked: {
    alignItems: "flex-start",
  },
  fieldValue: {
    fontSize: 15,
    color: "#1E293B",
    fontWeight: "500",
    flex: 1,
    lineHeight: 22,
  },
  fieldValueLongText: {
    paddingRight: 8,
  },
  emptyValue: {
    color: "#9CA3AF",
    fontStyle: "italic",
    fontWeight: "400",
  },
  editIcon: {
    marginLeft: 8,
  },
  editContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  inputInline: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#2563eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1E293B",
    backgroundColor: "white",
    fontWeight: "500",
    minHeight: 48,
  },
  inputLongText: {
    textAlignVertical: "top",
    minHeight: 80,
  },
  saveButton: {
    padding: 8,
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  addressSection: {
    marginTop: 20,
    padding: 20,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  addressHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  addressTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#374151",
  },
  addressGrid: {
    gap: 4,
  },
  workplaceSection: {
    marginTop: 20,
    padding: 20,
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  workplaceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  workplaceHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  workplaceTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#374151",
  },
  workplaceGrid: {
    gap: 4,
  },
  bottomSpacing: {
    height: 24,
  },
});

export default ProfileScreen;
