const CustomTask = require('../models/CustomTask');
const CustomTaskSubmission = require('../models/CustomTaskSubmission');
const User = require('../models/User');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

/**
 * Custom Task Service
 */
class CustomTaskService {
  /**
   * Validate if user is eligible for task
   */
  async validateTaskEligibility(taskId, userId) {
    try {
      const task = await CustomTask.findById(taskId);
      const user = await User.findById(userId);
      
      if (!task || !user) {
        return { eligible: false, reasons: ['Task or user not found'] };
      }

      const reasons = [];
      let eligible = true;

      // Check account age
      if (task.minAccountAge > 0) {
        const accountAgeDays = (Date.now() - user.createdAt) / (1000 * 60 * 60 * 24);
        if (accountAgeDays < task.minAccountAge) {
          eligible = false;
          reasons.push(`Account must be at least ${task.minAccountAge} days old`);
        }
      }

      // Check games played
      if (task.minGamesPlayed > 0 && user.gamesPlayed < task.minGamesPlayed) {
        eligible = false;
        reasons.push(`Need to play at least ${task.minGamesPlayed} games`);
      }

      // Check referrals
      if (task.minReferrals > 0 && user.referrals < task.minReferrals) {
        eligible = false;
        reasons.push(`Need at least ${task.minReferrals} referrals`);
      }

      // Check login streak
      if (task.minLoginStreak > 0 && user.loginStreak < task.minLoginStreak) {
        eligible = false;
        reasons.push(`Need ${task.minLoginStreak} day login streak`);
      }

      // Check country
      if (task.countries.length > 0 && !task.countries.includes('WW')) {
        const userCountry = user.country || 'WW';
        if (!task.countries.includes(userCountry)) {
          eligible = false;
          reasons.push(`Task not available in your country`);
        }
      }

      // Check blacklist
      if (task.countriesBlacklist.length > 0) {
        const userCountry = user.country || 'WW';
        if (task.countriesBlacklist.includes(userCountry)) {
          eligible = false;
          reasons.push(`Task not available in your country`);
        }
      }

      // Check daily limit
      if (task.dailyLimit > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todaySubmissions = await CustomTaskSubmission.countDocuments({
          taskId: task._id,
          submittedAt: { $gte: today }
        });

        if (todaySubmissions >= task.dailyLimit) {
          eligible = false;
          reasons.push(`Daily limit reached for this task`);
        }
      }

      // Check cooldown
      if (task.userCooldown > 0) {
        const lastSubmission = await CustomTaskSubmission.findOne({
          taskId: task._id,
          userId: user._id,
          status: 'approved'
        }).sort({ submittedAt: -1 });

        if (lastSubmission) {
          const hoursSince = (Date.now() - lastSubmission.submittedAt) / (1000 * 60 * 60);
          if (hoursSince < task.userCooldown) {
            eligible = false;
            reasons.push(`Please wait ${Math.ceil(task.userCooldown - hoursSince)} hours`);
          }
        }
      }

      // Check per user limit
      if (task.perUserLimit > 0) {
        const userSubmissions = await CustomTaskSubmission.countDocuments({
          taskId: task._id,
          userId: user._id,
          status: { $in: ['approved', 'pending'] }
        });

        if (userSubmissions >= task.perUserLimit) {
          eligible = false;
          reasons.push(`Maximum ${task.perUserLimit} completion${task.perUserLimit > 1 ? 's' : ''} per user`);
        }
      }

      return { eligible, reasons };
    } catch (error) {
      console.error('Eligibility validation error:', error);
      return { eligible: false, reasons: ['Validation failed'] };
    }
  }

