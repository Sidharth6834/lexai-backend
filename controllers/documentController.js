import { v2 as cloudinary } from 'cloudinary';
import pdf from 'pdf-parse';
import axios from 'axios';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import Document from '../models/Document.js';
import User from '../models/User.js';
import { sendAnalysisCompleteEmail } from '../utils/emailService.js';

// Configure Cloudinary SDK with environment credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET
});

const PYTHON_AI_SERVICE_URL = process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8000';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to generate realistic legal analysis clauses based on document type
const generateMockAnalysis = (type) => {
  const defaultSummary = 'This agreement establishes the legal relationship and obligations between the signing parties. Important clauses surrounding governing law, arbitration, liability limitations, and payment terms have been analyzed for potential risks.';

  switch (type) {
    case 'rent_agreement':
      return {
        riskLevel: 'caution',
        summary: 'Standard rental agreement outlining lessor and lessee rights. The contract generally protects the landlord but features a few clauses requiring attention, specifically the unilateral entry policy and high penalty rates.',
        clauses: [
          {
            title: 'Late Payment Penalty',
            originalText: 'If rent is unpaid by the 5th day of the calendar month, a late fee of 15% of the monthly rent will be added immediately.',
            explanation: 'Charging a 15% penalty immediately after the grace period is aggressive and might violate local tenancy regulations governing maximum fees.',
            riskLevel: 'caution',
            suggestion: 'Negotiate a flat-rate penalty (e.g., $50) or reduce the percentage fee to a standard 5% cap.',
          },
          {
            title: 'Landlord Unilateral Entry',
            originalText: 'The Landlord reserves the right to enter the leased premises at any time, without prior notice to the Tenant, for inspections and repairs.',
            explanation: 'This clause infringes on the tenant\'s legal covenant of quiet enjoyment. Except in emergencies, landlords must provide prior notice.',
            riskLevel: 'risky',
            suggestion: 'Amend the clause to require at least 24 hours written notice before entering the property, except during emergency crises.',
          },
          {
            title: 'Security Deposit Refund Grace Period',
            originalText: 'The security deposit will be returned in full, minus documented damages, within 45 days after the termination of the lease.',
            explanation: '45 days is a standard duration, though several states restrict deposit returns to a 14 to 21-day timeline.',
            riskLevel: 'safe',
            suggestion: 'This clause is legally acceptable. However, verify if local municipal codes mandate a faster 21-day refund window.',
          },
        ],
      };

    case 'job_offer':
      return {
        riskLevel: 'risky',
        summary: 'Employment contract offer letter specifying job description and remuneration. Contains an overly broad non-compete clause that poses severe career mobility restrictions.',
        clauses: [
          {
            title: 'Post-Employment Non-Compete Restriction',
            originalText: 'The Employee shall not engage, directly or indirectly, in any business competitive with the Employer anywhere in North America for a period of 24 months after separation.',
            explanation: 'A 24-month duration spanning all of North America is excessively broad and highly likely to be ruled unenforceable by courts due to restraint of trade.',
            riskLevel: 'risky',
            suggestion: 'Request narrowing the geographical boundary to a specific city/county and reducing the length to a maximum of 6 months.',
          },
          {
            title: 'Inventions and IP Assignment',
            originalText: 'All intellectual property, proprietary designs, and patentable inventions developed by the Employee during their employment tenure shall be assigned exclusively to the Employer.',
            explanation: 'This is a standard employment IP waiver. It ensures the business retains product ownership produced under work hours.',
            riskLevel: 'safe',
            suggestion: 'Standard clause. Verify that the assignment applies exclusively to ideas relevant to employer operations, excluding private off-hour hobbies.',
          },
          {
            title: 'At-Will Employment Status',
            originalText: 'The Company reserves the right to terminate employment immediately at any time, with or without cause, and without prior written notice.',
            explanation: 'This places the employee in a vulnerable position. While at-will employment is common, Immediate termination yields zero severance security.',
            riskLevel: 'caution',
            suggestion: 'Negotiate a mutual termination notification period of at least two weeks, or request standard severance pay provisions.',
          },
        ],
      };

    case 'loan_agreement':
      return {
        riskLevel: 'caution',
        summary: 'Debt repayment agreement specifying interest rates, collateral, and defaults. The default acceleration clause is standard but exposes the borrower to immediate full debt repayment.',
        clauses: [
          {
            title: 'Default Acceleration Clause',
            originalText: 'Upon any default in payment, the entire unpaid principal balance and all accrued interest shall become immediately due and payable.',
            explanation: 'Acceleration gives the lender immediate legal remedy to demand full loan payoff, offering no cure window for missed payments.',
            riskLevel: 'caution',
            suggestion: 'Negotiate a cure period of at least 15 days following written default notice before acceleration takes effect.',
          },
          {
            title: 'Governing Law and Forum Selection',
            originalText: 'This Agreement shall be governed by, and construed in accordance with, the laws of the State of Delaware, and any lawsuits must be filed in Wilmington courts.',
            explanation: 'If you reside outside Delaware, litigating disputes in Wilmington creates substantial travel expenses and jurisdictional hurdles.',
            riskLevel: 'caution',
            suggestion: 'Request changing the governing law to your home state or local county jurisdiction if possible.',
          },
        ],
      };

    default:
      return {
        riskLevel: 'safe',
        summary: defaultSummary,
        clauses: [
          {
            title: 'Dispute Arbitration Clause',
            originalText: 'All disputes arising from this contract shall be settled via binding individual arbitration under the rules of the AAA, waiving any class action rights.',
            explanation: 'Arbitration avoids public litigation but waives your right to a jury trial and participation in class action suits.',
            riskLevel: 'caution',
            suggestion: 'Verify if you can opt out of the arbitration clause within 30 days of signing.',
          },
          {
            title: 'Governing Law',
            originalText: 'This contract is governed by and interpreted under the jurisdiction of Delaware state law.',
            explanation: 'Delaware law is favorable to corporate interests. If both parties reside elsewhere, this might add complexity.',
            riskLevel: 'safe',
            suggestion: 'No immediate action required, but be mindful of Delaware litigation requirements.',
          },
        ],
      };
  }
};

