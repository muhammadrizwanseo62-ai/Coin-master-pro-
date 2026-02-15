/**
 * CPA Cron Jobs
 * Automated CPA network management: reports, settlements, fraud detection
 */

const cron = require('node-cron');
const CPAOffer = require('../models/CPAOffer');
const CPAConversion = require('../models/CPAConversion');
const User = require('../models/User');
const NetworkIntegration = require('../models/NetworkIntegration');
const offerWallService = require('../services/offerWallService');

class CPACronJobs {
    
    constructor() {
        this.initializeJobs();
    }

    /**
     * Initialize all CPA cron jobs
     */
    initializeJobs() {
        // Run every hour for conversion updates
        cron.schedule('0 * * * *', () => {
            this.processPendingConversions();
            this.updateOfferStats();
        });

        // Run every 6 hours for fraud detection
        cron.schedule('0 */6 * * *', () => {
            this.detectFraudulentConversions();
            this.cleanupExpiredOffers();
        });

        // Run daily at 8 AM for daily reports
        cron.schedule('0 8 * * *', () => {
            this.generateDailyReport();
            this.sendNetworkPerformanceReport();
        });

        // Run daily at 12 PM for payout calculations
        cron.schedule('0 12 * * *', () => {
            this.calculateDailyEarnings();
        });

        // Run weekly on Monday for weekly settlements
        cron.schedule('0 0 * * 1', () => {
            this.processWeeklySettlements();
            this.generateWeeklyNetworkReport();
        });

        // Run monthly on 1st for monthly reports
        cron.schedule('0 0 1 * *', () => {
            this.generateMonthlyReport();
            this.cleanupOldConversions();
        });

        // Run every 30 minutes for offer wall cache
        cron.schedule('*/30 * * * *', () => {
            this.refreshOfferWallCache();
            this.validateNetworkIntegrations();
        });

        console.log('✅ CPA cron jobs initialized');
    }

    /**
     * Process pending conversions
     */
    async processPendingConversions() {
        try {
            const pendingConversions = await CPAConversion.find({
                status: 'pending',
                conversionDate: { 
                    $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours old
                }
            }).populate('offerId');

            let approved = 0;
            let rejected = 0;

            for (const conversion of pendingConversions) {
                // Auto-approve after 24 hours if no fraud detected
                if (conversion.fraudScore < 30) {
                    conversion.status = 'approved';
                    conversion.approvalDate = new Date();
                    
                    // Award coins to user
                    const user = await User.findById(conversion.userId);
                    if (user) {
                        user.coins += conversion.reward;
                        user.totalEarned += conversion.reward;
                        await user.save();
                    }
                    
                    approved++;
                } else {
                    conversion.status = 'rejected';
                    conversion.rejectionReason = 'Auto-rejected: High fraud score';
                    rejected++;
                }
                
                await conversion.save();
            }

            if (approved > 0 || rejected > 0) {
                console.log(`[CPA-CRON] Processed ${pendingConversions.length} pending conversions:
  ✅ Approved: ${approved}
  ❌ Rejected: ${rejected}`);
            }

            return { processed: pendingConversions.length, approved, rejected };
        } catch (error) {
            console.error('[CPA-CRON] Process pending conversions error:', error);
        }
    }

    /**
     * Update offer statistics
     */
    async updateOfferStats() {
        try {
            const offers = await CPAOffer.find({ status: 'active' });
            
            for (const offer of offers) {
                // Get conversion stats
                const conversions = await CPAConversion.aggregate([
                    { $match: { offerId: offer._id } },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 },
                            totalRevenue: { $sum: '$payout' }
                        }
                    }
                ]);

                let totalConversions = 0;
                let totalRevenue = 0;

                conversions.forEach(stat => {
                    totalConversions += stat.count;
                    if (stat._id === 'approved') {
                        totalRevenue += stat.totalRevenue;
                    }
                });

                // Calculate conversion rate
                const conversionRate = offer.totalClicks > 0 
                    ? (totalConversions / offer.totalClicks) * 100 
                    : 0;

