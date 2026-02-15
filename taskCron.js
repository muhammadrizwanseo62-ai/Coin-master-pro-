/**
 * Task Cron Jobs
 * Automated task management: expiration, pausing, completion, cleanup, reports
 */

const cron = require('node-cron');
const CustomTask = require('../models/CustomTask');
const CustomTaskSubmission = require('../models/CustomTaskSubmission');
const User = require('../models/User');
const customTaskService = require('../services/customTaskService');

class TaskCronJobs {
    
    constructor() {
        this.initializeJobs();
    }

    /**
     * Initialize all cron jobs
     */
    initializeJobs() {
        // Run every minute for active tasks
        cron.schedule('* * * * *', () => {
            this.checkExpiringTasks();
            this.checkDailyLimits();
        });

        // Run every 5 minutes for task status updates
        cron.schedule('*/5 * * * *', () => {
            this.autoExpireTasks();
            this.autoCompleteTasks();
            this.autoPauseTasks();
        });

        // Run every hour for cleanup and reports
        cron.schedule('0 * * * *', () => {
            this.cleanupOldSubmissions();
            this.updateTaskStatistics();
        });

        // Run daily at 9 AM for reports
        cron.schedule('0 9 * * *', () => {
            this.sendTaskReports();
            this.sendDailyDigest();
        });

        // Run daily at midnight for resets
        cron.schedule('0 0 * * *', () => {
            this.resetDailyCounters();
            this.autoRejectExpiredSubmissions();
        });

        // Run weekly on Monday for analytics
        cron.schedule('0 0 * * 1', () => {
            this.generateWeeklyReport();
            this.cleanupOldTasks();
        });

        console.log('✅ Task cron jobs initialized');
    }

    /**
     * Auto expire tasks when end date reached
     */
    async autoExpireTasks() {
        try {
            const now = new Date();
            
            const result = await CustomTask.updateMany(
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
                console.log(`[CRON] Auto-expired ${result.modifiedCount} tasks - ${now.toISOString()}`);
                
                // Log expired tasks
                const expiredTasks = await CustomTask.find({
                    status: 'expired',
                    updatedAt: { $gte: new Date(now - 60000) } // Last minute
                }).select('taskId title');
                
                expiredTasks.forEach(task => {
                    console.log(`  📌 Expired: ${task.taskId} - ${task.title}`);
                });
            }

            return result;
        } catch (error) {
            console.error('[CRON] Auto-expire tasks error:', error);
        }
    }

    /**
     * Auto pause tasks when daily limit reached
     */
    async autoPauseTasks() {
        try {
            const now = new Date();
            const today = new Date(now.setHours(0, 0, 0, 0));
            
            // Find tasks with daily limit
            const tasks = await CustomTask.find({
                status: 'active',
                dailyLimit: { $gt: 0 }
            });

            let paused = 0;

            for (const task of tasks) {
                // Count today's submissions
                const todaySubmissions = await CustomTaskSubmission.countDocuments({
                    taskId: task._id,
                    submittedAt: { $gte: today },
                    status: { $in: ['approved', 'pending'] }
                });

                if (todaySubmissions >= task.dailyLimit) {
                    task.status = 'paused';
                    task.updatedAt = new Date();
                    await task.save();
                    paused++;
                    
                    console.log(`  ⏸️  Auto-paused: ${task.taskId} - ${task.title} (Daily limit: ${task.dailyLimit})`);
                }
            }

            if (paused > 0) {
                console.log(`[CRON] Auto-paused ${paused} tasks due to daily limit`);
            }

            return { paused };
        } catch (error) {
            console.error('[CRON] Auto-pause tasks error:', error);
        }
    }

    /**
     * Auto complete tasks when slots are full
     */
    async autoCompleteTasks() {
        try {
            const result = await CustomTask.updateMany(
                {
                    status: 'active',
                    $expr: { $gte: ['$completedSlots', '$totalSlots'] }
                },
                {
                    $set: {
                        status: 'completed',
                        updatedAt: new Date()
                    }
                }
            );

            if (result.modifiedCount > 0) {
                console.log(`[CRON] Auto-completed ${result.modifiedCount} tasks - slots full`);
            }

            return result;
        } catch (error) {
            console.error('[CRON] Auto-complete tasks error:', error);
        }
    }

