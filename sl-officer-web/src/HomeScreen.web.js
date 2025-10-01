import React, { useState, useEffect } from "react";
import { db } from "./database/firebase";
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  Timestamp 
} from "firebase/firestore";
import { useNavigate } from "react-router-dom"; 

export default function EnhancedDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalSubmissions: 0,
    pendingReview: 0,
    approved: 0,
    rejected: 0,
    inProcess: 0,
    processCompleted: 0,
    systemStatus: 'ปิดใช้งาน',
    recentActivities: []
  });
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [systemConfig, setSystemConfig] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchDashboardData();
    }
  }, [selectedPeriod]);

  const fetchAppConfig = async () => {
    try {
      const configRef = doc(db, "DocumentService", "config");
      const configDoc = await getDoc(configRef);
      if (configDoc.exists()) {
        return configDoc.data();
      } else {
        return {
          academicYear: "2567",
          term: "1",
          isEnabled: false,
          immediateAccess: false,
        };
      }
    } catch (error) {
      console.error("Error fetching app config:", error);
      return null;
    }
  };

  const fetchAvailablePeriods = async () => {
    try {
      const periodsRef = doc(db, "DocumentService", "submission_periods_history");
      const periodsDoc = await getDoc(periodsRef);
      if (periodsDoc.exists()) {
        const data = periodsDoc.data();
        return {
          years: Array.isArray(data.availableYears) ? data.availableYears : ['2567'],
          terms: Array.isArray(data.availableTerms) ? data.availableTerms : ['1', '2', '3'], 
        };
      }
      return { years: ['2567'], terms: ['1', '2', '3'] }; 
    } catch (error) {
      console.error("Error fetching available periods:", error);
      return { years: ['2567'], terms: ['1', '2', '3'] };
    }
  };

  const calculateStats = async (years, terms, periodFilter) => {
    const periodMap = {
      today: 1,
      week: 7,
      month: 30
    };
    const daysBack = periodMap[periodFilter] || periodMap.month;
    const cutOffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const usersSnap = await getDocs(collection(db, "users"));
    const totalStudents = usersSnap.size;

    let totalSubmissions = 0;
    let pendingReview = 0;
    let approved = 0;
    let rejected = 0;
    let inProcess = 0;
    let processCompleted = 0;
    let allActivities = [];

    for (const year of years) {
      for (const term of terms) {
        try {
          const submissionsRef = collection(db, `document_submissions_${year}_${term}`);
          const submissionsSnap = await getDocs(submissionsRef);
          
          submissionsSnap.forEach((doc) => {
            const data = doc.data();
            const documentStatuses = data.documentStatuses || {};
            
            if (Object.keys(documentStatuses).length > 0) {
              let submittedAt = data.submittedAt;
              if (submittedAt && submittedAt instanceof Timestamp) {
                  submittedAt = submittedAt.toDate();
              } else if (typeof submittedAt === 'string') {
                  submittedAt = new Date(submittedAt);
              } else {
                  submittedAt = new Date(0);
              }

              if (submittedAt < cutOffDate) {
                  return; 
              }

              totalSubmissions++;
              
              const statuses = Object.values(documentStatuses).map(d => d.status);
              const hasRejected = statuses.includes('rejected');
              const hasPending = statuses.includes('pending');
              const allApproved = statuses.length > 0 && statuses.every(s => s === 'approved');

              if (hasRejected) {
                rejected++;
              } else if (allApproved) {
                approved++;
              } else if (hasPending) {
                pendingReview++;
              } else {
                pendingReview++;
              }

              allActivities.push({
                id: doc.id,
                userName: data.name || data.userId || 'ไม่ระบุชื่อ',
                student_id: data.student_id || 'N/A',
                academicYear: year,
                term: term,
                submittedAt: submittedAt,
                documentStatuses: documentStatuses
              });
            }
          });
        } catch (error) {
          console.log(`Collection document_submissions_${year}_${term} not found (Skipping)`);
        }

        try {
          const processRef = collection(db, `loan_process_status_${year}_${term}`);
          const processSnap = await getDocs(processRef);

          processSnap.forEach((doc) => {
            const data = doc.data();
            if (data.overallStatus === 'processing') {
              inProcess++;
            } else if (data.overallStatus === 'completed') {
              processCompleted++;
            }
          });
        } catch (error) {
          console.log(`Collection loan_process_status_${year}_${term} not found (Skipping)`);
        }
      }
    }
    
    allActivities.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
    const recentActivities = allActivities.slice(0, 15);

    return {
      totalStudents,
      totalSubmissions,
      pendingReview,
      approved,
      rejected,
      inProcess,
      processCompleted,
      recentActivities
    };
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const config = await fetchAppConfig();
      setSystemConfig(config);
      const { years, terms } = await fetchAvailablePeriods();
      const data = await calculateStats(years, terms, selectedPeriod);
      
      setStats({
        totalStudents: data.totalStudents,
        totalSubmissions: data.totalSubmissions,
        pendingReview: data.pendingReview,
        approved: data.approved,
        rejected: data.rejected,
        inProcess: data.inProcess,
        processCompleted: data.processCompleted,
        systemStatus: config.isEnabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน',
        recentActivities: data.recentActivities.map(activity => ({
            ...activity,
            submittedAt: activity.submittedAt.toISOString()
        }))
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateCompletionRate = () => {
    const total = stats.approved + stats.rejected + stats.pendingReview;
    return total > 0 ? Math.round((stats.approved / total) * 100) : 0;
  };

  const getProcessingRate = () => {
    const total = stats.inProcess + stats.processCompleted;
    return total > 0 ? Math.round((stats.processCompleted / total) * 100) : 0;
  };

  const getSubmissionRate = () => {
    return stats.totalStudents > 0 ? Math.round((stats.totalSubmissions / stats.totalStudents) * 100) : 0;
  };

  const formatTime = (date) => {
    return date.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getPeriodLabel = () => {
    switch(selectedPeriod) {
      case 'today': return 'วันนี้';
      case 'week': return 'สัปดาห์นี้';
      case 'month': return 'เดือนนี้';
      default: return 'เดือนนี้';
    }
  };

  const getStatusColor = (status) => {
    if (status === 'เปิดใช้งาน') return '#10b981';
    if (status === 'รอเปิดใช้งาน') return '#f59e0b';
    return '#ef4444';
  };

  const handleQuickAction = (action) => {
    navigate(`/${action}`);
  };

  const handleViewSubmissionDetail = (activity) => {
    // ⭐️ นำทางไปยัง /document-submission พร้อมส่งค่า studentId, year, และ term ผ่าน Query String
    const path = `/document-submission?studentId=${activity.student_id}&year=${activity.academicYear}&term=${activity.term}`;
    navigate(path); 
  };

  const handleViewAllActivities = () => {
    console.log('View all activities');
  };

  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    if (isNaN(date)) return 'N/A';
    return date.toLocaleString('th-TH', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getDocumentStatusText = (documentStatuses) => {
    const statuses = Object.values(documentStatuses).map(d => d.status);
    const hasRejected = statuses.includes('rejected');
    const hasPending = statuses.includes('pending');
    const allApproved = statuses.length > 0 && statuses.every(s => s === 'approved');

    if (hasRejected) return { text: 'เอกสารไม่ถูกต้อง', color: '#ef4444', bgColor: '#fee2e2' };
    if (allApproved) return { text: 'เอกสารถูกต้อง', color: '#10b981', bgColor: '#d1fae5' };
    if (hasPending) return { text: 'รอการตรวจสอบ', color: '#f59e0b', bgColor: '#fef3c7' };
    return { text: 'ส่งแล้ว (รอนับ)', color: '#6b7280', bgColor: '#f3f4f6' };
  };

  const styles = {
    container: {
      minHeight: "100vh",
      padding: "2rem",
      fontFamily: "'Kanit', sans-serif",
    },
    innerContainer: {
      maxWidth: "1400px",
      margin: "0 auto",
    },
    header: {
      background: "rgba(255, 255, 255, 0.95)",
      backdropFilter: "blur(10px)",
      borderRadius: "20px",
      padding: "2rem",
      marginBottom: "2rem",
      boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "1rem",
    },
    headerLeft: {
      flex: 1,
    },
    title: {
      fontSize: "2.5rem",
      fontWeight: "700",
      background: "linear-gradient(135deg, #000000ff 0%, #764ba2 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      margin: 0,
      marginBottom: "0.5rem",
    },
    systemCard: {
      background: "rgba(255, 255, 255, 0.95)",
      backdropFilter: "blur(10px)",
      borderRadius: "20px",
      padding: "2rem",
      marginBottom: "2rem",
      boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
    },
    systemHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "1.5rem",
      flexWrap: "wrap",
      gap: "1rem",
    },
    systemTitle: {
      fontSize: "1.5rem",
      fontWeight: "700",
      color: "#1e293b",
      margin: 0,
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    },
    statusBadge: {
      display: "inline-flex",
      alignItems: "center",
      gap: "0.5rem",
      padding: "0.6rem 1.5rem",
      borderRadius: "50px",
      fontSize: "1rem",
      fontWeight: "600",
      background: getStatusColor(stats.systemStatus),
      color: "white",
      boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
    },
    statusDot: {
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      background: "white",
      animation: "pulse 2s infinite",
    },
    periodSelector: {
      display: "flex",
      gap: "0.5rem",
      background: "#f1f5f9",
      padding: "0.3rem",
      borderRadius: "12px",
    },
    periodButton: {
      padding: "0.6rem 1.2rem",
      borderRadius: "10px",
      border: "none",
      background: "transparent",
      color: "#64748b",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.3s ease",
      fontSize: "0.95rem",
    },
    periodButtonActive: {
      padding: "0.6rem 1.2rem",
      borderRadius: "10px",
      border: "none",
      background: "white",
      color: "#667eea",
      fontWeight: "700",
      cursor: "pointer",
      boxShadow: "0 4px 15px rgba(102, 126, 234, 0.2)",
      fontSize: "0.95rem",
    },
    systemInfo: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "1rem",
      padding: "1.5rem",
      background: "#f8fafc",
      borderRadius: "15px",
    },
    infoItem: {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    },
    infoLabel: {
      fontSize: "0.9rem",
      color: "#64748b",
      fontWeight: "600",
    },
    infoValue: {
      fontSize: "1rem",
      color: "#1e293b",
      fontWeight: "700",
    },
    statsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: "1.5rem",
      marginBottom: "2rem",
    },
    statCard: (gradient, icon) => ({
      background: "white",
      borderRadius: "20px",
      padding: "2rem",
      boxShadow: "0 10px 40px rgba(0, 0, 0, 0.08)",
      position: "relative",
      overflow: "hidden",
      transition: "all 0.3s ease",
      cursor: "pointer",
      border: "2px solid transparent",
    }),
    statCardInner: {
      position: "relative",
      zIndex: 2,
    },
    statIcon: {
      fontSize: "3rem",
      marginBottom: "1rem",
    },
    statTitle: {
      fontSize: "0.95rem",
      color: "#64748b",
      fontWeight: "600",
      marginBottom: "0.5rem",
    },
    statValue: {
      fontSize: "2.5rem",
      fontWeight: "700",
      color: "#1e293b",
      marginBottom: "0.5rem",
    },
    statSubtext: {
      fontSize: "0.9rem",
      color: "#94a3b8",
      fontWeight: "500",
    },
    progressSection: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
      gap: "1.5rem",
      marginBottom: "2rem",
    },
    progressCard: {
      background: "white",
      borderRadius: "20px",
      padding: "2rem",
      boxShadow: "0 10px 40px rgba(0, 0, 0, 0.08)",
    },
    progressTitle: {
      fontSize: "1.2rem",
      fontWeight: "700",
      color: "#1e293b",
      marginBottom: "1.5rem",
    },
    progressBarContainer: {
      height: "12px",
      background: "#f1f5f9",
      borderRadius: "10px",
      overflow: "hidden",
      marginBottom: "1rem",
    },
    progressBar: (width, color) => ({
      height: "100%",
      width: `${width}%`,
      background: color,
      borderRadius: "10px",
      transition: "width 1s ease",
      position: "relative",
    }),
    progressText: {
      fontSize: "1rem",
      color: "#64748b",
      fontWeight: "600",
      textAlign: "right",
    },
    mainContent: {
      display: "grid",
      gridTemplateColumns: "2fr 1fr",
      gap: "1.5rem",
    },
    activitiesCard: {
      background: "white",
      borderRadius: "20px",
      padding: "2rem",
      boxShadow: "0 10px 40px rgba(0, 0, 0, 0.08)",
    },
    activitiesHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "1.5rem",
      paddingBottom: "1rem",
      borderBottom: "2px solid #f1f5f9",
    },
    activitiesTitle: {
      fontSize: "1.5rem",
      fontWeight: "700",
      color: "#1e293b",
      margin: 0,
    },
    viewAllButton: {
      background: "none",
      border: "none",
      color: "#667eea",
      fontWeight: "600",
      cursor: "pointer",
      fontSize: "1rem",
      transition: "all 0.3s ease",
    },
    activityList: {
      display: "flex",
      flexDirection: "column",
      gap: "1rem",
      maxHeight: "600px",
      overflowY: "auto",
      paddingRight: "0.5rem",
    },
    activityItem: {
      display: "flex",
      alignItems: "center",
      gap: "1rem",
      padding: "1.2rem",
      background: "#f8fafc",
      borderRadius: "15px",
      border: "2px solid transparent",
      transition: "all 0.3s ease",
      cursor: "pointer",
    },
    activityIcon: {
      fontSize: "2.5rem",
    },
    activityContent: {
      flex: 1,
    },
    activityName: {
      fontSize: "1.1rem",
      fontWeight: "700",
      color: "#1e293b",
      marginBottom: "0.3rem",
    },
    activityDetail: {
      fontSize: "0.9rem",
      color: "#64748b",
      marginBottom: "0.2rem",
    },
    activityTime: {
      fontSize: "0.85rem",
      color: "#94a3b8",
    },
    activityBadge: (bgColor, color) => ({
      padding: "0.5rem 1rem",
      borderRadius: "10px",
      fontSize: "0.85rem",
      fontWeight: "600",
      background: bgColor,
      color: color,
      whiteSpace: "nowrap",
    }),
    quickActionsCard: {
      background: "white",
      borderRadius: "20px",
      padding: "2rem",
      boxShadow: "0 10px 40px rgba(0, 0, 0, 0.08)",
    },
    quickActionsTitle: {
      fontSize: "1.5rem",
      fontWeight: "700",
      color: "#1e293b",
      marginBottom: "1.5rem",
      paddingBottom: "1rem",
      borderBottom: "2px solid #f1f5f9",
    },
    actionButtons: {
      display: "flex",
      flexDirection: "column",
      gap: "1rem",
    },
    actionButton: (gradient) => ({
      padding: "1.2rem 1.5rem",
      borderRadius: "15px",
      border: "none",
      background: gradient,
      color: "white",
      fontSize: "1rem",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.3s ease",
      textAlign: "left",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
    }),
    actionCount: {
      padding: "0.3rem 0.8rem",
      borderRadius: "8px",
      background: "rgba(255, 255, 255, 0.2)",
      fontSize: "0.9rem",
      fontWeight: "700",
    },
    loadingContainer: {
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    },
    spinnerContainer: {
      position: "relative",
      width: "80px",
      height: "80px",
      marginBottom: "2rem",
    },
    spinner: {
      position: "absolute",
      width: "80px",
      height: "80px",
      border: "8px solid rgba(255, 255, 255, 0.2)",
      borderTop: "8px solid white",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
    },
    spinnerInner: {
      position: "absolute",
      width: "60px",
      height: "60px",
      top: "10px",
      left: "10px",
      border: "6px solid rgba(255, 255, 255, 0.2)",
      borderTop: "6px solid white",
      borderRadius: "50%",
      animation: "spin 1.5s linear infinite reverse",
    },
    loadingText: {
      fontSize: "1.8rem",
      fontWeight: "700",
      color: "white",
      marginBottom: "0.5rem",
    },
    loadingSubtext: {
      fontSize: "1.1rem",
      color: "rgba(255, 255, 255, 0.8)",
    },
    '@media (max-width: 1024px)': {
      mainContent: {
        gridTemplateColumns: "1fr",
      }
    },

    if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinnerContainer}>
          <div style={styles.spinner}></div>
          <div style={styles.spinnerInner}></div>
        </div>
        <p style={styles.loadingText}>กำลังโหลดข้อมูล...</p>
        <p style={styles.loadingSubtext}>กรุณารอสักครู่</p>
      </div>
    );
  }
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .stat-card:hover {
          transform: translateY(-5px);
          border-color: #667eea !important;
          box-shadow: 0 20px 60px rgba(102, 126, 234, 0.2) !important;
        }
        .activity-item:hover {
          background: #f1f5f9 !important;
          border-color: #667eea !important;
        }
        .action-btn:hover {
          transform: translateX(5px);
          box-shadow: 0 6px 25px rgba(0, 0, 0, 0.15) !important;
        }
        .view-all:hover {
          color: #764ba2 !important;
        }
        .period-btn:hover:not(.active) {
          background: #e2e8f0 !important;
        }
        @media (max-width: 1024px) {
          .main-content {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div style={styles.innerContainer}>
        {/* System Status */}
        <div style={styles.systemCard}>
          <div style={styles.systemHeader}>
            <div>
              <h2 style={styles.systemTitle}>
                ⚙️ สถานะระบบ
              </h2>
              <div style={{ marginTop: "1rem" }}>
                <span style={styles.statusBadge}>
                  <span style={styles.statusDot}></span>
                  {stats.systemStatus}
                </span>
              </div>
            </div>
            <div style={styles.periodSelector}>
              <button 
                className={selectedPeriod === 'today' ? 'active' : ''}
                style={selectedPeriod === 'today' ? styles.periodButtonActive : styles.periodButton}
                onClick={() => setSelectedPeriod('today')}
              >
                วันนี้
              </button>
              <button 
                className={selectedPeriod === 'week' ? 'active' : ''}
                style={selectedPeriod === 'week' ? styles.periodButtonActive : styles.periodButton}
                onClick={() => setSelectedPeriod('week')}
              >
                สัปดาห์นี้
              </button>
              <button 
                className={selectedPeriod === 'month' ? 'active' : ''}
                style={selectedPeriod === 'month' ? styles.periodButtonActive : styles.periodButton}
                onClick={() => setSelectedPeriod('month')}
              >
                เดือนนี้
              </button>
            </div>
          </div>
          {systemConfig && (
            <div style={styles.systemInfo}>
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>📅 ปีการศึกษา:</span>
                <span style={styles.infoValue}>{systemConfig.academicYear}</span>
              </div>
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>📚 เทอม:</span>
                <span style={styles.infoValue}>{systemConfig.term}</span>
              </div>
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>⏰ ช่วงเวลา:</span>
                <span style={styles.infoValue}>{getPeriodLabel()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div style={styles.statsGrid}>
          <div 
            className="stat-card"
            style={styles.statCard("linear-gradient(135deg, #667eea 0%, #764ba2 100%)", "👥")}
            onClick={() => handleQuickAction('studentinfo')}
          >
            <div style={styles.statCardInner}>
              <div style={styles.statIcon}>👥</div>
              <div style={styles.statTitle}>จำนวนนักศึกษาทั้งหมด</div>
              <div style={styles.statValue}>{stats.totalStudents.toLocaleString()}</div>
              <div style={styles.statSubtext}>อัตราการส่งเอกสาร: {getSubmissionRate()}%</div>
            </div>
          </div>

          <div 
            className="stat-card"
            style={styles.statCard("linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", "📄")}
            onClick={() => handleQuickAction('document-submission')}
          >
            <div style={styles.statCardInner}>
              <div style={styles.statIcon}>📄</div>
              <div style={styles.statTitle}>การส่งเอกสารรวม ({getPeriodLabel()})</div>
              <div style={styles.statValue}>{stats.totalSubmissions.toLocaleString()}</div>
              <div style={styles.statSubtext}>ทั้งหมดที่นับได้</div>
            </div>
          </div>

          <div 
            className="stat-card"
            style={styles.statCard("linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)", "⏳")}
            onClick={() => handleQuickAction('document-submission')}
          >
            <div style={styles.statCardInner}>
              <div style={styles.statIcon}>⏳</div>
              <div style={styles.statTitle}>รอการตรวจสอบ ({getPeriodLabel()})</div>
              <div style={styles.statValue}>{stats.pendingReview.toLocaleString()}</div>
              <div style={styles.statSubtext}>ต้องดำเนินการด่วน</div>
            </div>
          </div>

          <div 
            className="stat-card"
            style={styles.statCard("linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)", "❌")}
            onClick={() => handleQuickAction('document-submission')}
          >
            <div style={styles.statCardInner}>
              <div style={styles.statIcon}>❌</div>
              <div style={styles.statTitle}>เอกสารไม่ถูกต้อง ({getPeriodLabel()})</div>
              <div style={styles.statValue}>{stats.rejected.toLocaleString()}</div>
              <div style={styles.statSubtext}>รอการแก้ไข</div>
            </div>
          </div>

          <div 
            className="stat-card"
            style={styles.statCard("linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)", "✅")}
            onClick={() => handleQuickAction('loan-process')}
          >
            <div style={styles.statCardInner}>
              <div style={styles.statIcon}>✅</div>
              <div style={styles.statTitle}>เอกสารถูกต้อง/อนุมัติ ({getPeriodLabel()})</div>
              <div style={styles.statValue}>{stats.approved.toLocaleString()}</div>
              <div style={styles.statSubtext}>พร้อมเตรียมจัดส่งให้ธนาคาร</div>
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div style={styles.progressSection}>
          <div style={styles.progressCard}>
            <div style={styles.progressTitle}>📈 อัตราการตรวจสอบเอกสาร</div>
            <div style={styles.progressBarContainer}>
              <div style={styles.progressBar(calculateCompletionRate(), "linear-gradient(90deg, #667eea 0%, #764ba2 100%)")}></div>
            </div>
            <div style={styles.progressText}>
              {calculateCompletionRate()}% - อนุมัติแล้ว {stats.approved} จาก {stats.approved + stats.rejected + stats.pendingReview} รายการ
            </div>
          </div>

          <div style={styles.progressCard}>
            <div style={styles.progressTitle}>💰 สถานะการดำเนินการกู้ยืม</div>
            <div style={styles.progressBarContainer}>
              <div style={styles.progressBar(getProcessingRate(), "linear-gradient(90deg, #f093fb 0%, #f5576c 100%)")}></div>
            </div>
            <div style={styles.progressText}>
              {getProcessingRate()}% - เสร็จสิ้น {stats.processCompleted} จาก {stats.inProcess + stats.processCompleted} รายการ
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="main-content" style={styles.mainContent}>
          {/* Recent Activities */}
          <div style={styles.activitiesCard}>
            <div style={styles.activitiesHeader}>
              <h3 style={styles.activitiesTitle}>🔔 กิจกรรมล่าสุด ({getPeriodLabel()})</h3>
              <button 
                className="view-all"
                style={styles.viewAllButton} 
                onClick={handleViewAllActivities}
              >
                ดูทั้งหมด →
              </button>
            </div>
            <div style={styles.activityList}>
              {stats.recentActivities.length > 0 ? (
                stats.recentActivities.map((activity) => {
                  const statusInfo = getDocumentStatusText(activity.documentStatuses);
                  return (
                    <div 
                      key={activity.id} 
                      className="activity-item"
                      style={styles.activityItem}
                      onClick={() => handleViewSubmissionDetail(activity)}
                    >
                      <div style={styles.activityIcon}>📋</div>
                      <div style={styles.activityContent}>
                        <div style={styles.activityName}>
                          {activity.userName} ({activity.student_id})
                        </div>
                        <div style={styles.activityDetail}>
                          ส่งเอกสาร กยศ. ปี {activity.academicYear} เทอม {activity.term}
                        </div>
                        <div style={styles.activityTime}>
                          ⏰ {formatDateTime(activity.submittedAt)}
                        </div>
                      </div>
                      <div style={styles.activityBadge(statusInfo.bgColor, statusInfo.color)}>
                        {statusInfo.text}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
                  <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📭</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>ไม่มีกิจกรรมในช่วงเวลานี้</div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div style={styles.quickActionsCard}>
            <h3 style={styles.quickActionsTitle}>⚡ ดำเนินการด่วน</h3>
            <div style={styles.actionButtons}>
              <button 
                className="action-btn"
                style={styles.actionButton("linear-gradient(135deg, #667eea 0%, #764ba2 100%)")}
                onClick={() => handleQuickAction('document-submission')}
              >
                <span>🔍 ตรวจสอบเอกสาร</span>
                <span style={styles.actionCount}>{stats.pendingReview.toLocaleString()}</span>
              </button>

              <button 
                className="action-btn"
                style={styles.actionButton("linear-gradient(135deg, #f093fb 0%, #f5576c 100%)")}
                onClick={() => handleQuickAction('loan-process')}
              >
                <span>💰 จัดการสถานะการดำเนินการ</span>
                <span style={styles.actionCount}>{stats.inProcess.toLocaleString()}</span>
              </button>

              <button 
                className="action-btn"
                style={styles.actionButton("linear-gradient(135deg, #ffee80ff 0%, #ffd815ff 100%)")}
                onClick={() => handleQuickAction('studentinfo')}
              >
                <span>👥 ดูข้อมูลนักศึกษา</span>
                <span style={styles.actionCount}>{stats.totalStudents.toLocaleString()}</span>
              </button>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
