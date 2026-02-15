const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const Transaction = require('../models/Transaction');
const { validateBNBTRXAddress } = require('../utils/tonWalletValidator');
const { isTodayWithdrawalDay } = require('../utils/withdrawalDateCheck');
const constants = require('../config/constants');

/**
 * Withdrawal Service - Handles all withdrawal business logic
 * STRICT: 15th only, min $15, max $500, 15% fee
 */
class WithdrawalService {
  
  /**
   * Validate withdrawal request
   */
  async validateWithdrawalRequest(userId, amount, walletAddress) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Date validation - STRICT
    if (!isTodayWithdrawalDay()) {
      throw new Error('Withdrawals are only available on the 15th of each month');
    }
    
    // Amount validation
    if (amount < constants.MIN_WITHDRAWAL_COINS) {
      throw new Error(`Minimum withdrawal is ${constants.MIN_WITHDRAWAL_COINS} coins ($${constants.MIN_WITHDRAWAL_USD} USD)`);
    }
    
    if (amount > constants.MAX_WITHDRAWAL_COINS) {
      throw new Error(`Maximum withdrawal is ${constants.MAX_WITHDRAWAL_COINS} coins per month`);
    }
    
    // Balance check
    if (user.balance < amount) {
      throw new Error(`Insufficient balance. You have ${user.balance} coins`);
    }
    
    // Monthly limit check
    const currentMonth = `${new Date().getMonth() + 1}-${new Date().getFullYear()}`;
    if (user.lastWithdrawalMonth === currentMonth) {
      const remainingLimit = constants.MAX_WITHDRAWAL_COINS - user.monthlyWithdrawalAmount;
      if (amount > remainingLimit) {
        throw new Error(`Monthly limit exceeded. Remaining: ${remainingLimit} coins`);
      }
    }
    
    // Wallet validation
    if (!validateBNBTRXAddress(walletAddress)) {
      throw new Error('Invalid USDT-BNB TRX wallet address');
    }
    
    // Pending withdrawals check
    if (user.pendingWithdrawals.length > 0) {
      throw new Error('You have pending withdrawals. Please wait for processing.');
    }
    
    return { user, isValid: true };
  }
  
  /**
   * Calculate withdrawal fee and net amount
   */
  calculateFee(amount) {
    const feePercent = constants.WITHDRAWAL_FEE;
    const feeAmount = (amount * feePercent) / 100;
    const netAmount = amount - feeAmount;
    const usdAmount = amount / constants.EXCHANGE_RATE.COINS_PER_USD;
    
    return {
      feePercent,
      feeAmount,
      netAmount,
      usdAmount
    };
  }
  
  /**
   * Deduct coins from user balance
   */
  async deductCoins(userId, amount) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    if (user.balance < amount) {
      throw new Error('Insufficient balance');
    }
    
    user.balance -= amount;
    await user.save();
    
    return user.balance;
  }
  
  /**
   * Create withdrawal record
   */
  async createWithdrawalRecord(userId, amount, walletAddress, feeDetails) {
    const withdrawal = new Withdrawal({
      userId,
      amount,
      usdAmount: feeDetails.usdAmount,
      fee: constants.WITHDRAWAL_FEE,
      feeAmount: feeDetails.feeAmount,
      netAmount: feeDetails.netAmount,
      walletAddress,
      cryptoType: constants.CRYPTO_TYPE
    });
    
    await withdrawal.save();
    
    // Update user's pending withdrawals
    await User.findByIdAndUpdate(userId, {
      $push: { pendingWithdrawals: withdrawal._id },
      $inc: { totalWithdrawn: feeDetails.netAmount }
    });
    
    return withdrawal;
  }
  
  /**
   * Process payment (mock for now, integrate real crypto API)
   */
  async processPayment(withdrawal) {
    try {
      // TODO: Integrate actual crypto payment API
      // Example: Binance API, TronGrid API, etc.
      
      // Mock successful payment
      const txHash = '0x' + Array.from({length: 64}, () => 
        Math.floor(Math.random() * 16).toString(16)).join('');
      
      // Update withdrawal status
      withdrawal.status = 'completed';
      withdrawal.transactionHash = txHash;
      withdrawal.completionDate = new Date();
      withdrawal.isProcessed = true;
      await withdrawal.save();
      
      // Create transaction record
      await Transaction.create({
        userId: withdrawal.userId,
        type: 'withdrawal',
        amount: -withdrawal.amount,
        balance: (await User.findById(withdrawal.userId)).balance,
        description: `Withdrawal completed: ${withdrawal.withdrawalId}`,
        metadata: {
          withdrawalId: withdrawal.withdrawalId,
          txHash
        },
        referenceId: withdrawal.withdrawalId
      });
      
      return {
        success: true,
        txHash,
        withdrawal: withdrawal.withdrawalId
      };
      
    } catch (error) {
      // Mark as failed
      withdrawal.status = 'failed';
      withdrawal.failureReason = error.message;
      await withdrawal.save();
      
      throw error;
    }
  }
  
  /**
   * Verify transaction on blockchain
   */
  async verifyTransaction(txHash) {
    try {
      // TODO: Implement actual blockchain verification
      // Mock verification
      return {
        verified: true,
        confirmations: 12,
        status: 'success'
      };
    } catch (error) {
      console.error('Transaction verification failed:', error);
      return {
        verified: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get monthly withdrawal statistics
   */
  async getMonthlyStats(month, year) {
    const stats = await Withdrawal.aggregate([
      {
        $match: {
          month,
          year,
          status: { $in: ['completed', 'processing'] }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalUsd: { $sum: '$usdAmount' },
          totalFee: { $sum: '$feeAmount' },
          totalNet: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    return stats[0] || {
      totalAmount: 0,
      totalUsd: 0,
      totalFee: 0,
      totalNet: 0,
      count: 0
    };
  }
}

module.exports = new WithdrawalService();