// server.js - AI Backend Server with Express.js and Gemini (Complete Version with ID Card)
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed'), false);
    }
  }
});

// Helper function to convert file to Gemini format
function fileToGenerativePart(filePath, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
      mimeType: mimeType,
    },
  };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'AI Backend Server is running',
    timestamp: new Date().toISOString()
  });
});

// Test AI connection
app.get('/ai/test', async (req, res) => {
  try {
    const result = await model.generateContent("Test connection - respond with 'OK'");
    const response = await result.response;
    const text = response.text();
    
    res.json({
      success: true,
      message: 'AI connection successful',
      response: text,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI test failed:', error);
    res.status(500).json({
      success: false,
      error: 'AI connection failed',
      details: error.message
    });
  }
});

// Validate Form 101 document
app.post('/ai/validate/form101', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    console.log(`Processing Form 101: ${req.file.filename}`);

    const filePart = fileToGenerativePart(req.file.path, req.file.mimetype);

    const prompt = `
ตรวจสอบเอกสารนี้ว่าเป็นแบบฟอร์ม 101 (แบบคำขอรับทุนการศึกษา) หรือไม่

กรุณาตรวจสอบและตอบในรูปแบบ JSON ดังนี้:
{
  "isForm101": true/false,
  "confidence": 0-100,
  "foundElements": ["รายการที่พบในเอกสาร"],
  "missingElements": ["รายการที่ขาดหายไป"],
  "hasSignature": true/false,
  "signatureQuality": "genuine/suspicious/unclear/none",
  "extractedData": {
    "studentName": "ชื่อนักเรียน",
    "studentId": "รหัสนักเรียน",
    "idCard": "เลขบัตรประชาชน",
    "address": "ที่อยู่",
    "phone": "เบอร์โทรศัพท์",
    "email": "อีเมล"
  },
  "recommendations": ["คำแนะนำสำหรับการแก้ไข"],
  "overall_status": "valid/invalid/needs_review"
}

ให้ความสำคัญกับ:
1. การมีอยู่ของหัวเอกสาร "แบบฟอร์ม 101" หรือ "แบบคำขอรับทุนการศึกษา"
2. ช่องกรอกข้อมูลส่วนตัวของนักเรียน
3. ลายเซ็นหรือการลงชื่อ
4. ความชัดเจนและความสมบูรณ์ของข้อมูล
`;

    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();

    // Parse JSON response
    let aiResult;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // Fallback response
      aiResult = {
        isForm101: responseText.toLowerCase().includes('แบบฟอร์ม 101'),
        confidence: 50,
        foundElements: [],
        missingElements: [],
        hasSignature: responseText.toLowerCase().includes('ลายเซ็น'),
        signatureQuality: 'unclear',
        extractedData: {},
        recommendations: ['ไม่สามารถวิเคราะห์รายละเอียดได้'],
        overall_status: 'needs_review',
        rawResponse: responseText
      };
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      filename: req.file.originalname,
      validation: aiResult,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Form 101 validation error:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: 'Validation failed',
      details: error.message
    });
  }
});

