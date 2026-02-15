/**
 * WITHDRAWAL DASHBOARD
 * 15th only, $15 minimum, USDT-BNB TRX
 */

class WithdrawalManager {
  constructor() {
    this.api = window.api;
    this.user = null;
    this.eligibility = null;
    this.countdownInterval = null;
    this.nextWithdrawalDate = null;
    
    this.init();
  }
  
  async init() {
    await this.loadUser();
    await this.loadEligibility();
    this.renderWithdrawalSection();
    this.startCountdown();
    this.attachEventListeners();
  }
  
  async loadUser() {
    try {
      const response = await this.api.get('/auth/me');
      this.user = response.data.user;
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  }
  
  async loadEligibility() {
    try {
      const response = await this.api.get('/withdraw/eligibility');
      this.eligibility = response.data.data;
      this.nextWithdrawalDate = new Date(this.eligibility.nextWithdrawalDate);
    } catch (error) {
      console.error('Failed to load eligibility:', error);
    }
  }
  
  renderWithdrawalSection() {
    const container = document.getElementById('withdrawal-section');
    if (!container) return;
    
    const isWithdrawalDay = this.eligibility?.requirements?.isWithdrawalDay?.met || false;
    const isEligible = this.eligibility?.isEligible || false;
    const canWithdraw = isWithdrawalDay && isEligible;
    
    container.innerHTML = `
      <div class="withdrawal-card">
        <div class="withdrawal-header">
          <h2>💰 Withdraw USDT-BNB TRX</h2>
          <div class="withdrawal-badge ${isWithdrawalDay ? 'active' : ''}">
            ${isWithdrawalDay ? '✅ Withdrawal Day!' : '📅 15th Only'}
          </div>
        </div>
        
        <!-- COUNTDOWN TIMER -->
        <div class="countdown-timer">
          <div class="timer-label">Next Withdrawal</div>
          <div class="timer-display" id="countdown">Loading...</div>
        </div>
        
        <!-- ELIGIBILITY CHECKLIST -->
        <div class="eligibility-checklist">
          <h3>✅ Withdrawal Requirements</h3>
          ${this.renderEligibilityChecklist()}
        </div>
        
        <!-- WITHDRAWAL FORM (ONLY ACTIVE ON 15TH) -->
        <div class="withdrawal-form-container ${!canWithdraw ? 'disabled' : ''}">
          <h3>${canWithdraw ? '🔓 Request Withdrawal' : '🔒 Withdrawals Locked'}</h3>
          
          <div class="form-group">
            <label>Amount (Coins)</label>
            <input 
              type="number" 
              id="withdrawal-amount" 
              class="form-control"
              min="${this.eligibility?.minWithdrawal || 75000}"
              max="${this.eligibility?.maxWithdrawal || 2500000}"
              ${!canWithdraw ? 'disabled' : ''}
            >
            <small>Min: ${(this.eligibility?.minWithdrawal || 75000).toLocaleString()} coins ($${this.eligibility?.minWithdrawal / 5000 || 15} USD)</small>
          </div>
          
          <div class="form-group">
            <label>USDT-BNB TRX Wallet Address</label>
            <input 
              type="text" 
              id="wallet-address" 
              class="form-control"
              placeholder="0x... (BNB) or T... (TRX)"
              ${!canWithdraw ? 'disabled' : ''}
            >
            <small>Only USDT on BNB Chain or TRON network</small>
          </div>
          
          <div class="fee-calculation">
            <div class="fee-row">
              <span>Amount:</span>
              <span id="amount-display">0 coins</span>
            </div>
            <div class="fee-row">
              <span>Fee (15%):</span>
              <span id="fee-display">0 coins</span>
            </div>
            <div class="fee-row total">
              <span>You Receive:</span>
              <span id="net-display">0 coins</span>
            </div>
            <div class="fee-row usd">
              <span>USD Value:</span>
              <span id="usd-display">$0.00</span>
            </div>
          </div>
          
          <button 
            id="withdraw-button" 
            class="withdraw-btn ${!canWithdraw ? 'disabled' : ''}"
            ${!canWithdraw ? 'disabled' : ''}
          >
            ${canWithdraw ? '💸 Request Withdrawal' : '🔒 Withdrawals Unavailable'}
          </button>
          
          ${!canWithdraw && !isWithdrawalDay ? 
            '<p class="warning-message">⏰ Withdrawals are only available on the 15th of each month</p>' : ''}
          ${!canWithdraw && isWithdrawalDay && !isEligible ? 
            '<p class="warning-message">⚠️ Complete all requirements to withdraw</p>' : ''}
        </div>
        
        <!-- WITHDRAWAL HISTORY -->
        ${this.renderWithdrawalHistory()}
      </div>
    `;
    
    // Add event listeners to form inputs
    if (canWithdraw) {
      document.getElementById('withdrawal-amount').addEventListener('input', (e) => this.calculateFee(e.target.value));
    }
  }
  
  renderEligibilityChecklist() {
    if (!this.eligibility) return '<p>Loading eligibility...</p>';
    
    const req = this.eligibility.requirements;
    
    return `
      <div class="checklist-item ${req.accountAge.met ? 'completed' : 'pending'}">
        <span class="check-icon">${req.accountAge.met ? '✅' : '⏳'}</span>
        <span class="check-text">Account Age: ${req.accountAge.current}/${req.accountAge.required} days</span>
      </div>
      <div class="checklist-item ${req.gamesPlayed.met ? 'completed' : 'pending'}">
        <span class="check-icon">${req.gamesPlayed.met ? '✅' : '⏳'}</span>
        <span class="check-text">Games Played: ${req.gamesPlayed.current}/${req.gamesPlayed.required}</span>
      </div>
      <div class="checklist-item ${req.referrals.met ? 'completed' : 'pending'}">
        <span class="check-icon">${req.referrals.met ? '✅' : '⏳'}</span>
        <span class="check-text">Active Referrals: ${req.referrals.current}/${req.referrals.required}</span>
      </div>
      <div class="checklist-item ${req.loginStreak.met ? 'completed' : 'pending'}">
        <span class="check-icon">${req.loginStreak.met ? '✅' : '⏳'}</span>
        <span class="check-text">Login Streak: ${req.loginStreak.current}/${req.loginStreak.required} days</span>
      </div>
      <div class="checklist-item ${req.noPendingWithdrawals.met ? 'completed' : 'pending'}">
        <span class="check-icon">${req.noPendingWithdrawals.met ? '✅' : '⏳'}</span>
        <span class="check-text">No Pending Withdrawals</span>
      </div>
      <div class="checklist-item ${req.minimumBalance.met ? 'completed' : 'pending'}">
        <span class="check-icon">${req.minimumBalance.met ? '✅' : '⏳'}</span>
        <span class="check-text">Minimum Balance: ${(req.minimumBalance.current || 0).toLocaleString()}/${req.minimumBalance.required.toLocaleString()} coins</span>
      </div>
    `;
  }
  
  async renderWithdrawalHistory() {
    try {
      const response = await this.api.get('/withdraw/history?limit=5');
      const withdrawals = response.data.data.withdrawals;
      
      let historyHtml = '<div class="withdrawal-history"><h3>📋 Withdrawal History</h3>';
      
      if (withdrawals.length === 0) {
        historyHtml += '<p class="no-history">No withdrawals yet</p>';
      } else {
        historyHtml += '<div class="history-table">';
        historyHtml += `
          <div class="history-header">
            <span>ID</span>
            <span>Amount</span>
            <span>Net</span>
            <span>Status</span>
            <span>Date</span>
          </div>
        `;
        
        withdrawals.forEach(w => {
          const statusClass = w.status.toLowerCase();
          const statusIcon = w.status === 'completed' ? '✅' : 
                           w.status === 'processing' ? '⚙️' : 
                           w.status === 'pending' ? '⏳' : '❌';
          
          historyHtml += `
            <div class="history-row">
              <span class="withdrawal-id">${w.withdrawalId.substring(0, 8)}...</span>
              <span>${w.usdAmount.toFixed(2)} USD</span>
              <span>${(w.netAmount / 5000).toFixed(2)} USD</span>
              <span class="status-badge ${statusClass}">${statusIcon} ${w.status}</span>
              <span>${new Date(w.requestDate).toLocaleDateString()}</span>
            </div>
          `;
        });
        
        historyHtml += '</div>';
      }
      
      historyHtml += '</div>';
      
      // Append to container
      const container = document.querySelector('.withdrawal-card');
      if (container && !container.querySelector('.withdrawal-history')) {
        container.insertAdjacentHTML('beforeend', historyHtml);
      }
      
    } catch (error) {
      console.error('Failed to load withdrawal history:', error);
    }
  }
  
  calculateFee(amount) {
    const coins = parseInt(amount) || 0;
    const fee = coins * 0.15;
    const net = coins - fee;
    const usd = (coins / 5000).toFixed(2);
    
    document.getElementById('amount-display').textContent = `${coins.toLocaleString()} coins`;
    document.getElementById('fee-display').textContent = `${Math.floor(fee).toLocaleString()} coins`;
    document.getElementById('net-display').textContent = `${Math.floor(net).toLocaleString()} coins`;
    document.getElementById('usd-display').textContent = `$${usd}`;
  }
  
  startCountdown() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    
    const updateCountdown = () => {
      const timerEl = document.getElementById('countdown');
      if (!timerEl) return;
      
      if (!this.nextWithdrawalDate) {
        timerEl.textContent = 'Loading...';
        return;
      }
      
      const now = new Date();
      const diff = this.nextWithdrawalDate - now;
      
      if (diff <= 0) {
        timerEl.textContent = '✅ Withdrawal Day is TODAY!';
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      timerEl.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    };
    
    updateCountdown();
    this.countdownInterval = setInterval(updateCountdown, 1000);
  }
  
  attachEventListeners() {
    // Delegate event for withdraw button
    document.addEventListener('click', async (e) => {
      if (e.target.id === 'withdraw-button' && !e.target.disabled) {
        await this.handleWithdrawal();
      }
    });
  }
  
  async handleWithdrawal() {
    const amountInput = document.getElementById('withdrawal-amount');
    const walletInput = document.getElementById('wallet-address');
    
    const amount = parseInt(amountInput.value);
    const walletAddress = walletInput.value.trim();
    
    if (!amount || amount < 75000) {
      alert(`❌ Minimum withdrawal: 75,000 coins ($15 USD)`);
      return;
    }
    
    if (amount > 2500000) {
      alert(`❌ Maximum withdrawal: 2,500,000 coins ($500 USD) per month`);
      return;
    }
    
    if (!walletAddress) {
      alert(`❌ Please enter your USDT-BNB TRX wallet address`);
      return;
    }
    
    // Simple wallet validation
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/) && !walletAddress.match(/^T[a-zA-Z0-9]{33}$/)) {
      alert(`❌ Invalid wallet address. Must start with 0x (BNB) or T (TRON)`);
      return;
    }
    
    try {
      const response = await this.api.post('/withdraw/request', {
        amount,
        walletAddress
      });
      
      if (response.data.success) {
        alert(`✅ Withdrawal request submitted successfully!\n\nID: ${response.data.data.withdrawalId}\nAmount: $${response.data.data.usdAmount} USD\nProcessing: Next 15th`);
        
        // Reload page to show updated data
        location.reload();
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Withdrawal request failed';
      alert(`❌ ${message}`);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.withdrawalManager = new WithdrawalManager();
});