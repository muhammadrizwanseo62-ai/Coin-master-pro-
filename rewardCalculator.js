/**
 * Reward Calculator Utility
 * Calculates optimal rewards, profit margins, dynamic pricing
 */

class RewardCalculator {
    
    constructor() {
        // Coin to USD conversion (5000 coins = $1)
        this.COIN_TO_USD_RATE = 5000;
        
        // Default profit margins
        this.DEFAULT_MARGINS = {
            conservative: 0.40, // 40% profit
            balanced: 0.30,     // 30% profit
            aggressive: 0.20,   // 20% profit
            highVolume: 0.10    // 10% profit
        };
        
        // Market rates by category
        this.MARKET_RATES = {
            crypto: 0.80,       // $0.80 average payout
            social_media: 0.30, // $0.30 average payout
            app_install: 0.50,  // $0.50 average payout
            survey: 0.75,       // $0.75 average payout
            signup: 1.00,       // $1.00 average payout
            website_visit: 0.15, // $0.15 average payout
            youtube: 0.25,      // $0.25 average payout
            instagram: 0.20,    // $0.20 average payout
            telegram: 0.10,     // $0.10 average payout
            other: 0.50        // $0.50 average payout
        };
        
        // Geo multipliers
        this.GEO_MULTIPLIERS = {
            'US': 1.00,
            'UK': 0.95,
            'CA': 0.90,
            'AU': 0.85,
            'DE': 0.80,
            'FR': 0.80,
            'JP': 0.90,
            'WW': 0.70
        };
    }

    /**
     * Calculate optimal reward based on payout
     */
    calculateOptimalReward(payoutUSD, category = 'other', country = 'WW', strategy = 'balanced') {
        try {
            const margin = this.DEFAULT_MARGINS[strategy] || 0.30;
            const geoMultiplier = this.GEO_MULTIPLIERS[country] || 0.70;
            const categoryMultiplier = this.getCategoryMultiplier(category);
            
            // Base reward calculation
            let rewardUSD = payoutUSD * (1 - margin) * geoMultiplier * categoryMultiplier;
            
            // Ensure minimum reward
            rewardUSD = Math.max(rewardUSD, 0.01);
            
            // Convert to coins
            const rewardCoins = Math.floor(rewardUSD * this.COIN_TO_USD_RATE);
            
            // Calculate profit
            const profitUSD = payoutUSD - rewardUSD;
            const profitMargin = (profitUSD / payoutUSD) * 100;
            
            return {
                payoutUSD: parseFloat(payoutUSD.toFixed(2)),
                rewardUSD: parseFloat(rewardUSD.toFixed(2)),
                rewardCoins,
                profitUSD: parseFloat(profitUSD.toFixed(2)),
                profitMargin: parseFloat(profitMargin.toFixed(2)),
                strategy,
                category,
                country,
                multipliers: {
                    geo: geoMultiplier,
                    category: categoryMultiplier,
                    margin: 1 - margin
                }
            };
        } catch (error) {
            console.error('Optimal reward calculation error:', error);
            return {
                payoutUSD,
                rewardCoins: Math.floor(payoutUSD * this.COIN_TO_USD_RATE * 0.7),
                rewardUSD: parseFloat((payoutUSD * 0.7).toFixed(2)),
                profitUSD: parseFloat((payoutUSD * 0.3).toFixed(2)),
                profitMargin: 30,
                strategy: 'fallback'
            };
        }
    }

    /**
     * Get category multiplier based on market rates
     */
    getCategoryMultiplier(category) {
        const marketRate = this.MARKET_RATES[category] || 0.50;
        const baseRate = 0.50; // Base rate for comparison
        return marketRate / baseRate;
    }

    /**
     * Calculate admin profit
     */
    calculateAdminProfit(payoutUSD, rewardCoins) {
        try {
            const rewardUSD = rewardCoins / this.COIN_TO_USD_RATE;
            const profitUSD = payoutUSD - rewardUSD;
            const profitMargin = payoutUSD > 0 ? (profitUSD / payoutUSD) * 100 : 0;
            
            return {
                payoutUSD: parseFloat(payoutUSD.toFixed(2)),
                rewardUSD: parseFloat(rewardUSD.toFixed(2)),
                rewardCoins,
                profitUSD: parseFloat(profitUSD.toFixed(2)),
                profitMargin: parseFloat(profitMargin.toFixed(2)),
                isProfitable: profitUSD > 0,
                breakEven: profitUSD === 0,
                loss: profitUSD < 0
            };
        } catch (error) {
            console.error('Profit calculation error:', error);
            return {
                payoutUSD,
                rewardCoins,
                profitUSD: 0,
                profitMargin: 0,
                error: error.message
            };
        }
    }

