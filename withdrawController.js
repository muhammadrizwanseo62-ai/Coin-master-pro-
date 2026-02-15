const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const Transaction = require('../models/Transaction');
const { 
  sendWithdrawalConfirmation,
  sendWithdrawalProcessingNotification,
  sendWithdrawalCompletedNotification,
  sendWithdrawalReminder
} = require('../services/notificationService');
const { isTodayWithdrawalDay, getNextWithdrawalDate } = require('../utils/withdrawalDateCheck');
const { validateBNBTRXAddress } = require('../utils/tonWalletValidator');
const constants = require('../config/constants');

// ============ WITHDRAWAL SYSTEM - 15TH ONLY ============
// STRICT VALIDATION - CANNOT BE BYPASSED
// =====================================================

/**
 * @desc    Check withdrawal eligibility
 * @route   GET /api/withdraw/eligibility
 * @access  Private
 */
exports.checkEligibility = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Calculate account age in days
    const accountAgeDays = Math.floor((Date.now() - user.accountAge) / (1000 * 60 * 60 * 24));
    
    // Check all requirements
    const eligibility = {
      accountAge: accountAgeDays >= constants.WITHDRAWAL_REQUIREMENTS.MIN_ACCOUNT_AGE_DAYS,
      gamesPlayed: user.gamesPlayed >= constants.WITHDRAWAL_REQUIREMENTS.MIN_GAMES_PLAYED,
      referrals: (user.referrals ? user.referrals.length : 0) >= constants.WITHDRAWAL_REQUIREMENTS.MIN_REFERRALS,
      loginStreak: user.loginStreak >= constants.WITHDRAWAL_REQUIREMENTS.MIN_LOGIN_STREAK,
      noPendingWithdrawals: user.pendingWithdrawals.length === 0,
      minimumBalance: user.balance >= constants.MIN_WITHDRAWAL_COINS,
      isWithdrawalDay: isTodayWithdrawalDay()
    };
    
    const isEligible = Object.values(eligibility).every(Boolean);
    
    // Auto-update user eligibility
    if (user.isEligibleForWithdrawal !== isEligible) {
      user.isEligibleForWithdrawal = isEligible;
      await user.save();
    }
    
    // Get next withdrawal date
    const nextWithdrawalDate = getNextWithdrawalDate();
    
    res.json({
      success: true,
      data: {
        isEligible,
        requirements: {
          accountAge: {
            current: accountAgeDays,
            required: constants.WITHDRAWAL_REQUIREMENTS.MIN_ACCOUNT_AGE_DAYS,
            met: eligibility.accountAge
          },
          gamesPlayed: {
            current: user.gamesPlayed,
            required: constants.WITHDRAWAL_REQUIREMENTS.MIN_GAMES_PLAYED,
            met: eligibility.gamesPlayed
          },
          referrals: {
            current: user.referrals ? user.referrals.length : 0,
            required: constants.WITHDRAWAL_REQUIREMENTS.MIN_REFERRALS,
            met: eligibility.referrals
          },
          loginStreak: {
            current: user.loginStreak,
            required: constants.WITHDRAWAL_REQUIREMENTS.MIN_LOGIN_STREAK,
            met: eligibility.loginStreak
          },
          noPendingWithdrawals: {
            met: eligibility.noPendingWithdrawals
          },
          minimumBalance: {
            current: user.balance,
            required: constants.MIN_WITHDRAWAL_COINS,
            met: eligibility.minimumBalance
          },
          isWithdrawalDay: {
            met: eligibility.isWithdrawalDay
          }
        },
        nextWithdrawalDate,
        balance: user.balance,
        minWithdrawal: constants.MIN_WITHDRAWAL_COINS,
        maxWithdrawal: constants.MAX_WITHDRAWAL_COINS,
        fee: constants.WITHDRAWAL_FEE,
        cryptoType: constants.CRYPTO_TYPE
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check eligibility',
      error: error.message
    });
  }
};

/**
 * @desc    Get next withdrawal date
 * @route   GET /api/withdraw/next-date
 * @access  Private
 */