// Validate consent form
app.post('/ai/validate/consent/:formType', upload.single('document'), async (req, res) => {
  try {
    const { formType } = req.params; // student, father, mother, guardian
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    if (!['student', 'father', 'mother', 'guardian'].includes(formType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid form type. Must be: student, father, mother, or guardian'
      });
    }

    console.log(`Processing ${formType} consent form: ${req.file.filename}`);

    const filePart = fileToGenerativePart(req.file.path, req.file.mimetype);

    const formTypeText = {
      'student': 'นักเรียน',
      'father': 'บิดา',
      'mother': 'มารดา',
      'guardian': 'ผู้ปกครอง'
    };

    const prompt = `
ตรวจสอบเอกสารนี้ว่าเป็นหนังสือให้ความยินยอมในการเปิดเผยข้อมูลของ${formTypeText[formType]} หรือไม่

กรุณาตรวจสอบและตอบในรูปแบบ JSON ดังนี้:
{
  "isConsentForm": true/false,
  "formType": "${formType}",
  "confidence": 0-100,
  "hasConsent": true/false,
  "consentType": "เปิดเผยข้อมูล/อื่นๆ",
  "hasSignature": true/false,
  "signatureQuality": "genuine/suspicious/unclear/none",
  "extractedData": {
    "name": "ชื่อ-นามสกุล",
    "idCard": "เลขบัตรประชาชน",
    "address": "ที่อยู่",
    "phone": "เบอร์โทรศัพท์",
    "email": "อีเมล",
    "relationship": "ความสัมพันธ์กับนักเรียน"
  },
  "consentDetails": ["รายละเอียดความยินยอม"],
  "recommendations": ["คำแนะนำ"],
  "overall_status": "valid/invalid/needs_review"
}

ให้ความสำคัญกับ:
1. การระบุว่าเป็นหนังสือให้ความยินยอม
2. การระบุประเภทของความยินยอม (เปิดเผยข้อมูล)
3. ข้อมูลส่วนตัวที่สมบูรณ์
4. ลายเซ็นหรือการลงชื่อที่ชัดเจน
5. วันที่ในเอกสาร
`;

    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();

    // Parse JSON response
    let aiResult;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // Fallback response
      aiResult = {
        isConsentForm: responseText.toLowerCase().includes('ความยินยอม'),
        formType: formType,
        confidence: 50,
        hasConsent: responseText.toLowerCase().includes('ยินยอม'),
        consentType: 'ไม่ทราบ',
        hasSignature: responseText.toLowerCase().includes('ลายเซ็น'),
        signatureQuality: 'unclear',
        extractedData: {},
        consentDetails: [],
        recommendations: ['ไม่สามารถวิเคราะห์รายละเอียดได้'],
        overall_status: 'needs_review',
        rawResponse: responseText
      };
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      filename: req.file.originalname,
      formType: formType,
      validation: aiResult,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Consent form validation error:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: 'Validation failed',
      details: error.message
    });
  }
});

// Validate ID Card document
app.post('/ai/validate/idcard/:idType', upload.single('document'), async (req, res) => {
  try {
    const { idType } = req.params; // student, father, mother, guardian
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    if (!['student', 'father', 'mother', 'guardian'].includes(idType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID type. Must be: student, father, mother, or guardian'
      });
    }

    console.log(`Processing ${idType} ID card: ${req.file.filename}`);

    const filePart = fileToGenerativePart(req.file.path, req.file.mimetype);

    const idTypeText = {
      'student': 'นักเรียน/นักศึกษา',
      'father': 'บิดา',
      'mother': 'มารดา',
      'guardian': 'ผู้ปกครอง'
    };

    const prompt = `
ตรวจสอบเอกสารนี้ว่าเป็นสำเนาบัตรประชาชนของ${idTypeText[idType]} หรือไม่

กรุณาตรวจสอบและตอบในรูปแบบ JSON ดังนี้:
{
  "isIDCard": true/false,
  "idType": "${idType}",
  "confidence": 0-100,
  "cardType": "บัตรประชาชน/บัตรข้าราชการ/พาสปอร์ต/อื่นๆ",
  "isValidIDNumber": true/false,
  "isExpired": true/false/null,
  "imageQuality": "clear/blurry/poor/excellent",
  "extractedData": {
    "idNumber": "เลขบัตรประชาชน",
    "name": "ชื่อ-นามสกุล",
    "nameEn": "ชื่อ-นามสกุลภาษาอังกฤษ",
    "dateOfBirth": "วันเกิด",
    "issueDate": "วันที่ออกบัตร",
    "expiryDate": "วันหมดอายุ",
    "address": "ที่อยู่",
    "religion": "ศาสนา"
  },
  "securityFeatures": {
    "hasWatermark": true/false,
    "hasHologram": true/false,
    "hasMRZCode": true/false
  },
  "qualityIssues": ["ปัญหาที่พบ"],
  "recommendations": ["คำแนะนำ"],
  "overall_status": "valid/invalid/needs_review"
}

ให้ความสำคัญกับ:
1. การตรวจสอบว่าเป็นบัตรประชาชนไทยจริง
2. เลขประจำตัวประชาชน 13 หลัก
3. ความชัดเจนของข้อมูลและรูปภาพ
4. วันหมดอายุของบัตร
5. ลักษณะการรักษาความปลอดภัยของบัตร (watermark, hologram)
6. ความสมบูรณ์ของข้อมูลที่จำเป็น
`;

    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();

    // Parse JSON response
    let aiResult;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // Fallback response
      aiResult = {
        isIDCard: responseText.toLowerCase().includes('บัตรประชาชน'),
        idType: idType,
        confidence: 50,
        cardType: 'ไม่ทราบ',
        isValidIDNumber: responseText.toLowerCase().includes('เลขประจำตัว'),
        isExpired: null,
        imageQuality: 'unclear',
        extractedData: {},
        securityFeatures: {},
        qualityIssues: ['ไม่สามารถวิเคราะห์รายละเอียดได้'],
        recommendations: ['ไม่สามารถวิเคราะห์รายละเอียดได้'],
        overall_status: 'needs_review',
        rawResponse: responseText
      };
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      filename: req.file.originalname,
      idType: idType,
      validation: aiResult,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('ID Card validation error:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: 'Validation failed',
      details: error.message
    });
  }
});

