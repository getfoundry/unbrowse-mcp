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
} from "./wrapper-executor-enhanced.js";
import { decryptCredentials } from "./crypto-utils.js";

// User-level config from smithery.yaml
export const configSchema = z.object({
  debug: z.boolean().default(false).describe("Enable debug logging"),
  password: z
    .string()
    .describe("Password to encrypt/decrypt your stored credentials"),
});

export default function createServer({
  config,
}: {
  config: z.infer<typeof configSchema>; // Define your config in smithery.yaml
}) {
  console.log("[INFO] createServer called - starting initialization");

  const server = new McpServer({
    name: "Unbrowse MCP",
    version: "1.0.0",
  });

  console.log("[INFO] McpServer instance created");

  const accessibleAbilities: IndexedAbility[] = [];
  const availableCredentialKeys = new Set<string>();
  const credentialCache = new Map<string, Record<string, string> | null>();

  // Ability cache - populated by search_abilities, used by execute_ability
  const abilityCache = new Map<string, IndexedAbility>();

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
    const variants = new Set<string>([ability.service_name]);
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

      // Decrypt credentials using the password
      const decryptedCredentials = decryptCredentials(encryptedCredentials, config.password);
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
    if (!ability.requires_dynamic_headers) {
      return true;
    }

    for (const key of ability.dynamic_header_keys) {
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
            `[DEBUG] Skipping ability ${ability.ability_id}: missing credential for ${key}`,
          );
        }
        return false;
      }
    }

    ability.dynamic_header_keys.forEach((key) => availableCredentialKeys.add(key));
    return true;
  };


  // Async initialization function
  const ensureInitialized = async (): Promise<void> => {
    if (isInitialized) return;
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
      // Fetch abilities from the API to populate the accessible abilities list
      // Pre-populate the cache with all abilities that have credential coverage
      try {
        const result = await apiClient.listAbilities();
        const candidateAbilities = result.abilities || [];
        console.log(
          `[INFO] Loaded ${candidateAbilities.length} abilities from API (available for search)`,
        );

        // Store them for credential coverage checking AND cache them
        for (const ability of candidateAbilities) {
          if (await abilityHasCredentialCoverage(ability)) {
            accessibleAbilities.push(ability);
            abilityCache.set(ability.ability_id, ability);
          }
        }

        console.log(
          `[INFO] ${accessibleAbilities.length} abilities available with credential coverage`,
        );
        console.log(
          `[INFO] Pre-cached ${abilityCache.size} abilities for immediate execution`,
        );
        if (availableCredentialKeys.size > 0) {
          console.log(
            `[INFO] Detected ${availableCredentialKeys.size} credential key(s) from decrypted cookie jar entries`,
          );
        }
      } catch (error: any) {
        console.error(`[ERROR] Failed to load abilities from API:`, error.message);
        console.error(`[ERROR] Make sure the Unbrowse API is accessible at https://agent.unbrowse.ai`);
      }

      isInitialized = true;
    })();

    return initializationPromise;
  };

  // Start initialization immediately in background (non-blocking)
  ensureInitialized().catch((error) => {
    console.error('[ERROR] Background initialization failed:', error);
  });

  // Tool: Execute Ability
  server.registerTool(
    "execute_ability",
    {
      title: "Execute Ability",
      description:
        "Executes a specific ability by ID with the provided parameters. Use this after searching for abilities with search_abilities.",
      inputSchema: {
        ability_id: z
          .string()
          .describe("The ability ID to execute (from search results)"),
        params: z
          .string()
          .optional()
          .describe("JSON string of parameters to pass to the ability (based on its input schema). Example: '{\"token_symbol\":\"$fdry\"}'"),
      },
    },
    async ({ ability_id, params }) => {
      try {
        await ensureInitialized();

        // Try to get ability from cache first (populated by search_abilities)
        let ability = abilityCache.get(ability_id);

        // If not in cache, fetch from API
        if (!ability) {
          console.log(`[TRACE] Ability ${ability_id} not in cache, fetching from API...`);
          const apiResponse = await apiClient.getAbility(ability_id);

          if (!apiResponse.success || !apiResponse.ability) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: false,
                      error: `Ability not found: ${ability_id}. Try searching for it first with search_abilities.`,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          ability = apiResponse.ability;
          // Cache it for next time
          abilityCache.set(ability_id, ability);
          console.log(`[TRACE] Cached ability ${ability_id} for future use`);
        } else {
          console.log(`[TRACE] Using cached ability ${ability_id}`);
        }

        console.log(
          `[TRACE] ========== Executing ability: ${ability.ability_id} ==========`,
        );
        console.log(`[TRACE] Ability metadata:`, {
          abilityId: ability.ability_id,
          abilityName: ability.ability_name,
          serviceName: ability.service_name,
          requiresDynamicHeaders: ability.requires_dynamic_headers,
          dynamicHeaderKeys: ability.dynamic_header_keys,
        });
        // Parse params from JSON string
        let payload: Record<string, any> = {};
        if (params) {
          try {
            payload = JSON.parse(params);
            console.log(`[TRACE] Parsed params:`, payload);
          } catch (error: any) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: false,
                      error: `Invalid params JSON: ${error.message}. Expected JSON string like '{"key":"value"}'`,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }
        } else {
          console.log(`[TRACE] No params provided, using empty object`);
        }

        let resolvedCredentials: Record<string, string> | null = null;

        // Check if ability actually needs dynamic headers (defensive check)
        const actuallyNeedsDynamicHeaders =
          ability.requires_dynamic_headers &&
          ability.dynamic_header_keys &&
          ability.dynamic_header_keys.length > 0;

        if (actuallyNeedsDynamicHeaders) {
          console.log(
            `[TRACE] Ability requires dynamic headers, extracting domains...`,
          );

          // Extract unique domains from dynamic header keys
          const domains = new Set<string>();
          ability.dynamic_header_keys.forEach((key: string) => {
            const domain = key.split("::")[0];
            console.log(`[TRACE] Processing header key: ${key} -> domain: ${domain}`);
            if (domain) domains.add(domain);
          });

          console.log(`[TRACE] Extracted domains:`, Array.from(domains));

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
              const creds = decryptCredentials(encryptedCreds, config.password);
              console.log(
                `[TRACE] Decrypted credentials for ${domain}:`,
                Object.keys(creds),
              );

              // Check if this credential set has all required headers
              const hasAllHeaders = ability.dynamic_header_keys.every(
                (key: string) => creds[key] !== undefined,
              );

              console.log(
                `[TRACE] Checking if all headers are present:`,
                ability.dynamic_header_keys.map((key: string) => ({
                  key,
                  present: creds[key] !== undefined,
                })),
              );

              if (hasAllHeaders) {
                resolvedCredentials = creds;
                console.log(
                  `[TRACE] ✓ Using credentials from domain ${domain} for ability ${ability.ability_id}`,
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
              `Credentials not available for ability ${ability.ability_id}. Required domains: ${requiredDomains}. Store the required headers and retry.`,
            );
          }
        } else {
          if (ability.requires_dynamic_headers && (!ability.dynamic_header_keys || ability.dynamic_header_keys.length === 0)) {
            console.warn(
              `[WARN] Ability ${ability.ability_id} marked as requiresDynamicHeaders=true but has no dynamicHeaderKeys. Treating as public API.`,
            );
          }
          console.log(`[TRACE] Ability does not require dynamic headers (executing as public API)`);
        }

        // Transform IndexedAbility to the format executeWrapper expects
        // Convert static_headers from object to array format for executeWrapper
        const staticHeadersArray = ability.static_headers
          ? Object.entries(ability.static_headers).map(([key, value]) => ({
              key: `${ability.service_name}::${key}`,
              value_code: `() => '${value.replace(/'/g, "\\'")}'`
            }))
          : [];

        // Create a wrapper data object in the format executeWrapper expects
        const wrapperData = {
          input: {
            service_name: ability.service_name,
            ability_id: ability.ability_id,
            ability_name: ability.ability_name,
            description: ability.description,
            wrapper_code: ability.wrapper_code,
            static_headers: staticHeadersArray,
            dynamic_header_keys: ability.dynamic_header_keys,
            input_schema: ability.input_schema,
            dependency_order: ability.dependency_order,
            http_method: ability.request_method,
            url: ability.request_url,
          },
          dependencies: ability.dependencies,
        };

        const result = await executeWrapper(
          ability.ability_id,
          payload,
          {},
          resolvedCredentials || {},
          wrapperData,
        );

        if (config.debug) {
          console.log(
            `[DEBUG] Execution result: ${result.success ? "SUCCESS" : "FAILED"}`,
          );
        }

        // Prepare response and truncate if needed
        const responseData = {
          success: result.success,
          statusCode: result.statusCode,
          responseBody: result.responseBody,
          responseHeaders: result.responseHeaders,
          error: result.error,
          credentialsExpired: result.credentialsExpired,
          loginAbilities: result.loginAbilities,
          executedAt: result.executedAt,
        };

        let responseText = JSON.stringify(responseData, null, 2);

        // Truncate response if it exceeds 30k characters
        const MAX_RESPONSE_LENGTH = 30000;
        if (responseText.length > MAX_RESPONSE_LENGTH) {
          const truncatedBody = typeof result.responseBody === 'string'
            ? result.responseBody.substring(0, MAX_RESPONSE_LENGTH - 1000)
            : JSON.stringify(result.responseBody).substring(0, MAX_RESPONSE_LENGTH - 1000);

          responseData.responseBody = truncatedBody + `\n\n[... Response truncated. Original length: ${responseText.length} characters, showing first ${MAX_RESPONSE_LENGTH} characters]`;
          responseText = JSON.stringify(responseData, null, 2);

          console.log(`[WARN] Response truncated from ${responseText.length} to ${MAX_RESPONSE_LENGTH} characters`);
        }

        return {
          content: [
            {
              type: "text",
              text: responseText,
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

  // Tool: Search Abilities (Credential-aware)
  server.registerTool(
    "search_abilities",
    {
      title: "Search Abilities",
      description:
        "Searches for abilities to register into tool context. Use this when user requests for something that you do not have capabilities of doing.",
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
          domainCandidates.add(ability.service_name),
        );
      }
      const availableDomains = Array.from(domainCandidates);

      if (config.debug) {
        console.log(
          `[DEBUG] Search "${query}" returned ${matches.length} abilities (limit ${resultLimit}) with ${credentialScope.length} credential hints`,
        );
      }

      // Populate the ability cache with search results
      for (const ability of matches) {
        abilityCache.set(ability.ability_id, ability);
      }
      console.log(`[INFO] Cached ${matches.length} abilities from search results`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                query,
                count: matches.length,
                message: `Found ${matches.length} matching abilities. These are now cached and ready to execute. Use execute_ability with the ability_id and params.`,
                availableDomains,
                abilities: matches.map((a) => ({
                  id: a.ability_id,
                  name: a.ability_name,
                  service: a.service_name,
                  description: formatAbilityDescription(a),
                  inputSchema: a.input_schema,
                  requiresCreds: a.requires_dynamic_headers,
                  neededCreds: a.dynamic_header_keys,
                  dependencyOrder: a.dependency_order,
                  missingDependencies:
                    a.dependencies?.missing?.map((d) => d.ability_id) || [],
                  ponScore: a.pon_score,
                  successRate: a.success_rate,
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

  return server.server;
}
