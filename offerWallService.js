const NetworkIntegration = require('../models/NetworkIntegration');
const fs = require('fs').promises;
const path = require('path');

/**
 * Offer Wall Service - Auto-generates offers.html from iframe codes
 */
class OfferWallService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Render iframe code with proper attributes
   */
  renderIframeCode(network) {
    let iframeCode = network.iframeCode;
    
    // If it's a full iframe tag, extract and modify attributes
    if (iframeCode.includes('<iframe')) {
      // Add/modify attributes for better security and performance
      iframeCode = iframeCode.replace('<iframe', `<iframe 
        loading="${network.loading || 'lazy'}" 
        referrerpolicy="${network.referrerPolicy || 'no-referrer-when-downgrade'}"
        sandbox="${network.sandbox || 'allow-scripts allow-same-origin allow-forms allow-popups'}"
        allow="${network.allow || 'payment *; clipboard-write *'}"
        style="${network.style || 'border: none; border-radius: 8px; width: 100%; height: 600px;'}"
        width="${network.width || '100%'}"
        height="${network.height || '600px'}"
        scrolling="${network.scrolling || 'auto'}"`);
    }
    
    // If it's a script tag, wrap in iframe or div
    else if (iframeCode.includes('<script')) {
      iframeCode = `<div class="offerwall-script-wrapper" style="width: 100%; height: ${network.height || '600px'}; overflow: auto;">
        ${iframeCode}
      </div>`;
    }
    
    return iframeCode;
  }

  /**
   * Generate complete offer wall HTML page
   */
  async generateOfferWallPage() {
    try {
      // Get all active networks
      const networks = await NetworkIntegration.find({ 
        status: 'active' 
      }).sort({ displayOrder: 1 });

      // Generate HTML content
      const html = this.buildOfferWallHTML(networks);
      
      // Ensure directories exist
      const publicDir = path.join(__dirname, '../../views/public');
      const adminDir = path.join(__dirname, '../../views/admin');
      
      try {
        await fs.mkdir(publicDir, { recursive: true });
        await fs.mkdir(adminDir, { recursive: true });
      } catch (err) {
        // Directory already exists
      }

      // Write to offers.html in public folder
      const publicPath = path.join(publicDir, 'offers.html');
      await fs.writeFile(publicPath, html, 'utf8');
      
      // Also write to views/admin for admin preview
      const adminPath = path.join(adminDir, 'offers.html');
      await fs.writeFile(adminPath, html, 'utf8');

      // Update cache
      this.cache.set('offers.html', {
        html,
        timestamp: Date.now(),
        networksCount: networks.length
      });

      return {
        success: true,
        path: publicPath,
        networksCount: networks.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Generate offer wall error:', error);
      throw error;
    }
  }

  /**
   * Build complete HTML page with all offer walls
   */
  buildOfferWallHTML(networks) {
    const networkSections = networks.map((network, index) => {
      const iframeHtml = this.renderIframeCode(network);
      
      return `
        <div class="offerwall-network" data-network-id="${network.networkId}" data-order="${network.displayOrder}">
          <div class="offerwall-header" style="background-color: ${network.backgroundColor || '#f8f9fa'}; color: ${network.textColor || '#212529'};">
            <div class="offerwall-title">
              <i class="fas ${network.icon || 'fa-ad'}"></i>
              <h2>${network.displayName}</h2>
              ${network.description ? `<p class="offerwall-description">${network.description}</p>` : ''}
            </div>
            <div class="offerwall-status">
              <span class="badge bg-success">Active</span>
            </div>
          </div>
          <div class="offerwall-content">
            ${iframeHtml}
          </div>
        </div>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes">
    <title>CPA Offer Walls - Earn Coins</title>
    
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    
    <!-- Bootstrap 5 -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            color: white;
            margin-bottom: 40px;
            padding: 30px;
            background: rgba(255,255,255,0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        .header p {
            font-size: 1.1em;
            opacity: 0.9;
        }
        
        .offerwall-network {
            background: white;
            border-radius: 16px;
            margin-bottom: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            overflow: hidden;
            transition: transform 0.3s ease;
        }
        
        .offerwall-network:hover {
            transform: translateY(-5px);
        }
        
        .offerwall-header {
            padding: 20px 25px;
            border-bottom: 1px solid rgba(0,0,0,0.05);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .offerwall-title {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .offerwall-title i {
            font-size: 24px;
        }
        
        .offerwall-title h2 {
            margin: 0;
            font-size: 1.5em;
            font-weight: 600;
        }
        
        .offerwall-description {
            margin: 5px 0 0 0;
            font-size: 0.9em;
            opacity: 0.8;
        }
        
        .offerwall-content {
            padding: 20px;
            background: #fff;
        }
        
        .badge {
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 500;
        }
        
        .bg-success {
            background: #28a745 !important;
            color: white;
        }
        
        .loading {
            text-align: center;
            padding: 50px;
            color: white;
        }
        
        .loading i {
            font-size: 3em;
            margin-bottom: 20px;
        }
        
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            
            .header h1 {
                font-size: 1.8em;
            }
            
            .offerwall-header {
                flex-direction: column;
                text-align: center;
                gap: 10px;
            }
            
            .offerwall-title {
                flex-direction: column;
            }
            
            .offerwall-content {
                padding: 10px;
            }
            
            iframe {
                height: 500px !important;
            }
        }
        
        @media (max-width: 480px) {
            iframe {
                height: 450px !important;
            }
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        
        ::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
        }
        
        ::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 10px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
            background: #555;
        }
        
        /* Animations */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .offerwall-network {
            animation: fadeIn 0.5s ease forwards;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <i class="fas fa-trophy" style="font-size: 48px; margin-bottom: 20px;"></i>
            <h1>Earn Coins with Offers</h1>
            <p>Complete offers from our trusted partners and earn rewards instantly</p>
            <div class="stats mt-3">
                <span class="badge bg-light text-dark me-2">
                    <i class="fas fa-building"></i> ${networks.length} Networks
                </span>
                <span class="badge bg-light text-dark">
                    <i class="fas fa-coins"></i> 5000 Coins = $1
                </span>
            </div>
        </div>
        
        ${networks.length === 0 ? `
            <div class="alert alert-info text-center">
                <i class="fas fa-info-circle"></i> No offer walls available at the moment. Please check back later.
            </div>
        ` : networkSections}
        
        <div class="footer text-center text-white mt-5">
            <p>© ${new Date().getFullYear()} CPA Marketing System. All rights reserved.</p>
            <p class="small opacity-75">Generated: ${new Date().toLocaleString()}</p>
        </div>
    </div>
    
    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    
    <script>
        // Auto-resize iframes
        window.addEventListener('load', function() {
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                iframe.addEventListener('load', function() {
                    try {
                        // Try to adjust height based on content
                        if (this.contentWindow.document.body) {
                            const height = this.contentWindow.document.body.scrollHeight;
                            if (height > 100) {
                                this.style.height = height + 'px';
                            }
                        }
                    } catch(e) {
                        // Cross-origin restrictions, ignore
                    }
                });
            });
        });
        
        // Track offer clicks
        document.addEventListener('click', function(e) {
            const offerLink = e.target.closest('a');
            if (offerLink && offerLink.href) {
                console.log('Offer click:', offerLink.href);
                // Send to analytics if needed
            }
        });
    </script>
</body>
</html>`;
  }

  /**
   * Cache networks for fast loading
   */
  async cacheNetworks() {
    try {
      const networks = await NetworkIntegration.find({ status: 'active' })
        .sort({ displayOrder: 1 });
      
      this.cache.set('networks', {
        data: networks,
        timestamp: Date.now()
      });
      
      return networks;
    } catch (error) {
      console.error('Cache networks error:', error);
      return [];
    }
  }

  /**
   * Get cached networks
   */
  async getCachedNetworks() {
    const cached = this.cache.get('networks');
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.data;
    }
    
    return await this.cacheNetworks();
  }

  /**
   * Validate iframe security
   */
  async validateIframeSecurity(iframeCode) {
    try {
      const warnings = [];
      let isSecure = true;

      // Check for HTTPS
      if (iframeCode.includes('src="http://') || iframeCode.includes("src='http://")) {
        warnings.push('Iframe uses HTTP instead of HTTPS');
        isSecure = false;
      }

      // Check for sandbox attribute
      if (!iframeCode.includes('sandbox')) {
        warnings.push('Missing sandbox attribute - recommended for security');
      }

      // Check for allow attribute
      if (!iframeCode.includes('allow=')) {
        warnings.push('Missing allow attribute - limits feature access');
      }

      // Check for referrerpolicy
      if (!iframeCode.includes('referrerpolicy')) {
        warnings.push('Missing referrerpolicy attribute');
      }

      // Check for potential malicious code
      const maliciousPatterns = [
        'eval(', 'document.cookie', 'window.location', 'alert(',
        'prompt(', 'confirm(', 'onload=', 'onerror=', 'javascript:'
      ];

      maliciousPatterns.forEach(pattern => {
        if (iframeCode.includes(pattern)) {
          warnings.push(`Potential malicious code: ${pattern}`);
          isSecure = false;
        }
      });

      return {
        isValid: true,
        isSecure,
        warnings,
        recommendations: [
          'Use HTTPS URLs only',
          'Add sandbox="allow-scripts allow-same-origin allow-forms"',
          'Add referrerpolicy="no-referrer-when-downgrade"',
          'Add allow="payment *; clipboard-write *"'
        ]
      };
    } catch (error) {
      console.error('Validate iframe security error:', error);
      return {
        isValid: false,
        isSecure: false,
        warnings: ['Security validation failed'],
        recommendations: []
      };
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    return {
      success: true,
      message: 'Cache cleared successfully'
    };
  }
}

module.exports = new OfferWallService();