exports.getNextWithdrawalDate = async (req, res) => {
  try {
    const nextDate = getNextWithdrawalDate();
    
    res.json({
      success: true,
      data: {
        nextWithdrawalDate: nextDate,
        isToday: isTodayWithdrawalDay(),
        formattedDate: nextDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get next withdrawal date',
      error: error.message
    });
  }
};

/**
 * @desc    Request withdrawal (ONLY ON 15TH)
 * @route   POST /api/withdraw/request
 * @access  Private
 * STRICT: Only works on 15th of each month
 */
exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount, walletAddress } = req.body;
    const userId = req.user.id;
    
    // ============ STRICT DATE VALIDATION ============
    // CANNOT BE BYPASSED - SERVER SIDE ENFORCEMENT
    if (!isTodayWithdrawalDay()) {
      return res.status(400).json({
        success: false,
        message: '❌ Withdrawals are ONLY available on the 15th of each month',
        nextWithdrawalDate: getNextWithdrawalDate()
      });
    }
    
    // Get user with fresh data
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // ============ AMOUNT VALIDATION ============
    const withdrawalAmount = parseInt(amount);
    
    if (withdrawalAmount < constants.MIN_WITHDRAWAL_COINS) {
      return res.status(400).json({
        success: false,
        message: `❌ Minimum withdrawal amount is ${constants.MIN_WITHDRAWAL_COINS} coins ($${constants.MIN_WITHDRAWAL_USD} USD)`
      });
    }
    
    if (withdrawalAmount > constants.MAX_WITHDRAWAL_COINS) {
      return res.status(400).json({
        success: false,
        message: `❌ Maximum withdrawal amount is ${constants.MAX_WITHDRAWAL_COINS} coins ($${constants.MAX_WITHDRAWAL_COINS / constants.EXCHANGE_RATE.COINS_PER_USD} USD) per month`
      });
    }
    
    // Check monthly limit
    const currentMonth = `${new Date().getMonth() + 1}-${new Date().getFullYear()}`;
    if (user.lastWithdrawalMonth === currentMonth) {
      const remainingLimit = constants.MAX_WITHDRAWAL_COINS - user.monthlyWithdrawalAmount;
      if (withdrawalAmount > remainingLimit) {
        return res.status(400).json({
          success: false,
          message: `❌ Monthly withdrawal limit exceeded. Remaining: ${remainingLimit} coins`
        });
      }
    }
    
    // ============ ELIGIBILITY VALIDATION ============
    const accountAgeDays = Math.floor((Date.now() - user.accountAge) / (1000 * 60 * 60 * 24));
    const referralCount = user.referrals ? user.referrals.length : 0;
    
    if (accountAgeDays < constants.WITHDRAWAL_REQUIREMENTS.MIN_ACCOUNT_AGE_DAYS) {
      return res.status(400).json({
        success: false,
        message: `❌ Account age requirement: ${constants.WITHDRAWAL_REQUIREMENTS.MIN_ACCOUNT_AGE_DAYS} days (Current: ${accountAgeDays} days)`
      });
    }
    
    if (user.gamesPlayed < constants.WITHDRAWAL_REQUIREMENTS.MIN_GAMES_PLAYED) {
      return res.status(400).json({
        success: false,
        message: `❌ Games played requirement: ${constants.WITHDRAWAL_REQUIREMENTS.MIN_GAMES_PLAYED} games (Current: ${user.gamesPlayed} games)`
      });
    }
    
    if (referralCount < constants.WITHDRAWAL_REQUIREMENTS.MIN_REFERRALS) {
      return res.status(400).json({
        success: false,
        message: `❌ Active referrals requirement: ${constants.WITHDRAWAL_REQUIREMENTS.MIN_REFERRALS} referrals (Current: ${referralCount} referrals)`
      });
    }
    
    if (user.loginStreak < constants.WITHDRAWAL_REQUIREMENTS.MIN_LOGIN_STREAK) {
      return res.status(400).json({
        success: false,
        message: `❌ Login streak requirement: ${constants.WITHDRAWAL_REQUIREMENTS.MIN_LOGIN_STREAK} days (Current: ${user.loginStreak} days)`
      });
    }
    
    if (user.pendingWithdrawals.length > 0) {
      return res.status(400).json({
        success: false,
        message: '❌ You have pending withdrawals. Please wait for them to be processed.'
      });
    }
    
    if (user.balance < withdrawalAmount) {
      return res.status(400).json({
        success: false,
        message: `❌ Insufficient balance. You have ${user.balance} coins`
      });
    }
    
    // ============ WALLET VALIDATION ============
    const isValidWallet = validateBNBTRXAddress(walletAddress);
    if (!isValidWallet) {
      return res.status(400).json({
        success: false,
        message: '❌ Invalid USDT-BNB TRX wallet address. Must start with 0x (BNB) or T (TRX)'
      });
    }
    
    // ============ PROCESS WITHDRAWAL ============
    // Calculate amounts
    const feeAmount = (withdrawalAmount * constants.WITHDRAWAL_FEE) / 100;
    const netAmount = withdrawalAmount - feeAmount;
    const usdAmount = withdrawalAmount / constants.EXCHANGE_RATE.COINS_PER_USD;
    
    // Deduct coins from user balance
    user.balance -= withdrawalAmount;
    user.totalWithdrawn += netAmount;
    
    // Update monthly limit
    user.monthlyWithdrawalAmount = 
      (user.lastWithdrawalMonth === currentMonth ? user.monthlyWithdrawalAmount : 0) + withdrawalAmount;
    user.lastWithdrawalMonth = currentMonth;
    
    // Create withdrawal record
    const withdrawal = new Withdrawal({
      userId: user._id,
      amount: withdrawalAmount,
      usdAmount,
      fee: constants.WITHDRAWAL_FEE,
      feeAmount,
      netAmount,
      walletAddress,
      cryptoType: constants.CRYPTO_TYPE
    });
    
    await withdrawal.save();
    
    // Add to user's pending withdrawals
    user.pendingWithdrawals.push(withdrawal._id);
    await user.save();
    
    // Create transaction record
    await Transaction.createWithdrawalTransaction(
      user._id,
      withdrawalAmount,
      user.balance,
      withdrawal.withdrawalId
    );
    
    // Send confirmation notification
    await sendWithdrawalConfirmation(
      user.telegramId,
      usdAmount.toFixed(2),
      withdrawalAmount,
      withdrawal.withdrawalId
    );
    
    res.json({
      success: true,
      message: '✅ Withdrawal request submitted successfully',
      data: {
        withdrawalId: withdrawal.withdrawalId,
        amount: withdrawalAmount,
        usdAmount: usdAmount.toFixed(2),
        fee: constants.WITHDRAWAL_FEE,
        feeAmount,
        netAmount,
        walletAddress,
        status: withdrawal.status,
        processingDate: withdrawal.processingDate,
        balance: user.balance
      }
    });
    
  } catch (error) {
    console.error('Withdrawal request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process withdrawal request',
      error: error.message
    });
  }
};