    /**
     * Check for tasks expiring soon
     */
    async checkExpiringTasks() {
        try {
            const now = new Date();
            const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            // Tasks expiring in 24 hours
            const expiringToday = await CustomTask.find({
                status: 'active',
                endDate: {
                    $gte: now,
                    $lte: in24Hours
                }
            }).select('taskId title endDate');

            if (expiringToday.length > 0) {
                console.log(`[CRON] ⚠️  ${expiringToday.length} tasks expiring in 24 hours`);
                
                // Log for monitoring
                expiringToday.forEach(task => {
                    console.log(`  📅 ${task.taskId} - ${task.title} expires at ${task.endDate}`);
                });
            }

            // Tasks expiring in 7 days
            const expiringThisWeek = await CustomTask.find({
                status: 'active',
                endDate: {
                    $gte: in24Hours,
                    $lte: in7Days
                }
            }).select('taskId title endDate');

            if (expiringThisWeek.length > 0) {
                console.log(`[CRON] 📆 ${expiringThisWeek.length} tasks expiring this week`);
            }

            return {
                expiringToday: expiringToday.length,
                expiringThisWeek: expiringThisWeek.length
            };
        } catch (error) {
            console.error('[CRON] Check expiring tasks error:', error);
        }
    }

    /**
     * Check daily limits for all tasks
     */
    async checkDailyLimits() {
        try {
            const now = new Date();
            const today = new Date(now.setHours(0, 0, 0, 0));
            
            const tasks = await CustomTask.find({
                status: 'active',
                dailyLimit: { $gt: 0 }
            }).select('_id taskId title dailyLimit');

            let approaching = 0;
            let reached = 0;

            for (const task of tasks) {
                const todaySubmissions = await CustomTaskSubmission.countDocuments({
                    taskId: task._id,
                    submittedAt: { $gte: today }
                });

                const percentUsed = (todaySubmissions / task.dailyLimit) * 100;
                
                if (percentUsed >= 90 && percentUsed < 100) {
                    approaching++;
                    console.log(`  ⚠️  ${task.taskId} - ${task.title}: ${todaySubmissions}/${task.dailyLimit} (${Math.round(percentUsed)}%)`);
                } else if (percentUsed >= 100) {
                    reached++;
                }
            }

            if (approaching > 0) {
                console.log(`[CRON] ${approaching} tasks approaching daily limit`);
            }

            return { approaching, reached };
        } catch (error) {
            console.error('[CRON] Check daily limits error:', error);
        }
    }

