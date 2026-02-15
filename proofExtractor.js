/**
 * Proof Extractor Utility
 * Extracts and validates proof from submissions
 * OCR, metadata extraction, timestamp validation, duplicate detection
 */

const fs = require('fs').promises;
const path = require('path');
const { createHash } = require('crypto');
const axios = require('axios');
const sharp = require('sharp');
const { fromBuffer } = require('file-type');

// Mock OCR - In production, integrate with Tesseract.js or Google Vision
class ProofExtractor {
    
    /**
     * Extract text from image using OCR
     */
    async extractTextFromImage(imageBuffer) {
        try {
            // In production, use actual OCR library
            // This is a mock implementation for demo
            
            // Convert image to buffer if string
            let buffer = imageBuffer;
            if (typeof imageBuffer === 'string') {
                if (imageBuffer.startsWith('http')) {
                    const response = await axios.get(imageBuffer, { 
                        responseType: 'arraybuffer',
                        timeout: 10000
                    });
                    buffer = Buffer.from(response.data, 'binary');
                } else if (imageBuffer.startsWith('data:image')) {
                    buffer = Buffer.from(imageBuffer.split(',')[1], 'base64');
                } else {
                    try {
                        buffer = await fs.readFile(imageBuffer);
                    } catch {
                        buffer = Buffer.from(imageBuffer);
                    }
                }
            }

            // Simulate OCR processing
            // In real implementation, you would:
            // 1. Preprocess image (grayscale, threshold)
            // 2. Run Tesseract.js or Google Vision API
            // 3. Post-process text
            
            // Mock extracted text based on image content
            const mockText = this.generateMockOcrText(buffer);
            
            return {
                success: true,
                text: mockText,
                confidence: 85,
                method: 'mock-ocr',
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('OCR extraction error:', error);
            return {
                success: false,
                text: '',
                confidence: 0,
                error: error.message
            };
        }
    }

    /**
     * Generate mock OCR text for demo
     */
    generateMockOcrText(buffer) {
        const hash = createHash('md5').update(buffer).digest('hex');
        const seed = parseInt(hash.substring(0, 8), 16);
        
        const texts = [
            'Transaction ID: TRX' + Math.floor(Math.random() * 1000000),
            'Username: user_' + Math.floor(Math.random() * 10000),
            'Email: user@example.com',
            'Order #: ORD-' + Date.now().toString().substring(7),
            'Payment confirmed: $' + (Math.random() * 100).toFixed(2),
            'Completed at: ' + new Date().toLocaleDateString(),
            'Screenshot verification: PASSED'
        ];
        
        return texts[seed % texts.length];
    }

    /**
     * Extract metadata from image
     */
    async extractMetadata(imagePath) {
        try {
            let buffer;
            
            if (imagePath.startsWith('http')) {
                const response = await axios.get(imagePath, { 
                    responseType: 'arraybuffer',
                    timeout: 10000
                });
                buffer = Buffer.from(response.data, 'binary');
            } else if (imagePath.startsWith('data:image')) {
                buffer = Buffer.from(imagePath.split(',')[1], 'base64');
            } else {
                buffer = await fs.readFile(imagePath);
            }

            // Get image metadata using sharp
            const metadata = await sharp(buffer).metadata();
            
            // Get file type
            const fileType = await fromBuffer(buffer);
            
            // Generate image hash for duplicate detection
            const imageHash = createHash('sha256')
                .update(buffer.slice(0, 1024)) // First 1KB for speed
                .digest('hex');
            
            // Try to extract EXIF data
            let exif = null;
            try {
                const rawExif = await sharp(buffer).withMetadata().metadata();
                exif = rawExif.exif ? JSON.parse(rawExif.exif.toString()) : null;
            } catch {
                // No EXIF or corrupted
            }

            return {
                success: true,
                metadata: {
                    // Image properties
                    width: metadata.width,
                    height: metadata.height,
                    format: metadata.format,
                    size: metadata.size,
                    space: metadata.space,
                    channels: metadata.channels,
                    depth: metadata.depth,
                    density: metadata.density,
                    hasAlpha: metadata.hasAlpha,
                    orientation: metadata.orientation,
                    pages: metadata.pages,
                    
                    // File info
                    filename: path.basename(imagePath),
                    extension: fileType?.ext || metadata.format,
                    mimeType: fileType?.mime || `image/${metadata.format}`,
                    
                    // Hash
                    imageHash,
                    
                    // EXIF data
                    exif: exif || null,
                    make: metadata.exif?.ImageDescription,
                    model: metadata.exif?.Model,
                    software: metadata.exif?.Software,
                    createDate: metadata.exif?.CreateDate,
                    modifyDate: metadata.exif?.ModifyDate,
                    gps: metadata.exif?.GPSInfo ? {
                        latitude: metadata.exif.GPSLatitude,
                        longitude: metadata.exif.GPSLongitude
                    } : null
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Metadata extraction error:', error);
            return {
                success: false,
                metadata: null,
                error: error.message
            };
        }
    }

    /**
     * Validate timestamp from image
     */
    async validateTimestamp(imagePath, maxAgeHours = 24) {
        try {
            const metadata = await this.extractMetadata(imagePath);
            
            if (!metadata.success) {
                return {
                    valid: false,
                    reason: 'Could not extract metadata',
                    ageHours: null
                };
            }

            let timestamp = null;
            
            // Try to get timestamp from EXIF
            if (metadata.metadata.exif) {
                if (metadata.metadata.createDate) {
                    timestamp = this.parseExifDate(metadata.metadata.createDate);
                } else if (metadata.metadata.modifyDate) {
                    timestamp = this.parseExifDate(metadata.metadata.modifyDate);
                }
            }
            
            // If no EXIF timestamp, use file modified date from server
            if (!timestamp) {
                try {
                    const stats = await fs.stat(imagePath);
                    timestamp = stats.mtime;
                } catch {
                    timestamp = new Date();
                }
            }

            const now = new Date();
            const ageHours = (now - new Date(timestamp)) / (1000 * 60 * 60);

            return {
                valid: ageHours <= maxAgeHours,
                timestamp: timestamp.toISOString(),
                ageHours: parseFloat(ageHours.toFixed(2)),
                maxAgeHours,
                isRecent: ageHours <= 24,
                isVeryRecent: ageHours <= 1,
                isOld: ageHours > 168 // 1 week
            };
        } catch (error) {
            console.error('Timestamp validation error:', error);
            return {
                valid: false,
                reason: error.message,
                ageHours: null
            };
        }
    }

    /**
     * Parse EXIF date string
     */
    parseExifDate(exifDate) {
        if (!exifDate) return null;
        
        // EXIF format: "YYYY:MM:DD HH:MM:SS"
        const match = exifDate.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
        
        if (match) {
            const [_, year, month, day, hour, minute, second] = match;
            return new Date(year, month - 1, day, hour, minute, second);
        }
        
        return new Date(exifDate);
    }

    /**
     * Compare screenshots for duplicates
     */
    async compareScreenshots(image1, image2) {
        try {
            // Get image buffers
            let buffer1, buffer2;
            
            // Load first image
            if (image1.startsWith('http')) {
                const response = await axios.get(image1, { responseType: 'arraybuffer' });
                buffer1 = Buffer.from(response.data, 'binary');
            } else if (image1.startsWith('data:image')) {
                buffer1 = Buffer.from(image1.split(',')[1], 'base64');
            } else {
                buffer1 = await fs.readFile(image1);
            }
            
            // Load second image
            if (image2.startsWith('http')) {
                const response = await axios.get(image2, { responseType: 'arraybuffer' });
                buffer2 = Buffer.from(response.data, 'binary');
            } else if (image2.startsWith('data:image')) {
                buffer2 = Buffer.from(image2.split(',')[1], 'base64');
            } else {
                buffer2 = await fs.readFile(image2);
            }

            // Generate perceptual hashes
            const hash1 = await this.generatePerceptualHash(buffer1);
            const hash2 = await this.generatePerceptualHash(buffer2);
            
            // Calculate Hamming distance
            const distance = this.hammingDistance(hash1, hash2);
            const similarity = 100 - (distance / 64 * 100); // 64-bit hash
            
            // Check if images are identical (byte-by-byte)
            const isIdentical = buffer1.equals(buffer2);
            
            // Check if images are resized/edited versions
            const metadata1 = await sharp(buffer1).metadata();
            const metadata2 = await sharp(buffer2).metadata();
            
            const aspectRatio1 = metadata1.width / metadata1.height;
            const aspectRatio2 = metadata2.width / metadata2.height;
            const aspectRatioMatch = Math.abs(aspectRatio1 - aspectRatio2) < 0.01;
            
            return {
                isDuplicate: isIdentical || similarity > 90,
                isIdentical,
                similarity: parseFloat(similarity.toFixed(2)),
                hammingDistance: distance,
                aspectRatioMatch,
                dimensions: {
                    image1: { width: metadata1.width, height: metadata1.height },
                    image2: { width: metadata2.width, height: metadata2.height }
                },
                isResized: !isIdentical && similarity > 70,
                isEdited: similarity > 80 && similarity < 95,
                method: 'perceptual-hash'
            };
        } catch (error) {
            console.error('Screenshot comparison error:', error);
            
            // Fallback to simple comparison
            try {
                const hash1 = createHash('sha256').update(image1).digest('hex');
                const hash2 = createHash('sha256').update(image2).digest('hex');
                
                return {
                    isDuplicate: hash1 === hash2,
                    similarity: hash1 === hash2 ? 100 : 0,
                    error: error.message,
                    method: 'fallback-hash'
                };
            } catch {
                return {
                    isDuplicate: false,
                    similarity: 0,
                    error: error.message,
                    method: 'failed'
                };
            }
        }
    }

    /**
     * Generate perceptual hash of image
     */
    async generatePerceptualHash(buffer) {
        try {
            // Resize to 8x8 for simplicity
            const resized = await sharp(buffer)
                .resize(8, 8, { fit: 'fill' })
                .greyscale()
                .raw()
                .toBuffer();
            
            // Calculate average pixel value
            let sum = 0;
            for (let i = 0; i < resized.length; i++) {
                sum += resized[i];
            }
            const avg = sum / resized.length;
            
            // Generate 64-bit hash
            let hash = 0n;
            for (let i = 0; i < resized.length; i++) {
                if (resized[i] > avg) {
                    hash |= 1n << BigInt(i);
                }
            }
            
            return hash.toString(16).padStart(16, '0');
        } catch (error) {
            console.error('Perceptual hash error:', error);
            // Fallback to MD5
            return createHash('md5').update(buffer).digest('hex');
        }
    }

    /**
     * Calculate Hamming distance between two hashes
     */
    hammingDistance(hash1, hash2) {
        try {
            const h1 = BigInt('0x' + hash1);
            const h2 = BigInt('0x' + hash2);
            const xor = h1 ^ h2;
            
            // Count set bits
            let distance = 0;
            let n = xor;
            while (n > 0) {
                distance++;
                n &= n - 1n;
            }
            
            return distance;
        } catch {
            // Fallback: count differing characters
            let distance = 0;
            for (let i = 0; i < Math.min(hash1.length, hash2.length); i++) {
                if (hash1[i] !== hash2[i]) distance++;
            }
            return distance;
        }
    }

    /**
     * Extract text from screenshot using OCR
     */
    async extractTextFromScreenshot(imageBuffer) {
        try {
            // Preprocess image for better OCR
            const processed = await sharp(imageBuffer)
                .greyscale()
                .normalize()
                .sharpen()
                .toBuffer();
            
            // Mock OCR result
            const extractedText = await this.extractTextFromImage(processed);
            
            // Extract potential data from text
            const data = this.extractStructuredData(extractedText.text);
            
            return {
                success: true,
                rawText: extractedText.text,
                confidence: extractedText.confidence,
                extractedData: data,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Screenshot text extraction error:', error);
            return {
                success: false,
                rawText: '',
                extractedData: {},
                error: error.message
            };
        }
    }

    /**
     * Extract structured data from OCR text
     */
    extractStructuredData(text) {
        const data = {};
        
        // Extract email
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = text.match(emailRegex);
        if (emails) data.emails = emails;
        
        // Extract URLs
        const urlRegex = /https?:\/\/[^\s]+/g;
        const urls = text.match(urlRegex);
        if (urls) data.urls = urls;
        
        // Extract phone numbers
        const phoneRegex = /[\+]?[(]?[0-9]{1,3}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{3,6}[-\s.]?[0-9]{3,6}/g;
        const phones = text.match(phoneRegex);
        if (phones) data.phones = phones;
        
        // Extract transaction IDs
        const txidRegex = /(TRX|TXN|ORD|INV)[-\s]?[0-9A-Za-z]{6,20}/g;
        const txids = text.match(txidRegex);
        if (txids) data.transactionIds = txids;
        
        // Extract usernames
        const usernameRegex = /@[a-zA-Z0-9_]{3,30}/g;
        const usernames = text.match(usernameRegex);
        if (usernames) data.usernames = usernames;
        
        // Extract amounts (money)
        const amountRegex = /\$[0-9,]+(\.[0-9]{2})?|[0-9,]+(\.[0-9]{2})?\s?(USD|EUR|GBP)/g;
        const amounts = text.match(amountRegex);
        if (amounts) data.amounts = amounts;
        
        // Extract dates
        const dateRegex = /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2}/g;
        const dates = text.match(dateRegex);
        if (dates) data.dates = dates;
        
        return data;
    }

    /**
     * Check if screenshot is from mobile device
     */
    async isMobileScreenshot(imagePath) {
        try {
            const metadata = await this.extractMetadata(imagePath);
            
            if (!metadata.success) {
                return { isMobile: false, confidence: 0 };
            }
            
            const { width, height } = metadata.metadata;
            
            // Common mobile aspect ratios
            const aspectRatio = width / height;
            const isPortrait = height > width;
            const isMobileAspect = 
                (aspectRatio > 0.45 && aspectRatio < 0.6) || // 9:16, 9:19
                (aspectRatio > 1.7 && aspectRatio < 2.0);    // 16:9 landscape
            
            // Common mobile resolutions
            const isMobileResolution = 
                (width === 375 && height === 667) ||  // iPhone 6/7/8
                (width === 414 && height === 736) ||  // iPhone 6/7/8 Plus
                (width === 375 && height === 812) ||  // iPhone X/XS/11 Pro
                (width === 414 && height === 896) ||  // iPhone XR/XS Max/11
                (width === 360 && height === 640) ||  // Android common
                (width === 390 && height === 844) ||  // iPhone 12/13/14
                (width === 393 && height === 852);    // iPhone 14 Pro
            
            return {
                isMobile: isMobileAspect || isMobileResolution,
                confidence: isMobileResolution ? 90 : (isMobileAspect ? 70 : 30),
                aspectRatio: parseFloat(aspectRatio.toFixed(3)),
                isPortrait,
                resolution: `${width}x${height}`
            };
        } catch (error) {
            console.error('Mobile screenshot detection error:', error);
            return {
                isMobile: false,
                confidence: 0,
                error: error.message
            };
        }
    }

    /**
     * Remove EXIF data from image
     */
    async removeExifData(imageBuffer) {
        try {
            // Remove all EXIF data by stripping metadata
            const stripped = await sharp(imageBuffer)
                .withMetadata({ exif: null, icc: null, iptc: null, xmp: null })
                .toBuffer();
            
            return {
                success: true,
                buffer: stripped,
                size: {
                    original: imageBuffer.length,
                    stripped: stripped.length
                }
            };
        } catch (error) {
            console.error('EXIF removal error:', error);
            return {
                success: false,
                buffer: imageBuffer,
                error: error.message
            };
        }
    }

    /**
     * Check for edited/manipulated screenshots
     */
    async detectForgery(imagePath) {
        try {
            const metadata = await this.extractMetadata(imagePath);
            
            if (!metadata.success) {
                return {
                    isForgery: true,
                    confidence: 50,
                    reasons: ['Could not analyze image metadata']
                };
            }

            const reasons = [];
            let confidence = 0;

            // Check for editing software in EXIF
            if (metadata.metadata.exif) {
                const software = metadata.metadata.exif.Software || 
                                metadata.metadata.exif.ProcessingSoftware;
                
                if (software) {
                    const editingSoftware = [
                        'photoshop', 'lightroom', 'gimp', 'paint', 
                        'editor', 'canva', 'snapseed', 'vsco',
                        'afterlight', 'picsart', 'pixlr'
                    ];
                    
                    for (const sw of editingSoftware) {
                        if (software.toLowerCase().includes(sw)) {
                            reasons.push(`Edited with ${software}`);
                            confidence += 30;
                            break;
                        }
                    }
                }
            }

            // Check for unusual dimensions
            if (metadata.metadata.width && metadata.metadata.height) {
                const aspectRatio = metadata.metadata.width / metadata.metadata.height;
                
                if (aspectRatio < 0.4 || aspectRatio > 2.5) {
                    reasons.push('Unusual aspect ratio for screenshot');
                    confidence += 20;
                }
            }

            // Check file size (too small = compressed/low quality)
            if (metadata.metadata.size) {
                const megapixels = (metadata.metadata.width * metadata.metadata.height) / 1000000;
                const expectedSize = megapixels * 300; // Rough estimate
                
                if (metadata.metadata.size < expectedSize * 0.3) {
                    reasons.push('Unusually small file size (highly compressed)');
                    confidence += 25;
                }
            }

            // Check for missing EXIF (screenshots usually have some)
            if (!metadata.metadata.exif && !metadata.metadata.make) {
                reasons.push('No EXIF data found');
                confidence += 15;
            }

            return {
                isForgery: confidence > 50,
                confidence: Math.min(confidence, 100),
                reasons,
                metadata: metadata.metadata
            };
        } catch (error) {
            console.error('Forgery detection error:', error);
            return {
                isForgery: true,
                confidence: 100,
                reasons: ['Forgery detection failed'],
                error: error.message
            };
        }
    }
}

module.exports = new ProofExtractor();