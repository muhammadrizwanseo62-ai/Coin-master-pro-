const mongoose = require('mongoose');

const InlineAdConfigSchema = new mongoose.Schema({
    positionId: {
        type: String,
        required: true,
        unique: true,
        enum: [
            'inline_task_feed',
            'inline_referral_history',
            'inline_transaction_history',
            'inline_leaderboard',
            'inline_offer_wall',
            'inline_daily_bonus',
            'inline_game_history',
            'inline_notifications',
            'inline_chat',
            'inline_settings'
        ]
    },
    positionName: {
        type: String,
        required: true
    },
    displayFrequency: {
        type: Number,
        min: 1,
        max: 20,
        default: 5
    },
    adCode: {
        type: String,
        required: true
    },
    status: {
        type: Boolean,
        default: false
    },
    metrics: {
        impressions: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
        revenue: { type: Number, default: 0 },
        viewabilityScore: { type: Number, default: 0 }
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

InlineAdConfigSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('InlineAdConfig', InlineAdConfigSchema);