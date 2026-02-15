const express = require('express');
const router = express.Router();
const adsController = require('../controllers/adsController');
const authMiddleware = require('../middleware/auth');

router.post('/watch', authMiddleware, adsController.watchAd);
router.get('/status', authMiddleware, adsController.getAdStatus);
router.get('/history', authMiddleware, adsController.getAdHistory);
router.post('/reward', authMiddleware, adsController.claimReward);

module.exports = router;