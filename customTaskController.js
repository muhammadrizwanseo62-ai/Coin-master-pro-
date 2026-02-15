const CustomTask = require('../models/CustomTask');
const CustomTaskSubmission = require('../models/CustomTaskSubmission');
const User = require('../models/User');
const customTaskService = require('../services/customTaskService');
const proofValidatorService = require('../services/proofValidatorService');
const taskFraudService = require('../services/taskFraudService');
const { v4: uuidv4 } = require('uuid');

/**
 * Get all custom tasks with filters
 */
exports.getCustomTasks = async (req, res) => {
  try {
    const {
      category,
      minReward,
      maxReward,
      country,
      device,
      search,
      sort = '-createdAt',
      page = 1,
      limit = 20
    } = req.query;

    const query = {
      status: 'active',
      startDate: { $lte: new Date() },
      $or: [
        { endDate: { $gte: new Date() } },
        { endDate: null }
      ]
    };

    // Apply filters
    if (category) query.category = category;
    if (minReward) query.rewardCoins = { $gte: parseInt(minReward) };
    if (maxReward) {
      query.rewardCoins = query.rewardCoins || {};
      query.rewardCoins.$lte = parseInt(maxReward);
    }
    if (country) {
      query.$or = [
        { countries: 'WW' },
        { countries: country }
      ];
    }
    if (search) {
      query.$text = { $search: search };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sorting
    let sortOption = {};
    if (sort === '-createdAt') sortOption = { createdAt: -1 };
    else if (sort === 'reward') sortOption = { rewardCoins: -1 };
    else if (sort === '-reward') sortOption = { rewardCoins: 1 };
    else if (sort === 'popularity') sortOption = { totalStarts: -1 };
    else sortOption = { featured: -1, priority: 1, createdAt: -1 };

    const tasks = await CustomTask.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-instructions -requirements -proofFormFields -clientInfo');

    const total = await CustomTask.countDocuments(query);

    res.json({
      success: true,
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
      count: tasks.length,
      tasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: error.message
    });
  }
};

/**
 * Get single task by ID
 */
exports.getTaskById = async (req, res) => {
  try {
    const task = await CustomTask.findOne({ 
      $or: [
        { _id: req.params.id },
        { taskId: req.params.id }
      ]
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Increment views
    task.totalViews += 1;
    await task.save();

    // Check if user is eligible (if logged in)
    let isEligible = false;
    let eligibilityReasons = [];
    
    if (req.user) {
      const eligibility = await customTaskService.validateTaskEligibility(task._id, req.user._id);
      isEligible = eligibility.eligible;
      eligibilityReasons = eligibility.reasons;
    }

    res.json({
      success: true,
      task,
      isEligible,
      eligibilityReasons
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task',
      error: error.message
    });
  }
};

/**
 * Start a task
 */
exports.startTask = async (req, res) => {
  try {
    const task = await CustomTask.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check if task is active
    if (!task.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Task is not currently active'
      });
    }

    // Check remaining slots
    if (task.remainingSlots <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No remaining slots for this task'
      });
    }

    // Check per-user limit
    const userSubmissions = await CustomTaskSubmission.countDocuments({
      taskId: task._id,
      userId: req.user._id,
      status: { $in: ['approved', 'pending'] }
    });

    if (userSubmissions >= task.perUserLimit) {
      return res.status(400).json({
        success: false,
        message: `You have reached the maximum limit (${task.perUserLimit}) for this task`
      });
    }

    // Check cooldown
    if (task.userCooldown > 0) {
      const lastSubmission = await CustomTaskSubmission.findOne({
        taskId: task._id,
        userId: req.user._id,
        status: 'approved'
      }).sort({ submittedAt: -1 });

      if (lastSubmission) {
        const hoursSinceLast = (Date.now() - lastSubmission.submittedAt) / (1000 * 60 * 60);
        if (hoursSinceLast < task.userCooldown) {
          return res.status(400).json({
            success: false,
            message: `Please wait ${Math.ceil(task.userCooldown - hoursSinceLast)} hours before doing this task again`
          });
        }
      }
    }

    // Increment starts
    task.totalStarts += 1;
    await task.save();

    // Generate proof form
    const proofForm = await customTaskService.generateProofForm(task._id);

    res.json({
      success: true,
      message: 'Task started successfully',
      task: {
        id: task._id,
        title: task.title,
        rewardCoins: task.rewardCoins,
        instructions: task.instructions,
        requirements: task.requirements,
        referralLink: task.referralLink,
        customTrackingLink: task.customTrackingLink
      },
      proofForm,
      submittedAt: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to start task',
      error: error.message
    });
  }
};

