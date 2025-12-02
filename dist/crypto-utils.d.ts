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
export declare function decryptData(encryptedData: EncryptedData | string, encryptionKey: string): string;
/**
 * Decrypts a credential value that might be encrypted or plain text
 *
 * @param value - Credential value (encrypted JSON or plain text)
 * @param encryptionKey - Encryption key for decryption
 * @returns Decrypted value or original value if not encrypted
 */
export declare function decryptCredentialValue(value: string, encryptionKey: string): string;
/**
 * Decrypts all credentials in a credential object
 *
 * @param credentials - Object with credential keys and encrypted values
 * @param encryptionKey - Encryption key for decryption
 * @returns Object with decrypted credential values
 */
export declare function decryptCredentials(credentials: Record<string, string>, encryptionKey: string): Record<string, string>;
export {};
//# sourceMappingURL=crypto-utils.d.ts.map