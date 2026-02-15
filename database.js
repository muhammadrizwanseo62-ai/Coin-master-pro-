const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        logger.info(`MongoDB Connected: ${conn.connection.host}`);
        
        // Create indexes
        await createIndexes();
        
    } catch (error) {
        logger.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const createIndexes = async () => {
    try {
        const db = mongoose.connection;
        
        // Get User model
        const User = require('../models/User');
        
        // Create indexes
        await User.collection.createIndex({ telegramId: 1 }, { unique: true });
        await User.collection.createIndex({ referralCode: 1 }, { unique: true });
        await User.collection.createIndex({ referredBy: 1 });
        await User.collection.createIndex({ createdAt: -1 });
        
        logger.info('Database indexes created successfully');
    } catch (error) {
        logger.error('Error creating indexes:', error);
    }
};

module.exports = connectDB;