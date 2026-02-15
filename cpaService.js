const axios = require('axios');
const CPAOffer = require('../models/CPAOffer');
const CPAConversion = require('../models/CPAConversion');
const cpaConfig = require('../config/cpa');

/**
 * CPA Service - Integration with 10+ CPA Networks
 * Note: This is a mock service - no actual API integration
 * Admin pastes iframe codes manually in admin panel
 */
class CPAService {
  constructor() {
    this.networks = cpaConfig.networks;
  }

  /**
   * Get offers by network (from database)
   */
  async getOffersByNetwork(networkName, country = 'WW') {
    try {
      const query = {
        network: networkName,
        status: 'active',
        $or: [
          { countries: 'WW' },
          { countries: country }
        ]
      };

      const offers = await CPAOffer.find(query)
        .sort({ payout: -1 })
        .limit(100);

      return offers;
    } catch (error) {
      console.error(`Error fetching offers from ${networkName}:`, error);
      return [];
    }
  }

  /**
   * Get all active offers
   */
  async getAllActiveOffers(country = 'WW') {
    try {
      const offers = await CPAOffer.find({
        status: 'active',
        $or: [
          { countries: 'WW' },
          { countries: country }
        ]
      }).sort({ payout: -1 });

      return offers;
    } catch (error) {
      console.error('Error fetching active offers:', error);
      return [];
    }
  }

  /**
   * Track click
   */
  async trackClick(offerId, userId, clickData) {
    try {
      const clickId = `CLICK-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      // Store click in database or cache
      const click = {
        clickId,
        offerId,
        userId,
        timestamp: new Date(),
        ip: clickData.ip,
        userAgent: clickData.userAgent,
        country: clickData.country || 'WW'
      };

      // Update offer click count
      await CPAOffer.findByIdAndUpdate(offerId, {
        $inc: { totalClicks: 1 }
      });

      return clickId;
    } catch (error) {
      console.error('Error tracking click:', error);
      throw error;
    }
  }

  /**
   * Process conversion webhook
   */
  async processConversion(conversionData) {
    try {
      const conversion = new CPAConversion({
        conversionId: `CONV-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        userId: conversionData.userId,
        offerId: conversionData.offerId,
        network: conversionData.network,
        transactionId: conversionData.transactionId,
        payout: conversionData.payout,
        reward: Math.floor(conversionData.payout * 5000),
        status: 'pending',
        clickId: conversionData.clickId,
        ip: conversionData.ip,
        country: conversionData.country,
        device: conversionData.device,
        os: conversionData.os,
        browser: conversionData.browser,
        conversionDate: new Date()
      });

      await conversion.save();

      return conversion;
    } catch (error) {
      console.error('Error processing conversion:', error);
      throw error;
    }
  }

  /**
   * Get network by name
   */
  getNetworkConfig(networkName) {
    return this.networks[networkName.toLowerCase()] || null;
  }

  /**
   * Calculate reward based on payout
   */
  calculateReward(payout, networkName) {
    const network = this.getNetworkConfig(networkName);
    const rate = network ? network.payoutRate : 0.75;
    return Math.floor(payout * 5000 * rate);
  }

  /**
   * Get supported countries for network
   */
  getNetworkCountries(networkName) {
    const network = this.getNetworkConfig(networkName);
    return network ? network.countries : ['WW'];
  }
}

module.exports = new CPAService();