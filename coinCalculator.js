exports.calculateCoins = (taps) => {
  const maxTaps = 100;
  const maxCoins = 20;
  const coinPerTap = 0.2;
  
  const validTaps = Math.min(taps, maxTaps);
  const coins = validTaps * coinPerTap;
  
  return Math.min(coins, maxCoins);
};

exports.calculateUSD = (coins) => {
  const rate = 0.0001; // 1 coin = $0.0001
  return coins * rate;
};

exports.calculateCoinsFromUSD = (usd) => {
  const rate = 0.0001;
  return usd / rate;
};

exports.formatBalance = (coins) => {
  return coins.toFixed(2);
};

exports.getMaxEarnings = (type) => {
  const limits = {
    game: 20,
    ad: 25,
    dailyBonus: 100,
    referral: 500
  };
  return limits[type] || 0;
};