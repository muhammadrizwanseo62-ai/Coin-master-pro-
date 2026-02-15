const mongoose = require('mongoose');

const AdsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  adId: {
    type: String,
    required: true,
    unique: true
  },
  adType: {
    type: String,
    enum: ['rewarded', 'interstitial'],
    default: 'rewarded'
  },
  reward: {
    type: Number,
    required: true,
    default: 25
  },
  watchedAt: {
    type: Date,
    default: Date.now
  },
  completed: {
    type: Boolean,
    default: true
  },
  ip: {
    type: String
  },
  userAgent: {
    type: String
  }
});

AdsSchema.index({ userId: 1, watchedAt: -1 });

module.exports = mongoose.model('Ads', AdsSchema);