  /**
   * Generate dynamic proof form based on task settings
   */
  async generateProofForm(taskId) {
    try {
      const task = await CustomTask.findById(taskId);
      
      if (!task) {
        throw new Error('Task not found');
      }

      // If custom fields are defined, use them
      if (task.proofFormFields && task.proofFormFields.length > 0) {
        return {
          fields: task.proofFormFields,
          instructions: task.instructions,
          requirements: task.requirements,
          referralLink: task.referralLink
        };
      }

      // Otherwise generate default form based on requiredProof
      const defaultFields = [];
      
      if (task.requiredProof.includes('screenshot')) {
        defaultFields.push({
          fieldId: `field-${uuidv4().substring(0, 6)}`,
          label: 'Screenshot',
          type: 'image',
          required: true,
          acceptedFileTypes: ['jpg', 'png', 'jpeg'],
          maxFileSize: 5 * 1024 * 1024 // 5MB
        });
      }

      if (task.requiredProof.includes('link')) {
        defaultFields.push({
          fieldId: `field-${uuidv4().substring(0, 6)}`,
          label: 'Proof Link',
          type: 'url',
          placeholder: 'https://...',
          required: true,
          validation: '^https?://.*$'
        });
      }

      if (task.requiredProof.includes('username')) {
        defaultFields.push({
          fieldId: `field-${uuidv4().substring(0, 6)}`,
          label: 'Username',
          type: 'text',
          placeholder: 'Enter your username',
          required: true
        });
      }

      if (task.requiredProof.includes('email')) {
        defaultFields.push({
          fieldId: `field-${uuidv4().substring(0, 6)}`,
          label: 'Email Address',
          type: 'email',
          placeholder: 'user@example.com',
          required: true
        });
      }

      if (task.requiredProof.includes('phone')) {
        defaultFields.push({
          fieldId: `field-${uuidv4().substring(0, 6)}`,
          label: 'Phone Number',
          type: 'text',
          placeholder: '+1234567890',
          required: true,
          validation: '^\\+?[1-9]\\d{1,14}$'
        });
      }

      if (task.requiredProof.includes('transactionId')) {
        defaultFields.push({
          fieldId: `field-${uuidv4().substring(0, 6)}`,
          label: 'Transaction ID',
          type: 'text',
          placeholder: 'Enter transaction ID',
          required: true
        });
      }

      return {
        fields: defaultFields,
        instructions: task.instructions,
        requirements: task.requirements,
        referralLink: task.referralLink
      };
    } catch (error) {
      console.error('Generate proof form error:', error);
      throw error;
    }
  }

  /**
   * Process and optimize screenshot
   */
  async processScreenshot(file) {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const ext = path.extname(file.originalname);
      const filename = `screenshot-${timestamp}-${random}${ext}`;
      
      // In production, you would:
      // 1. Upload to cloud storage (S3, Cloudinary, etc.)
      // 2. Optimize image (compress, resize)
      // 3. Remove EXIF data
      // 4. Return public URL
      
      const publicUrl = `/uploads/screenshots/${filename}`;
      
      return {
        filename,
        url: publicUrl,
        size: file.size,
        mimetype: file.mimetype
      };
    } catch (error) {
      console.error('Process screenshot error:', error);
      throw error;
    }
  }

  /**
   * Send verification notification to admin
   */
  async sendVerificationNotification(submission) {
    try {
      // In production, implement:
      // 1. Email notification
      // 2. Telegram bot notification
      // 3. In-app notification
      // 4. Push notification
      
      console.log(`[NOTIFICATION] New submission pending verification: ${submission.submissionId}`);
      
      return {
        sent: true,
        method: 'console',
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Send notification error:', error);
      return { sent: false, error: error.message };
    }
  }

  /**
   * Auto reject expired tasks
   */
  async autoRejectExpiredTasks() {
    try {
      const expirationDays = 30; // Auto reject after 30 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - expirationDays);
      
      const result = await CustomTaskSubmission.updateMany(
        {
          status: 'pending',
          submittedAt: { $lt: cutoffDate }
        },
        {
          status: 'rejected',
          rejectionReason: 'Auto-rejected: Verification timeout',
          processedAt: new Date()
        }
      );

      return {
        rejected: result.modifiedCount,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Auto reject expired error:', error);
      throw error;
    }
  }

  /**
   * Calculate conversion rates
   */
  async calculateConversionRates(taskId = null) {
    try