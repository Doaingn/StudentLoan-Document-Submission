import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import CrossPlatformPicker from "../components/CrossPlatformPicker";
import styles from "../signup-styles/styles";

const ParentInfoStep = ({
  personData,
  updatePersonFunction,
  updateAddressFunction,
  title,
  type,
  isDatePickerVisible,
  showDatePicker,
  hideDatePicker,
  handleConfirm,
  provinces,
  districts,
  subDistricts,
  addressLoading,
  addressError,
  handleProvinceChange,
  handleDistrictChange,
  handleSubDistrictChange,
  resetAddressSelection,
  copyPermToCurrent,
  setPersonInfo,
}) => {
  const renderThaiAddressSelector = (
    addressData,
    updateFunction,
    addressType = "current"
  ) => {
    const currentDistricts = districts;
    const currentSubDistricts = subDistricts;

    const isDistrictDisabled =
      !addressData.province || currentDistricts.length === 0;
    const isSubDistrictDisabled =
      !addressData.district || currentSubDistricts.length === 0;

    // แปลงข้อมูลเป็น format สำหรับ CrossPlatformPicker
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
                  resetAddressSelection(addressType);
                } else {
                  updateFunction("province", value);
                  const selectedProvince = provinces.find(
                    (p) => p.name_th === value
                  );
                  handleProvinceChange(selectedProvince?.id, addressType);
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
                  handleDistrictChange(selectedDistrict?.id, addressType);
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
                  handleSubDistrictChange(selectedSubDistrict?.id, addressType);
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

  const renderAddressForm = (addressData, updateFunction, title) => (
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
      {renderThaiAddressSelector(addressData, updateFunction, "current")}
    </View>
  );

  return (
    <View style={styles.stepContainer}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>ชื่อ-นามสกุล</Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="person-outline"
              size={20}
              color="#666"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="กรุณาป้อนชื่อ-นามสกุล"
              value={personData.name}
              onChangeText={(text) => updatePersonFunction("name", text)}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>เลขบัตรประชาชน</Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="card-outline"
              size={20}
              color="#666"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="กรุณาป้อนเลขบัตรประชาชน"
              value={personData.citizen_id}
              onChangeText={(text) => updatePersonFunction("citizen_id", text)}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputContainer, styles.halfWidth]}>
            <Text style={styles.inputLabel}>วันเกิด</Text>
            <TouchableOpacity
              style={styles.inputWrapper}
              onPress={showDatePicker}
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <Text
                style={[
                  styles.dateText,
                  !personData.birth_date && styles.placeholderText,
                ]}
              >
                {personData.birth_date
                  ? personData.birth_date.toDate().toLocaleDateString("th-TH")
                  : "เลือกวันเกิด"}
              </Text>
            </TouchableOpacity>
          </View>

          <DateTimePickerModal
            isVisible={isDatePickerVisible}
            mode="date"
            onConfirm={handleConfirm}
            onCancel={hideDatePicker}
            display="spinner"
            locale="th-TH"
            maximumDate={new Date()}
            textColor="#000"
          />

          <View style={[styles.inputContainer, styles.halfWidth]}>
            <Text style={styles.inputLabel}>สัญชาติ</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="สัญชาติ"
                value={personData.nationality}
                onChangeText={(text) =>
                  updatePersonFunction("nationality", text)
                }
              />
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputContainer, styles.halfWidth]}>
            <Text style={styles.inputLabel}>อาชีพ</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="อาชีพ"
                value={personData.occupation}
                onChangeText={(text) =>
                  updatePersonFunction("occupation", text)
                }
              />
            </View>
          </View>

          <View style={[styles.inputContainer, styles.halfWidth]}>
            <Text style={styles.inputLabel}>ระดับการศึกษา</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="ระดับการศึกษา"
                value={personData.education_level}
                onChangeText={(text) =>
                  updatePersonFunction("education_level", text)
                }
              />
            </View>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>เบอร์โทรศัพท์</Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="call-outline"
              size={20}
              color="#666"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="กรุณาป้อนเบอร์โทรศัพท์"
              value={personData.phone_number}
              onChangeText={(text) =>
                updatePersonFunction("phone_number", text)
              }
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>อีเมล</Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="mail-outline"
              size={20}
              color="#666"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="กรุณาป้อนอีเมลหากไม่มีอีเมลให้ป้อน '-'"
              value={personData.email}
              onChangeText={(text) => updatePersonFunction("email", text)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>รายได้ต่อเดือน</Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="cash-outline"
              size={20}
              color="#666"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="กรุณาป้อนรายได้ต่อเดือน"
              value={personData.income}
              onChangeText={(text) => updatePersonFunction("income", text)}
              keyboardType="numeric"
            />
          </View>
        </View>

        <Text style={styles.subTitle}>ที่อยู่ตามทะเบียนบ้าน</Text>
        {renderAddressForm(
          personData.address_perm,
          (field, value) => updateAddressFunction("address_perm", field, value),
          ""
        )}

        <Text style={styles.subTitle}>ที่อยู่ปัจจุบัน</Text>
        <TouchableOpacity
          style={styles.copyButton}
          onPress={() =>
            copyPermToCurrent(setPersonInfo, personData.address_perm)
          }
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
          personData.address_current,
          (field, value) =>
            updateAddressFunction("address_current", field, value),
          ""
        )}

        <Text style={styles.subTitle}>ข้อมูลที่ทำงาน</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>ชื่อสถานที่ทำงาน</Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="briefcase-outline"
              size={20}
              color="#666"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="กรุณาป้อนชื่อสถานที่ทำงาน"
              value={personData.workplace.name}
              onChangeText={(text) =>
                updatePersonFunction("workplace", {
                  ...personData.workplace,
                  name: text,
                })
              }
            />
          </View>
        </View>
        {renderAddressForm(
          personData.workplace,
          (field, value) =>
            updatePersonFunction("workplace", {
              ...personData.workplace,
              [field]: value,
            }),
          ""
        )}
      </View>
    </View>
  );
};

export default ParentInfoStep;
