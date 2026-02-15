const mongoose = require('mongoose');

const GameSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  taps: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  score: {
    type: Number,
    default: 0,
    min: 0
  },
  coinsEarned: {
    type: Number,
    default: 0,
    min: 0,
    max: 20
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number,
    default: 0
  },
  screenshot: {
    type: String,
    default: null
  },
  screenshotHash: {
    type: String,
    default: null
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'suspicious'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

GameSessionSchema.pre('save', function(next) {
  if (this.taps > 100) {
    this.taps = 100;
    this.score = 100;
    this.coinsEarned = 20;
  }
  if (this.endTime && this.startTime) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  next();
});

module.exports = mongoose.model('GameSession', GameSessionSchema);