const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getReferralEarnings,
  getReferralStats,
  getReferralLeaderboard
} = require('../controllers/referralController');

// ============ REFERRAL ROUTES ============
// All routes require authentication
// ========================================

/**
 * @route   GET /api/referral/earnings
 * @desc    Get user's referral earnings
 * @access  Private
 */
router.get('/earnings', protect, getReferralEarnings);

/**
 * @route   GET /api/referral/stats
 * @desc    Get referral statistics
 * @access  Private
 */
router.get('/stats', protect, getReferralStats);

/**
 * @route   GET /api/referral/leaderboard
 * @desc    Get top referrers
 * @access  Private
 */
router.get('/leaderboard', protect, getReferralLeaderboard);

module.exports = router;