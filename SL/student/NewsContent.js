import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import RenderHtml from "react-native-render-html";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../database/firebase";

const NewsContent = ({ route }) => {
  const { newsId, item: passedItem } = route.params || {};
  const [item, setItem] = useState(passedItem || null);
  const [loading, setLoading] = useState(!passedItem);
  const [imageHeights, setImageHeights] = useState({});
  const { width } = Dimensions.get("window");

  useEffect(() => {
    if (passedItem) {
      return;
    }

    if (!newsId) {
      console.error("No newsId provided");
      setLoading(false);
      return;
    }

    const fetchNewsItem = async () => {
      try {
        console.log("Fetching news item with ID:", newsId);
        const docRef = doc(db, "news", newsId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const docData = docSnap.data();
          setItem({
            id: docSnap.id,
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
        } else {
          console.log("No such document with ID:", newsId);
        }
      } catch (error) {
        console.error("Error fetching news item: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNewsItem();
  }, [newsId, passedItem]);

  const openDocument = (url) => {
    if (url) {
      Linking.openURL(url).catch((err) =>
        console.error("Cannot open document:", err)
      );
    }
  };

  const renderMedia = () => {
    if (!item.mediaURLs || item.mediaURLs.length === 0) return null;

    return item.mediaURLs.map((media, index) => {
      if (media.includes("youtube.com") || media.includes("youtu.be")) {
        return (
          <TouchableOpacity
            key={index}
            onPress={() => Linking.openURL(media)}
            style={styles.mediaButton}
          >
            <Text style={styles.mediaText}>เปิดวิดีโอ</Text>
          </TouchableOpacity>
        );
      }

      return (
        <Image
          key={index}
          source={{ uri: media }}
          style={[
            styles.mediaImage,
            imageHeights[index] && { height: imageHeights[index] },
          ]}
          onLoad={(event) => {
            const { width: imgWidth, height: imgHeight } =
              event.nativeEvent.source;
            const screenWidth = width - 30; // padding
            const scaledHeight = (imgHeight / imgWidth) * screenWidth;
            setImageHeights((prev) => ({ ...prev, [index]: scaledHeight }));
          }}
        />
      );
    });
  };

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

  if (!item) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>ไม่พบข้อมูลข่าว</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={{ padding: 15 }}
      >
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{item.title || "ไม่มีหัวข้อ"}</Text>
          <Text style={styles.createdAt}>
            {item.createdAt && item.createdAt.toDate
              ? item.createdAt.toDate().toLocaleString("th-TH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "ไม่มีวันที่"}
          </Text>
        </View>

        {renderMedia()}

        {item.documentURL ? (
          <TouchableOpacity
            onPress={() => openDocument(item.documentURL)}
            style={styles.documentButton}
          >
            <Text style={styles.documentText}>เปิดเอกสาร</Text>
          </TouchableOpacity>
        ) : null}

        {item.description ? (
          <RenderHtml
            contentWidth={width - 30}
            source={{
              html: `<div style="font-size: 16px; color: #000000ff; line-height: 22;">${item.description}</div>`,
            }}
            tagsStyles={htmlStyles}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
  },
  scrollContainer: {
    flex: 1,
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
  errorText: {
    fontSize: 16,
    color: "#f44336",
  },
  titleContainer: {
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#222",
  },
  createdAt: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  mediaImage: {
    width: "100%",
    minHeight: 200,
    borderRadius: 10,
    marginBottom: 15,
    resizeMode: "contain",
    backgroundColor: "#f0f0f0",
  },
  mediaButton: {
    backgroundColor: "#1e90ff",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 15,
  },
  mediaText: {
    color: "#fff",
    fontWeight: "500",
  },
  documentButton: {
    backgroundColor: "#32cd32",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 15,
  },
  documentText: {
    color: "#fff",
    fontWeight: "500",
  },
});

const htmlStyles = {
  p: {
    fontSize: 16,
    color: "#000000ff",
    lineHeight: 22,
    marginBottom: 10,
  },
  strong: {
    fontWeight: "bold",
  },
  em: {
    fontStyle: "italic",
  },
  ul: {
    marginBottom: 10,
  },
  li: {
    marginBottom: 5,
  },
};

export default NewsContent;
