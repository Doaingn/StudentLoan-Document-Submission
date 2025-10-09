import React, { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./database/firebase";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import ClassicEditor from "@ckeditor/ckeditor5-build-classic";

export default function PostEditScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [post, setPost] = useState(location.state?.post || null);
  const [saving, setSaving] = useState(false);
  const [newDocumentFile, setNewDocumentFile] = useState(null);
  const [newMediaFiles, setNewMediaFiles] = useState([]);
  const [newBanner, setNewBanner] = useState(null);
  const editorRef = useRef(null);

  if (!post) return <p style={styles.errorText}>ไม่พบโพสต์</p>;

  const handleChange = (field, value) =>
    setPost((prev) => ({ ...prev, [field]: value }));

  const handleFileUpload = async (file, folder = "media") => {
    const storageRef = ref(storage, `${folder}/${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return url;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let updateData = {};

      // Upload new banner if selected
      if (newBanner) {
        const bannerURL = await handleFileUpload(newBanner, "banner");
        updateData.bannerURL = bannerURL;
      }

      // Upload new document if selected
      if (newDocumentFile) {
        const documentURL = await handleFileUpload(
          newDocumentFile,
          "documents"
        );
        updateData.documentURL = documentURL;
        updateData.documentName = newDocumentFile.name;
      }

      // Upload new media files if selected
      if (newMediaFiles.length > 0) {
        const newMediaURLs = [];
        for (let file of newMediaFiles) {
          const url = await handleFileUpload(file, "media");
          newMediaURLs.push(url);
        }
        updateData.mediaURLs = [...(post.mediaURLs || []), ...newMediaURLs];
      }

      // Add text fields that were edited
      updateData.title = post.title;
      updateData.description = post.description;

      // Keep existing data that might have been removed
      if (post.bannerURL === null && !newBanner) {
        updateData.bannerURL = null;
      }
      if (post.documentURL === null && !newDocumentFile) {
        updateData.documentURL = null;
        updateData.documentName = null;
      }
      if (post.mediaURLs && !newMediaFiles.length) {
        updateData.mediaURLs = post.mediaURLs;
      }

      const docRef = doc(db, "news", post.id);
      await updateDoc(docRef, updateData);

      alert("บันทึกสำเร็จ");
      navigate(-1);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    }
    setSaving(false);
  };

  const handleBack = () => {
    if (window.confirm("คุณต้องการที่จะละทิ้งการแก้ไขไหม?")) navigate(-1);
  };

  const removeBanner = () => {
    handleChange("bannerURL", null);
  };

  const removeDocument = () => {
    handleChange("documentURL", null);
    handleChange("documentName", null);
  };

  const removeMediaURL = (index) => {
    const updatedMediaURLs = post.mediaURLs.filter((_, i) => i !== index);
    handleChange("mediaURLs", updatedMediaURLs);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>แก้ไขโพสต์</h1>

      <div style={styles.field}>
        <label style={styles.label}>หัวข้อ</label>
        <input
          type="text"
          value={post.title || ""}
          onChange={(e) => handleChange("title", e.target.value)}
          style={styles.input}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Banner</label>

        {/* Current Banner */}
        {post.bannerURL && (
          <div style={styles.existingItem}>
            <div style={styles.existingItemContent}>
              <img
                src={post.bannerURL}
                alt="Current banner"
                style={styles.bannerThumbnail}
              />
              <a
                href={post.bannerURL}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                ดู Banner
              </a>
            </div>
            <button onClick={removeBanner} style={styles.removeButton}>
              ลบ
            </button>
          </div>
        )}

        {/* Add New Banner */}
        <div style={styles.addNewSection}>
          <label style={styles.subLabel}>เปลี่ยน Banner ใหม่:</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setNewBanner(e.target.files[0])}
            style={styles.fileInput}
          />
          {newBanner && (
            <div style={styles.newBannerPreview}>
              <img
                src={URL.createObjectURL(newBanner)}
                alt="New banner preview"
                style={styles.bannerPreview}
              />
              <span style={styles.newFileLabel}>
                Banner ใหม่: {newBanner.name}
              </span>
            </div>
          )}
        </div>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>รายละเอียด (HTML allowed)</label>
        <div style={styles.editorContainer}>
          <CKEditor
            editor={ClassicEditor}
            data={post.description || ""}
            config={{
              toolbar: [
                "heading",
                "|",
                "bold",
                "italic",
                "link",
                "bulletedList",
                "numberedList",
                "|",
                "blockQuote",
                "insertTable",
                "|",
                "undo",
                "redo",
              ],
              heading: {
                options: [
                  {
                    model: "paragraph",
                    title: "Paragraph",
                    class: "ck-heading_paragraph",
                  },
                  {
                    model: "heading1",
                    view: "h1",
                    title: "Heading 1",
                    class: "ck-heading_heading1",
                  },
                  {
                    model: "heading2",
                    view: "h2",
                    title: "Heading 2",
                    class: "ck-heading_heading2",
                  },
                  {
                    model: "heading3",
                    view: "h3",
                    title: "Heading 3",
                    class: "ck-heading_heading3",
                  },
                ],
              },
            }}
            onChange={(event, editor) => {
              const data = editor.getData();
              handleChange("description", data);
            }}
            onReady={(editor) => {
              editorRef.current = editor;
            }}
          />
        </div>
      </div>

      {/* Document Section */}
      <div style={styles.field}>
        <label style={styles.label}>เอกสาร</label>

        {/* Current Document */}
        {post.documentURL && (
          <div style={styles.existingItem}>
            <div style={styles.existingItemContent}>
              <span style={styles.documentText}>
                📄 {post.documentName || "เอกสาร"}
              </span>
              <a
                href={post.documentURL}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                ดูเอกสาร
              </a>
            </div>
            <button onClick={removeDocument} style={styles.removeButton}>
              ลบ
            </button>
          </div>
        )}

        {/* Add New Document */}
        <div style={styles.addNewSection}>
          <label style={styles.subLabel}>เพิ่มเอกสารใหม่:</label>
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => setNewDocumentFile(e.target.files[0])}
            style={styles.fileInput}
          />
          {newDocumentFile && (
            <span style={styles.newFileLabel}>
              เอกสารใหม่: {newDocumentFile.name}
            </span>
          )}
        </div>
      </div>

      {/* Media Section */}
      <div style={styles.field}>
        <label style={styles.label}>สื่อ (รูป/วิดีโอ)</label>

        {/* Current Media */}
        {post.mediaURLs && post.mediaURLs.length > 0 && (
          <div style={styles.mediaGrid}>
            {post.mediaURLs.map((url, index) => (
              <div key={index} style={styles.mediaItem}>
                <img
                  src={url}
                  alt={`media-${index}`}
                  style={styles.mediaPreview}
                />
                <button
                  onClick={() => removeMediaURL(index)}
                  style={styles.removeMediaButton}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add New Media */}
        <div style={styles.addNewSection}>
          <label style={styles.subLabel}>เพิ่มสื่อใหม่:</label>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => setNewMediaFiles([...e.target.files])}
            style={styles.fileInput}
          />
          {newMediaFiles.length > 0 && (
            <div style={styles.newMediaPreview}>
              จะเพิ่ม {newMediaFiles.length} ไฟล์ใหม่
            </div>
          )}
        </div>
      </div>

      <div style={styles.buttonContainer}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={styles.saveButton}
        >
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        <button onClick={handleBack} style={styles.backButton}>
          กลับ
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: 30,
    maxWidth: 800,
    margin: "0 auto",
    fontFamily: "Arial, sans-serif",
    fontSize: 16,
    lineHeight: 1.5,
  },
  header: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 30,
    textAlign: "center",
  },
  field: {
    marginBottom: 25,
  },
  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  subLabel: {
    display: "block",
    marginBottom: 8,
    fontSize: 16,
    fontWeight: "normal",
    color: "#555",
  },
  input: {
    width: "100%",
    padding: 12,
    fontSize: 16,
    border: "1px solid #ccc",
    borderRadius: 8,
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
  },
  fileInput: {
    display: "block",
    marginBottom: 10,
    fontSize: 16,
  },
  existingItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#f9f9f9",
    border: "1px solid #ddd",
    borderRadius: 8,
    marginBottom: 15,
  },
  existingItemContent: {
    display: "flex",
    alignItems: "center",
    gap: 15,
  },
  documentText: {
    fontSize: 16,
    color: "#333",
  },
  link: {
    color: "#3b82f6",
    textDecoration: "none",
    fontSize: 16,
  },
  removeButton: {
    padding: "8px 16px",
    fontSize: 14,
    backgroundColor: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  addNewSection: {
    padding: 15,
    backgroundColor: "#f0f8ff",
    border: "1px dashed #3b82f6",
    borderRadius: 8,
  },
  mediaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: 15,
    marginBottom: 15,
  },
  mediaItem: {
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid #ddd",
  },
  mediaPreview: {
    width: "100%",
    height: 120,
    objectFit: "cover",
    display: "block",
  },
  removeMediaButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    backgroundColor: "rgba(220, 53, 69, 0.9)",
    color: "white",
    border: "none",
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
  },
  newMediaPreview: {
    marginTop: 10,
    fontSize: 16,
    color: "#555",
    fontStyle: "italic",
  },
  bannerThumbnail: {
    width: 140,
    height: 90,
    objectFit: "cover",
    borderRadius: 8,
    border: "1px solid #ddd",
  },
  bannerPreview: {
    width: "100%",
    height: 200,
    objectFit: "cover",
    borderRadius: 8,
    border: "1px solid #ddd",
    marginBottom: 10,
  },
  newBannerPreview: {
    marginTop: 15,
  },
  newFileLabel: {
    fontSize: 16,
    color: "#555",
    fontStyle: "italic",
  },
  editorContainer: {
    border: "1px solid #ccc",
    borderRadius: 8,
    overflow: "hidden",
  },
  buttonContainer: {
    display: "flex",
    gap: 15,
    marginTop: 30,
    justifyContent: "center",
  },
  saveButton: {
    padding: "12px 24px",
    fontSize: 16,
    backgroundColor: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold",
  },
  backButton: {
    padding: "12px 24px",
    fontSize: 16,
    backgroundColor: "#6c757d",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold",
  },
  errorText: {
    fontSize: 18,
    color: "#dc3545",
    textAlign: "center",
    padding: 20,
  },
};
