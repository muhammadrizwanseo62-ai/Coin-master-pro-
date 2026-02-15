const axios = require('axios');
const constants = require('../config/constants');

// ============ AUTOMATIC TELEGRAM NOTIFICATION SYSTEM ============
// INSTANT NOTIFICATIONS - ZERO DELAY
// ==============================================================

class NotificationService {
  constructor() {
    this.botToken = constants.TELEGRAM_BOT_TOKEN;
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Send message to Telegram user
   * @param {string} chatId - Telegram chat ID
   * @param {string} text - Message text
   * @param {Object} options - Additional options
   */
  async sendMessage(chatId, text, options = {}) {
    if (!this.botToken) {
      console.log('📱 [TELEGRAM]:', text);
      return { success: true, mock: true };
    }

    try {
      const response = await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options
      });
      
      return response.data;
    } catch (error) {
      console.error('Failed to send Telegram message:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * AUTOMATIC: Send welcome message with 1500 coins bonus info
   */
  async sendWelcomeMessage(chatId, username, signupBonus) {
    const message = `🎉 <b>WELCOME TO GAMEAPP!</b> 🎉

━━━━━━━━━━━━━━━━━━━
✅ <b>SIGNUP BONUS:</b> +${signupBonus} coins
✅ <b>REFERRAL BONUS:</b> 1500 coins per friend
━━━━━━━━━━━━━━━━━━━

💰 <b>WITHDRAWAL INFO:</b>
• Minimum: $15 USD (75,000 coins)
• Date: 15th of every month ONLY
• Fee: 15% processing fee
• Crypto: USDT on BNB TRX
━━━━━━━━━━━━━━━━━━━

📱 <b>YOUR REFERRAL LINK:</b>
<code>https://t.me/YourBot?start=${username || 'play'}</code>

Invite friends and earn 1500 coins INSTANTLY! 🚀`;

    return this.sendMessage(chatId, message);
  }

  /**
   * AUTOMATIC: Send referral bonus notification - INSTANT
   */
  async sendReferralBonusNotification(chatId, refereeUsername, bonusAmount) {
    const message = `🎁 <b>REFERRAL BONUS EARNED!</b>

━━━━━━━━━━━━━━━━━━━
You invited @${refereeUsername || 'a friend'} and earned:
✅ <b>+${bonusAmount} coins</b>

💰 <b>Balance updated instantly!</b>
━━━━━━━━━━━━━━━━━━━

Keep sharing your referral link to earn more! 🚀`;

    return this.sendMessage(chatId, message);
  }

  /**
   * Send withdrawal confirmation
   */
  async sendWithdrawalConfirmation(chatId, usdAmount, coinAmount, withdrawalId) {
    const message = `💰 <b>WITHDRAWAL REQUEST RECEIVED</b>

━━━━━━━━━━━━━━━━━━━
📊 <b>Amount:</b> $${usdAmount} USD (${coinAmount} coins)
💸 <b>Fee:</b> 15%
📦 <b>Net:</b> $${(usdAmount * 0.85).toFixed(2)} USD
🆔 <b>ID:</b> <code>${withdrawalId}</code>
━━━━━━━━━━━━━━━━━━━

⏳ <b>Processing:</b> Next 15th
🔷 <b>Crypto:</b> USDT on BNB TRX

We'll notify you when processed! ✅`;

    return this.sendMessage(chatId, message);
  }

  /**
   * Send withdrawal processing notification
   */
  async sendWithdrawalProcessingNotification(chatId, usdAmount, withdrawalId) {
    const message = `⚙️ <b>WITHDRAWAL PROCESSING</b>

━━━━━━━━━━━━━━━━━━━
💰 <b>Amount:</b> $${usdAmount} USD
🆔 <b>ID:</b> <code>${withdrawalId}</code>
━━━━━━━━━━━━━━━━━━━

Your withdrawal is being processed today (15th)!
You'll receive the transaction hash shortly. 🔗`;

    return this.sendMessage(chatId, message);
  }

  /**
   * Send withdrawal completed notification
   */
  async sendWithdrawalCompletedNotification(chatId, usdAmount, txHash) {
    const message = `✅ <b>WITHDRAWAL COMPLETED!</b>

━━━━━━━━━━━━━━━━━━━
💰 <b>Amount:</b> $${usdAmount} USD
🔗 <b>Transaction:</b> 
<code>${txHash}</code>
━━━━━━━━━━━━━━━━━━━

📱 <b>View on BscScan:</b>
https://bscscan.com/tx/${txHash}

Thank you for using GameApp! 🎮`;

    return this.sendMessage(chatId, message);
  }

  /**
   * Send withdrawal reminder (14th)
   */
  async sendWithdrawalReminder(chatId) {
    const message = `📅 <b>WITHDRAWAL REMINDER</b>

━━━━━━━━━━━━━━━━━━━
Withdrawals are available TOMORROW (15th)!

💰 <b>Requirements:</b>
• Minimum: $15 USD (75,000 coins)
• Maximum: $500 USD per month
• Fee: 15%
━━━━━━━━━━━━━━━━━━━

Prepare your USDT-BNB TRX wallet address now! 🔷`;

    return this.sendMessage(chatId, message);
  }

  /**
   * Send game earnings notification
   */
  async sendGameEarningsNotification(chatId, amount, gameName) {
    const message = `🎮 <b>GAME EARNINGS!</b>

━━━━━━━━━━━━━━━━━━━
You played ${gameName} and earned:
✅ <b>+${amount} coins</b>

💰 <b>New balance updated!</b>
━━━━━━━━━━━━━━━━━━━

Keep playing to earn more! 🚀`;

    return this.sendMessage(chatId, message);
  }

  /**
   * Send daily login bonus
   */
  async sendDailyLoginBonus(chatId, amount, streak) {
    const message = `🔥 <b>DAILY LOGIN BONUS!</b>

━━━━━━━━━━━━━━━━━━━
✅ <b>+${amount} coins</b> for logging in
📊 <b>Login streak:</b> ${streak} days

Come back tomorrow for more! 🎯`;

    return this.sendMessage(chatId, message);
  }

  /**
   * Send eligibility granted notification
   */
  async sendEligibilityGranted(chatId) {
    const message = `✅ <b>WITHDRAWAL ELIGIBLE!</b>

━━━━━━━━━━━━━━━━━━━
Congratulations! You now meet all requirements for withdrawals.

💰 <b>You can withdraw:</b>
• Minimum: $15 USD
• When: 15th of every month
• Crypto: USDT on BNB TRX

Visit the withdrawal section to request! 🚀`;

    return this.sendMessage(chatId, message);
  }
}

// Export singleton instance
module.exports = new NotificationService();