/**
 * Submit proof for task
 */
exports.submitTaskProof = async (req, res) => {
  try {
    const task = await CustomTask.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Validate proof data
    const validation = await exports.validateProof(req.body.proofData, task);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Proof validation failed',
        errors: validation.errors
      });
    }

    // Check for fraud
    const fraudCheck = await taskFraudService.detectDuplicateSubmissions({
      taskId: task._id,
      userId: req.user._id,
      proofData: req.body.proofData
    });

    // Create submission
    const submission = new CustomTaskSubmission({
      submissionId: `SUB-${uuidv4().substring(0, 8).toUpperCase()}`,
      taskId: task._id,
      userId: req.user._id,
      proofData: req.body.proofData,
      screenshotUrls: req.body.screenshotUrls || [],
      submittedLink: req.body.submittedLink,
      submittedUsername: req.body.submittedUsername,
      ip: req.ip,
      country: req.headers['cf-ipcountry'] || 'WW',
      device: req.body.device || 'other',
      deviceModel: req.body.deviceModel,
      os: req.body.os,
      browser: req.body.browser,
      userAgent: req.get('User-Agent'),
      fraudScore: fraudCheck.fraudScore || 0,
      fraudReasons: fraudCheck.reasons || [],
      isSuspicious: fraudCheck.isSuspicious || false,
      isDuplicate: fraudCheck.isDuplicate || false,
      duplicateOf: fraudCheck.duplicateOf
    });

    // Auto-verify if enabled
    if (task.verificationType === 'auto' && !fraudCheck.isSuspicious) {
      const autoVerify = await exports.autoVerifyTask(submission, task);
      if (autoVerify.verified) {
        submission.status = 'approved';
        submission.approvedAt = new Date();
        
        // Award coins
        const user = await User.findById(req.user._id);
        user.coins += task.rewardCoins;
        user.totalEarned += task.rewardCoins;
        await user.save();
        
        task.totalApproved += 1;
        task.completedSlots += 1;
      }
    }

    await submission.save();

    // Update task stats
    task.totalSubmissions += 1;
    task.totalPending += 1;
    await task.save();

    // Send notification to admin
    await customTaskService.sendVerificationNotification(submission);

    res.json({
      success: true,
      message: 'Proof submitted successfully',
      submissionId: submission.submissionId,
      status: submission.status,
      estimatedVerificationTime: task.verificationTime,
      isSuspicious: submission.isSuspicious,
      fraudScore: submission.fraudScore
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to submit proof',
      error: error.message
    });
  }
};

/**
 * Check if user is eligible for task
 */
exports.checkEligibility = async (req, res) => {
  try {
    const eligibility = await customTaskService.validateTaskEligibility(
      req.params.id,
      req.user._id
    );

    res.json({
      success: true,
      ...eligibility
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check eligibility',
      error: error.message
    });
  }
};

/**
 * Validate submitted proof
 */
exports.validateProof = async (proofData, task) => {
  try {
    const errors = [];
    let valid = true;

    // Check required fields
    task.proofFormFields.forEach(field => {
      if (field.required) {
        const submittedField = proofData.find(p => p.fieldId === field.fieldId);
        if (!submittedField || !submittedField.fieldValue) {
          errors.push(`${field.label} is required`);
          valid = false;
        }
      }
    });

    // Validate each field
    for (const field of proofData) {
      const fieldConfig = task.proofFormFields.find(f => f.fieldId === field.fieldId);
      
      if (!fieldConfig) continue;

      // Type-specific validation
      switch (fieldConfig.type) {
        case 'email':
          const emailValid = await proofValidatorService.validateEmail(field.fieldValue);
          if (!emailValid) {
            errors.push(`${fieldConfig.label}: Invalid email format`);
            valid = false;
          }
          break;
          
        case 'url':
          const urlValid = await proofValidatorService.validateLink(field.fieldValue);
          if (!urlValid) {
            errors.push(`${fieldConfig.label}: Invalid or unreachable URL`);
            valid = false;
          }
          break;
          
        case 'image':
          if (field.fileUrl) {
            const screenshotValid = await proofValidatorService.validateScreenshot(field.fileUrl);
            if (!screenshotValid.valid) {
              errors.push(`${fieldConfig.label}: ${screenshotValid.reason}`);
              valid = false;
            }
          }
          break;
          
        case 'text':
          if (fieldConfig.validation) {
            const regex = new RegExp(fieldConfig.validation);
            if (!regex.test(field.fieldValue)) {
              errors.push(`${fieldConfig.label}: Invalid format`);
              valid = false;
            }
          }
          break;
      }
    }

    return { valid, errors };
  } catch (error) {
    console.error('Proof validation error:', error);
    return {
      valid: false,
      errors: ['Proof validation failed']
    };
  }
};

