/**
 * USDT-BNB TRX Wallet Address Validator
 * Supports: BSC (0x...) and TRON (T...)
 */

/**
 * Validate BNB Smart Chain address (0x format)
 */
function validateBNBAddress(address) {
  if (!address || typeof address !== 'string') return false;
  
  // BNB address format: 0x followed by 40 hex characters
  const bnbRegex = /^0x[a-fA-F0-9]{40}$/;
  return bnbRegex.test(address);
}

/**
 * Validate TRON address (T format)
 */
function validateTRONAddress(address) {
  if (!address || typeof address !== 'string') return false;
  
  // TRON address format: T followed by 33 alphanumeric characters
  const tronRegex = /^T[a-zA-Z0-9]{33}$/;
  return tronRegex.test(address);
}

/**
 * Validate USDT-BNB TRX wallet address
 * Supports both BSC and TRON networks
 */
function validateBNBTRXAddress(address) {
  if (!address || typeof address !== 'string') return false;
  
  // Remove whitespace and convert to uppercase for consistency
  const cleanAddress = address.trim();
  
  // Check if it's a valid BNB address
  if (validateBNBAddress(cleanAddress)) {
    return true;
  }
  
  // Check if it's a valid TRON address
  if (validateTRONAddress(cleanAddress)) {
    return true;
  }
  
  return false;
}

/**
 * Get wallet type based on address format
 */
function getWalletType(address) {
  if (!address) return null;
  
  const cleanAddress = address.trim();
  
  if (validateBNBAddress(cleanAddress)) {
    return 'BSC';
  }
  
  if (validateTRONAddress(cleanAddress)) {
    return 'TRON';
  }
  
  return null;
}

/**
 * Format wallet address for display
 */
function formatWalletAddress(address) {
  if (!address) return '';
  
  const cleanAddress = address.trim();
  const type = getWalletType(cleanAddress);
  
  if (type === 'BSC') {
    return `${cleanAddress.substring(0, 6)}...${cleanAddress.substring(38)}`;
  }
  
  if (type === 'TRON') {
    return `${cleanAddress.substring(0, 4)}...${cleanAddress.substring(30)}`;
  }
  
  return cleanAddress;
}

/**
 * Validate with additional checksum (BSC only)
 */
function validateBNBChecksum(address) {
  if (!validateBNBAddress(address)) return false;
  
  // TODO: Implement EIP-55 checksum validation
  // For now, return true for valid format
  return true;
}

module.exports = {
  validateBNBAddress,
  validateTRONAddress,
  validateBNBTRXAddress,
  getWalletType,
  formatWalletAddress,
  validateBNBChecksum
};