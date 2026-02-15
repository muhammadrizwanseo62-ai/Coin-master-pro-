const CPAOffer = require('../models/CPAOffer');
const CPAConversion = require('../models/CPAConversion');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const cpaFraud = require('../middleware/cpaFraud');

/**
 * Get offers filtered by user's geo location
 */
exports.getOffersByGeo = async (req, res) => {
  try {
    const userCountry = req.headers['cf-ipcountry'] || 
                       req.headers['x-country-code'] || 
                       req.query.country || 
                       'US';
    
    const offers = await CPAOffer.find({
      status: 'active',
      startDate: { $lte: new Date() },
      $or: [
        { endDate: { $gte: new Date() } },
        { endDate: null }
      ],
      $or: [
        { countries: 'WW' },
        { countries: userCountry },
        { countries: { $in: [userCountry] } }
      ],
      countriesBlacklist: { $nin: [userCountry] }
    }).limit(req.query.limit || 50);

    res.json({
      success: true,
      country: userCountry,
      count: offers.length,
      offers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch offers',
      error: error.message
    });
  }
};

/**
 * Track click and generate click ID
 */
exports.trackClick = async (req, res) => {
  try {
    const { offerId } = req.params;
    const userId = req.user?._id;
    
    const clickId = uuidv4();
    const offer = await CPAOffer.findById(offerId);
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    // Increment click count
    offer.totalClicks += 1;
    await offer.save();

    // Store click in session or database
    const clickData = {
      clickId,
      offerId,
      userId,
      timestamp: new Date(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      country: req.headers['cf-ipcountry'] || 'WW'
    };

    // You can store this in Redis or a Click model
    req.session.clickData = req.session.clickData || [];
    req.session.clickData.push(clickData);
    
    // Keep only last 10 clicks
    if (req.session.clickData.length > 10) {
      req.session.clickData.shift();
    }

    res.json({
      success: true,
      clickId,
      trackingUrl: offer.trackingUrl || offer.offerwallUrl || offer.previewUrl,
      offer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to track click',
      error: error.message
    });
  }
};

/**
 * Handle webhook from CPA network
 */
exports.handleWebhook = async (req, res) => {
  try {
    const {
      transactionId,
      offerId,
      userId,
      payout,
      clickId,
      country,
      device,
      os,
      browser
    } = req.body;

    // Validate conversion
    const validation = await exports.validateConversion(req.body);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Conversion validation failed',
        reasons: validation.reasons
      });
    }

    // Get offer details
    const offer = await CPAOffer.findById(offerId);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    // Calculate reward (5000 coins = $1)
    const reward = Math.floor(payout * 5000);

    // Create conversion record
    const conversion = new CPAConversion({
      conversionId: `CONV-${uuidv4().substring(0, 8).toUpperCase()}`,
      userId,
      offerId,
      network: offer.network,
      transactionId,
      payout,
      reward,
      status: 'pending',
      clickId,
      ip: req.ip,
      country: country || 'WW',
      device,
      os,
      browser,
      conversionDate: new Date()
    });

    await conversion.save();

    // Award reward if auto-approve
    if (process.env.AUTO_APPROVE_CONVERSIONS === 'true') {
      await exports.awardReward(conversion._id);
    }

    // Calculate admin profit
    const profit = await exports.calculateProfit(conversion._id);

    res.json({
      success: true,
      message: 'Conversion recorded successfully',
      conversionId: conversion.conversionId,
      status: conversion.status,
      reward,
      profit
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process webhook',
      error: error.message
    });
  }
};

/**
 * Validate conversion for fraud
 */
exports.validateConversion = async (conversionData) => {
  try {
    const reasons = [];
    let valid = true;

    // Check IP duplication
    const ipCheck = await cpaFraud.checkIPDuplication(conversionData);
    if (!ipCheck.valid) {
      valid = false;
      reasons.push(...ipCheck.reasons);
    }

    // Check device fingerprint
    const deviceCheck = await cpaFraud.checkDeviceFingerprint(conversionData);
    if (!deviceCheck.valid) {
      valid = false;
      reasons.push(...deviceCheck.reasons);
    }

    // Check VPN/Proxy
    const vpnCheck = await cpaFraud.checkVPNProxy(conversionData);
    if (!vpnCheck.valid) {
      valid = false;
      reasons.push(...vpnCheck.reasons);
    }

    // Check same user multiple accounts
    const userCheck = await cpaFraud.checkSameUserMultipleAccounts(conversionData);
    if (!userCheck.valid) {
      valid = false;
      reasons.push(...userCheck.reasons);
    }

    // Check time between conversions
    const timeCheck = await cpaFraud.checkTimeBetweenConversions(conversionData);
    if (!timeCheck.valid) {
      valid = false;
      reasons.push(...timeCheck.reasons);
    }

    // Check geolocation mismatch
    const geoCheck = await cpaFraud.checkGeolocationMismatch(conversionData);
    if (!geoCheck.valid) {
      valid = false;
      reasons.push(...geoCheck.reasons);
    }

    return {
      valid,
      reasons,
      fraudScore: reasons.length * 20 // 0-100 scale
    };
  } catch (error) {
    console.error('Validation error:', error);
    return {
      valid: false,
      reasons: ['Validation process failed'],
      fraudScore: 100
    };
  }
};

/**
 * Award reward to user
 */
exports.awardReward = async (conversionId) => {
  try {
    const conversion = await CPAConversion.findById(conversionId);
    
    if (!conversion) {
      throw new Error('Conversion not found');
    }

    if (conversion.status !== 'pending') {
      throw new Error(`Conversion already ${conversion.status}`);
    }

    // Get user
    const user = await User.findById(conversion.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Award coins
    user.coins += conversion.reward;
    user.totalEarned += conversion.reward;
    await user.save();

    // Update conversion
    conversion.status = 'approved';
    conversion.approvalDate = new Date();
    await conversion.save();

    // Update offer stats
    const offer = await CPAOffer.findById(conversion.offerId);
    if (offer) {
      offer.totalConversions += 1;
      offer.totalRevenue += conversion.payout;
      offer.conversionRate = (offer.totalConversions / offer.totalClicks) * 100;
      await offer.save();
    }

    return {
      success: true,
      userId: user._id,
      coinsAdded: conversion.reward,
      newBalance: user.coins
    };
  } catch (error) {
    console.error('Award reward error:', error);
    throw error;
  }
};

/**
 * Calculate admin profit
 */
exports.calculateProfit = async (conversionId) => {
  try {
    const conversion = await CPAConversion.findById(conversionId).populate('offerId');
    
    if (!conversion) {
      throw new Error('Conversion not found');
    }

    const payout = conversion.payout;
    const reward = conversion.reward;
    const rewardUSD = reward / 5000;
    const profit = payout - rewardUSD;

    return {
      conversionId: conversion.conversionId,
      payoutUSD: payout,
      rewardUSD: parseFloat(rewardUSD.toFixed(2)),
      profitUSD: parseFloat(profit.toFixed(2)),
      profitMargin: ((profit / payout) * 100).toFixed(2) + '%'
    };
  } catch (error) {
    console.error('Profit calculation error:', error);
    throw error;
  }
};

/**
 * Get conversion by ID
 */
exports.getConversion = async (req, res) => {
  try {
    const conversion = await CPAConversion.findOne({ 
      conversionId: req.params.id 
    }).populate('offerId userId', 'username email title');

    if (!conversion) {
      return res.status(404).json({
        success: false,
        message: 'Conversion not found'
      });
    }

    res.json({
      success: true,
      conversion
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversion',
      error: error.message
    });
  }
};