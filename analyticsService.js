const AdPerformance = require('../models/AdPerformance');
const AdConfig = require('../models/AdConfig');
const InlineAdConfig = require('../models/InlineAdConfig');

class AnalyticsService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    // Track ad impression
    async trackImpression(adId, data = {}) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            let performance = await AdPerformance.findOne({
                adId,
                date: {
                    $gte: today,
                    $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                }
            });
            
            if (!performance) {
                performance = new AdPerformance({
                    adId,
                    date: today
                });
            }
            
            performance.impressions += 1;
            
            // Track device
            if (data.device) {
                performance.devices[data.device] += 1;
            }
            
            // Track country
            if (data.country) {
                const countryIndex = performance.countries.findIndex(c => c.code === data.country);
                if (countryIndex >= 0) {
                    performance.countries[countryIndex].impressions += 1;
                } else {
                    performance.countries.push({
                        code: data.country,
                        impressions: 1,
                        clicks: 0
                    });
                }
            }
            
            // Track hour
            const hour = new Date().getHours();
            const hourIndex = performance.hours.findIndex(h => h.hour === hour);
            if (hourIndex >= 0) {
                performance.hours[hourIndex].impressions += 1;
            } else {
                performance.hours.push({
                    hour,
                    impressions: 1,
                    clicks: 0
                });
            }
            
            await performance.save();
            
            // Update ad config
            await AdConfig.findByIdAndUpdate(adId, {
                $inc: { 'metrics.impressions': 1 }
            });
            
            // Invalidate cache
            this.invalidateCache(`ad_${adId}`);
        } catch (error) {
            console.error('Error tracking impression:', error);
        }
    }

    // Track ad click
    async trackClick(adId, data = {}) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            let performance = await AdPerformance.findOne({
                adId,
                date: {
                    $gte: today,
                    $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                }
            });
            
            if (!performance) {
                performance = new AdPerformance({
                    adId,
                    date: today
                });
            }
            
            performance.clicks += 1;
            
            // Track country
            if (data.country) {
                const countryIndex = performance.countries.findIndex(c => c.code === data.country);
                if (countryIndex >= 0) {
                    performance.countries[countryIndex].clicks += 1;
                }
            }
            
            // Track hour
            const hour = new Date().getHours();
            const hourIndex = performance.hours.findIndex(h => h.hour === hour);
            if (hourIndex >= 0) {
                performance.hours[hourIndex].clicks += 1;
            }
            
            await performance.save();
            
            // Update ad config
            await AdConfig.findByIdAndUpdate(adId, {
                $inc: { 'metrics.clicks': 1 }
            });
            
            // Invalidate cache
            this.invalidateCache(`ad_${adId}`);
        } catch (error) {
            console.error('Error tracking click:', error);
        }
    }

    // Track revenue
    async trackRevenue(adId, amount, data = {}) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            let performance = await AdPerformance.findOne({
                adId,
                date: {
                    $gte: today,
                    $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                }
            });
            
            if (!performance) {
                performance = new AdPerformance({
                    adId,
                    date: today
                });
            }
            
            performance.revenue += amount;
            await performance.save();
            
            // Update ad config
            await AdConfig.findByIdAndUpdate(adId, {
                $inc: { 'metrics.revenue': amount }
            });
            
            // Invalidate cache
            this.invalidateCache(`ad_${adId}`);
        } catch (error) {
            console.error('Error tracking revenue:', error);
        }
    }

    // Get ad performance
    async getAdPerformance(adId, startDate, endDate) {
        const cacheKey = `ad_${adId}_${startDate}_${endDate}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;
        
        const performance = await AdPerformance.getPerformance(adId, startDate, endDate);
        
        this.setCached(cacheKey, performance);
        return performance;
    }

    // Get overall analytics
    async getOverallAnalytics(startDate, endDate) {
        const cacheKey = `overall_${startDate}_${endDate}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;
        
        const pipeline = [
            {
                $match: {
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
        ];
        
        const result = await AdPerformance.aggregate(pipeline);
        const data = result[0] || {
            totalImpressions: 0,
            totalClicks: 0,
            totalRevenue: 0,
            avgCTR: 0,
            avgECPM: 0
        };
        
        this.setCached(cacheKey, data);
        return data;
    }

    // Get analytics by ad type
    async getAnalyticsByType(startDate, endDate) {
        const cacheKey = `byType_${startDate}_${endDate}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;
        
        const pipeline = [
            {
                $match: {
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $lookup: {
                    from: 'adconfigs',
                    localField: 'adId',
                    foreignField: '_id',
                    as: 'ad'
                }
            },
            {
                $unwind: '$ad'
            },
            {
                $group: {
                    _id: {
                        type: {
                            $cond: [
                                { $in: ['$ad.position', ['inline_task_feed', 'inline_referral_history', 'inline_transaction_history', 'inline_leaderboard', 'inline_offer_wall', 'inline_daily_bonus', 'inline_game_history', 'inline_notifications', 'inline_chat', 'inline_settings']] },
                                'inline',
                                '$ad.position'
                            ]
                        }
                    },
                    impressions: { $sum: '$impressions' },
                    clicks: { $sum: '$clicks' },
                    revenue: { $sum: '$revenue' }
                }
            }
        ];
        
        const data = await AdPerformance.aggregate(pipeline);
        
        this.setCached(cacheKey, data);
        return data;
    }

    // Get hourly breakdown
    async getHourlyBreakdown(adId, date) {
        const cacheKey = `hourly_${adId}_${date}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;
        
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        const performance = await AdPerformance.findOne({
            adId,
            date: { $gte: startOfDay, $lte: endOfDay }
        });
        
        const data = performance ? performance.hours : [];
        
        this.setCached(cacheKey, data);
        return data;
    }

    // Get country breakdown
    async getCountryBreakdown(adId, startDate, endDate) {
        const cacheKey = `country_${adId}_${startDate}_${endDate}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;
        
        const pipeline = [
            {
                $match: {
                    adId,
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $unwind: '$countries'
            },
            {
                $group: {
                    _id: '$countries.code',
                    impressions: { $sum: '$countries.impressions' },
                    clicks: { $sum: '$countries.clicks' }
                }
            },
            {
                $sort: { impressions: -1 }
            }
        ];
        
        const data = await AdPerformance.aggregate(pipeline);
        
        this.setCached(cacheKey, data);
        return data;
    }

    // Get top performing ads
    async getTopPerformingAds(limit = 10, startDate, endDate) {
        const cacheKey = `topAds_${startDate}_${endDate}_${limit}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;
        
        const pipeline = [
            {
                $match: {
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$adId',
                    totalImpressions: { $sum: '$impressions' },
                    totalClicks: { $sum: '$clicks' },
                    totalRevenue: { $sum: '$revenue' }
                }
            },
            {
                $lookup: {
                    from: 'adconfigs',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'ad'
                }
            },
            {
                $unwind: '$ad'
            },
            {
                $project: {
                    'ad.adCode': 0
                }
            },
            {
                $sort: { totalRevenue: -1 }
            },
            {
                $limit: limit
            }
        ];
        
        const data = await AdPerformance.aggregate(pipeline);
        
        this.setCached(cacheKey, data);
        return data;
    }

    // Generate report
    async generateReport(options = {}) {
        const {
            startDate,
            endDate,
            includeAds = true,
            includeInline = true,
            includeHourly = false,
            includeCountries = false
        } = options;
        
        const report = {
            generatedAt: new Date(),
            period: { startDate, endDate },
            summary: await this.getOverallAnalytics(startDate, endDate),
            byType: await this.getAnalyticsByType(startDate, endDate),
            topAds: await this.getTopPerformingAds(10, startDate, endDate)
        };
        
        if (includeHourly) {
            report.hourly = await this.getHourlyBreakdown(null, startDate, endDate);
        }
        
        if (includeCountries) {
            report.countries = await this.getCountryBreakdown(null, startDate, endDate);
        }
        
        return report;
    }

    // Cache management
    getCached(key) {
        if (this.cache.has(key)) {
            const { data, timestamp } = this.cache.get(key);
            if (Date.now() - timestamp < this.cacheTimeout) {
                return data;
            }
            this.cache.delete(key);
        }
        return null;
    }

    setCached(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    invalidateCache(pattern) {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    clearCache() {
        this.cache.clear();
    }
}

module.exports = new AnalyticsService();