const constants = require('../config/constants');

/**
 * REFERRAL BONUS CALCULATOR
 * AUTOMATIC: Always returns 1500 coins
 * NO MANUAL INTERVENTION
 */

const REFERRAL_BONUS_AMOUNT = constants.REFERRAL_BONUS.REFERRER || 1500;

/**
 * Calculate referral bonus - ALWAYS 1500 coins
 * @returns {number} 1500 coins
 */
function calculateReferralBonus() {
  return REFERRAL_BONUS_AMOUNT;
}

/**
 * Calculate signup bonus - ALWAYS 500 coins
 * @returns {number} 500 coins
 */
function calculateSignupBonus() {
  return constants.REFERRAL_BONUS.REFEREE || 500;
}

/**
 * Calculate total earnings from referrals
 * @param {number} referralCount - Number of successful referrals
 * @returns {number} Total bonus earned
 */
function calculateTotalEarnings(referralCount) {
  return referralCount * REFERRAL_BONUS_AMOUNT;
}

/**
 * Calculate potential earnings
 * @param {number} targetReferrals - Target number of referrals
 * @returns {Object} Earnings breakdown
 */
function calculatePotentialEarnings(targetReferrals = 10) {
  const perReferral = REFERRAL_BONUS_AMOUNT;
  const total = targetReferrals * perReferral;
  const usdValue = total * constants.EXCHANGE_RATE.USD_PER_COIN;
  
  return {
    perReferral,
    targetReferrals,
    totalCoins: total,
    usdValue: usdValue.toFixed(2),
    formattedCoins: total.toLocaleString(),
    formattedUSD: `$${usdValue.toFixed(2)}`
  };
}

/**
 * Calculate referral progress
 * @param {number} currentReferrals - Current number of referrals
 * @param {number} targetReferrals - Target referrals
 * @returns {Object} Progress metrics
 */
function calculateReferralProgress(currentReferrals, targetReferrals = 5) {
  const progress = (currentReferrals / targetReferrals) * 100;
  const earned = currentReferrals * REFERRAL_BONUS_AMOUNT;
  const remaining = Math.max(0, targetReferrals - currentReferrals);
  const potential = remaining * REFERRAL_BONUS_AMOUNT;
  
  return {
    currentReferrals,
    targetReferrals,
    progress: Math.min(100, Math.round(progress * 10) / 10),
    earned,
    remaining,
    potential,
    completed: currentReferrals >= targetReferrals
  };
}

module.exports = {
  REFERRAL_BONUS_AMOUNT,
  calculateReferralBonus,
  calculateSignupBonus,
  calculateTotalEarnings,
  calculatePotentialEarnings,
  calculateReferralProgress
};