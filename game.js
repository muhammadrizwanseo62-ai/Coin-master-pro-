const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const authMiddleware = require('../middleware/auth');

router.post('/start', authMiddleware, gameController.startGame);
router.post('/end', authMiddleware, gameController.endGame);
router.post('/tap', authMiddleware, gameController.registerTap);
router.get('/history', authMiddleware, gameController.getGameHistory);
router.get('/session/:sessionId', authMiddleware, gameController.getSession);

module.exports = router;