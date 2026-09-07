import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
// Ensure key is strictly 32 bytes for aes-256-gcm
function getEncryptionKeyBuffer() {
    const rawKey = process.env.ENCRYPTION_KEY;
    if (!rawKey) {
        if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
            console.warn('⚠️ [SECURITY WARNING] process.env.ENCRYPTION_KEY is not defined. Using default fallback key. Please configure ENCRYPTION_KEY in your Vercel Environment Variables.');
        }
        return Buffer.from('01234567890123456789012345678901', 'utf8');
    }

    if (Buffer.byteLength(rawKey, 'utf8') === 32) {
        return Buffer.from(rawKey, 'utf8');
    }

    // Derive deterministic 32-byte key via SHA-256 if key length is different
    return crypto.createHash('sha256').update(rawKey).digest();
}

export function encrypt(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getEncryptionKeyBuffer();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag().toString('hex');

    // Return iv + tag + encrypted
    return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decrypt(encryptedData) {
    if (!encryptedData) return null;
    const [ivHex, tagHex, encryptedText] = encryptedData.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const key = getEncryptionKeyBuffer();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

export function hashSHA256(text) {
    if (!text) return null;
    return crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
}

export function formatPhoneForHash(phone) {
    if (!phone) return null;
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');
    return cleaned || null;
}

