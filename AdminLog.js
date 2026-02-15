const mongoose = require('mongoose');

const AdminLogSchema = new mongoose.Schema({
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    action: {
        type: String,
        required: true,
        enum: [
            'LOGIN',
            'LOGOUT',
            'CREATE_AD',
            'UPDATE_AD',
            'DELETE_AD',
            'CREATE_INLINE_AD',
            'UPDATE_INLINE_AD',
            'DELETE_INLINE_AD',
            'CREATE_USER',
            'UPDATE_USER',
            'DELETE_USER',
            'BLOCK_USER',
            'UNBLOCK_USER',
            'ADJUST_COINS',
            'APPROVE_WITHDRAWAL',
            'REJECT_WITHDRAWAL',
            'CREATE_TASK',
            'UPDATE_TASK',
            'DELETE_TASK',
            'VERIFY_TASK',
            'EXPORT_DATA',
            'IMPORT_DATA',
            'UPDATE_SETTINGS'
        ]
    },
    details: {
        type: String,
        required: true
    },
    ip: {
        type: String,
        required: true
    },
    userAgent: {
        type: String
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient querying
AdminLogSchema.index({ admin: 1, timestamp: -1 });
AdminLogSchema.index({ action: 1, timestamp: -1 });
AdminLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AdminLog', AdminLogSchema);