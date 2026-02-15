const cron = require('node-cron');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const AdminLog = require('../models/AdminLog');
const nodemailer = require('nodemailer');
const constants = require('../config/constants');

/**
 * CRON JOBS - AUTOMATIC WITHDRAWAL PROCESSING
 * Schedule: 15th of every month at 00:00
 * STRICT: No manual intervention needed
 */

// Process withdrawals on 15th
exports.processWithdrawals = async () => {
    try {
        console.log('🔄 Processing withdrawals for 15th...');
        
        const today = new Date();
        const is15th = today.getDate() === parseInt(process.env.WITHDRAWAL_DAY || 15);
        
        if (!is15th && process.env.TEST_MODE !== 'true') {
            console.log('❌ Not withdrawal day. Skipping...');
            return;
        }
        
        // Find all pending withdrawals
        const pendingWithdrawals = await Withdrawal.find({
            status: 'pending',
            createdAt: {
                $gte: new Date(today.getFullYear(), today.getMonth(), 1)
            }
        }).populate('userId');
        
        console.log(`📊 Found ${pendingWithdrawals.length} pending withdrawals`);
        
        for (const withdrawal of pendingWithdrawals) {
            try {
                // Check if user still eligible
                const eligibility = await Withdrawal.checkEligibility(withdrawal.userId);
                
                if (!eligibility.eligible) {
                    withdrawal.status = 'rejected';
                    withdrawal.rejectionReason = 'User no longer meets eligibility requirements';
                    await withdrawal.save();
                    
                    console.log(`❌ Withdrawal ${withdrawal.withdrawalId} rejected - eligibility failed`);
                    continue;
                }
                
                // Check monthly limit
                const monthlyTotal = await Withdrawal.getMonthlyTotal(withdrawal.userId);
                if (monthlyTotal.totalCoins + withdrawal.amount.coins > (process.env.WITHDRAWAL_MAXIMUM_COINS || 2500000)) {
                    withdrawal.status = 'rejected';
                    withdrawal.rejectionReason = 'Monthly withdrawal limit exceeded';
                    await withdrawal.save();
                    
                    console.log(`❌ Withdrawal ${withdrawal.withdrawalId} rejected - monthly limit exceeded`);
                    continue;
                }
                
                // Update status to approved for manual processing
                withdrawal.status = 'approved';
                await withdrawal.save();
                
                console.log(`✅ Withdrawal ${withdrawal.withdrawalId} approved`);
                
                // Send notification (in production, implement email/telegram)
                await sendWithdrawalNotification(withdrawal);
                
            } catch (error) {
                console.error(`❌ Error processing withdrawal ${withdrawal.withdrawalId}:`, error);
            }
        }
        
        console.log('✅ Withdrawal processing completed');
        
        // Log admin action
        await AdminLog.create({
            admin: null,
            action: 'CRON_WITHDRAWAL_PROCESS',
            details: `Processed ${pendingWithdrawals.length} withdrawals`,
            ip: 'cron'
        });
        
    } catch (error) {
        console.error('❌ Error in withdrawal cron:', error);
    }
};

// Send withdrawal reminders on 14th
exports.sendReminders = async () => {
    try {
        console.log('🔔 Sending withdrawal reminders...');
        
        // Find users eligible for withdrawal
        const eligibleUsers = await User.find({
            status: 'active',
            'stats.gamesPlayed': { $gte: parseInt(process.env.WITHDRAWAL_REQUIRE_GAMES || 100) },
            'referralStats.active': { $gte: parseInt(process.env.WITHDRAWAL_REQUIRE_REFERRALS || 5) },
            'stats.loginStreak': { $gte: parseInt(process.env.WITHDRAWAL_REQUIRE_LOGIN_STREAK || 7) },
            coins: { $gte: parseInt(process.env.WITHDRAWAL_MINIMUM_COINS || 75000) }
        }).select('username email telegramId coins');
        
        console.log(`📧 Found ${eligibleUsers.length} eligible users`);
        
        // Send reminders (implement email/telegram)
        for (const user of eligibleUsers) {
            try {
                // Send email reminder
                if (user.email) {
                    await sendEmailReminder(user);
                }
                
                // Send Telegram reminder
                if (user.telegramId) {
                    await sendTelegramReminder(user);
                }
                
                console.log(`✅ Reminder sent to ${user.username}`);
            } catch (error) {
                console.error(`❌ Error sending reminder to ${user.username}:`, error);
            }
        }
        
        console.log('✅ Reminders sent successfully');
        
    } catch (error) {
        console.error('❌ Error sending reminders:', error);
    }
};

// Check eligibility daily
exports.checkEligibility = async () => {
    try {
        console.log('🔍 Checking withdrawal eligibility...');
        
        const users = await User.find({
            status: 'active'
        }).select('_id username coins stats referralStats createdAt');
        
        let eligible = 0;
        let ineligible = 0;
        
        for (const user of users) {
            const eligibility = await Withdrawal.checkEligibility(user);
            
            // Store eligibility status (in production, cache this)
            if (eligibility.eligible) {
                eligible++;
                
                // Send notification if newly eligible
                if (!user.isEligibleForWithdrawal) {
                    const { sendEligibilityGranted } = require('../services/notificationService');
                    await sendEligibilityGranted(user.telegramId);
                }
            } else {
                ineligible++;
            }
            
            // Update user eligibility flag
            user.isEligibleForWithdrawal = eligibility.eligible;
            await user.save();
        }
        
        console.log(`📊 Eligibility stats: ${eligible} eligible, ${ineligible} ineligible`);
        
        await AdminLog.create({
            admin: null,
            action: 'CRON_ELIGIBILITY_CHECK',
            details: `Checked ${users.length} users: ${eligible} eligible, ${ineligible} ineligible`,
            ip: 'cron'
        });
        
    } catch (error) {
        console.error('❌ Error checking eligibility:', error);
    }
};

