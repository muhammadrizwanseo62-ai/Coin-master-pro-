const express = require('express');
const router = express.Router();
const adManagerController = require('../controllers/adManagerController');
const inlineAdController = require('../controllers/inlineAdController');
const authMiddleware = require('../middleware/auth');

// Ad Configuration Routes
router.post('/ads', authMiddleware, adManagerController.createAd);
router.get('/ads', authMiddleware, adManagerController.getAllAds);
router.get('/ads/:id', authMiddleware, adManagerController.getAdById);
router.put('/ads/:id', authMiddleware, adManagerController.updateAd);
router.delete('/ads/:id', authMiddleware, adManagerController.deleteAd);
router.patch('/ads/:id/toggle', authMiddleware, adManagerController.toggleAdStatus);

// Ad Analytics Routes
router.get('/analytics/overview', authMiddleware, adManagerController.getAnalyticsOverview);
router.get('/analytics/performance', authMiddleware, adManagerController.getPerformanceData);
router.get('/analytics/revenue', authMiddleware, adManagerController.getRevenueData);

// In-Line Ad Routes
router.post('/inline-ads', authMiddleware, inlineAdController.createInlineAd);
router.get('/inline-ads', authMiddleware, inlineAdController.getAllInlineAds);
router.get('/inline-ads/:positionId', authMiddleware, inlineAdController.getInlineAdByPosition);
router.put('/inline-ads/:positionId', authMiddleware, inlineAdController.updateInlineAd);
router.patch('/inline-ads/:positionId/toggle', authMiddleware, inlineAdController.toggleInlineAd);

// In-Line Ad Analytics
router.get('/inline-ads/:positionId/metrics', authMiddleware, inlineAdController.getInlineAdMetrics);
router.get('/inline-ads/analytics/performance', authMiddleware, inlineAdController.getInlineAdPerformance);

// Ad Serving Routes (Public)
router.get('/serve/:position', adManagerController.getAdForPosition);
router.post('/track/impression/:adId', adManagerController.trackImpression);
router.post('/track/click/:adId', adManagerController.trackClick);

module.exports = router;