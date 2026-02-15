const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const CPAOfferSchema = new mongoose.Schema({
  offerId: {
    type: String,
    unique: true,
    default: () => `CPA-${uuidv4().substring(0, 8).toUpperCase()}`
  },
  network: {
    type: String,
    required: true,
    enum: ['CPAGrip', 'CPALead', 'Adworkmedia', 'OGAds', 'Offertoro', 'AdGate Media', 'KiwiWall', 'Ayet Studios', 'Toro', 'Persona.ly']
  },
  networkOfferId: {
    type: String,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  reward: {
    type: Number,
    required: true,
    min: 100
  },
  payout: {
    type: Number,
    required: true,
    min: 0.01
  },
  profit: {
    type: Number,
    default: function() {
      return this.payout - (this.reward / 5000);
    }
  },
  offerType: {
    type: String,
    enum: ['app_install', 'survey', 'signup', 'cpi', 'cpl', 'cpa', 'email_submit', 'video_watch'],
    default: 'cpa'
  },
  deviceType: {
    type: String,
    enum: ['android', 'ios', 'both', 'desktop'],
    default: 'both'
  },
  countries: [{
    type: String,
    uppercase: true,
    default: ['WW']
  }],
  countriesBlacklist: [{
    type: String,
    uppercase: true
  }],
  requirements: {
    type: String,
    trim: true
  },
  instructions: {
    type: String,
    trim: true
  },
  previewUrl: {
    type: String,
    trim: true
  },
  offerwallUrl: {
    type: String,
    trim: true
  },
  trackingUrl: {
    type: String,
    trim: true
  },
  conversionUrl: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'expired'],
    default: 'active'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  totalClicks: {
    type: Number,
    default: 0
  },
  totalConversions: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  conversionRate: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CPAOffer', CPAOfferSchema);