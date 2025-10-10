/**
 * Mock API Endpoints for Unbrowse MCP
 *
 * This file provides stub implementations for:
 * - /list - Lists indexed abilities from wrapper-storage
 * - /cookiejar - Retrieves encrypted credentials, decrypted with SECRET env
 *
 * These stubs simulate the private registry capabilities described in master.md
 */

import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createDecipheriv,
  createCipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to wrapper-storage directory
const WRAPPER_STORAGE_PATH = join(__dirname, "wrapper-storage");

// Encryption/Decryption utilities
const ALGORITHM = "aes-256-gcm";
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a key from the secret using scrypt
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, 32);
}

/**
 * Encrypts data with the provided secret
 */
export function encrypt(data: string, secret: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(secret, salt);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: salt:iv:authTag:encryptedData
  return `${salt.toString("hex")}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts data with the provided secret
 */
export function decrypt(encryptedData: string, secret: string): string {
  const parts = encryptedData.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted data format");
  }

  const salt = Buffer.from(parts[0], "hex");
  const iv = Buffer.from(parts[1], "hex");
  const authTag = Buffer.from(parts[2], "hex");
  const encrypted = parts[3];

  const key = deriveKey(secret, salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Interface for indexed abilities from wrapper-storage
 */
export interface IndexedAbility {
  abilityId: string;
  abilityName: string;
  serviceName: string;
  description: string;
  inputSchema: any;
  outputSchema?: any;
  dynamicHeaderKeys: string[];
  requiresDynamicHeaders: boolean;
  ponScore?: number;
  successRate?: number;
  dependencyOrder: string[]; // Ordered list of ability IDs that must be called first
  dependencies?: {
    resolved?: any[];
    missing?: Array<{
      abilityId: string;
      abilityName: string;
      reference: string;
    }>;
    unresolved?: any[];
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Interface for credential storage
 */
export interface CredentialEntry {
  key: string;
  encryptedValue: string;
  serviceName: string;
  createdAt: string;
  expired?: boolean; // Marked true on 401+ errors
  expiredAt?: string; // Timestamp when marked expired
}

/**
 * Mock credential storage (in-memory for stub)
 * In production, this would be stored in Convex
 */
const mockCredentialStore: CredentialEntry[] = [];

/**
 * GET /list - Lists all indexed abilities from wrapper-storage
 *
 * This endpoint serves as the private registry, listing all tools that have been indexed.
 * Abilities are filtered based on user credentials and dynamic header requirements.
 *
 * @param userHasCreds - Array of credential keys the user has access to
 * @returns Array of indexed abilities
 */
export async function listAbilities(
  userHasCreds: string[] = [],
): Promise<IndexedAbility[]> {
  try {
    const files = await readdir(WRAPPER_STORAGE_PATH);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    const abilities: IndexedAbility[] = [];

    for (const file of jsonFiles) {
      const filePath = join(WRAPPER_STORAGE_PATH, file);
      const content = await readFile(filePath, "utf-8");
      const data = JSON.parse(content);

      // Extract ability data from wrapper-storage format
      const ability: IndexedAbility = {
        abilityId: data.input.ability_id,
        abilityName: data.input.ability_name,
        serviceName: data.input.service_name,
        description: data.input.description,
        inputSchema: data.schemas?.input || data.input.input_schema,
        outputSchema: data.schemas?.output,
        dynamicHeaderKeys: data.input.dynamic_header_keys || [],
        requiresDynamicHeaders:
          (data.input.dynamic_header_keys || []).length > 0,
        ponScore: Math.random() * 0.3 + 0.05, // Mock PoN score (0.05-0.35)
        successRate: data.execution?.ok ? 0.95 : 0.75,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };

      // Filter: Only include if user has required credentials OR no dynamic headers needed
      const hasRequiredCreds = ability.dynamicHeaderKeys.every((key) =>
        userHasCreds.includes(key),
      );

      if (!ability.requiresDynamicHeaders || hasRequiredCreds) {
        abilities.push(ability);
      }
    }

    return abilities;
  } catch (error) {
    console.error("Error listing abilities:", error);
    return [];
  }
}

/**
 * GET /cookiejar - Retrieves encrypted credentials for a service
 *
 * This endpoint returns credentials encrypted with the SECRET environment variable.
 * Credentials are decrypted at runtime for secure proxy execution.
 *
 * @param serviceName - Name of the service to get credentials for
 * @param secret - Secret key from environment variable for decryption
 * @returns Decrypted credential object or null if not found
 */
export async function getCookieJar(
  serviceName: string,
  secret: string,
): Promise<Record<string, string> | null> {
  if (!secret) {
    throw new Error(
      "SECRET environment variable is required for cookiejar access",
    );
  }

  // Find credentials for the service
  const credentials = mockCredentialStore.filter(
    (cred) => cred.serviceName === serviceName,
  );

  if (credentials.length === 0) {
    return null;
  }

  // Decrypt and return as key-value pairs
  const decrypted: Record<string, string> = {};

  for (const cred of credentials) {
    try {
      decrypted[cred.key] = decrypt(cred.encryptedValue, secret);
    } catch (error) {
      console.error(`Failed to decrypt credential ${cred.key}:`, error);
      throw new Error(`Failed to decrypt credentials for ${serviceName}`);
    }
  }

  return decrypted;
}

/**
 * POST /cookiejar - Stores encrypted credentials for a service
 *
 * @param serviceName - Name of the service
 * @param key - Credential key (e.g., "cookie", "referer")
 * @param value - Credential value to encrypt
 * @param secret - Secret key from environment variable for encryption
 */
export async function setCookieJar(
  serviceName: string,
  key: string,
  value: string,
  secret: string,
): Promise<void> {
  if (!secret) {
    throw new Error(
      "SECRET environment variable is required for cookiejar access",
    );
  }

  const encryptedValue = encrypt(value, secret);

  // Check if credential already exists
  const existingIndex = mockCredentialStore.findIndex(
    (cred) => cred.serviceName === serviceName && cred.key === key,
  );

  const entry: CredentialEntry = {
    key,
    encryptedValue,
    serviceName,
    createdAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    mockCredentialStore[existingIndex] = entry;
  } else {
    mockCredentialStore.push(entry);
  }
}

/**
 * Mock endpoint handlers for Express integration
 */
export const endpoints = {
  /**
   * GET /api/list
   * Query params:
   * - userCreds: Comma-separated list of credential keys user has access to
   */
  list: async (req: any, res: any) => {
    const userCredsParam = req.query.userCreds || "";
    const userCreds = userCredsParam ? userCredsParam.split(",") : [];

    const abilities = await listAbilities(userCreds);

    res.json({
      success: true,
      count: abilities.length,
      abilities,
    });
  },

  /**
   * GET /api/cookiejar/:serviceName
   * Requires SECRET env variable
   */
  getCookiejar: async (req: any, res: any) => {
    const { serviceName } = req.params;
    const secret = process.env.SECRET;

    if (!secret) {
      return res.status(500).json({
        success: false,
        error: "SECRET environment variable not configured",
      });
    }

    try {
      const credentials = await getCookieJar(serviceName, secret);

      if (!credentials) {
        return res.status(404).json({
          success: false,
          error: `No credentials found for service: ${serviceName}`,
        });
      }

      res.json({
        success: true,
        serviceName,
        credentials,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * POST /api/cookiejar/:serviceName
   * Body: { key: string, value: string }
   * Requires SECRET env variable
   */
  setCookiejar: async (req: any, res: any) => {
    const { serviceName } = req.params;
    const { key, value } = req.body;
    const secret = process.env.SECRET;

    if (!secret) {
      return res.status(500).json({
        success: false,
        error: "SECRET environment variable not configured",
      });
    }

    if (!key || !value) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: key, value",
      });
    }

    try {
      await setCookieJar(serviceName, key, value, secret);

      res.json({
        success: true,
        message: `Credential ${key} stored for ${serviceName}`,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
};
