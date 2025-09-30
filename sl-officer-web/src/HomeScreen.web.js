import React, { useState, useEffect } from "react";
import { db } from "./database/firebase";
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  query,
  where 
} from "firebase/firestore";

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalSubmissions: 0,
    pendingReview: 0,
    approved: 0,
    rejected: 0,
    inProcess: 0,
    processCompleted: 0,
    systemStatus: 'ปิดใช้งาน'
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [systemConfig, setSystemConfig] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

const fetchAvailablePeriods = async () => {
  try {
    const periodsRef = doc(db, "DocumentService", "submission_periods_history");
    const periodsDoc = await getDoc(periodsRef);
    if (periodsDoc.exists()) {
      const data = periodsDoc.data();
      return {
        years: Array.isArray(data.availableYears) ? data.availableYears : [],
        terms: Array.isArray(data.availableTerms) ? data.availableTerms : ['1', '2', '3'],
      };
    }
    return { years: [], terms: ['1', '2', '3'] }; 
  } catch (error) {
    console.error("Error fetching available periods for dashboard:", error);
    return { years: [], terms: ['1', '2', '3'] };
  }
};


// ใน HomeScreen.web.js (แทนที่ fetchDashboardData เดิม)

const fetchDashboardData = async () => {
    try {
        setLoading(true);

        // ... Fetch config และ Fetch all students (โค้ดเดิม) ...
        const configRef = doc(db, "DocumentService", "config");
        const configDoc = await getDoc(configRef);
        let config = null;
        if (configDoc.exists()) {
            config = configDoc.data();
            setSystemConfig(config);
        }

        const usersSnap = await getDocs(collection(db, "users"));
        const totalStudents = usersSnap.size;

        const { years, terms } = await fetchAvailablePeriods();
        
        // เรียงลำดับเพื่อให้การตัดสินใจสถานะอิงจากปี/เทอมที่ใหม่ที่สุดก่อน
        // ปีล่าสุด (2568) ก่อน ปีเก่า (2567)
        const sortedYears = years.sort((a, b) => parseInt(b) - parseInt(a)); 
        // เทอมล่าสุด (3) ก่อน เทอมเก่า (1)
        const sortedTerms = terms.sort((a, b) => parseInt(b) - parseInt(a)); 

        const totalSubmissionUsers = new Set();
        // Map สำหรับเก็บสถานะสุดท้ายของผู้ใช้: Key = userId, Value = สถานะ ('approved', 'rejected', 'pending')
        const userFinalStatusMap = new Map(); 
        const userLoanProcessStatusMap = new Map();
        const approvedUserIdsInThisTerm = []; // เก็บ userId ที่ Approved ในเทอมนี้

        const fetchPromises = [];

        for (const year of sortedYears) {
            for (const term of sortedTerms) {
                fetchPromises.push((async () => {
                    try {
                        const submissionsRef = collection(db, `document_submissions_${year}_${term}`);
                        const submissionsSnap = await getDocs(submissionsRef);
                        
                        submissionsSnap.forEach((doc) => {
                            const userId = doc.id;
                            const documentStatuses = doc.data().documentStatuses || {};
                            
                            if (Object.keys(documentStatuses).length > 0) {
                                totalSubmissionUsers.add(userId);
                            }

                            // ตรวจสอบสถานะของ Submission ในปี/เทอมนี้
                            const hasPending = Object.values(documentStatuses).some(d => d.status === 'pending');
                            const hasRejected = Object.values(documentStatuses).some(d => d.status === 'rejected');
                            const allApproved = Object.values(documentStatuses).length > 0 && 
                                                Object.values(documentStatuses).every(d => d.status === 'approved');

                            let currentStatus = 'none';
                            if (allApproved) {
                                currentStatus = 'approved';
                            } else if (hasRejected) {
                                currentStatus = 'rejected';
                            } else if (hasPending) {
                                currentStatus = 'pending';
                            }                  
                             // Logic สำหรับการตัดสินใจสถานะเอกสารสุดท้าย (อิงตามลำดับความสำคัญ)
                            if (currentStatus !== 'none') {
                                const existingStatus = userFinalStatusMap.get(userId);
                                
                                if (existingStatus === 'rejected' && currentStatus === 'approved') {
                                     userFinalStatusMap.set(userId, 'approved');
                                } else if (existingStatus !== 'approved') {
                                     if (currentStatus === 'approved') {
                                         userFinalStatusMap.set(userId, 'approved');
                                     }
                                     else if (currentStatus === 'rejected' && existingStatus !== 'rejected') {
                                         userFinalStatusMap.set(userId, 'rejected');
                                     }
                                     else if (currentStatus === 'pending' && existingStatus === undefined) {
                                         userFinalStatusMap.set(userId, 'pending');
                                     }
                                }
                            }
                        }); // End submissionsSnap.forEach

                        // ------------------------------------------------
                        // 2. ประมวลผลสถานะกระบวนการกู้ยืม (Loan Process Status)
                        // ------------------------------------------------

                        // ดึงสถานะกระบวนการกู้ยืมสำหรับผู้ที่เอกสาร Approved แล้วเท่านั้น
                        for (const userId of approvedUserIdsInThisTerm) {
                            try {
                                const statusRef = doc(db, `loan_process_status_${year}_${term}`, userId);
                                const statusDoc = await getDoc(statusRef);

                                // สถานะการดำเนินการหลัก: 'processing' หรือ 'completed'
                                let processStatus = 'inProcess'; 

                                if (statusDoc.exists()) {
                                    const data = statusDoc.data();
                                    processStatus = data.overallStatus === 'completed' ? 'completed' : 'inProcess';
                                } else {
                                    // ถ้า Document ยังไม่มี แต่เอกสาร Approved แล้ว ถือว่า "In Process"
                                    processStatus = 'inProcess';
                                }
                                
                                // **ตรรกะสำคัญ:** ใช้สถานะที่พบเป็นสถานะสุดท้ายของผู้ใช้
                                // (ตรรกะเดียวกัน: การวนลูปจากล่าสุดไปเก่าสุด)
                                if (processStatus === 'completed') {
                                    userLoanProcessStatusMap.set(userId, 'completed');
                                } else if (processStatus === 'inProcess' && userLoanProcessStatusMap.get(userId) !== 'completed') {
                                    // ถ้าเป็น inProcess และยังไม่เคยถูกบันทึกเป็น completed ให้บันทึกเป็น inProcess
                                    userLoanProcessStatusMap.set(userId, 'inProcess');
                                }

                            } catch (e) {
                                console.log(`Skipping loan_process_status_${year}_${term} for ${userId}: ${e.message}`);
                            }
                        }

                    } catch (e) {
                        console.log(`Skipping collection document_submissions_${year}_${term} or loan_process_status: ${e.message}`);
                    }
                })());
            }
        } // End of loops

        await Promise.all(fetchPromises);

                // ---------------------------------------------------------
        // 3. การนับจำนวนคนสุดท้ายจาก Map และ Loan Process Map
        // ---------------------------------------------------------
        
        let finalPendingReviewCount = 0;
        let finalApprovedCount = 0;
        let finalRejectedCount = 0;
        let finalInProcessCount = 0;
        let finalProcessCompletedCount = 0;

        // นับสถานะเอกสาร
        userFinalStatusMap.forEach(status => {
            if (status === 'approved') {
                finalApprovedCount++;
            } else if (status === 'rejected') {
                finalRejectedCount++;
            } else if (status === 'pending') {
                finalPendingReviewCount++;
            }
        });

        // นับสถานะกระบวนการกู้ยืม
        userLoanProcessStatusMap.forEach(status => {
            if (status === 'completed') {
                finalProcessCompletedCount++;
            } else if (status === 'inProcess') {
                finalInProcessCount++;
            }
        });


        // ---------------------------------------------------------

        setStats(prev => ({
            ...prev,
            totalStudents: totalStudents,
            totalSubmissions: totalSubmissionUsers.size, 
            pendingReview: finalPendingReviewCount, 
            approved: finalApprovedCount,           
            rejected: finalRejectedCount,           
            inProcess: finalInProcessCount,        // จำนวนคนที่อยู่ในกระบวนการกู้ยืม
            processCompleted: finalProcessCompletedCount, // จำนวนคนที่เสร็จสิ้นกระบวนการกู้ยืม
            systemStatus: config ? (config.isEnabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน') : 'ปิดใช้งาน'
        }));

    } catch (error) {
        console.error("Error fetching dashboard data:", error);
    } finally {
        setLoading(false);
    }
};

  const getStatusColor = (status) => {
    if (status.includes('เปิดใช้งาน')) return '#28a745';
    if (status === 'รอเปิดใช้งาน') return '#ffc107';
    return '#dc3545';
  };

  const calculateCompletionRate = () => {
    if (stats.totalSubmissions === 0) return 0;
    const totalDocuments = stats.approved + stats.rejected + stats.pendingReview;
    return totalDocuments > 0 ? Math.round((stats.approved / totalDocuments) * 100) : 0;
  };

  const getProcessingRate = () => {
    const total = stats.inProcess + stats.processCompleted;
    return total > 0 ? Math.round((stats.processCompleted / total) * 100) : 0;
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>กำลังโหลดข้อมูล...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>แดชบอร์ดระบบเอกสาร กยศ.</h1>
        <p style={styles.subtitle}>ภาพรวมระบบและสถิติการใช้งาน</p>
      </div>

      {/* System Status Card */}
      <div style={{
        ...styles.systemCard,
        borderLeft: `4px solid ${getStatusColor(stats.systemStatus)}`
      }}>
        <div style={styles.systemCardHeader}>
          <h2 style={styles.systemCardTitle}>สถานะระบบ</h2>
          <span style={{
            ...styles.statusBadge,
            backgroundColor: getStatusColor(stats.systemStatus)
          }}>
            {stats.systemStatus}
          </span>
        </div>
        {systemConfig && (
          <div style={styles.systemInfo}>
            <p><strong>ปีการศึกษา:</strong> {systemConfig.academicYear}</p>
            <p><strong>เทอม:</strong> {systemConfig.term}</p>
            {!systemConfig.immediateAccess && (
              <>
                <p><strong>เปิดรับ:</strong> {systemConfig.startDate} {systemConfig.startTime}</p>
                <p><strong>ปิดรับ:</strong> {systemConfig.endDate} {systemConfig.endTime}</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Main Stats Grid */}
      <div style={styles.statsGrid}>
        <div style={{...styles.statCard, backgroundColor: '#e3f2fd'}}>
          <div style={styles.statIcon}>👥</div>
          <div style={styles.statContent}>
            <p style={styles.statLabel}>นักศึกษาทั้งหมด</p>
            <h3 style={styles.statNumber}>{stats.totalStudents}</h3>
            <p style={styles.statLabel}>คน</p>
          </div>
        </div>

        <div style={{...styles.statCard, backgroundColor: '#f3e5f5'}}>
          <div style={styles.statIcon}>📄</div>
          <div style={styles.statContent}>
            <p style={styles.statLabel}>การส่งเอกสารทั้งหมด</p>
            <h3 style={styles.statNumber}>{stats.totalSubmissions}</h3>
            <p style={styles.statLabel}>คน</p>
          </div>
        </div>

        <div style={{...styles.statCard, backgroundColor: '#fff3e0'}}>
          <div style={styles.statIcon}>⏳</div>
          <div style={styles.statContent}>
            <p style={styles.statLabel}>รอตรวจสอบ</p>
            <h3 style={styles.statNumber}>{stats.pendingReview}</h3>
            <p style={styles.statLabel}>คน</p>
          </div>
        </div>

        <div style={{...styles.statCard, backgroundColor: '#e8f5e9'}}>
          <div style={styles.statIcon}>✅</div>
          <div style={styles.statContent}>
            <p style={styles.statLabel}>อนุมัติแล้ว</p>
            <h3 style={styles.statNumber}>{stats.approved}</h3>
            <p style={styles.statLabel}>คน</p>
          </div>
        </div>

        <div style={{...styles.statCard, backgroundColor: '#ffebee'}}>
          <div style={styles.statIcon}>❌</div>
          <div style={styles.statContent}>
            <p style={styles.statLabel}>ไม่อนุมัติ</p>
            <h3 style={styles.statNumber}>{stats.rejected}</h3>
            <p style={styles.statLabel}>คน</p>
          </div>
        </div>

        <div style={{...styles.statCard, backgroundColor: '#e1f5fe'}}>
          <div style={styles.statIcon}>🔄</div>
          <div style={styles.statContent}>
            <p style={styles.statLabel}>กำลังดำเนินการกู้ยืม</p>
            <h3 style={styles.statNumber}>{stats.inProcess}</h3>
            <p style={styles.statLabel}>คน</p>
          </div>
        </div>

        <div style={{...styles.statCard, backgroundColor: '#f1f8e9'}}>
          <div style={styles.statIcon}>🎉</div>
          <div style={styles.statContent}>
            <p style={styles.statLabel}>เสร็จสิ้นทั้งหมด</p>
            <h3 style={styles.statNumber}>{stats.processCompleted}</h3>
            <p style={styles.statLabel}>คน</p>
          </div>
        </div>

        <div style={{...styles.statCard, backgroundColor: '#fce4ec'}}>
          <div style={styles.statIcon}>📊</div>
          <div style={styles.statContent}>
            <h3 style={styles.statNumber}>{calculateCompletionRate()}%</h3>
            <p style={styles.statLabel}>อัตราการอนุมัติ</p>
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <div style={styles.progressSection}>
        <h2 style={styles.sectionTitle}>ภาพรวมความคืบหน้า</h2>
        <div style={styles.progressGrid}>
          <div style={styles.progressCard}>
            <div style={styles.progressHeader}>
              <h3 style={styles.progressTitle}>การตรวจสอบเอกสาร</h3>
              <span style={styles.progressPercentage}>{calculateCompletionRate()}%</span>
            </div>
            <div style={styles.progressBarContainer}>
              <div style={{
                ...styles.progressBar,
                width: `${calculateCompletionRate()}%`,
                backgroundColor: '#28a745'
              }} />
            </div>
            <div style={styles.progressStats}>
              <span>อนุมัติ: {stats.approved}</span>
              <span>รอตรวจ: {stats.pendingReview}</span>
              <span>ไม่ผ่าน: {stats.rejected}</span>
            </div>
          </div>

          <div style={styles.progressCard}>
            <div style={styles.progressHeader}>
              <h3 style={styles.progressTitle}>กระบวนการกู้ยืม</h3>
              <span style={styles.progressPercentage}>{getProcessingRate()}%</span>
            </div>
            <div style={styles.progressBarContainer}>
              <div style={{
                ...styles.progressBar,
                width: `${getProcessingRate()}%`,
                backgroundColor: '#007bff'
              }} />
            </div>
            <div style={styles.progressStats}>
              <span>เสร็จสิ้น: {stats.processCompleted}</span>
              <span>กำลังดำเนินการ: {stats.inProcess}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div style={styles.recentSection}>
        <h2 style={styles.sectionTitle}>การส่งเอกสารล่าสุด</h2>
        <div style={styles.activitiesList}>
          {recentActivities.length > 0 ? (
            recentActivities.map((activity) => (
              <div key={activity.id} style={styles.activityCard}>
                <div style={styles.activityIcon}>📋</div>
                <div style={styles.activityContent}>
                  <p style={styles.activityName}>{activity.userName}</p>
                  <p style={styles.activityDetail}>
                    รหัส: {activity.student_id} | 
                    ปี: {activity.academicYear} | 
                    เทอม: {activity.term}
                  </p>
                  <p style={styles.activityTime}>
                    {new Date(activity.submittedAt).toLocaleString('th-TH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div style={styles.activityBadge}>
                  เอกสาร {Object.keys(activity.documentStatuses || {}).length} รายการ
                </div>
              </div>
            ))
          ) : (
            <p style={styles.noData}>ยังไม่มีการส่งเอกสาร</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={styles.quickActions}>
        <h2 style={styles.sectionTitle}>ลัดเส้นทางด่วน</h2>
        <div style={styles.actionsGrid}>
          <button 
            style={styles.actionButton}
            onClick={() => window.location.href = '/docs'}
          >
            <span style={styles.actionIcon}>⚙️</span>
            <span>จัดการระบบส่งเอกสาร</span>
          </button>
          <button 
            style={styles.actionButton}
            onClick={() => window.location.href = '/document-submission'}
          >
            <span style={styles.actionIcon}>📝</span>
            <span>ตรวจสอบเอกสาร</span>
          </button>
          <button 
            style={styles.actionButton}
            onClick={() => window.location.href = '/loan-process'}
          >
            <span style={styles.actionIcon}>🔄</span>
            <span>สถานะการกู้ยืม</span>
          </button>
          <button 
            style={styles.actionButton}
            onClick={() => window.location.href = '/studentinfo'}
          >
            <span style={styles.actionIcon}>👥</span>
            <span>จัดการนักศึกษา</span>
          </button>
          <button 
            style={styles.actionButton}
            onClick={() => window.location.href = '/create-post'}
          >
            <span style={styles.actionIcon}>📢</span>
            <span>สร้างประกาศ</span>
          </button>
          <button 
            style={styles.actionButton}
            onClick={() => window.location.href = '/all-posts'}
          >
            <span style={styles.actionIcon}>📋</span>
            <span>ดูประกาศทั้งหมด</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={styles.summarySection}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryIcon}>⚠️</div>
          <div style={styles.summaryContent}>
            <h3 style={styles.summaryTitle}>ต้องดำเนินการ</h3>
            <p style={styles.summaryNumber}>{stats.pendingReview}</p>
            <p style={styles.summaryDescription}>คนรอการตรวจสอบ</p>
          </div>
        </div>

        <div style={styles.summaryCard}>
          <div style={styles.summaryIcon}>🎯</div>
          <div style={styles.summaryContent}>
            <h3 style={styles.summaryTitle}>กำลังดำเนินการ</h3>
            <p style={styles.summaryNumber}>{stats.inProcess}</p>
            <p style={styles.summaryDescription}>อยู่ระหว่างกระบวนการกู้ยืม</p>
          </div>
        </div>

        <div style={styles.summaryCard}>
          <div style={styles.summaryIcon}>✨</div>
          <div style={styles.summaryContent}>
            <h3 style={styles.summaryTitle}>สถิติวันนี้</h3>
            <p style={styles.summaryNumber}>
              {recentActivities.filter(a => {
                const today = new Date().toDateString();
                const activityDate = new Date(a.submittedAt).toDateString();
                return today === activityDate;
              }).length}
            </p>
            <p style={styles.summaryDescription}>การส่งเอกสารใหม่</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: 30,
    maxWidth: 1400,
    margin: "0 auto",
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#f5f7fa",
    minHeight: "100vh",
  },
  loading: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    padding: 50,
  },
  header: {
    marginBottom: 30,
    textAlign: "center",
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#2c3e50",
    margin: 0,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#7f8c8d",
    margin: 0,
  },
  systemCard: {
    background: "#fff",
    padding: 25,
    borderRadius: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    marginBottom: 30,
  },
  systemCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  systemCardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2c3e50",
    margin: 0,
  },
  statusBadge: {
    padding: "8px 16px",
    borderRadius: 20,
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  systemInfo: {
    fontSize: 14,
    color: "#555",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 20,
    marginBottom: 30,
  },
  statCard: {
    background: "#fff",
    padding: 20,
    borderRadius: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    display: "flex",
    alignItems: "center",
    gap: 15,
    transition: "transform 0.2s",
    cursor: "default",
  },
  statIcon: {
    fontSize: 40,
  },
  statContent: {
    flex: 1,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2c3e50",
    margin: 0,
    marginTop: 5,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: "#7f8c8d",
    margin: 0,
  },
  recentSection: {
    background: "#fff",
    padding: 25,
    borderRadius: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2c3e50",
    marginTop: 0,
    marginBottom: 20,
  },
  activitiesList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  activityCard: {
    display: "flex",
    alignItems: "center",
    gap: 15,
    padding: 15,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    border: "1px solid #e9ecef",
  },
  activityIcon: {
    fontSize: 30,
  },
  activityContent: {
    flex: 1,
  },
  activityName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2c3e50",
    margin: 0,
    marginBottom: 5,
  },
  activityDetail: {
    fontSize: 13,
    color: "#666",
    margin: 0,
    marginBottom: 3,
  },
  activityTime: {
    fontSize: 12,
    color: "#999",
    margin: 0,
  },
  activityBadge: {
    padding: "6px 12px",
    backgroundColor: "#e3f2fd",
    color: "#1976d2",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: "bold",
  },
  noData: {
    textAlign: "center",
    color: "#999",
    padding: 20,
    fontSize: 14,
  },
  quickActions: {
    background: "#fff",
    padding: 25,
    borderRadius: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 15,
  },
  actionButton: {
    padding: "15px 20px",
    backgroundColor: "#f8f9fa",
    border: "2px solid #e9ecef",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: "bold",
    color: "#495057",
    display: "flex",
    alignItems: "center",
    gap: 10,
    transition: "all 0.2s",
  },
  actionIcon: {
    fontSize: 20,
  },
  progressSection: {
    background: "#fff",
    padding: 25,
    borderRadius: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    marginBottom: 30,
  },
  progressGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 20,
  },
  progressCard: {
    background: "#f8f9fa",
    padding: 20,
    borderRadius: 8,
    border: "1px solid #e9ecef",
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2c3e50",
    margin: 0,
  },
  progressPercentage: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007bff",
  },
  progressBarContainer: {
    width: "100%",
    height: 12,
    backgroundColor: "#e9ecef",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 15,
  },
  progressBar: {
    height: "100%",
    transition: "width 0.3s ease",
    borderRadius: 6,
  },
  progressStats: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    color: "#666",
  },
  summarySection: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 20,
    marginBottom: 30,
  },
  summaryCard: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    padding: 25,
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    color: "white",
    display: "flex",
    alignItems: "center",
    gap: 20,
  },
  summaryIcon: {
    fontSize: 50,
    opacity: 0.9,
  },
  summaryContent: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "normal",
    margin: 0,
    marginBottom: 8,
    opacity: 0.9,
  },
  summaryNumber: {
    fontSize: 36,
    fontWeight: "bold",
    margin: 0,
    marginBottom: 5,
  },
  summaryDescription: {
    fontSize: 13,
    margin: 0,
    opacity: 0.8,
  },
};
