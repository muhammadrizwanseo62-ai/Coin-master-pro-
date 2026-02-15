const CustomTask = require('../models/CustomTask');
const CustomTaskSubmission = require('../models/CustomTaskSubmission');
const CustomTaskCategory = require('../models/CustomTaskCategory');
const User = require('../models/User');
const customTaskService = require('../services/customTaskService');
const { v4: uuidv4 } = require('uuid');

/**
 * Create new custom task
 */
exports.createCustomTask = async (req, res) => {
  try {
    const taskData = req.body;
    
    // Parse JSON fields that come as strings
    if (taskData.requirements && typeof taskData.requirements === 'string') {
      taskData.requirements = JSON.parse(taskData.requirements);
    }
    if (taskData.instructions && typeof taskData.instructions === 'string') {
      taskData.instructions = JSON.parse(taskData.instructions);
    }
    if (taskData.proofFormFields && typeof taskData.proofFormFields === 'string') {
      taskData.proofFormFields = JSON.parse(taskData.proofFormFields);
    }
    if (taskData.countries && typeof taskData.countries === 'string') {
      taskData.countries = JSON.parse(taskData.countries);
    }
    if (taskData.countriesBlacklist && typeof taskData.countriesBlacklist === 'string') {
      taskData.countriesBlacklist = JSON.parse(taskData.countriesBlacklist);
    }
    if (taskData.daysActive && typeof taskData.daysActive === 'string') {
      taskData.daysActive = JSON.parse(taskData.daysActive);
    }
    if (taskData.autoVerifyKeywords && typeof taskData.autoVerifyKeywords === 'string') {
      taskData.autoVerifyKeywords = JSON.parse(taskData.autoVerifyKeywords);
    }

    // Calculate derived values
    taskData.rewardUSD = taskData.rewardCoins / 5000;
    taskData.profitUSD = taskData.payoutUSD - taskData.rewardUSD;

    // Set created by
    taskData.createdBy = req.user._id;

    const task = new CustomTask(taskData);
    await task.save();

    // Update category task count
    if (task.category) {
      await CustomTaskCategory.findOneAndUpdate(
        { name: { $regex: new RegExp(task.category, 'i') } },
        { $inc: { taskCount: 1 } }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Custom task created successfully',
      task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create custom task',
      error: error.message
    });
  }
};

/**
 * Update custom task
 */
exports.updateCustomTask = async (req, res) => {
  try {
    const task = await CustomTask.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const updateData = req.body;
    
    // Parse JSON fields
    ['requirements', 'instructions', 'proofFormFields', 'countries', 
     'countriesBlacklist', 'daysActive', 'autoVerifyKeywords'].forEach(field => {
      if (updateData[field] && typeof updateData[field] === 'string') {
        try {
          updateData[field] = JSON.parse(updateData[field]);
        } catch (e) {
          // Keep as is
        }
      }
    });

    // Recalculate profit if reward or payout changed
    if (updateData.rewardCoins || updateData.payoutUSD) {
      updateData.rewardUSD = (updateData.rewardCoins || task.rewardCoins) / 5000;
      updateData.profitUSD = (updateData.payoutUSD || task.payoutUSD) - updateData.rewardUSD;
    }

    // Update task
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        task[key] = updateData[key];
      }
    });

    task.updatedAt = Date.now();
    await task.save();

    res.json({
      success: true,
      message: 'Custom task updated successfully',
      task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update custom task',
      error: error.message
    });
  }
};

/**
 * Delete custom task
 */
exports.deleteCustomTask = async (req, res) => {
  try {
    const task = await CustomTask.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Update category task count
    if (task.category) {
      await CustomTaskCategory.findOneAndUpdate(
        { name: { $regex: new RegExp(task.category, 'i') } },
        { $inc: { taskCount: -1 } }
      );
    }

    await task.deleteOne();

    res.json({
      success: true,
      message: 'Custom task deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete custom task',
      error: error.message
    });
  }
};

/**
 * Duplicate custom task
 */
exports.duplicateCustomTask = async (req, res) => {
  try {
    const originalTask = await CustomTask.findById(req.params.id);
    
    if (!originalTask) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Create duplicate
    const taskData = originalTask.toObject();
    delete taskData._id;
    delete taskData.__v;
    delete taskData.createdAt;
    delete taskData.updatedAt;
    delete taskData.taskId;
    
    taskData.title = `Copy of ${taskData.title}`;
    taskData.status = 'draft';
    taskData.totalViews = 0;
    taskData.totalClicks = 0;
    taskData.totalStarts = 0;
    taskData.totalSubmissions = 0;
    taskData.totalApproved = 0;
    taskData.totalRejected = 0;
    taskData.totalPending = 0;
    taskData.completedSlots = 0;
    taskData.pendingSlots = 0;
    taskData.createdBy = req.user._id;

    const newTask = new CustomTask(taskData);
    await newTask.save();

    // Update category task count
    if (newTask.category) {
      await CustomTaskCategory.findOneAndUpdate(
        { name: { $regex: new RegExp(newTask.category, 'i') } },
        { $inc: { taskCount: 1 } }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Task duplicated successfully',
      task: newTask
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to duplicate task',
      error: error.message
    });
  }
};

