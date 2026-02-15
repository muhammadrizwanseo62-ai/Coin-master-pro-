const NetworkIntegration = require('../models/NetworkIntegration');
const offerWallService = require('../services/offerWallService');
const { v4: uuidv4 } = require('uuid');

/**
 * Add new network integration
 */
exports.addNetwork = async (req, res) => {
  try {
    const {
      name,
      customName,
      iframeCode,
      status,
      displayOrder,
      countryTargeting,
      targetCountries,
      width,
      height,
      scrolling,
      sandbox,
      allow,
      referrerPolicy,
      loading,
      style,
      description,
      icon,
      backgroundColor,
      textColor
    } = req.body;

    // Validate iframe code
    if (!iframeCode.includes('<iframe') && !iframeCode.includes('<script')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid iframe code. Must contain <iframe> or <script> tag'
      });
    }

    // Check for duplicate
    const existing = await NetworkIntegration.findOne({ name });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Network with this name already exists'
      });
    }

    // Create network
    const network = new NetworkIntegration({
      networkId: `NET-${uuidv4().substring(0, 6).toUpperCase()}`,
      name,
      customName,
      iframeCode,
      status: status || 'active',
      displayOrder: displayOrder || 0,
      countryTargeting: countryTargeting || 'all',
      targetCountries: targetCountries || [],
      width: width || '100%',
      height: height || '600px',
      scrolling: scrolling || 'auto',
      sandbox: sandbox || '',
      allow: allow || 'payment *; clipboard-write *',
      referrerPolicy: referrerPolicy || 'no-referrer-when-downgrade',
      loading: loading || 'lazy',
      style: style || 'border: none; border-radius: 8px;',
      description,
      icon: icon || 'fa-ad',
      backgroundColor: backgroundColor || '#ffffff',
      textColor: textColor || '#333333',
      createdBy: req.user._id,
      lastGenerated: new Date()
    });

    await network.save();

    // Generate offers.html
    await offerWallService.generateOfferWallPage();

    res.status(201).json({
      success: true,
      message: 'Network added successfully',
      network
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add network',
      error: error.message
    });
  }
};

/**
 * Update existing network
 */
exports.updateNetwork = async (req, res) => {
  try {
    const network = await NetworkIntegration.findById(req.params.id);
    
    if (!network) {
      return res.status(404).json({
        success: false,
        message: 'Network not found'
      });
    }

    const updateFields = [
      'name', 'customName', 'iframeCode', 'status', 'displayOrder',
      'countryTargeting', 'targetCountries', 'width', 'height',
      'scrolling', 'sandbox', 'allow', 'referrerPolicy', 'loading',
      'style', 'description', 'icon', 'backgroundColor', 'textColor'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        network[field] = req.body[field];
      }
    });

    network.updatedAt = Date.now();
    network.lastGenerated = new Date();
    await network.save();

    // Regenerate offers.html
    await offerWallService.generateOfferWallPage();

    res.json({
      success: true,
      message: 'Network updated successfully',
      network
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update network',
      error: error.message
    });
  }
};

/**
 * Delete network
 */
exports.deleteNetwork = async (req, res) => {
  try {
    const network = await NetworkIntegration.findById(req.params.id);
    
    if (!network) {
      return res.status(404).json({
        success: false,
        message: 'Network not found'
      });
    }

    await network.deleteOne();

    // Regenerate offers.html
    await offerWallService.generateOfferWallPage();

    res.json({
      success: true,
      message: 'Network deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete network',
      error: error.message
    });
  }
};

/**
 * Toggle network status
 */
exports.toggleNetworkStatus = async (req, res) => {
  try {
    const network = await NetworkIntegration.findById(req.params.id);
    
    if (!network) {
      return res.status(404).json({
        success: false,
        message: 'Network not found'
      });
    }

    network.status = network.status === 'active' ? 'inactive' : 'active';
    network.updatedAt = Date.now();
    network.lastGenerated = new Date();
    await network.save();

    // Regenerate offers.html
    await offerWallService.generateOfferWallPage();

    res.json({
      success: true,
      message: `Network ${network.status === 'active' ? 'activated' : 'deactivated'}`,
      status: network.status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to toggle network status',
      error: error.message
    });
  }
};

/**
 * Reorder networks
 */
exports.reorderNetworks = async (req, res) => {
  try {
    const { orders } = req.body;
    
    if (!Array.isArray(orders)) {
      return res.status(400).json({
        success: false,
        message: 'Orders must be an array'
      });
    }

    for (let i = 0; i < orders.length; i++) {
      await NetworkIntegration.findByIdAndUpdate(orders[i], {
        displayOrder: i,
        updatedAt: Date.now()
      });
    }

    // Regenerate offers.html
    await offerWallService.generateOfferWallPage();

    res.json({
      success: true,
      message: 'Network order updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to reorder networks',
      error: error.message
    });
  }
};

/**
 * Generate offers HTML page
 */
exports.generateOffersHtml = async (req, res) => {
  try {
    const result = await offerWallService.generateOfferWallPage();
    
    res.json({
      success: true,
      message: 'Offers page generated successfully',
      path: result.path,
      networksCount: result.networksCount,
      timestamp: result.timestamp
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate offers page',
      error: error.message
    });
  }
};

/**
 * Get all networks
 */
exports.getNetworks = async (req, res) => {
  try {
    const networks = await NetworkIntegration.find()
      .sort({ displayOrder: 1, createdAt: -1 });
    
    res.json({
      success: true,
      count: networks.length,
      networks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch networks',
      error: error.message
    });
  }
};

/**
 * Get single network
 */
exports.getNetwork = async (req, res) => {
  try {
    const network = await NetworkIntegration.findById(req.params.id);
    
    if (!network) {
      return res.status(404).json({
        success: false,
        message: 'Network not found'
      });
    }

    res.json({
      success: true,
      network
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch network',
      error: error.message
    });
  }
};

/**
 * Validate iframe security
 */
exports.validateIframeSecurity = async (req, res) => {
  try {
    const { iframeCode } = req.body;
    
    const validation = await offerWallService.validateIframeSecurity(iframeCode);
    
    res.json({
      success: true,
      ...validation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to validate iframe',
      error: error.message
    });
  }
};