// backend/utils/commissionCalculator.js

class CommissionCalculator {
    
    // Commission structure
    static COMMISSION_STRUCTURE = {
        level1: { rate: 0.20, name: 'Level 1 (Direct)', maxLevel: 1 },
        level2: { rate: 0.10, name: 'Level 2', maxLevel: 2 },
        level3: { rate: 0.05, name: 'Level 3', maxLevel: 3 }
    };
    
    // Vesting periods (in days)
    static VESTING_PERIODS = {
        standard: 7,
        bonus: 0, // Instant
        promotion: 3
    };
    
    /**
     * Calculate multi-level commission for withdrawal
     * @param {number} withdrawalAmount - Withdrawal amount in USD
     * @param {Object} referrer - Referrer object with tier info
     * @returns {Object} Commission breakdown
     */
    static calculateMultiLevelCommission(withdrawalAmount, referrer = null) {
        // Net amount after 15% fee
        const netAmount = withdrawalAmount * 0.85;
        
        // Base commissions
        const commissions = {
            level1: {
                rate: 0.20,
                amount: netAmount * 0.20,
                coins: Math.floor(netAmount * 0.20 * 5000),
                status: 'pending'
            },
            level2: {
                rate: 0.10,
                amount: netAmount * 0.10,
                coins: Math.floor(netAmount * 0.10 * 5000),
                status: 'pending'
            },
            level3: {
                rate: 0.05,
                amount: netAmount * 0.05,
                coins: Math.floor(netAmount * 0.05 * 5000),
                status: 'pending'
            }
        };
        
        // Apply referrer tier bonus if applicable
        if (referrer && referrer.tier && referrer.tier.multiplier > 1) {
            Object.keys(commissions).forEach(level => {
                commissions[level].amount *= referrer.tier.multiplier;
                commissions[level].coins = Math.floor(commissions[level].coins * referrer.tier.multiplier);
                commissions[level].tierMultiplier = referrer.tier.multiplier;
                commissions[level].tier = referrer.tier.tier;
            });
        }
        
        // Round amounts
        commissions.level1.amount = parseFloat(commissions.level1.amount.toFixed(2));
        commissions.level2.amount = parseFloat(commissions.level2.amount.toFixed(2));
        commissions.level3.amount = parseFloat(commissions.level3.amount.toFixed(2));
        
        return {
            withdrawalAmount,
            netAmount: parseFloat(netAmount.toFixed(2)),
            commissions,
            total: {
                usd: parseFloat((commissions.level1.amount + commissions.level2.amount + commissions.level3.amount).toFixed(2)),
                coins: commissions.level1.coins + commissions.level2.coins + commissions.level3.coins
            },
            fee: parseFloat((withdrawalAmount * 0.15).toFixed(2))
        };
    }
    
    /**
     * Calculate instant signup bonus
     * @param {boolean} isReferrer - Whether user is referrer
     * @returns {Object} Bonus details
     */
    static calculateSignupBonus(isReferrer = false) {
        return {
            amount: 500,
            coins: 500,
            usdValue: 0.10,
            type: isReferrer ? 'referrer_bonus' : 'referee_bonus',
            vestingDays: 0, // Instant
            availableDate: new Date()
        };
    }
    
    /**
     * Calculate withdrawal fee
     * @param {number} amount - Withdrawal amount in USD
     * @returns {Object} Fee details
     */
    static calculateWithdrawalFee(amount) {
        const feePercentage = 15;
        const feeAmount = amount * (feePercentage / 100);
        const netAmount = amount - feeAmount;
        
        return {
            percentage: feePercentage,
            amount: parseFloat(feeAmount.toFixed(2)),
            netAmount: parseFloat(netAmount.toFixed(2)),
            coinsFee: Math.floor(amount * 5000 * (feePercentage / 100)),
            coinsNet: Math.floor(amount * 5000 * (1 - feePercentage / 100))
        };
    }
    
    /**
     * Calculate available commission from pending
     * @param {Array} earnings - Array of earning objects
     * @returns {Object} Available commission details
     */
    static calculateAvailableCommission(earnings) {
        const now = new Date();
        
        const available = earnings.filter(e => {
            if (e.status !== 'pending') return false;
            if (!e.availableDate) return false;
            return new Date(e.availableDate) <= now;
        });
        
        const totalUSD = available.reduce((sum, e) => sum + (e.usdAmount || 0), 0);
        const totalCoins = available.reduce((sum, e) => sum + (e.amount || 0), 0);
        
        return {
            totalUSD: parseFloat(totalUSD.toFixed(2)),
            totalCoins,
            count: available.length,
            items: available
        };
    }
    
