import express from 'express';
import { protect } from '../middleware/auth.js';
import { adminAuth } from '../middleware/adminAuth.js';
import {
  getOverviewStats,
  getDocumentTypeStats,
  getRiskDistribution,
  getTopRiskyClauseTypes,
  getDailyAnalysisChart,
  getRecentActivity,
} from '../controllers/adminController.js';

const router = express.Router();

// Apply admin authentication to all routes under this router
router.use(protect);
router.use(adminAuth);

// Define Admin Analytics Endpoints
router.get('/stats', getOverviewStats);
router.get('/document-types', getDocumentTypeStats);
router.get('/risk-distribution', getRiskDistribution);
router.get('/risky-clauses', getTopRiskyClauseTypes);
router.get('/daily-chart', getDailyAnalysisChart);
router.get('/recent-activity', getRecentActivity);

export default router;
