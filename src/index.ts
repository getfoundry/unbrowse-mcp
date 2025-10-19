/**
 * Unbrowse MCP Server
 *
 * Provides access to indexed abilities from wrapper-storage and secure credential management.
 * Implements the private registry capabilities described in master.md:
 * - /list endpoint: Lists indexed tools/abilities filtered by user credentials
 * - /cookiejar endpoint: Manages encrypted credentials with SECRET-based decryption
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  apiClient,
  formatAbilityDescription,
  type IndexedAbility,
} from "./api-client.js";
import {
  executeWrapper,
  getWrapperMetadata,
} from "./wrapper-executor-enhanced.js";
import { decryptCredentials } from "./crypto-utils.js";

// User-level config from smithery.yaml
export const configSchema = z.object({
  debug: z.boolean().default(false).describe("Enable debug logging"),
  apiUrl: z
    .string()
    .optional()
    .describe("Unbrowse API URL (default: http://localhost:4111)"),
  secret: z
    .string()
    .describe("Secret key for decrypting credentials from the API"),
});

export default function createServer({
  config,
}: {
  config: z.infer<typeof configSchema>; // Define your config in smithery.yaml
}) {
  console.log("[INFO] createServer called - starting initialization");

  // Configure API client with custom URL if provided
  if (config.apiUrl) {
    process.env.UNBROWSE_API_URL = config.apiUrl;
  }

  const server = new McpServer({
    name: "Unbrowse MCP",
    version: "1.0.0",
  });

  console.log("[INFO] McpServer instance created");

  const registeredAbilityIds = new Set<string>();
  const accessibleAbilities: IndexedAbility[] = [];
  const availableCredentialKeys = new Set<string>();
  const credentialCache = new Map<string, Record<string, string> | null>();

  // Lazy initialization state
  let initializationPromise: Promise<void> | null = null;
  let isInitialized = false;

  const candidateVariantsFromDomain = (domain: string): string[] => {
    const trimmed = domain.trim();
    if (!trimmed) return [];
    const hyphenated = trimmed.replace(/\./g, "-");
    const underscored = trimmed.replace(/\./g, "_");
    return [trimmed, hyphenated, underscored];
  };

  const deriveCandidatesForKey = (
    ability: IndexedAbility,
    key: string,
  ): string[] => {
    const domain = key.split("::")[0];
    const variants = new Set<string>([ability.serviceName]);
    candidateVariantsFromDomain(domain).forEach((candidate) =>
      variants.add(candidate),
    );
    return Array.from(variants).filter(Boolean);
  };


  const fetchCredentialsForCandidate = async (
    candidate: string,
  ): Promise<Record<string, string> | null> => {
    if (credentialCache.has(candidate)) {
      return credentialCache.get(candidate) || null;
    }

    try {
      const encryptedCredentials = await apiClient.getCookieJar(candidate);
      if (!encryptedCredentials) {
        credentialCache.set(candidate, null);
        return null;
      }

      // Decrypt credentials using the secret
      const decryptedCredentials = decryptCredentials(encryptedCredentials, config.secret);
      credentialCache.set(candidate, decryptedCredentials);

      if (config.debug) {
        console.log(
          `[DEBUG] Credential lookup for ${candidate}: FOUND (${Object.keys(decryptedCredentials).length} keys)`,
        );
      }
      return decryptedCredentials;
    } catch (error: any) {
      if (config.debug) {
        console.warn(
          `[DEBUG] Failed to read/decrypt credentials for ${candidate}: ${error.message || error}`,
        );
      }
      credentialCache.set(candidate, null);
      return null;
    }
  };

  const abilityHasCredentialCoverage = async (ability: IndexedAbility): Promise<boolean> => {
    if (!ability.requiresDynamicHeaders) {
      return true;
    }

    for (const key of ability.dynamicHeaderKeys) {
      let keySatisfied = false;
      for (const candidate of deriveCandidatesForKey(ability, key)) {
        if (!candidate) continue;
        const credentials = await fetchCredentialsForCandidate(candidate);
        if (credentials && credentials[key] !== undefined) {
          keySatisfied = true;
          break;
        }
      }

      if (!keySatisfied) {
        if (config.debug) {
          console.log(
            `[DEBUG] Skipping ability ${ability.abilityId}: missing credential for ${key}`,
          );
        }
        return false;
      }
    }

    ability.dynamicHeaderKeys.forEach((key) => availableCredentialKeys.add(key));
    return true;
  };

  const registerAbilityTool = (ability: IndexedAbility): boolean => {
    if (registeredAbilityIds.has(ability.abilityId)) {
      return false;
    }

    const toolName = ability.abilityName;

    // Build description: ability.description + dependency IDs if present
    let toolDescription = ability.description || "";

    if (ability.dependencyOrder && ability.dependencyOrder.length > 0) {
      toolDescription += `\n\n**Dependencies (must be called first):** ${ability.dependencyOrder.join(", ")}`;
    }

    if (ability.dependencies?.missing && ability.dependencies.missing.length > 0) {
      toolDescription += `\n\n**Missing Dependencies:** ${ability.dependencies.missing.map(d => d.abilityId).join(", ")}`;
    }

    const inputSchemaProps: Record<string, any> = {};

    if (ability.inputSchema?.properties) {
      for (const [key, prop] of Object.entries(
        ability.inputSchema.properties as Record<string, any>,
      )) {
        let zodType: any;
        switch (prop.type) {
          case "string":
            zodType = z.string();
            break;
          case "number":
            zodType = z.number();
            break;
          case "integer":
            zodType = z.number().int();
            break;
          case "boolean":
            zodType = z.boolean();
            break;
          case "array":
            zodType = z.array(z.any());
            break;
          case "object":
            zodType = z.record(z.any());
            break;
          default:
            zodType = z.any();
        }

        if (!ability.inputSchema.required?.includes(key)) {
          zodType = zodType.optional();
        }

        if ((prop as any).description) {
          zodType = zodType.describe((prop as any).description);
        }

        inputSchemaProps[key] = zodType;
      }
    }

    server.registerTool(
      toolName,
      {
        title: ability.abilityName
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        description: toolDescription,
        inputSchema:
          Object.keys(inputSchemaProps).length > 0
            ? inputSchemaProps
            : {
                _placeholder: z
                  .any()
                  .optional()
                  .describe("No parameters required"),
              },
      },
      async (params) => {
        try {
          console.log(
            `[TRACE] ========== Executing ability: ${ability.abilityId} ==========`,
          );
          console.log(`[TRACE] Ability metadata:`, {
            abilityId: ability.abilityId,
            abilityName: ability.abilityName,
            serviceName: ability.serviceName,
            requiresDynamicHeaders: ability.requiresDynamicHeaders,
            dynamicHeaderKeys: ability.dynamicHeaderKeys,
          });
          console.log(`[TRACE] Params:`, params);

          const payload = { ...params };
          delete (payload as Record<string, unknown>)._placeholder;

          let resolvedCredentials: Record<string, string> | null = null;

          // Check if ability actually needs dynamic headers (defensive check)
          const actuallyNeedsDynamicHeaders =
            ability.requiresDynamicHeaders &&
            ability.dynamicHeaderKeys &&
            ability.dynamicHeaderKeys.length > 0;

          if (actuallyNeedsDynamicHeaders) {
            console.log(
              `[TRACE] Ability requires dynamic headers, extracting domains...`,
            );

            // Extract unique domains from dynamic header keys
            const domains = new Set<string>();
            ability.dynamicHeaderKeys.forEach((key) => {
              const domain = key.split("::")[0];
              console.log(`[TRACE] Processing header key: ${key} -> domain: ${domain}`);
              if (domain) domains.add(domain);
            });

            console.log(`[TRACE] Extracted domains:`, Array.from(domains));

            // First, list all available credential services
            try {
              const availableServices = await apiClient.listCredentialServices();
              console.log(
                `[TRACE] Available credential services from API:`,
                availableServices,
              );
            } catch (error: any) {
              console.warn(
                `[TRACE] Failed to list credential services:`,
                error.message,
              );
            }

            // Try each domain to find credentials that satisfy all required headers
            for (const domain of Array.from(domains)) {
              console.log(`[TRACE] Attempting to fetch credentials for domain: ${domain}`);

              try {
                const encryptedCreds = await apiClient.getCookieJar(domain);
                console.log(
                  `[TRACE] Cookie jar response for ${domain}:`,
                  encryptedCreds ? "Found (encrypted)" : "Not found",
                );

                if (!encryptedCreds) {
                  console.log(
                    `[TRACE] No credentials found for domain ${domain}`,
                  );
                  continue;
                }

                // Decrypt credentials
                const creds = decryptCredentials(encryptedCreds, config.secret);
                console.log(
                  `[TRACE] Decrypted credentials for ${domain}:`,
                  Object.keys(creds),
                );

                // Check if this credential set has all required headers
                const hasAllHeaders = ability.dynamicHeaderKeys.every(
                  (key) => creds[key] !== undefined,
                );

                console.log(
                  `[TRACE] Checking if all headers are present:`,
                  ability.dynamicHeaderKeys.map((key) => ({
                    key,
                    present: creds[key] !== undefined,
                  })),
                );

                if (hasAllHeaders) {
                  resolvedCredentials = creds;
                  console.log(
                    `[TRACE] ✓ Using credentials from domain ${domain} for ability ${ability.abilityId}`,
                  );
                  break;
                } else {
                  console.log(
                    `[TRACE] ✗ Credentials from ${domain} missing required headers`,
                  );
                }
              } catch (error: any) {
                console.warn(
                  `[TRACE] Credential fetch/decrypt failed for domain ${domain}:`,
                  error.message || error,
                );
              }
            }

            if (!resolvedCredentials) {
              const requiredDomains = Array.from(domains).join(", ");
              console.error(
                `[TRACE] ✗ Failed to find credentials. Required domains: ${requiredDomains}`,
              );
              throw new Error(
                `Credentials not available for ability ${ability.abilityId}. Required domains: ${requiredDomains}. Store the required headers and retry.`,
              );
            }
          } else {
            if (ability.requiresDynamicHeaders && (!ability.dynamicHeaderKeys || ability.dynamicHeaderKeys.length === 0)) {
              console.warn(
                `[WARN] Ability ${ability.abilityId} marked as requiresDynamicHeaders=true but has no dynamicHeaderKeys. Treating as public API.`,
              );
            }
            console.log(`[TRACE] Ability does not require dynamic headers (executing as public API)`);
          }

          const result = await executeWrapper(
            ability.abilityId,
            payload,
            {},
            resolvedCredentials || {},
          );

          if (config.debug) {
            console.log(
              `[DEBUG] Execution result: ${result.success ? "SUCCESS" : "FAILED"}`,
            );
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: result.success,
                    statusCode: result.statusCode,
                    responseBody: result.responseBody,
                    responseHeaders: result.responseHeaders,
                    error: result.error,
                    credentialsExpired: result.credentialsExpired,
                    loginAbilities: result.loginAbilities,
                    executedAt: result.executedAt,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: error.message || String(error),
                    executedAt: new Date().toISOString(),
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }
      },
    );

    registeredAbilityIds.add(ability.abilityId);
    return true;
  };

  // Async initialization function
  const ensureInitialized = async (): Promise<void> => {
    if (isInitialized) return;
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
      // Fetch abilities from the API
      let candidateAbilities: IndexedAbility[] = [];
      try {
        const result = await apiClient.listAbilities();
        candidateAbilities = result.abilities || [];
        console.log(
          `[INFO] Loaded ${candidateAbilities.length} abilities from API for registration`,
        );
      } catch (error: any) {
        console.error(`[ERROR] Failed to load abilities from API:`, error.message);
        console.error(`[ERROR] Make sure the Unbrowse API is running at ${config.apiUrl || process.env.UNBROWSE_API_URL || 'http://localhost:4111'}`);
      }

      for (const ability of candidateAbilities) {
        console.log(
          `[TRACE] Processing ability for registration: ${ability.abilityId}`,
        );
        console.log(`[TRACE]   - Service: ${ability.serviceName}`);
        console.log(
          `[TRACE]   - Requires dynamic headers: ${ability.requiresDynamicHeaders}`,
        );
        console.log(
          `[TRACE]   - Dynamic header keys: ${ability.dynamicHeaderKeys.join(", ") || "none"}`,
        );

        if (!(await abilityHasCredentialCoverage(ability))) {
          console.log(
            `[TRACE]   - SKIPPED: No credential coverage for ${ability.abilityId}`,
          );
          continue;
        }

        if (registerAbilityTool(ability)) {
          console.log(
            `[TRACE]   - ✓ REGISTERED: ${ability.abilityId}`,
          );
          accessibleAbilities.push(ability);
        }
      }

      if (accessibleAbilities.length === 0) {
        console.warn(
          "[WARN] No abilities were registered. Ensure credentials are stored in the cookie jar and wrappers are available.",
        );
      } else {
        console.log(
          `[INFO] Registered ${accessibleAbilities.length} abilities with credential coverage`,
        );
        if (availableCredentialKeys.size > 0) {
          console.log(
            `[INFO] Detected ${availableCredentialKeys.size} credential key(s) from decrypted cookie jar entries`,
          );
        }
      }

      isInitialized = true;
    })();

    return initializationPromise;
  };

  // Start initialization immediately in background (non-blocking)
  ensureInitialized().catch((error) => {
    console.error('[ERROR] Background initialization failed:', error);
  });

  // Tool: Search Abilities (Credential-aware)
  server.registerTool(
    "search_abilities",
    {
      title: "Search Abilities",
      description:
        "Searches indexed abilities that the user can execute based on provided credentials. Results are ranked by relevance to the query and include dependency details.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe(
            "Describe what you want to do (e.g., 'create trade', 'fetch token prices').",
          ),
        userCredentials: z
          .array(z.string())
          .optional()
          .describe(
            "Credential keys available to the user (e.g., ['www.hedgemony.fund::cookie']).",
          ),
        filterByDomains: z
          .boolean()
          .optional()
          .default(true)
          .describe(
            "Restrict private abilities to those that match credential domains.",
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Maximum number of results to return (default 20)."),
      },
    },
    async ({ query, userCredentials, filterByDomains, limit }) => {
      // Ensure abilities are loaded
      await ensureInitialized();

      const credentialScope =
        userCredentials && userCredentials.length > 0
          ? [...userCredentials]
          : Array.from(availableCredentialKeys);
      const domainFilter =
        typeof filterByDomains === "boolean" ? filterByDomains : true;
      const resultLimit =
        typeof limit === "number" ? Math.min(Math.max(limit, 1), 50) : 20;

      const result = await apiClient.searchAbilities(query, {
        userCreds: credentialScope,
        filterByDomains: domainFilter,
        trustProvidedCreds: true,
      });
      const matches = result.abilities.slice(0, resultLimit);
      const domainCandidates = new Set<string>(
        Array.from(availableCredentialKeys).map((key) => key.split("::")[0]),
      );
      if (domainCandidates.size === 0) {
        accessibleAbilities.forEach((ability) =>
          domainCandidates.add(ability.serviceName),
        );
      }
      const availableDomains = Array.from(domainCandidates);

      if (config.debug) {
        console.log(
          `[DEBUG] Search "${query}" returned ${matches.length} abilities (limit ${resultLimit}) with ${credentialScope.length} credential hints`,
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                query,
                count: matches.length,
                availableDomains,
                abilities: matches.map((a) => ({
                  id: a.abilityId,
                  name: a.abilityName,
                  service: a.serviceName,
                  description: formatAbilityDescription(a),
                  requiresCreds: a.requiresDynamicHeaders,
                  neededCreds: a.dynamicHeaderKeys,
                  dependencyOrder: a.dependencyOrder,
                  missingDependencies:
                    a.dependencies?.missing?.map((d) => d.abilityId) || [],
                  ponScore: a.ponScore,
                  successRate: a.successRate,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // Resource: Ability Index
  // Provides detailed information about indexed abilities
  server.registerResource(
    "ability-index",
    "unbrowse://abilities",
    {
      title: "Unbrowse Ability Index",
      description:
        "Access to the indexed abilities from wrapper-storage with PoN scores, schemas, and execution metadata",
    },
    async (uri) => {
      // Ensure abilities are loaded
      await ensureInitialized();

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(accessibleAbilities, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    },
  );

  // Tool: Get Wrapper Metadata
  // Provides information about a wrapper without executing it
  server.registerTool(
    "get_ability_info",
    {
      title: "Get Ability Information",
      description:
        "Retrieves metadata about an ability/wrapper without executing it. Shows input schema, required credentials, dependency order (which abilities must be called first in sequence), and missing dependencies.",
      inputSchema: {
        abilityId: z
          .string()
          .describe("The ability ID to get information about"),
      },
    },
    async ({ abilityId }) => {
      const metadata = await getWrapperMetadata(abilityId);

      if (!metadata) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: `Ability not found: ${abilityId}`,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Format dependency order info
      let dependencyInfo = "";
      if (metadata.dependencyOrder && metadata.dependencyOrder.length > 0) {
        dependencyInfo = `\n\nDependency Order: Call these abilities first in sequence:\n${metadata.dependencyOrder.map((id, idx) => `  ${idx + 1}. ${id}`).join("\n")}`;
      }

      if (
        metadata.dependencies?.missing &&
        metadata.dependencies.missing.length > 0
      ) {
        dependencyInfo += `\n\nMissing Dependencies:\n${metadata.dependencies.missing.map((d) => `  - ${d.abilityId} (${d.abilityName})`).join("\n")}`;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                ...metadata,
                dependencyInfo: dependencyInfo || "No dependencies required",
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  return server.server;
}