/**
 * Get pending submissions
 */
exports.getPendingSubmissions = async (req, res) => {
  try {
    const { page = 1, limit = 50, taskId, userId, sort = '-submittedAt' } = req.query;
    
    const query = { status: 'pending' };
    if (taskId) query.taskId = taskId;
    if (userId) query.userId = userId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const submissions = await CustomTaskSubmission.find(query)
      .populate('taskId', 'title rewardCoins category')
      .populate('userId', 'username email telegramId')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CustomTaskSubmission.countDocuments(query);

    res.json({
      success: true,
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
      count: submissions.length,
      submissions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending submissions',
      error: error.message
    });
  }
};

/**
 * Approve submission
 */
exports.approveSubmission = async (req, res) => {
  try {
    const submission = await CustomTaskSubmission.findById(req.params.id)
      .populate('taskId')
      .populate('userId');
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    if (submission.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Submission already ${submission.status}`
      });
    }

    // Update submission
    submission.status = 'approved';
    submission.approvedBy = req.user._id;
    submission.approvedAt = Date.now();
    submission.processedAt = Date.now();
    await submission.save();

    // Award coins to user
    const user = await User.findById(submission.userId);
    if (user) {
      user.coins += submission.taskId.rewardCoins;
      user.totalEarned += submission.taskId.rewardCoins;
      await user.save();
    }

    // Update task stats
    const task = await CustomTask.findById(submission.taskId);
    if (task) {
      task.totalApproved += 1;
      task.totalPending -= 1;
      task.completedSlots += 1;
      await task.save();
    }

    res.json({
      success: true,
      message: 'Submission approved successfully',
      submission: {
        id: submission.submissionId,
        status: submission.status,
        user: user?.username,
        coinsAwarded: submission.taskId.rewardCoins
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to approve submission',
      error: error.message
    });
  }
};

/**
 * Reject submission
 */
exports.rejectSubmission = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    
    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const submission = await CustomTaskSubmission.findById(req.params.id)
      .populate('taskId');
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    if (submission.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Submission already ${submission.status}`
      });
    }

    // Update submission
    submission.status = 'rejected';
    submission.rejectionReason = rejectionReason;
    submission.processedAt = Date.now();
    submission.adminNotes = req.body.adminNotes || '';
    await submission.save();

    // Update task stats
    const task = await CustomTask.findById(submission.taskId);
    if (task) {
      task.totalRejected += 1;
      task.totalPending -= 1;
      await task.save();
    }

    res.json({
      success: true,
      message: 'Submission rejected successfully',
      submission: {
        id: submission.submissionId,
        status: submission.status,
        rejectionReason: submission.rejectionReason
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to reject submission',
      error: error.message
    });
  }
};

/**
 * Bulk approve submissions
 */
