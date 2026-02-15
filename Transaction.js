const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const transactionSchema = new mongoose.Schema({
  // ============ USER REFERENCE ============
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    index: true
  },
  
  // ============ TRANSACTION IDENTIFIERS ============
  transactionId: { 
    type: String, 
    unique: true, 
    required: true,
    default: () => 'TXN-' + uuidv4().substring(0, 12).toUpperCase()
  },
  
  // ============ TRANSACTION TYPE ============
  type: { 
    type: String, 
    enum: [
      'referral_bonus',      // 1500 coins for referring
      'signup_bonus',        // 500 coins for signing up
      'withdrawal',          // Withdrawal request
      'withdrawal_fee',      // 15% withdrawal fee
      'game_earning',        // Earnings from games
      'daily_bonus',         // Daily login bonus
      'badge_bonus',         // Achievement badges
      'admin_credit',        // Admin added funds
      'refund'               // Refunded amount
    ],
    required: true,
    index: true
  },
  
  // ============ AMOUNT DETAILS ============
  amount: { 
    type: Number, 
    required: true 
  },
  balance: { 
    type: Number, 
    required: true 
  },
  previousBalance: {
    type: Number,
    required: true
  },
  
  // ============ DESCRIPTION ============
  description: { 
    type: String, 
    required: true 
  },
  
  // ============ METADATA ============
  metadata: { 
    type: Object,
    default: {}
  },
  
  // ============ REFERENCE IDS ============
  referenceId: {
    type: String,  // Withdrawal ID, Game ID, etc.
    sparse: true
  },
  referralId: {
    type: String,  // Referred user ID
    sparse: true
  },
  
  // ============ STATUS ============
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'reversed'],
    default: 'completed'
  },
  
  // ============ TIMESTAMPS ============
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// ============ INDEXES ============
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ userId: 1, type: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ referralId: 1 });

// ============ STATIC METHODS ============
transactionSchema.statics.createReferralBonus = async function(userId, amount, balance, referrerUsername) {
  const transaction = new this({
    userId,
    type: 'referral_bonus',
    amount,
    previousBalance: balance - amount,
    balance,
    description: `🎁 Referral bonus: 1500 coins for inviting @${referrerUsername}`,
    metadata: {
      bonusAmount: 1500,
      referrerUsername
    }
  });
  return await transaction.save();
};

transactionSchema.statics.createSignupBonus = async function(userId, amount, balance) {
  const transaction = new this({
    userId,
    type: 'signup_bonus',
    amount,
    previousBalance: balance - amount,
    balance,
    description: '🎉 Welcome! 500 coins signup bonus',
    metadata: {
      bonusAmount: 500,
      type: 'signup'
    }
  });
  return await transaction.save();
};

transactionSchema.statics.createWithdrawalTransaction = async function(userId, amount, balance, withdrawalId) {
  const transaction = new this({
    userId,
    type: 'withdrawal',
    amount: -amount,
    previousBalance: balance + amount,
    balance,
    description: `💰 Withdrawal request: ${amount} coins`,
    metadata: {
      withdrawalId,
      amount
    },
    referenceId: withdrawalId
  });
  return await transaction.save();
};

module.exports = mongoose.model('Transaction', transactionSchema);