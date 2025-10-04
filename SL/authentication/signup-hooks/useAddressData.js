import { useState, useEffect } from "react";

export const useAddressData = () => {
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [subDistricts, setSubDistricts] = useState([]);
  const [permDistricts, setPermDistricts] = useState([]);
  const [permSubDistricts, setPermSubDistricts] = useState([]);
  const [addressLoading, setAddressLoading] = useState(true);
  const [addressError, setAddressError] = useState("");

  // Fetch provinces data on component mount
  useEffect(() => {
    const fetchProvinces = async () => {
      try {
        setAddressLoading(true);
        setAddressError("");
        const response = await fetch(
          "https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/province_with_district_and_sub_district.json"
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        // Sort provinces by Thai name
        data.sort((a, b) =>
          (a.name_th || "").localeCompare(b.name_th || "", "th")
        );
        setProvinces(data);
      } catch (error) {
        setAddressError("Failed to load address data. Please try again.");
        console.error("Error loading provinces:", error);
      } finally {
        setAddressLoading(false);
      }
    };

    fetchProvinces();
  }, []);

  // Helper function to reset address selection
  const resetAddressSelection = (type = "current") => {
    if (type === "current") {
      setDistricts([]);
      setSubDistricts([]);
    } else if (type === "perm") {
      setPermDistricts([]);
      setPermSubDistricts([]);
    }
  };

  // Handle province selection for current address
  const handleProvinceChange = (provinceId, type = "current") => {
    if (!provinceId) {
      resetAddressSelection(type);
      return;
    }

    const province = provinces.find((p) => p.id === provinceId);
    const districtList = (province?.districts || [])
      .slice()
      .sort((a, b) => (a.name_th || "").localeCompare(b.name_th || "", "th"));

    if (type === "current") {
      setDistricts(districtList);
      setSubDistricts([]);
    } else {
      setPermDistricts(districtList);
      setPermSubDistricts([]);
    }
  };

  // Handle district selection for current address
  const handleDistrictChange = (districtId, type = "current") => {
    if (!districtId) {
      if (type === "current") {
        setSubDistricts([]);
      } else {
        setPermSubDistricts([]);
      }
      return;
    }

    const districtList = type === "current" ? districts : permDistricts;
    const district = districtList.find((d) => d.id === districtId);
    const subDistrictList = (district?.sub_districts || [])
      .slice()
      .sort((a, b) => (a.name_th || "").localeCompare(b.name_th || "", "th"));

    if (type === "current") {
      setSubDistricts(subDistrictList);
    } else {
      setPermSubDistricts(subDistrictList);
    }
  };

  // Handle sub-district selection for current address
  const handleSubDistrictChange = (subDistrictId, type = "current") => {
    if (!subDistrictId) {
      return;
    }

    const subDistrictList =
      type === "current" ? subDistricts : permSubDistricts;
    const subDistrict = subDistrictList.find((s) => s.id === subDistrictId);

    // Note: The actual zipcode setting is handled in the parent component
    // This function mainly handles the selection logic
    return subDistrict;
  };

  // Get districts by province name
  const getDistrictsByProvinceName = (provinceName, type = "current") => {
    const province = provinces.find((p) => p.name_th === provinceName);
    if (!province) return [];

    const districtList = (province?.districts || [])
      .slice()
      .sort((a, b) => (a.name_th || "").localeCompare(b.name_th || "", "th"));

    return districtList;
  };

  // Get sub-districts by district name
  const getSubDistrictsByDistrictName = (districtName, type = "current") => {
    const districtList = type === "current" ? districts : permDistricts;
    const district = districtList.find((d) => d.name_th === districtName);
    if (!district) return [];

    const subDistrictList = (district?.sub_districts || [])
      .slice()
      .sort((a, b) => (a.name_th || "").localeCompare(b.name_th || "", "th"));

    return subDistrictList;
  };

  // Get zipcode by sub-district name
  const getZipcodeBySubDistrictName = (subDistrictName, type = "current") => {
    const subDistrictList =
      type === "current" ? subDistricts : permSubDistricts;
    const subDistrict = subDistrictList.find(
      (s) => s.name_th === subDistrictName
    );
    return subDistrict?.zip_code || "";
  };

  // Preload address data for a specific province (useful for editing existing data)
  const preloadAddressData = async (
    provinceName,
    districtName,
    subDistrictName,
    type = "current"
  ) => {
    if (!provinceName) return;

    // Find the province
    const province = provinces.find((p) => p.name_th === provinceName);
    if (!province) return;

    // Load districts for this province
    const districtList = (province.districts || [])
      .slice()
      .sort((a, b) => (a.name_th || "").localeCompare(b.name_th || "", "th"));

    if (type === "current") {
      setDistricts(districtList);
    } else {
      setPermDistricts(districtList);
    }

    // If district is specified, load sub-districts
    if (districtName) {
      const district = districtList.find((d) => d.name_th === districtName);
      if (district) {
        const subDistrictList = (district.sub_districts || [])
          .slice()
          .sort((a, b) =>
            (a.name_th || "").localeCompare(b.name_th || "", "th")
          );

        if (type === "current") {
          setSubDistricts(subDistrictList);
        } else {
          setPermSubDistricts(subDistrictList);
        }
      }
    }
  };

  return {
    // State
    provinces,
    districts,
    subDistricts,
    permDistricts,
    permSubDistricts,
    addressLoading,
    addressError,

    // Setters
    setDistricts,
    setSubDistricts,
    setPermDistricts,
    setPermSubDistricts,
    setAddressLoading,
    setAddressError,

    // Functions
    resetAddressSelection,
    handleProvinceChange,
    handleDistrictChange,
    handleSubDistrictChange,
    getDistrictsByProvinceName,
    getSubDistrictsByDistrictName,
    getZipcodeBySubDistrictName,
    preloadAddressData,
  };
};

export default useAddressData;
