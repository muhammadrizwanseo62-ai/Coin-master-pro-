const jwt = require('jsonwebtoken');
const User = require('../models/User');
const constants = require('../config/constants');

/**
 * Middleware: Protect routes - Verify JWT token
 * Ensures user is authenticated
 */
async function protect(req, res, next) {
  try {
    let token;
    
    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized - No token provided'
      });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, constants.JWT_SECRET);
      
      // Get user from token
      const user = await User.findById(decoded.id).select('-__v');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized - User not found'
        });
      }
      
      if (user.isBanned) {
        return res.status(403).json({
          success: false,
          message: 'Account banned',
          reason: user.banReason || 'Violation of terms'
        });
      }
      
      // Attach user to request
      req.user = {
        id: user._id,
        telegramId: user.telegramId,
        username: user.username
      };
      
      next();
      
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Not authorized - Invalid token'
        });
      }
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Not authorized - Token expired'
        });
      }
      
      throw error;
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
}

/**
 * Middleware: Optional auth - Doesn't require token but attaches user if present
 */
async function optionalAuth(req, res, next) {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (token) {
      try {
        const decoded = jwt.verify(token, constants.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-__v');
        
        if (user && !user.isBanned) {
          req.user = {
            id: user._id,
            telegramId: user.telegramId,
            username: user.username
          };
        }
      } catch (error) {
        // Silently fail - user remains unauthenticated
      }
    }
    
    next();
    
  } catch (error) {
    next();
  }
}

/**
 * Middleware: Admin only
 */
async function adminOnly(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized - Admin access required'
      });
    }
    
    next();
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Admin check failed',
      error: error.message
    });
  }
}

/**
 * Generate JWT token
 */
function generateToken(userId) {
  return jwt.sign(
    { id: userId },
    constants.JWT_SECRET,
    { expiresIn: constants.JWT_EXPIRE }
  );
}

module.exports = {
  protect,
  optionalAuth,
  adminOnly,
  generateToken
};