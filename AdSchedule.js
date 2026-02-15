const mongoose = require('mongoose');

const AdScheduleSchema = new mongoose.Schema({
    adId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdConfig',
        required: true
    },
    scheduleType: {
        type: String,
        enum: ['once', 'daily', 'weekly', 'monthly', 'custom'],
        default: 'daily'
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date
    },
    startTime: {
        type: String,
        required: true
    },
    endTime: {
        type: String,
        required: true
    },
    daysOfWeek: [{
        type: String,
        enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    }],
    timezone: {
        type: String,
        default: 'UTC'
    },
    priority: {
        type: Number,
        min: 1,
        max: 10,
        default: 5
    },
    maxImpressions: {
        type: Number,
        default: 0 // 0 = unlimited
    },
    currentImpressions: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'paused', 'completed', 'expired'],
        default: 'active'
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

AdScheduleSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Check if schedule is active
AdScheduleSchema.methods.isActive = function() {
    const now = new Date();
    return this.status === 'active' && 
           now >= this.startDate && 
           (!this.endDate || now <= this.endDate) &&
           (this.maxImpressions === 0 || this.currentImpressions < this.maxImpressions);
};

module.exports = mongoose.model('AdSchedule', AdScheduleSchema);