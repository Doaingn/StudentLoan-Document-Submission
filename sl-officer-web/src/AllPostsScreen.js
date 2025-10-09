import React, { useEffect, useState } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "./database/firebase";
import { useNavigate } from "react-router-dom";
import {
  MdNewspaper,
  MdSearch,
  MdFilterList,
  MdSchool,
  MdFavorite,
  MdWork,
  MdAnnouncement,
  MdMoreVert,
  MdEdit,
  MdDelete,
  MdAccessTime,
  MdDescription,
  MdImage,
  MdClose,
} from "react-icons/md";

const POST_TYPES = ["ทั่วไป", "ทุนการศึกษา", "ชั่วโมงจิตอาสา", "จ้างงาน"];

const TYPE_COLORS = {
  ทั่วไป: { bg: "#e3f2fd", color: "#1976d2", icon: MdAnnouncement },
  ทุนการศึกษา: { bg: "#f3e5f5", color: "#7b1fa2", icon: MdSchool },
  ชั่วโมงจิตอาสา: { bg: "#fff3e0", color: "#e65100", icon: MdFavorite },
  จ้างงาน: { bg: "#e8f5e9", color: "#2e7d32", icon: MdWork },
};

export default function AllPostsScreen() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const fetchPosts = async () => {
    setLoading(true);
    const querySnapshot = await getDocs(collection(db, "news"));
    const allPosts = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // แก้ไข: ตรวจสอบว่า createdAt เป็น Timestamp หรือไม่
    allPosts.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;

      const dateA =
        typeof a.createdAt.toDate === "function"
          ? a.createdAt.toDate()
          : new Date(a.createdAt);
      const dateB =
        typeof b.createdAt.toDate === "function"
          ? b.createdAt.toDate()
          : new Date(b.createdAt);

      return dateB - dateA;
    });

    setPosts(allPosts);
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm("คุณแน่ใจว่าต้องการลบโพสต์นี้?")) {
      await deleteDoc(doc(db, "news", id));
      fetchPosts();
    }
  };

  const filteredPosts = posts.filter((post) => {
    const matchesSearch = post.title
      ?.toLowerCase()
      .includes(search.toLowerCase());
    const matchesType = typeFilter ? post.postType === typeFilter : true;

    // แก้ไข: ตรวจสอบ createdAt ก่อนใช้งาน
    const matchesDate =
      dateFilter && post.createdAt
        ? (typeof post.createdAt.toDate === "function"
            ? post.createdAt.toDate().toDateString()
            : new Date(post.createdAt).toDateString()) ===
          new Date(dateFilter).toDateString()
        : !dateFilter;

    return matchesSearch && matchesType && matchesDate;
  });

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .post-card {
          animation: fadeIn 0.5s ease;
        }
        .post-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.15) !important;
        }
        .menu-button:hover {
          background: #f5f5f5 !important;
        }
        .menu-item:hover {
          background: #f5f5f5 !important;
        }
        .menu-item-delete:hover {
          background: #fee2e2 !important;
        }
        .filter-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .type-badge {
          transition: all 0.3s ease;
        }
        .type-badge:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .clear-button:hover {
          background: #dc2626 !important;
          transform: scale(1.05);
        }
      `}</style>

      <div style={styles.filterSection}>
        <div style={styles.filterRow}>
          <div style={styles.searchWrapper}>
            <MdSearch style={styles.searchIcon} />
            <input
              type="text"
              placeholder="ค้นหาจากหัวข้อ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="filter-input"
              style={styles.searchInput}
            />
          </div>

          <div style={styles.selectWrapper}>
            <MdFilterList style={styles.selectIcon} />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="filter-input"
              style={styles.select}
            >
              <option value="">ประเภททั้งหมด</option>
              {POST_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="filter-input"
            style={styles.dateInput}
          />

          {(search || typeFilter || dateFilter) && (
            <button
              onClick={() => {
                setSearch("");
                setTypeFilter("");
                setDateFilter("");
              }}
              className="clear-button"
              style={styles.clearButton}
            >
              <MdClose style={{ marginRight: "0.25rem" }} />
              ล้างตัวกรอง
            </button>
          )}
        </div>

        <div style={styles.typeBadgesContainer}>
          {POST_TYPES.map((type) => {
            const typeInfo = TYPE_COLORS[type];
            const TypeIcon = typeInfo.icon;
            const count = posts.filter((p) => p.postType === type).length;
            const isActive = typeFilter === type;

            return (
              <button
                key={type}
                onClick={() => setTypeFilter(isActive ? "" : type)}
                className="type-badge"
                style={{
                  ...styles.typeBadge,
                  background: isActive ? typeInfo.color : typeInfo.bg,
                  color: isActive ? "#fff" : typeInfo.color,
                  border: `2px solid ${typeInfo.color}`,
                }}
              >
                <TypeIcon size={18} />
                <span>{type}</span>
                <span style={styles.badgeCount}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}>
            <MdFilterList size={32} color="#667eea" />
          </div>
          <p style={styles.loadingText}>กำลังโหลดโพสต์...</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div style={styles.emptyState}>
          <MdNewspaper style={styles.emptyIcon} />
          <h3 style={styles.emptyTitle}>ไม่พบโพสต์</h3>
          <p style={styles.emptyText}>
            {search || typeFilter || dateFilter
              ? "ลองปรับเปลี่ยนตัวกรองเพื่อค้นหาโพสต์"
              : "ยังไม่มีโพสต์ในระบบ"}
          </p>
        </div>
      ) : (
        <div style={styles.postsGrid}>
          {filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDelete={() => handleDelete(post.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PostCard({ post, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const typeInfo = TYPE_COLORS[post.postType] || TYPE_COLORS["ทั่วไป"];
  const TypeIcon = typeInfo.icon;

  return (
    <div className="post-card" style={styles.postCard}>
      <div
        style={{
          ...styles.typeLabel,
          background: typeInfo.bg,
          color: typeInfo.color,
        }}
      >
        <TypeIcon size={16} />
        <span>{post.postType || "ทั่วไป"}</span>
      </div>

      {post.bannerURL && (
        <div style={styles.bannerContainer}>
          <img
            src={post.bannerURL}
            alt={post.title}
            style={styles.bannerImage}
          />
        </div>
      )}

      <div style={styles.cardContent}>
        <h3 style={styles.postTitle}>{post.title}</h3>

        <div
          style={styles.postDescription}
          dangerouslySetInnerHTML={{
            __html:
              post.description?.substring(0, 150) +
              (post.description?.length > 150 ? "..." : ""),
          }}
        />

        {post.mediaURLs && post.mediaURLs.length > 0 && (
          <div style={styles.mediaContainer}>
            <MdImage style={styles.mediaIcon} />
            {post.mediaURLs.slice(0, 3).map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt={`media-${idx}`}
                style={styles.mediaPreview}
              />
            ))}
            {post.mediaURLs.length > 3 && (
              <div style={styles.moreMedia}>+{post.mediaURLs.length - 3}</div>
            )}
          </div>
        )}

        {post.documentURL && (
          <div style={styles.documentBadge}>
            <MdDescription size={18} />
            <span>{post.documentName || "เอกสารแนบ"}</span>
          </div>
        )}

        <div style={styles.cardFooter}>
          <div style={styles.dateContainer}>
            <MdAccessTime size={16} style={{ color: "#94a3b8" }} />
            <span style={styles.dateText}>
              {post.createdAt && typeof post.createdAt.toDate === "function"
                ? new Date(post.createdAt.toDate()).toLocaleDateString(
                    "th-TH",
                    {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )
                : "ไม่ระบุวันที่"}
            </span>
          </div>

          <div style={styles.menuWrapper}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="menu-button"
              style={styles.menuButton}
            >
              <MdMoreVert size={20} />
            </button>
            {menuOpen && (
              <div style={styles.menuDropdown}>
                <button
                  onClick={() => {
                    navigate("/edit", { state: { post } });
                    setMenuOpen(false);
                  }}
                  className="menu-item"
                  style={styles.menuItem}
                >
                  <MdEdit size={18} />
                  <span>แก้ไขโพสต์</span>
                </button>
                <button
                  onClick={() => {
                    onDelete();
                    setMenuOpen(false);
                  }}
                  className="menu-item-delete"
                  style={styles.menuItemDelete}
                >
                  <MdDelete size={18} />
                  <span>ลบโพสต์</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    padding: "2rem",
    background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
    fontFamily:
      "'Kanit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  filterSection: {
    maxWidth: "1400px",
    margin: "0 auto 2rem",
    background: "white",
    borderRadius: "20px",
    padding: "1.5rem",
    boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
  },
  filterRow: {
    display: "flex",
    gap: "1rem",
    marginBottom: "1.5rem",
    flexWrap: "wrap",
  },
  searchWrapper: {
    position: "relative",
    flex: "1 1 300px",
  },
  searchIcon: {
    position: "absolute",
    left: "1rem",
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: "1.5rem",
    color: "#94a3b8",
  },
  searchInput: {
    width: "91%",
    padding: "0.875rem 1rem 0.875rem 3rem",
    fontSize: "1rem",
    border: "2px solid #e2e8f0",
    borderRadius: "12px",
    transition: "all 0.3s ease",
  },
  selectWrapper: {
    position: "relative",
    minWidth: "180px",
  },
  selectIcon: {
    position: "absolute",
    left: "0.875rem",
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: "1.25rem",
    color: "#94a3b8",
    pointerEvents: "none",
    zIndex: 1,
  },
  select: {
    width: "100%",
    padding: "0.875rem 1rem 0.875rem 2.5rem",
    fontSize: "1rem",
    border: "2px solid #e2e8f0",
    borderRadius: "12px",
    background: "white",
    cursor: "pointer",
    transition: "all 0.3s ease",
    appearance: "none",
  },
  dateInput: {
    padding: "0.875rem 1rem",
    fontSize: "1rem",
    border: "2px solid #e2e8f0",
    borderRadius: "12px",
    transition: "all 0.3s ease",
    minWidth: "180px",
  },
  clearButton: {
    padding: "0.875rem 1.5rem",
    fontSize: "1rem",
    background: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "600",
    transition: "all 0.3s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  typeBadgesContainer: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap",
  },
  typeBadge: {
    padding: "0.625rem 1.25rem",
    borderRadius: "12px",
    fontSize: "0.95rem",
    fontWeight: "600",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    transition: "all 0.3s ease",
  },
  badgeCount: {
    padding: "0.125rem 0.5rem",
    borderRadius: "8px",
    background: "rgba(0,0,0,0.1)",
    fontSize: "0.85rem",
    fontWeight: "700",
  },
  loadingContainer: {
    maxWidth: "1400px",
    margin: "0 auto",
    textAlign: "center",
    padding: "4rem 2rem",
  },
  spinner: {
    width: "50px",
    height: "50px",
    margin: "0 auto 1rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    animation: "spin 2s linear infinite",
  },
  loadingText: {
    fontSize: "1.125rem",
    color: "#64748b",
    fontWeight: "600",
  },
  emptyState: {
    maxWidth: "1400px",
    margin: "0 auto",
    textAlign: "center",
    padding: "4rem 2rem",
    background: "white",
    borderRadius: "20px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
  },
  emptyIcon: {
    fontSize: "5rem",
    marginBottom: "1rem",
    color: "#94a3b8",
  },
  emptyTitle: {
    fontSize: "1.5rem",
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: "0.5rem",
  },
  emptyText: {
    fontSize: "1rem",
    color: "#64748b",
  },
  postsGrid: {
    maxWidth: "1400px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
    gap: "1.5rem",
  },
  postCard: {
    background: "white",
    borderRadius: "20px",
    overflow: "hidden",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    transition: "all 0.3s ease",
    position: "relative",
    border: "2px solid transparent",
  },
  typeLabel: {
    position: "absolute",
    top: "1rem",
    right: "1rem",
    padding: "0.5rem 1rem",
    borderRadius: "10px",
    fontSize: "0.875rem",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    zIndex: 2,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  bannerContainer: {
    width: "100%",
    height: "200px",
    overflow: "hidden",
    background: "#f1f5f9",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  cardContent: {
    padding: "1.5rem",
  },
  postTitle: {
    fontSize: "1.375rem",
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: "0.75rem",
    marginTop: 0,
    lineHeight: 1.3,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  postDescription: {
    fontSize: "0.9375rem",
    lineHeight: 1.6,
    color: "#64748b",
    marginBottom: "1rem",
  },
  mediaContainer: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "1rem",
    position: "relative",
    alignItems: "center",
  },
  mediaIcon: {
    fontSize: "1.25rem",
    color: "#94a3b8",
    marginRight: "0.25rem",
  },
  mediaPreview: {
    width: "80px",
    height: "80px",
    objectFit: "cover",
    borderRadius: "10px",
    border: "2px solid #e2e8f0",
  },
  moreMedia: {
    width: "80px",
    height: "80px",
    borderRadius: "10px",
    background: "rgba(0,0,0,0.6)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.125rem",
    fontWeight: "700",
  },
  documentBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 1rem",
    background: "#f1f5f9",
    borderRadius: "10px",
    fontSize: "0.875rem",
    color: "#475569",
    marginBottom: "1rem",
  },
  cardFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: "1rem",
    borderTop: "2px solid #f1f5f9",
  },
  dateContainer: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  dateText: {
    fontSize: "0.875rem",
    color: "#64748b",
  },
  menuWrapper: {
    position: "relative",
  },
  menuButton: {
    fontSize: "1.25rem",
    padding: "0.5rem 0.75rem",
    background: "transparent",
    border: "2px solid #e2e8f0",
    borderRadius: "8px",
    cursor: "pointer",
    color: "#64748b",
    transition: "all 0.3s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  menuDropdown: {
    position: "absolute",
    right: 0,
    bottom: "calc(100% + 0.5rem)",
    background: "white",
    border: "2px solid #e2e8f0",
    borderRadius: "12px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
    display: "flex",
    flexDirection: "column",
    zIndex: 10,
    minWidth: "180px",
    overflow: "hidden",
  },
  menuItem: {
    padding: "0.875rem 1.25rem",
    fontSize: "0.9375rem",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    textAlign: "left",
    color: "#1e293b",
    fontWeight: "500",
    transition: "all 0.3s ease",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  menuItemDelete: {
    padding: "0.875rem 1.25rem",
    fontSize: "0.9375rem",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    textAlign: "left",
    color: "#dc2626",
    fontWeight: "500",
    transition: "all 0.3s ease",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
};
