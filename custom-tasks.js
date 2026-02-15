const express = require('express');
const router = express.Router();
const {
  getCustomTasks,
  getTaskById,
  startTask,
  submitTaskProof,
  checkEligibility,
  getUserTaskHistory,
  getUserTaskStats
} = require('../controllers/customTaskController');
const { protect } = require('../middleware/auth');
const taskEligibility = require('../middleware/taskEligibility');

/**
 * @route   GET /api/custom-tasks
 * @desc    Get all custom tasks with filters
 * @access  Public/Protected
 */
router.get('/', getCustomTasks);

/**
 * @route   GET /api/custom-tasks/featured
 * @desc    Get featured custom tasks
 * @access  Public
 */
router.get('/featured', async (req, res) => {
  try {
    const CustomTask = require('../models/CustomTask');
    const tasks = await CustomTask.find({ 
      featured: true, 
      status: 'active',
      startDate: { $lte: new Date() },
      $or: [
        { endDate: { $gte: new Date() } },
        { endDate: null }
      ]
    })
    .sort({ priority: 1, createdAt: -1 })
    .limit(20);
    
    res.json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured tasks',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/custom-tasks/categories
 * @desc    Get all categories
 * @access  Public
 */
router.get('/categories', async (req, res) => {
  try {
    const CustomTaskCategory = require('../models/CustomTaskCategory');
    const categories = await CustomTaskCategory.find({ active: true })
      .populate('subcategories')
      .sort({ sortOrder: 1, name: 1 });
    
    res.json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/custom-tasks/category/:slug
 * @desc    Get tasks by category slug
 * @access  Public
 */
router.get('/category/:slug', async (req, res) => {
  try {
    const CustomTask = require('../models/CustomTask');
    const CustomTaskCategory = require('../models/CustomTaskCategory');
    
    const category = await CustomTaskCategory.findOne({ slug: req.params.slug, active: true });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    const tasks = await CustomTask.find({ 
      category: category.name.toLowerCase().replace(' ', '_'),
      status: 'active',
      startDate: { $lte: new Date() },
      $or: [
        { endDate: { $gte: new Date() } },
        { endDate: null }
      ]
    }).sort({ featured: -1, priority: 1, createdAt: -1 });
    
    res.json({
      success: true,
      category,
      count: tasks.length,
      tasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category tasks',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/custom-tasks/:id
 * @desc    Get single custom task
 * @access  Public
 */
router.get('/:id', getTaskById);

/**
 * @route   POST /api/custom-tasks/:id/start
 * @desc    Start a task
 * @access  Protected
 */
router.post('/:id/start', protect, taskEligibility.checkAll, startTask);

/**
 * @route   POST /api/custom-tasks/:id/submit
 * @desc    Submit proof for a task
 * @access  Protected
 */
router.post('/:id/submit', protect, submitTaskProof);

/**
 * @route   GET /api/custom-tasks/:id/status
 * @desc    Check submission status
 * @access  Protected
 */
router.get('/:id/status', protect, async (req, res) => {
  try {
    const CustomTaskSubmission = require('../models/CustomTaskSubmission');
    const submission = await CustomTaskSubmission.findOne({
      taskId: req.params.id,
      userId: req.user._id
    }).sort({ submittedAt: -1 });
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'No submission found for this task'
      });
    }
    
    res.json({
      success: true,
      submission: {
        submissionId: submission.submissionId,
        status: submission.status,
        submittedAt: submission.submittedAt,
        processedAt: submission.processedAt,
        rejectionReason: submission.rejectionReason,
        fraudScore: submission.fraudScore
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check submission status',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/custom-tasks/user/history
 * @desc    Get user task history
 * @access  Protected
 */
router.get('/user/history', protect, getUserTaskHistory);

/**
 * @route   GET /api/custom-tasks/user/stats
 * @desc    Get user task statistics
 * @access  Protected
 */
router.get('/user/stats', protect, getUserTaskStats);

module.exports = router;