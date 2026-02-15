const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const CustomTaskCategorySchema = new mongoose.Schema({
  categoryId: {
    type: String,
    unique: true,
    default: () => `CAT-${uuidv4().substring(0, 6).toUpperCase()}`
  },
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  icon: {
    type: String,
    default: 'fa-folder'
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomTaskCategory',
    default: null
  },
  subcategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomTaskCategory'
  }],
  taskCount: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  image: String,
  color: String,
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

// Pre-save middleware to generate slug from name
CustomTaskCategorySchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('CustomTaskCategory', CustomTaskCategorySchema);