// Reset monthly limits on 1st
exports.resetMonthlyLimits = async () => {
    try {
        console.log('🔄 Resetting monthly withdrawal limits...');
        
        await User.updateMany({}, {
            'withdrawalStats.monthlyWithdrawn': 0,
            monthlyWithdrawalAmount: 0,
            lastWithdrawalMonth: null
        });
        
        console.log('✅ Monthly limits reset');
        
        await AdminLog.create({
            admin: null,
            action: 'CRON_MONTHLY_RESET',
            details: 'Monthly withdrawal limits reset',
            ip: 'cron'
        });
        
    } catch (error) {
        console.error('❌ Error resetting monthly limits:', error);
    }
};

// Cleanup failed withdrawals - Weekly
exports.cleanupFailedWithdrawals = async () => {
    try {
        console.log('🧹 Running failed withdrawals cleanup...');
        
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const result = await Withdrawal.updateMany({
            status: 'failed',
            createdAt: { $lt: oneWeekAgo },
            retryCount: { $lt: 3 }
        }, {
            $inc: { retryCount: 1 },
            status: 'pending'
        });
        
        console.log(`✅ Reset ${result.modifiedCount} failed withdrawals for retry`);
        
        await AdminLog.create({
            admin: null,
            action: 'CRON_CLEANUP_FAILED',
            details: `Reset ${result.modifiedCount} failed withdrawals`,
            ip: 'cron'
        });
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
    }
};

// Helper functions for notifications
async function sendWithdrawalNotification(withdrawal) {
    // Implement email/telegram notification
    // This would use your SMTP settings
    console.log(`📧 Withdrawal notification for ${withdrawal.withdrawalId}`);
}

async function sendEmailReminder(user) {
    // Implement email reminder using SMTP settings
    console.log(`📧 Email reminder to ${user.email}`);
}

async function sendTelegramReminder(user) {
    // Implement Telegram reminder using bot token
    console.log(`🤖 Telegram reminder to ${user.telegramId}`);
}

// ============ CRON JOB SCHEDULES ============

// Process withdrawals - 15th 00:00
cron.schedule(constants.CRON_SCHEDULES.PROCESS_WITHDRAWALS, async () => {
    console.log('🔄 Running withdrawal processing CRON job...');
    console.log(`📅 Date: ${new Date().toLocaleString()}`);
    
    try {
        await exports.processWithdrawals();
        console.log('✅ Withdrawal processing completed successfully');
    } catch (error) {
        console.error('❌ Withdrawal processing failed:', error);
    }
}, {
    scheduled: true,
    timezone: "UTC"
});

// Send withdrawal reminders - 14th 09:00
cron.schedule(constants.CRON_SCHEDULES.SEND_REMINDERS, async () => {
    console.log('📅 Running withdrawal reminders CRON job...');
    
    try {
        await exports.sendReminders();
        console.log('✅ Withdrawal reminders sent successfully');
    } catch (error) {
        console.error('❌ Failed to send withdrawal reminders:', error);
    }
}, {
    scheduled: true,
    timezone: "UTC"
});

// Check eligibility - Daily
cron.schedule(constants.CRON_SCHEDULES.CHECK_ELIGIBILITY, async () => {
    console.log('✅ Running eligibility check CRON job...');
    
    try {
        await exports.checkEligibility();
        console.log('✅ Eligibility check completed successfully');
    } catch (error) {
        console.error('❌ Eligibility check failed:', error);
    }
}, {
    scheduled: true,
    timezone: "UTC"
});

// Reset monthly limits - 1st 00:00
cron.schedule(constants.CRON_SCHEDULES.RESET_MONTHLY_LIMITS, async () => {
    console.log('🔄 Running monthly limits reset CRON job...');
    
    try {
        await exports.resetMonthlyLimits();
        console.log('✅ Monthly limits reset successfully');
    } catch (error) {
        console.error('❌ Failed to reset monthly limits:', error);
    }
}, {
    scheduled: true,
    timezone: "UTC"
});

// Cleanup failed withdrawals - Every Sunday at 00:00
cron.schedule('0 0 * * 0', async () => {
    console.log('🧹 Running failed withdrawals cleanup CRON job...');
    
    try {
        await exports.cleanupFailedWithdrawals();
        console.log('✅ Failed withdrawals cleanup completed successfully');
    } catch (error) {
        console.error('❌ Failed withdrawals cleanup failed:', error);
    }
}, {
    scheduled: true,
    timezone: "UTC"
});

console.log('⏰ Withdrawal CRON jobs scheduled:');
console.log(`- Process withdrawals: ${constants.CRON_SCHEDULES.PROCESS_WITHDRAWALS}`);
console.log(`- Send reminders: ${constants.CRON_SCHEDULES.SEND_REMINDERS}`);
console.log(`- Check eligibility: ${constants.CRON_SCHEDULES.CHECK_ELIGIBILITY}`);
console.log(`- Reset monthly limits: ${constants.CRON_SCHEDULES.RESET_MONTHLY_LIMITS}`);
console.log(`- Cleanup failed withdrawals: 0 0 * * 0 (Every Sunday)`);

module.exports = {
    processWithdrawals: exports.processWithdrawals,
    sendReminders: exports.sendReminders,
    checkEligibility: exports.checkEligibility,
    resetMonthlyLimits: exports.resetMonthlyLimits,
    cleanupFailedWithdrawals: exports.cleanupFailedWithdrawals
};