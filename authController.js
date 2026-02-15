const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { sendWelcomeMessage, sendReferralBonusNotification } = require('../services/notificationService');
const constants = require('../config/constants');
const jwt = require('jsonwebtoken');

// ============ AUTOMATIC REFERRAL BONUS SYSTEM ============
// ZERO MANUAL INTERVENTION - INSTANT AUTO CREDITS
// ======================================================

/**
 * @desc    Authenticate user via Telegram
 * @route   POST /api/auth/telegram
 * @access  Public
 * AUTOMATIC: 1500 coins to referrer, 500 coins to new user
 */
exports.telegramAuth = async (req, res) => {
  try {
    const { 
      id: telegramId, 
      username, 
      first_name, 
      last_name, 
      photo_url,
      referralCode 
    } = req.body;

    // Check if user exists
    let user = await User.findOne({ telegramId });
    
    if (!user) {
      // ============ NEW USER - AUTOMATIC SIGNUP ============
      // Generate unique referral code
      const newReferralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      // Create new user
      user = new User({
        telegramId,
        username,
        firstName: first_name,
        lastName: last_name,
        photoUrl: photo_url,
        referralCode: newReferralCode,
        referredBy: referralCode || null
      });
      
      await user.save();
      
      // ============ AUTOMATIC 500 COINS SIGNUP BONUS ============
      // NO ADMIN APPROVAL - INSTANT CREDIT
      if (constants.REFERRAL_BONUS.REFEREE > 0) {
        await user.addBalance(
          constants.REFERRAL_BONUS.REFEREE,
          'signup_bonus',
          'Welcome bonus'
        );
        
        // Record transaction automatically
        await Transaction.createSignupBonus(
          user._id,
          constants.REFERRAL_BONUS.REFEREE,
          user.balance
        );
      }
      
      // ============ AUTOMATIC 1500 COINS REFERRER BONUS ============
      // INSTANT AUTO-CREDIT - NO DELAY, NO APPROVAL
      if (referralCode) {
        const referrer = await User.findOne({ referralCode });
        
        if (referrer) {
          // AUTO-ADD 1500 COINS TO REFERRER
          await referrer.addBalance(
            constants.REFERRAL_BONUS.REFERRER,
            'referral_bonus',
            `Referral bonus for @${username || 'new user'}`
          );
          
          // AUTO-UPDATE REFERRAL EARNINGS
          referrer.referralEarnings += constants.REFERRAL_BONUS.REFERRER;
          referrer.totalReferralBonus += constants.REFERRAL_BONUS.REFERRER;
          
          // AUTO-ADD TO REFERRALS ARRAY
          if (!referrer.referrals.includes(user._id)) {
            referrer.referrals.push(user._id);
          }
          
          await referrer.save();
          
          // AUTO-CREATE TRANSACTION RECORD
          await Transaction.createReferralBonus(
            referrer._id,
            constants.REFERRAL_BONUS.REFERRER,
            referrer.balance,
            username || 'new user'
          );
          
          // AUTO-SEND TELEGRAM NOTIFICATION - INSTANT
          await sendReferralBonusNotification(
            referrer.telegramId,
            username || 'new user',
            constants.REFERRAL_BONUS.REFERRER
          );
        }
      }
      
      // AUTO-SEND WELCOME MESSAGE WITH BONUS INFO
      await sendWelcomeMessage(telegramId, username, constants.REFERRAL_BONUS.REFEREE);
    } else {
      // Update existing user info
      user.username = username || user.username;
      user.firstName = first_name || user.firstName;
      user.lastName = last_name || user.lastName;
      user.photoUrl = photo_url || user.photoUrl;
      
      // AUTO-UPDATE LOGIN STREAK
      await user.updateLoginStreak();
      
      await user.save();
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, telegramId: user.telegramId },
      constants.JWT_SECRET,
      { expiresIn: constants.JWT_EXPIRE }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
        balance: user.balance,
        referralCode: user.referralCode,
        referralEarnings: user.referralEarnings,
        totalReferralBonus: user.totalReferralBonus,
        gamesPlayed: user.gamesPlayed,
        loginStreak: user.loginStreak,
        accountAge: user.accountAge,
        isEligibleForWithdrawal: user.isEligibleForWithdrawal
      }
    });
    
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
};

/**
 * @desc    Get current user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-__v')
      .populate('referrals', 'username firstName lastName photoUrl createdAt');
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get user',
      error: error.message
    });
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, photoUrl } = req.body;
    
    const user = await User.findById(req.user.id);
    
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (photoUrl) user.photoUrl = photoUrl;
    
    await user.save();
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};