const CustomTaskSubmission = require('../models/CustomTaskSubmission');
const User = require('../models/User');
const axios = require('axios');
const { createHash } = require('crypto');

/**
 * Task Fraud Prevention Service
 */
class TaskFraudService {
  /**
   * Detect duplicate submissions
   */
  async detectDuplicateSubmissions(data) {
    try {
      const { taskId, userId, proofData, screenshotUrls, submittedLink } = data;
      
      const reasons = [];
      let isDuplicate = false;
      let duplicateOf = null;
      let fraudScore = 0;

      // Create hash of submission for comparison
      const submissionHash = this.createSubmissionHash({
        taskId,
        userId,
        proofData,
        screenshotUrls,
        submittedLink
      });

      // Check for exact duplicates in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const existingSubmission = await CustomTaskSubmission.findOne({
        taskId,
        userId,
        submittedAt: { $gte: thirtyDaysAgo }
      }).sort({ submittedAt: -1 });

      if (existingSubmission) {
        // Check if same proof data
        const existingHash = this.createSubmissionHash({
          taskId: existingSubmission.taskId,
          userId: existingSubmission.userId,
          proofData: existingSubmission.proofData,
          screenshotUrls: existingSubmission.screenshotUrls,
          submittedLink: existingSubmission.submittedLink
        });

        if (existingHash === submissionHash) {
          isDuplicate = true;
          duplicateOf = existingSubmission._id;
          fraudScore += 80;
          reasons.push('Exact duplicate submission');
        }
      }

      // Check for duplicate across different users (same proof)
      const sameProofSubmissions = await CustomTaskSubmission.find({
        taskId,
        submittedLink: submittedLink ? { $exists: true, $eq: submittedLink } : { $exists: false },
        screenshotUrls: screenshotUrls?.length > 0 ? { $in: screenshotUrls } : { $exists: false }
      }).limit(5);

      if (sameProofSubmissions.length > 1) {
        fraudScore += 50;
        reasons.push('Proof already submitted by another user');
      }

