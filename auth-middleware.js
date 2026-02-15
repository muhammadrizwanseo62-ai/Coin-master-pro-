const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Authentication middleware
const protect = async (req, res, next) => {
    try {
        let token;
        
        // Check Authorization header
        const authHeader = req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.replace('Bearer ', '');
        }
        
        // Check cookie as fallback
        if (!token && req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');

        // Find admin
        const admin = await Admin.findById(decoded.id).select('-password -twoFactorSecret');
        
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token - user not found'
            });
        }

        // Check if admin is active
        if (admin.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'Account is not active. Please contact super admin.'
            });
        }

        // Attach admin to request
        req.admin = admin;
        req.adminId = admin._id;
        
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired. Please login again.'
            });
        }
        
        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Role-based authorization
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!roles.includes(req.admin.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required roles: ${roles.join(', ')}. Your role: ${req.admin.role}`
            });
        }

        next();
    };
};

// Permission-based authorization
const hasPermission = (requiredPermission) => {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Super admin has all permissions
        if (req.admin.role === 'super_admin') {
            return next();
        }

        if (!req.admin.permissions || !req.admin.permissions.includes(requiredPermission)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required permission: ${requiredPermission}`
            });
        }

        next();
    };
};

// Activity logging middleware
const logActivity = (action) => {
    return async (req, res, next) => {
        // Store original json method
        const originalJson = res.json;
        
        // Override json method
        res.json = function(data) {
            // Log activity after response is sent
            if (data.success) {
                const AdminLog = require('../models/AdminLog');
                
                // Don't wait for logging to complete
                AdminLog.create({
                    admin: req.admin?._id,
                    action: action,
                    details: `${action} performed by ${req.admin?.username || 'Unknown'}`,
                    ip: req.ip || req.connection.remoteAddress,
                    userAgent: req.get('User-Agent'),
                    metadata: {
                        method: req.method,
                        url: req.originalUrl,
                        body: req.body,
                        query: req.query,
                        params: req.params,
                        responseStatus: res.statusCode
                    }
                }).catch(err => console.error('Error logging activity:', err));
            }
            
            // Call original json method
            originalJson.call(this, data);
        };
        
        next();
    };
};

// Rate limiting configuration
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health';
    }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts
    message: {
        success: false,
        message: 'Too many login attempts, please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

const adCreationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 ad creations per hour
    message: {
        success: false,
        message: 'Too many ad creation requests, please try again later.'
    }
});

// CSRF Protection setup
const csrf = require('csurf');
const csrfProtection = csrf({ 
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    }
});

// Validate MongoDB ObjectId
const validateObjectId = (paramName = 'id') => {
    return (req, res, next) => {
        const id = req.params[paramName];
        
        if (id && !id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({
                success: false,
                message: `Invalid ${paramName} format. Must be a valid MongoDB ObjectId.`
            });
        }
        
        next();
    };
};

// Check if admin is super admin
const isSuperAdmin = (req, res, next) => {
    if (!req.admin) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    if (req.admin.role !== 'super_admin') {
        return res.status(403).json({
            success: false,
            message: 'This action requires super admin privileges'
        });
    }

    next();
};

// Check if admin is accessing their own resource
const isOwnResource = (paramName = 'id') => {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const resourceId = req.params[paramName];
        
        // Super admin can access any resource
        if (req.admin.role === 'super_admin') {
            return next();
        }

        // Check if admin ID matches resource ID
        if (resourceId && resourceId !== req.admin._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only access your own resources'
            });
        }

        next();
    };
};

// Request sanitization middleware
const sanitizeRequest = (req, res, next) => {
    // Remove any potentially dangerous keys from body
    if (req.body) {
        const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
        dangerousKeys.forEach(key => {
            if (req.body[key]) {
                delete req.body[key];
            }
        });
    }
    next();
};

module.exports = {
    protect,
    authorize,
    hasPermission,
    logActivity,
    apiLimiter,
    authLimiter,
    adCreationLimiter,
    csrfProtection,
    validateObjectId,
    isSuperAdmin,
    isOwnResource,
    sanitizeRequest
};