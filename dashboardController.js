const DailyStats = require('../models/DailyStats');
const Transaction = require('../models/Transaction');
const GameSession = require('../models/GameSession');
const User = require('../models/User');
const Ads = require('../models/Ads');

exports.getStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const [dailyStats, weeklyStats, monthlyStats, user] = await Promise.all([
      DailyStats.findOne({ userId, date: today }),
      DailyStats.find({ 
        userId, 
        date: { $gte: weekAgo } 
      }).sort({ date: -1 }),
      DailyStats.find({ 
        userId, 
        date: { $gte: monthAgo } 
      }),
      User.findById(userId)
    ]);

    const totalGames = await GameSession.countDocuments({ userId });
    const totalEarnings = await Transaction.aggregate([
      { $match: { userId: user._id, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const todayAds = await Ads.countDocuments({
      userId,
      watchedAt: { $gte: today }
    });

    res.json({
      success: true,
      stats: {
        balance: user.balance,
        totalEarned: totalEarnings[0]?.total || 0,
        totalGames,
        referralCode: user.referralCode,
        referralCount: user.referrals.length,
        today: {
          gamesPlayed: dailyStats?.gamesPlayed || 0,
          totalTaps: dailyStats?.totalTaps || 0,
          coinsEarned: dailyStats?.coinsEarned || 0,
          adsWatched: todayAds,
          loginBonus: dailyStats?.loginBonus || false,
          loginStreak: dailyStats?.loginStreak || 0
        },
        weekly: weeklyStats,
        monthly: monthlyStats
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

exports.getChartData = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'week' } = req.query;

    let startDate = new Date();
    let groupFormat;

    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        groupFormat = '%Y-%m-%d';
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        groupFormat = '%Y-%m-%d';
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        groupFormat = '%Y-%m';
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
        groupFormat = '%Y-%m-%d';
    }

    const earningsData = await Transaction.aggregate([
      {
        $match: {
          userId: user._id,
          createdAt: { $gte: startDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
          total: { $sum: '$amount' },
          games: {
            $sum: { $cond: [{ $eq: ['$type', 'game'] }, '$amount', 0] }
          },
          ads: {
            $sum: { $cond: [{ $eq: ['$type', 'ad'] }, '$amount', 0] }
          },
          bonuses: {
            $sum: { $cond: [{ $in: ['$type', ['login_bonus', 'referral']] }, '$amount', 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      period,
      data: earningsData
    });
  } catch (error) {
    console.error('Get chart error:', error);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const { timeframe = 'all', limit = 100 } = req.query;

    let dateFilter = {};
    if (timeframe === 'daily') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: today } };
    } else if (timeframe === 'weekly') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { createdAt: { $gte: weekAgo } };
    }

    const leaderboard = await Transaction.aggregate([
      { $match: { ...dateFilter, status: 'completed' } },
      {
        $group: {
          _id: '$userId',
          totalEarned: { $sum: '$amount' },
          gamesPlayed: {
            $sum: { $cond: [{ $eq: ['$type', 'game'] }, 1, 0] }
          },
          adsWatched: {
            $sum: { $cond: [{ $eq: ['$type', 'ad'] }, 1, 0] }
          }
        }
      },
      { $sort: { totalEarned: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          username: '$user.username',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          totalEarned: 1,
          gamesPlayed: 1,
          adsWatched: 1
        }
      }
    ]);

    res.json({
      success: true,
      timeframe,
      leaderboard
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
};

exports.claimDailyBonus = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dailyStats = await DailyStats.findOne({ userId, date: today });
    
    if (dailyStats && dailyStats.loginBonus) {
      return res.status(400).json({ error: 'Daily bonus already claimed today' });
    }

    if (!dailyStats) {
      dailyStats = new DailyStats({ userId, date: today });
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStats = await DailyStats.findOne({ userId, date: yesterday });
    
    let streak = yesterdayStats?.loginBonus ? (yesterdayStats.loginStreak || 0) + 1 : 1;
    streak = Math.min(streak, 7);
    
    dailyStats.loginStreak = streak;
    dailyStats.loginBonus = true;

    const bonusAmounts = [50, 60, 70, 80, 90, 100, 100];
    const bonusAmount = bonusAmounts[streak - 1];

    const user = await User.findById(userId);
    user.balance += bonusAmount;
    await user.save();

    const transaction = new Transaction({
      userId,
      transactionId: uuidv4(),
      type: 'login_bonus',
      amount: bonusAmount,
      balance: user.balance,
      description: `Day ${streak} login bonus (${bonusAmount} coins)`,
      metadata: { streak }
    });
    await transaction.save();

    dailyStats.coinsEarned += bonusAmount;
    await dailyStats.save();

    res.json({
      success: true,
      streak,
      bonusAmount,
      newBalance: user.balance
    });
  } catch (error) {
    console.error('Claim daily bonus error:', error);
    res.status(500).json({ error: 'Failed to claim daily bonus' });
  }
};

exports.getReferralStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate('referrals', 'username firstName lastName createdAt');

    const referralEarnings = await Transaction.aggregate([
      {
        $match: {
          userId: user._id,
          type: 'referral',
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      referralCode: user.referralCode,
      totalReferrals: user.referrals.length,
      totalEarned: referralEarnings[0]?.total || 0,
      referrals: user.referrals
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({ error: 'Failed to fetch referral stats' });
  }
};