/**
 * @desc    Get withdrawal history
 * @route   GET /api/withdraw/history
 * @access  Private
 */
exports.getWithdrawalHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const withdrawals = await Withdrawal.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Withdrawal.countDocuments({ userId: req.user.id });
    
    res.json({
      success: true,
      data: {
        withdrawals,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get withdrawal history',
      error: error.message
    });
  }
};

/**
 * @desc    Check withdrawal status
 * @route   GET /api/withdraw/status/:id
 * @access  Private
 */
exports.getWithdrawalStatus = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findOne({
      withdrawalId: req.params.id,
      userId: req.user.id
    });
    
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        withdrawalId: withdrawal.withdrawalId,
        status: withdrawal.status,
        amount: withdrawal.amount,
        usdAmount: withdrawal.usdAmount,
        netAmount: withdrawal.netAmount,
        requestDate: withdrawal.requestDate,
        processingDate: withdrawal.processingDate,
        completionDate: withdrawal.completionDate,
        transactionHash: withdrawal.transactionHash,
        explorerUrl: withdrawal.explorerUrl
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get withdrawal status',
      error: error.message
    });
  }
};

/**
 * @desc    Cancel pending withdrawal
 * @route   POST /api/withdraw/cancel/:id
 * @access  Private
 */
exports.cancelWithdrawal = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findOne({
      withdrawalId: req.params.id,
      userId: req.user.id,
      status: 'pending'
    });
    
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Pending withdrawal not found'
      });
    }
    
    const user = await User.findById(req.user.id);
    
    // Refund coins
    user.balance += withdrawal.amount;
    user.pendingWithdrawals = user.pendingWithdrawals.filter(
      id => id.toString() !== withdrawal._id.toString()
    );
    await user.save();
    
    // Cancel withdrawal
    await withdrawal.cancel();
    
    // Create refund transaction
    await Transaction.create({
      userId: user._id,
      type: 'refund',
      amount: withdrawal.amount,
      previousBalance: user.balance - withdrawal.amount,
      balance: user.balance,
      description: `💰 Withdrawal cancelled: ${withdrawal.withdrawalId}`,
      metadata: {
        withdrawalId: withdrawal.withdrawalId
      },
      referenceId: withdrawal.withdrawalId
    });
    
    res.json({
      success: true,
      message: '✅ Withdrawal cancelled and refunded',
      data: {
        withdrawalId: withdrawal.withdrawalId,
        refundedAmount: withdrawal.amount,
        newBalance: user.balance
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to cancel withdrawal',
      error: error.message
    });
  }
};

