// PostScreen.web.js
import React, { useState } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import ClassicEditor from "@ckeditor/ckeditor5-build-classic";
import { db, storage } from "./database/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  FaFileAlt,
  FaImage,
  FaPaperclip,
  FaVideo,
  FaSave,
  FaTimes,
  FaPlus,
  FaNewspaper,
} from "react-icons/fa";

// Custom Upload Adapter สำหรับ CKEditor (คงเดิม)
class MyUploadAdapter {
  constructor(loader) {
    this.loader = loader;
  }

  upload() {
    return this.loader.file.then(
      (file) =>
        new Promise((resolve, reject) => {
          this._initRequest();
          this._initListeners(resolve, reject, file);
          this._sendRequest(file);
        })
    );
  }

  abort() {
    // ยกเลิกการอัปโหลด
  }

  _initRequest() {
    // ไม่จำเป็นต้องใช้ XMLHttpRequest เพราะเราใช้ Firebase
  }

  _initListeners(resolve, reject, file) {
    // Upload ไฟล์ไป Firebase Storage
    const uploadToFirebase = async () => {
      try {
        const storageRef = ref(
          storage,
          `ckeditor-uploads/${Date.now()}_${file.name}`
        );
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        resolve({
          default: downloadURL,
        });
      } catch (error) {
        reject(`Cannot upload file: ${file.name}.`);
      }
    };

    uploadToFirebase();
  }

  _sendRequest(file) {
    // ไม่จำเป็นเพราะเราจัดการใน _initListeners แล้ว
  }
}

// Plugin function เพื่อเพิ่ม upload adapter
function MyCustomUploadAdapterPlugin(editor) {
  editor.plugins.get("FileRepository").createUploadAdapter = (loader) => {
    return new MyUploadAdapter(loader);
  };
}