// Batch validation endpoint
app.post('/ai/validate/batch', upload.array('documents', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const validationResults = [];
    
    for (const file of req.files) {
      try {
        // Simple document type detection based on filename or content
        let documentType = 'unknown';
        if (file.originalname.toLowerCase().includes('101') || file.originalname.toLowerCase().includes('form')) {
          documentType = 'form101';
        } else if (file.originalname.toLowerCase().includes('consent') || file.originalname.toLowerCase().includes('ยินยอม')) {
          documentType = 'consent';
        } else if (file.originalname.toLowerCase().includes('id') || file.originalname.toLowerCase().includes('บัตร')) {
          documentType = 'idcard';
        }

        const filePart = fileToGenerativePart(file.path, file.mimetype);
        
        // Use a generic validation prompt
        const prompt = `
วิเคราะห์เอกสารนี้และบอกประเภท เนื้อหา และความถูกต้อง

ตอบในรูปแบบ JSON:
{
  "documentType": "ประเภทเอกสาร",
  "confidence": 0-100,
  "hasSignature": true/false,
  "isComplete": true/false,
  "extractedData": {},
  "recommendations": ["คำแนะนำ"],
  "overall_status": "valid/invalid/needs_review"
}
`;

        const result = await model.generateContent([prompt, filePart]);
        const response = await result.response;
        const responseText = response.text();

        let aiResult;
        try {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          aiResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Parse failed' };
        } catch {
          aiResult = { error: 'Parse failed', rawResponse: responseText };
        }

        validationResults.push({
          filename: file.originalname,
          documentType: documentType,
          validation: aiResult
        });

        // Clean up file
        fs.unlinkSync(file.path);
        
      } catch (error) {
        validationResults.push({
          filename: file.originalname,
          error: error.message
        });
        
        // Clean up file on error
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    res.json({
      success: true,
      totalFiles: req.files.length,
      results: validationResults,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch validation error:', error);
    
    // Clean up all files on error
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({
      success: false,
      error: 'Batch validation failed',
      details: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB'
      });
    }
  }
  
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: error.message
  });
});

// FIXED: 404 handler - Use proper catch-all route syntax
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    availableEndpoints: [
      'GET /health',
      'GET /ai/test',
      'POST /ai/validate/form101',
      'POST /ai/validate/consent/:formType',
      'POST /ai/validate/idcard/:idType',
      'POST /ai/validate/batch'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🤖 AI Backend Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔬 AI test: http://localhost:${PORT}/ai/test`);
  console.log(`📄 Form 101 validation: POST http://localhost:${PORT}/ai/validate/form101`);
  console.log(`📋 Consent validation: POST http://localhost:${PORT}/ai/validate/consent/:formType`);
  console.log(`🆔 ID Card validation: POST http://localhost:${PORT}/ai/validate/idcard/:idType`);
  console.log(`📦 Batch validation: POST http://localhost:${PORT}/ai/validate/batch`);
});

module.exports = app;
