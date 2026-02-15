const mongoose = require('mongoose');

const AdPerformanceSchema = new mongoose.Schema({
    adId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdConfig',
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    impressions: {
        type: Number,
        default: 0
    },
    clicks: {
        type: Number,
        default: 0
    },
    revenue: {
        type: Number,
        default: 0
    },
    ctr: {
        type: Number,
        default: 0
    },
    ecpm: {
        type: Number,
        default: 0
    },
    devices: {
        mobile: { type: Number, default: 0 },
        tablet: { type: Number, default: 0 },
        desktop: { type: Number, default: 0 }
    },
    countries: [{
        code: String,
        impressions: Number,
        clicks: Number
    }],
    hours: [{
        hour: Number,
        impressions: Number,
        clicks: Number
    }]
});

// Calculate CTR before save
AdPerformanceSchema.pre('save', function(next) {
    if (this.impressions > 0) {
        this.ctr = (this.clicks / this.impressions) * 100;
        this.ecpm = (this.revenue / this.impressions) * 1000;
    }
    next();
});

// Aggregate by date range
AdPerformanceSchema.statics.getPerformance = async function(adId, startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                adId: mongoose.Types.ObjectId(adId),
                date: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: null,
                totalImpressions: { $sum: '$impressions' },
                totalClicks: { $sum: '$clicks' },
                totalRevenue: { $sum: '$revenue' },
                avgCTR: { $avg: '$ctr' },
                avgECPM: { $avg: '$ecpm' }
            }
        }
    ]);
};

module.exports = mongoose.model('AdPerformance', AdPerformanceSchema);