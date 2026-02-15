// Telegram Authentication Module - COMPLETE VERSION
class TelegramAuth {
    constructor() {
        this.telegram = window.Telegram?.WebApp;
        this.initData = null;
        this.initDataUnsafe = null;
        this.theme = null;
        this.viewport = null;
        this.mainButton = null;
        this.backButton = null;
        this.hapticFeedback = null;
        this.popup = null;
        this.scanQrPopup = null;
        this.settingsButton = null;
    }

    init() {
        if (!this.telegram) {
            console.error('Telegram WebApp is not available');
            return false;
        }

        this.telegram.ready();
        this.telegram.expand();
        
        this.initData = this.telegram.initData;
        this.initDataUnsafe = this.telegram.initDataUnsafe;
        this.theme = this.telegram.themeParams;
        this.viewport = this.telegram.viewport;
        this.mainButton = this.telegram.MainButton;
        this.backButton = this.telegram.BackButton;
        this.hapticFeedback = this.telegram.HapticFeedback;
        this.popup = this.telegram.showPopup;
        this.settingsButton = this.telegram.SettingsButton;
        
        // Setup default behavior
        this.setupMainButton();
        this.setupBackButton();
        this.setupSettingsButton();
        
        return true;
    }

    setupMainButton() {
        if (this.mainButton) {
            this.mainButton.setText('PLAY NOW');
            this.mainButton.setParams({
                color: this.theme?.button_color || '#FFD700',
                text_color: this.theme?.button_text_color || '#000000'
            });
        }
    }

    setupBackButton() {
        if (this.backButton) {
            this.backButton.onClick(() => {
                window.history.back();
            });
        }
    }

    setupSettingsButton() {
        if (this.settingsButton) {
            this.settingsButton.onClick(() => {
                this.showAlert('Settings will be available soon!');
            });
        }
    }

    getAuthData() {
        return {
            initData: this.initData,
            user: this.initDataUnsafe?.user,
            startParam: this.initDataUnsafe?.start_param,
            chatInstance: this.initDataUnsafe?.chat_instance,
            chatType: this.initDataUnsafe?.chat_type,
            authDate: this.initDataUnsafe?.auth_date,
            hash: this.initDataUnsafe?.hash,
            signature: this.initDataUnsafe?.signature
        };
    }

    getUser() {
        const user = this.initDataUnsafe?.user;
        if (user) {
            return {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                username: user.username,
                languageCode: user.language_code,
                photoUrl: user.photo_url,
                isPremium: user.is_premium,
                allowsWriteToPm: user.allows_write_to_pm
            };
        }
        return null;
    }

    getReferralCode() {
        return this.initDataUnsafe?.start_param || null;
    }

    getTheme() {
        return {
            bgColor: this.theme?.bg_color || '#1a1a2e',
            textColor: this.theme?.text_color || '#ffffff',
            hintColor: this.theme?.hint_color || '#a8a8a8',
            linkColor: this.theme?.link_color || '#FFD700',
            buttonColor: this.theme?.button_color || '#FFD700',
            buttonTextColor: this.theme?.button_text_color || '#000000',
            secondaryBgColor: this.theme?.secondary_bg_color || '#16213e'
        };
    }

    getViewport() {
        return {
            height: this.viewport?.height,
            width: this.viewport?.width,
            isExpanded: this.viewport?.isExpanded,
            stableHeight: this.viewport?.stableHeight
        };
    }

    close() {
        this.telegram?.close();
    }

    expand() {
        this.telegram?.expand();
    }

    disableVerticalSwipes() {
        this.telegram?.disableVerticalSwipes();
    }

    enableVerticalSwipes() {
        this.telegram?.enableVerticalSwipes();
    }

    showAlert(message) {
        this.telegram?.showAlert(message);
    }

    showConfirm(message) {
        return this.telegram?.showConfirm(message);
    }

    showPopup(params) {
        return this.telegram?.showPopup(params);
    }

    showScanQrPopup(params) {
        return this.telegram?.showScanQrPopup(params);
    }

    closeScanQrPopup() {
        this.telegram?.closeScanQrPopup();
    }

    shareMessage(message) {
        const botUsername = process.env.BOT_USERNAME || 'CoinMasterProBot';
        const shareUrl = `https://t.me/${botUsername}?start=${message}`;
        
        if (this.telegram?.openTelegramLink) {
            this.telegram.openTelegramLink(shareUrl);
        } else {
            window.open(shareUrl, '_blank');
        }
    }

    shareReferral(referralCode) {
        const botUsername = process.env.BOT_USERNAME || 'CoinMasterProBot';
        const shareText = '🎮 Join me on CoinMaster Pro and get 500 FREE coins! 🪙\n\nTap the coin, earn rewards, and invite friends for 1500 bonus coins!';
        const shareUrl = `https://t.me/share/url?url=https://t.me/${botUsername}?start=${referralCode}&text=${encodeURIComponent(shareText)}`;
        
        if (this.telegram?.openTelegramLink) {
            this.telegram.openTelegramLink(shareUrl);
        } else {
            window.open(shareUrl, '_blank');
        }
    }

    hapticFeedback(type = 'impact', style = 'medium') {
        if (this.hapticFeedback) {
            switch(type) {
                case 'impact':
                    this.hapticFeedback.impactOccurred(style);
                    break;
                case 'notification':
                    this.hapticFeedback.notificationOccurred('success');
                    break;
                case 'selection':
                    this.hapticFeedback.selectionChanged();
                    break;
            }
        }
    }

    setHeaderColor(color) {
        this.telegram?.setHeaderColor(color);
    }

    setBackgroundColor(color) {
        this.telegram?.setBackgroundColor(color);
    }

    setBottomBarColor(color) {
        this.telegram?.setBottomBarColor(color);
    }

    isPlatform(type) {
        return this.telegram?.platform === type;
    }

    getPlatform() {
        return this.telegram?.platform || 'unknown';
    }

    isVersionAtLeast(version) {
        return this.telegram?.isVersionAtLeast(version);
    }

    onEvent(event, callback) {
        this.telegram?.onEvent(event, callback);
    }

    offEvent(event, callback) {
        this.telegram?.offEvent(event, callback);
    }

    sendData(data) {
        this.telegram?.sendData(JSON.stringify(data));
    }

    switchInlineQuery(query, chooseChatTypes) {
        this.telegram?.switchInlineQuery(query, chooseChatTypes);
    }

    openLink(url, options) {
        this.telegram?.openLink(url, options);
    }

    openTelegramLink(url) {
        this.telegram?.openTelegramLink(url);
    }

    openInvoice(url) {
        return this.telegram?.openInvoice(url);
    }

    ready() {
        this.telegram?.ready();
    }

    showMainButton(text, color, callback) {
        if (this.mainButton) {
            this.mainButton.setText(text);
            this.mainButton.setParams({ color });
            this.mainButton.onClick(callback);
            this.mainButton.show();
        }
    }

    hideMainButton() {
        this.mainButton?.hide();
    }

    showBackButton() {
        this.backButton?.show();
    }

    hideBackButton() {
        this.backButton?.hide();
    }

    showSettingsButton() {
        this.settingsButton?.show();
    }

    hideSettingsButton() {
        this.settingsButton?.hide();
    }

    getReadableTextSize(text) {
        return this.telegram?.getReadableTextSize(text);
    }

    requestWriteAccess() {
        return this.telegram?.requestWriteAccess();
    }

    requestContact() {
        return this.telegram?.requestContact();
    }
}

// Create global instance
window.telegramAuth = new TelegramAuth();