// Asynchronous background legal analysis simulation
const simulateAnalysis = (docId, type) => {
  // Transition status to 'analyzing' after 3 seconds
  setTimeout(async () => {
    try {
      await Document.findByIdAndUpdate(docId, { status: 'analyzing' });
      console.log(`Document ${docId} analysis phase: status -> analyzing`);

      // Transition to 'complete' with generated mock analysis after 5 more seconds
      setTimeout(async () => {
        try {
          const analysis = generateMockAnalysis(type);
          await Document.findByIdAndUpdate(docId, {
            status: 'complete',
            riskLevel: analysis.riskLevel,
            summary: analysis.summary,
            clauses: analysis.clauses,
          });
          console.log(`Document ${docId} analysis phase: status -> complete`);
        } catch (err) {
          console.error(`Error completing background analysis for ${docId}:`, err.message);
        }
      }, 5000);

    } catch (err) {
      console.error(`Error transitioning ${docId} to analyzing:`, err.message);
    }
  }, 3000);
};

// Add this function — called after PDF upload is saved
export const triggerAnalysis = async (documentId, extractedText, documentType, language = 'english') => {
    try {
        // Transition status to 'analyzing'
        await Document.findByIdAndUpdate(documentId, { status: 'analyzing' });
        console.log(`Document ${documentId} status -> analyzing`);

        // Call Python AI service
        const response = await axios.post(
            `${PYTHON_AI_SERVICE_URL}/analyze`,
            {
                documentId: documentId.toString(),
                extractedText,
                documentType,
                language
            },
            { timeout: 120000 } // 2 min timeout for large docs
        )
        
        const { summary, overallRisk, clauses } = response.data
        
        // Update document in MongoDB with results
        const updatedDoc = await Document.findByIdAndUpdate(
            documentId,
            {
                status: 'complete',
                summary,
                riskLevel: overallRisk,
                clauses
            },
            { new: true }
        );
        
        console.log(`Analysis complete for document ${documentId}`);

        // Fetch User and dispatch completion email alert
        if (updatedDoc) {
            try {
                const user = await User.findById(updatedDoc.userId);
                if (user && user.email) {
                    await sendAnalysisCompleteEmail(user.email, user.name || 'User', updatedDoc);
                    console.log(`Completion email successfully dispatched to ${user.email} for doc ${documentId}`);
                }
            } catch (emailErr) {
                console.error(`Email dispatch failed for document ${documentId}:`, emailErr.message);
            }
        }
        
    } catch (error) {
        console.error('Analysis failed:', error.message)
        // Mark as failed so frontend stops polling
        await Document.findByIdAndUpdate(documentId, {
            status: 'failed'
        })
    }
}

