const axios = require('axios');
const { URL } = require('url');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

/**
 * Proof Validator Service
 */
class ProofValidatorService {
  /**
   * Validate screenshot
   */
  async validateScreenshot(imageUrl) {
    try {
      const reasons = [];
      let valid = true;

      // Check if URL is valid
      if (!imageUrl.match(/^https?:\/\//i)) {
        return {
          valid: false,
          reason: 'Invalid image URL format',
          fraudScore: 80
        };
      }

      // In production, you would:
      // 1. Download the image
      // 2. Check EXIF data
      // 3. Detect edited images
      // 4. Check resolution
      // 5. OCR for text validation

      // Mock validation for demo
      const isSuspicious = imageUrl.includes('suspicious') || 
                          imageUrl.includes('fake') ||
                          imageUrl.includes('edited');

      if (isSuspicious) {
        valid = false;
        reasons.push('Suspicious image detected');
      }

      return {
        valid,
        reason: valid ? 'Screenshot validated' : reasons.join(', '),
        fraudScore: valid ? 0 : 70
      };
    } catch (error) {
      console.error('Screenshot validation error:', error);
      return {
        valid: false,
        reason: 'Screenshot validation failed',
        fraudScore: 100
      };
    }
  }

  /**
   * Validate link/URL
   */
  async validateLink(url) {
    try {
      // Basic URL validation
      if (!url || typeof url !== 'string') {
        return false;
      }

      // Check URL format
      try {
        new URL(url);
      } catch {
        return false;
      }

      // Check if URL is reachable
      try {
        const response = await axios.head(url, {
          timeout: 5000,
          validateStatus: false
        });
        
        // Accept 2xx and 3xx status codes
        return response.status >= 200 && response.status < 400;
      } catch {
        // If HEAD fails, try GET with range
        try {
          const response = await axios.get(url, {
            timeout: 5000,
            headers: { 'Range': 'bytes=0-0' },
            validateStatus: false
          });
          return response.status >= 200 && response.status < 400;
        } catch {
          return false;
        }
      }
    } catch (error) {
      console.error('Link validation error:', error);
      return false;
    }
  }

  /**
   * Validate social media username
   */
  async validateUsername(username, platform) {
    try {
      if (!username || typeof username !== 'string') {
        return false;
      }

      // Platform-specific validation
      switch (platform.toLowerCase()) {
        case 'instagram':
          // Instagram: 1-30 chars, letters, numbers, periods, underscores
          return /^[a-zA-Z0-9._]{1,30}$/.test(username);
        
        case 'telegram':
          // Telegram: 5-32 chars, letters, numbers, underscore
          return /^[a-zA-Z0-9_]{5,32}$/.test(username);
        
        case 'discord':
          // Discord: username#discriminator
          return /^.{2,32}#[0-9]{4}$/.test(username);
        
        case 'twitter':
          // Twitter: 1-15 chars, letters, numbers, underscore
          return /^[a-zA-Z0-9_]{1,15}$/.test(username);
        
        case 'tiktok':
          // TikTok: 1-24 chars, letters, numbers, underscores, periods
          return /^[a-zA-Z0-9_.]{1,24}$/.test(username);
        
        case 'youtube':
          // YouTube handle: @handle or custom
          return username.length > 0 && username.length <= 30;
        
        case 'facebook':
          // Facebook: profile name or username
          return username.length > 0 && username.length <= 50;
        
        default:
          // Generic username validation
          return /^[a-zA-Z0-9_.@-]{3,50}$/.test(username);
      }
    } catch (error) {
      console.error('Username validation error:', error);
      return false;
    }
  }

  /**
   * Validate email address
   */
  async validateEmail(email) {
    try {
      if (!email || typeof email !== 'string') {
        return false;
      }

      // Basic email regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      if (!emailRegex.test(email)) {
        return false;
      }

      // Check length
      if (email.length > 254) {
        return false;
      }

      // Check domain
      const domain = email.split('@')[1];
      if (domain.length > 255) {
        return false;
      }

      // Disposable email domains (mock)
      const disposableDomains = ['tempmail.com', 'throwaway.com', 'mailinator.com'];
      if (disposableDomains.includes(domain)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Email validation error:', error);
      return false;
    }
  }

  /**
   * Validate phone number
   */
  async validatePhone(phone, country = 'US') {
    try {
      if (!phone || typeof phone !== 'string') {
        return false;
      }

      // Remove all non-digit characters
      const digits = phone.replace(/\D/g, '');

      // Country-specific validation
      switch (country) {
        case 'US':
        case 'CA':
          // US/Canada: 10 digits
          return digits.length === 10 || 
                 (digits.length === 11 && digits.startsWith('1'));
        
        case 'UK':
          // UK: 10-11 digits
          return digits.length >= 10 && digits.length <= 11;
        
        case 'AU':
          // Australia: 9-10 digits
          return digits.length >= 9 && digits.length <= 10;
        
        case 'DE':
          // Germany: 10-12 digits
          return digits.length >= 10 && digits.length <= 12;
        
        case 'FR':
          // France: 9 digits
          return digits.length === 9;
        
        default:
          // International: 7-15 digits
          return digits.length >= 7 && digits.length <= 15;
      }
    } catch (error) {
      console.error('Phone validation error:', error);
      return false;
    }
  }

  /**
   * Extract metadata from image
   */
  async extractMetadata(imagePath) {
    try {
      const metadata = await sharp(imagePath).metadata();
      
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size,
        space: metadata.space,
        channels: metadata.channels,
        depth: metadata.depth,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation,
        exif: metadata.exif || null,
        icc: metadata.icc || null,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Metadata extraction error:', error);
      return null;
    }
  }

  /**
   * Detect forgery in screenshots
   */
  async detectForgery(imagePath) {
    try {
      const reasons = [];
      let isForgery = false;
      let confidence = 0;

      // Get metadata
      const metadata = await this.extractMetadata(imagePath);
      
      if (!metadata) {
        return {
          isForgery: true,
          confidence: 100,
          reasons: ['Could not read image metadata']
        };
      }

      // Check for edited images (simplified)
      if (metadata.exif) {
        const exifString = JSON.stringify(metadata.exif).toLowerCase();
        
        // Check for editing software
        const editingSoftware = ['photoshop', 'lightroom', 'gimp', 'paint', 'editor', 'canva'];
        for (const software of editingSoftware) {
          if (exifString.includes(software)) {
            reasons.push(`Image edited with ${software}`);
            isForgery = true;
            confidence += 30;
          }
        }
      }

      // Check for screenshots (should be certain resolution)
      if (metadata.width && metadata.height) {
        const aspectRatio = metadata.width / metadata.height;
        
        // Common screenshot aspect ratios
        if (aspectRatio > 2.0 || aspectRatio < 0.5) {
          reasons.push('Unusual aspect ratio for screenshot');
          isForgery = true;
          confidence += 20;
        }
      }

      // Check file size (too small = suspicious)
      if (metadata.size && metadata.size < 10000) { // Less than 10KB
        reasons.push('Image file size too small');
        isForgery = true;
        confidence += 50;
      }

      return {
        isForgery,
        confidence: Math.min(confidence, 100),
        reasons,
        metadata
      };
    } catch (error) {
      console.error('Forgery detection error:', error);
      return {
        isForgery: true,
        confidence: 100,
        reasons: ['Forgery detection failed']
      };
    }
  }

  /**
   * Validate timestamp
   */
  async validateTimestamp(timestamp, maxAgeHours = 24) {
    try {
      const submissionTime = new Date(timestamp).getTime();
      const now = Date.now();
      const ageHours = (now - submissionTime) / (1000 * 60 * 60);
      
      return {
        valid: ageHours <= maxAgeHours,
        ageHours: parseFloat(ageHours.toFixed(2)),
        maxAgeHours,
        timestamp: submissionTime
      };
    } catch (error) {
      console.error('Timestamp validation error:', error);
      return {
        valid: false,
        ageHours: Infinity,
        maxAgeHours,
        error: error.message
      };
    }
  }

  /**
   * Compare screenshots for duplicates
   */
  async compareScreenshots(image1Path, image2Path) {
    try {
      // In production, use perceptual hashing
      // This is a simplified version
      
      const img1 = await sharp(image1Path).raw().toBuffer();
      const img2 = await sharp(image2Path).raw().toBuffer();
      
      // Simple byte comparison (not reliable for similar images)
      const isIdentical = img1.equals(img2);
      
      return {
        isDuplicate: isIdentical,
        similarity: isIdentical ? 100 : 0,
        method: 'byte-comparison'
      };
    } catch (error) {
      console.error('Screenshot comparison error:', error);
      return {
        isDuplicate: false,
        similarity: 0,
        error: error.message
      };
    }
  }
}

module.exports = new ProofValidatorService();