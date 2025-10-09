// Phase 1 Documents (Initial Application)
export const PHASE_1_DOCUMENTS = [
  'form_101',
  'volunteer_doc',
  'id_copies_student',
  'consent_student_form',
  'consent_father_form',
  'id_copies_father',
  'consent_mother_form',
  'id_copies_mother',
  'guardian_consent',
  'guardian_income_cert',
  'father_income_cert',
  'mother_income_cert',
  'single_parent_income_cert',
  'famo_income_cert',
  'family_status_cert',
  'father_income',
  'mother_income',
  'legal_status',
  'fam_id_copies_gov',
  '102_id_copies_gov',
  'guardian_id_copies',
  'guardian_income',
  'guar_id_copies_gov',
  'fa_id_copies_gov',
  'ma_id_copies_gov',
  'famo_id_copies_gov'
];

// Disbursement Documents (Phase 2)
export const DISBURSEMENT_DOCUMENTS = [
  'disbursement_form',
  'expense_burden_form',
  'id_copies_student',
  'guardian_id_copies'
];

export const detectSubmissionPhase = (submission) => {
  if (!submission || !submission.documentStatuses) {
    console.warn("Invalid submission data for phase detection");
    return null;
  }
  
  const documentTypes = Object.keys(submission.documentStatuses);
  
  if (documentTypes.length === 0) {
    console.warn("No documents found in submission");
    return null;
  }
  
  const DISBURSEMENT_INDICATORS = ['disbursement_form', 'expense_burden_form'];
  
  const hasDisbursementIndicators = documentTypes.some(docType => 
    DISBURSEMENT_INDICATORS.includes(docType)
  );
  
  if (hasDisbursementIndicators) {
    console.log("Phase detection: Found disbursement indicator. Returning 'disbursement'.");
    return 'disbursement';
  }
  
  // ตรวจสอบว่ามีเอกสาร Phase 1 หรือไม่
  const hasPhase1Docs = documentTypes.some(docType => 
    PHASE_1_DOCUMENTS.includes(docType)
  );
  
  if (hasPhase1Docs) {
    console.log("Phase detection: Found Phase 1 documents. Returning 'initial_application'.");
    return 'initial_application';
  }
  
  console.warn("Could not determine phase from documents");
  return null;
};

/**
 * ตรวจสอบว่าเอกสารทั้งหมดในชุดนี้ได้รับการอนุมัติหรือไม่
 */
export const areAllDocumentsApproved = (documentStatuses) => {
  if (!documentStatuses || typeof documentStatuses !== 'object') {
    console.warn("areAllDocumentsApproved: Invalid documentStatuses");
    return false;
  }
  
  const statuses = Object.values(documentStatuses);
  
  if (statuses.length === 0) {
    console.warn("areAllDocumentsApproved: No documents found");
    return false;
  }
  
  // ต้อง approved ทุกตัว
  const allApproved = statuses.every(doc => doc.status === 'approved');
  
  console.log(`Checking ${statuses.length} documents:`);
  statuses.forEach((doc, index) => {
    console.log(`  ${index + 1}. Status: ${doc.status}`);
  });
  console.log(`Result: ${allApproved ? 'ALL APPROVED' : 'NOT ALL APPROVED'}`);
  
  return allApproved;
};

/**
 * รับข้อความแสดงสถานะตาม phase
 */
export const getPhaseInfo = (phase) => {
  const phaseInfoMap = {
    'initial_application': {
      label: 'ยื่นกู้ครั้งแรก',
      color: '#3b82f6',
      description: 'เอกสารสำหรับการยื่นกู้ครั้งแรก'
    },
    'disbursement': {
      label: 'เบิกเงิน',
      color: '#10b981',
      description: 'เอกสารสำหรับการเบิกเงินกู้'
    },
    'completed': {
      label: 'เสร็จสิ้น',
      color: '#6b7280',
      description: 'ดำเนินการเสร็จสิ้นแล้ว'
    }
  };
  
  return phaseInfoMap[phase] || {
    label: 'ไม่ระบุ Phase',
    color: '#6b7280',
    description: ''
  };
};