    /**
     * Suggest price point based on competitive analysis
     */
    suggestPricePoint(task) {
        try {
            const suggestions = [];
            const { category, countries, payoutUSD } = task;
            
            // Conservative strategy (40% profit)
            suggestions.push(this.calculateOptimalReward(
                payoutUSD, 
                category, 
                countries[0] || 'WW',
                'conservative'
            ));
            
            // Balanced strategy (30% profit)
            suggestions.push(this.calculateOptimalReward(
                payoutUSD, 
                category, 
                countries[0] || 'WW',
                'balanced'
            ));
            
            // Aggressive strategy (20% profit)
            suggestions.push(this.calculateOptimalReward(
                payoutUSD, 
                category, 
                countries[0] || 'WW',
                'aggressive'
            ));
            
            // High volume strategy (10% profit)
            suggestions.push(this.calculateOptimalReward(
                payoutUSD, 
                category, 
                countries[0] || 'WW',
                'highVolume'
            ));
            
            // Add recommended based on category
            const recommended = suggestions.find(s => s.strategy === 'balanced');
            
            return {
                success: true,
                suggestions: suggestions.sort((a, b) => b.profitMargin - a.profitMargin),
                recommended,
                category: this.MARKET_RATES[category] || 0.50,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Price suggestion error:', error);
            return {
                success: false,
                suggestions: [],
                error: error.message
            };
        }
    }

    /**
     * Dynamic pricing based on demand and competition
     */
    dynamicPricing(basePrice, demandFactor = 1, competitionFactor = 1) {
        try {
            // Demand factors
            const demandMultipliers = {
                veryHigh: 1.3,  // +30% price
                high: 1.15,      // +15% price
                normal: 1.0,     // base price
                low: 0.9,        // -10% price
                veryLow: 0.8     // -20% price
            };
            
            // Competition factors
            const competitionMultipliers = {
                veryHigh: 0.7,   // -30% price (race to bottom)
                high: 0.85,      // -15% price
                normal: 1.0,     // base price
                low: 1.1,        // +10% price
                veryLow: 1.2     // +20% price
            };
            
            // Get demand level
            let demandLevel = 'normal';
            if (demandFactor >= 1.5) demandLevel = 'veryHigh';
            else if (demandFactor >= 1.2) demandLevel = 'high';
            else if (demandFactor <= 0.7) demandLevel = 'veryLow';
            else if (demandFactor <= 0.9) demandLevel = 'low';
            
            // Get competition level
            let competitionLevel = 'normal';
            if (competitionFactor >= 1.5) competitionLevel = 'veryHigh';
            else if (competitionFactor >= 1.2) competitionLevel = 'high';
            else if (competitionFactor <= 0.7) competitionLevel = 'veryLow';
            else if (competitionFactor <= 0.9) competitionLevel = 'low';
            
            const demandMultiplier = demandMultipliers[demandLevel];
            const competitionMultiplier = competitionMultipliers[competitionLevel];
            
            // Calculate dynamic price
            let dynamicPrice = basePrice * demandMultiplier * competitionMultiplier;
            
            // Ensure minimum price
            dynamicPrice = Math.max(dynamicPrice, 0.01);
            
            return {
                success: true,
                basePrice: parseFloat(basePrice.toFixed(2)),
                dynamicPrice: parseFloat(dynamicPrice.toFixed(2)),
                priceChange: parseFloat(((dynamicPrice - basePrice) / basePrice * 100).toFixed(2)),
                demandLevel,
                demandMultiplier,
                competitionLevel,
                competitionMultiplier,
                recommendation: dynamicPrice < basePrice ? 'reduce' : 'increase',
                confidence: this.calculateConfidence(demandFactor, competitionFactor),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Dynamic pricing error:', error);
            return {
                success: false,
                dynamicPrice: basePrice,
                error: error.message
            };
        }
    }

    /**
     * Calculate confidence score for pricing
     */
    calculateConfidence(demandFactor, competitionFactor) {
        let confidence = 85; // Base confidence
        
        // Adjust based on data quality
        if (demandFactor < 0.1) confidence -= 20;
        if (competitionFactor < 0.1) confidence -= 20;
        
        // More data = higher confidence
        if (demandFactor > 1 && competitionFactor > 1) confidence += 10;
        
        return Math.min(Math.max(confidence, 0), 100);
    }

    /**
     * Calculate bulk discount
     */
    calculateBulkDiscount(baseReward, quantity) {
        try {
            let discountMultiplier = 1;
            
            if (quantity >= 1000) discountMultiplier = 0.7;  // 30% discount
            else if (quantity >= 500) discountMultiplier = 0.8;  // 20% discount
            else if (quantity >= 100) discountMultiplier = 0.85; // 15% discount
            else if (quantity >= 50) discountMultiplier = 0.9;   // 10% discount
            else if (quantity >= 25) discountMultiplier = 0.95;  // 5% discount
            else if (quantity >= 10) discountMultiplier = 0.98;  // 2% discount
            
            const discountedReward = Math.floor(baseReward * discountMultiplier);
            const savings = baseReward - discountedReward;
            
            return {
                success: true,
                baseReward,
                quantity,
                discountMultiplier,
                discountPercent: (1 - discountMultiplier) * 100,
                discountedReward,
                savings,
                savingsUSD: parseFloat((savings / this.COIN_TO_USD_RATE).toFixed(2)),
                totalReward: discountedReward * quantity,
                totalRewardUSD: parseFloat((discountedReward * quantity / this.COIN_TO_USD_RATE).toFixed(2))
            };
        } catch (error) {
            console.error('Bulk discount calculation error:', error);
            return {
                success: false,
                discountedReward: baseReward,
                error: error.message
            };
        }
    }

    /**
     * Calculate ROI
     */
    calculateROI(investment, return_) {
        try {
            const profit = return_ - investment;
            const roi = (profit / investment) * 100;
            const roiMultiplier = return_ / investment;
            
            return {
                success: true,
                investment: parseFloat(investment.toFixed(2)),
                return: parseFloat(return_.toFixed(2)),
                profit: parseFloat(profit.toFixed(2)),
                roi: parseFloat(roi.toFixed(2)),
                roiMultiplier: parseFloat(roiMultiplier.toFixed(2)),
                isProfitable: profit > 0,
                breakEven: Math.abs(profit) < 0.01,
                paybackPeriod: profit > 0 ? parseFloat((investment / profit).toFixed(2)) : null
            };
        } catch (error) {
            console.error('ROI calculation error:', error);
            return {
                success: false,
                roi: 0,
                error: error.message
            };
        }
    }

    /**
     * Convert coins to USD
     */
    coinsToUSD(coins) {
        return parseFloat((coins / this.COIN_TO_USD_RATE).toFixed(2));
    }

    /**
     * Convert USD to coins
     */
    usdToCoins(usd) {
        return Math.floor(usd * this.COIN_TO_USD_RATE);
    }

    /**
     * Get profit breakdown by country
     */
    getProfitBreakdown(payoutUSD, rewardCoins) {
        const breakdown = {};
        
        for (const [country, multiplier] of Object.entries(this.GEO_MULTIPLIERS)) {
            const adjustedPayout = payoutUSD * multiplier;
            const rewardUSD = rewardCoins / this.COIN_TO_USD_RATE;
            const profitUSD = adjustedPayout - rewardUSD;
            const profitMargin = adjustedPayout > 0 ? (profitUSD / adjustedPayout) * 100 : 0;
            
            breakdown[country] = {
                payoutUSD: parseFloat(adjustedPayout.toFixed(2)),
                rewardUSD: parseFloat(rewardUSD.toFixed(2)),
                profitUSD: parseFloat(profitUSD.toFixed(2)),
                profitMargin: parseFloat(profitMargin.toFixed(2)),
                multiplier,
                isProfitable: profitUSD > 0
            };
        }
        
        return {
            success: true,
            basePayoutUSD: payoutUSD,
            rewardCoins,
            rewardUSD: parseFloat((rewardCoins / this.COIN_TO_USD_RATE).toFixed(2)),
            breakdown,
            profitableCountries: Object.entries(breakdown)
                .filter(([_, data]) => data.isProfitable)
                .map(([country]) => country),
            unprofitableCountries: Object.entries(breakdown)
                .filter(([_, data]) => !data.isProfitable)
                .map(([country]) => country)
        };
    }

    /**
     * Format currency
     */
    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    /**
     * Format coins
     */
    formatCoins(coins) {
        return new Intl.NumberFormat('en-US').format(coins) + ' coins';
    }
}

module.exports = new RewardCalculator();