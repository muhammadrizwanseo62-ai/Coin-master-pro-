const CPAConversion = require('../models/CPAConversion');
const User = require('../models/User');
const { createHash } = require('crypto');

/**
 * CPA Fraud Prevention Middleware
 */
class CPAFraudMiddleware {
  /**
   * Check IP duplication
   */
  async checkIPDuplication(conversionData) {
    try {
      const { ip, offerId, userId } = conversionData;
      
      if (!ip) {
        return { valid: true, reasons: [] };
      }

      const recentConversions = await CPAConversion.find({
        ip,
        offerId,
        userId: { $ne: userId },
        conversionDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });

      if (recentConversions.length >= 3) {
        return {
          valid: false,
          reasons: [`IP address ${ip} has been used for ${recentConversions.length} conversions today`]
        };
      }

      return { valid: true, reasons: [] };
    } catch (error) {
      console.error('IP duplication check error:', error);
      return { valid: false, reasons: ['IP check failed'] };
    }
  }

  /**
   * Check device fingerprint
   */
  async checkDeviceFingerprint(conversionData) {
    try {
      const { userAgent, platform, userId } = conversionData;
      
      if (!userAgent) {
        return { valid: true, reasons: [] };
      }

      // Generate device fingerprint
      const fingerprint = createHash('sha256')
        .update(`${userAgent}-${platform || ''}`)
        .digest('hex');

      const recentConversions = await CPAConversion.find({
        userId,
        conversionDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });

      if (recentConversions.length >= 10) {
        return {
          valid: false,
          reasons: ['Too many conversions from this device today']
        };
      }

      return { valid: true, reasons: [], fingerprint };
    } catch (error) {
      console.error('Device fingerprint error:', error);
      return { valid: false, reasons: ['Device check failed'] };
    }
  }

  /**
   * Check VPN/Proxy
   */
  async checkVPNProxy(conversionData) {
    try {
      const { ip } = conversionData;
      
      if (!ip) {
        return { valid: true, reasons: [] };
      }

      // Mock VPN detection
      const vpnIPs = ['1.2.3.4', '5.6.7.8'];
      
      if (vpnIPs.includes(ip)) {
        return {
          valid: false,
          reasons: ['VPN/Proxy detected']
        };
      }

      return { valid: true, reasons: [] };
    } catch (error) {
      console.error('VPN/Proxy check error:', error);
      return { valid: false, reasons: ['VPN check failed'] };
    }
  }

  /**
   * Check same user multiple accounts
   */
  async checkSameUserMultipleAccounts(conversionData) {
    try {
      const { ip, userId } = conversionData;
      
      if (!ip) {
        return { valid: true, reasons: [] };
      }

      const usersWithSameIP = await User.countDocuments({
        lastLoginIP: ip,
        _id: { $ne: userId }
      });

      if (usersWithSameIP >= 3) {
        return {
          valid: false,
          reasons: [`IP address ${ip} associated with multiple accounts`]
        };
      }

      return { valid: true, reasons: [] };
    } catch (error) {
      console.error('Multiple accounts check error:', error);
      return { valid: false, reasons: ['Account check failed'] };
    }
  }

  /**
   * Check time between conversions
   */
  async checkTimeBetweenConversions(conversionData) {
    try {
      const { userId } = conversionData;

      const lastConversion = await CPAConversion.findOne({
        userId,
        status: 'approved'
      }).sort({ conversionDate: -1 });

      if (lastConversion) {
        const secondsSince = (Date.now() - lastConversion.conversionDate) / 1000;
        
        if (secondsSince < 30) {
          return {
            valid: false,
            reasons: [`Only ${Math.floor(secondsSince)} seconds since last conversion`]
          };
        }
      }

      return { valid: true, reasons: [] };
    } catch (error) {
      console.error('Time between conversions error:', error);
      return { valid: false, reasons: ['Time check failed'] };
    }
  }

  /**
   * Check geolocation mismatch
   */
  async checkGeolocationMismatch(conversionData) {
    try {
      const { ip, country } = conversionData;
      
      if (!ip || !country) {
        return { valid: true, reasons: [] };
      }

      // Mock geolocation check
      const ipCountry = 'US'; // In production, lookup IP geolocation
      
      if (ipCountry !== country) {
        return {
          valid: false,
          reasons: ['Geolocation mismatch between IP and provided country']
        };
      }

      return { valid: true, reasons: [] };
    } catch (error) {
      console.error('Geolocation mismatch error:', error);
      return { valid: false, reasons: ['Geolocation check failed'] };
    }
  }

  /**
   * Main fraud check middleware
   */
  async checkFraud(req, res, next) {
    try {
      const conversionData = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        platform: req.body.platform,
        userId: req.body.userId,
        offerId: req.body.offerId,
        country: req.body.country || req.headers['cf-ipcountry']
      };

      const checks = await Promise.all([
        this.checkIPDuplication(conversionData),
        this.checkDeviceFingerprint(conversionData),
        this.checkVPNProxy(conversionData),
        this.checkSameUserMultipleAccounts(conversionData),
        this.checkTimeBetweenConversions(conversionData),
        this.checkGeolocationMismatch(conversionData)
      ]);

      const failedChecks = checks.filter(check => !check.valid);
      
      if (failedChecks.length > 0) {
        const reasons = failedChecks.flatMap(check => check.reasons);
        
        return res.status(403).json({
          success: false,
          message: 'Fraud detection triggered',
          reasons,
          fraudScore: reasons.length * 20
        });
      }

      // Add fingerprint to request
      req.deviceFingerprint = checks[1].fingerprint;
      
      next();
    } catch (error) {
      console.error('Fraud check error:', error);
      next();
    }
  }
}

module.exports = new CPAFraudMiddleware();