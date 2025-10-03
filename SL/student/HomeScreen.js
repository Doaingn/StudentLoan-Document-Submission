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
      const q = query(collection(db, "news"), orderBy("createdAt", "desc"));

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

    if (selectedFilter !== "ทั้งหมด") {
      filtered = filtered.filter((item) => item.postType === selectedFilter);
    }

    if (searchText.trim()) {
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(searchText.toLowerCase()) ||
          item.description.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    setFilteredData(filtered);
  };

  useEffect(() => {
    fetchNewsData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchText, selectedFilter, newsData]);

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const renderFilterButton = (filter) => (
    <TouchableOpacity
      key={filter}
      style={styles.filterButton}
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
      {selectedFilter === filter && <View style={styles.underline} />}
    </TouchableOpacity>
  );

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
          {item.description ? item.description.replace(/<[^>]+>/g, "") : ""}
        </Text>
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
      {/* Header with Search Bar */}
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
            placeholder="ค้นหา..."
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
    backgroundColor: "#f0f2f5",
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: "#f0f2f5",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: "#333",
  },
  filterContainer: {
    backgroundColor: "#f0f2f5",
    paddingBottom: 5,
  },
  filterList: {
    paddingHorizontal: 20,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 20,
    alignItems: "center",
  },
  activeFilterButton: {
    // ไม่ใช้แล้ว
  },
  filterText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#666",
  },
  activeFilterText: {
    color: "#007AFF",
    fontWeight: "600",
  },
  underline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#007AFF",
    borderRadius: 2,
  },
  newsList: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  newsItem: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
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
    padding: 20,
  },
  newsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  postType: {
    fontSize: 12,
    fontWeight: "500",
    color: "#007AFF",
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  dateText: {
    fontSize: 12,
    color: "#666",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
    lineHeight: 24,
  },
  description: {
    fontSize: 14,
    color: "#666",
    lineHeight: 22,
    marginBottom: 10,
  },
  mediaIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  mediaCount: {
    fontSize: 12,
    color: "#666",
    marginLeft: 6,
  },
  documentIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  documentName: {
    fontSize: 12,
    color: "#666",
    marginLeft: 6,
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    marginTop: 16,
    textAlign: "center",
  },
});

export default HomeScreen;
