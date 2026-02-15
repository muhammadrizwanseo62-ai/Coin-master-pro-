const crypto = require('crypto');
const logger = require('./logger');

class TelegramVerifier {
    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    }

    verify(initData) {
        try {
            if (!initData) {
                throw new Error('No init data provided');
            }

            const urlParams = new URLSearchParams(initData);
            const hash = urlParams.get('hash');
            
            if (!hash) {
                throw new Error('No hash found in init data');
            }

            urlParams.delete('hash');
            
            // Sort parameters alphabetically
            const sortedParams = Array.from(urlParams.entries())
                .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                .map(([key, value]) => `${key}=${value}`)
                .join('\n');

            // Create secret key from bot token
            const secretKey = crypto
                .createHmac('sha256', 'WebAppData')
                .update(this.botToken)
                .digest();

            // Calculate hash
            const calculatedHash = crypto
                .createHmac('sha256', secretKey)
                .update(sortedParams)
                .digest('hex');

            // Compare hashes
            if (calculatedHash === hash) {
                // Parse user data if exists
                const user = urlParams.get('user');
                if (user) {
                    const userData = JSON.parse(decodeURIComponent(user));
                    return {
                        ...userData,
                        auth_date: urlParams.get('auth_date'),
                        start_param: urlParams.get('start_param')
                    };
                }
                return null;
            }

            return null;
        } catch (error) {
            logger.error('Telegram verification error:', error);
            return null;
        }
    }

    // Generate hash for testing
    generateHash(data) {
        const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(this.botToken)
            .digest();

        const checkString = Object.keys(data)
            .sort()
            .map(key => `${key}=${data[key]}`)
            .join('\n');

        return crypto
            .createHmac('sha256', secretKey)
            .update(checkString)
            .digest('hex');
    }
}

module.exports = new TelegramVerifier();