exports.bulkApproveSubmissions = async (req, res) => {
  try {
    const { submissionIds } = req.body;
    
    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'submissionIds array is required'
      });
    }

    let approved = 0;
    let failed = 0;
    const results = [];

    for (const id of submissionIds) {
      try {
        const submission = await CustomTaskSubmission.findById(id)
          .populate('taskId')
          .populate('userId');
        
        if (submission && submission.status === 'pending') {
          submission.status = 'approved';
          submission.approvedBy = req.user._id;
          submission.approvedAt = Date.now();
          submission.processedAt = Date.now();
          await submission.save();

          // Award coins
          const user = await User.findById(submission.userId);
          if (user) {
            user.coins += submission.taskId.rewardCoins;
            user.totalEarned += submission.taskId.rewardCoins;
            await user.save();
          }

          // Update task
          await CustomTask.findByIdAndUpdate(submission.taskId, {
            $inc: { totalApproved: 1, totalPending: -1, completedSlots: 1 }
          });

          approved++;
          results.push({ id, status: 'approved' });
        } else {
          failed++;
          results.push({ id, status: 'failed', reason: 'Not pending or not found' });
        }
      } catch (error) {
        failed++;
        results.push({ id, status: 'error', error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Bulk approval completed: ${approved} approved, ${failed} failed`,
      approved,
      failed,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to bulk approve submissions',
      error: error.message
    });
  }
};

/**
 * Get task analytics
 */
exports.getTaskAnalytics = async (req, res) => {
  try {
    const { period = '7d', taskId } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    switch(period) {
      case '24h':
        dateFilter = { $gte: new Date(now - 24 * 60 * 60 * 1000) };
        break;
      case '7d':
        dateFilter = { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) };
        break;
      case '30d':
        dateFilter = { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) };
        break;
      case 'all':
        dateFilter = { $gte: new Date(0) };
        break;
    }

    const matchStage = taskId 
      ? { taskId: mongoose.Types.ObjectId(taskId) }
      : {};

    if (dateFilter.$gte) {
      matchStage.submittedAt = dateFilter;
    }

    // Overall stats
    const overallStats = await CustomTask.aggregate([
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          activeTasks: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          totalRewards: { $sum: '$rewardCoins' },
          totalPayouts: { $sum: '$payoutUSD' },
          totalProfit: { $sum: '$profitUSD' },
          totalViews: { $sum: '$totalViews' },
          totalStarts: { $sum: '$totalStarts' },
          totalSubmissions: { $sum: '$totalSubmissions' },
          totalApproved: { $sum: '$totalApproved' }
        }
      }
    ]);

    // Submissions over time
    const submissionsOverTime = await CustomTaskSubmission.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: '$submittedAt' },
            month: { $month: '$submittedAt' },
            day: { $dayOfMonth: '$submittedAt' }
          },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          total: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      { $limit: 30 }
    ]);

    // Top performing tasks
    const topTasks = await CustomTask.find({ status: 'active' })
      .sort({ totalStarts: -1, totalApproved: -1 })
      .limit(10)
      .select('title taskId category rewardCoins payoutUSD totalStarts totalApproved conversionRate');

    // Category breakdown
    const categoryBreakdown = await CustomTask.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalRewards: { $sum: '$rewardCoins' },
          totalStarts: { $sum: '$totalStarts' },
          totalApproved: { $sum: '$totalApproved' }
        }
      }
    ]);

    // Fraud stats
    const fraudStats = await CustomTaskSubmission.aggregate([
      { $match: { fraudScore: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          suspiciousSubmissions: { $sum: 1 },
          avgFraudScore: { $avg: '$fraudScore' },
          maxFraudScore: { $max: '$fraudScore' }
        }
      }
    ]);

    res.json({
      success: true,
      period,
      overview: overallStats[0] || {},
      submissionsOverTime,
      topTasks,
      categoryBreakdown,
      fraud: fraudStats[0] || { suspiciousSubmissions: 0, avgFraudScore: 0, maxFraudScore: 0 }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
};

/**
 * Category management
 */
exports.manageCategories = {
  /**
   * Create category
   */
  createCategory: async (req, res) => {
    try {
      const { name, description, icon, parentCategory, sortOrder, color, image } = req.body;
      
      // Check if category exists
      const existing = await CustomTaskCategory.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') }
      });
      
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Category already exists'
        });
      }

      const category = new CustomTaskCategory({
        name,
        description,
        icon,
        parentCategory,
        sortOrder: sortOrder || 0,
        color,
        image,
        active: true
      });

      await category.save();

      // If parent category, add to subcategories
      if (parentCategory) {
        await CustomTaskCategory.findByIdAndUpdate(parentCategory, {
          $push: { subcategories: category._id }
        });
      }

      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        category
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create category',
        error: error.message
      });
    }
  },

  /**
   * Update category
   */
  updateCategory: async (req, res) => {
    try {
      const category = await CustomTaskCategory.findById(req.params.id);
      
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      const updateFields = ['name', 'description', 'icon', 'parentCategory', 
                           'sortOrder', 'active', 'color', 'image'];
      
      updateFields.forEach(field => {
        if (req.body[field] !== undefined) {
          category[field] = req.body[field];
        }
      });

      await category.save();

      res.json({
        success: true,
        message: 'Category updated successfully',
        category
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update category',
        error: error.message
      });
    }
  },

  /**
   * Delete category
   */
  deleteCategory: async (req, res) => {
    try {
      const category = await CustomTaskCategory.findById(req.params.id);
      
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      // Remove from parent's subcategories
      if (category.parentCategory) {
        await CustomTaskCategory.findByIdAndUpdate(category.parentCategory, {
          $pull: { subcategories: category._id }
        });
      }

      await category.deleteOne();

      res.json({
        success: true,
        message: 'Category deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete category',
        error: error.message
      });
    }
  },

  /**
   * Get categories
   */
  getCategories: async (req, res) => {
    try {
      const categories = await CustomTaskCategory.find()
        .populate('subcategories')
        .sort({ sortOrder: 1, name: 1 });
      
      res.json({
        success: true,
        count: categories.length,
        categories
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch categories',
        error: error.message
      });
    }
  }
};