import CryptoJS from 'crypto-js';

/**
 * DES utility module
 *
 * Why this file exists:
 * - Keeps encryption/decryption logic in one place.
 * - Makes components simpler and easier to study.
 * - Avoids copy-paste of key and CryptoJS calls across files.
 *
 * Important: DES is an old symmetric algorithm and is not recommended for new
 * production systems. It is used here for class/project learning purposes.
 *
 * Study note:
 * - Symmetric means one key is used for both encrypt and decrypt.
 * - If key mismatches, decrypt output becomes unreadable/empty.
 * - Frontend encrypts before POST; frontend decrypts when rendering values.
 */

// Shared secret key used by both encryption and decryption.
// If VITE_DES_SECRET_KEY is defined, it overrides the fallback key.
const DES_SECRET_KEY = import.meta.env.VITE_DES_SECRET_KEY || 'UA-SECRET-KEY';

/**
 * Encrypt plain text using DES and return a base64-like cipher string.
 * DES is symmetric, so the same secret key is used to decrypt later.
 *
 * Example conceptual flow:
 * plain text ("ABC-123") -> encryptDES -> cipher text (stored/sent)
 */
export function encryptDES(plainText) {
    // Normalize values so null/undefined do not break encryption call.
    const normalizedValue = plainText == null ? '' : String(plainText);
    return CryptoJS.DES.encrypt(normalizedValue, DES_SECRET_KEY).toString();
}

/**
 * Decrypt DES cipher text back to readable UTF-8 text.
 * If decryption fails, return the original value to avoid UI crashes.
 *
 * Why fallback is helpful:
 * - Prevents table/page rendering failures when data is plain text,
 *   corrupted, or encrypted with a different key.
 */
export function decryptDES(cipherText) {
    const normalizedValue = cipherText == null ? '' : String(cipherText);
    if (!normalizedValue) return '';

    try {
        const bytes = CryptoJS.DES.decrypt(normalizedValue, DES_SECRET_KEY);
        return bytes.toString(CryptoJS.enc.Utf8) || normalizedValue;
    } catch {
        return normalizedValue;
    }
}
