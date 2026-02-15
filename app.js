/**
 * MAIN APPLICATION
 * 1500 Coins Referral Bonus + Withdrawal System
 */

class App {
  constructor() {
    this.api = null;
    this.user = null;
    this.isAuthenticated = false;
    
    this.init();
  }
  
  async init() {
    this.setupAPI();
    await this.checkAuth();
    this.initModules();
    this.renderUI();
    this.attachGlobalEvents();
  }
  
  setupAPI() {
    // API client with authentication
    this.api = {
      baseURL: window.location.origin,
      
      async get(endpoint) {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api${endpoint}`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          }
        });
        return response.json();
      },
      
      async post(endpoint, data) {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api${endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        return response.json();
      }
    };
    
    window.api = this.api;
  }
  
  async checkAuth() {
    const token = localStorage.getItem('token');
    const telegramData = localStorage.getItem('telegram_user');
    
    if (token && telegramData) {
      try {
        const response = await this.api.get('/auth/me');
        if (response.success) {
          this.user = response.data.user;
          this.isAuthenticated = true;
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        this.logout();
      }
    }
  }
  
  initModules() {
    // Load modules based on authentication
    if (this.isAuthenticated) {
      this.loadScript('/js/withdraw.js');
      this.loadScript('/js/referrals.js');
    }
  }
  
  loadScript(src) {
    if (document.querySelector(`script[src="${src}"]`)) return;
    
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    document.body.appendChild(script);
  }
  
  renderUI() {
    this.updateNavigation();
    this.updateBalance();
    this.renderWelcomeMessage();
  }
  
  updateNavigation() {
    const navEl = document.getElementById('main-nav');
    if (!navEl) return;
    
    if (this.isAuthenticated && this.user) {
      navEl.innerHTML = `
        <div class="nav-left">
          <a href="/" class="logo">🎮 GameApp</a>
        </div>
        <div class="nav-center">
          <a href="#games" class="nav-link">Games</a>
          <a href="#referrals" class="nav-link">Referrals (1500 coins)</a>
          <a href="#withdraw" class="nav-link">Withdraw ($15, 15th)</a>
          <a href="#leaderboard" class="nav-link">Leaderboard</a>
        </div>
        <div class="nav-right">
          <div class="balance-display">
            <span class="balance-icon">💰</span>
            <span class="balance-amount">${(this.user.balance || 0).toLocaleString()}</span>
            <span class="balance-currency">coins</span>
          </div>
          <div class="user-menu">
            <img src="${this.user.photoUrl || 'default-avatar.png'}" class="avatar">
            <span class="username">@${this.user.username || 'user'}</span>
            <button onclick="app.logout()" class="logout-btn">Logout</button>
          </div>
        </div>
      `;
    } else {
      navEl.innerHTML = `
        <div class="nav-left">
          <a href="/" class="logo">🎮 GameApp</a>
        </div>
        <div class="nav-center">
          <a href="#features" class="nav-link">Features</a>
          <a href="#referrals" class="nav-link">1500 Coins Bonus</a>
          <a href="#withdraw" class="nav-link">Withdraw $15</a>
        </div>
        <div class="nav-right">
          <button onclick="app.login()" class="login-btn">Login with Telegram</button>
        </div>
      `;
    }
  }
  
  updateBalance() {
    if (this.user) {
      const balanceEls = document.querySelectorAll('.balance-amount');
      balanceEls.forEach(el => {
        el.textContent = (this.user.balance || 0).toLocaleString();
      });
    }
  }
  
  renderWelcomeMessage() {
    const welcomeEl = document.getElementById('welcome-message');
    if (!welcomeEl) return;
    
    if (this.isAuthenticated) {
      welcomeEl.innerHTML = `
        <div class="welcome-banner">
          <h1>Welcome back, ${this.user.firstName || 'Player'}! 🎮</h1>
          <div class="bonus-highlight">
            <span class="bonus-badge">🎁 1500 coins per referral</span>
            <span class="bonus-badge">💰 $15 minimum withdrawal</span>
            <span class="bonus-badge">📅 15th only</span>
          </div>
        </div>
      `;
    } else {
      welcomeEl.innerHTML = `
        <div class="hero-section">
          <h1>Earn 1500 Coins Per Referral! 🚀</h1>
          <p class="hero-subtitle">Invite friends, play games, and withdraw USDT on BNB TRX every 15th</p>
          <div class="hero-features">
            <div class="feature">🎁 1500 coins per friend</div>
            <div class="feature">💰 $15 minimum withdrawal</div>
            <div class="feature">📅 Withdraw on 15th only</div>
            <div class="feature">🔷 USDT on BNB TRX</div>
          </div>
          <button onclick="app.login()" class="hero-btn">Start Earning Now</button>
        </div>
      `;
    }
  }
  
  async login() {
    // Redirect to Telegram login
    const botUsername = 'YourGameBot'; // Replace with actual bot username
    const redirectUrl = encodeURIComponent(window.location.href);
    window.location.href = `https://t.me/${botUsername}?start=auth_${redirectUrl}`;
  }
  
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('telegram_user');
    this.isAuthenticated = false;
    this.user = null;
    window.location.reload();
  }
  
  attachGlobalEvents() {
    // Handle real-time balance updates
    window.addEventListener('balance:update', (e) => {
      if (this.user) {
        this.user.balance = e.detail.balance;
        this.updateBalance();
      }
    });
    
    // Handle notification system
    window.addEventListener('notification:show', (e) => {
      this.showNotification(e.detail.message, e.detail.type || 'info');
    });
  }
  
  showNotification(message, type = 'info') {
    const notificationEl = document.createElement('div');
    notificationEl.className = `notification notification-${type}`;
    notificationEl.textContent = message;
    
    document.body.appendChild(notificationEl);
    
    setTimeout(() => {
      notificationEl.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      notificationEl.classList.remove('show');
      setTimeout(() => {
        notificationEl.remove();
      }, 300);
    }, 5000);
  }
}

// Initialize app
window.app = new App();