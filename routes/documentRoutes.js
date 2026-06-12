import express from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth.js';
import {
  uploadDocument,
  getDocuments,
  getDocument,
  deleteDocument,
  getStats,
  getChatHistory,
  sendChat,
  generateReport,
  updateLanguage,
  updateExpiry,
  shareDocument,
  unshareDocument,
} from '../controllers/documentController.js';

const router = express.Router();

// Multer parser setup for memory buffers
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  },
});

// Route: POST /api/documents/upload
router.post('/upload', protect, upload.single('file'), uploadDocument);

// Route: GET /api/documents
router.get('/', protect, getDocuments);

// Route: GET /api/documents/stats
router.get('/stats', protect, getStats);

// Route: GET /api/documents/:id/chat
router.get('/:id/chat', protect, getChatHistory);

// Route: POST /api/documents/:id/chat
router.post('/:id/chat', protect, sendChat);

// Route: GET /api/documents/:id/report
router.get('/:id/report', protect, generateReport);

// Route: POST /api/documents/:id/language
router.post('/:id/language', protect, updateLanguage);

// Route: PATCH /api/documents/:id/language
router.patch('/:id/language', protect, updateLanguage);

// Route: PATCH /api/documents/:id/expiry
router.patch('/:id/expiry', protect, updateExpiry);

// Route: POST /api/documents/:id/share
router.post('/:id/share', protect, shareDocument);

// Route: DELETE /api/documents/:id/share
router.delete('/:id/share', protect, unshareDocument);

// Route: GET /api/documents/:id
router.get('/:id', protect, getDocument);

// Route: DELETE /api/documents/:id
router.delete('/:id', protect, deleteDocument);

export default router;
