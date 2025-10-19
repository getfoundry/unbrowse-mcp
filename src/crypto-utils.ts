/**
 * Cryptography utilities for decrypting credentials
 *
 * Implements the encryption format used by the browser extension:
 * - AES-256-GCM encryption
 * - SHA-256 key derivation (simple hash of the encryption key)
 * - No salt (key is derived directly from the encryption string)
 *
 * Encrypted credential format:
 * {
 *   "ciphertext": "base64_encoded_encrypted_data",
 *   "iv": "base64_encoded_initialization_vector"
 * }
 */

import { createDecipheriv, createHash } from "crypto";

/**
 * Encrypted data structure from the extension
 */
interface EncryptedData {
  ciphertext: string;
  iv: string;
}

/**
 * Decrypts data using the extension's encryption format
 *
 * @param encryptedData - Encrypted data object or JSON string
 * @param encryptionKey - Encryption key (custom string set in extension)
 * @returns Decrypted plaintext string
 */
export function decryptData(
  encryptedData: EncryptedData | string,
  encryptionKey: string
): string {
  try {
    // Parse JSON if string
    const data: EncryptedData =
      typeof encryptedData === "string"
        ? JSON.parse(encryptedData)
        : encryptedData;

    // Decode from base64
    const ciphertext = Buffer.from(data.ciphertext, "base64");
    const iv = Buffer.from(data.iv, "base64");

    // Derive key using SHA-256 hash (same as extension)
    const key = createHash("sha256").update(encryptionKey).digest();

    // Extract auth tag from ciphertext (last 16 bytes for AES-GCM)
    const authTagLength = 16;
    const actualCiphertext = ciphertext.slice(0, -authTagLength);
    const authTag = ciphertext.slice(-authTagLength);

    // Create decipher
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(actualCiphertext, undefined, "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error: any) {
    throw new Error(`Failed to decrypt data: ${error.message}`);
  }
}

/**
 * Decrypts a credential value that might be encrypted or plain text
 *
 * @param value - Credential value (encrypted JSON or plain text)
 * @param encryptionKey - Encryption key for decryption
 * @returns Decrypted value or original value if not encrypted
 */
export function decryptCredentialValue(
  value: string,
  encryptionKey: string
): string {
  // Try to parse as encrypted JSON
  try {
    const parsed = JSON.parse(value);
    if (parsed.ciphertext && parsed.iv) {
      // It's encrypted, decrypt it
      return decryptData(parsed, encryptionKey);
    }
  } catch {
    // Not JSON, treat as plain text
  }

  // Return as-is (plain text credential)
  return value;
}

/**
 * Decrypts all credentials in a credential object
 *
 * @param credentials - Object with credential keys and encrypted values
 * @param encryptionKey - Encryption key for decryption
 * @returns Object with decrypted credential values
 */
export function decryptCredentials(
  credentials: Record<string, string>,
  encryptionKey: string
): Record<string, string> {
  const decrypted: Record<string, string> = {};

  for (const [key, value] of Object.entries(credentials)) {
    try {
      decrypted[key] = decryptCredentialValue(value, encryptionKey);
    } catch (error: any) {
      console.error(`[ERROR] Failed to decrypt credential ${key}:`, error.message);
      throw new Error(`Failed to decrypt credential ${key}: ${error.message}`);
    }
  }

  return decrypted;
}
