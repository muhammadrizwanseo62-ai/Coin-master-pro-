const rateLimit = require('express-rate-limit');
const constants = require('../config/constants');

const rateLimiter = rateLimit({
    windowMs: constants.RATE_LIMIT_WINDOW,
    max: constants.RATE_LIMIT_MAX_REQUESTS,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for health check
        return req.path === '/health';
    }
});

module.exports = rateLimiter;