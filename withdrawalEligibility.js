const User = require('../models/User');
const constants = require('../config/constants');

/**
 * Middleware: Check withdrawal eligibility
 * Verifies ALL requirements are met:
 * - Account age >= 30 days
 * - Games played >= 100
 * - Active referrals >= 5
 * - Login streak >= 7 days
 * - No pending withdrawals
 */
async function checkWithdrawalEligibility(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Calculate account age in days
    const accountAgeDays = Math.floor((Date.now() - user.accountAge) / (1000 * 60 * 60 * 24));
    const referralCount = user.referrals ? user.referrals.length : 0;
    
    // Check each requirement
    const errors = [];
    
    if (accountAgeDays < constants.WITHDRAWAL_REQUIREMENTS.MIN_ACCOUNT_AGE_DAYS) {
      errors.push(`Account age: ${accountAgeDays}/${constants.WITHDRAWAL_REQUIREMENTS.MIN_ACCOUNT_AGE_DAYS} days`);
    }
    
    if (user.gamesPlayed < constants.WITHDRAWAL_REQUIREMENTS.MIN_GAMES_PLAYED) {
      errors.push(`Games played: ${user.gamesPlayed}/${constants.WITHDRAWAL_REQUIREMENTS.MIN_GAMES_PLAYED}`);
    }
    
    if (referralCount < constants.WITHDRAWAL_REQUIREMENTS.MIN_REFERRALS) {
      errors.push(`Active referrals: ${referralCount}/${constants.WITHDRAWAL_REQUIREMENTS.MIN_REFERRALS}`);
    }
    
    if (user.loginStreak < constants.WITHDRAWAL_REQUIREMENTS.MIN_LOGIN_STREAK) {
      errors.push(`Login streak: ${user.loginStreak}/${constants.WITHDRAWAL_REQUIREMENTS.MIN_LOGIN_STREAK} days`);
    }
    
    if (user.pendingWithdrawals.length > 0) {
      errors.push(`Pending withdrawals: ${user.pendingWithdrawals.length} pending`);
    }
    
    if (user.balance < constants.MIN_WITHDRAWAL_COINS) {
      errors.push(`Minimum balance: ${user.balance}/${constants.MIN_WITHDRAWAL_COINS} coins`);
    }
    
    // If any requirements not met, return error
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: '❌ Withdrawal requirements not met',
        errors,
        requirements: {
          accountAge: constants.WITHDRAWAL_REQUIREMENTS.MIN_ACCOUNT_AGE_DAYS,
          gamesPlayed: constants.WITHDRAWAL_REQUIREMENTS.MIN_GAMES_PLAYED,
          referrals: constants.WITHDRAWAL_REQUIREMENTS.MIN_REFERRALS,
          loginStreak: constants.WITHDRAWAL_REQUIREMENTS.MIN_LOGIN_STREAK,
          minBalance: constants.MIN_WITHDRAWAL_COINS
        },
        current: {
          accountAge: accountAgeDays,
          gamesPlayed: user.gamesPlayed,
          referrals: referralCount,
          loginStreak: user.loginStreak,
          pendingWithdrawals: user.pendingWithdrawals.length,
          balance: user.balance
        }
      });
    }
    
    // Auto-update user eligibility status
    if (!user.isEligibleForWithdrawal) {
      user.isEligibleForWithdrawal = true;
      await user.save();
    }
    
    next();
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Eligibility check failed',
      error: error.message
    });
  }
}

/**
 * Middleware: Check minimum balance requirement
 */
async function checkMinimumBalance(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    
    if (user.balance < constants.MIN_WITHDRAWAL_COINS) {
      return res.status(400).json({
        success: false,
        message: `❌ Minimum balance required: ${constants.MIN_WITHDRAWAL_COINS} coins ($${constants.MIN_WITHDRAWAL_USD} USD)`,
        currentBalance: user.balance,
        required: constants.MIN_WITHDRAWAL_COINS
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Balance check failed',
      error: error.message
    });
  }
}

/**
 * Middleware: Check no pending withdrawals
 */
async function checkNoPendingWithdrawals(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    
    if (user.pendingWithdrawals.length > 0) {
      return res.status(400).json({
        success: false,
        message: '❌ You have pending withdrawals. Please wait for them to be processed.',
        pendingCount: user.pendingWithdrawals.length
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Pending withdrawals check failed',
      error: error.message
    });
  }
}

module.exports = {
  checkWithdrawalEligibility,
  checkMinimumBalance,
  checkNoPendingWithdrawals
};