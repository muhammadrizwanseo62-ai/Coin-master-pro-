const User = require('../models/User');
const logger = require('../utils/logger');
const constants = require('../config/constants');

// Get user profile
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('-__v -referrals.userId');

        res.status(constants.HTTP_STATUS.OK).json({
            success: true,
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
                referralsCount: user.referrals.length,
                dailyStreak: user.dailyReward.streak,
                clicksToday: user.clicks.today,
                totalClicks: user.clicks.total,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        logger.error('Get profile error:', error);
        res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get profile'
        });
    }
};

// Update profile
exports.updateProfile = async (req, res) => {
    try {
        const { username, firstName, lastName } = req.body;
        
        const user = await User.findById(req.user.id);
        
        if (username) user.username = username;
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        
        await user.save();

        res.status(constants.HTTP_STATUS.OK).json({
            success: true,
            message: 'Profile updated successfully',
            user
        });
    } catch (error) {
        logger.error('Update profile error:', error);
        res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to update profile'
        });
    }
};

// Get balance
exports.getBalance = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        res.status(constants.HTTP_STATUS.OK).json({
            success: true,
            balance: user.balance,
            referralEarnings: user.referralEarnings
        });
    } catch (error) {
        logger.error('Get balance error:', error);
        res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get balance'
        });
    }
};

// Add coins
exports.addCoins = async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Invalid amount'
            });
        }

        const user = await User.findById(req.user.id);
        
        // Reset daily clicks if needed
        user.resetDailyClicks();
        
        // Check max clicks per day
        if (user.clicks.today + amount > constants.MAX_CLICKS_PER_DAY) {
            return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: constants.ERRORS.MAX_CLICKS_REACHED
            });
        }

        user.balance += amount;
        user.clicks.today += amount;
        user.clicks.total += amount;
        
        await user.save();

        res.status(constants.HTTP_STATUS.OK).json({
            success: true,
            newBalance: user.balance,
            clicksToday: user.clicks.today
        });
    } catch (error) {
        logger.error('Add coins error:', error);
        res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to add coins'
        });
    }
};

// Get referral info
exports.getReferralInfo = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        res.status(constants.HTTP_STATUS.OK).json({
            success: true,
            referralCode: user.referralCode,
            referralEarnings: user.referralEarnings,
            referralCount: user.referrals.length,
            referralLink: `https://t.me/${process.env.BOT_USERNAME}?start=${user.referralCode}`
        });
    } catch (error) {
        logger.error('Get referral info error:', error);
        res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get referral info'
        });
    }
};

// Get referrals
exports.getReferrals = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        const referrals = user.referrals.map(ref => ({
            username: ref.username || 'Anonymous',
            joinedAt: ref.joinedAt,
            bonusEarned: ref.bonusEarned
        }));

        res.status(constants.HTTP_STATUS.OK).json({
            success: true,
            referrals,
            total: referrals.length
        });
    } catch (error) {
        logger.error('Get referrals error:', error);
        res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get referrals'
        });
    }
};

// Claim daily reward
exports.claimDailyReward = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        // Check if can claim
        if (!user.canClaimDailyReward()) {
            return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: constants.ERRORS.DAILY_REWARD_CLAIMED
            });
        }

        // Update streak
        user.updateDailyRewardStreak();
        
        // Get reward amount based on streak
        const rewardAmount = constants.DAILY_REWARD_STREAK_BONUSES[user.dailyReward.streak] || constants.DAILY_REWARD;
        
        // Add reward to balance
        user.balance += rewardAmount;
        user.dailyReward.lastClaimed = new Date();
        
        await user.save();

        logger.info(`Daily reward claimed: ${user.telegramId} - Day ${user.dailyReward.streak} - ${rewardAmount} coins`);

        res.status(constants.HTTP_STATUS.OK).json({
            success: true,
            message: constants.SUCCESS.DAILY_REWARD_CLAIMED,
            reward: rewardAmount,
            streak: user.dailyReward.streak,
            newBalance: user.balance
        });
    } catch (error) {
        logger.error('Claim daily reward error:', error);
        res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to claim daily reward'
        });
    }
};

// Get daily reward status
exports.getDailyRewardStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        res.status(constants.HTTP_STATUS.OK).json({
            success: true,
            canClaim: user.canClaimDailyReward(),
            streak: user.dailyReward.streak,
            lastClaim: user.dailyReward.lastClaimed,
            nextReward: user.dailyReward.streak >= 7 ? 1000 : constants.DAILY_REWARD_STREAK_BONUSES[user.dailyReward.streak + 1] || constants.DAILY_REWARD
        });
    } catch (error) {
        logger.error('Get daily reward status error:', error);
        res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get daily reward status'
        });
    }
};

// Record click
exports.recordClick = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        // Reset daily clicks if needed
        user.resetDailyClicks();
        
        // Check max clicks
        if (user.clicks.today >= constants.MAX_CLICKS_PER_DAY) {
            return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: constants.ERRORS.MAX_CLICKS_REACHED
            });
        }

        // Add 1 coin per click
        user.balance += 1;
        user.clicks.today += 1;
        user.clicks.total += 1;
        
        await user.save();

        res.status(constants.HTTP_STATUS.OK).json({
            success: true,
            newBalance: user.balance,
            clicksToday: user.clicks.today,
            clicksLeft: constants.MAX_CLICKS_PER_DAY - user.clicks.today
        });
    } catch (error) {
        logger.error('Record click error:', error);
        res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to record click'
        });
    }
};

// Get statistics
exports.getStats = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        res.status(constants.HTTP_STATUS.OK).json({
            success: true,
            stats: {
                totalBalance: user.balance,
                totalClicks: user.clicks.total,
                clicksToday: user.clicks.today,
                totalReferrals: user.referrals.length,
                referralEarnings: user.referralEarnings,
                dailyStreak: user.dailyReward.streak,
                memberSince: user.createdAt,
                lastLogin: user.lastLogin
            }
        });
    } catch (error) {
        logger.error('Get stats error:', error);
        res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get statistics'
        });
    }
};

// Get leaderboard
exports.getLeaderboard = async (req, res) => {
    try {
        const topUsers = await User.find({ isActive: true })
            .sort({ balance: -1 })
            .limit(100)
            .select('username firstName balance referralEarnings referrals')
            .lean();

        const leaderboard = topUsers.map((user, index) => ({
            rank: index + 1,
            username: user.username || user.firstName || 'Anonymous',
            balance: user.balance,
            referralEarnings: user.referralEarnings,
            referrals: user.referrals.length
        }));

        res.status(constants.HTTP_STATUS.OK).json({
            success: true,
            leaderboard
        });
    } catch (error) {
        logger.error('Get leaderboard error:', error);
        res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get leaderboard'
        });
    }
};