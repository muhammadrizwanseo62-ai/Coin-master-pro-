const CustomTask = require('../models/CustomTask');
const User = require('../models/User');
const taskFraudService = require('../services/taskFraudService');

/**
 * Task Eligibility Middleware
 */
class TaskEligibilityMiddleware {
  /**
   * Check all eligibility requirements
   */
  async checkAll(req, res, next) {
    try {
      const taskId = req.params.id;
      const userId = req.user._id;
      
      const task = await CustomTask.findById(taskId);
      const user = await User.findById(userId);
      
      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Task not found'
        });
      }

      const errors = [];

      // Check account age
      if (task.minAccountAge > 0) {
        const accountAgeDays = (Date.now() - user.createdAt) / (1000 * 60 * 60 * 24);
        if (accountAgeDays < task.minAccountAge) {
          errors.push(`Account must be at least ${task.minAccountAge} days old`);
        }
      }

      // Check games played
      if (task.minGamesPlayed > 0 && (user.gamesPlayed || 0) < task.minGamesPlayed) {
        errors.push(`Need to play at least ${task.minGamesPlayed} games`);
      }

      // Check referrals
      if (task.minReferrals > 0 && (user.referrals || 0) < task.minReferrals) {
        errors.push(`Need at least ${task.minReferrals} referrals`);
      }

      // Check login streak
      if (task.minLoginStreak > 0 && (user.loginStreak || 0) < task.minLoginStreak) {
        errors.push(`Need ${task.minLoginStreak} day login streak`);
      }

      // Check country
      if (task.countries.length > 0 && !task.countries.includes('WW')) {
        const userCountry = req.headers['cf-ipcountry'] || user.country || 'WW';
        if (!task.countries.includes(userCountry) && !task.countries.includes('WW')) {
          errors.push('Task not available in your country');
        }
      }

      if (errors.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Eligibility check failed',
          errors
        });
      }

      next();
    } catch (error) {
      console.error('Eligibility check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Eligibility check failed',
        error: error.message
      });
    }
  }

  /**
   * Check account age only
   */
  async checkAccountAge(req, res, next) {
    try {
      const task = await CustomTask.findById(req.params.id);
      const user = await User.findById(req.user._id);
      
      if (task.minAccountAge > 0) {
        const accountAgeDays = (Date.now() - user.createdAt) / (1000 * 60 * 60 * 24);
        if (accountAgeDays < task.minAccountAge) {
          return res.status(403).json({
            success: false,
            message: `Account must be at least ${task.minAccountAge} days old`,
            currentAge: Math.floor(accountAgeDays),
            requiredAge: task.minAccountAge
          });
        }
      }
      
      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check games played only
   */
  async checkGamesPlayed(req, res, next) {
    try {
      const task = await CustomTask.findById(req.params.id);
      const user = await User.findById(req.user._id);
      
      if (task.minGamesPlayed > 0 && (user.gamesPlayed || 0) < task.minGamesPlayed) {
        return res.status(403).json({
          success: false,
          message: `Need to play at least ${task.minGamesPlayed} games`,
          current: user.gamesPlayed || 0,
          required: task.minGamesPlayed
        });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check referrals only
   */
  async checkReferrals(req, res, next) {
    try {
      const task = await CustomTask.findById(req.params.id);
      const user = await User.findById(req.user._id);
      
      if (task.minReferrals > 0 && (user.referrals || 0) < task.minReferrals) {
        return res.status(403).json({
          success: false,
          message: `Need at least ${task.minReferrals} referrals`,
          current: user.referrals || 0,
          required: task.minReferrals
        });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check login streak only
   */
  async checkLoginStreak(req, res, next) {
    try {
      const task = await CustomTask.findById(req.params.id);
      const user = await User.findById(req.user._id);
      
      if (task.minLoginStreak > 0 && (user.loginStreak || 0) < task.minLoginStreak) {
        return res.status(403).json({
          success: false,
          message: `Need ${task.minLoginStreak} day login streak`,
          current: user.loginStreak || 0,
          required: task.minLoginStreak
        });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check country restrictions
   */
  async checkCountryRestrictions(req, res, next) {
    try {
      const task = await CustomTask.findById(req.params.id);
      const userCountry = req.headers['cf-ipcountry'] || 
                         req.headers['x-country-code'] || 
                         req.query.country || 
                         'WW';
      
      if (task.countries.length > 0 && !task.countries.includes('WW')) {
        if (!task.countries.includes(userCountry)) {
          return res.status(403).json({
            success: false,
            message: 'Task not available in your country',
            country: userCountry,
            allowedCountries: task.countries
          });
        }
      }
      
      if (task.countriesBlacklist.length > 0) {
        if (task.countriesBlacklist.includes(userCountry)) {
          return res.status(403).json({
            success: false,
            message: 'Task not available in your country',
            country: userCountry,
            blocked: true
          });
        }
      }
      
      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check daily limit
   */
  async checkDailyLimit(req, res, next) {
    try {
      const task = await CustomTask.findById(req.params.id);
      
      if (task.dailyLimit > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todaySubmissions = await CustomTaskSubmission.countDocuments({
          taskId: task._id,
          submittedAt: { $gte: today }
        });
        
        if (todaySubmissions >= task.dailyLimit) {
          return res.status(403).json({
            success: false,
            message: 'Daily limit reached for this task',
            current: todaySubmissions,
            limit: task.dailyLimit
          });
        }
      }
      
      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check cooldown period
   */
  async checkCooldownPeriod(req, res, next) {
    try {
      const task = await CustomTask.findById(req.params.id);
      
      if (task.userCooldown > 0) {
        const lastSubmission = await CustomTaskSubmission.findOne({
          taskId: task._id,
          userId: req.user._id,
          status: 'approved'
        }).sort({ submittedAt: -1 });
        
        if (lastSubmission) {
          const hoursSince = (Date.now() - lastSubmission.submittedAt) / (1000 * 60 * 60);
          if (hoursSince < task.userCooldown) {
            return res.status(403).json({
              success: false,
              message: `Please wait before doing this task again`,
              hoursRemaining: Math.ceil(task.userCooldown - hoursSince),
              cooldown: task.userCooldown
            });
          }
        }
      }
      
      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check VPN/Proxy
   */
  async checkVPNProxy(req, res, next) {
    try {
      const task = await CustomTask.findById(req.params.id);
      
      if (task.blockVPN || task.blockProxy) {
        const ip = req.ip || req.connection.remoteAddress;
        const check = await taskFraudService.checkVPNProxy(ip, task);
        
        if (!check.allowed) {
          return res.status(403).json({
            success: false,
            message: 'Connection type not allowed',
            blocked: check.blocked,
            reasons: check.reasons
          });
        }
      }
      
      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check same IP
   */
  async checkSameIP(req, res, next) {
    try {
      const task = await CustomTask.findById(req.params.id);
      
      if (task.blockSameIP) {
        const ip = req.ip || req.connection.remoteAddress;
        const check = await taskFraudService.checkSameIP(task._id, ip, req.user._id);
        
        if (!check.allowed) {
          return res.status(403).json({
            success: false,
            message: check.reason,
            count: check.count
          });
        }
      }
      
      next();
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TaskEligibilityMiddleware();