const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const NetworkIntegration = require('../models/NetworkIntegration');
const offerWallService = require('../services/offerWallService');
const fs = require('fs').promises;
const path = require('path');

/**
 * @route   GET /api/admin/networks
 * @desc    Get all networks
 * @access  Admin only
 */
router.get('/', protect, admin, async (req, res) => {
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
});

/**
 * @route   POST /api/admin/networks
 * @desc    Add new network integration
 * @access  Admin only
 */
router.post('/', protect, admin, async (req, res) => {
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

    // Check if network already exists
    const existingNetwork = await NetworkIntegration.findOne({ name });
    if (existingNetwork) {
      return res.status(400).json({
        success: false,
        message: 'Network with this name already exists'
      });
    }

    // Create new network
    const network = new NetworkIntegration({
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

    // Auto-generate offers.html file
    await offerWallService.generateOfferWallPage();

    res.status(201).json({
      success: true,
      message: 'Network added successfully and offers page regenerated',
      network
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add network',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/admin/networks/:id
 * @desc    Update network integration
 * @access  Admin only
 */
router.put('/:id', protect, admin, async (req, res) => {
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
    network.cacheKey = `${network.name}-${Date.now()}`;
    network.lastGenerated = new Date();

    await network.save();

    // Regenerate offers.html file
    await offerWallService.generateOfferWallPage();

    res.json({
      success: true,
      message: 'Network updated successfully and offers page regenerated',
      network
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update network',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/admin/networks/:id
 * @desc    Delete network integration
 * @access  Admin only
 */
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const network = await NetworkIntegration.findById(req.params.id);
    
    if (!network) {
      return res.status(404).json({
        success: false,
        message: 'Network not found'
      });
    }

    await network.deleteOne();

    // Regenerate offers.html file
    await offerWallService.generateOfferWallPage();

    res.json({
      success: true,
      message: 'Network deleted successfully and offers page regenerated'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete network',
      error: error.message
    });
  }
});

/**
 * @route   PATCH /api/admin/networks/:id/toggle
 * @desc    Toggle network status
 * @access  Admin only
 */
router.patch('/:id/toggle', protect, admin, async (req, res) => {
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

    // Regenerate offers.html file
    await offerWallService.generateOfferWallPage();

    res.json({
      success: true,
      message: `Network ${network.status === 'active' ? 'activated' : 'deactivated'} successfully`,
      status: network.status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to toggle network status',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/networks/reorder
 * @desc    Reorder networks
 * @access  Admin only
 */
router.post('/reorder', protect, admin, async (req, res) => {
  try {
    const { networkOrders } = req.body;
    
    if (!Array.isArray(networkOrders)) {
      return res.status(400).json({
        success: false,
        message: 'networkOrders must be an array'
      });
    }

    for (let i = 0; i < networkOrders.length; i++) {
      await NetworkIntegration.findByIdAndUpdate(networkOrders[i], {
        displayOrder: i,
        updatedAt: Date.now()
      });
    }

    // Regenerate offers.html file
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
});

/**
 * @route   GET /api/admin/networks/:id/preview
 * @desc    Preview iframe code
 * @access  Admin only
 */
router.get('/:id/preview', protect, admin, async (req, res) => {
  try {
    const network = await NetworkIntegration.findById(req.params.id);
    
    if (!network) {
      return res.status(404).json({
        success: false,
        message: 'Network not found'
      });
    }

    const previewHtml = offerWallService.renderIframeCode(network);
    
    res.json({
      success: true,
      preview: previewHtml
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate preview',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/networks/generate
 * @desc    Manually regenerate offers.html
 * @access  Admin only
 */
router.post('/generate', protect, admin, async (req, res) => {
  try {
    await offerWallService.generateOfferWallPage();
    
    res.json({
      success: true,
      message: 'Offers page generated successfully',
      timestamp: new Date().toISOString(),
      path: '/views/public/offers.html'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate offers page',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/admin/networks/cache/clear
 * @desc    Clear network cache
 * @access  Admin only
 */
router.post('/cache/clear', protect, admin, async (req, res) => {
  try {
    const networks = await NetworkIntegration.find();
    
    for (const network of networks) {
      network.cacheKey = `${network.name}-${Date.now()}`;
      network.lastGenerated = new Date();
      await network.save();
    }

    await offerWallService.cacheNetworks();
    await offerWallService.generateOfferWallPage();

    res.json({
      success: true,
      message: 'Network cache cleared successfully',
      count: networks.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache',
      error: error.message
    });
  }
});

module.exports = router;