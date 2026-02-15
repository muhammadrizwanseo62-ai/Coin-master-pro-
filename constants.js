// AUTOMATIC REFERRAL BONUS SYSTEM - ZERO MANUAL INTERVENTION
module.exports = {
  // ============ REFERRAL BONUS - AUTOMATIC ============
  REFERRAL_BONUS: {
    REFERRER: 1500, // Instant automatic 1500 coins
    REFEREE: 500    // Instant automatic 500 coins
  },
  
  // ============ EXCHANGE RATES - FIXED ============
  EXCHANGE_RATE: {
    COINS_PER_USD: 5000,      // 5000 coins = $1 USD
    USD_PER_COIN: 0.0002,     // 1 coin = $0.0002 USD
  },
  
  // ============ WITHDRAWAL SYSTEM - 15TH ONLY ============
  MIN_WITHDRAWAL_USD: 15,              // $15 minimum
  MIN_WITHDRAWAL_COINS: 75000,         // 75,000 coins
  MAX_WITHDRAWAL_COINS: 2500000,       // $500 = 2.5M coins
  WITHDRAWAL_FEE: 15,                 // 15% fee
  WITHDRAWAL_DAY: 15,                // 15th only
  CRYPTO_TYPE: 'USDT-TON',          // USDT on TON blockchain
  
  // ============ ELIGIBILITY REQUIREMENTS - STRICT ============
  WITHDRAWAL_REQUIREMENTS: {
    MIN_ACCOUNT_AGE_DAYS: 30,        // Account age >= 30 days
    MIN_GAMES_PLAYED: 100,           // Minimum 100 games
    MIN_REFERRALS: 5,               // Minimum 5 active referrals
    MIN_LOGIN_STREAK: 7,           // Minimum 7-day login streak
  },
  
  // ============ DATABASE ============
  DB_URI: process.env.DB_URI || 'mongodb://localhost:27017/gameapp',
  
  // ============ JWT ============
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-this',
  JWT_EXPIRE: '30d',
  
  // ============ TELEGRAM BOT ============
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHANNEL_ID: process.env.TELEGRAM_CHANNEL_ID,
  
  // ============ CRON JOBS ============
  CRON_SCHEDULES: {
    PROCESS_WITHDRAWALS: '0 0 15 * *', // 15th of every month at 00:00
    CHECK_ELIGIBILITY: '0 0 * * *',    // Daily at midnight
    SEND_REMINDERS: '0 9 14 * *'       // 14th at 9:00 AM
  }
};