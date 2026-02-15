const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const CustomTaskSubmissionSchema = new mongoose.Schema({
  submissionId: {
    type: String,
    unique: true,
    default: () => `SUB-${uuidv4().substring(0, 8).toUpperCase()}`
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomTask',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Proof Data - Dynamic fields from CustomTask
  proofData: [{
    fieldId: String,
    fieldLabel: String,
    fieldValue: String,
    fileUrl: String,
    fileName: String,
    fileSize: Number
  }],
  
  screenshotUrls: [{
    type: String,
    trim: true
  }],
  
  submittedLink: {
    type: String,
    trim: true
  },
  
  submittedUsername: {
    type: String,
    trim: true
  },
  
  // Metadata
  ip: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    uppercase: true,
    default: 'WW'
  },
  city: String,
  region: String,
  device: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'bot', 'other'],
    default: 'other'
  },
  deviceModel: String,
  os: String,
  browser: String,
  userAgent: String,
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'paid'],
    default: 'pending'
  },
  
  adminNotes: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  
  approvedAt: Date,
  paidAt: Date,
  submittedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: Date,
  
  // Fraud Detection
  fraudScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  fraudReasons: [String],
  isSuspicious: {
    type: Boolean,
    default: false
  },
  
  // Duplicate Check
  duplicateOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomTaskSubmission'
  },
  isDuplicate: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for performance
CustomTaskSubmissionSchema.index({ taskId: 1, status: 1 });
CustomTaskSubmissionSchema.index({ userId: 1, submittedAt: -1 });
CustomTaskSubmissionSchema.index({ submissionId: 1 }, { unique: true });

// Pre-save middleware
CustomTaskSubmissionSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'approved' && !this.approvedAt) {
    this.approvedAt = Date.now();
  }
  if (this.isModified('status') && this.status === 'rejected' && !this.processedAt) {
    this.processedAt = Date.now();
  }
  next();
});

module.exports = mongoose.model('CustomTaskSubmission', CustomTaskSubmissionSchema);