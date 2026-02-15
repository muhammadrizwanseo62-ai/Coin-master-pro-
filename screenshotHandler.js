const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

class ScreenshotHandler {
  constructor() {
    this.uploadDir = path.join(__dirname, '../../uploads/screenshots');
    this.ensureDirectoryExists();
  }

  ensureDirectoryExists() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async saveScreenshot(base64Data, sessionId, userId) {
    try {
      const base64Image = base64Data.split(';base64,').pop();
      const imageBuffer = Buffer.from(base64Image, 'base64');
      
      const filename = `${userId}_${sessionId}_${uuidv4()}.png`;
      const filepath = path.join(this.uploadDir, filename);
      
      await sharp(imageBuffer)
        .png({ quality: 90 })
        .toFile(filepath);
      
      const url = `/uploads/screenshots/${filename}`;
      
      return url;
    } catch (error) {
      console.error('Screenshot save error:', error);
      throw new Error('Failed to save screenshot');
    }
  }

  async validateScreenshot(screenshot, gameData) {
    try {
      const metadata = await sharp(screenshot).metadata();
      
      if (metadata.width < 200 || metadata.height < 200) {
        return { valid: false, reason: 'Screenshot too small' };
      }
      
      if (metadata.size > 5 * 1024 * 1024) {
        return { valid: false, reason: 'Screenshot too large' };
      }
      
      return { valid: true };
    } catch (error) {
      console.error('Screenshot validation error:', error);
      return { valid: false, reason: 'Invalid screenshot' };
    }
  }

  async deleteScreenshot(screenshotUrl) {
    try {
      const filename = path.basename(screenshotUrl);
      const filepath = path.join(this.uploadDir, filename);
      
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Screenshot deletion error:', error);
      return false;
    }
  }
}

module.exports = new ScreenshotHandler();