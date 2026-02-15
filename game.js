let Telegram = null;
let WebApp = null;

try {
    Telegram = window.Telegram;
    WebApp = Telegram?.WebApp;
    if (WebApp) {
        WebApp.expand();
        WebApp.enableClosingConfirmation();
    }
} catch (e) {
    console.log('Not running in Telegram');
}

class TapGame {
    constructor() {
        this.sessionId = null;
        this.isGameActive = false;
        this.timeLeft = 60;
        this.taps = 0;
        this.coins = 0;
        this.maxTaps = 100;
        this.maxCoins = 20;
        this.coinPerTap = 0.2;
        this.timer = null;
        this.tapSound = null;
        this.initializeElements();
        this.loadSound();
        this.loadBalance();
        this.setupEventListeners();
    }

    initializeElements() {
        this.tapArea = document.getElementById('tapArea');
        this.startBtn = document.getElementById('startGameBtn');
        this.timerEl = document.getElementById('timer');
        this.tapCountEl = document.getElementById('tapCount');
        this.coinEarnedEl = document.getElementById('coinEarned');
        this.progressBar = document.getElementById('progressBar');
        this.progressText = document.getElementById('progressText');
        this.balanceEl = document.getElementById('balance');
        this.resultModal = document.getElementById('resultModal');
        this.resultTaps = document.getElementById('resultTaps');
        this.resultCoins = document.getElementById('resultCoins');
        this.resultTime = document.getElementById('resultTime');
        this.resultDate = document.getElementById('resultDate');
        
        this.tapArea.style.pointerEvents = 'none';
        this.startBtn.disabled = false;
    }

    loadSound() {
        try {
            this.tapSound = new Audio('sounds/tap-sound.mp3');
            this.tapSound.volume = 0.3;
        } catch (e) {
            console.log('Sound not available');
        }
    }

    async loadBalance() {
        try {
            const userData = await API.getUser();
            if (userData && this.balanceEl) {
                this.balanceEl.textContent = userData.balance.toFixed(2);
            }
        } catch (e) {
            console.error('Failed to load balance:', e);
        }
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startGame());
        this.tapArea.addEventListener('click', (e) => this.handleTap(e));
        
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.isGameActive) {
                e.preventDefault();
                this.handleTap(e);
            }
        });
    }

    async startGame() {
        if (this.isGameActive) return;

        try {
            const response = await API.startGame();
            this.sessionId = response.sessionId;
            
            this.isGameActive = true;
            this.timeLeft = 60;
            this.taps = 0;
            this.coins = 0;
            
            this.updateUI();
            this.startBtn.disabled = true;
            this.tapArea.style.pointerEvents = 'auto';
            
            this.startTimer();
            
            if (WebApp) {
                WebApp.HapticFeedback.impactOccurred('medium');
            }
        } catch (error) {
            console.error('Failed to start game:', error);
            alert(error.error || 'Failed to start game');
            
            if (error.cooldown) {
                this.startBtn.textContent = `Wait ${error.cooldown}s`;
                setTimeout(() => {
                    this.startBtn.textContent = 'Start Game';
                    this.startBtn.disabled = false;
                }, error.cooldown * 1000);
            }
        }
    }

    async handleTap(event) {
        if (!this.isGameActive) return;
        if (this.taps >= this.maxTaps) return;

        try {
            if (this.tapSound) {
                this.tapSound.currentTime = 0;
                this.tapSound.play().catch(() => {});
            }

            if (WebApp) {
                WebApp.HapticFeedback.impactOccurred('light');
            }

            const response = await API.registerTap(this.sessionId);
            
            this.taps = response.taps;
            this.coins = response.coinsEarned;
            
            this.updateUI();
            this.createTapEffect(event);
            
        } catch (error) {
            console.error('Tap error:', error);
            if (error.error === 'Game time expired') {
                this.endGame();
            }
        }
    }

    createTapEffect(event) {
        const tapEffect = document.createElement('div');
        tapEffect.className = 'tap-effect';
        tapEffect.textContent = '+0.2';
        
        const x = event.clientX || event.touches?.[0]?.clientX || window.innerWidth / 2;
        const y = event.clientY || event.touches?.[0]?.clientY || window.innerHeight / 2;
        
        tapEffect.style.left = x + 'px';
        tapEffect.style.top = y + 'px';
        
        document.body.appendChild(tapEffect);
        
        setTimeout(() => {
            tapEffect.remove();
        }, 1000);
    }

    updateUI() {
        this.tapCountEl.textContent = this.taps;
        this.coinEarnedEl.textContent = this.coins.toFixed(2);
        
        const progressPercent = (this.taps / this.maxTaps) * 100;
        this.progressBar.style.width = `${progressPercent}%`;
        this.progressText.textContent = `${this.taps}/${this.maxTaps} taps`;
        
        if (this.taps >= this.maxTaps) {
            this.tapArea.style.pointerEvents = 'none';
        }
    }

    startTimer() {
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateTimer();
            
            if (this.timeLeft <= 0 || this.taps >= this.maxTaps) {
                this.endGame();
            }
        }, 1000);
    }

    updateTimer() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        this.timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    async endGame() {
        if (!this.isGameActive) return;
        
        clearInterval(this.timer);
        this.isGameActive = false;
        this.tapArea.style.pointerEvents = 'none';
        
        try {
            const screenshot = await this.captureScreenshot();
            
            const response = await API.endGame(this.sessionId, screenshot);
            
            this.showResults(response);
            await this.loadBalance();
            
            if (WebApp) {
                WebApp.HapticFeedback.notificationOccurred('success');
            }
            
        } catch (error) {
            console.error('End game error:', error);
            alert('Failed to save game results');
        }
        
        this.startBtn.disabled = false;
        this.startBtn.textContent = 'Play Again';
    }

    async captureScreenshot() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = 'white';
            ctx.font = 'bold 32px Poppins';
            ctx.textAlign = 'center';
            ctx.fillText('CoinMaster Pro', canvas.width / 2, 100);
            
            ctx.font = '24px Poppins';
            ctx.fillText(`Score: ${this.taps} taps`, canvas.width / 2, 200);
            ctx.fillText(`Coins Earned: ${this.coins.toFixed(2)}`, canvas.width / 2, 250);
            
            const now = new Date();
            ctx.font = '18px Poppins';
            ctx.fillText(`Date: ${now.toLocaleDateString()}`, canvas.width / 2, 350);
            ctx.fillText(`Time: ${now.toLocaleTimeString()}`, canvas.width / 2, 400);
            
            return canvas.toDataURL('image/png');
        } catch (e) {
            console.error('Screenshot capture failed:', e);
            return null;
        }
    }

    showResults(data) {
        this.resultTaps.textContent = data.taps;
        this.resultCoins.textContent = data.coinsEarned.toFixed(2);
        this.resultTime.textContent = `${data.duration}s`;
        this.resultDate.textContent = new Date().toLocaleDateString();
        
        this.resultModal.style.display = 'flex';
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

    async startGame() {
        return this.request('/game/start', { method: 'POST' });
    },

    async registerTap(sessionId) {
        return this.request('/game/tap', {
            method: 'POST',
            body: JSON.stringify({ sessionId, taps: 1 })
        });
    },

    async endGame(sessionId, screenshot) {
        return this.request('/game/end', {
            method: 'POST',
            body: JSON.stringify({ sessionId, screenshot })
        });
    },

    async getUser() {
        return this.request('/user/profile');
    }
};

window.addEventListener('load', () => {
    window.game = new TapGame();
});