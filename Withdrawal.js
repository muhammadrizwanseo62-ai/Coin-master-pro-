const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const constants = require('../config/constants');

const withdrawalSchema = new mongoose.Schema({
  // ============ USER REFERENCE ============
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  
  // ============ WITHDRAWAL IDENTIFIERS ============
  withdrawalId: { 
    type: String, 
    unique: true, 
    required: true,
    default: () => 'WD-' + uuidv4().substring(0, 12).toUpperCase()
  },
  
  // ============ AMOUNT DETAILS ============
  amount: { 
    type: Number, 
    required: true,
    min: constants.MIN_WITHDRAWAL_COINS,
    max: constants.MAX_WITHDRAWAL_COINS
  },
  usdAmount: { 
    type: Number, 
    required: true,
    min: constants.MIN_WITHDRAWAL_USD
  },
  fee: { 
    type: Number, 
    required: true, 
    default: constants.WITHDRAWAL_FEE 
  },
  feeAmount: {
    type: Number,
    required: true
  },
  netAmount: { 
    type: Number, 
    required: true 
  },
  
  // ============ WALLET DETAILS ============
  walletAddress: { 
    type: String, 
    required: true,
    uppercase: true,
    trim: true
  },
  cryptoType: { 
    type: String, 
    default: constants.CRYPTO_TYPE,
    enum: ['USDT-BNB-TRX', 'USDT-TRX', 'USDT-BSC']
  },
  
  // ============ STATUS TRACKING ============
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'], 
    default: 'pending',
    index: true
  },
  
  // ============ DATES ============
  requestDate: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  processingDate: { 
    type: Date // Must be 15th
  },
  completionDate: { 
    type: Date 
  },
  
  // ============ TRANSACTION DETAILS ============
  transactionId: { 
    type: String,
    sparse: true
  },
  transactionHash: {
    type: String,
    sparse: true
  },
  
  // ============ MONTHLY TRACKING ============
  month: { 
    type: Number,
    index: true
  },
  year: { 
    type: Number,
    index: true
  },
  isProcessed: { 
    type: Boolean, 
    default: false,
    index: true
  },
  
  // ============ FAILURE TRACKING ============
  failureReason: String,
  retryCount: {
    type: Number,
    default: 0
  },
  
  // ============ ADMIN NOTES ============
  adminNotes: String,
  
  // ============ TIMESTAMPS ============
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ============ INDEXES ============
withdrawalSchema.index({ userId: 1, status: 1 });
withdrawalSchema.index({ userId: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1, processingDate: 1 });
withdrawalSchema.index({ month: 1, year: 1, status: 1 });

// ============ VIRTUAL FIELDS ============
withdrawalSchema.virtual('explorerUrl').get(function() {
  if (this.transactionHash) {
    return `https://bscscan.com/tx/${this.transactionHash}`;
  }
  return null;
});

// ============ PRE-SAVE HOOKS ============
withdrawalSchema.pre('save', function(next) {
  if (this.isNew) {
    // Set month and year
    const date = this.requestDate || new Date();
    this.month = date.getMonth() + 1;
    this.year = date.getFullYear();
    
    // Calculate fee amount
    this.feeAmount = (this.amount * this.fee) / 100;
    this.netAmount = this.amount - this.feeAmount;
    
    // Set processing date to next 15th
    const next15th = new Date();
    if (next15th.getDate() > 15) {
      next15th.setMonth(next15th.getMonth() + 1);
    }
    next15th.setDate(15);
    next15th.setHours(0, 0, 0, 0);
    this.processingDate = next15th;
  }
  next();
});

// ============ METHODS ============
withdrawalSchema.methods.markAsProcessing = async function() {
  this.status = 'processing';
  this.processingDate = new Date();
  this.updatedAt = new Date();
  await this.save();
};

withdrawalSchema.methods.markAsCompleted = async function(txHash) {
  this.status = 'completed';
  this.completionDate = new Date();
  this.transactionHash = txHash;
  this.transactionId = txHash;
  this.isProcessed = true;
  this.updatedAt = new Date();
  await this.save();
};

withdrawalSchema.methods.markAsFailed = async function(reason) {
  this.status = 'failed';
  this.failureReason = reason;
  this.updatedAt = new Date();
  await this.save();
};

withdrawalSchema.methods.cancel = async function() {
  this.status = 'cancelled';
  this.updatedAt = new Date();
  await this.save();
};

module.exports = mongoose.model('Withdrawal', withdrawalSchema);