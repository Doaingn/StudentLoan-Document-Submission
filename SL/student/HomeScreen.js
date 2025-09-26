import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../database/firebase";
import { Ionicons } from "@expo/vector-icons";

const HomeScreen = ({ navigation }) => {
  const [newsData, setNewsData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("ทั้งหมด");

  const filterOptions = [
    "ทั้งหมด",
    "ทั่วไป",
    "ทุนการศึกษา",
    "ชั่วโมงจิตอาสา",
    "จ้างงาน",
  ];

  // ดึงข้อมูลจาก Firebase
  const fetchNewsData = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "news"), // เปลี่ยนชื่อ collection ตามที่ใช้จริง
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const data = [];

      querySnapshot.forEach((doc) => {
        const docData = doc.data();
        data.push({
          id: doc.id,
          title: docData.title || "",
          description: docData.description || "",
          bannerURL: docData.bannerURL || "",
          postType: docData.postType || "ทั่วไป",
          createdAt: docData.createdAt || null,
          documentName: docData.documentName || "",
          documentURL: docData.documentURL || "",
          mediaURLs: docData.mediaURLs || [],
          ...docData,
        });
      });

      setNewsData(data);
      setFilteredData(data);
    } catch (error) {
      console.error("Error fetching news data: ", error);
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  // Filter และ Search
  const applyFilters = () => {
    let filtered = [...newsData];

    // Apply filter by postType
    if (selectedFilter !== "ทั้งหมด") {
      filtered = filtered.filter((item) => item.postType === selectedFilter);
    }

    // Apply search
    if (searchText.trim()) {
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(searchText.toLowerCase()) ||
          item.description.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    setFilteredData(filtered);
  };

  // useEffect สำหรับดึงข้อมูลครั้งแรก
  useEffect(() => {
    fetchNewsData();
  }, []);

  // useEffect สำหรับ filter และ search
  useEffect(() => {
    applyFilters();
  }, [searchText, selectedFilter, newsData]);

  // Format วันที่
  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Render Filter Buttons
  const renderFilterButton = (filter) => (
    <TouchableOpacity
      key={filter}
      style={[
        styles.filterButton,
        selectedFilter === filter && styles.activeFilterButton,
      ]}
      onPress={() => setSelectedFilter(filter)}
    >
      <Text
        style={[
          styles.filterText,
          selectedFilter === filter && styles.activeFilterText,
        ]}
      >
        {filter}
      </Text>
    </TouchableOpacity>
  );

  // Render News Item
  const renderNewsItem = ({ item }) => (
    <TouchableOpacity
      style={styles.newsItem}
      onPress={() => {
        navigation.navigate("NewsContentScreen", { item: item });
      }}
    >
      {item.bannerURL ? (
        <Image source={{ uri: item.bannerURL }} style={styles.bannerImage} />
      ) : (
        <View style={styles.placeholderImage}>
          <Ionicons name="image-outline" size={40} color="#ccc" />
        </View>
      )}

      <View style={styles.newsContent}>
        <View style={styles.newsHeader}>
          <Text style={styles.postType}>{item.postType}</Text>
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.description} numberOfLines={3}>
          {item.description
            ? item.description.replace(/<[^>]+>/g, "") // ลบ tag HTML เช่น <p> </p>
            : ""}
        </Text>

        {item.mediaURLs && item.mediaURLs.length > 0 && (
          <View style={styles.mediaIndicator}>
            <Ionicons name="images-outline" size={16} color="#666" />
            <Text style={styles.mediaCount}>
              {item.mediaURLs.length} รูปภาพ
            </Text>
          </View>
        )}

        {item.documentURL && (
          <View style={styles.documentIndicator}>
            <Ionicons name="document-attach-outline" size={16} color="#666" />
            <Text style={styles.documentName}>{item.documentName}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>กำลังโหลด...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Search Bar and Profile */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color="#666"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="ค้นหาข่าวสาร..."
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <FlatList
          data={filterOptions}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => renderFilterButton(item)}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterList}
        />
      </View>

      {/* News List */}
      <FlatList
        data={filteredData}
        renderItem={renderNewsItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.newsList}
        refreshing={loading}
        onRefresh={fetchNewsData}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="newspaper-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>ไม่มีข่าวสารที่ตรงกับการค้นหา</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 20,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  profileButton: {
    padding: 4,
  },
  filterContainer: {
    backgroundColor: "#f5f5f5", // เปลี่ยนให้เหมือน container
    paddingVertical: 8,
    borderBottomColor: "#e0e0e0",
  },
  filterList: {
    paddingHorizontal: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#ffffff",
  },
  activeFilterButton: {
    backgroundColor: "#007AFF",
  },
  filterText: {
    fontSize: 14,
    color: "#666",
  },
  activeFilterText: {
    color: "#fff",
  },
  newsList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  newsItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  bannerImage: {
    width: "100%",
    height: 200,
  },
  placeholderImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  newsContent: {
    padding: 16,
  },
  newsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  postType: {
    fontSize: 12,
    color: "#007AFF",
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateText: {
    fontSize: 12,
    color: "#666",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 8,
  },
  mediaIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  mediaCount: {
    fontSize: 12,
    color: "#666",
    marginLeft: 4,
  },
  documentIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  documentName: {
    fontSize: 12,
    color: "#666",
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    marginTop: 16,
    textAlign: "center",
  },
});

export default HomeScreen;
