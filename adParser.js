// Ad Code Parser Utility
// Parses and validates ad codes from various networks

class AdParser {
    constructor() {
        this.networks = {
            google: {
                patterns: [
                    /<script\s+async\s+src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-\d+"><\/script>/,
                    /<ins\s+class="adsbygoogle"\s+style="[^"]*"\s+data-ad-client="ca-pub-\d+"\s+data-ad-slot="\d+"[^>]*><\/ins>/
                ],
                validate: (code) => {
                    return code.includes('adsbygoogle') && 
                           code.includes('ca-pub-') && 
                           code.includes('data-ad-slot');
                }
            },
            unity: {
                patterns: [
                    /UnityAd\(/,
                    /gameId: ["']\d+["']/,
                    /placementId: ["'][^"']+["']/
                ],
                validate: (code) => {
                    return code.includes('UnityAd') && 
                           code.includes('gameId') && 
                           code.includes('placementId');
                }
            },
            facebook: {
                patterns: [
                    /FBInstant\.getInterstitialAdAsync/,
                    /placementId: ["'][^"']+["']/
                ],
                validate: (code) => {
                    return code.includes('FBInstant') && 
                           code.includes('placementId');
                }
            },
            applovin: {
                patterns: [
                    /AppLovin\.initialize/,
                    /AppLovin\.showAd/
                ],
                validate: (code) => {
                    return code.includes('AppLovin') && 
                           (code.includes('initialize') || code.includes('showAd'));
                }
            },
            ironsource: {
                patterns: [
                    /IronSource\.init/,
                    /IronSource\.showRewardedVideo/
                ],
                validate: (code) => {
                    return code.includes('IronSource') && 
                           (code.includes('init') || code.includes('showRewardedVideo'));
                }
            },
            vungle: {
                patterns: [
                    /Vungle\.init/,
                    /Vungle\.playAd/
                ],
                validate: (code) => {
                    return code.includes('Vungle') && 
                           (code.includes('init') || code.includes('playAd'));
                }
            },
            custom: {
                patterns: [],
                validate: (code) => {
                    return code && code.length > 0;
                }
            }
        };
    }

    // Parse ad code
    parseAdCode(code, network = null) {
        if (!code || typeof code !== 'string') {
            throw new Error('Invalid ad code');
        }

        // Trim whitespace
        code = code.trim();

        // Auto-detect network if not specified
        if (!network) {
            network = this.detectNetwork(code);
        }

        // Validate for the specified network
        if (network !== 'custom' && !this.validateAdCode(code, network)) {
            throw new Error(`Invalid ad code format for ${network}`);
        }

        // Extract ad information
        const info = this.extractAdInfo(code, network);

        return {
            network,
            code,
            validated: true,
            info
        };
    }

    // Detect ad network from code
    detectNetwork(code) {
        for (const [network, config] of Object.entries(this.networks)) {
            if (network === 'custom') continue;
            
            if (config.validate(code)) {
                return network;
            }
        }
        return 'custom';
    }

    // Validate ad code for specific network
    validateAdCode(code, network) {
        const config = this.networks[network];
        if (!config) return false;
        
        if (config.patterns.length === 0) return true;
        
        return config.patterns.some(pattern => pattern.test(code));
    }

    // Extract information from ad code
    extractAdInfo(code, network) {
        const info = {
            type: 'unknown',
            dimensions: null,
            slots: [],
            adUnitId: null
        };

        switch(network) {
            case 'google':
                // Extract ad slot
                const slotMatch = code.match(/data-ad-slot=["'](\d+)["']/);
                if (slotMatch) info.adUnitId = slotMatch[1];
                
                // Extract dimensions from style
                const styleMatch = code.match(/style=["']([^"']+)["']/);
                if (styleMatch) {
                    const widthMatch = styleMatch[1].match(/width:\s*(\d+)px/);
                    const heightMatch = styleMatch[1].match(/height:\s*(\d+)px/);
                    if (widthMatch && heightMatch) {
                        info.dimensions = {
                            width: parseInt(widthMatch[1]),
                            height: parseInt(heightMatch[1])
                        };
                    }
                }
                
                // Determine ad type
                if (code.includes('data-ad-format="auto"')) {
                    info.type = 'responsive';
                } else if (code.includes('data-ad-format="rectangle"')) {
                    info.type = 'rectangle';
                } else if (code.includes('data-ad-format="horizontal"')) {
                    info.type = 'banner';
                } else if (code.includes('data-ad-format="vertical"')) {
                    info.type = 'skyscraper';
                }
                break;

            case 'unity':
                // Extract game ID
                const gameIdMatch = code.match(/gameId:\s*["']?(\d+)["']?/);
                if (gameIdMatch) info.adUnitId = gameIdMatch[1];
                
                // Extract placement ID
                const placementMatch = code.match(/placementId:\s*["']([^"']+)["']/);
                if (placementMatch) info.placementId = placementMatch[1];
                
                // Determine ad type
                if (code.includes('RewardedVideo')) {
                    info.type = 'rewarded';
                } else if (code.includes('Interstitial')) {
                    info.type = 'interstitial';
                } else if (code.includes('Banner')) {
                    info.type = 'banner';
                }
                break;

            case 'facebook':
                // Extract placement ID
                const fbPlacementMatch = code.match(/placementId:\s*["']([^"']+)["']/);
                if (fbPlacementMatch) info.adUnitId = fbPlacementMatch[1];
                
                // Determine ad type
                if (code.includes('InterstitialAd')) {
                    info.type = 'interstitial';
                } else if (code.includes('RewardedVideo')) {
                    info.type = 'rewarded';
                } else if (code.includes('BannerAd')) {
                    info.type = 'banner';
                }
                break;
        }

        return info;
    }

    // Sanitize ad code (remove potential XSS)
    sanitizeAdCode(code) {
        // Remove script tags that might be malicious
        code = code.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, (match) => {
            // Only allow adsbygoogle scripts
            if (match.includes('adsbygoogle.js')) {
                return match;
            }
            return '';
        });

        // Remove event handlers
        code = code.replace(/ on\w+="[^"]*"/g, '');
        code = code.replace(/ on\w+='[^']*'/g, '');

        // Remove javascript: URLs
        code = code.replace(/javascript:/gi, 'blocked:');

        return code;
    }

    // Get template for network
    getTemplate(network) {
        const templates = {
            google: `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"></script>
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
     data-ad-slot="XXXXXXXXXX"
     data-ad-format="auto"></ins>
<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>`,

            unity: `<script>
  const videoAd = new UnityAd({
    gameId: "1234567",
    placementId: "video",
    testMode: true
  });
  
  videoAd.load().then(() => {
    videoAd.show();
  });
</script>`,

            facebook: `<script>
  FBInstant.getInterstitialAdAsync(
    "YOUR_PLACEMENT_ID"
  ).then(function(interstitial) {
    return interstitial.loadAsync();
  }).then(function() {
    return interstitial.showAsync();
  }).catch(function(err) {
    console.error(err.message);
  });
</script>`,

            applovin: `<script>
  AppLovin.initialize('YOUR_SDK_KEY');
  
  AppLovin.loadRewardedAd('REWARDED_AD_UNIT_ID', function(ad) {
    AppLovin.showRewardedAd(ad);
  });
</script>`,

            ironsource: `<script>
  IronSource.init('YOUR_APP_KEY');
  
  IronSource.loadRewardedVideo();
  
  IronSource.showRewardedVideo();
</script>`,

            vungle: `<script>
  Vungle.init('YOUR_APP_ID');
  
  Vungle.loadAd('YOUR_PLACEMENT_ID', function() {
    Vungle.playAd('YOUR_PLACEMENT_ID');
  });
</script>`
        };

        return templates[network] || '';
    }

    // Get all supported networks
    getNetworks() {
        return Object.keys(this.networks).map(key => ({
            id: key,
            name: this.formatNetworkName(key)
        }));
    }

    // Format network name
    formatNetworkName(network) {
        const names = {
            google: 'Google AdMob',
            unity: 'Unity Ads',
            facebook: 'Facebook Audience',
            applovin: 'AppLovin',
            ironsource: 'ironSource',
            vungle: 'Vungle',
            custom: 'Custom Network'
        };
        return names[network] || network;
    }
}

module.exports = new AdParser();