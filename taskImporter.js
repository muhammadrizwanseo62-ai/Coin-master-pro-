/**
 * Task Importer Utility
 * Bulk import tasks from CSV, Excel, or API
 */

const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const { Readable } = require('stream');
const CustomTask = require('../models/CustomTask');
const CustomTaskCategory = require('../models/CustomTaskCategory');

class TaskImporter {
    
    constructor() {
        this.supportedFormats = ['csv', 'xlsx', 'xls', 'json'];
        this.requiredFields = ['title', 'description', 'rewardCoins', 'payoutUSD'];
        this.optionalFields = [
            'category', 'taskType', 'instructions', 'requirements',
            'totalSlots', 'perUserLimit', 'dailyLimit', 'userCooldown',
            'countries', 'countriesBlacklist', 'minAccountAge',
            'minGamesPlayed', 'minReferrals', 'minLoginStreak',
            'startDate', 'endDate', 'status', 'featured', 'priority'
        ];
    }

    /**
     * Import tasks from CSV file
     */
    async importFromCSV(fileBuffer, options = {}) {
        try {
            const results = [];
            const errors = [];
            const warnings = [];
            
            // Convert buffer to readable stream
            const stream = Readable.from(fileBuffer.toString());
            
            await new Promise((resolve, reject) => {
                stream
                    .pipe(csv({
                        separator: options.separator || ',',
                        headers: options.headers !== false
                    }))
                    .on('data', (data) => results.push(data))
                    .on('error', (error) => reject(error))
                    .on('end', resolve);
            });

            const imported = [];
            
            for (let i = 0; i < results.length; i++) {
                const row = results[i];
                try {
                    const validation = await this.validateImportData(row);
                    
                    if (validation.valid) {
                        const task = await this.createTaskFromData(row);
                        imported.push({
                            row: i + 2,
                            success: true,
                            taskId: task.taskId,
                            title: task.title
                        });
                    } else {
                        errors.push({
                            row: i + 2,
                            errors: validation.errors,
                            data: row
                        });
                    }
                } catch (error) {
                    errors.push({
                        row: i + 2,
                        errors: [error.message],
                        data: row
                    });
                }
            }

            return {
                success: true,
                total: results.length,
                imported: imported.length,
                failed: errors.length,
                imported,
                errors,
                warnings,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('CSV import error:', error);
            return {
                success: false,
                error: error.message,
                total: 0,
                imported: 0,
                failed: 0
            };
        }
    }

    /**
     * Import tasks from Excel file
     */
    async importFromExcel(fileBuffer, options = {}) {
        try {
            const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
            const sheetName = options.sheet || workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Convert to JSON
            const jsonData = xlsx.utils.sheet_to_json(worksheet, {
                header: options.headers !== false ? 1 : undefined,
                defval: '',
                blankrows: false
            });

            let data = jsonData;
            
            // If first row is headers
            if (options.headers !== false) {
                const headers = jsonData[0];
                data = jsonData.slice(1).map(row => {
                    const obj = {};
                    headers.forEach((header, index) => {
                        obj[header] = row[index];
                    });
                    return obj;
                });
            }

            const imported = [];
            const errors = [];
            const warnings = [];

            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                try {
                    const validation = await this.validateImportData(row);
                    
                    if (validation.valid) {
                        const task = await this.createTaskFromData(row);
                        imported.push({
                            row: i + (options.headers !== false ? 2 : 1),
                            success: true,
                            taskId: task.taskId,
                            title: task.title
                        });
                    } else {
                        errors.push({
                            row: i + (options.headers !== false ? 2 : 1),
                            errors: validation.errors,
                            data: row
                        });
                    }
                } catch (error) {
                    errors.push({
                        row: i + (options.headers !== false ? 2 : 1),
                        errors: [error.message],
                        data: row
                    });
                }
            }

            return {
                success: true,
                total: data.length,
                imported: imported.length,
                failed: errors.length,
                imported,
                errors,
                warnings,
                sheet: sheetName,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Excel import error:', error);
            return {
                success: false,
                error: error.message,
                total: 0,
                imported: 0,
                failed: 0
            };
        }
    }

    /**
     * Import tasks from JSON file
     */
    async importFromJSON(fileBuffer) {
        try {
            const jsonString = fileBuffer.toString('utf8');
            const data = JSON.parse(jsonString);
            
            let tasks = Array.isArray(data) ? data : [data];
            
            const imported = [];
            const errors = [];
            const warnings = [];

            for (let i = 0; i < tasks.length; i++) {
                const taskData = tasks[i];
                try {
                    const validation = await this.validateImportData(taskData);
                    
                    if (validation.valid) {
                        const task = await this.createTaskFromData(taskData);
                        imported.push({
                            index: i + 1,
                            success: true,
                            taskId: task.taskId,
                            title: task.title
                        });
                    } else {
                        errors.push({
                            index: i + 1,
                            errors: validation.errors,
                            data: taskData
                        });
                    }
                } catch (error) {
                    errors.push({
                        index: i + 1,
                        errors: [error.message],
                        data: taskData
                    });
                }
            }

            return {
                success: true,
                total: tasks.length,
                imported: imported.length,
                failed: errors.length,
                imported,
                errors,
                warnings,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('JSON import error:', error);
            return {
                success: false,
                error: error.message,
                total: 0,
                imported: 0,
                failed: 0
            };
        }
    }

    /**
     * Import tasks from external API
     */
    async importFromAPI(apiConfig) {
        try {
            const { url, method = 'GET', headers = {}, params = {}, transform } = apiConfig;
            
            // In production, use axios to fetch data
            // This is a mock implementation
            const mockData = this.generateMockApiData();
            
            let tasks = transform ? transform(mockData) : mockData;
            
            const imported = [];
            const errors = [];
            const warnings = [];

            for (let i = 0; i < tasks.length; i++) {
                const taskData = tasks[i];
                try {
                    const validation = await this.validateImportData(taskData);
                    
                    if (validation.valid) {
                        const task = await this.createTaskFromData(taskData);
                        imported.push({
                            index: i + 1,
                            success: true,
                            taskId: task.taskId,
                            title: task.title
                        });
                    } else {
                        errors.push({
                            index: i + 1,
                            errors: validation.errors,
                            data: taskData
                        });
                    }
                } catch (error) {
                    errors.push({
                        index: i + 1,
                        errors: [error.message],
                        data: taskData
                    });
                }
            }

            return {
                success: true,
                source: url || 'API',
                total: tasks.length,
                imported: imported.length,
                failed: errors.length,
                imported,
                errors,
                warnings,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('API import error:', error);
            return {
                success: false,
                error: error.message,
                total: 0,
                imported: 0,
                failed: 0
            };
        }
    }

    /**
     * Generate mock API data for testing
     */
    generateMockApiData() {
        return [
            {
                title: 'Binance Signup',
                description: 'Create Binance account and complete KYC',
                category: 'crypto',
                rewardCoins: 5000,
                payoutUSD: 2.00,
                instructions: ['Click link', 'Sign up', 'Complete KYC'],
                totalSlots: 1000
            },
            {
                title: 'Instagram Follow',
                description: 'Follow our Instagram account',
                category: 'social_media',
                rewardCoins: 1000,
                payoutUSD: 0.30,
                instructions: ['Click link', 'Follow account', 'Submit username'],
                totalSlots: 5000
            },
            {
                title: 'Telegram Join',
                description: 'Join our Telegram channel',
                category: 'telegram',
                rewardCoins: 500,
                payoutUSD: 0.15,
                instructions: ['Click link', 'Join channel', 'Submit Telegram ID'],
                totalSlots: 10000
            }
        ];
    }

    /**
     * Validate import data
     */
    async validateImportData(data) {
        const errors = [];
        const warnings = [];

        // Check required fields
        for (const field of this.requiredFields) {
            if (!data[field] && !data[field.toLowerCase()]) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        // Validate title
        if (data.title && data.title.length > 200) {
            errors.push('Title exceeds maximum length of 200 characters');
        }

        // Validate reward coins
        if (data.rewardCoins) {
            const coins = parseInt(data.rewardCoins);
            if (isNaN(coins) || coins < 100) {
                errors.push('Reward coins must be at least 100');
            }
            if (coins > 100000) {
                warnings.push('Reward coins exceed recommended maximum of 100,000');
            }
        }

        // Validate payout
        if (data.payoutUSD) {
            const payout = parseFloat(data.payoutUSD);
            if (isNaN(payout) || payout < 0.01) {
                errors.push('Payout must be at least $0.01');
            }
        }

        // Validate total slots
        if (data.totalSlots) {
            const slots = parseInt(data.totalSlots);
            if (isNaN(slots) || slots < 1) {
                errors.push('Total slots must be at least 1');
            }
        }

        // Validate category
        if (data.category) {
            const category = data.category.toLowerCase();
            const validCategories = [
                'crypto', 'social_media', 'app_install', 'survey',
                'signup', 'website_visit', 'youtube', 'instagram',
                'facebook', 'tiktok', 'telegram', 'other'
            ];
            
            if (!validCategories.includes(category)) {
                warnings.push(`Unknown category: ${category}. Using 'other'`);
                data.category = 'other';
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            cleaned: data
        };
    }

    /**
     * Create task from imported data
     */
    async createTaskFromData(data) {
        try {
            // Prepare task data
            const taskData = {
                title: data.title || data.Title || '',
                description: data.description || data.Description || '',
                category: data.category || data.Category || 'other',
                taskType: data.taskType || data.TaskType || 'custom',
                rewardCoins: parseInt(data.rewardCoins || data.RewardCoins || data.reward || 1000),
                payoutUSD: parseFloat(data.payoutUSD || data.PayoutUSD || data.payout || 1.00),
                instructions: this.parseArrayField(data.instructions || data.Instructions),
                requirements: this.parseArrayField(data.requirements || data.Requirements),
                totalSlots: parseInt(data.totalSlots || data.TotalSlots || 100),
                perUserLimit: parseInt(data.perUserLimit || data.PerUserLimit || 1),
                dailyLimit: parseInt(data.dailyLimit || data.DailyLimit || 0),
                userCooldown: parseInt(data.userCooldown || data.UserCooldown || 24),
                countries: this.parseArrayField(data.countries || data.Countries, ['WW']),
                countriesBlacklist: this.parseArrayField(data.countriesBlacklist || data.CountriesBlacklist),
                minAccountAge: parseInt(data.minAccountAge || data.MinAccountAge || 0),
                minGamesPlayed: parseInt(data.minGamesPlayed || data.MinGamesPlayed || 0),
                minReferrals: parseInt(data.minReferrals || data.MinReferrals || 0),
                minLoginStreak: parseInt(data.minLoginStreak || data.MinLoginStreak || 0),
                status: data.status || data.Status || 'draft',
                featured: this.parseBoolean(data.featured || data.Featured),
                priority: parseInt(data.priority || data.Priority || 3)
            };

            // Parse dates if provided
            if (data.startDate || data.StartDate) {
                taskData.startDate = new Date(data.startDate || data.StartDate);
            }
            if (data.endDate || data.EndDate) {
                taskData.endDate = new Date(data.endDate || data.EndDate);
            }

            // Calculate derived values
            taskData.rewardUSD = taskData.rewardCoins / 5000;
            taskData.profitUSD = taskData.payoutUSD - taskData.rewardUSD;

            // Create task
            const task = new CustomTask(taskData);
            await task.save();

            // Update category count
            if (task.category) {
                await CustomTaskCategory.findOneAndUpdate(
                    { name: { $regex: new RegExp(task.category, 'i') } },
                    { $inc: { taskCount: 1 } },
                    { upsert: true }
                );
            }

            return task;
        } catch (error) {
            console.error('Create task from data error:', error);
            throw error;
        }
    }

    /**
     * Parse array field from string
     */
    parseArrayField(value, defaultValue = []) {
        if (!value) return defaultValue;
        
        if (Array.isArray(value)) {
            return value;
        }
        
        if (typeof value === 'string') {
            // Split by commas, semicolons, or newlines
            return value.split(/[,;\n]+/).map(item => item.trim()).filter(item => item);
        }
        
        return defaultValue;
    }

    /**
     * Parse boolean field
     */
    parseBoolean(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            return ['true', 'yes', '1', 'on'].includes(value.toLowerCase());
        }
        if (typeof value === 'number') {
            return value === 1;
        }
        return false;
    }

    /**
     * Export tasks to CSV template
     */
    async generateCSVTemplate() {
        const headers = [
            'title',
            'description',
            'category',
            'taskType',
            'rewardCoins',
            'payoutUSD',
            'instructions',
            'requirements',
            'totalSlots',
            'perUserLimit',
            'dailyLimit',
            'userCooldown',
            'countries',
            'minAccountAge',
            'minGamesPlayed',
            'minReferrals',
            'minLoginStreak',
            'status',
            'featured',
            'priority'
        ];
        
        const example = [
            'Binance Signup',
            'Create Binance account and complete KYC verification',
            'crypto',
            'signup',
            '5000',
            '2.00',
            '1. Click the referral link\n2. Sign up for a new account\n3. Complete KYC verification\n4. Submit your Binance UID',
            'Must be new user\nMust complete KYC level 2',
            '1000',
            '1',
            '100',
            '168',
            'US,UK,CA,AU',
            '0',
            '0',
            '0',
            '0',
            'active',
            'true',
            '2'
        ];
        
        const csvContent = [
            headers.join(','),
            example.map(cell => `"${cell}"`).join(',')
        ].join('\n');
        
        return {
            success: true,
            headers,
            example,
            csv: csvContent,
            filename: 'task_import_template.csv'
        };
    }

    /**
     * Export tasks to Excel template
     */
    async generateExcelTemplate() {
        const headers = [
            'title',
            'description',
            'category',
            'taskType',
            'rewardCoins',
            'payoutUSD',
            'instructions',
            'requirements',
            'totalSlots',
            'perUserLimit',
            'dailyLimit',
            'userCooldown',
            'countries',
            'minAccountAge',
            'minGamesPlayed',
            'minReferrals',
            'minLoginStreak',
            'status',
            'featured',
            'priority'
        ];
        
        const example = [
            'Binance Signup',
            'Create Binance account and complete KYC verification',
            'crypto',
            'signup',
            5000,
            2.00,
            '1. Click the referral link\n2. Sign up for a new account\n3. Complete KYC verification\n4. Submit your Binance UID',
            'Must be new user\nMust complete KYC level 2',
            1000,
            1,
            100,
            168,
            'US,UK,CA,AU',
            0,
            0,
            0,
            0,
            'active',
            true,
            2
        ];
        
        const wsData = [headers, example];
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet(wsData);
        
        // Add column widths
        ws['!cols'] = [
            { wch: 30 },  // title
            { wch: 50 },  // description
            { wch: 15 },  // category
            { wch: 15 },  // taskType
            { wch: 12 },  // rewardCoins
            { wch: 10 },  // payoutUSD
            { wch: 40 },  // instructions
            { wch: 40 },  // requirements
            { wch: 12 },  // totalSlots
            { wch: 12 },  // perUserLimit
            { wch: 12 },  // dailyLimit
            { wch: 12 },  // userCooldown
            { wch: 20 },  // countries
            { wch: 12 },  // minAccountAge
            { wch: 12 },  // minGamesPlayed
            { wch: 12 },  // minReferrals
            { wch: 12 },  // minLoginStreak
            { wch: 10 },  // status
            { wch: 8 },   // featured
            { wch: 8 }    // priority
        ];
        
        xlsx.utils.book_append_sheet(wb, ws, 'Tasks');
        
        // Add instructions sheet
        const instructionsData = [
            ['Task Import Template Instructions'],
            [''],
            ['Required Fields:'],
            ['- title: Task title (max 200 characters)'],
            ['- description: Task description'],
            ['- rewardCoins: Coins awarded (min 100, 5000 coins = $1)'],
            ['- payoutUSD: Amount client pays you (min $0.01)'],
            [''],
            ['Optional Fields:'],
            ['- category: crypto, social_media, app_install, survey, signup, website_visit, youtube, instagram, telegram, other'],
            ['- taskType: link_click, app_download, signup, follow, like, comment, subscribe, watch, review, custom'],
            ['- instructions: Step by step instructions (use \\n for new lines)'],
            ['- requirements: Task requirements (use \\n for new lines)'],
            ['- totalSlots: Maximum completions (default: 100)'],
            ['- perUserLimit: Times per user (default: 1)'],
            ['- dailyLimit: Daily completions limit (0 = unlimited)'],
            ['- userCooldown: Hours before redo (default: 24)'],
            ['- countries: Comma-separated country codes (WW = Worldwide)'],
            ['- minAccountAge: Minimum account age in days'],
            ['- minGamesPlayed: Minimum games played'],
            ['- minReferrals: Minimum referrals'],
            ['- minLoginStreak: Minimum login streak'],
            ['- status: draft, pending_review, active, paused, expired, completed'],
            ['- featured: true/false'],
            ['- priority: 1-5 (1 highest, 5 lowest)'],
            [''],
            ['Notes:'],
            ['- Do not modify the header row'],
            ['- Fields are case-sensitive'],
            ['- Use double quotes for fields containing commas'],
            ['- Save file as .xlsx format']
        ];
        
        const wsInstructions = xlsx.utils.aoa_to_sheet(instructionsData);
        wsInstructions['!cols'] = [{ wch: 80 }];
        xlsx.utils.book_append_sheet(wb, wsInstructions, 'Instructions');
        
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        return {
            success: true,
            buffer,
            filename: 'task_import_template.xlsx'
        };
    }
}

module.exports = new TaskImporter();