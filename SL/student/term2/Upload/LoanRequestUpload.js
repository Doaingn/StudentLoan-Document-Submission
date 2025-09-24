const LoanRequestUpload = ({ navigation }) => {
  const [uploads, setUploads] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [borrowerData, setBorrowerData] = useState(null);
  const [isUnder20, setIsUnder20] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setIsLoading(false);
        return;
      }
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setBorrowerData(userData);
        const age = new Date().getFullYear() - new Date(userData.dob).getFullYear();
        setIsUnder20(age < 20);
      }
      setIsLoading(false);
    };

    fetchUserData();
  }, []);

  const handleFileUpload = async (docId, allowMultiple = true) => {
    // การอัปโหลดไฟล์จะอยู่ที่นี่
  };

  const saveUploadsToFirebase = async (uploadsData) => {
    // การบันทึกไฟล์ลง Firebase
  };

  const handleSubmitDocuments = async () => {
    // การตรวจสอบว่าอัปโหลดเอกสารครบถ้วนหรือไม่
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <HeaderSection surveyData={borrowerData} />
      <ProgressCard stats={{ uploadedRequired: uploads.length }} />
      <DocumentsSection
        documents={[
          { id: "loan_request_form", title: "Loan Request Form" },
          { id: "borrower_id_copy", title: "Borrower's ID Copy" },
          ...(isUnder20 ? [{ id: "guardian_id_copy", title: "Guardian's ID Copy" }] : []),
          { id: "expense_certificate", title: "Expense Certificate" },
        ]}
        uploads={uploads}
        onFileUpload={handleFileUpload}
      />
      <SubmitSection stats={{ uploadedRequired: uploads.length }} isSubmitting={isSubmitting} onSubmit={handleSubmitDocuments} />
    </ScrollView>
  );
};
