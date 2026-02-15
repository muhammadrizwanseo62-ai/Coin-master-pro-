const mongoose = require('mongoose');

const ReferralLogSchema = new mongoose.Schema({
    referrerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    referredId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    referralCode: {
        type: String,
        required: true
    },
    ip: {
        type: String
    },
    userAgent: {
        type: String
    },
    deviceFingerprint: {
        type: String
    },
    status: {
        type: String,
        enum: ['clicked', 'registered', 'active', 'converted'],
        default: 'clicked'
    },
    bonusGiven: {
        type: Number,
        default: 0
    },
    bonusClaimed: {
        type: Boolean,
        default: false
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

ReferralLogSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('ReferralLog', ReferralLogSchema);