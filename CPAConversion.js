const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const CPAConversionSchema = new mongoose.Schema({
  conversionId: {
    type: String,
    unique: true,
    default: () => `CONV-${uuidv4().substring(0, 8).toUpperCase()}`
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  offerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CPAOffer',
    required: true
  },
  network: {
    type: String,
    required: true
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  payout: {
    type: Number,
    required: true,
    min: 0
  },
  reward: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'paid'],
    default: 'pending'
  },
  clickId: {
    type: String,
    trim: true
  },
  ip: {
    type: String
  },
  country: {
    type: String,
    uppercase: true
  },
  device: {
    type: String
  },
  os: {
    type: String
  },
  browser: {
    type: String
  },
  conversionDate: {
    type: Date,
    default: Date.now
  },
  approvalDate: {
    type: Date
  },
  fraudScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  isFraud: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CPAConversion', CPAConversionSchema);