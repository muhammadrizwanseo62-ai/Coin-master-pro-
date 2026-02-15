module.exports = {
  // CPA Networks Configuration
  networks: {
    cpagrip: {
      name: 'CPAGrip',
      enabled: true,
      countries: ['US', 'UK', 'CA', 'AU'],
      payoutRate: 0.75,
      defaultReward: 3750 // 5000 coins = $1, so 3750 coins = $0.75
    },
    cpalead: {
      name: 'CPALead',
      enabled: true,
      countries: ['WW'],
      payoutRate: 0.80,
      defaultReward: 4000
    },
    adworkmedia: {
      name: 'Adworkmedia',
      enabled: true,
      countries: ['WW'],
      payoutRate: 0.85,
      defaultReward: 4250
    },
    ogads: {
      name: 'OGAds',
      enabled: true,
      countries: ['US', 'UK', 'CA', 'AU', 'DE', 'FR'],
      payoutRate: 0.70,
      defaultReward: 3500
    },
    offertoro: {
      name: 'Offertoro',
      enabled: true,
      countries: ['US', 'UK', 'CA'],
      payoutRate: 0.90,
      defaultReward: 4500
    },
    adgate: {
      name: 'AdGate Media',
      enabled: true,
      countries: ['US', 'UK', 'CA', 'AU'],
      payoutRate: 0.95,
      defaultReward: 4750
    },
    kiwiwall: {
      name: 'KiwiWall',
      enabled: true,
      countries: ['US', 'UK', 'DE', 'FR', 'JP'],
      payoutRate: 0.80,
      defaultReward: 4000
    },
    ayet: {
      name: 'Ayet Studios',
      enabled: true,
      countries: ['US', 'UK', 'CA'],
      payoutRate: 0.65,
      defaultReward: 3250
    },
    toro: {
      name: 'Toro',
      enabled: true,
      countries: ['WW'],
      payoutRate: 0.70,
      defaultReward: 3500
    },
    person ally: {
      name: 'Persona.ly',
      enabled: true,
      countries: ['US', 'UK', 'DE', 'FR', 'ES', 'IT'],
      payoutRate: 0.60,
      defaultReward: 3000
    }
  },

  // Coin to USD conversion (5000 coins = $1)
  coinToUsdRate: 5000,

  // Geo targeting settings
  geoDefaults: {
    defaultCountry: 'US',
    fallbackCountry: 'WW',
    blockHighFraudCountries: ['XX', 'YY'] // Example blocked countries
  },

  // Payout rates by country
  countryPayoutRates: {
    'US': 1.0,
    'UK': 0.95,
    'CA': 0.90,
    'AU': 0.85,
    'DE': 0.80,
    'FR': 0.80,
    'JP': 0.90,
    'WW': 0.70 // Worldwide
  },

  // Fraud prevention thresholds
  fraudThresholds: {
    maxConversionsPerDay: 50,
    maxConversionsPerHour: 10,
    minTimeBetweenConversions: 30000, // 30 seconds
    sameIPLimit: 3,
    sameDeviceLimit: 5
  }
};