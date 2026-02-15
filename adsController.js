const Ads = require('../models/Ads');
const Transaction = require('../models/Transaction');
const DailyStats = require('../models/DailyStats');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');

const adWatchHistory = new Map();

exports.watchAd = async (req, res) => {
  try {
    const userId = req.user.id;
    const { adType = 'rewarded' } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayAds = await Ads.countDocuments({
      userId,
      watchedAt: { $gte: today }
    });

    if (todayAds >= 10) {
      return res.status(429).json({ error: 'Maximum ads watched today' });
    }

    const lastAd = await Ads.findOne({ userId }).sort({ watchedAt: -1 });
    if (lastAd) {
      const cooldownRemaining = 120 - (Date.now() - lastAd.watchedAt.getTime()) / 1000;
      if (cooldownRemaining > 0) {
        return res.status(429).json({ 
          error: 'Ad cooldown active', 
          cooldown: Math.ceil(cooldownRemaining) 
        });
      }
    }

    const adId = uuidv4();
    const adReward = 25;

    const ad = new Ads({
      userId,
      adId,
      adType,
      reward: adReward,
      watchedAt: new Date(),
      completed: true,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    await ad.save();

    const user = await User.findById(userId);
    user.balance += adReward;
    await user.save();

    const transaction = new Transaction({
      userId,
      transactionId: uuidv4(),
      type: 'ad',
      amount: adReward,
      balance: user.balance,
      description: `Earned ${adReward} coins from watching ad`,
      metadata: { adId, adType }
    });
    await transaction.save();

    let dailyStats = await DailyStats.findOne({ userId, date: today });
    if (!dailyStats) {
      dailyStats = new DailyStats({ userId, date: today });
    }
    
    dailyStats.adsWatched += 1;
    dailyStats.coinsEarned += adReward;
    dailyStats.updatedAt = new Date();
    await dailyStats.save();

    const remainingAds = 10 - (todayAds + 1);

    res.json({
      success: true,
      reward: adReward,
      newBalance: user.balance,
      remainingAds,
      nextAdIn: 120
    });
  } catch (error) {
    console.error('Watch ad error:', error);
    res.status(500).json({ error: 'Failed to process ad watch' });
  }
};

exports.getAdStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayAds, lastAd] = await Promise.all([
      Ads.countDocuments({ userId, watchedAt: { $gte: today } }),
      Ads.findOne({ userId }).sort({ watchedAt: -1 })
    ]);

    let cooldown = 0;
    if (lastAd) {
      cooldown = Math.max(0, 120 - (Date.now() - lastAd.watchedAt.getTime()) / 1000);
    }

    res.json({
      success: true,
      status: {
        adsWatchedToday: todayAds,
        remainingAds: 10 - todayAds,
        cooldown: Math.ceil(cooldown),
        canWatch: todayAds < 10 && cooldown <= 0,
        reward: 25
      }
    });
  } catch (error) {
    console.error('Get ad status error:', error);
    res.status(500).json({ error: 'Failed to fetch ad status' });
  }
};

exports.getAdHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const ads = await Ads.find({ userId })
      .sort({ watchedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Ads.countDocuments({ userId });

    res.json({
      success: true,
      ads,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Get ad history error:', error);
    res.status(500).json({ error: 'Failed to fetch ad history' });
  }
};

exports.claimReward = async (req, res) => {
  try {
    const userId = req.user.id;
    const { adId } = req.body;

    const ad = await Ads.findOne({ adId, userId });
    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    if (ad.reward !== 25) {
      return res.status(400).json({ error: 'Reward already claimed' });
    }

    res.json({
      success: true,
      message: 'Reward claimed successfully'
    });
  } catch (error) {
    console.error('Claim reward error:', error);
    res.status(500).json({ error: 'Failed to claim reward' });
  }
};