const { isTodayWithdrawalDay, getNextWithdrawalDate } = require('../utils/withdrawalDateCheck');

/**
 * Middleware: Validate withdrawal date
 * STRICT: Blocks all withdrawal requests if not 15th
 * CANNOT BE BYPASSED - Server side enforcement
 */
function validateWithdrawalDate(req, res, next) {
  try {
    if (!isTodayWithdrawalDay()) {
      const nextDate = getNextWithdrawalDate();
      const formattedDate = nextDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      return res.status(403).json({
        success: false,
        message: '❌ Withdrawals are ONLY available on the 15th of each month',
        nextWithdrawalDate: nextDate,
        formattedDate
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Date validation failed',
      error: error.message
    });
  }
}

/**
 * Middleware: Check if today is before withdrawal day
 * Used for reminders and pre-withdrawal checks
 */
function isBeforeWithdrawalDay(req, res, next) {
  const today = new Date();
  const day = today.getDate();
  
  if (day < 15) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'This action is only available before the 15th'
    });
  }
}

/**
 * Middleware: Check if today is after withdrawal day
 * Used for post-withdrawal processing
 */
function isAfterWithdrawalDay(req, res, next) {
  const today = new Date();
  const day = today.getDate();
  
  if (day > 15) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'This action is only available after the 15th'
    });
  }
}

/**
 * Middleware: Check if today is within withdrawal window (15th only)
 * Strict validation - no exceptions
 */
function withinWithdrawalWindow(req, res, next) {
  const today = new Date();
  const day = today.getDate();
  
  if (day === 15) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Withdrawal window is only open on the 15th (00:00 - 23:59 UTC)'
    });
  }
}

module.exports = {
  validateWithdrawalDate,
  isBeforeWithdrawalDay,
  isAfterWithdrawalDay,
  withinWithdrawalWindow
};