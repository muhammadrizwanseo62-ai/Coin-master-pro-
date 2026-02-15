const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const constants = require('../config/constants');

/**
 * @route   GET /api/user/referral-earnings
 * @desc    Get detailed referral earnings
 * @access  Private
 */
router.get('/referral-earnings', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('referralEarnings totalReferralBonus referrals')
      .populate('referrals', 'username firstName lastName createdAt');
    
    const transactions = await Transaction.find({
      userId: req.user.id,
      type: 'referral_bonus'
    })
      .sort('-createdAt')
      .limit(50);
    
    res.json({
      success: true,
      data: {
        totalEarnings: user.referralEarnings,
        totalReferrals: user.referrals.length,
        bonusPerReferral: constants.REFERRAL_BONUS.REFERRER,
        recentReferrals: user.referrals.slice(0, 10),
        recentTransactions: transactions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get referral earnings',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/user/withdrawal-eligibility
 * @desc    Get detailed withdrawal eligibility
 * @access  Private
 */
router.get('/withdrawal-eligibility', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const accountAgeDays = Math.floor((Date.now() - user.accountAge) / (1000 * 60 * 60 * 24));
    const referralCount = user.referrals ? user.referrals.length : 0;
    
    const requirements = {
      accountAge: {
        current: accountAgeDays,
        required: constants.WITHDRAWAL_REQUIREMENTS.MIN_ACCOUNT_AGE_DAYS,
        met: accountAgeDays >= constants.WITHDRAWAL_REQUIREMENTS.MIN_ACCOUNT_AGE_DAYS
      },
      gamesPlayed: {
        current: user.gamesPlayed,
        required: constants.WITHDRAWAL_REQUIREMENTS.MIN_GAMES_PLAYED,
        met: user.gamesPlayed >= constants.WITHDRAWAL_REQUIREMENTS.MIN_GAMES_PLAYED
      },
      referrals: {
        current: referralCount,
        required: constants.WITHDRAWAL_REQUIREMENTS.MIN_REFERRALS,
        met: referralCount >= constants.WITHDRAWAL_REQUIREMENTS.MIN_REFERRALS
      },
      loginStreak: {
        current: user.loginStreak,
        required: constants.WITHDRAWAL_REQUIREMENTS.MIN_LOGIN_STREAK,
        met: user.loginStreak >= constants.WITHDRAWAL_REQUIREMENTS.MIN_LOGIN_STREAK
      },
      pendingWithdrawals: {
        count: user.pendingWithdrawals.length,
        met: user.pendingWithdrawals.length === 0
      },
      minimumBalance: {
        current: user.balance,
        required: constants.MIN_WITHDRAWAL_COINS,
        met: user.balance >= constants.MIN_WITHDRAWAL_COINS
      }
    };
    
    const isEligible = Object.values(requirements).every(req => req.met);
    
    res.json({
      success: true,
      data: {
        isEligible,
        requirements,
        nextWithdrawalDate: getNextWithdrawalDate()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check eligibility',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/user/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get('/stats', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    const stats = {
      balance: user.balance,
      totalEarned: user.totalEarned,
      totalWithdrawn: user.totalWithdrawn,
      gamesPlayed: user.gamesPlayed,
      gamesWon: user.gamesWon,
      winRate: user.gamesPlayed > 0 ? (user.gamesWon / user.gamesPlayed * 100).toFixed(1) : 0,
      totalGameEarnings: user.totalGameEarnings,
      referralEarnings: user.referralEarnings,
      referralCount: user.referrals ? user.referrals.length : 0,
      loginStreak: user.loginStreak,
      accountAgeDays: Math.floor((Date.now() - user.accountAge) / (1000 * 60 * 60 * 24)),
      isEligibleForWithdrawal: user.isEligibleForWithdrawal
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get user stats',
      error: error.message
    });
  }
});

function getNextWithdrawalDate() {
  const today = new Date();
  const nextDate = new Date(today);
  
  if (today.getDate() >= 15) {
    nextDate.setMonth(nextDate.getMonth() + 1);
  }
  
  nextDate.setDate(15);
  nextDate.setHours(0, 0, 0, 0);
  
  return nextDate;
}

module.exports = router;