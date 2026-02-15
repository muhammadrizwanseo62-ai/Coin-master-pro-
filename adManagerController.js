const AdConfig = require('../models/AdConfig');
const AdPerformance = require('../models/AdPerformance');
const AdminLog = require('../models/AdminLog');

// Create new ad
exports.createAd = async (req, res) => {
    try {
        const adData = {
            ...req.body,
            adId: 'ad_' + Date.now(),
            createdBy: req.admin._id
        };
        
        const ad = new AdConfig(adData);
        await ad.save();
        
        // Log admin action
        await AdminLog.create({
            admin: req.admin._id,
            action: 'CREATE_AD',
            details: `Created ad at position: ${adData.position}`,
            ip: req.ip
        });
        
        res.status(201).json({
            success: true,
            message: 'Ad created successfully',
            data: ad
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating ad',
            error: error.message
        });
    }
};

// Get all ads
exports.getAllAds = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, position } = req.query;
        const query = {};
        
        if (status) query.status = status === 'true';
        if (position) query.position = position;
        
        const ads = await AdConfig.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('createdBy', 'username');
            
        const total = await AdConfig.countDocuments(query);
        
        res.json({
            success: true,
            data: ads,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching ads',
            error: error.message
        });
    }
};

// Get ad by ID
exports.getAdById = async (req, res) => {
    try {
        const ad = await AdConfig.findById(req.params.id)
            .populate('createdBy', 'username');
            
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: 'Ad not found'
            });
        }
        
        res.json({
            success: true,
            data: ad
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching ad',
            error: error.message
        });
    }
};

// Update ad
exports.updateAd = async (req, res) => {
    try {
        const ad = await AdConfig.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: Date.now() },
            { new: true, runValidators: true }
        );
        
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: 'Ad not found'
            });
        }
        
        // Log admin action
        await AdminLog.create({
            admin: req.admin._id,
            action: 'UPDATE_AD',
            details: `Updated ad: ${ad.position}`,
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Ad updated successfully',
            data: ad
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating ad',
            error: error.message
        });
    }
};

// Delete ad
exports.deleteAd = async (req, res) => {
    try {
        const ad = await AdConfig.findByIdAndDelete(req.params.id);
        
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: 'Ad not found'
            });
        }
        
        // Log admin action
        await AdminLog.create({
            admin: req.admin._id,
            action: 'DELETE_AD',
            details: `Deleted ad: ${ad.position}`,
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Ad deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting ad',
            error: error.message
        });
    }
};

// Toggle ad status
exports.toggleAdStatus = async (req, res) => {
    try {
        const ad = await AdConfig.findById(req.params.id);
        
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: 'Ad not found'
            });
        }
        
        ad.status = !ad.status;
        await ad.save();
        
        res.json({
            success: true,
            message: `Ad ${ad.status ? 'enabled' : 'disabled'} successfully`,
            data: { status: ad.status }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error toggling ad status',
            error: error.message
        });
    }
};

// Get ad for position (public)
exports.getAdForPosition = async (req, res) => {
    try {
        const { position } = req.params;
        
        // Find active ad for position
        const ad = await AdConfig.findOne({
            position,
            status: true,
            $or: [
                { 'schedule.startDate': { $lte: new Date() } },
                { 'schedule.startDate': null }
            ],
            $or: [
                { 'schedule.endDate': { $gte: new Date() } },
                { 'schedule.endDate': null }
            ]
        });
        
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: 'No ad available for this position'
            });
        }
        
        // Check frequency (random based on percentage)
        const shouldShow = Math.random() * 100 <= ad.frequency;
        
        if (!shouldShow) {
            return res.status(204).send(); // No content
        }
        
        res.json({
            success: true,
            data: {
                adId: ad.adId,
                position: ad.position,
                network: ad.network,
                adCode: ad.adCode,
                type: ad.position.includes('inline') ? 'inline' : 'standard'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error serving ad',
            error: error.message
        });
    }
};

// Track impression
exports.trackImpression = async (req, res) => {
    try {
        const { adId } = req.params;
        
        const ad = await AdConfig.findOne({ adId });
        if (ad) {
            ad.metrics.impressions += 1;
            await ad.save();
            
            // Track in performance
            await AdPerformance.create({
                adId: ad._id,
                type: 'impression',
                timestamp: new Date(),
                userId: req.body.userId,
                sessionId: req.body.sessionId
            });
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error tracking impression',
            error: error.message
        });
    }
};

// Track click
exports.trackClick = async (req, res) => {
    try {
        const { adId } = req.params;
        
        const ad = await AdConfig.findOne({ adId });
        if (ad) {
            ad.metrics.clicks += 1;
            await ad.save();
            
            // Track in performance
            await AdPerformance.create({
                adId: ad._id,
                type: 'click',
                timestamp: new Date(),
                userId: req.body.userId,
                sessionId: req.body.sessionId
            });
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error tracking click',
            error: error.message
        });
    }
};

// Get analytics overview
exports.getAnalyticsOverview = async (req, res) => {
    try {
        const { timeframe = '7days' } = req.query;
        
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        
        switch(timeframe) {
            case 'today':
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'yesterday':
                startDate.setDate(startDate.getDate() - 1);
                startDate.setHours(0, 0, 0, 0);
                endDate.setDate(endDate.getDate() - 1);
                endDate.setHours(23, 59, 59, 999);
                break;
            case '7days':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30days':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case 'thisMonth':
                startDate.setDate(1);
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'lastMonth':
                startDate.setMonth(startDate.getMonth() - 1, 1);
                startDate.setHours(0, 0, 0, 0);
                endDate.setMonth(endDate.getMonth(), 0);
                endDate.setHours(23, 59, 59, 999);
                break;
        }
        
        // Aggregate data
        const overview = await AdConfig.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalImpressions: { $sum: '$metrics.impressions' },
                    totalClicks: { $sum: '$metrics.clicks' },
                    totalRevenue: { $sum: '$metrics.revenue' },
                    activeAds: { $sum: { $cond: ['$status', 1, 0] } }
                }
            }
        ]);
        
        const data = overview[0] || {
            totalImpressions: 0,
            totalClicks: 0,
            totalRevenue: 0,
            activeAds: 0
        };
        
        data.avgCTR = data.totalImpressions > 0 
            ? (data.totalClicks / data.totalImpressions * 100).toFixed(2)
            : 0;
        
        res.json({
            success: true,
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching analytics',
            error: error.message
        });
    }
};

// Get performance data for charts
exports.getPerformanceData = async (req, res) => {
    try {
        const { days = 7 } = req.query;
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const performance = await AdPerformance.aggregate([
            {
                $match: {
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                        type: '$type'
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: '$_id.date',
                    data: {
                        $push: {
                            type: '$_id.type',
                            count: '$count'
                        }
                    }
                }
            },
            {
                $sort: { '_id': 1 }
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

// Get revenue data
exports.getRevenueData = async (req, res) => {
    try {
        const revenue = await AdConfig.aggregate([
            {
                $group: {
                    _id: '$position',
                    totalRevenue: { $sum: '$metrics.revenue' },
                    totalImpressions: { $sum: '$metrics.impressions' },
                    totalClicks: { $sum: '$metrics.clicks' }
                }
            },
            {
                $sort: { totalRevenue: -1 }
            }
        ]);
        
        res.json({
            success: true,
            data: revenue
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching revenue data',
            error: error.message
        });
    }
};