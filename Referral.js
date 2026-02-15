// backend/models/Referral.js
const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
    referrerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    refereeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    level: {
        type: Number,
        required: true,
        min: 1,
        max: 3
    },
    commission: {
        type: Number,
        default: 0
    },
    earnings: [{
        withdrawalId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Withdrawal'
        },
        amount: {
            type: Number,
            required: true
        },
        usdAmount: {
            type: Number,
            required: true
        },
        level: {
            type: Number,
            required: true
        },
        commissionRate: {
            type: Number,
            required: true
        },
        earnedAt: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['pending', 'available', 'withdrawn'],
            default: 'pending'
        },
        availableDate: Date
    }],
    bonusEarned: {
        type: Number,
        default: 500 // 500 coins instant bonus
    },
    bonusCredited: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    joinedDate: {
        type: Date,
        default: Date.now
    },
    lastActivity: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound indexes for better performance
referralSchema.index({ referrerId: 1, level: 1 });
referralSchema.index({ referrerId: 1, createdAt: -1 });
referralSchema.index({ 'earnings.status': 1, 'earnings.availableDate': 1 });

// Static method to get referral tree
referralSchema.statics.getReferralTree = async function(userId) {
    const referrals = await this.find({ referrerId: userId })
        .populate('refereeId', 'username firstName lastName balance gamesPlayed totalWithdrawn')
        .sort('-createdAt');
    
    const level1 = [];
    const level2 = [];
    const level3 = [];
    
    for (const ref of referrals) {
        if (ref.level === 1) {
            level1.push(ref);
            
            // Get level 2 referrals
            const level2Refs = await this.find({ referrerId: ref.refereeId._id, level: 2 })
                .populate('refereeId', 'username firstName lastName balance gamesPlayed totalWithdrawn');
            level2.push(...level2Refs);
            
            // Get level 3 referrals
            for (const l2 of level2Refs) {
                const level3Refs = await this.find({ referrerId: l2.refereeId._id, level: 3 })
                    .populate('refereeId', 'username firstName lastName balance gamesPlayed totalWithdrawn');
                level3.push(...level3Refs);
            }
        }
    }
    
    return { level1, level2, level3 };
};

// Method to add commission earning
referralSchema.methods.addEarning = async function(withdrawalId, amount, usdAmount, level, rate) {
    const earning = {
        withdrawalId,
        amount,
        usdAmount,
        level,
        commissionRate: rate,
        earnedAt: new Date(),
        status: 'pending',
        availableDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };
    
    this.earnings.push(earning);
    this.commission += amount;
    await this.save();
    
    return earning;
};

// Method to get total commission by status
referralSchema.methods.getCommissionByStatus = function(status) {
    return this.earnings
        .filter(e => e.status === status)
        .reduce((total, e) => total + e.amount, 0);
};

module.exports = mongoose.model('Referral', referralSchema);