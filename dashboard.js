class Dashboard {
    constructor() {
        this.chart = null;
        this.initialize();
    }

    async initialize() {
        await this.loadStats();
        await this.loadChartData();
        await this.loadLeaderboard();
        this.setupEventListeners();
    }

    async loadStats() {
        try {
            const response = await API.getDashboardStats();
            const stats = response.stats;
            
            document.getElementById('balance').textContent = stats.balance.toFixed(2);
            document.getElementById('gamesToday').textContent = stats.today.gamesPlayed;
            document.getElementById('earnedToday').textContent = stats.today.coinsEarned.toFixed(2);
            document.getElementById('adsToday').textContent = `${stats.today.adsWatched}/10`;
            document.getElementById('loginStreak').textContent = stats.today.loginStreak;
            
            const bonusAmount = this.calculateBonusAmount(stats.today.loginStreak);
            document.getElementById('bonusValue').textContent = stats.today.loginBonus ? 'Claimed' : bonusAmount;
            
            if (stats.today.loginBonus) {
                document.getElementById('dailyBonusBtn').disabled = true;
                document.getElementById('dailyBonusBtn').style.opacity = '0.5';
            }
            
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    async loadChartData() {
        try {
            const response = await API.getChartData('week');
            const ctx = document.getElementById('earningsChart').getContext('2d');
            
            const labels = response.data.map(d => d._id);
            const earnings = response.data.map(d => d.total);

            if (this.chart) {
                this.chart.destroy();
            }

            this.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Earnings',
                        data: earnings,
                        borderColor: '#00d4ff',
                        backgroundColor: 'rgba(0, 212, 255, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255,255,255,0.1)'
                            },
                            ticks: {
                                color: '#fff'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: '#fff'
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Failed to load chart data:', error);
        }
    }

    async loadLeaderboard() {
        try {
            const response = await API.getLeaderboard('weekly', 5);
            const leaderboardList = document.getElementById('leaderboardList');
            
            if (!leaderboardList) return;
            
            leaderboardList.innerHTML = '';
            
            response.leaderboard.forEach((player, index) => {
                const item = document.createElement('div');
                item.className = 'leaderboard-item';
                
                let medal = '';
                if (index === 0) medal = '🥇';
                else if (index === 1) medal = '🥈';
                else if (index === 2) medal = '🥉';
                else medal = `${index + 1}.`;
                
                item.innerHTML = `
                    <span class="rank">${medal}</span>
                    <span class="name">${player.firstName || player.username || 'Anonymous'}</span>
                    <span class="score">${player.totalEarned.toFixed(2)}</span>
                `;
                
                leaderboardList.appendChild(item);
            });
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
        }
    }

    calculateBonusAmount(streak) {
        const amounts = [50, 60, 70, 80, 90, 100, 100];
        return amounts[Math.min(streak, 6)];
    }

    setupEventListeners() {
        document.getElementById('dailyBonusBtn')?.addEventListener('click', () => this.claimDailyBonus());
        document.getElementById('watchAdBtn')?.addEventListener('click', () => this.watchAd());
        document.getElementById('referralBtn')?.addEventListener('click', () => this.showReferralModal());
    }

    async claimDailyBonus() {
        try {
            const response = await API.claimDailyBonus();
            
            alert(`Daily bonus claimed! +${response.bonusAmount} coins`);
            
            await this.loadStats();
            await this.loadBalance();
            
        } catch (error) {
            console.error('Claim daily bonus error:', error);
            alert(error.error || 'Failed to claim daily bonus');
        }
    }

    async watchAd() {
        try {
            const status = await API.getAdStatus();
            
            if (!status.status.canWatch) {
                if (status.status.remainingAds <= 0) {
                    alert('You have reached maximum ads for today!');
                } else {
                    alert(`Please wait ${status.status.cooldown} seconds before watching another ad`);
                }
                return;
            }
            
            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.showPopup({
                    title: 'Watch Ad',
                    message: 'Watch a 30-second ad to earn 25 coins?',
                    buttons: [
                        { id: 'watch', type: 'default', text: 'Watch' },
                        { id: 'cancel', type: 'destructive', text: 'Cancel' }
                    ]
                }, async (buttonId) => {
                    if (buttonId === 'watch') {
                        await this.processAdWatch();
                    }
                });
            } else {
                if (confirm('Watch a 30-second ad to earn 25 coins?')) {
                    await this.processAdWatch();
                }
            }
        } catch (error) {
            console.error('Watch ad error:', error);
        }
    }

    async processAdWatch() {
        try {
            const response = await API.watchAd();
            
            alert(`Ad watched! +${response.reward} coins earned`);
            
            await this.loadStats();
            await this.loadBalance();
            
            document.getElementById('adsToday').textContent = `${10 - response.remainingAds}/10`;
            
        } catch (error) {
            console.error('Process ad watch error:', error);
            alert(error.error || 'Failed to process ad');
        }
    }

    async showReferralModal() {
        try {
            const response = await API.getReferralStats();
            
            const message = `Your Referral Code: ${response.referralCode}\n\n` +
                          `Total Referrals: ${response.totalReferrals}\n` +
                          `Total Earned: ${response.totalEarned.toFixed(2)} coins\n\n` +
                          `Share your code with friends!\n` +
                          `You both get 500 coins when they join!`;
            
            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.showPopup({
                    title: 'Referral Program',
                    message: message,
                    buttons: [
                        { id: 'share', type: 'default', text: 'Share Code' },
                        { id: 'close', type: 'destructive', text: 'Close' }
                    ]
                }, async (buttonId) => {
                    if (buttonId === 'share') {
                        await this.shareReferralCode(response.referralCode);
                    }
                });
            } else {
                alert(message);
            }
        } catch (error) {
            console.error('Show referral error:', error);
        }
    }

    async shareReferralCode(code) {
        try {
            const shareText = `Join me on CoinMaster Pro and get 500 free coins! Use my referral code: ${code}`;
            
            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.sendData(JSON.stringify({
                    action: 'share',
                    text: shareText
                }));
            } else {
                prompt('Copy your referral code:', code);
            }
        } catch (error) {
            console.error('Share referral error:', error);
        }
    }

    async loadBalance() {
        try {
            const userData = await API.getUser();
            const balanceEl = document.getElementById('balance');
            if (balanceEl) {
                balanceEl.textContent = userData.balance.toFixed(2);
            }
        } catch (error) {
            console.error('Failed to load balance:', error);
        }
    }
}

const API = {
    baseUrl: 'https://your-backend-url.com/api',
    
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('authToken');
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers
        };

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                throw data;
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    },

    async getDashboardStats() {
        return this.request('/dashboard/stats');
    },

    async getChartData(period) {
        return this.request(`/dashboard/chart?period=${period}`);
    },

    async getLeaderboard(timeframe, limit) {
        return this.request(`/dashboard/leaderboard?timeframe=${timeframe}&limit=${limit}`);
    },

    async claimDailyBonus() {
        return this.request('/dashboard/daily-bonus', { method: 'POST' });
    },

    async getAdStatus() {
        return this.request('/ads/status');
    },

    async watchAd() {
        return this.request('/ads/watch', { method: 'POST' });
    },

    async getReferralStats() {
        return this.request('/dashboard/referral-stats');
    },

    async getUser() {
        return this.request('/user/profile');
    }
};

window.addEventListener('load', () => {
    window.dashboard = new Dashboard();
});