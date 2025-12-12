import crypto from "crypto";

// Encryption key - MUST be set in environment variables
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = "aes-256-gcm";

if (!ENCRYPTION_KEY) {
  console.warn("⚠️ ENCRYPTION_KEY not set. Tokens will not be encrypted properly.");
}

/**
 * Encrypts sensitive data (OAuth tokens, API keys)
 */
export function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    // Fallback: return plain text with warning (NOT SECURE - for development only)
    console.warn("⚠️ Encryption key not set. Storing plain text (INSECURE!)");
    return text;
  }
  
  try {
    const key = Buffer.from(ENCRYPTION_KEY, "hex");
    if (key.length !== 32) {
      throw new Error("Encryption key must be 32 bytes (64 hex characters)");
    }
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const authTag = cipher.getAuthTag();
    
    // Return iv:authTag:encrypted
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypts sensitive data
 */
export function decrypt(encryptedData: string): string {
  if (!ENCRYPTION_KEY) {
    // Fallback: assume plain text (for development)
    return encryptedData;
  }
  
  try {
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      // Might be plain text from before encryption was enabled
      return encryptedData;
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = Buffer.from(ENCRYPTION_KEY, "hex");
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Safely encrypts a value if it exists, returns null otherwise
 */
export function safeEncrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return encrypt(value);
  } catch {
    return null;
  }
}

/**
 * Safely decrypts a value if it exists, returns null otherwise
 */
export function safeDecrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decrypt(value);
  } catch {
    return null;
  }
}