    /**
     * Calculate projected earnings for downline
     * @param {Object} downlineStats - Downline statistics
     * @returns {Object} Projected earnings
     */
    static calculateProjectedEarnings(downlineStats) {
        const { level1Count, level2Count, level3Count, averageWithdrawal = 50, activityRate = 0.3 } = downlineStats;
        
        const monthlyProjection = {
            level1: level1Count * averageWithdrawal * activityRate * 0.20,
            level2: level2Count * averageWithdrawal * activityRate * 0.10,
            level3: level3Count * averageWithdrawal * activityRate * 0.05
        };
        
        monthlyProjection.total = monthlyProjection.level1 + monthlyProjection.level2 + monthlyProjection.level3;
        
        return {
            monthly: {
                ...monthlyProjection,
                usd: parseFloat(monthlyProjection.total.toFixed(2)),
                coins: Math.floor(monthlyProjection.total * 5000)
            },
            yearly: {
                level1: parseFloat((monthlyProjection.level1 * 12).toFixed(2)),
                level2: parseFloat((monthlyProjection.level2 * 12).toFixed(2)),
                level3: parseFloat((monthlyProjection.level3 * 12).toFixed(2)),
                total: parseFloat((monthlyProjection.total * 12).toFixed(2)),
                coins: Math.floor(monthlyProjection.total * 12 * 5000)
            },
            assumptions: {
                averageWithdrawal,
                activityRate,
                exchangeRate: 5000
            }
        };
    }
    
    /**
     * Calculate leaderboard scores
     * @param {Object} user - User object
     * @returns {number} Leaderboard score
     */
    static calculateLeaderboardScore(user) {
        let score = 0;
        
        // Base score from total referrals
        score += user.totalReferrals * 10;
        
        // Add commission earned
        score += (user.referralEarnings / 5000) * 5; // $1 = 5 points
        
        // Add active downline bonus
        score += (user.level1Referrals?.length || 0) * 2;
        score += (user.level2Referrals?.length || 0) * 1;
        score += (user.level3Referrals?.length || 0) * 0.5;
        
        // Activity bonus
        score += user.gamesPlayed * 0.1;
        score += user.loginStreak * 0.5;
        
        return Math.floor(score);
    }
    
    /**
     * Calculate commission tiers
     * @param {number} totalCommission - Total commission earned
     * @returns {Object} Tier information
     */
    static getCommissionTier(totalCommission) {
        const tiers = [
            { threshold: 100000, name: 'Diamond', multiplier: 1.5, badge: '💎' },
            { threshold: 50000, name: 'Platinum', multiplier: 1.4, badge: '⭐' },
            { threshold: 25000, name: 'Gold', multiplier: 1.3, badge: '🏆' },
            { threshold: 10000, name: 'Silver', multiplier: 1.2, badge: '🥈' },
            { threshold: 5000, name: 'Bronze', multiplier: 1.1, badge: '🥉' },
            { threshold: 0, name: 'Basic', multiplier: 1.0, badge: '🎯' }
        ];
        
        return tiers.find(tier => totalCommission >= tier.threshold);
    }
    
    /**
     * Calculate commission split for team
     * @param {number} totalCommission - Total commission to distribute
     * @param {Array} teamMembers - Array of team members with levels
     * @returns {Object} Commission distribution
     */
    static calculateTeamCommissionSplit(totalCommission, teamMembers) {
        const distribution = [];
        let remainingCommission = totalCommission;
        
        // Priority to higher levels
        const sortedMembers = teamMembers.sort((a, b) => a.level - b.level);
        
        for (const member of sortedMembers) {
            let memberShare = 0;
            
            switch(member.level) {
                case 1:
                    memberShare = totalCommission * 0.50; // 50% to level 1
                    break;
                case 2:
                    memberShare = totalCommission * 0.30; // 30% to level 2
                    break;
                case 3:
                    memberShare = totalCommission * 0.20; // 20% to level 3
                    break;
            }
            
            // Adjust based on performance
            if (member.performance && member.performance > 0.8) {
                memberShare *= 1.1; // 10% bonus for high performance
            }
            
            distribution.push({
                userId: member.userId,
                level: member.level,
                baseAmount: parseFloat(memberShare.toFixed(2)),
                bonus: member.performance > 0.8 ? 0.1 : 0,
                total: parseFloat((memberShare * (member.performance > 0.8 ? 1.1 : 1)).toFixed(2))
            });
            
            remainingCommission -= memberShare;
        }
        
        return {
            distribution,
            totalDistributed: totalCommission - remainingCommission,
            remaining: parseFloat(remainingCommission.toFixed(2))
        };
    }
}

module.exports = CommissionCalculator;