// @desc    Upload document, extract text, save to DB
// @route   POST /api/documents/upload
// @access  Private
export const uploadDocument = async (req, res) => {
  try {
    const { name, type, description, expiryDate } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'Please upload a PDF file' });
    }

        // Extract text from the PDF buffer using pdf-parse
    let extractedText = '';
    try {
      const parsedPdf = await pdf(file.buffer);
      extractedText = parsedPdf.text;
    } catch (pdfError) {
      console.warn(`PDF Parse failed: ${pdfError.message}. Falling back to plain text extraction.`);
      extractedText = file.buffer.toString('utf-8');
    }

    let fileUrl = '';
    let publicId = '';

    // Verify Cloudinary configuration keys
    const isCloudinaryConfigured =
      process.env.CLOUDINARY_NAME &&
      process.env.CLOUDINARY_NAME !== 'your_cloudinary_name' &&
      process.env.CLOUDINARY_KEY &&
      process.env.CLOUDINARY_KEY !== 'your_cloudinary_key';

    if (isCloudinaryConfigured) {
      const uploadFromBuffer = (fileBuffer) => {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              resource_type: 'raw',
              folder: 'lexai-docs',
              public_id: `${Date.now()}-${name.replace(/[^a-z0-9.]/gi, '_')}`,
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          );
          uploadStream.end(fileBuffer);
        });
      };

      const result = await uploadFromBuffer(file.buffer);
      fileUrl = result.secure_url;
      publicId = result.public_id;
    } else {
      console.log('Cloudinary not configured. Storing file locally.');
      const sanitizedName = name.replace(/[^a-z0-9]/gi, '_');
      const filename = `${Date.now()}-${sanitizedName}.pdf`;
      const uploadDir = path.join(__dirname, '..', 'uploads');
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      fs.writeFileSync(path.join(uploadDir, filename), file.buffer);
      
      fileUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
      publicId = `local_${filename}`;
    }

    // Save initial record with status: 'uploaded'
    const savedDocument = await Document.create({
      userId: req.user._id,
      name,
      type,
      description: description || '',
      fileUrl,
      publicId,
      extractedText,
      status: 'uploaded',
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      riskLevel: null,
      clauses: [],
      chatHistory: [],
    });

    // Don't await — run analysis in background
    triggerAnalysis(savedDocument._id, extractedText, type, savedDocument.language)

    // Immediately return to user (don't make them wait)
    res.status(201).json(savedDocument)
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all documents for the authenticated user (exclude extractedText)
// @route   GET /api/documents
// @access  Private
export const getDocuments = async (req, res) => {
  try {
    const docs = await Document.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('-extractedText');
    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single document details by ID (include extractedText)
// @route   GET /api/documents/:id
// @access  Private
export const getDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);

    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Ensure ownership
    if (doc.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied: Not your document' });
    }

    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete document from DB & Cloudinary
// @route   DELETE /api/documents/:id
// @access  Private
export const deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);

    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Ensure ownership
    if (doc.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied: Cannot delete this document' });
    }

    // Delete asset from Cloudinary
    if (doc.publicId && !doc.publicId.startsWith('lexai-docs/mock_')) {
      try {
        await cloudinary.uploader.destroy(doc.publicId, { resource_type: 'raw' });
        console.log(`Cloudinary asset destroyed: ${doc.publicId}`);
      } catch (cloudinaryErr) {
        console.error(`Failed to delete Cloudinary asset: ${cloudinaryErr.message}`);
      }
    }

    // Delete record from DB
    await Document.findByIdAndDelete(req.params.id);
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get document analytics metrics
// @route   GET /api/documents/stats
// @access  Private
export const getStats = async (req, res) => {
  try {
    const total = await Document.countDocuments({ userId: req.user._id });
    const complete = await Document.countDocuments({ userId: req.user._id, status: 'complete' });
    const riskAlerts = await Document.countDocuments({ userId: req.user._id, riskLevel: 'risky' });

    res.json({
      total,
      complete,
      riskAlerts,
      totalDocuments: total,
      analysesComplete: complete,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get chat history for a document
// @route   GET /api/documents/:id/chat
// @access  Private
export const getChatHistory = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }
    if (doc.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied: Not your document' });
    }
    res.json(doc.chatHistory || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Send a query to the Python AI service and save in history
// @route   POST /api/documents/:id/chat
// @access  Private
export const sendChat = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ message: 'Please provide a message' });
    }

    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }
    if (doc.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied: Not your document' });
    }

    // Verify document analysis status
    if (doc.status !== 'complete') {
      return res.status(400).json({ message: 'Document analysis not complete yet' });
    }

    // Add user question to history
    doc.chatHistory.push({
      role: 'user',
      content: message,
      createdAt: new Date(),
    });

    // Slice last 10 messages from history to keep context compact for the Python backend
    const lastTenMessages = doc.chatHistory.slice(-10).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    let aiResponse = '';

    try {
      // Connect to the Python AI service
      const response = await axios.post(`${PYTHON_AI_SERVICE_URL}/chat`, {
        documentId: doc._id,
        message,
        extractedText: doc.extractedText || '',
        chatHistory: lastTenMessages,
        language: doc.language || 'english',
      });

      aiResponse = response.data.response;
    } catch (axiosError) {
      console.error(`Python AI service contact failed: ${axiosError.message}`);
      // Remove user message from chatHistory since upload failed/refused
      doc.chatHistory.pop();
      // Return 503 if Python service is unreachable
      return res.status(503).json({ message: 'AI service temporarily unavailable' });
    }

    // Add AI response to history
    const assistantMessage = {
      role: 'assistant',
      content: aiResponse,
      createdAt: new Date(),
    };
    doc.chatHistory.push(assistantMessage);

    await doc.save();
    
    // Return AI response and updated chatHistory
    res.json({
      response: aiResponse,
      chatHistory: doc.chatHistory,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Generate PDF analysis report of document
// @route   GET /api/documents/:id/report
// @access  Private
export const generateReport = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }
    if (doc.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied: Not your document' });
    }

    // Verify document analysis status
    if (doc.status !== 'complete') {
      return res.status(400).json({ message: 'Analysis not complete' });
    }

    // Create PDFDocument
    const pdfDoc = new PDFDocument({ margin: 50, bufferPages: true });

    // Set response headers
    const safeFilename = doc.name.replace(/[^a-z0-9]/gi, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}-analysis.pdf"`);

    // Pipe PDF to response
    pdfDoc.pipe(res);

    // ==========================================
    // PAGE 1: COVER PAGE
    // ==========================================
    // Dark background #0f172a
    pdfDoc.rect(0, 0, pdfDoc.page.width, pdfDoc.page.height).fill('#0f172a');

    // Title / Header logo
    pdfDoc.fillColor('#6366f1') // indigo logo accent
          .fontSize(36)
          .font('Helvetica-Bold')
          .text('LexAI', 50, 150);

    // Subtitle
    pdfDoc.fillColor('#94a3b8') // slate-400
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('Legal Document Analysis Report', 50, 200);

    // Horizontal line
    pdfDoc.strokeColor('#334155') // slate-700
          .lineWidth(2)
          .moveTo(50, 230)
          .lineTo(pdfDoc.page.width - 50, 230)
          .stroke();

    // Document Name
    pdfDoc.fillColor('white')
          .fontSize(24)
          .font('Helvetica-Bold')
          .text(doc.name, 50, 270, { width: pdfDoc.page.width - 100 });

    // Document Type Badge
    const docTypeLabel = doc.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const badgeX = 50;
    const badgeY = pdfDoc.y + 20;
    const badgeWidth = pdfDoc.widthOfString(docTypeLabel) + 20;
    const badgeHeight = 25;
    
    // Draw blue badge background
    pdfDoc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 5).fill('#3b82f6');
    // Draw text inside badge
    pdfDoc.fillColor('white')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(docTypeLabel, badgeX + 10, badgeY + 8);

    // Analysis Date
    const analysisDateStr = `Analysis Date: ${new Date(doc.createdAt).toLocaleDateString()}`;
    pdfDoc.fillColor('#94a3b8')
          .fontSize(11)
          .font('Helvetica')
          .text(analysisDateStr, 50, badgeY + badgeHeight + 25);

    // Overall Risk Level with Colored Circle
    let riskColor = '#10b981'; // safe green
    if (doc.riskLevel === 'caution') riskColor = '#f59e0b'; // caution orange
    if (doc.riskLevel === 'risky') riskColor = '#ef4444'; // risky red

    const riskY = pdfDoc.y + 30;
    pdfDoc.fillColor('#94a3b8')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('Overall Risk Profile: ', 50, riskY);

    const textWidth = pdfDoc.widthOfString('Overall Risk Profile: ');
    // Draw colored circle
    pdfDoc.circle(50 + textWidth + 15, riskY + 5, 8).fill(riskColor);
    // Draw risk text label
    const riskLabel = (doc.riskLevel || 'Safe').toUpperCase();
    pdfDoc.fillColor('white')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text(riskLabel, 50 + textWidth + 30, riskY);

    // Calculate Weighted Risk Score
    const docClausesList = doc.clauses || [];
    const safeClausesCount = docClausesList.filter(c => c.riskLevel === 'safe').length;
    const cautionClausesCount = docClausesList.filter(c => c.riskLevel === 'caution').length;
    const riskyClausesCount = docClausesList.filter(c => c.riskLevel === 'risky').length;
    const totalClausesCount = docClausesList.length;

    let score = 0;
    if (totalClausesCount > 0) {
      const totalPoints = safeClausesCount * 0 + cautionClausesCount * 50 + riskyClausesCount * 100;
      score = Math.round(totalPoints / totalClausesCount);
    }

    // Draw Overall Risk Score
    const scoreY = riskY + 25;
    pdfDoc.fillColor('#94a3b8')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('Overall Risk Score: ', 50, scoreY);

    pdfDoc.fillColor('white')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text(`${score} / 100`, 50 + pdfDoc.widthOfString('Overall Risk Score: ') + 10, scoreY);

    // ==========================================
    // PAGE 2: EXECUTIVE SUMMARY
    // ==========================================
    pdfDoc.addPage(); // Reset to standard page settings (white background)

    pdfDoc.fillColor('#0f172a') // dark text
          .fontSize(22)
          .font('Helvetica-Bold')
          .text('Executive Summary', 50, 60);

    // Divider
    pdfDoc.strokeColor('#cbd5e1') // slate-300
          .lineWidth(1)
          .moveTo(50, 95)
          .lineTo(pdfDoc.page.width - 50, 95)
          .stroke();

    // Summary paragraph
    const summaryText = doc.summary || 'This legal document has been analyzed by LexAI. No executive summary text was provided.';
    pdfDoc.fillColor('#334155')
          .fontSize(11)
          .font('Helvetica')
          .text(summaryText, 50, 120, { width: pdfDoc.page.width - 100, align: 'justify', lineGap: 4 });

    // Risk Overview Section
    const overviewY = pdfDoc.y + 40;
    pdfDoc.fillColor('#0f172a')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text('Risk Overview', 50, overviewY);

    // Calculate clause statistics
    const totalClauses = doc.clauses ? doc.clauses.length : 0;
    const safeClauses = doc.clauses ? doc.clauses.filter(c => c.riskLevel === 'safe').length : 0;
    const cautionClauses = doc.clauses ? doc.clauses.filter(c => c.riskLevel === 'caution').length : 0;
    const riskyClauses = doc.clauses ? doc.clauses.filter(c => c.riskLevel === 'risky').length : 0;

    // Drawing Stats Grid/Table
    const tableY = pdfDoc.y + 15;
    
    // Draw header row
    pdfDoc.rect(50, tableY, pdfDoc.page.width - 100, 30).fill('#f1f5f9');
    pdfDoc.fillColor('#475569')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('Metric', 65, tableY + 10)
          .text('Count', pdfDoc.page.width - 120, tableY + 10, { align: 'right' });

    // Rows helper function
    const drawRow = (y, label, val, valColor = '#0f172a') => {
      pdfDoc.strokeColor('#e2e8f0')
            .lineWidth(1)
            .moveTo(50, y)
            .lineTo(pdfDoc.page.width - 50, y)
            .stroke();

      pdfDoc.fillColor('#334155')
            .fontSize(10)
            .font('Helvetica')
            .text(label, 65, y + 10);

      pdfDoc.fillColor(valColor)
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(val.toString(), pdfDoc.page.width - 120, y + 10, { align: 'right' });
    };

    drawRow(tableY + 30, 'Total Audited Clauses', totalClauses);
    drawRow(tableY + 60, 'Safe Clauses', safeClauses, '#10b981');
    drawRow(tableY + 90, 'Caution Clauses', cautionClauses, '#f59e0b');
    drawRow(tableY + 120, 'Risky Clauses', riskyClauses, '#ef4444');
    
    // Bottom border
    pdfDoc.strokeColor('#e2e8f0')
          .lineWidth(1)
          .moveTo(50, tableY + 150)
          .lineTo(pdfDoc.page.width - 50, tableY + 150)
          .stroke();

    // ==========================================
    // PAGE 3+: CLAUSE ANALYSIS
    // ==========================================
    pdfDoc.addPage();

    pdfDoc.fillColor('#0f172a')
          .fontSize(22)
          .font('Helvetica-Bold')
          .text('Clause Analysis', 50, 60);

    // Divider
    pdfDoc.strokeColor('#cbd5e1')
          .lineWidth(1)
          .moveTo(50, 95)
          .lineTo(pdfDoc.page.width - 50, 95)
          .stroke();

    pdfDoc.y = 115; // Starting position for clauses

    if (doc.clauses && doc.clauses.length > 0) {
      doc.clauses.forEach((clause, index) => {
        // Height check to ensure page breaks don't orphan headers
        if (pdfDoc.y > 560) {
          pdfDoc.addPage();
          pdfDoc.y = 60; // reset y
        }

        // Clause title & index number
        pdfDoc.fillColor('#0f172a')
              .fontSize(12)
              .font('Helvetica-Bold')
              .text(`${index + 1}. ${clause.title}`, 50, pdfDoc.y);

        // Risk Level Badge Box
        let clRiskColor = '#10b981';
        if (clause.riskLevel === 'caution') clRiskColor = '#f59e0b';
        if (clause.riskLevel === 'risky') clRiskColor = '#ef4444';

        const cBadgeX = pdfDoc.page.width - 150;
        const cBadgeY = pdfDoc.y - 12;
        pdfDoc.roundedRect(cBadgeX, cBadgeY, 100, 16, 3).fill(clRiskColor);
        pdfDoc.fillColor('white')
              .fontSize(8)
              .font('Helvetica-Bold')
              .text(clause.riskLevel.toUpperCase(), cBadgeX, cBadgeY + 4, { width: 100, align: 'center' });

        pdfDoc.y += 10; // offset

        // "Original Text:" section
        pdfDoc.fillColor('#475569')
              .fontSize(9)
              .font('Helvetica-Bold')
              .text('Original Text:', 50, pdfDoc.y);

        pdfDoc.fillColor('#64748b')
              .fontSize(9.5)
              .font('Helvetica-Oblique')
              .text(`"${clause.originalText}"`, 60, pdfDoc.y + 12, { width: pdfDoc.page.width - 110, align: 'left', lineGap: 2 });

        pdfDoc.y = pdfDoc.y + 15; // spacing offset

        // "Explanation:" section
        pdfDoc.fillColor('#475569')
              .fontSize(9)
              .font('Helvetica-Bold')
              .text('Explanation:', 50, pdfDoc.y);

        pdfDoc.fillColor('#334155')
              .fontSize(10)
              .font('Helvetica')
              .text(clause.explanation, 60, pdfDoc.y + 12, { width: pdfDoc.page.width - 110, align: 'left', lineGap: 3 });

        pdfDoc.y = pdfDoc.y + 15;

        // "Suggestion:" (only for caution/risky items)
        if (clause.riskLevel === 'caution' || clause.riskLevel === 'risky') {
          if (pdfDoc.y > 600) {
            pdfDoc.addPage();
            pdfDoc.y = 60;
          }

          const suggY = pdfDoc.y + 10;
          const boxPadding = 12;
          
          // Calculate suggestion text height
          pdfDoc.fontSize(9.5).font('Helvetica-Bold');
          const suggTitleH = 12;
          pdfDoc.fontSize(9.5).font('Helvetica');
          const textHeight = pdfDoc.heightOfString(clause.suggestion, { width: pdfDoc.page.width - 140, lineGap: 2 });
          const totalBoxH = textHeight + suggTitleH + (boxPadding * 2) + 4;

          // Draw suggestion box background
          pdfDoc.roundedRect(50, suggY, pdfDoc.page.width - 100, totalBoxH, 6).fill('#eff6ff'); // blue-50 background
          pdfDoc.roundedRect(50, suggY, 4, totalBoxH, 0).fill('#3b82f6'); // blue accent left border

          // Suggestion Title
          pdfDoc.fillColor('#1e40af') // blue-800
                .fontSize(9.5)
                .font('Helvetica-Bold')
                .text('Our Suggestion:', 65, suggY + boxPadding);

          // Suggestion Content text
          pdfDoc.fillColor('#2563eb') // blue-600
                .fontSize(9.5)
                .font('Helvetica')
                .text(clause.suggestion, 65, suggY + boxPadding + 15, { width: pdfDoc.page.width - 140, lineGap: 2 });

          pdfDoc.y = suggY + totalBoxH + 15;
        } else {
          pdfDoc.y += 20;
        }

        // Divider line
        pdfDoc.strokeColor('#f1f5f9')
              .lineWidth(1)
              .moveTo(50, pdfDoc.y - 5)
              .lineTo(pdfDoc.page.width - 50, pdfDoc.y - 5)
              .stroke();
        
        pdfDoc.y += 10;
      });
    } else {
      pdfDoc.fillColor('#64748b')
            .fontSize(11)
            .font('Helvetica-Oblique')
            .text('No analyzed clauses available.', 50, 120);
    }

    // ==========================================
    // OVERLAY HEADERS & FOOTERS (Page Numbers)
    // ==========================================
    const range = pdfDoc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      pdfDoc.switchToPage(i);

      // We do not draw headers/footers on page 1 (cover page)
      if (i > 0) {
        // Top Header
        pdfDoc.strokeColor('#cbd5e1')
              .lineWidth(0.5)
              .moveTo(50, 40)
              .lineTo(pdfDoc.page.width - 50, 40)
              .stroke();

        pdfDoc.fillColor('#64748b')
              .fontSize(8)
              .font('Helvetica')
              .text('LexAI Analysis Report', 50, 28)
              .text(doc.name, pdfDoc.page.width - 250, 28, { align: 'right', width: 200 });
      }

      // Bottom Footer on all pages (including page 1 as requested: "FOOTER on every page")
      pdfDoc.strokeColor('#cbd5e1')
            .lineWidth(0.5)
            .moveTo(50, 755)
            .lineTo(pdfDoc.page.width - 50, 755)
            .stroke();

      pdfDoc.fillColor('#64748b')
            .fontSize(8)
            .font('Helvetica')
            .text('Generated by LexAI | Confidential', 50, 765);

      pdfDoc.text(`Page ${i + 1} of ${range.count}`, pdfDoc.page.width - 150, 765, { align: 'right', width: 100 });
    }

    // End stream
    pdfDoc.end();
  } catch (error) {
    console.error('PDF generation error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update document language and trigger re-analysis
// @route   POST /api/documents/:id/language
// @access  Private
export const updateLanguage = async (req, res) => {
  try {
    const { language } = req.body;
    
    if (!['english', 'hindi'].includes(language)) {
      return res.status(400).json({ message: 'Invalid language option. Choose english or hindi.' });
    }

    const document = await Document.findOne({ _id: req.params.id, userId: req.user._id });
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    document.language = language;
    document.status = 'analyzing';
    await document.save();

    // Trigger re-analysis in background with new language
    triggerAnalysis(document._id, document.extractedText, document.type, language);

    res.status(200).json({ success: true, language });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update document expiry date
// @route   PATCH /api/documents/:id/expiry
// @access  Private
export const updateExpiry = async (req, res) => {
  try {
    const { expiryDate } = req.body;
    const document = await Document.findOne({ _id: req.params.id, userId: req.user._id });
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    document.expiryDate = expiryDate ? new Date(expiryDate) : null;
    document.emailSent = false; // Reset to false to trigger new email alert for the new date
    await document.save();
    res.status(200).json(document);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Generate public shareable link
// @route   POST /api/documents/:id/share
// @access  Private
export const shareDocument = async (req, res) => {
  try {
    const document = await Document.findOne({ _id: req.params.id, userId: req.user._id });
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const token = crypto.randomBytes(16).toString('hex');
    document.shareToken = token;
    document.shareEnabled = true;
    document.shareExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    await document.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.status(200).json({ shareUrl: `${frontendUrl}/shared/${token}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Disable public shareable link
// @route   DELETE /api/documents/:id/share
// @access  Private
export const unshareDocument = async (req, res) => {
  try {
    const document = await Document.findOne({ _id: req.params.id, userId: req.user._id });
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    document.shareEnabled = false;
    document.shareToken = null;
    document.shareExpiresAt = null;
    await document.save();

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get public shared document analysis (No Auth Required)
// @route   GET /api/shared/:token
// @access  Public
export const getSharedDocument = async (req, res) => {
  try {
    const document = await Document.findOne({ shareToken: req.params.token });
    if (!document || !document.shareEnabled) {
      return res.status(404).json({ error: 'Document not found or sharing disabled' });
    }

    if (document.shareExpiresAt && new Date() > document.shareExpiresAt) {
      return res.status(410).json({ error: 'Link expired' });
    }

    // Return document content safely excluding sensitive credentials and full text
    const safeDoc = {
      _id: document._id,
      name: document.name,
      type: document.type,
      summary: document.summary,
      clauses: document.clauses,
      riskLevel: document.riskLevel,
      status: document.status,
      createdAt: document.createdAt,
      shareExpiresAt: document.shareExpiresAt,
    };

    res.status(200).json(safeDoc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

