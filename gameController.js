const GameSession = require('../models/GameSession');
const Transaction = require('../models/Transaction');
const DailyStats = require('../models/DailyStats');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const { validateTapRate, generateScreenshotHash } = require('../utils/gameLogic');
const { calculateCoins } = require('../utils/coinCalculator');
const screenshotHandler = require('../utils/screenshotHandler');

const activeSessions = new Map();
const tapRateLimiter = new Map();

exports.startGame = async (req, res) => {
  try {
    const userId = req.user.id;
    const lastSession = await GameSession.findOne({ userId }).sort({ endTime: -1 });
    
    if (lastSession && lastSession.endTime) {
      const cooldownRemaining = 5 - (Date.now() - lastSession.endTime.getTime()) / 1000;
      if (cooldownRemaining > 0) {
        return res.status(429).json({ 
          error: 'Cooldown active', 
          cooldown: Math.ceil(cooldownRemaining) 
        });
      }
    }

    const sessionId = uuidv4();
    const gameSession = new GameSession({
      userId,
      sessionId,
      startTime: new Date()
    });

    await gameSession.save();
    activeSessions.set(sessionId, { taps: 0, lastTapTime: Date.now() });

    res.status(201).json({
      success: true,
      sessionId,
      startTime: gameSession.startTime
    });
  } catch (error) {
    console.error('Start game error:', error);
    res.status(500).json({ error: 'Failed to start game' });
  }
};

exports.registerTap = async (req, res) => {
  try {
    const { sessionId, taps } = req.body;
    const userId = req.user.id;

    const session = await GameSession.findOne({ sessionId, userId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.endTime) {
      return res.status(400).json({ error: 'Game already ended' });
    }

    const elapsedSeconds = (Date.now() - session.startTime) / 1000;
    if (elapsedSeconds >= 60) {
      return res.status(400).json({ error: 'Game time expired' });
    }

    if (!validateTapRate(sessionId, tapRateLimiter)) {
      return res.status(429).json({ error: 'Tap rate limit exceeded' });
    }

    if (session.taps >= 100) {
      return res.status(400).json({ error: 'Maximum taps reached' });
    }

    const newTaps = Math.min(session.taps + 1, 100);
    session.taps = newTaps;
    session.score = newTaps;
    
    const coinsEarned = calculateCoins(newTaps);
    session.coinsEarned = coinsEarned;
    
    await session.save();

    res.json({
      success: true,
      taps: session.taps,
      score: session.score,
      coinsEarned: session.coinsEarned,
      remainingTaps: 100 - session.taps
    });
  } catch (error) {
    console.error('Tap registration error:', error);
    res.status(500).json({ error: 'Failed to register tap' });
  }
};

exports.endGame = async (req, res) => {
  try {
    const { sessionId, screenshot } = req.body;
    const userId = req.user.id;

    const session = await GameSession.findOne({ sessionId, userId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.endTime) {
      return res.status(400).json({ error: 'Game already ended' });
    }

    session.endTime = new Date();
    session.duration = Math.floor((session.endTime - session.startTime) / 1000);
    
    const screenshotUrl = await screenshotHandler.saveScreenshot(screenshot, sessionId, userId);
    session.screenshot = screenshotUrl;
    session.screenshotHash = generateScreenshotHash(screenshot);
    
    await session.save();

    const user = await User.findById(userId);
    user.balance += session.coinsEarned;
    await user.save();

    const transaction = new Transaction({
      userId,
      transactionId: uuidv4(),
      type: 'game',
      amount: session.coinsEarned,
      balance: user.balance,
      description: `Earned ${session.coinsEarned} coins from game (${session.taps} taps)`,
      metadata: { sessionId, taps: session.taps }
    });
    await transaction.save();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let dailyStats = await DailyStats.findOne({ userId, date: today });
    if (!dailyStats) {
      dailyStats = new DailyStats({ userId, date: today });
    }
    
    dailyStats.gamesPlayed += 1;
    dailyStats.totalTaps += session.taps;
    dailyStats.coinsEarned += session.coinsEarned;
    dailyStats.updatedAt = new Date();
    await dailyStats.save();

    activeSessions.delete(sessionId);
    tapRateLimiter.delete(sessionId);

    res.json({
      success: true,
      taps: session.taps,
      coinsEarned: session.coinsEarned,
      duration: session.duration,
      screenshot: session.screenshot
    });
  } catch (error) {
    console.error('End game error:', error);
    res.status(500).json({ error: 'Failed to end game' });
  }
};

exports.getGameHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const sessions = await GameSession.find({ userId })
      .sort({ endTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await GameSession.countDocuments({ userId });

    res.json({
      success: true,
      sessions,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to fetch game history' });
  }
};

exports.getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await GameSession.findOne({ sessionId, userId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true, session });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
};