import crypto from "crypto";

/**
 * Encryption utility for storing sensitive credentials
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 16 bytes for AES
const SALT_LENGTH = 64; // 64 bytes for key derivation
const TAG_LENGTH = 16; // 16 bytes for GCM auth tag
const KEY_LENGTH = 32; // 32 bytes for AES-256

/**
 * Derives an encryption key from the master key and salt
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, "sha256");
}

/**
 * Encrypts a value using AES-256-GCM
 */
export function encrypt(value: string): string {
  if (!value) return value;
  
  const masterKey = process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!masterKey) {
    console.warn("⚠️ ENCRYPTION_KEY not set, storing in plain text (NOT RECOMMENDED FOR PRODUCTION)");
    return value; // Fallback to plain text if no key
  }

  try {
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Derive key from master key and salt
    const key = deriveKey(masterKey, salt);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt
    let encrypted = cipher.update(value, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    // Get auth tag
    const tag = cipher.getAuthTag();
    
    // Combine: salt + iv + tag + encrypted
    const combined = Buffer.concat([
      salt,
      iv,
      tag,
      Buffer.from(encrypted, "hex")
    ]);
    
    return combined.toString("base64");
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt value");
  }
}

/**
 * Safe encrypt - handles null/undefined values
 */
export function safeEncrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  return encrypt(value);
}

/**
 * Safe decrypt - handles null/undefined values
 */
export function safeDecrypt(encryptedValue: string | null | undefined): string | null {
  if (!encryptedValue) return null;
  return decrypt(encryptedValue);
}

/**
 * Decrypts a value encrypted with encrypt()
 */
export function decrypt(encryptedValue: string): string {
  if (!encryptedValue) return encryptedValue;
  
  const masterKey = process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!masterKey) {
    // If no key, assume it's plain text (backward compatibility)
    return encryptedValue;
  }

  try {
    // Decode from base64
    const combined = Buffer.from(encryptedValue, "base64");
    
    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    
    // Derive key
    const key = deriveKey(masterKey, salt);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    // Decrypt
    let decrypted = decipher.update(encrypted, undefined, "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    // If decryption fails, might be plain text (backward compatibility)
    return encryptedValue;
  }
}
