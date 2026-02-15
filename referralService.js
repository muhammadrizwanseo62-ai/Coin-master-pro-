// backend/services/referralService.js
const User = require('../models/User');
const Referral = require('../models/Referral');
const Withdrawal = require('../models/Withdrawal');
const referralCalculator = require('../utils/referralCalculator');
const { sendNotification } = require('./notificationService');
const mongoose = require('mongoose');

class ReferralService {
    
    /**
     * Process multi-level referrals when a new user signs up
     */
    async processMultiLevelReferral(referrerId, refereeId) {
        const session = await mongoose.startSession();
        session.startTransaction();
        
        try {
            // Level 1 (Direct)
            await this.createReferral(referrerId, refereeId, 1, session);
            
            // Level 2
            const level1Referrer = await User.findById(referrerId).session(session);
            if (level1Referrer && level1Referrer.referredBy) {
                await this.createReferral(level1Referrer.referredBy, refereeId, 2, session);
                
                // Level 3
                const level2Referrer = await User.findById(level1Referrer.referredBy).session(session);
                if (level2Referrer && level2Referrer.referredBy) {
                    await this.createReferral(level2Referrer.referredBy, refereeId, 3, session);
                }
            }
            
            await session.commitTransaction();
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }
    
    /**
     * Create a single referral relationship
     */
    async createReferral(referrerId, refereeId, level, session = null) {
        const options = session ? { session } : {};
        
        const existingReferral = await Referral.findOne({
            referrerId,
            refereeId
        }).session(session || null);
        
        if (existingReferral) {
            return existingReferral;
        }
        
        const referral = await Referral.create([{
            referrerId,
            refereeId,
            level,
            bonusEarned: 500,
            bonusCredited: true
        }], options);
        
        // Update referrer's referral lists
        const referrer = await User.findById(referrerId).session(session || null);
        
        if (level === 1) {
            referrer.totalReferrals += 1;
            referrer.level1Referrals.push(refereeId);
        } else if (level === 2) {
            referrer.level2Referrals.push(refereeId);
        } else if (level === 3) {
            referrer.level3Referrals.push(refereeId);
        }
        
        // Add instant bonus for level 1 referrals
        if (level === 1) {
            referrer.balance += 500;
            referrer.referralEarnings += 500;
        }
        
        await referrer.save(options);
        
        return referral[0];
    }
    
    /**
     * Process commission when a withdrawal is made
     */
    async processWithdrawalCommission(withdrawalId) {
        const withdrawal = await Withdrawal.findById(withdrawalId)
            .populate('userId');
            
        if (!withdrawal) {
            throw new Error('Withdrawal not found');
        }
        
        const referee = withdrawal.userId;
        
        if (!referee.referredBy) {
            return; // No referrer
        }
        
        const withdrawalAmountUSD = withdrawal.usdAmount;
        
        // Process Level 1 commission (20%)
        const level1Commission = referralCalculator.calculateCommission(withdrawalAmountUSD, 1);
        await this.grantCommission(
            referee.referredBy,
            referee._id,
            withdrawal._id,
            level1Commission.commissionUSD,
            level1Commission.commissionCoins,
            1,
            20
        );
        
        // Process Level 2 commission (10%)
        const level1Referrer = await User.findById(referee.referredBy).populate('referredBy');
        if (level1Referrer && level1Referrer.referredBy) {
            const level2Commission = referralCalculator.calculateCommission(withdrawalAmountUSD, 2);
            await this.grantCommission(
                level1Referrer.referredBy,
                referee._id,
                withdrawal._id,
                level2Commission.commissionUSD,
                level2Commission.commissionCoins,
                2,
                10
            );
            
            // Process Level 3 commission (5%)
            const level2Referrer = await User.findById(level1Referrer.referredBy).populate('referredBy');
            if (level2Referrer && level2Referrer.referredBy) {
                const level3Commission = referralCalculator.calculateCommission(withdrawalAmountUSD, 3);
                await this.grantCommission(
                    level2Referrer.referredBy,
                    referee._id,
                    withdrawal._id,
                    level3Commission.commissionUSD,
                    level3Commission.commissionCoins,
                    3,
                    5
                );
            }
        }
    }
    
    /**
     * Grant commission to a referrer
     */
    async grantCommission(referrerId, refereeId, withdrawalId, usdAmount, coinsAmount, level, rate) {
        const session = await mongoose.startSession();
        session.startTransaction();
        
        try {
            // Find or create referral relationship
            let referral = await Referral.findOne({
                referrerId,
                refereeId
            }).session(session);
            
            if (!referral) {
                referral = await Referral.create([{
                    referrerId,
                    refereeId,
                    level
                }], { session });
                referral = referral[0];
            }
            
            // Add earning
            await referral.addEarning(withdrawalId, coinsAmount, usdAmount, level, rate);
            
            // Update referrer's pending commission
            const referrer = await User.findById(referrerId).session(session);
            referrer.pendingCommission += coinsAmount;
            referrer.referralEarnings += coinsAmount;
            await referrer.save({ session });
            
            await session.commitTransaction();
            
            // Send notification
            await sendNotification(referrer.telegramId, {
                type: 'commission_earned',
                title: '🎉 Commission Earned!',
                message: `You earned $${usdAmount.toFixed(2)} (${coinsAmount.toLocaleString()} coins) from Level ${level} referral!`,
                data: {
                    amount: usdAmount,
                    coins: coinsAmount,
                    level,
                    rate,
                    withdrawalId
                }
            });
            
            return referral;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }
    
    /**
     * Get referral statistics for a user
     */
    async getReferralStats(userId) {
        const stats = await Referral.aggregate([
            { $match: { referrerId: userId } },
            { $group: {
                _id: '$level',
                count: { $sum: 1 },
                totalCommission: { $sum: '$commission' },
                activeReferrals: {
                    $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                }
            }},
            { $sort: { '_id': 1 } }
        ]);
        
        const earnings = await Referral.aggregate([
            { $match: { referrerId: userId } },
            { $unwind: '$earnings' },
            { $group: {
                _id: '$earnings.status',
                total: { $sum: '$earnings.usdAmount' },
                coins: { $sum: '$earnings.amount' },
                count: { $sum: 1 }
            }}
        ]);
        
        const level1Count = stats.find(s => s._id === 1)?.count || 0;
        const level2Count = stats.find(s => s._id === 2)?.count || 0;
        const level3Count = stats.find(s => s._id === 3)?.count || 0;
        
        const pendingEarnings = earnings.find(e => e._id === 'pending') || { total: 0, coins: 0 };
        const availableEarnings = earnings.find(e => e._id === 'available') || { total: 0, coins: 0 };
        const withdrawnEarnings = earnings.find(e => e._id === 'withdrawn') || { total: 0, coins: 0 };
        
        return {
            totalReferrals: level1Count + level2Count + level3Count,
            byLevel: {
                level1: level1Count,
                level2: level2Count,
                level3: level3Count
            },
            activeReferrals: stats.reduce((sum, s) => sum + (s.activeReferrals || 0), 0),
            commission: {
                pending: pendingEarnings,
                available: availableEarnings,
                withdrawn: withdrawnEarnings,
                total: {
                    usd: pendingEarnings.total + availableEarnings.total + withdrawnEarnings.total,
                    coins: pendingEarnings.coins + availableEarnings.coins + withdrawnEarnings.coins
                }
            }
        };
    }
    
    /**
     * Make pending commission available after vesting period
     */
    async processVestedCommissions() {
        const now = new Date();
        
        const referrals = await Referral.find({
            'earnings': {
                $elemMatch: {
                    status: 'pending',
                    availableDate: { $lte: now }
                }
            }
        });
        
        for (const referral of referrals) {
            let updated = false;
            
            referral.earnings.forEach(earning => {
                if (earning.status === 'pending' && earning.availableDate <= now) {
                    earning.status = 'available';
                    updated = true;
                }
            });
            
            if (updated) {
                await referral.save();
                
                // Notify user
                const referrer = await User.findById(referral.referrerId);
                const availableAmount = referral.earnings
                    .filter(e => e.status === 'available' && e.availableDate <= now)
                    .reduce((sum, e) => sum + e.usdAmount, 0);
                
                await sendNotification(referrer.telegramId, {
                    type: 'commission_available',
                    title: '💰 Commission Available!',
                    message: `$${availableAmount.toFixed(2)} in commissions is now available for withdrawal!`,
                    data: { amount: availableAmount }
                });
            }
        }
    }
    
    /**
     * Get referral leaderboard
     */
    async getLeaderboard(limit = 100) {
        const leaderboard = await User.aggregate([
            { $match: { totalReferrals: { $gt: 0 } } },
            { $project: {
                username: 1,
                firstName: 1,
                totalReferrals: 1,
                referralEarnings: 1,
                level1Count: { $size: '$level1Referrals' },
                level2Count: { $size: '$level2Referrals' },
                level3Count: { $size: '$level3Referrals' },
                score: {
                    $add: [
                        { $multiply: ['$totalReferrals', 10] },
                        { $divide: ['$referralEarnings', 1000] },
                        { $multiply: [{ $size: '$level1Referrals' }, 2] },
                        { $multiply: [{ $size: '$level2Referrals' }, 1] },
                        { $multiply: [{ $size: '$level3Referrals' }, 0.5] }
                    ]
                }
            }},
            { $sort: { score: -1 } },
            { $limit: limit }
        ]);
        
        return leaderboard;
    }
}

module.exports = new ReferralService();