const constants = require('../config/constants');

/**
 * Check if today is withdrawal day (15th)
 * STRICT: Server-side validation - CANNOT BE BYPASSED
 */
function isTodayWithdrawalDay() {
  const today = new Date();
  return today.getDate() === constants.WITHDRAWAL_DAY;
}

/**
 * Get next withdrawal date (next 15th)
 */
function getNextWithdrawalDate() {
  const today = new Date();
  const nextDate = new Date(today);
  
  if (today.getDate() >= constants.WITHDRAWAL_DAY) {
    nextDate.setMonth(nextDate.getMonth() + 1);
  }
  
  nextDate.setDate(constants.WITHDRAWAL_DAY);
  nextDate.setHours(0, 0, 0, 0);
  
  return nextDate;
}

/**
 * Format countdown to next withdrawal day
 * Returns: "XX Days XX Hours XX Minutes XX Seconds"
 */
function formatCountdown() {
  const now = new Date();
  const nextDate = getNextWithdrawalDate();
  const diff = nextDate - now;
  
  if (diff <= 0) {
    return "Withdrawal day is TODAY!";
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

/**
 * Validate that today is withdrawal day
 * Throws error if not 15th
 */
function validateWithdrawalDate() {
  if (!isTodayWithdrawalDay()) {
    throw new Error(`❌ Withdrawals are ONLY available on the ${constants.WITHDRAWAL_DAY}th of each month`);
  }
  return true;
}

/**
 * Check if user can request withdrawal today
 * Returns object with status and message
 */
function canWithdrawToday() {
  const today = new Date();
  const day = today.getDate();
  const month = today.toLocaleString('default', { month: 'long' });
  const year = today.getFullYear();
  
  if (day === constants.WITHDRAWAL_DAY) {
    return {
      canWithdraw: true,
      message: `✅ Today (${month} ${day}, ${year}) is withdrawal day!`,
      date: today
    };
  } else {
    const nextDate = getNextWithdrawalDate();
    const nextMonth = nextDate.toLocaleString('default', { month: 'long' });
    
    return {
      canWithdraw: false,
      message: `❌ Withdrawals only on the ${constants.WITHDRAWAL_DAY}th. Next: ${nextMonth} ${constants.WITHDRAWAL_DAY}, ${nextDate.getFullYear()}`,
      nextDate
    };
  }
}

/**
 * Get withdrawal window status
 */
function getWithdrawalWindowStatus() {
  const today = new Date();
  const day = today.getDate();
  const hour = today.getHours();
  
  if (day === constants.WITHDRAWAL_DAY) {
    return {
      isOpen: true,
      hoursRemaining: 24 - hour,
      message: `Withdrawal window is OPEN! ${24 - hour} hours remaining`
    };
  } else {
    const nextDate = getNextWithdrawalDate();
    const daysUntil = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
    
    return {
      isOpen: false,
      daysUntil,
      message: `Withdrawal window opens in ${daysUntil} days`
    };
  }
}

module.exports = {
  isTodayWithdrawalDay,
  getNextWithdrawalDate,
  formatCountdown,
  validateWithdrawalDate,
  canWithdrawToday,
  getWithdrawalWindowStatus
};