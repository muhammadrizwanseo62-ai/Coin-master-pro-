const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const NetworkIntegrationSchema = new mongoose.Schema({
  networkId: {
    type: String,
    unique: true,
    default: () => `NET-${uuidv4().substring(0, 6).toUpperCase()}`
  },
  name: {
    type: String,
    required: [true, 'Network name is required'],
    unique: true,
    trim: true,
    enum: ['CPAGrip', 'CPALead', 'Adworkmedia', 'OGAds', 'Offertoro', 'AdGate Media', 'KiwiWall', 'Ayet Studios', 'Toro', 'Persona.ly', 'Other']
  },
  customName: {
    type: String,
    trim: true
  },
  iframeCode: {
    type: String,
    required: [true, 'Iframe code is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return v.includes('<iframe') || v.includes('<script');
      },
      message: 'Invalid iframe code format'
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  displayOrder: {
    type: Number,
    default: 0,
    min: 0,
    max: 999
  },
  countryTargeting: {
    type: String,
    enum: ['all', 'specific'],
    default: 'all'
  },
  targetCountries: [{
    type: String,
    uppercase: true
  }],
  width: {
    type: String,
    default: '100%'
  },
  height: {
    type: String,
    default: '600px'
  },
  scrolling: {
    type: String,
    enum: ['yes', 'no', 'auto'],
    default: 'auto'
  },
  sandbox: {
    type: String,
    default: ''
  },
  allow: {
    type: String,
    default: 'payment *; clipboard-write *'
  },
  referrerPolicy: {
    type: String,
    default: 'no-referrer-when-downgrade'
  },
  loading: {
    type: String,
    enum: ['lazy', 'eager'],
    default: 'lazy'
  },
  style: {
    type: String,
    default: 'border: none; border-radius: 8px;'
  },
  description: {
    type: String,
    trim: true
  },
  icon: {
    type: String,
    default: 'fa-ad'
  },
  backgroundColor: {
    type: String,
    default: '#ffffff'
  },
  textColor: {
    type: String,
    default: '#333333'
  },
  cacheKey: {
    type: String,
    default: function() {
      return `${this.name}-${Date.now()}`;
    }
  },
  lastGenerated: {
    type: Date,
    default: null
  },
  clickCount: {
    type: Number,
    default: 0
  },
  viewCount: {
    type: Number,
    default: 0
  },
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
  timestamps: true
});

// Virtual for display name
NetworkIntegrationSchema.virtual('displayName').get(function() {
  return this.customName || this.name;
});

// Pre-save middleware
NetworkIntegrationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  this.cacheKey = `${this.name}-${Date.now()}`;
  next();
});

// Static method to get active networks
NetworkIntegrationSchema.statics.getActiveNetworks = function() {
  return this.find({ status: 'active' }).sort({ displayOrder: 1 });
};

module.exports = mongoose.model('NetworkIntegration', NetworkIntegrationSchema);