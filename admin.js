const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiting for login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: 'Too many login attempts, please try again later'
});

// Auth routes
router.post('/login', loginLimiter, adminController.login);
router.post('/logout', authMiddleware, adminController.logout);
router.post('/refresh-token', adminController.refreshToken);

// Profile routes
router.get('/profile', authMiddleware, adminController.getProfile);
router.put('/profile', authMiddleware, adminController.updateProfile);
router.post('/change-password', authMiddleware, adminController.changePassword);
router.post('/enable-2fa', authMiddleware, adminController.enableTwoFactor);
router.post('/verify-2fa', authMiddleware, adminController.verifyTwoFactor);

// Admin management (super admin only)
router.get('/admins', authMiddleware, adminController.getAllAdmins);
router.post('/admins', authMiddleware, adminController.createAdmin);
router.get('/admins/:id', authMiddleware, adminController.getAdminById);
router.put('/admins/:id', authMiddleware, adminController.updateAdmin);
router.delete('/admins/:id', authMiddleware, adminController.deleteAdmin);
router.patch('/admins/:id/status', authMiddleware, adminController.toggleAdminStatus);

// Dashboard data
router.get('/dashboard/stats', authMiddleware, adminController.getDashboardStats);
router.get('/dashboard/recent-activity', authMiddleware, adminController.getRecentActivity);
router.get('/dashboard/chart-data', authMiddleware, adminController.getChartData);

// System settings
router.get('/settings', authMiddleware, adminController.getSettings);
router.put('/settings', authMiddleware, adminController.updateSettings);

// Audit logs
router.get('/logs', authMiddleware, adminController.getAuditLogs);
router.get('/logs/export', authMiddleware, adminController.exportLogs);

module.exports = router;