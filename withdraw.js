const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validateWithdrawalDate } = require('../middleware/dateCheck');
const { checkWithdrawalEligibility } = require('../middleware/withdrawalEligibility');
const {
  checkEligibility,
  getNextWithdrawalDate,
  requestWithdrawal,
  getWithdrawalHistory,
  getWithdrawalStatus,
  cancelWithdrawal
} = require('../controllers/withdrawController');

// ============ WITHDRAWAL ROUTES ============
// All routes require authentication
// ==========================================

/**
 * @route   GET /api/withdraw/eligibility
 * @desc    Check withdrawal eligibility
 * @access  Private
 */
router.get('/eligibility', protect, checkEligibility);

/**
 * @route   GET /api/withdraw/next-date
 * @desc    Get next withdrawal date
 * @access  Private
 */
router.get('/next-date', protect, getNextWithdrawalDate);

/**
 * @route   POST /api/withdraw/request
 * @desc    Request withdrawal (ONLY 15th)
 * @access  Private
 * @middleware validateWithdrawalDate - Blocks non-15th requests
 * @middleware checkWithdrawalEligibility - Verifies all requirements
 */
router.post(
  '/request',
  protect,
  validateWithdrawalDate,        // STRICT: Only works on 15th
  checkWithdrawalEligibility,    // STRICT: Must meet all requirements
  requestWithdrawal
);

/**
 * @route   GET /api/withdraw/history
 * @desc    Get withdrawal history
 * @access  Private
 */
router.get('/history', protect, getWithdrawalHistory);

/**
 * @route   GET /api/withdraw/status/:id
 * @desc    Check withdrawal status
 * @access  Private
 */
router.get('/status/:id', protect, getWithdrawalStatus);

/**
 * @route   POST /api/withdraw/cancel/:id
 * @desc    Cancel pending withdrawal
 * @access  Private
 */
router.post('/cancel/:id', protect, cancelWithdrawal);

module.exports = router;