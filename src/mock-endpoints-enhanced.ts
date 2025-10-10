/**
 * Enhanced Mock API Endpoints for Unbrowse MCP
 *
 * Enhancements:
 * - Dependency order tracking in ability metadata
 * - Domain-based credential filtering
 * - 401+ error handling with credential expiration
 * - Login ability detection for expired credentials
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import {
  createDecipheriv,
  createCipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

// Get wrapper storage path - works in both ESM and CommonJS
const WRAPPER_STORAGE_PATH = join(process.cwd(), "src", "wrapper-storage");

// Encryption config
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
 * Interface for indexed abilities
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
  dependencyOrder: string[];
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
 * Interface for credential storage with expiration tracking
 */
export interface CredentialEntry {
  key: string;
  encryptedValue: string;
  serviceName: string;
  createdAt: string;
  expired?: boolean;
  expiredAt?: string;
}

const mockCredentialStore: CredentialEntry[] = [];

/**
 * Extracts domain from credential key (format: "domain::header-name")
 */
function extractDomain(credentialKey: string): string {
  return credentialKey.split("::")[0];
}

/**
 * Marks credentials as expired for a service
 */
export function markCredentialsExpired(serviceName: string): void {
  const now = new Date().toISOString();
  mockCredentialStore.forEach((cred) => {
    if (cred.serviceName === serviceName) {
      cred.expired = true;
      cred.expiredAt = now;
    }
  });
}

/**
 * Checks if a service has valid (non-expired) credentials
 */
export function hasValidCredentials(serviceName: string): boolean {
  return mockCredentialStore.some(
    (cred) => cred.serviceName === serviceName && !cred.expired,
  );
}

/**
 * Gets available credential domains (non-expired only)
 */
export function getAvailableDomains(): string[] {
  const domains = new Set<string>();
  mockCredentialStore
    .filter((cred) => !cred.expired)
    .forEach((cred) => {
      domains.add(extractDomain(cred.key));
    });
  return Array.from(domains);
}

/**
 * Lists indexed abilities with enhanced filtering
 *
 * @param userHasCreds - Credential keys available to user
 * @param filterByDomains - Only return abilities matching credential domains
 * @returns Array of abilities with dependency order
 */
