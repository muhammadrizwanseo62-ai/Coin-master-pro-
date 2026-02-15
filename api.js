// API Communication Module - COMPLETE VERSION
class API {
    constructor() {
        this.baseURL = process.env.NODE_ENV === 'production' 
            ? 'https://api.coinmasterpro.com/api'
            : 'http://localhost:3000/api';
        this.token = localStorage.getItem('token');
        this.refreshToken = localStorage.getItem('refreshToken');
        this.requestQueue = [];
        this.isRefreshing = false;
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    }

    setRefreshToken(token) {
        this.refreshToken = token;
        localStorage.setItem('refreshToken', token);
    }

    clearToken() {
        this.token = null;
        this.refreshToken = null;
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
    }

    async refreshToken() {
        try {
            const response = await fetch(`${this.baseURL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.refreshToken}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                this.setToken(data.token);
                return data.token;
            }
            
            throw new Error('Failed to refresh token');
        } catch (error) {
            this.clearToken();
            window.location.reload();
            throw error;
        }
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'include'
            });

            // Handle token expiration
            if (response.status === 401) {
                if (!this.isRefreshing) {
                    this.isRefreshing = true;
                    try {
                        const newToken = await this.refreshToken();
                        this.isRefreshing = false;
                        
                        // Retry original request with new token
                        headers['Authorization'] = `Bearer ${newToken}`;
                        const retryResponse = await fetch(url, {
                            ...options,
                            headers
                        });
                        
                        const retryData = await retryResponse.json();
                        return retryData;
                    } catch (refreshError) {
                        this.isRefreshing = false;
                        throw new Error('Authentication failed');
                    }
                } else {
                    // Wait for refresh to complete
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return this.request(endpoint, options);
                }
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'API request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // GET request
    async get(endpoint) {
        return this.request(endpoint, {
            method: 'GET'
        });
    }

    // POST request
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT request
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE request
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }

    // ============ AUTH ENDPOINTS ============
    async telegramLogin(initData) {
        const response = await this.post('/auth/telegram', { initData });
        
        if (response.token) {
            this.setToken(response.token);
            if (response.refreshToken) {
                this.setRefreshToken(response.refreshToken);
            }
        }
        
        return response;
    }

    async verifyToken() {
        return this.get('/auth/verify');
    }

    async logout() {
        const response = await this.post('/auth/logout', {});
        this.clearToken();
        return response;
    }

    // ============ USER ENDPOINTS ============
    async getUser() {
        return this.get('/user/profile');
    }

    async updateUser(data) {
        return this.put('/user/update', data);
    }

    async getBalance() {
        return this.get('/user/balance');
    }

    async addCoins(amount) {
        return this.post('/user/add-coins', { amount });
    }

    // ============ REFERRAL ENDPOINTS ============
    async getReferralInfo() {
        return this.get('/user/referral-info');
    }

    async getReferrals() {
        return this.get('/user/referrals');
    }

    async getReferralStats() {
        return this.get('/user/referral-stats');
    }

    // ============ DAILY REWARD ENDPOINTS ============
    async claimDailyReward() {
        return this.post('/user/claim-daily', {});
    }

    async getDailyRewardStatus() {
        return this.get('/user/daily-status');
    }

    async getDailyRewardHistory() {
        return this.get('/user/daily-history');
    }

    // ============ GAME ENDPOINTS ============
    async recordCoinClick() {
        return this.post('/user/click', {});
    }

    async getClickStats() {
        return this.get('/user/click-stats');
    }

    // ============ STATS ENDPOINTS ============
    async getUserStats() {
        return this.get('/user/stats');
    }

    async getLeaderboard(limit = 100) {
        return this.get(`/user/leaderboard?limit=${limit}`);
    }

    async getGlobalStats() {
        return this.get('/user/global-stats');
    }

    // ============ ACHIEVEMENT ENDPOINTS ============
    async getAchievements() {
        return this.get('/user/achievements');
    }

    async claimAchievement(achievementId) {
        return this.post('/user/claim-achievement', { achievementId });
    }

    // ============ SHOP ENDPOINTS ============
    async getShopItems() {
        return this.get('/user/shop-items');
    }

    async purchaseItem(itemId) {
        return this.post('/user/purchase', { itemId });
    }

    // ============ NOTIFICATION ENDPOINTS ============
    async getNotifications() {
        return this.get('/user/notifications');
    }

    async markNotificationRead(notificationId) {
        return this.post('/user/notifications/read', { notificationId });
    }

    // ============ ADMIN ENDPOINTS ============
    async getAdminStats() {
        return this.get('/admin/stats');
    }

    async getAdminUsers(page = 1, limit = 50) {
        return this.get(`/admin/users?page=${page}&limit=${limit}`);
    }

    async updateUserBalance(userId, amount) {
        return this.post('/admin/update-balance', { userId, amount });
    }
}

// Create global instance
window.api = new API();