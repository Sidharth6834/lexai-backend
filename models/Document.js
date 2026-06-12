import mongoose from 'mongoose';

const clauseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  originalText: {
    type: String,
    required: true,
  },
  explanation: {
    type: String,
    required: true,
  },
  riskLevel: {
    type: String,
    enum: ['safe', 'caution', 'risky'],
    required: true,
  },
  suggestion: {
    type: String,
    required: false,
  },
});

const chatMessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const documentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Please add a document name'],
    trim: true,
  },
  type: {
    type: String,
    enum: [
      'rent_agreement',
      'job_offer',
      'loan_agreement',
      'sale_deed',
      'service_agreement',
      'other',
    ],
    required: [true, 'Please add a document type'],
  },
  description: {
    type: String,
    trim: true,
  },
  fileUrl: {
    type: String,
    required: true,
  },
  publicId: {
    type: String,
    required: true,
  },
  extractedText: {
    type: String,
  },
  status: {
    type: String,
    enum: ['uploaded', 'analyzing', 'complete', 'failed'],
    default: 'uploaded',
  },
  language: {
    type: String,
    enum: ['english', 'hindi'],
    default: 'english',
  },
  riskLevel: {
    type: String,
    enum: ['safe', 'caution', 'risky'],
    default: null,
  },
  summary: {
    type: String,
  },
  expiryDate: {
    type: Date,
    default: null,
  },
  emailSent: {
    type: Boolean,
    default: false,
  },
  shareToken: {
    type: String,
    default: null,
    sparse: true,
  },
  shareEnabled: {
    type: Boolean,
    default: false,
  },
  shareExpiresAt: {
    type: Date,
    default: null,
  },
  clauses: [clauseSchema],
  chatHistory: [chatMessageSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Document = mongoose.model('Document', documentSchema);
export default Document;
