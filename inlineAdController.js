const InlineAdConfig = require('../models/InlineAdConfig');
const AdminLog = require('../models/AdminLog');

// Create inline ad configuration
exports.createInlineAd = async (req, res) => {
    try {
        const inlineAd = new InlineAdConfig(req.body);
        await inlineAd.save();
        
        await AdminLog.create({
            admin: req.admin._id,
            action: 'CREATE_INLINE_AD',
            details: `Created inline ad for position: ${inlineAd.positionName}`,
            ip: req.ip
        });
        
        res.status(201).json({
            success: true,
            message: 'Inline ad created successfully',
            data: inlineAd
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating inline ad',
            error: error.message
        });
    }
};

// Get all inline ads
exports.getAllInlineAds = async (req, res) => {
    try {
        const inlineAds = await InlineAdConfig.find().sort({ positionName: 1 });
        
        res.json({
            success: true,
            data: inlineAds
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching inline ads',
            error: error.message
        });
    }
};

// Get inline ad by position
exports.getInlineAdByPosition = async (req, res) => {
    try {
        const { positionId } = req.params;
        
        const inlineAd = await InlineAdConfig.findOne({ positionId });
        
        if (!inlineAd) {
            return res.status(404).json({
                success: false,
                message: 'No configuration found for this position'
            });
        }
        
        res.json({
            success: true,
            data: inlineAd
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching inline ad',
            error: error.message
        });
    }
};

// Update inline ad
exports.updateInlineAd = async (req, res) => {
    try {
        const { positionId } = req.params;
        
        const inlineAd = await InlineAdConfig.findOneAndUpdate(
            { positionId },
            { ...req.body, updatedAt: Date.now() },
            { new: true, upsert: true, runValidators: true }
        );
        
        await AdminLog.create({
            admin: req.admin._id,
            action: 'UPDATE_INLINE_AD',
            details: `Updated inline ad for position: ${inlineAd.positionName}`,
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Inline ad updated successfully',
            data: inlineAd
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating inline ad',
            error: error.message
        });
    }
};

// Toggle inline ad status
exports.toggleInlineAd = async (req, res) => {
    try {
        const { positionId } = req.params;
        
        const inlineAd = await InlineAdConfig.findOne({ positionId });
        
        if (!inlineAd) {
            return res.status(404).json({
                success: false,
                message: 'Inline ad not found'
            });
        }
        
        inlineAd.status = !inlineAd.status;
        await inlineAd.save();
        
        res.json({
            success: true,
            message: `Inline ad ${inlineAd.status ? 'enabled' : 'disabled'} successfully`,
            data: { status: inlineAd.status }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error toggling inline ad',
            error: error.message
        });
    }
};

// Get inline ad metrics
exports.getInlineAdMetrics = async (req, res) => {
    try {
        const { positionId } = req.params;
        
        const inlineAd = await InlineAdConfig.findOne({ positionId });
        
        if (!inlineAd) {
            return res.status(404).json({
                success: false,
                message: 'Inline ad not found'
            });
        }
        
        const ctr = inlineAd.metrics.impressions > 0 
            ? (inlineAd.metrics.clicks / inlineAd.metrics.impressions * 100).toFixed(2)
            : 0;
        
        res.json({
            success: true,
            data: {
                ...inlineAd.metrics.toObject(),
                ctr,
                positionName: inlineAd.positionName,
                status: inlineAd.status
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching metrics',
            error: error.message
        });
    }
};

// Get inline ad performance
exports.getInlineAdPerformance = async (req, res) => {
    try {
        const performance = await InlineAdConfig.aggregate([
            {
                $match: { status: true }
            },
            {
                $project: {
                    positionName: 1,
                    positionId: 1,
                    impressions: '$metrics.impressions',
                    clicks: '$metrics.clicks',
                    revenue: '$metrics.revenue',
                    ctr: {
                        $cond: [
                            { $gt: ['$metrics.impressions', 0] },
                            { $multiply: [{ $divide: ['$metrics.clicks', '$metrics.impressions'] }, 100] },
                            0
                        ]
                    },
                    viewabilityScore: '$metrics.viewabilityScore'
                }
            },
            {
                $sort: { impressions: -1 }
            }
        ]);
        
        res.json({
            success: true,
            data: performance
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching performance data',
            error: error.message
        });
    }
};

// Serve inline ad (public)
exports.serveInlineAd = async (req, res) => {
    try {
        const { positionId, itemIndex } = req.params;
        
        const inlineAd = await InlineAdConfig.findOne({ 
            positionId,
            status: true 
        });
        
        if (!inlineAd) {
            return res.status(404).json({
                success: false,
                message: 'No active ad for this position'
            });
        }
        
        // Check if we should show ad based on frequency
        const shouldShow = itemIndex % inlineAd.displayFrequency === 0;
        
        if (!shouldShow) {
            return res.status(204).send();
        }
        
        res.json({
            success: true,
            data: {
                positionId: inlineAd.positionId,
                adCode: inlineAd.adCode,
                type: 'inline'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error serving inline ad',
            error: error.message
        });
    }
};