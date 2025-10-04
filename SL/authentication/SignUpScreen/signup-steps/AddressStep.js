import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CrossPlatformPicker from "../components/CrossPlatformPicker";
import styles from "../signup-styles/styles";

const AddressStep = ({
  provinces,
  districts,
  subDistricts,
  permDistricts,
  permSubDistricts,
  addressLoading,
  addressError,
  currentAddress,
  permAddress,
  updateCurrentAddress,
  updatePermAddress,
  handleProvinceChange,
  handleDistrictChange,
  handleSubDistrictChange,
  resetAddressSelection,
  setCurrentAddress,
  setDistricts,
  setSubDistricts,
}) => {
  const renderThaiAddressSelector = (
    addressData,
    updateFunction,
    type = "current"
  ) => {
    const currentDistricts = type === "current" ? districts : permDistricts;
    const currentSubDistricts =
      type === "current" ? subDistricts : permSubDistricts;

    const isDistrictDisabled =
      !addressData.province || currentDistricts.length === 0;
    const isSubDistrictDisabled =
      !addressData.district || currentSubDistricts.length === 0;

    // แปลง provinces เป็น format สำหรับ CrossPlatformPicker
    const provinceItems = provinces.map((p) => ({
      label: p.name_th,
      value: p.name_th,
    }));

    const districtItems = currentDistricts.map((d) => ({
      label: d.name_th,
      value: d.name_th,
    }));

    const subDistrictItems = currentSubDistricts.map((s) => ({
      label: s.name_th,
      value: s.name_th,
    }));

    return (
      <View style={styles.addressSelectorContainer}>
        {addressLoading ? (
          <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
        ) : addressError ? (
          <Text style={styles.errorText}>{addressError}</Text>
        ) : (
          <>
            {/* Province Selector */}
            <CrossPlatformPicker
              label="จังหวัด"
              selectedValue={addressData.province}
              onValueChange={(value) => {
                if (value === "") {
                  if (type === "current") {
                    resetAddressSelection("current");
                  } else {
                    resetAddressSelection("perm");
                  }
                } else {
                  updateFunction("province", value);
                  const selectedProvince = provinces.find(
                    (p) => p.name_th === value
                  );
                  handleProvinceChange(selectedProvince?.id, type);
                }
              }}
              items={provinceItems}
              placeholder="เลือกจังหวัด"
              enabled={true}
            />

            {/* District Selector */}
            <CrossPlatformPicker
              label="อำเภอ/เขต"
              selectedValue={addressData.district}
              onValueChange={(value) => {
                if (value === "") {
                  updateFunction("district", "");
                  updateFunction("sub_district", "");
                  updateFunction("zipcode", "");
                } else {
                  updateFunction("district", value);
                  const selectedDistrict = currentDistricts.find(
                    (d) => d.name_th === value
                  );
                  handleDistrictChange(selectedDistrict?.id, type);
                }
              }}
              items={districtItems}
              placeholder={
                isDistrictDisabled ? "เลือกจังหวัดก่อน" : "เลือกอำเภอ/เขต"
              }
              enabled={!isDistrictDisabled}
            />

            {/* Sub-district Selector */}
            <CrossPlatformPicker
              label="ตำบล/แขวง"
              selectedValue={addressData.sub_district}
              onValueChange={(value) => {
                if (value === "") {
                  updateFunction("sub_district", "");
                  updateFunction("zipcode", "");
                } else {
                  updateFunction("sub_district", value);
                  const selectedSubDistrict = currentSubDistricts.find(
                    (s) => s.name_th === value
                  );
                  handleSubDistrictChange(selectedSubDistrict?.id, type);
                  // Auto-fill zipcode
                  if (selectedSubDistrict?.zip_code) {
                    updateFunction("zipcode", selectedSubDistrict.zip_code);
                  }
                }
              }}
              items={subDistrictItems}
              placeholder={
                isSubDistrictDisabled ? "เลือกอำเภอก่อน" : "เลือกตำบล/แขวง"
              }
              enabled={!isSubDistrictDisabled}
            />

            {/* Zipcode Display */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>รหัสไปรษณีย์</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color="#666"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, styles.disabledInput]}
                  value={addressData.zipcode}
                  placeholder="รหัสไปรษณีย์จะแสดงอัตโนมัติ"
                  editable={false}
                />
              </View>
            </View>
          </>
        )}
      </View>
    );
  };

  const renderAddressForm = (
    addressData,
    updateFunction,
    title,
    type = "current"
  ) => (
    <View style={styles.section}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>บ้านเลขที่</Text>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="home-outline"
            size={20}
            color="#666"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="กรุณาป้อนบ้านเลขที่"
            value={addressData.house_no}
            onChangeText={(text) => updateFunction("house_no", text)}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.inputContainer, styles.halfWidth]}>
          <Text style={styles.inputLabel}>หมู่</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="หมู่"
              value={addressData.moo}
              onChangeText={(text) => updateFunction("moo", text)}
            />
          </View>
        </View>

        <View style={[styles.inputContainer, styles.halfWidth]}>
          <Text style={styles.inputLabel}>หมู่บ้าน</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="หมู่บ้าน"
              value={addressData.village}
              onChangeText={(text) => updateFunction("village", text)}
            />
          </View>
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.inputContainer, styles.halfWidth]}>
          <Text style={styles.inputLabel}>ซอย</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="ซอย"
              value={addressData.soi}
              onChangeText={(text) => updateFunction("soi", text)}
            />
          </View>
        </View>

        <View style={[styles.inputContainer, styles.halfWidth]}>
          <Text style={styles.inputLabel}>ถนน</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="ถนน"
              value={addressData.road}
              onChangeText={(text) => updateFunction("road", text)}
            />
          </View>
        </View>
      </View>

      {/* Thai Address Selector */}
      {renderThaiAddressSelector(addressData, updateFunction, type)}
    </View>
  );

  return (
    <View style={styles.stepContainer}>
      {renderAddressForm(
        permAddress,
        updatePermAddress,
        "ที่อยู่ตามทะเบียนบ้าน",
        "perm"
      )}

      <TouchableOpacity
        style={styles.copyButton}
        onPress={() => {
          setCurrentAddress({ ...permAddress });
          // Also copy the dropdown selections
          setDistricts(permDistricts);
          setSubDistricts(permSubDistricts);
        }}
      >
        <Ionicons
          name="copy-outline"
          size={16}
          color="#fff"
          style={{ marginRight: 6 }}
        />
        <Text style={styles.copyButtonText}>คัดลอกที่อยู่ตามทะเบียนบ้าน</Text>
      </TouchableOpacity>

      {renderAddressForm(
        currentAddress,
        updateCurrentAddress,
        "ที่อยู่ปัจจุบัน",
        "current"
      )}
    </View>
  );
};

export default AddressStep;