                // Update offer
                await CPAOffer.findByIdAndUpdate(offer._id, {
                    $set: {
                        totalConversions,
                        totalRevenue,
                        conversionRate: parseFloat(conversionRate.toFixed(2)),
                        updatedAt: new Date()
                    }
                });
            }

            console.log(`[CPA-CRON] Updated statistics for ${offers.length} CPA offers`);
        } catch (error) {
            console.error('[CPA-CRON] Update offer stats error:', error);
        }
    }

    /**
     * Detect fraudulent conversions
     */
    async detectFraudulentConversions() {
        try {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            
            const conversions = await CPAConversion.find({
                status: { $in: ['pending', 'approved'] },
                conversionDate: { $gte: twentyFourHoursAgo }
            }).populate('userId');

            let flagged = 0;

            for (const conversion of conversions) {
                let fraudScore = conversion.fraudScore || 0;
                const fraudReasons = [];

                // Check for multiple conversions from same IP
                if (conversion.ip) {
                    const sameIPCount = await CPAConversion.countDocuments({
                        ip: conversion.ip,
                        _id: { $ne: conversion._id },
                        conversionDate: { $gte: twentyFourHoursAgo }
                    });

                    if (sameIPCount >= 5) {
                        fraudScore += 30;
                        fraudReasons.push(`Multiple conversions from same IP (${sameIPCount})`);
                    }
                }

                // Check for rapid conversions
                const userConversions = await CPAConversion.find({
                    userId: conversion.userId,
                    _id: { $ne: conversion._id },
                    conversionDate: { 
                        $gte: new Date(conversion.conversionDate - 5 * 60 * 1000),
                        $lte: new Date(conversion.conversionDate + 5 * 60 * 1000)
                    }
                });

                if (userConversions.length >= 3) {
                    fraudScore += 40;
                    fraudReasons.push(`Rapid conversions (${userConversions.length} in 10 minutes)`);
                }

                // Check for unusual payout amounts
                if (conversion.payout > 10) {
                    fraudScore += 20;
                    fraudReasons.push(`High payout amount: $${conversion.payout}`);
                }

                // Update fraud score
                if (fraudScore > conversion.fraudScore) {
                    conversion.fraudScore = Math.min(fraudScore, 100);
                    conversion.fraudReasons = fraudReasons;
                    conversion.isSuspicious = fraudScore > 50;
                    
                    if (fraudScore > 70) {
                        conversion.status = 'rejected';
                        conversion.rejectionReason = 'Auto-rejected: Fraud detected';
                    }
                    
                    await conversion.save();
                    flagged++;
                }
            }

            if (flagged > 0) {
                console.log(`[CPA-CRON] Fraud detection complete:
  🚩 Flagged: ${flagged} suspicious conversions`);
            }

            return { flagged };
        } catch (error) {
            console.error('[CPA-CRON] Detect fraudulent conversions error:', error);
        }
    }

    /**
     * Clean up expired offers
     */
    async cleanupExpiredOffers() {
        try {
            const now = new Date();
            
            const result = await CPAOffer.updateMany(
                {
                    status: 'active',
                    endDate: { $lt: now, $ne: null }
                },
                {
                    $set: {
                        status: 'expired',
                        updatedAt: now
                    }
                }
            );

            if (result.modifiedCount > 0) {
                console.log(`[CPA-CRON] Expired ${result.modifiedCount} CPA offers`);
            }

            return result;
        } catch (error) {
            console.error('[CPA-CRON] Cleanup expired offers error:', error);
        }
    }

    /**
     * Generate daily report
     */
    async generateDailyReport() {
        try {
            const now = new Date();
            const yesterday = new Date(now - 24 * 60 * 60 * 1000);
            const yesterdayStart = new Date(yesterday.setHours(0, 0, 0, 0));
            const yesterdayEnd = new Date(yesterday.setHours(23, 59, 59, 999));

            // Get yesterday's conversions
            const conversions = await CPAConversion.find({
                conversionDate: { $gte: yesterdayStart, $lte: yesterdayEnd }
            }).populate('offerId');

            const stats = {
                total: conversions.length,
                pending: conversions.filter(c => c.status === 'pending').length,
                approved: conversions.filter(c => c.status === 'approved').length,
                rejected: conversions.filter(c => c.status === 'rejected').length,
                totalRevenue: conversions
                    .filter(c => c.status === 'approved')
                    .reduce((sum, c) => sum + c.payout, 0),
                totalReward: conversions
                    .filter(c => c.status === 'approved')
                    .reduce((sum, c) => sum + c.reward, 0)
            };

            stats.totalProfit = stats.totalRevenue - (stats.totalReward / 5000);

            // Network breakdown
            const networkStats = {};
            conversions.forEach(c => {
                if (!networkStats[c.network]) {
                    networkStats[c.network] = {
                        total: 0,
                        approved: 0,
                        revenue: 0
                    };
                }
                networkStats[c.network].total++;
                if (c.status === 'approved') {
                    networkStats[c.network].approved++;
                    networkStats[c.network].revenue += c.payout;
                }
            });

            console.log(`[CPA-CRON] Daily CPA Report - ${yesterdayStart.toDateString()}:`);
            console.log(`  📊 Total Conversions: ${stats.total}`);
            console.log(`  ⏳ Pending: ${stats.pending}`);
            console.log(`  ✅ Approved: ${stats.approved}`);
            console.log(`  ❌ Rejected: ${stats.rejected}`);
            console.log(`  💰 Total Revenue: $${stats.totalRevenue.toFixed(2)}`);
            console.log(`  💵 Total Reward: ${stats.totalReward} coins`);
            console.log(`  📈 Total Profit: $${stats.totalProfit.toFixed(2)}`);
            
            console.log(`  🌐 Network Breakdown:`);
            Object.entries(networkStats).forEach(([network, data]) => {
                console.log(`    ${network}: ${data.approved}/${data.total} - $${data.revenue.toFixed(2)}`);
            });

            // In production, send email to admin
            // await emailService.sendCPADailyReport(stats, networkStats);

            return { stats, networkStats };
        } catch (error) {
            console.error('[CPA-CRON] Generate daily report error:', error);
        }
    }

    /**
     * Calculate daily earnings
     */
    async calculateDailyEarnings() {
        try {
            const now = new Date();
            const today = new Date(now.setHours(0, 0, 0, 0));
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const earnings = await CPAConversion.aggregate([
                {
                    $match: {
                        status: 'approved',
                        approvalDate: { $gte: today, $lt: tomorrow }
                    }
                },
                {
                    $group: {
                        _id: '$network',
                        conversions: { $sum: 1 },
                        revenue: { $sum: '$payout' },
                        rewards: { $sum: '$reward' }
                    }
                }
            ]);

            let totalRevenue = 0;
            let totalRewards = 0;

            earnings.forEach(e => {
                totalRevenue += e.revenue;
                totalRewards += e.rewards;
            });

            const totalProfit = totalRevenue - (totalRewards / 5000);

            console.log(`[CPA-CRON] Daily Earnings Calculation - ${today.toDateString()}:`);
            console.log(`  💰 Total Revenue: $${totalRevenue.toFixed(2)}`);
            console.log(`  💵 Total Rewards: ${totalRewards} coins`);
            console.log(`  📈 Total Profit: $${totalProfit.toFixed(2)}`);

            // Store in database for historical tracking
            // In production, save to Earnings model

            return {
                date: today,
                earnings,
                totalRevenue,
                totalRewards,
                totalProfit
            };
        } catch (error) {
            console.error('[CPA-CRON] Calculate daily earnings error:', error);
        }
    }

    /**
     * Process weekly settlements
     */
    async processWeeklySettlements() {
        try {
            const now = new Date();
            const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

            // Get all approved conversions from last week
            const conversions = await CPAConversion.find({
                status: 'approved',
                paidAt: { $exists: false },
                approvalDate: { $gte: weekAgo }
            });

            // Group by network
            const settlements = {};
            
            conversions.forEach(conv => {
                if (!settlements[conv.network]) {
                    settlements[conv.network] = {
                        conversions: 0,
                        totalPayout: 0,
                        conversionIds: []
                    };
                }
                settlements[conv.network].conversions++;
                settlements[conv.network].totalPayout += conv.payout;
                settlements[conv.network].conversionIds.push(conv._id);
            });

            // Mark as paid
            for (const conversion of conversions) {
                conversion.status = 'paid';
                conversion.paidAt = new Date();
                await conversion.save();
            }

            console.log(`[CPA-CRON] Weekly Settlements Processed:`);
            Object.entries(settlements).forEach(([network, data]) => {
                console.log(`  ${network}: ${data.conversions} conversions - $${data.totalPayout.toFixed(2)}`);
            });

            // In production, generate payment files or API calls to networks
            // await paymentService.generateSettlementReports(settlements);

            return { settlements, total: conversions.length };
        } catch (error) {
            console.error('[CPA-CRON] Process weekly settlements error:', error);
        }
    }

    /**
     * Generate weekly network report
     */
    async generateWeeklyNetworkReport() {
        try {
            const now = new Date();
            const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

            const networkPerformance = await CPAConversion.aggregate([
                {
                    $match: {
                        conversionDate: { $gte: weekAgo }
                    }
                },
                {
                    $group: {
                        _id: {
                            network: '$network',
                            status: '$status'
                        },
                        count: { $sum: 1 },
                        revenue: { $sum: '$payout' },
                        rewards: { $sum: '$reward' }
                    }
                }
            ]);

            const report = {};

            networkPerformance.forEach(item => {
                const network = item._id.network;
                const status = item._id.status;
                
                if (!report[network]) {
                    report[network] = {
                        total: 0,
                        approved: 0,
                        pending: 0,
                        rejected: 0,
                        revenue: 0,
                        rewards: 0,
                        profit: 0
                    };
                }
                
                report[network].total += item.count;
                report[network][status] = item.count;
                
                if (status === 'approved') {
                    report[network].revenue += item.revenue;
                    report[network].rewards += item.rewards;
                    report[network].profit += item.revenue - (item.rewards / 5000);
                }
            });

            console.log(`[CPA-CRON] Weekly Network Performance Report:`);
            Object.entries(report).forEach(([network, data]) => {
                console.log(`  📊 ${network}:`);
                console.log(`     Conversions: ${data.total} (✅ ${data.approved || 0}, ⏳ ${data.pending || 0}, ❌ ${data.rejected || 0})`);
                console.log(`     Revenue: $${(data.revenue || 0).toFixed(2)}`);
                console.log(`     Profit: $${(data.profit || 0).toFixed(2)}`);
            });

            // Update network integration stats
            const networks = await NetworkIntegration.find();
            for (const network of networks) {
                if (report[network.name]) {
                    network.clickCount += report[network.name].total || 0;
                    network.viewCount += report[network.name].total || 0;
                    await network.save();
                }
            }

            return report;
        } catch (error) {
            console.error('[CPA-CRON] Generate weekly network report error:', error);
        }
    }

    /**
     * Send network performance report
     */
    async sendNetworkPerformanceReport() {
        try {
            const networks = await NetworkIntegration.find({ status: 'active' });
            
            console.log(`[CPA-CRON] Network Performance Summary:`);
            
            for (const network of networks) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const todayConversions = await CPAConversion.countDocuments({
                    network: network.name,
                    conversionDate: { $gte: today }
                });
                
                console.log(`  🌐 ${network.displayName}:`);
                console.log(`     Status: ${network.status}`);
                console.log(`     Display Order: ${network.displayOrder}`);
                console.log(`     Today's Conversions: ${todayConversions}`);
                console.log(`     Last Generated: ${network.lastGenerated?.toLocaleString() || 'Never'}`);
            }
        } catch (error) {
            console.error('[CPA-CRON] Send network performance report error:', error);
        }
    }

    /**
     * Generate monthly report
     */
    async generateMonthlyReport() {
        try {
            const now = new Date();
            const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
            monthAgo.setHours(0, 0, 0, 0);

            const monthlyStats = await CPAConversion.aggregate([
                {
                    $match: {
                        conversionDate: { $gte: monthAgo }
                    }
                },
                {
                    $group: {
                        _id: {
                            network: '$network',
                            status: '$status'
                        },
                        count: { $sum: 1 },
                        revenue: { $sum: '$payout' },
                        rewards: { $sum: '$reward' }
                    }
                }
            ]);

            let totalRevenue = 0;
            let totalProfit = 0;
            let totalConversions = 0;

            monthlyStats.forEach(stat => {
                if (stat._id.status === 'approved') {
                    totalRevenue += stat.revenue;
                    totalProfit += stat.revenue - (stat.rewards / 5000);
                    totalConversions += stat.count;
                }
            });

            console.log(`[CPA-CRON] Monthly Report - ${monthAgo.toDateString()} to ${new Date().toDateString()}:`);
            console.log(`  📊 Total Conversions: ${totalConversions}`);
            console.log(`  💰 Total Revenue: $${totalRevenue.toFixed(2)}`);
            console.log(`  📈 Total Profit: $${totalProfit.toFixed(2)}`);

            return {
                period: {
                    start: monthAgo,
                    end: new Date()
                },
                totalConversions,
                totalRevenue,
                totalProfit,
                breakdown: monthlyStats
            };
        } catch (error) {
            console.error('[CPA-CRON] Generate monthly report error:', error);
        }
    }

    /**
     * Clean up old conversions
     */
    async cleanupOldConversions() {
        try {
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

            // Archive old conversions
            const result = await CPAConversion.updateMany(
                {
                    status: { $in: ['paid', 'rejected'] },
                    conversionDate: { $lt: ninetyDaysAgo }
                },
                {
                    $set: {
                        status: 'archived',
                        archivedAt: new Date()
                    }
                }
            );

            if (result.modifiedCount > 0) {
                console.log(`[CPA-CRON] Archived ${result.modifiedCount} old conversions (90+ days)`);
            }

            return result;
        } catch (error) {
            console.error('[CPA-CRON] Cleanup old conversions error:', error);
        }
    }

    /**
     * Refresh offer wall cache
     */
    async refreshOfferWallCache() {
        try {
            // Regenerate offers.html if needed
            await offerWallService.cacheNetworks();
            
            const networks = await NetworkIntegration.find({ status: 'active' });
            
            // Update last generated timestamp
            for (const network of networks) {
                network.lastGenerated = new Date();
                network.cacheKey = `${network.name}-${Date.now()}`;
                await network.save();
            }

            console.log(`[CPA-CRON] Refreshed offer wall cache for ${networks.length} networks`);
        } catch (error) {
            console.error('[CPA-CRON] Refresh offer wall cache error:', error);
        }
    }

    /**
     * Validate network integrations
     */
    async validateNetworkIntegrations() {
        try {
            const networks = await NetworkIntegration.find({ status: 'active' });
            
            let valid = 0;
            let invalid = 0;

            for (const network of networks) {
                // Basic iframe validation
                const hasIframe = network.iframeCode.includes('<iframe');
                const hasScript = network.iframeCode.includes('<script');
                
                if (hasIframe || hasScript) {
                    valid++;
                } else {
                    invalid++;
                    console.warn(`[CPA-CRON] ⚠️ Invalid network integration: ${network.name}`);
                    
                    // Auto-disable invalid networks
                    network.status = 'inactive';
                    await network.save();
                }
            }

            if (invalid > 0) {
                console.log(`[CPA-CRON] Network validation: ${valid} valid, ${invalid} invalid (disabled)`);
            }

            return { valid, invalid };
        } catch (error) {
            console.error('[CPA-CRON] Validate network integrations error:', error);
        }
    }

    /**
     * Get cron job status
     */
    async getStatus() {
        return {
            processPendingConversions: 'scheduled (0 * * * *)',
            updateOfferStats: 'scheduled (0 * * * *)',
            detectFraudulentConversions: 'scheduled (0 */6 * * *)',
            cleanupExpiredOffers: 'scheduled (0 */6 * * *)',
            generateDailyReport: 'scheduled (0 8 * * *)',
            calculateDailyEarnings: 'scheduled (0 12 * * *)',
            processWeeklySettlements: 'scheduled (0 0 * * 1)',
            generateMonthlyReport: 'scheduled (0 0 1 * *)',
            refreshOfferWallCache: 'scheduled (*/30 * * * *)',
            lastRun: new Date().toISOString()
        };
    }
}

module.exports = new CPACronJobs();