export async function listAbilities(
  userHasCreds: string[] = [],
  filterByDomains: boolean = false,
): Promise<IndexedAbility[]> {
  try {
    const files = await readdir(WRAPPER_STORAGE_PATH);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    // Extract unique domains from user credentials (non-expired only)
    const validCreds = userHasCreds.filter((key) => {
      const matches = mockCredentialStore.filter(
        (c) => c.key === key && !c.expired,
      );
      return matches.length > 0;
    });

    const userDomains = new Set(validCreds.map(extractDomain));

    const abilities: IndexedAbility[] = [];

    for (const file of jsonFiles) {
      const filePath = join(WRAPPER_STORAGE_PATH, file);
      const content = await readFile(filePath, "utf-8");
      const data = JSON.parse(content);

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
        dependencyOrder: data.input.dependency_order || [],
        dependencies: data.dependencies,
        ponScore: Math.random() * 0.3 + 0.05,
        successRate: data.execution?.ok ? 0.95 : 0.75,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };

      // Check if user has all required credentials (non-expired)
      const hasRequiredCreds = ability.dynamicHeaderKeys.every((key) =>
        validCreds.includes(key),
      );

      // Extract domains from ability's required credentials
      const abilityDomains = new Set(
        ability.dynamicHeaderKeys.map(extractDomain),
      );

      // Check domain overlap
      const matchesDomain =
        !filterByDomains ||
        Array.from(abilityDomains).some((domain) => userDomains.has(domain));

      // Include if: (no creds needed OR has creds) AND matches domain filter
      if (
        (!ability.requiresDynamicHeaders || hasRequiredCreds) &&
        matchesDomain
      ) {
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
 * Finds login abilities for a given service/domain
 * Used to suggest authentication when credentials expire
 */
export async function findLoginAbilities(
  serviceName: string,
): Promise<IndexedAbility[]> {
  try {
    const allAbilities = await listAbilities([], false);

    // Look for abilities that:
    // 1. Match the service name
    // 2. Don't require dynamic headers (they're the auth step)
    // 3. Have "login" or "auth" in the name/description
    return allAbilities.filter((ability) => {
      const matchesService = ability.serviceName === serviceName;
      const noCredsRequired = !ability.requiresDynamicHeaders;
      const isAuthRelated =
        ability.abilityName.toLowerCase().includes("login") ||
        ability.abilityName.toLowerCase().includes("auth") ||
        ability.abilityName.toLowerCase().includes("signin") ||
        ability.description.toLowerCase().includes("login") ||
        ability.description.toLowerCase().includes("authenticate");

      return matchesService && noCredsRequired && isAuthRelated;
    });
  } catch (error) {
    console.error("Error finding login abilities:", error);
    return [];
  }
}

/**
 * Gets credentials for a service (non-expired only)
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

  // Find non-expired credentials for the service
  const credentials = mockCredentialStore.filter(
    (cred) => cred.serviceName === serviceName && !cred.expired,
  );

  if (credentials.length === 0) {
    return null;
  }

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
 * Stores encrypted credentials
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

  const existingIndex = mockCredentialStore.findIndex(
    (cred) => cred.serviceName === serviceName && cred.key === key,
  );

  const entry: CredentialEntry = {
    key,
    encryptedValue,
    serviceName,
    createdAt: new Date().toISOString(),
    expired: false,
  };

  if (existingIndex >= 0) {
    mockCredentialStore[existingIndex] = entry;
  } else {
    mockCredentialStore.push(entry);
  }
}

/**
 * Generates a formatted description with dependency order
 */
export function formatAbilityDescription(ability: IndexedAbility): string {
  let desc = ability.description;

  // Add dependency order information
  if (ability.dependencyOrder && ability.dependencyOrder.length > 0) {
    desc += `\n\n**Dependency Order:** This ability must be called AFTER: ${ability.dependencyOrder.map((depId) => `\`${depId}\``).join(" → ")}`;
    desc += `\nCall these abilities in sequence before executing this one.`;
  }

  // Add missing dependency warnings
  if (
    ability.dependencies?.missing &&
    ability.dependencies.missing.length > 0
  ) {
    desc += `\n\n**⚠️ Missing Dependencies:**`;
    ability.dependencies.missing.forEach((dep) => {
      desc += `\n- ${dep.abilityId} (${dep.abilityName}) - Referenced as ${dep.reference}`;
    });
  }

  // Add credential requirements
  if (ability.requiresDynamicHeaders) {
    desc += `\n\n**Required Credentials:** ${ability.dynamicHeaderKeys.join(", ")}`;
  }

  return desc;
}

/**
 * Mock endpoint handlers (compatible with Express)
 */
export const endpoints = {
  list: async (req: any, res: any) => {
    const userCredsParam = req.query.userCreds || "";
    const filterByDomains = req.query.filterByDomains === "true";
    const userCreds = userCredsParam ? userCredsParam.split(",") : [];

    const abilities = await listAbilities(userCreds, filterByDomains);

    res.json({
      success: true,
      count: abilities.length,
      abilities: abilities.map((a) => ({
        ...a,
        description: formatAbilityDescription(a),
      })),
      availableDomains: getAvailableDomains(),
    });
  },

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
        // Check if credentials expired
        const hasExpired = mockCredentialStore.some(
          (c) => c.serviceName === serviceName && c.expired,
        );

        if (hasExpired) {
          const loginAbilities = await findLoginAbilities(serviceName);
          return res.status(401).json({
            success: false,
            error: `Credentials expired for service: ${serviceName}`,
            expired: true,
            loginAbilities: loginAbilities.map((a) => ({
              id: a.abilityId,
              name: a.abilityName,
              description: a.description,
            })),
          });
        }

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

  markExpired: async (req: any, res: any) => {
    const { serviceName } = req.params;

    markCredentialsExpired(serviceName);
    const loginAbilities = await findLoginAbilities(serviceName);

    res.json({
      success: true,
      message: `Credentials marked expired for ${serviceName}`,
      loginAbilities: loginAbilities.map((a) => ({
        id: a.abilityId,
        name: a.abilityName,
        description: a.description,
      })),
    });
  },
};
