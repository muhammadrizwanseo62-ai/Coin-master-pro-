const mongoose = require('mongoose');

const AdConfigSchema = new mongoose.Schema({
    adId: {
        type: String,
        required: true,
        unique: true
    },
    position: {
        type: String,
        required: true,
        enum: [
            'pre_game', 'post_game', 'banner_top', 'banner_bottom',
            'rewarded_video', 'interstitial', 'native', 'offer_wall',
            'inline_task_feed', 'inline_referral_history', 'inline_transaction_history',
            'inline_leaderboard', 'inline_offer_wall', 'inline_daily_bonus',
            'inline_game_history', 'inline_notifications', 'inline_chat', 'inline_settings'
        ]
    },
    network: {
        type: String,
        required: true,
        enum: ['google', 'unity', 'facebook', 'applovin', 'ironsource', 'vungle', 'custom']
    },
    adCode: {
        type: String,
        required: true
    },
    frequency: {
        type: Number,
        min: 1,
        max: 100,
        default: 50
    },
    status: {
        type: Boolean,
        default: true
    },
    schedule: {
        startDate: Date,
        endDate: Date,
        startTime: String,
        endTime: String,
        daysOfWeek: [String]
    },
    targeting: {
        countries: [String],
        devices: [String],
        minBalance: Number,
        maxBalance: Number
    },
    metrics: {
        impressions: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
        revenue: { type: Number, default: 0 }
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
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

// Update timestamp on save
AdConfigSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Calculate CTR
AdConfigSchema.virtual('ctr').get(function() {
    if (this.metrics.impressions === 0) return 0;
    return (this.metrics.clicks / this.metrics.impressions * 100).toFixed(2);
});

module.exports = mongoose.model('AdConfig', AdConfigSchema);