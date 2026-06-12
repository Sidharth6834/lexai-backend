/**
 * To make yourself admin, run this in MongoDB Atlas console:
 * db.users.updateOne(
 *   {email: 'your@email.com'}, 
 *   {$set: {role: 'admin'}}
 * )
 */

import Document from '../models/Document.js';
import User from '../models/User.js';

// @desc    Get platform-wide overview statistics
// @route   GET /api/admin/stats
// @access  Private (Admin)
export const getOverviewStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalDocuments = await Document.countDocuments();
    const analyzedDocuments = await Document.countDocuments({ status: 'complete' });
    const failedDocuments = await Document.countDocuments({ status: 'failed' });
    const totalRiskyDocuments = await Document.countDocuments({ riskLevel: 'risky' });

    // Documents created today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const documentsToday = await Document.countDocuments({ createdAt: { $gte: startOfToday } });

    // Users registered in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newUsersThisWeek = await User.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

    // Average clauses per document
    const avgClausesAgg = await Document.aggregate([
      {
        $project: {
          clauseCount: {
            $cond: { if: { $isArray: '$clauses' }, then: { $size: '$clauses' }, else: 0 }
          }
        }
      },
      {
        $group: {
          _id: null,
          avgClauses: { $avg: '$clauseCount' }
        }
      }
    ]);
    const averageClausesPerDocument = avgClausesAgg[0] 
      ? Math.round(avgClausesAgg[0].avgClauses * 10) / 10 
      : 0;

    res.json({
      totalUsers,
      totalDocuments,
      analyzedDocuments,
      failedDocuments,
      totalRiskyDocuments,
      documentsToday,
      newUsersThisWeek,
      averageClausesPerDocument,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get statistics grouped by document type
// @route   GET /api/admin/document-types
// @access  Private (Admin)
export const getDocumentTypeStats = async (req, res) => {
  try {
    const stats = await Document.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          riskyCount: {
            $sum: {
              $cond: [{ $eq: ['$riskLevel', 'risky'] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          type: '$_id',
          count: 1,
          riskyCount: 1
        }
      }
    ]);

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get platform-wide risk distribution count
// @route   GET /api/admin/risk-distribution
// @access  Private (Admin)
export const getRiskDistribution = async (req, res) => {
  try {
    const safe = await Document.countDocuments({ riskLevel: 'safe' });
    const caution = await Document.countDocuments({ riskLevel: 'caution' });
    const risky = await Document.countDocuments({ riskLevel: 'risky' });

    res.json({ safe, caution, risky });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get top 10 most commonly risky clauses
// @route   GET /api/admin/risky-clauses
// @access  Private (Admin)
export const getTopRiskyClauseTypes = async (req, res) => {
  try {
    const topRisky = await Document.aggregate([
      { $unwind: '$clauses' },
      { $match: { 'clauses.riskLevel': 'risky' } },
      {
        $group: {
          _id: '$clauses.title',
          riskyCount: { $sum: 1 }
        }
      },
      { $sort: { riskyCount: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          title: '$_id',
          riskyCount: 1
        }
      }
    ]);

    res.json(topRisky);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get document analysis counts per day for the last 30 days
// @route   GET /api/admin/daily-chart
// @access  Private (Admin)
export const getDailyAnalysisChart = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const dailyStats = await Document.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          status: 'complete'
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          count: 1
        }
      }
    ]);

    // Fill in missing dates with zero counts for a continuous line chart
    const dailyDataMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyDataMap[dateStr] = 0;
    }

    dailyStats.forEach(stat => {
      if (dailyDataMap[stat.date] !== undefined) {
        dailyDataMap[stat.date] = stat.count;
      }
    });

    const result = Object.keys(dailyDataMap).map(date => ({
      date,
      count: dailyDataMap[date]
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get last 10 documents analyzed across all users
// @route   GET /api/admin/recent-activity
// @access  Private (Admin)
export const getRecentActivity = async (req, res) => {
  try {
    const docs = await Document.find({ status: 'complete' })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'name');

    const recentActivity = docs.map(doc => ({
      _id: doc._id,
      documentName: doc.name,
      documentType: doc.type,
      riskLevel: doc.riskLevel,
      userName: doc.userId ? doc.userId.name : 'Unknown User',
      createdAt: doc.createdAt
    }));

    res.json(recentActivity);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