export default function PostScreen() {
  const [title, setTitle] = useState("");
  const [banner, setBanner] = useState(null);
  const [description, setDescription] = useState("");
  const [documentFiles, setDocumentFiles] = useState([]);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [postType, setPostType] = useState("");
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState({});

  // Configuration สำหรับ CKEditor
  const editorConfiguration = {
    extraPlugins: [MyCustomUploadAdapterPlugin],
    toolbar: [
      "heading",
      "|",
      "bold",
      "italic",
      "link",
      "bulletedList",
      "numberedList",
      "|",
      "outdent",
      "indent",
      "|",
      "imageUpload",
      "blockQuote",
      "insertTable",
      "undo",
      "redo",
    ],
    image: {
      toolbar: [
        "imageTextAlternative",
        "imageStyle:inline",
        "imageStyle:block",
        "imageStyle:side",
      ],
    },
    table: {
      contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"],
    },
  };

  const handleFileUpload = async (file, folder = "media") => {
    const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return url;
  };

  const handleSubmit = async () => {
    setErrors({});
    let tempErrors = {};

    if (!title.trim()) tempErrors.title = "กรุณากรอกหัวข้อ";
    if (!postType) tempErrors.postType = "กรุณาเลือกประเภทโพสต์";

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    try {
      const bannerURL = banner
        ? await handleFileUpload(banner, "banner")
        : null;

      const documentURLs = [];
      const documentNames = [];
      for (let file of documentFiles) {
        const url = await handleFileUpload(file, "documents");
        documentURLs.push(url);
        documentNames.push(file.name);
      }

      const mediaURLs = [];
      for (let file of mediaFiles) {
        const url = await handleFileUpload(file, "media");
        mediaURLs.push(url);
      }

      await addDoc(collection(db, "news"), {
        title,
        description,
        postType,
        bannerURL,
        documentNames: documentNames.length > 0 ? documentNames : null,
        documentURLs: documentURLs.length > 0 ? documentURLs : null,
        mediaURLs,
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
      setTitle("");
      setBanner(null);
      setDescription("");
      setDocumentFiles([]);
      setMediaFiles([]);
      setPostType("");
      setErrors({});
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาด!");
    }
  };

  const addDocumentFile = (file) => {
    if (file && !documentFiles.some((f) => f.name === file.name)) {
      setDocumentFiles((prev) => [...prev, file]);
    }
  };

  const removeDocumentFile = (index) => {
    setDocumentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const addMediaFiles = (files) => {
    const newFiles = Array.from(files).filter(
      (file) => !mediaFiles.some((f) => f.name === file.name)
    );
    setMediaFiles((prev) => [...prev, ...newFiles]);
  };

  const removeMediaFile = (index) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const styles = {
    container: {
      minHeight: "100vh",
      padding: "2rem",
      fontFamily: "'Kanit', sans-serif",
    },
    innerContainer: {
      maxWidth: "1000px",
      margin: "0 auto",
    },
    card: {
      background: "rgba(255, 255, 255, 0.95)",
      backdropFilter: "blur(10px)",
      borderRadius: "20px",
      padding: "2.5rem",
      boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
    },
    header: {
      display: "flex",
      alignItems: "center",
      gap: "1rem",
      marginBottom: "2rem",
      color: "#1e293b",
    },
    headerIcon: {
      fontSize: "2.5rem",
      color: "#667eea",
    },
    headerText: {
      fontSize: "2rem",
      fontWeight: "700",
      margin: 0,
    },
    successMsg: {
      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      color: "white",
      padding: "1rem 1.5rem",
      borderRadius: "12px",
      marginBottom: "2rem",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      fontWeight: "600",
      boxShadow: "0 4px 15px rgba(16, 185, 129, 0.3)",
    },
    field: {
      marginBottom: "2rem",
    },
    label: {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      fontSize: "1.1rem",
      fontWeight: "600",
      color: "#374151",
      marginBottom: "0.8rem",
    },
    labelIcon: {
      color: "#667eea",
    },
    input: {
      width: "100%",
      padding: "1rem 1.2rem",
      borderRadius: "12px",
      border: "2px solid #e2e8f0",
      fontSize: "1rem",
      fontWeight: "500",
      transition: "all 0.3s ease",
      background: "white",
    },
    select: {
      width: "100%",
      padding: "1rem 1.2rem",
      borderRadius: "12px",
      border: "2px solid #e2e8f0",
      fontSize: "1rem",
      fontWeight: "500",
      background: "white",
      cursor: "pointer",
    },
    bannerContainer: {
      marginBottom: "1rem",
      position: "relative",
    },
    bannerPreview: {
      width: "100%",
      maxHeight: "300px",
      objectFit: "cover",
      borderRadius: "12px",
      border: "2px solid #e2e8f0",
    },
    removeBannerButton: {
      marginTop: "0.8rem",
      padding: "0.6rem 1.2rem",
      background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
      color: "white",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "0.9rem",
      fontWeight: "600",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      transition: "all 0.3s ease",
    },
    addFileSection: {
      padding: "2rem",
      background: "#f8fafc",
      border: "2px dashed #cbd5e1",
      borderRadius: "12px",
      textAlign: "center",
      transition: "all 0.3s ease",
    },
    fileInput: {
      display: "block",
      margin: "0 auto",
    },
    selectedFiles: {
      marginBottom: "1.5rem",
      padding: "1.5rem",
      backgroundColor: "#f8fafc",
      border: "1px solid #e2e8f0",
      borderRadius: "12px",
    },
    subHeader: {
      fontSize: "1.1rem",
      fontWeight: "600",
      color: "#374151",
      marginBottom: "1rem",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    },
    fileItem: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "1rem",
      backgroundColor: "white",
      border: "1px solid #e2e8f0",
      borderRadius: "8px",
      marginBottom: "0.8rem",
    },
    removeButton: {
      padding: "0.5rem 1rem",
      background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
      color: "white",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "0.8rem",
      fontWeight: "600",
      display: "flex",
      alignItems: "center",
      gap: "0.3rem",
    },
    mediaGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
      gap: "1rem",
    },
    mediaItem: {
      position: "relative",
      borderRadius: "12px",
      overflow: "hidden",
      backgroundColor: "white",
      border: "2px solid #e2e8f0",
      transition: "all 0.3s ease",
    },
    mediaPreview: {
      width: "100%",
      height: "140px",
      objectFit: "cover",
      display: "block",
    },
    fileName: {
      padding: "0.8rem",
      fontSize: "0.8rem",
      color: "#64748b",
      backgroundColor: "#f8fafc",
      textAlign: "center",
      wordBreak: "break-word",
    },
    removeMediaButton: {
      position: "absolute",
      top: "8px",
      right: "8px",
      width: "28px",
      height: "28px",
      background: "rgba(220, 53, 69, 0.95)",
      color: "white",
      border: "none",
      borderRadius: "50%",
      cursor: "pointer",
      fontSize: "14px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: "bold",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
    },
    button: {
      padding: "1.2rem 2rem",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white",
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      fontSize: "1.1rem",
      fontWeight: "600",
      transition: "all 0.3s ease",
      width: "100%",
      marginTop: "1rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "0.5rem",
      boxShadow: "0 4px 15px rgba(102, 126, 234, 0.3)",
    },
    errorMsg: {
      color: "#ef4444",
      marginTop: "0.5rem",
      fontSize: "0.9rem",
      fontWeight: "500",
      display: "flex",
      alignItems: "center",
      gap: "0.3rem",
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.innerContainer}>
        <div style={styles.card}>
          <div style={styles.header}>
            <FaNewspaper style={styles.headerIcon} />
            <h1 style={styles.headerText}>สร้างโพสต์ใหม่</h1>
          </div>

          {success && (
            <div style={styles.successMsg}>
              <FaSave /> โพสต์สำเร็จ!
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>
              <FaFileAlt style={styles.labelIcon} /> หัวข้อ:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                ...styles.input,
                borderColor: errors.title ? "#ef4444" : "#e2e8f0",
              }}
              placeholder="กรอกหัวข้อโพสต์..."
            />
            {errors.title && (
              <div style={styles.errorMsg}>
                <FaTimes /> {errors.title}
              </div>
            )}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>
              <FaFileAlt style={styles.labelIcon} /> ประเภทโพสต์:
            </label>
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value)}
              style={{
                ...styles.select,
                borderColor: errors.postType ? "#ef4444" : "#e2e8f0",
              }}
            >
              <option value="">-- เลือกประเภทโพสต์ --</option>
              <option value="ทั่วไป">ทั่วไป</option>
              <option value="ทุนการศึกษา">ทุนการศึกษา</option>
              <option value="ชั่วโมงจิตอาสา">ชั่วโมงจิตอาสา</option>
              <option value="จ้างงาน">จ้างงาน</option>
            </select>
            {errors.postType && (
              <div style={styles.errorMsg}>
                <FaTimes /> {errors.postType}
              </div>
            )}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>
              <FaImage style={styles.labelIcon} /> Banner:
            </label>

            {banner && (
              <div style={styles.bannerContainer}>
                <img
                  src={URL.createObjectURL(banner)}
                  alt="Banner preview"
                  style={styles.bannerPreview}
                />
                <button
                  onClick={() => setBanner(null)}
                  style={styles.removeBannerButton}
                >
                  <FaTimes /> ลบ Banner
                </button>
              </div>
            )}

            {!banner && (
              <div style={styles.addFileSection}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setBanner(e.target.files[0])}
                  style={styles.fileInput}
                />
              </div>
            )}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>
              <FaFileAlt style={styles.labelIcon} /> รายละเอียด:
            </label>
            <div
              style={{
                border: "2px solid #e2e8f0",
                borderRadius: "12px",
                overflow: "hidden",
              }}
            >
              <CKEditor
                editor={ClassicEditor}
                config={editorConfiguration}
                data={description}
                onChange={(event, editor) => setDescription(editor.getData())}
              />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>
              <FaPaperclip style={styles.labelIcon} /> เอกสาร (PDF, DOCX):
            </label>

            {documentFiles.length > 0 && (
              <div style={styles.selectedFiles}>
                <h4 style={styles.subHeader}>
                  <FaPaperclip /> เอกสารที่เลือก:
                </h4>
                {documentFiles.map((file, index) => (
                  <div key={index} style={styles.fileItem}>
                    <span>📄 {file.name}</span>
                    <button
                      onClick={() => removeDocumentFile(index)}
                      style={styles.removeButton}
                    >
                      <FaTimes /> ลบ
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={styles.addFileSection}>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                  if (e.target.files[0]) {
                    addDocumentFile(e.target.files[0]);
                    e.target.value = "";
                  }
                }}
                style={styles.fileInput}
              />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>
              <FaVideo style={styles.labelIcon} /> สื่อ (รูป/วิดีโอ):
            </label>

            {mediaFiles.length > 0 && (
              <div style={styles.selectedFiles}>
                <h4 style={styles.subHeader}>
                  <FaImage /> สื่อที่เลือก:
                </h4>
                <div style={styles.mediaGrid}>
                  {mediaFiles.map((file, index) => (
                    <div key={index} style={styles.mediaItem}>
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`media-${index}`}
                        style={styles.mediaPreview}
                      />
                      <div style={styles.fileName}>{file.name}</div>
                      <button
                        onClick={() => removeMediaFile(index)}
                        style={styles.removeMediaButton}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={styles.addFileSection}>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(e) => {
                  if (e.target.files.length > 0) {
                    addMediaFiles(e.target.files);
                    e.target.value = "";
                  }
                }}
                style={styles.fileInput}
              />
            </div>
          </div>

          <button onClick={handleSubmit} style={styles.button}>
            <FaSave /> สร้างโพสต์
          </button>
        </div>
      </div>
    </div>
  );
}
