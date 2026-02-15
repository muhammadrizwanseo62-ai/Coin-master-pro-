const User = require('../models/User');
const Transaction = require('../models/Transaction');
const ReferralLog = require('../models/ReferralLog');
const AdminLog = require('../models/AdminLog');
const constants = require('../config/constants');

// ============ AUTOMATIC REFERRAL BONUS SYSTEM ============
// 1500 COINS INSTANT - ZERO MANUAL WORK
// =======================================================

/**
 * @desc    Award referral bonus automatically
 * @access  Internal - Called automatically on signup
 * AUTOMATIC: 1500 coins added instantly, no approval needed
 */
exports.awardReferralBonus = async (referrerId, refereeId, refereeUsername) => {
  try {
    const referrer = await User.findById(referrerId);
    const referee = await User.findById(refereeId);
    
    if (!referrer || !referee) {
      throw new Error('Referrer or referee not found');
    }
    
    // ============ AUTO-ADD 1500 COINS ============
    const previousBalance = referrer.coins;
    referrer.coins += parseInt(process.env.REFERRAL_BONUS_REFERRER || 1500);
    referrer.referralStats.earnings += parseInt(process.env.REFERRAL_BONUS_REFERRER || 1500);
    referrer.totalEarned += parseInt(process.env.REFERRAL_BONUS_REFERRER || 1500);
    referrer.referralEarnings += parseInt(process.env.REFERRAL_BONUS_REFERRER || 1500);
    referrer.totalReferralBonus += parseInt(process.env.REFERRAL_BONUS_REFERRER || 1500);
    
    // Add to referrals array if not already present
    if (!referrer.referrals.some(r => r.user && r.user.toString() === refereeId.toString())) {
      referrer.referrals.push({
        user: refereeId,
        date: new Date(),
        bonusGiven: parseInt(process.env.REFERRAL_BONUS_REFERRER || 1500),
        bonusClaimed: true,
        note: `🎁 Auto bonus for inviting ${refereeUsername || 'new user'}`
      });
    }
    
    // Update referral stats
    referrer.referralStats.total = referrer.referrals.length;
    referrer.referralStats.active += 1;
    
    await referrer.save();
    
    // ============ AUTO-CREATE TRANSACTION ============
    const transaction = await Transaction.create({
      userId: referrerId,
      type: 'referral_bonus',
      amount: parseInt(process.env.REFERRAL_BONUS_REFERRER || 1500),
      previousBalance,
      balance: referrer.coins,
      description: `🎁 Referral bonus: 1500 coins for inviting @${refereeUsername || 'new user'}`,
      metadata: {
        refereeId: refereeId.toString(),
        refereeUsername,
        bonusAmount: parseInt(process.env.REFERRAL_BONUS_REFERRER || 1500)
      },
      referralId: refereeId.toString()
    });
    
    // Create referral log
    await ReferralLog.create({
      referrer: referrerId,
      referee: refereeId,
      bonus: parseInt(process.env.REFERRAL_BONUS_REFERRER || 1500),
      status: 'completed'
    });
    
    // ============ AUTO-SEND NOTIFICATION ============
    await sendReferralBonusNotification(
      referrer.telegramId,
      refereeUsername || 'new user',
      parseInt(process.env.REFERRAL_BONUS_REFERRER || 1500)
    );
    
    console.log(`✅ Auto bonus: 1500 coins added to ${referrer.username} for referring ${refereeUsername}`);
    
    return {
      success: true,
      referrer: referrer._id,
      bonus: parseInt(process.env.REFERRAL_BONUS_REFERRER || 1500),
      transaction: transaction._id
    };
    
  } catch (error) {
    console.error('❌ Referral bonus award failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Track referral click
exports.trackReferral = async (req, res) => {
    try {
        const { code } = req.params;
        
        // Find referrer by referral code
        const referrer = await User.findOne({ referralCode: code });
        
        if (!referrer) {
            return res.status(404).json({
                success: false,
                message: 'Invalid referral code'
            });
        }
        
        // Set cookie for tracking
        res.cookie('ref_code', code, {
            maxAge: parseInt(process.env.REFERRAL_COOKIE_DURATION || 30) * 24 * 60 * 60 * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production'
        });
        
        // Store in session or database for tracking
        // In production, use Redis or similar
        
        res.json({
            success: true,
            message: 'Referral tracked',
            data: {
                code,
                referrer: referrer.username
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to track referral',
            error: error.message
        });
    }
};

// Get user's referrals
exports.getMyReferrals = async (req, res) => {
    try {
        const user = await User.findById(req.account ? req.account._id : req.user.id)
            .populate('referrals.user', 'username createdAt stats.gamesPlayed');
        
        res.json({
            success: true,
            data: {
                total: user.referralStats.total,
                active: user.referralStats.active,
                earnings: user.referralStats.earnings,
                referrals: user.referrals
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get referrals',
            error: error.message
        });
    }
};

// Get referral stats
exports.getReferralStats = async (req, res) => {
  try {
    const user = await User.findById(req.account ? req.account._id : req.user.id);
    
    // Calculate conversion rate
    const conversionRate = user.referralStats.total > 0 
        ? (user.referralStats.active / user.referralStats.total * 100).toFixed(2)
        : 0;
    
    // Get this month's earnings
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const monthlyReferrals = user.referrals.filter(r => 
        r.date >= startOfMonth
    ).length;
    
    const monthlyEarnings = monthlyReferrals * (parseInt(process.env.REFERRAL_BONUS_REFERRER) || 1500);
    
    // Calculate average per referral
    const averagePerReferral = user.referralStats.total > 0 
        ? user.referralStats.earnings / user.referralStats.total 
        : 0;
    
    // Get recent referrals count (last 30 days)
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const recentReferrals = user.referrals.filter(r => 
        r.date >= oneMonthAgo
    ).length;
    
    res.json({
      success: true,
      data: {
        totalReferrals: user.referralStats.total,
        activeReferrals: user.referralStats.active,
        totalEarnings: user.referralStats.earnings,
        conversionRate: `${conversionRate}%`,
        monthlyReferrals,
        monthlyEarnings,
        referralCode: user.referralCode,
        referralLink: `${process.env.REFERRAL_LINK_BASE || 'https://t.me/YourBot?start='}${user.referralCode}`,
        averagePerReferral,
        recentReferrals,
        bonusAmount: parseInt(process.env.REFERRAL_BONUS_REFERRER || 1500)
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get referral stats',
      error: error.message
    });
  }
};

// Get referral earnings
exports.getReferralEarnings = async (req, res) => {
  try {
    const user = await User.findById(req.account ? req.account._id : req.user.id)
      .select('referralStats.coins referralEarnings totalReferralBonus referrals');
    
    // Group earnings by month
    const earningsByMonth = {};
    
    user.referrals.forEach(ref => {
        const month = ref.date.toISOString().substring(0, 7); // YYYY-MM
        if (!earningsByMonth[month]) {
            earningsByMonth[month] = 0;
        }
        earningsByMonth[month] += ref.bonusGiven;
    });
    
    const earningsHistory = Object.keys(earningsByMonth).map(month => ({
        month,
        earnings: earningsByMonth[month]
    })).sort((a, b) => b.month.localeCompare(a.month));
    
    // Get recent referral bonus transactions
    const transactions = await Transaction.find({
      userId: req.account ? req.account._id : req.user.id,
      type: 'referral_bonus'
    })
      .sort('-createdAt')
      .limit(20);
    
    res.json({
      success: true,
      data: {
        totalEarnings: user.referralStats.earnings || 0,
        referralEarnings: user.referralEarnings || 0,
        totalReferralBonus: user.totalReferralBonus || 0,
        availableForWithdrawal: user.coins,
        referralCount: user.referrals ? user.referrals.length : 0,
        bonusPerReferral: parseInt(process.env.REFERRAL_BONUS_REFERRER || 1500),
        history: earningsHistory,
        recentTransactions: transactions,
        recentReferrals: user.referrals.slice(0, 10)
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get referral earnings',
      error: error.message
    });
  }
};

// Get referral leaderboard
exports.getReferralLeaderboard = async (req, res) => {
    try {
        const { timeframe = 'all' } = req.query;
        
        let dateFilter = {};
        if (timeframe === 'month') {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            dateFilter = { 'referrals.date': { $gte: startOfMonth } };
        } else if (timeframe === 'week') {
            const startOfWeek = new Date();
            startOfWeek.setDate(startOfWeek.getDate() - 7);
            dateFilter = { 'referrals.date': { $gte: startOfWeek } };
        }
        
        const leaderboard = await User.aggregate([
            {
                $match: {
                    'referralStats.total': { $gt: 0 },
                    status: 'active'
                }
            },
            {
                $project: {
                    username: 1,
                    firstName: 1,
                    lastName: 1,
                    photoUrl: 1,
                    avatar: 1,
                    totalReferrals: '$referralStats.total',
                    activeReferrals: '$referralStats.active',
                    earnings: '$referralStats.earnings',
                    referralEarnings: 1,
                    recentReferrals: {
                        $size: {
                            $filter: {
                                input: '$referrals',
                                as: 'ref',
                                cond: { $gte: ['$$ref.date', dateFilter.$gte || new Date(0)] }
                            }
                        }
                    }
                }
            },
            {
                $sort: { earnings: -1, totalReferrals: -1 }
            },
            {
                $limit: 20
            }
        ]);
        
        // Format leaderboard with ranks
        const formattedLeaderboard = leaderboard.map((user, index) => ({
            rank: index + 1,
            username: user.username || user.firstName || 'Anonymous',
            photoUrl: user.photoUrl || user.avatar,
            earnings: user.earnings || user.referralEarnings || 0,
            referralCount: user.totalReferrals || 0,
            activeReferrals: user.activeReferrals || 0,
            recentReferrals: user.recentReferrals || 0
        }));
        
        res.json({
            success: true,
            data: formattedLeaderboard
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get leaderboard',
            error: error.message
        });
    }
};

// Get referral history
exports.getReferralHistory = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        const user = await User.findById(req.account ? req.account._id : req.user.id)
            .populate({
                path: 'referrals.user',
                select: 'username firstName lastName photoUrl createdAt stats.gamesPlayed stats.tasksCompleted'
            });
        
        const referrals = user.referrals
            .sort((a, b) => b.date - a.date)
            .slice((page - 1) * limit, page * limit);
        
        res.json({
            success: true,
            data: referrals,
            pagination: {
                total: user.referrals.length,
                page: parseInt(page),
                pages: Math.ceil(user.referrals.length / limit)
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get referral history',
            error: error.message
        });
    }
};

// Claim referral bonus (if needed - usually automatic)
exports.claimReferralBonus = async (req, res) => {
    try {
        const { referralId } = req.body;
        
        const user = await User.findById(req.account ? req.account._id : req.user.id);
        
        const referral = user.referrals.id(referralId);
        if (!referral) {
            return res.status(404).json({
                success: false,
                message: 'Referral not found'
            });
        }
        
        if (referral.bonusClaimed) {
            return res.status(400).json({
                success: false,
                message: 'Bonus already claimed'
            });
        }
        
        // Check if referred user is active
        const referredUser = await User.findById(referral.user);
        if (!referredUser || referredUser.stats.gamesPlayed < (process.env.REFERRAL_REQUIRED_INTERACTIONS || 1)) {
            return res.status(400).json({
                success: false,
                message: 'Referred user is not yet active'
            });
        }
        
        // Mark as claimed (bonus is already given automatically, but this is for tracking)
        referral.bonusClaimed = true;
        await user.save();
        
        res.json({
            success: true,
            message: 'Referral bonus claimed'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to claim bonus',
            error: error.message
        });
    }
};

// Check if referral code is available
exports.checkReferralCode = async (req, res) => {
    try {
        const { code } = req.params;
        
        const existingUser = await User.findOne({ referralCode: code });
        
        res.json({
            success: true,
            data: {
                available: !existingUser,
                code
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to check referral code',
            error: error.message
        });
    }
};

// Generate new referral code
exports.generateReferralCode = async (req, res) => {
    try {
        const user = await User.findById(req.account ? req.account._id : req.user.id);
        
        // Generate random 8-character code
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code;
        let isUnique = false;
        
        while (!isUnique) {
            code = '';
            for (let i = 0; i < 8; i++) {
                code += characters.charAt(Math.floor(Math.random() * characters.length));
            }
            
            const existing = await User.findOne({ referralCode: code });
            if (!existing) isUnique = true;
        }
        
        user.referralCode = code;
        await user.save();
        
        res.json({
            success: true,
            message: 'Referral code generated',
            data: { referralCode: code }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to generate code',
            error: error.message
        });
    }
};

// ============ NOTIFICATION HELPER ============
async function sendReferralBonusNotification(telegramId, refereeName, bonusAmount) {
    try {
        // This will be implemented with your Telegram bot
        console.log(`🤖 Notification: +${bonusAmount} coins for referring ${refereeName} sent to ${telegramId}`);
        
        // In production, use your Telegram bot:
        // const { Telegraf } = require('telegraf');
        // const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
        // await bot.telegram.sendMessage(telegramId, `🎉 You got ${bonusAmount} coins for inviting ${refereeName}!`);
    } catch (error) {
        console.error('Failed to send notification:', error);
    }
}

// ============ ADMIN FUNCTIONS ============

// ADMIN: Get all referrals
exports.getAllReferrals = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        
        const users = await User.find({
            'referralStats.total': { $gt: 0 }
        })
            .select('username email referralStats coins createdAt')
            .sort({ 'referralStats.total': -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
        
        const total = await User.countDocuments({
            'referralStats.total': { $gt: 0 }
        });
        
        res.json({
            success: true,
            data: users,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get referrals',
            error: error.message
        });
    }
};

// ADMIN: Get referral analytics
exports.getReferralAnalytics = async (req, res) => {
    try {
        const { timeframe = 'month' } = req.query;
        
        let startDate;
        const endDate = new Date();
        
        switch(timeframe) {
            case 'week':
                startDate = new Date(endDate);
                startDate.setDate(endDate.getDate() - 7);
                break;
            case 'month':
                startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
                break;
            case 'year':
                startDate = new Date(endDate.getFullYear(), 0, 1);
                break;
            default:
                startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        }
        
        const analytics = await User.aggregate([
            {
                $unwind: '$referrals'
            },
            {
                $match: {
                    'referrals.date': { $gte: startDate, $lte: endDate }
                }
            },
            {
                $facet: {
                    daily: [
                        {
                            $group: {
                                _id: { $dateToString: { format: '%Y-%m-%d', date: '$referrals.date' } },
                                count: { $sum: 1 },
                                bonus: { $sum: '$referrals.bonusGiven' }
                            }
                        },
                        { $sort: { '_id': 1 } }
                    ],
                    topReferrers: [
                        {
                            $group: {
                                _id: '$_id',
                                username: { $first: '$username' },
                                count: { $sum: 1 },
                                bonus: { $sum: '$referrals.bonusGiven' }
                            }
                        },
                        { $sort: { count: -1 } },
                        { $limit: 10 }
                    ],
                    totals: [
                        {
                            $group: {
                                _id: null,
                                totalReferrals: { $sum: 1 },
                                totalBonus: { $sum: '$referrals.bonusGiven' },
                                uniqueReferrers: { $addToSet: '$_id' }
                            }
                        },
                        {
                            $project: {
                                totalReferrals: 1,
                                totalBonus: 1,
                                uniqueReferrers: { $size: '$uniqueReferrers' }
                            }
                        }
                    ]
                }
            }
        ]);
        
        res.json({
            success: true,
            data: analytics[0]
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get analytics',
            error: error.message
        });
    }
};

// ADMIN: Adjust referral bonus
exports.adjustReferralBonus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { amount, reason } = req.body;
        
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Add bonus
        user.coins += amount;
        user.referralStats.earnings += amount;
        user.totalEarned += amount;
        
        // Add to referrals array for tracking
        user.referrals.push({
            user: userId,
            date: new Date(),
            bonusGiven: amount,
            bonusClaimed: true,
            note: `Admin adjustment: ${reason}`
        });
        
        await user.save();
        
        // Log admin action
        await AdminLog.create({
            admin: req.account._id,
            action: 'ADJUST_REFERRAL_BONUS',
            details: `Added ${amount} coins to ${user.username}: ${reason}`,
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: `Added ${amount} coins to ${user.username}`,
            data: {
                username: user.username,
                newBalance: user.coins
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to adjust bonus',
            error: error.message
        });
    }
};

// ADMIN: Export referral data
exports.exportReferralData = async (req, res) => {
    try {
        const users = await User.find({
            'referralStats.total': { $gt: 0 }
        })
            .select('username email referralStats referrals coins createdAt')
            .lean();
        
        const csvData = users.map(user => ({
            Username: user.username,
            Email: user.email || '',
            'Total Referrals': user.referralStats.total,
            'Active Referrals': user.referralStats.active,
            'Total Earnings': user.referralStats.earnings,
            'Current Balance': user.coins,
            'Join Date': new Date(user.createdAt).toLocaleDateString()
        }));
        
        res.json({
            success: true,
            data: csvData
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to export data',
            error: error.message
        });
    }
};

module.exports = exports;