import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import startExpiryReminderJob from './jobs/expiryReminder.js';
import { getSharedDocument } from './controllers/documentController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Connect to MongoDB
connectDB();

// Start background cron jobs
startExpiryReminderJob();

const app = express();

// Security Headers (configured to allow cross-origin requests for static uploads)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// API Rate Limiting (100 requests per 15 minutes per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again after 15 minutes.' }
});
app.use('/api', limiter);

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/admin', adminRoutes);

// Public Shared Document Retrieval (No Auth Required)
app.get('/api/shared/:token', getSharedDocument);

// Basic sanity/health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'LexAI API is running smoothly' });
});

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.status = 404;
  next(error);
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Server Unhandled Error:', err.stack || err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'An unexpected error occurred on the server',
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
});

// Port configuration
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Server configured successfully with Cloudinary storage and security headers.

