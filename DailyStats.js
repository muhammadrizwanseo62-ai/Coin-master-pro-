const mongoose = require('mongoose');

const DailyStatsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    default: () => new Date().setHours(0, 0, 0, 0)
  },
  gamesPlayed: {
    type: Number,
    default: 0,
    min: 0
  },
  totalTaps: {
    type: Number,
    default: 0,
    min: 0
  },
  coinsEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  adsWatched: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  loginBonus: {
    type: Boolean,
    default: false
  },
  loginStreak: {
    type: Number,
    default: 0,
    min: 0,
    max: 7
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

DailyStatsSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyStats', DailyStatsSchema);