const Admin = require('../models/Admin');
const AdminLog = require('../models/AdminLog');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// Generate JWT token
const generateToken = (admin) => {
    return jwt.sign(
        { 
            id: admin._id, 
            username: admin.username, 
            role: admin.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
};

// Login
exports.login = async (req, res) => {
    try {
        const { username, password, twoFactorCode } = req.body;
        
        // Find admin
        const admin = await Admin.findOne({ 
            $or: [
                { username: username.toLowerCase() },
                { email: username.toLowerCase() }
            ]
        });
        
        if (!admin) {
            await AdminLog.create({
                admin: null,
                action: 'LOGIN',
                details: `Failed login attempt for username: ${username}`,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        // Check status
        if (admin.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'Account is not active'
            });
        }
        
        // Verify password
        const isValid = await admin.comparePassword(password);
        if (!isValid) {
            await AdminLog.create({
                admin: admin._id,
                action: 'LOGIN',
                details: 'Failed login attempt - invalid password',
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        // Check 2FA if enabled
        if (admin.twoFactorEnabled) {
            if (!twoFactorCode) {
                return res.status(401).json({
                    success: false,
                    message: '2FA code required',
                    twoFactorRequired: true
                });
            }
            
            const verified = speakeasy.totp.verify({
                secret: admin.twoFactorSecret,
                encoding: 'base32',
                token: twoFactorCode
            });
            
            if (!verified) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid 2FA code'
                });
            }
        }
        
        // Update last login
        admin.lastLogin = new Date();
        admin.lastLoginIp = req.ip;
        await admin.save();
        
        // Generate token
        const token = generateToken(admin);
        
        // Log successful login
        await AdminLog.create({
            admin: admin._id,
            action: 'LOGIN',
            details: 'Successful login',
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                admin: {
                    id: admin._id,
                    username: admin.username,
                    email: admin.email,
                    fullName: admin.fullName,
                    role: admin.role,
                    permissions: admin.permissions,
                    avatar: admin.avatar,
                    twoFactorEnabled: admin.twoFactorEnabled
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
};

// Logout
exports.logout = async (req, res) => {
    try {
        await AdminLog.create({
            admin: req.admin._id,
            action: 'LOGOUT',
            details: 'User logged out',
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        
        res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Logout failed',
            error: error.message
        });
    }
};

// Refresh token
exports.refreshToken = async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
        const admin = await Admin.findById(decoded.id);
        
        if (!admin || admin.status !== 'active') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        
        const newToken = generateToken(admin);
        
        res.json({
            success: true,
            data: { token: newToken }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Token refresh failed',
            error: error.message
        });
    }
};

// Get profile
exports.getProfile = async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin._id).select('-password -twoFactorSecret');
        
        res.json({
            success: true,
            data: admin
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get profile',
            error: error.message
        });
    }
};

// Update profile
exports.updateProfile = async (req, res) => {
    try {
        const { fullName, email, avatar } = req.body;
        
        const admin = await Admin.findById(req.admin._id);
        
        if (fullName) admin.fullName = fullName;
        if (email) admin.email = email;
        if (avatar) admin.avatar = avatar;
        
        await admin.save();
        
        await AdminLog.create({
            admin: req.admin._id,
            action: 'UPDATE_PROFILE',
            details: 'Profile updated',
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                fullName: admin.fullName,
                email: admin.email,
                avatar: admin.avatar
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error.message
        });
    }
};

// Change password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        const admin = await Admin.findById(req.admin._id);
        
        const isValid = await admin.comparePassword(currentPassword);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }
        
        admin.password = newPassword;
        await admin.save();
        
        await AdminLog.create({
            admin: req.admin._id,
            action: 'CHANGE_PASSWORD',
            details: 'Password changed',
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to change password',
            error: error.message
        });
    }
};

// Enable 2FA
exports.enableTwoFactor = async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin._id);
        
        if (admin.twoFactorEnabled) {
            return res.status(400).json({
                success: false,
                message: '2FA is already enabled'
            });
        }
        
        // Generate secret
        const secret = speakeasy.generateSecret({
            name: `TG Admin: ${admin.username}`
        });
        
        // Generate QR code
        const qrCode = await QRCode.toDataURL(secret.otpauth_url);
        
        // Save secret temporarily (will be verified before enabling)
        admin.twoFactorSecret = secret.base32;
        await admin.save();
        
        res.json({
            success: true,
            data: {
                secret: secret.base32,
                qrCode
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to enable 2FA',
            error: error.message
        });
    }
};

// Verify and enable 2FA
exports.verifyTwoFactor = async (req, res) => {
    try {
        const { token } = req.body;
        
        const admin = await Admin.findById(req.admin._id);
        
        const verified = speakeasy.totp.verify({
            secret: admin.twoFactorSecret,
            encoding: 'base32',
            token
        });
        
        if (!verified) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification code'
            });
        }
        
        admin.twoFactorEnabled = true;
        await admin.save();
        
        await AdminLog.create({
            admin: req.admin._id,
            action: 'ENABLE_2FA',
            details: 'Two-factor authentication enabled',
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: '2FA enabled successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to verify 2FA',
            error: error.message
        });
    }
};