      return {
        isDuplicate,
        duplicateOf,
        fraudScore,
        reasons,
        isSuspicious: fraudScore > 30
      };
    } catch (error) {
      console.error('Duplicate detection error:', error);
      return {
        isDuplicate: false,
        duplicateOf: null,
        fraudScore: 0,
        reasons: ['Duplicate detection failed'],
        isSuspicious: false
      };
    }
  }

  /**
   * Create hash of submission for comparison
   */
  createSubmissionHash(data) {
    const stringData = JSON.stringify({
      proofData: data.proofData?.map(p => ({ fieldId: p.fieldId, value: p.fieldValue })),
      screenshotUrls: data.screenshotUrls?.sort(),
      submittedLink: data.submittedLink
    });
    
    return createHash('sha256').update(stringData).digest('hex');
  }

  /**
   * Detect VPN usage
   */
  async detectVPNUsage(ip) {
    try {
      // In production, integrate with VPN detection API
      // This is a mock implementation
      
      const vpnIPRanges = [
        '10.', '172.16.', '172.17.', '172.18.', '172.19.',
        '172.20.', '172.21.', '172.22.', '172.23.', '172.24.',
        '172.25.', '172.26.', '172.27.', '172.28.', '172.29.',
        '172.30.', '172.31.', '192.168.'
      ];

      const isPrivate = vpnIPRanges.some(range => ip.startsWith(range));
      
      // Known VPN IPs (mock)
      const knownVPNs = ['1.2.3.4', '5.6.7.8'];
      const isKnownVPN = knownVPNs.includes(ip);

      return {
        isVPN: isPrivate || isKnownVPN,
        confidence: isKnownVPN ? 100 : (isPrivate ? 80 : 0),
        provider: isKnownVPN ? 'Known VPN' : (isPrivate ? 'Private IP' : null)
      };
    } catch (error) {
      console.error('VPN detection error:', error);
      return {
        isVPN: false,
        confidence: 0,
        provider: null
      };
    }
  }

  /**
   * Detect proxy IPs
   */
  async detectProxyIPs(ip) {
    try {
      // In production, integrate with proxy detection API
      // Mock implementation
      
      const proxyIPs = ['11.22.33.44', '55.66.77.88'];
      const isProxy = proxyIPs.includes(ip);
      
      return {
        isProxy,
        confidence: isProxy ? 90 : 0,
        type: isProxy ? 'Public Proxy' : null
      };
    } catch (error) {
      console.error('Proxy detection error:', error);
      return {
        isProxy: false,
        confidence: 0,
        type: null
      };
    }
  }

  /**
   * Generate device fingerprint
   */
  async deviceFingerprinting(data) {
    try {
      const { userAgent, screenResolution, timezone, language, platform } = data;
      
      const components = {
        userAgent,
        screenResolution,
        timezone,
        language,
        platform,
        timestamp: Date.now()
      };

      const fingerprint = createHash('sha256')
        .update(JSON.stringify(components))
        .digest('hex');

      return {
        fingerprint,
        components,
        confidence: 85
      };
    } catch (error) {
      console.error('Device fingerprinting error:', error);
      return {
        fingerprint: null,
        components: {},
        confidence: 0
      };
    }
  }

  /**
   * Behavior analysis
   */
  async behaviorAnalysis(userId, taskId) {
    try {
      const reasons = [];
      let fraudScore = 0;

      // Get user's submission history
      const submissions = await CustomTaskSubmission.find({
        userId,
        submittedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }).sort({ submittedAt: 1 });

      if (submissions.length > 0) {
        // Check submission speed
        if (submissions.length > 10) {
          fraudScore += 30;
          reasons.push('Too many submissions in 24 hours');
        }

        // Check time between submissions
        for (let i = 1; i < submissions.length; i++) {
          const timeDiff = submissions[i].submittedAt - submissions[i-1].submittedAt;
          if (timeDiff < 30000) { // Less than 30 seconds
            fraudScore += 20;
            reasons.push('Submissions too close together');
            break;
          }
        }
      }

      // Check for task-specific behavior
      if (taskId) {
        const taskSubmissions = submissions.filter(s => 
          s.taskId.toString() === taskId.toString()
        );

        if (taskSubmissions.length > 5) {
          fraudScore += 40;
          reasons.push('Unusual activity on single task');
        }
      }

      return {
        fraudScore: Math.min(fraudScore, 100),
        reasons,
        isSuspicious: fraudScore > 50,
        submissionCount: submissions.length
      };
    } catch (error) {
      console.error('Behavior analysis error:', error);
      return {
        fraudScore: 0,
        reasons: ['Behavior analysis failed'],
        isSuspicious: false,
        submissionCount: 0
      };
    }
  }

  /**
   * Blacklist management
   */
  async blacklistManagement(userId, action) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      switch (action) {
        case 'add':
          user.isBlacklisted = true;
          user.blacklistedAt = new Date();
          user.blacklistReason = action.reason || 'Fraud detected';
          break;
          
        case 'remove':
          user.isBlacklisted = false;
          user.blacklistedAt = null;
          user.blacklistReason = null;
          break;
          
        case 'warning':
          user.fraudWarnings = (user.fraudWarnings || 0) + 1;
          user.lastFraudWarning = new Date();
          break;
      }

      await user.save();

      return {
        success: true,
        userId,
        action,
        isBlacklisted: user.isBlacklisted,
        fraudWarnings: user.fraudWarnings || 0
      };
    } catch (error) {
      console.error('Blacklist management error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check for VPN/Proxy before allowing task
   */
  async checkVPNProxy(ip, task) {
    try {
      if (!task.blockVPN && !task.blockProxy) {
        return { allowed: true };
      }

      const [vpnCheck, proxyCheck] = await Promise.all([
        this.detectVPNUsage(ip),
        this.detectProxyIPs(ip)
      ]);

      const blocked = [];
      const reasons = [];

      if (task.blockVPN && vpnCheck.isVPN) {
        blocked.push('VPN');
        reasons.push('VPN usage is not allowed for this task');
      }

      if (task.blockProxy && proxyCheck.isProxy) {
        blocked.push('Proxy');
        reasons.push('Proxy usage is not allowed for this task');
      }

      return {
        allowed: blocked.length === 0,
        blocked,
        reasons,
        vpn: vpnCheck,
        proxy: proxyCheck
      };
    } catch (error) {
      console.error('VPN/Proxy check error:', error);
      return {
        allowed: false,
        blocked: ['Unknown'],
        reasons: ['Failed to check connection security']
      };
    }
  }

  /**
   * Check for same IP usage
   */
  async checkSameIP(taskId, ip, userId) {
    try {
      if (!ip) {
        return { allowed: true };
      }

      const recentSubmissions = await CustomTaskSubmission.find({
        taskId,
        ip,
        userId: { $ne: userId },
        submittedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });

      if (recentSubmissions.length > 0) {
        return {
          allowed: false,
          reason: 'This IP address has already been used for this task',
          count: recentSubmissions.length
        };
      }

      return {
        allowed: true,
        count: 0
      };
    } catch (error) {
      console.error('Same IP check error:', error);
      return {
        allowed: false,
        reason: 'Failed to check IP usage'
      };
    }
  }
}

module.exports = new TaskFraudService();