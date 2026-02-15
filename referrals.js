/**
 * REFERRAL SYSTEM - AUTOMATIC 1500 COINS BONUS
 * Real-time balance updates, instant notifications
 */

class ReferralManager {
  constructor() {
    this.api = window.api;
    this.user = null;
    this.referralStats = null;
    
    this.init();
  }
  
  async init() {
    await this.loadUser();
    await this.loadReferralStats();
    this.renderReferralSection();
    this.attachEventListeners();
    this.startRealTimeUpdates();
  }
  
  async loadUser() {
    try {
      const response = await this.api.get('/auth/me');
      this.user = response.data.user;
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  }
  
  async loadReferralStats() {
    try {
      const response = await this.api.get('/referral/stats');
      this.referralStats = response.data.data;
    } catch (error) {
      console.error('Failed to load referral stats:', error);
    }
  }
  
  renderReferralSection() {
    const container = document.getElementById('referral-section');
    if (!container) return;
    
    const totalEarned = this.referralStats?.totalEarned || 0;
    const totalReferrals = this.referralStats?.totalReferrals || 0;
    const bonusPerReferral = this.referralStats?.bonusAmount || 1500;
    const referralCode = this.referralStats?.referralCode || this.user?.referralCode || 'LOADING';
    const referralLink = `https://t.me/YourBot?start=${referralCode}`;
    
    container.innerHTML = `
      <div class="referral-card">
        <div class="referral-header">
          <div class="referral-icon">🎁</div>
          <div class="referral-title">
            <h2>Refer & Earn 1500 Coins</h2>
            <p class="subtitle">Instant bonus for every friend you invite</p>
          </div>
        </div>
        
        <div class="referral-stats-grid">
          <div class="stat-item">
            <span class="stat-label">Total Earnings</span>
            <span class="stat-value highlight">${totalEarned.toLocaleString()} coins</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Friends Referred</span>
            <span class="stat-value">${totalReferrals}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Bonus Per Friend</span>
            <span class="stat-value">${bonusPerReferral} coins</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Pending Commission</span>
            <span class="stat-value">${this.referralStats?.recentReferrals * bonusPerReferral || 0} coins</span>
          </div>
        </div>
        
        <div class="referral-link-container">
          <h3>🔗 Your Referral Link</h3>
          <div class="link-box">
            <input type="text" id="referral-link" value="${referralLink}" readonly>
            <button id="copy-link-btn" class="copy-btn">📋 Copy</button>
          </div>
          <p class="link-hint">Share this link with friends - they get 500 coins, you get 1500 coins!</p>
        </div>
        
        <div class="referral-progress">
          <h3>🎯 Withdrawal Progress (5 referrals needed)</h3>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${Math.min(100, (totalReferrals / 5) * 100)}%"></div>
          </div>
          <p class="progress-text">${totalReferrals}/5 referrals - ${totalReferrals >= 5 ? '✅ Eligible to withdraw' : '⏳ ' + (5 - totalReferrals) + ' more needed'}</p>
        </div>
        
        <div class="referral-leaderboard">
          <h3>🏆 Top Referrers</h3>
          <div id="leaderboard-list">Loading...</div>
        </div>
        
        <div class="referral-info-box">
          <h4>📋 How it works:</h4>
          <ul>
            <li>✅ <strong>You earn 1500 coins</strong> instantly when a friend signs up with your link</li>
            <li>✅ Your friend earns 500 coins welcome bonus</li>
            <li>✅ No limits - refer unlimited friends</li>
            <li>✅ Need 5 active referrals to unlock withdrawals</li>
            <li>✅ Coins are credited instantly - no waiting!</li>
          </ul>
        </div>
      </div>
    `;
    
    this.loadLeaderboard();
  }
  
  async loadLeaderboard() {
    try {
      const response = await this.api.get('/referral/leaderboard');
      const leaderboard = response.data.data;
      
      const leaderboardEl = document.getElementById('leaderboard-list');
      if (!leaderboardEl) return;
      
      if (leaderboard.length === 0) {
        leaderboardEl.innerHTML = '<p class="no-data">Be the first to refer friends! 🚀</p>';
        return;
      }
      
      let html = '<div class="leaderboard-table">';
      
      leaderboard.forEach((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        
        html += `
          <div class="leaderboard-row">
            <span class="rank">${medal}</span>
            <span class="user">${user.username || 'Anonymous'}</span>
            <span class="earnings">${user.earnings.toLocaleString()} coins</span>
            <span class="count">${user.referralCount} refs</span>
          </div>
        `;
      });
      
      html += '</div>';
      leaderboardEl.innerHTML = html;
      
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      const leaderboardEl = document.getElementById('leaderboard-list');
      if (leaderboardEl) {
        leaderboardEl.innerHTML = '<p class="error">Failed to load leaderboard</p>';
      }
    }
  }
  
  attachEventListeners() {
    // Copy referral link
    document.addEventListener('click', (e) => {
      if (e.target.id === 'copy-link-btn' || e.target.classList.contains('copy-btn')) {
        const linkInput = document.getElementById('referral-link');
        if (linkInput) {
          linkInput.select();
          document.execCommand('copy');
          
          // Show temporary tooltip
          const btn = e.target;
          const originalText = btn.textContent;
          btn.textContent = '✅ Copied!';
          setTimeout(() => {
            btn.textContent = originalText;
          }, 2000);
        }
      }
    });
  }
  
  startRealTimeUpdates() {
    // Update referral stats every 30 seconds
    setInterval(async () => {
      await this.loadReferralStats();
      this.renderReferralSection();
    }, 30000);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.referralManager = new ReferralManager();
});