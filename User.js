const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    // ============ CORE FIELDS from both versions ============
    username: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        minlength: 3
    },
    email: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        minlength: 6
    },
    fullName: {
        type: String
    },
    firstName: { 
        type: String 
    },
    lastName: { 
        type: String 
    },
    avatar: {
        type: String,
        default: 'default-avatar.png'
    },
    photoUrl: { 
        type: String 
    },
    
    // ============ TELEGRAM FIELDS ============
    telegramId: {
        type: String,
        unique: true,
        sparse: true
    },
    telegramUsername: {
        type: String
    },
    
    // ============ BALANCE SYSTEM ============
    coins: {
        type: Number,
        default: process.env.STARTING_BONUS || 500,
        min: 0
    },
    balance: { 
        type: Number, 
        default: 0,
        min: 0
    },
    totalEarned: {
        type: Number,
        default: 0
    },
    totalWithdrawn: {
        type: Number,
        default: 0
    },
    
    // ============ REFERRAL SYSTEM - AUTOMATIC 1500 BONUS ============
    referralCode: {
        type: String,
        unique: true
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // Track who referred this user (by code)
    referredByCode: {
        type: String
    },
    referrals: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        date: { type: Date, default: Date.now },
        bonusGiven: { type: Number, default: process.env.REFERRAL_BONUS_REFERRER || 1500 },
        active: { type: Boolean, default: true },
        bonusClaimed: { type: Boolean, default: true } // Auto-claimed
    }],
    referralStats: {
        total: { type: Number, default: 0 },
        active: { type: Number, default: 0 },
        earnings: { type: Number, default: 0 }
    },
    referralEarnings: { 
        type: Number, 
        default: 0 
    },
    totalReferralBonus: { 
        type: Number, 
        default: 0 
    },
    
    // ============ USER STATS ============
    stats: {
        gamesPlayed: { type: Number, default: 0 },
        tasksCompleted: { type: Number, default: 0 },
        loginStreak: { type: Number, default: 0 },
        lastLogin: { type: Date },
        lastSeen: { type: Date },
        totalClicks: { type: Number, default: 0 },
        totalWatchTime: { type: Number, default: 0 } // seconds
    },
    
    // ============ DAILY LIMITS ============
    dailyStats: {
        date: { type: Date, default: Date.now },
        clicks: { type: Number, default: 0 },
        tasks: { type: Number, default: 0 },
        referrals: { type: Number, default: 0 },
        earnings: { type: Number, default: 0 }
    },
    
    // ============ WITHDRAWAL TRACKING ============
    withdrawalStats: {
        totalRequests: { type: Number, default: 0 },
        successfulWithdrawals: { type: Number, default: 0 },
        failedWithdrawals: { type: Number, default: 0 },
        lastWithdrawalDate: { type: Date },
        monthlyWithdrawn: { type: Number, default: 0 },
        lifetimeWithdrawn: { type: Number, default: 0 }
    },
    monthlyWithdrawalAmount: { 
        type: Number, 
        default: 0 
    },
    lastWithdrawalMonth: { 
        type: String 
    },
    pendingWithdrawals: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Withdrawal'
    }],
    
    // ============ ACCOUNT VERIFICATION ============
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    
    isPhoneVerified: {
        type: Boolean,
        default: false
    },
    phoneNumber: String,
    
    // ============ SECURITY ============
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorSecret: String,
    
    // ============ DEVICE TRACKING ============
    devices: [{
        fingerprint: String,
        userAgent: String,
        ip: String,
        lastSeen: Date
    }],
    
    // ============ ELIGIBILITY ============
    isEligibleForWithdrawal: {
        type: Boolean,
        default: false
    },
    
    // ============ STATUS ============
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'banned'],
        default: 'active'
    },
    statusReason: String,
    statusUpdatedAt: Date,
    
    // ============ FRAUD DETECTION ============
    fraudScore: {
        type: Number,
        default: 0
    },
    flaggedForReview: {
        type: Boolean,
        default: false
    },
    suspiciousPatterns: [{
        pattern: String,
        count: Number,
        lastDetected: Date
    }],
    
    // ============ ACCOUNT AGE ============
    accountAge: {
        type: Date,
        default: Date.now
    },
    
    // ============ TIMESTAMPS ============
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// ============ INDEXES for performance ============
UserSchema.index({ referralCode: 1 });
UserSchema.index({ referredBy: 1 });
UserSchema.index({ telegramId: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ 'dailyStats.date': 1 });
UserSchema.index({ createdAt: 1 });
UserSchema.index({ isEligibleForWithdrawal: 1 });
UserSchema.index({ 'referralStats.total': -1 }); // For leaderboard

// ============ PRE-SAVE HOOKS ============

// Hash password before saving (if password exists)
UserSchema.pre('save', async function(next) {
    if (this.password && this.isModified('password')) {
        try {
            const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 10);
            this.password = await bcrypt.hash(this.password, salt);
        } catch (error) {
            return next(error);
        }
    }
    next();
});

// Update timestamps
UserSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Generate referral code if not exists
UserSchema.pre('save', function(next) {
    if (!this.referralCode) {
        this.referralCode = this.generateReferralCode();
    }
    next();
});

// ============ VIRTUAL FIELDS ============

// Get account age in days
UserSchema.virtual('accountAgeDays').get(function() {
    const now = new Date();
    return Math.floor((now - (this.accountAge || this.createdAt)) / (1000 * 60 * 60 * 24));
});

