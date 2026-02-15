const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const CustomTaskSchema = new mongoose.Schema({
  // Basic Identification
  taskId: {
    type: String,
    unique: true,
    default: () => `TASK-${uuidv4().substring(0, 8).toUpperCase()}`
  },
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Task description is required'],
    trim: true,
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  category: {
    type: String,
    required: true,
    enum: [
      'crypto', 'social_media', 'app_install', 'survey', 
      'signup', 'website_visit', 'youtube', 'instagram', 
      'facebook', 'tiktok', 'telegram', 'other'
    ],
    default: 'other'
  },
  taskType: {
    type: String,
    required: true,
    enum: [
      'link_click', 'app_download', 'signup', 'follow', 
      'like', 'comment', 'subscribe', 'watch', 'review', 'custom'
    ],
    default: 'custom'
  },

  // Reward Settings
  rewardCoins: {
    type: Number,
    required: true,
    min: [100, 'Minimum reward is 100 coins'],
    max: [100000, 'Maximum reward is 100,000 coins']
  },
  rewardUSD: {
    type: Number,
    default: function() {
      return this.rewardCoins / 5000;
    }
  },
  payoutUSD: {
    type: Number,
    required: true,
    min: [0.01, 'Minimum payout is $0.01']
  },
  profitUSD: {
    type: Number,
    default: function() {
      return this.payoutUSD - (this.rewardCoins / 5000);
    }
  },

  // Task Requirements
  requirements: [{
    type: String,
    trim: true
  }],
  instructions: [{
    type: String,
    trim: true
  }],
  requiredProof: [{
    type: String,
    enum: ['screenshot', 'link', 'username', 'email', 'phone', 'transactionId', 'custom']
  }],

  // Proof Form Fields - FULL CUSTOMIZATION
  proofFormFields: [{
    fieldId: {
      type: String,
      default: () => `field-${uuidv4().substring(0, 6)}`
    },
    label: String,
    type: {
      type: String,
      enum: ['text', 'url', 'email', 'file', 'image', 'number', 'textarea', 'dropdown', 'checkbox', 'radio']
    },
    placeholder: String,
    required: Boolean,
    validation: String,
    maxFileSize: Number,
    acceptedFileTypes: [String],
    options: [String], // For dropdown, radio, checkbox
    defaultValue: String
  }],

  // Client Info
  clientName: String,
  clientEmail: String,
  clientWebsite: String,
  referralLink: String,
  customTrackingLink: String,

  // Task Limits
  totalSlots: {
    type: Number,
    default: 100,
    min: 1,
    max: 10000
  },
  completedSlots: {
    type: Number,
    default: 0
  },
  pendingSlots: {
    type: Number,
    default: 0
  },
  perUserLimit: {
    type: Number,
    default: 1,
    min: 1,
    max: 100
  },
  dailyLimit: {
    type: Number,
    default: 0,
    min: 0
  },
  userCooldown: {
    type: Number,
    default: 24,
    min: 0,
    max: 720
  },

  // Targeting
  countries: [{
    type: String,
    uppercase: true,
    default: ['WW']
  }],
  countriesBlacklist: [{
    type: String,
    uppercase: true
  }],
  minAccountAge: {
    type: Number,
    default: 0,
    min: 0,
    max: 3650
  },
  minGamesPlayed: {
    type: Number,
    default: 0,
    min: 0
  },
  minReferrals: {
    type: Number,
    default: 0,
    min: 0
  },
  minLoginStreak: {
    type: Number,
    default: 0,
    min: 0,
    max: 365
  },

  // Schedule
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: null
  },
  daysActive: [{
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  }],
  hoursActive: {
    startTime: {
      type: String,
      default: '00:00'
    },
    endTime: {
      type: String,
      default: '23:59'
    }
  },

  // Status
  status: {
    type: String,
    enum: ['draft', 'pending_review', 'active', 'paused', 'expired', 'completed'],
    default: 'draft'
  },
  featured: {
    type: Boolean,
    default: false
  },
  priority: {
    type: Number,
    enum: [1, 2, 3, 4, 5],
    default: 3
  },

  // Statistics
  totalViews: {
    type: Number,
    default: 0
  },
  totalClicks: {
    type: Number,
    default: 0
  },
  totalStarts: {
    type: Number,
    default: 0
  },
  totalSubmissions: {
    type: Number,
    default: 0
  },
  totalApproved: {
    type: Number,
    default: 0
  },
  totalRejected: {
    type: Number,
    default: 0
  },
  totalPending: {
    type: Number,
    default: 0
  },
  conversionRate: {
    type: Number,
    default: 0
  },

  // Verification Settings
  verificationType: {
    type: String,
    enum: ['auto', 'manual', 'hybrid'],
    default: 'manual'
  },
  autoVerifyKeywords: [{
    type: String,
    trim: true
  }],
  requireAdminApproval: {
    type: Boolean,
    default: true
  },
  verificationTime: {
    type: Number,
    default: 24,
    min: 0,
    max: 168
  },

  // Fraud Prevention
  blockVPN: {
    type: Boolean,
    default: false
  },
  blockProxy: {
    type: Boolean,
    default: false
  },
  blockSameIP: {
    type: Boolean,
    default: false
  },
  maxAttempts: {
    type: Number,
    default: 3,
    min: 1,
    max: 10
  },
  cooldownPeriod: {
    type: Number,
    default: 60,
    min: 0,
    max: 1440
  },

  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for remaining slots
CustomTaskSchema.virtual('remainingSlots').get(function() {
  return this.totalSlots - this.completedSlots;
});

// Virtual for isActive
CustomTaskSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         this.startDate <= now && 
         (!this.endDate || this.endDate >= now) &&
         this.remainingSlots > 0;
});

// Pre-save middleware
CustomTaskSchema.pre('save', function(next) {
  this.rewardUSD = this.rewardCoins / 5000;
  this.profitUSD = this.payoutUSD - this.rewardUSD;
  this.conversionRate = this.totalSubmissions > 0 
    ? (this.totalApproved / this.totalSubmissions) * 100 
    : 0;
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('CustomTask', CustomTaskSchema);