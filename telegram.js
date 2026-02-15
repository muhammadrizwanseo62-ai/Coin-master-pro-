const crypto = require('crypto');
const logger = require('../utils/logger');

class TelegramConfig {
    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN;
        this.botUsername = process.env.BOT_USERNAME;
        
        if (!this.botToken) {
            logger.error('TELEGRAM_BOT_TOKEN is not set in environment variables');
        }
    }

    // Get bot token
    getBotToken() {
        return this.botToken;
    }

    // Get bot username
    getBotUsername() {
        return this.botUsername;
    }

    // Generate bot start link with referral
    generateStartLink(referralCode) {
        return `https://t.me/${this.botUsername}?start=${referralCode}`;
    }

    // Generate share text
    generateShareText(referralCode) {
        const startLink = this.generateStartLink(referralCode);
        return {
            message: `🎮 Join me on CoinMaster Pro and get 500 FREE coins! 🪙\n\nPlay now: ${startLink}`,
            link: startLink
        };
    }
}

module.exports = new TelegramConfig();