// Get remaining withdrawal limit for month
UserSchema.virtual('remainingWithdrawalLimit').get(function() {
    const maxMonthly = parseInt(process.env.WITHDRAWAL_MAXIMUM_COINS) || 2500000;
    return Math.max(0, maxMonthly - (this.withdrawalStats.monthlyWithdrawn || this.monthlyWithdrawalAmount || 0));
});

// Get total balance (combine coins and balance fields)
UserSchema.virtual('totalBalance').get(function() {
    return (this.coins || 0) + (this.balance || 0);
});

// ============ METHODS ============

// Compare password (if password exists)
UserSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

// Generate referral code
UserSchema.methods.generateReferralCode = function() {
    const prefix = this.username ? this.username.substring(0, 3).toUpperCase() : 'REF';
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const code = `${prefix}${random}`;
    return code.substring(0, 10); // Ensure max length
};

// AUTO AWARD REFERRAL BONUS - 1500 COINS INSTANT
UserSchema.methods.awardReferralBonus = async function(referredUserId, referredUsername) {
    const referralBonus = parseInt(process.env.REFERRAL_BONUS_REFERRER) || 1500;
    
    // Add to referrals array
    this.referrals.push({
        user: referredUserId,
        bonusGiven: referralBonus,
        bonusClaimed: true, // Auto-claimed
        active: true,
        date: new Date()
    });
    
    // Update referral stats
    this.referralStats.total += 1;
    this.referralStats.active += 1;
    this.referralStats.earnings += referralBonus;
    
    // Update earnings fields
    this.referralEarnings = (this.referralEarnings || 0) + referralBonus;
    this.totalReferralBonus = (this.totalReferralBonus || 0) + referralBonus;
    
    // Add coins instantly
    this.coins = (this.coins || 0) + referralBonus;
    this.balance = (this.balance || 0) + referralBonus;
    this.totalEarned = (this.totalEarned || 0) + referralBonus;
    
    // Update daily stats
    await this.incrementDailyStat('referral', 1);
    await this.incrementDailyStat('earning', referralBonus);
    
    await this.save();
    
    console.log(`✅ AUTO BONUS: 1500 coins awarded to ${this.username || this.telegramUsername} for referring ${referredUsername || 'new user'}`);
    
    return {
        success: true,
        bonus: referralBonus,
        newBalance: this.coins
    };
};

// Add referral (legacy method)
UserSchema.methods.addReferral = async function(referredUserId) {
    return await this.awardReferralBonus(referredUserId, 'user');
};

// Check daily limits
UserSchema.methods.checkDailyLimit = function(type) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!this.dailyStats.date || this.dailyStats.date < today) {
        // Reset daily stats
        this.dailyStats = {
            date: today,
            clicks: 0,
            tasks: 0,
            referrals: 0,
            earnings: 0
        };
    }
    
    const maxClicks = parseInt(process.env.MAX_CLICKS_PER_DAY) || 1000;
    const maxTasks = parseInt(process.env.MAX_TASKS_PER_DAY) || 50;
    const maxReferrals = parseInt(process.env.MAX_REFERRALS_PER_DAY) || 10;
    const maxEarnings = parseInt(process.env.MAX_DAILY_EARNINGS) || 50000;
    
    switch(type) {
        case 'click':
            return this.dailyStats.clicks < maxClicks;
        case 'task':
            return this.dailyStats.tasks < maxTasks;
        case 'referral':
            return this.dailyStats.referrals < maxReferrals;
        case 'earning':
            return this.dailyStats.earnings < maxEarnings;
        default:
            return true;
    }
};

// Increment daily stat
UserSchema.methods.incrementDailyStat = async function(type, amount = 1) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!this.dailyStats.date || this.dailyStats.date < today) {
        this.dailyStats = {
            date: today,
            clicks: 0,
            tasks: 0,
            referrals: 0,
            earnings: 0
        };
    }
    
    switch(type) {
        case 'click':
            this.dailyStats.clicks += amount;
            if (this.stats) this.stats.totalClicks = (this.stats.totalClicks || 0) + amount;
            break;
        case 'task':
            this.dailyStats.tasks += amount;
            if (this.stats) this.stats.tasksCompleted = (this.stats.tasksCompleted || 0) + amount;
            break;
        case 'referral':
            this.dailyStats.referrals += amount;
            break;
        case 'earning':
            this.dailyStats.earnings += amount;
            break;
    }
    
    return this;
};

// Check withdrawal eligibility
UserSchema.methods.checkWithdrawalEligibility = async function() {
    try {
        const Withdrawal = mongoose.model('Withdrawal');
        return await Withdrawal.checkEligibility(this._id);
    } catch (error) {
        console.error('Error checking eligibility:', error);
        return { eligible: false, reason: 'Error checking eligibility' };
    }
};

// Update last seen
UserSchema.methods.updateLastSeen = function() {
    if (this.stats) {
        this.stats.lastSeen = new Date();
        this.stats.lastLogin = new Date();
    }
    return this;
};

// ============ STATIC METHODS ============

// Find by telegram ID or username
UserSchema.statics.findByTelegram = function(telegramId) {
    return this.findOne({ telegramId });
};

// Get referral leaderboard
UserSchema.statics.getReferralLeaderboard = function(limit = 10) {
    return this.find({
        'referralStats.total': { $gt: 0 }
    })
        .select('username firstName lastName photoUrl avatar referralStats referralEarnings totalReferralBonus')
        .sort({ 'referralStats.total': -1, 'referralStats.earnings': -1 })
        .limit(limit);
};

// ============ EXPORT ============
module.exports = mongoose.model('User', UserSchema);