/**
 * @desc    Process withdrawals (CRON job - 15th of every month)
 * @access  Internal
 */
exports.processWithdrawals = async () => {
  try {
    console.log('🔄 Processing withdrawals for 15th...');
    
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    
    // Get all pending withdrawals for this month
    const withdrawals = await Withdrawal.find({
      status: 'pending',
      month: currentMonth,
      year: currentYear
    }).populate('userId');
    
    console.log(`📊 Found ${withdrawals.length} pending withdrawals`);
    
    for (const withdrawal of withdrawals) {
      try {
        // Mark as processing
        await withdrawal.markAsProcessing();
        
        // Send processing notification
        await sendWithdrawalProcessingNotification(
          withdrawal.userId.telegramId,
          withdrawal.usdAmount.toFixed(2),
          withdrawal.withdrawalId
        );
        
        // TODO: Integrate actual crypto payment API here
        // For now, generate mock transaction hash
        const mockTxHash = '0x' + Array.from({length: 64}, () => 
          Math.floor(Math.random() * 16).toString(16)).join('');
        
        // Mark as completed
        await withdrawal.markAsCompleted(mockTxHash);
        
        // Send completion notification
        await sendWithdrawalCompletedNotification(
          withdrawal.userId.telegramId,
          withdrawal.usdAmount.toFixed(2),
          mockTxHash
        );
        
        console.log(`✅ Processed withdrawal: ${withdrawal.withdrawalId}`);
        
      } catch (error) {
        console.error(`❌ Failed to process withdrawal ${withdrawal.withdrawalId}:`, error);
        
        // Mark as failed
        await withdrawal.markAsFailed(error.message);
        
        // Notify user of failure
        // await sendWithdrawalFailedNotification(...);
      }
    }
    
    console.log('✅ Withdrawal processing completed');
    
  } catch (error) {
    console.error('❌ Withdrawal processing failed:', error);
  }
};

/**
 * @desc    Send withdrawal reminders (CRON job - 14th)
 * @access  Internal
 */
exports.sendWithdrawalReminders = async () => {
  try {
    console.log('📅 Sending withdrawal reminders...');
    
    const eligibleUsers = await User.find({
      isEligibleForWithdrawal: true,
      balance: { $gte: constants.MIN_WITHDRAWAL_COINS },
      pendingWithdrawals: { $size: 0 }
    });
    
    console.log(`📊 Found ${eligibleUsers.length} eligible users`);
    
    for (const user of eligibleUsers) {
      await sendWithdrawalReminder(user.telegramId);
    }
    
    console.log('✅ Reminders sent');
    
  } catch (error) {
    console.error('❌ Failed to send reminders:', error);
  }
};