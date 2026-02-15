const crypto = require('crypto');

exports.validateTapRate = (sessionId, tapRateLimiter) => {
  const now = Date.now();
  const sessionTaps = tapRateLimiter.get(sessionId) || [];
  
  const recentTaps = sessionTaps.filter(time => now - time < 1000);
  
  if (recentTaps.length >= 10) {
    return false;
  }
  
  recentTaps.push(now);
  tapRateLimiter.set(sessionId, recentTaps);
  
  return true;
};

exports.generateScreenshotHash = (screenshot) => {
  return crypto
    .createHash('sha256')
    .update(screenshot)
    .digest('hex');
};

exports.validateGameSession = (session) => {
  const errors = [];
  
  if (session.taps > 100) {
    errors.push('Exceeded maximum taps');
  }
  
  if (session.coinsEarned > 20) {
    errors.push('Exceeded maximum coins');
  }
  
  const duration = (session.endTime - session.startTime) / 1000;
  if (duration > 70) {
    errors.push('Game duration too long');
  }
  
  if (duration < 1 && session.taps > 0) {
    errors.push('Game duration too short for taps');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

exports.calculateScore = (taps, timeRemaining) => {
  const baseScore = taps;
  const timeBonus = Math.floor(timeRemaining / 10);
  return baseScore + timeBonus;
};

exports.generateSessionId = () => {
  return crypto.randomBytes(16).toString('hex');
};

exports.antiCheatCheck = (session) => {
  const tapsPerSecond = session.taps / session.duration;
  
  if (tapsPerSecond > 15) {
    return { flagged: true, reason: 'Abnormal tap speed' };
  }
  
  if (session.duration > 0 && session.taps === 0) {
    return { flagged: false };
  }
  
  return { flagged: false };
};