/**
 * Auto verify task submission
 */
exports.autoVerifyTask = async (submission, task) => {
  try {
    let verified = false;
    let reasons = [];

    // Check for auto-verify keywords
    if (task.autoVerifyKeywords && task.autoVerifyKeywords.length > 0) {
      const submissionText = JSON.stringify(submission.proofData).toLowerCase();
      
      task.autoVerifyKeywords.forEach(keyword => {
        if (submissionText.includes(keyword.toLowerCase())) {
          verified = true;
          reasons.push(`Matched keyword: ${keyword}`);
        }
      });
    }

    // Check for specific proof types
    if (submission.submittedLink) {
      const linkValid = await proofValidatorService.validateLink(submission.submittedLink);
      if (linkValid) verified = true;
    }

    if (submission.screenshotUrls && submission.screenshotUrls.length > 0) {
      // Basic screenshot validation
      verified = true;
    }

    return {
      verified,
      reasons,
      autoApproved: verified && task.verificationType === 'auto'
    };
  } catch (error) {
    console.error('Auto verify error:', error);
    return {
      verified: false,
      reasons: ['Auto-verification failed'],
      autoApproved: false
    };
  }
};

/**
 * Get user task history
 */
exports.getUserTaskHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const query = { userId: req.user._id };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const submissions = await CustomTaskSubmission.find(query)
      .populate('taskId', 'title rewardCoins category')
      .sort({ submittedAt: -1 })
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
      message: 'Failed to fetch task history',
      error: error.message
    });
  }
};

/**
 * Get user task statistics
 */
exports.getUserTaskStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await CustomTaskSubmission.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalCoins: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$taskId.rewardCoins', 0] } }
        }
      }
    ]);

    const formattedStats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      paid: 0,
      totalCoins: 0,
      totalSubmissions: 0
    };

    stats.forEach(stat => {
      formattedStats[stat._id] = stat.count;
      formattedStats.totalCoins += stat.totalCoins || 0;
      formattedStats.totalSubmissions += stat.count;
    });

    // Get recent activity
    const recentActivity = await CustomTaskSubmission.find({ userId })
      .populate('taskId', 'title category')
      .sort({ submittedAt: -1 })
      .limit(10);

    res.json({
      success: true,
      stats: formattedStats,
      recentActivity,
      conversionRate: formattedStats.totalSubmissions > 0
        ? ((formattedStats.approved / formattedStats.totalSubmissions) * 100).toFixed(2)
        : 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user stats',
      error: error.message
    });
  }
};

/**
 * Calculate admin profit per task
 */
exports.calculateTaskProfit = async (req, res) => {
  try {
    const task = await CustomTask.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const totalPayout = task.payoutUSD * task.totalApproved;
    const totalReward = task.rewardUSD * task.totalApproved;
    const totalProfit = totalPayout - totalReward;

    res.json({
      success: true,
      taskId: task.taskId,
      title: task.title,
      perTask: {
        payoutUSD: task.payoutUSD,
        rewardUSD: task.rewardUSD,
        profitUSD: task.profitUSD,
        margin: ((task.profitUSD / task.payoutUSD) * 100).toFixed(2) + '%'
      },
      totals: {
        completed: task.totalApproved,
        totalPayout: parseFloat(totalPayout.toFixed(2)),
        totalReward: parseFloat(totalReward.toFixed(2)),
        totalProfit: parseFloat(totalProfit.toFixed(2)),
        averageMargin: task.totalApproved > 0 
          ? ((totalProfit / totalPayout) * 100).toFixed(2) + '%'
          : '0%'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to calculate profit',
      error: error.message
    });
  }
};