// Get all admins (super admin only)
exports.getAllAdmins = async (req, res) => {
    try {
        if (req.admin.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        const admins = await Admin.find()
            .select('-password -twoFactorSecret')
            .populate('createdBy', 'username');
        
        res.json({
            success: true,
            data: admins
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get admins',
            error: error.message
        });
    }
};

// Create admin (super admin only)
exports.createAdmin = async (req, res) => {
    try {
        if (req.admin.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        const admin = new Admin({
            ...req.body,
            createdBy: req.admin._id
        });
        
        await admin.save();
        
        await AdminLog.create({
            admin: req.admin._id,
            action: 'CREATE_ADMIN',
            details: `Created admin: ${admin.username}`,
            ip: req.ip
        });
        
        res.status(201).json({
            success: true,
            message: 'Admin created successfully',
            data: {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                role: admin.role
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to create admin',
            error: error.message
        });
    }
};

// Get admin by ID (super admin only)
exports.getAdminById = async (req, res) => {
    try {
        if (req.admin.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        const admin = await Admin.findById(req.params.id)
            .select('-password -twoFactorSecret')
            .populate('createdBy', 'username');
        
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }
        
        res.json({
            success: true,
            data: admin
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get admin',
            error: error.message
        });
    }
};

// Update admin (super admin only)
exports.updateAdmin = async (req, res) => {
    try {
        if (req.admin.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        const admin = await Admin.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: Date.now() },
            { new: true, runValidators: true }
        ).select('-password -twoFactorSecret');
        
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }
        
        await AdminLog.create({
            admin: req.admin._id,
            action: 'UPDATE_ADMIN',
            details: `Updated admin: ${admin.username}`,
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Admin updated successfully',
            data: admin
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update admin',
            error: error.message
        });
    }
};

// Delete admin (super admin only)
exports.deleteAdmin = async (req, res) => {
    try {
        if (req.admin.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        const admin = await Admin.findById(req.params.id);
        
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }
        
        if (admin.role === 'super_admin' && admin._id.toString() !== req.admin._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Cannot delete another super admin'
            });
        }
        
        await admin.remove();
        
        await AdminLog.create({
            admin: req.admin._id,
            action: 'DELETE_ADMIN',
            details: `Deleted admin: ${admin.username}`,
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Admin deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete admin',
            error: error.message
        });
    }
};

// Toggle admin status (super admin only)
exports.toggleAdminStatus = async (req, res) => {
    try {
        if (req.admin.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        const admin = await Admin.findById(req.params.id);
        
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }
        
        admin.status = admin.status === 'active' ? 'inactive' : 'active';
        await admin.save();
        
        await AdminLog.create({
            admin: req.admin._id,
            action: 'TOGGLE_ADMIN_STATUS',
            details: `Changed admin ${admin.username} status to ${admin.status}`,
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: `Admin ${admin.status === 'active' ? 'activated' : 'deactivated'} successfully`,
            data: { status: admin.status }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to toggle admin status',
            error: error.message
        });
    }
};

// Get dashboard stats
exports.getDashboardStats = async (req, res) => {
    try {
        // This would aggregate data from various collections
        const stats = {
            totalUsers: 125432,
            activeUsers: 98765,
            newUsersToday: 1234,
            totalRevenue: 45678,
            revenueToday: 2345,
            totalWithdrawals: 34567,
            pendingWithdrawals: 123,
            totalAds: 45,
            activeAds: 32,
            totalTasks: 67,
            completedTasksToday: 1234
        };
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get dashboard stats',
            error: error.message
        });
    }
};

// Get recent activity
exports.getRecentActivity = async (req, res) => {
    try {
        const activities = await AdminLog.find()
            .populate('admin', 'username')
            .sort({ timestamp: -1 })
            .limit(20);
        
        res.json({
            success: true,
            data: activities
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get recent activity',
            error: error.message
        });
    }
};

// Get chart data
exports.getChartData = async (req, res) => {
    try {
        const { type = 'revenue', days = 30 } = req.query;
        
        // This would generate chart data based on type
        const data = {
            labels: Array.from({ length: days }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (days - 1 - i));
                return d.toLocaleDateString();
            }),
            values: Array.from({ length: days }, () => Math.floor(Math.random() * 1000) + 500)
        };
        
        res.json({
            success: true,
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get chart data',
            error: error.message
        });
    }
};

// Get system settings
exports.getSettings = async (req, res) => {
    try {
        // This would load from database
        const settings = {
            appName: 'TG Mini App',
            appUrl: 'https://t.me/miniappbot',
            minWithdrawal: 5,
            maxWithdrawal: 1000,
            withdrawalDay: 15,
            referralBonus: 100,
            referralBonusPercent: 10,
            taskVerification: 'manual',
            maintenanceMode: false,
            adRefreshRate: 30,
            defaultLanguage: 'en',
            timezone: 'UTC',
            currency: 'USD'
        };
        
        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get settings',
            error: error.message
        });
    }
};

// Update system settings
exports.updateSettings = async (req, res) => {
    try {
        const settings = req.body;
        
        // This would save to database
        console.log('Settings updated:', settings);
        
        await AdminLog.create({
            admin: req.admin._id,
            action: 'UPDATE_SETTINGS',
            details: 'System settings updated',
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Settings updated successfully',
            data: settings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update settings',
            error: error.message
        });
    }
};

// Get audit logs
exports.getAuditLogs = async (req, res) => {
    try {
        const { page = 1, limit = 50, action, adminId } = req.query;
        
        const query = {};
        if (action) query.action = action;
        if (adminId) query.admin = adminId;
        
        const logs = await AdminLog.find(query)
            .populate('admin', 'username')
            .sort({ timestamp: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
        
        const total = await AdminLog.countDocuments(query);
        
        res.json({
            success: true,
            data: logs,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get audit logs',
            error: error.message
        });
    }
};

// Export logs
exports.exportLogs = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const query = {};
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }
        
        const logs = await AdminLog.find(query)
            .populate('admin', 'username')
            .sort({ timestamp: -1 });
        
        const csv = logs.map(log => ({
            timestamp: log.timestamp,
            admin: log.admin?.username || 'System',
            action: log.action,
            details: log.details,
            ip: log.ip
        }));
        
        res.json({
            success: true,
            data: csv
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to export logs',
            error: error.message
        });
    }
};