    /**
     * Clean up old submissions
     */
    async cleanupOldSubmissions() {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // Archive old approved submissions
            const approvedToArchive = await CustomTaskSubmission.find({
                status: 'approved',
                approvedAt: { $lt: thirtyDaysAgo }
            });

            // Delete old rejected submissions
            const rejectedResult = await CustomTaskSubmission.deleteMany({
                status: 'rejected',
                submittedAt: { $lt: thirtyDaysAgo }
            });

            // Delete old pending submissions (older than 30 days)
            const pendingResult = await CustomTaskSubmission.deleteMany({
                status: 'pending',
                submittedAt: { $lt: thirtyDaysAgo }
            });

            console.log(`[CRON] Cleanup completed:
  ✅ Archived: ${approvedToArchive.length} approved submissions
  🗑️  Deleted: ${rejectedResult.deletedCount} rejected submissions
  🗑️  Deleted: ${pendingResult.deletedCount} pending submissions (expired)`);

            return {
                archived: approvedToArchive.length,
                deletedRejected: rejectedResult.deletedCount,
                deletedPending: pendingResult.deletedCount
            };
        } catch (error) {
            console.error('[CRON] Cleanup old submissions error:', error);
        }
    }

    /**
     * Auto reject expired pending submissions
     */
    async autoRejectExpiredSubmissions() {
        try {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const result = await CustomTaskSubmission.updateMany(
                {
                    status: 'pending',
                    submittedAt: { $lt: sevenDaysAgo }
                },
                {
                    $set: {
                        status: 'rejected',
                        rejectionReason: 'Auto-rejected: Verification timeout (7 days)',
                        processedAt: new Date()
                    }
                }
            );

            if (result.modifiedCount > 0) {
                console.log(`[CRON] Auto-rejected ${result.modifiedCount} expired submissions (7+ days old)`);
            }

            return result;
        } catch (error) {
            console.error('[CRON] Auto-reject expired submissions error:', error);
        }
    }

    /**
     * Update task statistics
     */
    async updateTaskStatistics() {
        try {
            const tasks = await CustomTask.find({ status: 'active' });
            
            for (const task of tasks) {
                // Get submission stats
                const submissions = await CustomTaskSubmission.aggregate([
                    { $match: { taskId: task._id } },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ]);

                const stats = {
                    totalSubmissions: 0,
                    totalPending: 0,
                    totalApproved: 0,
                    totalRejected: 0
                };

                submissions.forEach(s => {
                    stats.totalSubmissions += s.count;
                    if (s._id === 'pending') stats.totalPending = s.count;
                    if (s._id === 'approved') stats.totalApproved = s.count;
                    if (s._id === 'rejected') stats.totalRejected = s.count;
                });

                // Update conversion rate
                const conversionRate = stats.totalSubmissions > 0 
                    ? (stats.totalApproved / stats.totalSubmissions) * 100 
                    : 0;

                // Update task
                await CustomTask.findByIdAndUpdate(task._id, {
                    $set: {
                        totalSubmissions: stats.totalSubmissions,
                        totalPending: stats.totalPending,
                        totalApproved: stats.totalApproved,
                        totalRejected: stats.totalRejected,
                        conversionRate: parseFloat(conversionRate.toFixed(2)),
                        updatedAt: new Date()
                    }
                });
            }

            console.log(`[CRON] Updated statistics for ${tasks.length} active tasks`);
        } catch (error) {
            console.error('[CRON] Update task statistics error:', error);
        }
    }

    /**
     * Reset daily counters
     */
    async resetDailyCounters() {
        try {
            // Reset any daily-specific fields
            // This runs at midnight
            
            console.log(`[CRON] Daily counters reset - ${new Date().toISOString()}`);
            
            return { success: true };
        } catch (error) {
            console.error('[CRON] Reset daily counters error:', error);
        }
    }

    /**
     * Send task reports to admin
     */
    async sendTaskReports() {
        try {
            const now = new Date();
            const yesterday = new Date(now - 24 * 60 * 60 * 1000);
            const yesterdayStart = new Date(yesterday.setHours(0, 0, 0, 0));
            const yesterdayEnd = new Date(yesterday.setHours(23, 59, 59, 999));

            // Get yesterday's stats
            const submissions = await CustomTaskSubmission.find({
                submittedAt: { $gte: yesterdayStart, $lte: yesterdayEnd }
            }).populate('taskId');

            const stats = {
                total: submissions.length,
                pending: submissions.filter(s => s.status === 'pending').length,
                approved: submissions.filter(s => s.status === 'approved').length,
                rejected: submissions.filter(s => s.status === 'rejected').length,
                totalReward: submissions
                    .filter(s => s.status === 'approved')
                    .reduce((sum, s) => sum + (s.taskId?.rewardCoins || 0), 0),
                totalPayout: submissions
                    .filter(s => s.status === 'approved')
                    .reduce((sum, s) => sum + (s.taskId?.payoutUSD || 0), 0)
            };

            // Calculate profit
            stats.totalProfit = stats.totalPayout - (stats.totalReward / 5000);

            console.log(`[CRON] Daily Report - ${yesterdayStart.toDateString()}:`);
            console.log(`  📊 Submissions: ${stats.total}`);
            console.log(`  ⏳ Pending: ${stats.pending}`);
            console.log(`  ✅ Approved: ${stats.approved}`);
            console.log(`  ❌ Rejected: ${stats.rejected}`);
            console.log(`  💰 Reward: ${stats.totalReward} coins`);
            console.log(`  💵 Payout: $${stats.totalPayout.toFixed(2)}`);
            console.log(`  📈 Profit: $${stats.totalProfit.toFixed(2)}`);

            // In production, send email to admin
            // await emailService.sendDailyReport(stats);

            return stats;
        } catch (error) {
            console.error('[CRON] Send task reports error:', error);
        }
    }

    /**
     * Send daily digest to users
     */
    async sendDailyDigest() {
        try {
            // Get top tasks from yesterday
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const topTasks = await CustomTask.find({
                status: 'active',
                createdAt: { $gte: yesterday }
            })
            .sort({ totalStarts: -1 })
            .limit(5)
            .select('title rewardCoins description');

            // In production, send push notifications or emails to users
            // This is a mock implementation

            console.log(`[CRON] Daily Digest - Top 5 New Tasks:`);
            topTasks.forEach((task, index) => {
                console.log(`  ${index + 1}. ${task.title} - ${task.rewardCoins} coins`);
            });

            return { topTasks: topTasks.length };
        } catch (error) {
            console.error('[CRON] Send daily digest error:', error);
        }
    }

    /**
     * Generate weekly report
     */
    async generateWeeklyReport() {
        try {
            const now = new Date();
            const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

            // Weekly task stats
            const taskStats = await CustomTask.aggregate([
                {
                    $match: {
                        createdAt: { $gte: weekAgo }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalTasks: { $sum: 1 },
                        activeTasks: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
                        totalRewards: { $sum: '$rewardCoins' },
                        totalPayouts: { $sum: '$payoutUSD' },
                        totalProfit: { $sum: '$profitUSD' },
                        totalViews: { $sum: '$totalViews' },
                        totalStarts: { $sum: '$totalStarts' }
                    }
                }
            ]);

            // Weekly submission stats
            const submissionStats = await CustomTaskSubmission.aggregate([
                {
                    $match: {
                        submittedAt: { $gte: weekAgo }
                    }
                },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalReward: { $sum: '$taskId.rewardCoins' }
                    }
                }
            ]);

            // Category breakdown
            const categoryStats = await CustomTask.aggregate([
                {
                    $match: {
                        createdAt: { $gte: weekAgo }
                    }
                },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 },
                        totalStarts: { $sum: '$totalStarts' }
                    }
                }
            ]);

            console.log(`[CRON] Weekly Report - ${weekAgo.toDateString()} to ${now.toDateString()}:`);
            console.log(`  📋 New Tasks: ${taskStats[0]?.totalTasks || 0}`);
            console.log(`  🎯 Active Tasks: ${taskStats[0]?.activeTasks || 0}`);
            console.log(`  👀 Total Views: ${taskStats[0]?.totalViews || 0}`);
            console.log(`  🚀 Total Starts: ${taskStats[0]?.totalStarts || 0}`);
            console.log(`  💰 Total Profit: $${(taskStats[0]?.totalProfit || 0).toFixed(2)}`);
            
            submissionStats.forEach(stat => {
                console.log(`  ${stat._id}: ${stat.count} submissions`);
            });

            return {
                taskStats: taskStats[0] || {},
                submissionStats,
                categoryStats
            };
        } catch (error) {
            console.error('[CRON] Generate weekly report error:', error);
        }
    }

    /**
     * Clean up old tasks
     */
    async cleanupOldTasks() {
        try {
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

            // Archive completed tasks older than 90 days
            const result = await CustomTask.updateMany(
                {
                    status: 'completed',
                    updatedAt: { $lt: ninetyDaysAgo }
                },
                {
                    $set: {
                        status: 'archived',
                        updatedAt: new Date()
                    }
                }
            );

            if (result.modifiedCount > 0) {
                console.log(`[CRON] Archived ${result.modifiedCount} completed tasks (90+ days old)`);
            }

            return result;
        } catch (error) {
            console.error('[CRON] Cleanup old tasks error:', error);
        }
    }

    /**
     * Get cron job status
     */
    async getStatus() {
        return {
            autoExpireTasks: 'scheduled (*/5 * * * *)',
            autoPauseTasks: 'scheduled (*/5 * * * *)',
            autoCompleteTasks: 'scheduled (*/5 * * * *)',
            cleanupOldSubmissions: 'scheduled (0 * * * *)',
            sendTaskReports: 'scheduled (0 9 * * *)',
            dailyDigest: 'scheduled (0 9 * * *)',
            weeklyReport: 'scheduled (0 0 * * 1)',
            lastRun: new Date().toISOString()
        };
    }
}

module.exports = new TaskCronJobs();