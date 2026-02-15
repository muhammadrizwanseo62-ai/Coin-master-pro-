const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  createCustomTask,
  updateCustomTask,
  deleteCustomTask,
  duplicateCustomTask,
  getPendingSubmissions,
  approveSubmission,
  rejectSubmission,
  bulkApproveSubmissions,
  getTaskAnalytics,
  manageCategories
} = require('../controllers/adminCustomTaskController');
const { protect, admin } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, path.join(__dirname, '../../uploads/tasks'));
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'task-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: function(req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|webp|pdf/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images and PDFs are allowed'));
  }
});

/**
 * @route   POST /api/admin/custom-tasks
 * @desc    Create new custom task
 * @access  Admin only
 */
router.post('/', protect, admin, upload.array('images', 5), createCustomTask);

/**
 * @route   PUT /api/admin/custom-tasks/:id
 * @desc    Update custom task
 * @access  Admin only
 */
router.put('/:id', protect, admin, upload.array('images', 5), updateCustomTask);

/**
 * @route   DELETE /api/admin/custom-tasks/:id
 * @desc    Delete custom task
 * @access  Admin only
 */
router.delete('/:id', protect, admin, deleteCustomTask);

/**
 * @route   POST /api/admin/custom-tasks/:id/duplicate
 * @desc    Duplicate custom task
 * @access  Admin only
 */
router.post('/:id/duplicate', protect, admin, duplicateCustomTask);

/**
 * @route   GET /api/admin/custom-tasks/pending
 * @desc    Get pending submissions
 * @access  Admin only
 */
router.get('/pending', protect, admin, getPendingSubmissions);

/**
 * @route   POST /api/admin/custom-tasks/submission/:id/approve
 * @desc    Approve submission
 * @access  Admin only
 */
router.post('/submission/:id/approve', protect, admin, approveSubmission);

/**
 * @route   POST /api/admin/custom-tasks/submission/:id/reject
 * @desc    Reject submission
 * @access  Admin only
 */
router.post('/submission/:id/reject', protect, admin, rejectSubmission);

/**
 * @route   POST /api/admin/custom-tasks/submission/:id/refund
 * @desc    Refund coins for rejected submission
 * @access  Admin only
 */
router.post('/submission/:id/refund', protect, admin, async (req, res) => {
  try {
    const CustomTaskSubmission = require('../models/CustomTaskSubmission');
    const User = require('../models/User');
    
    const submission = await CustomTaskSubmission.findById(req.params.id)
      .populate('taskId');
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }
    
    if (submission.status !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Only rejected submissions can be refunded'
      });
    }
    
    // Refund coins to user
    const user = await User.findById(submission.userId);
    user.coins += submission.taskId.rewardCoins;
    await user.save();
    
    submission.status = 'paid';
    submission.paidAt = Date.now();
    submission.adminNotes = submission.adminNotes + ' | Coins refunded on ' + new Date().toISOString();
    await submission.save();
    
    res.json({
      success: true,
      message: 'Coins refunded successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to refund coins',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/custom-tasks/submissions/bulk-approve
 * @desc    Bulk approve submissions
 * @access  Admin only
 */
router.post('/submissions/bulk-approve', protect, admin, bulkApproveSubmissions);

/**
 * @route   GET /api/admin/custom-tasks/analytics
 * @desc    Get task analytics
 * @access  Admin only
 */
router.get('/analytics', protect, admin, getTaskAnalytics);

/**
 * @route   POST /api/admin/custom-tasks/categories
 * @desc    Create category
 * @access  Admin only
 */
router.post('/categories', protect, admin, manageCategories.createCategory);

/**
 * @route   PUT /api/admin/custom-tasks/categories/:id
 * @desc    Update category
 * @access  Admin only
 */
router.put('/categories/:id', protect, admin, manageCategories.updateCategory);

/**
 * @route   DELETE /api/admin/custom-tasks/categories/:id
 * @desc    Delete category
 * @access  Admin only
 */
router.delete('/categories/:id', protect, admin, manageCategories.deleteCategory);

/**
 * @route   GET /api/admin/custom-tasks/categories
 * @desc    Get all categories
 * @access  Admin only
 */
router.get('/categories', protect, admin, manageCategories.getCategories);

module.exports = router;