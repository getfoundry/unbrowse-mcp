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
  createApiClient,
  formatAbilityDescription,
  UNBROWSE_API_BASE_URL,
  type IndexedAbility,
  type UnbrowseApiClient,
} from "./api-client.js";
import { decryptCredentials } from "./crypto-utils.js";
import * as Sentry from "@sentry/node"

Sentry.init({
  dsn: "https://SENTRY_DSN_REDACTED",
  // Tracing must be enabled for MCP monitoring to work
  tracesSampleRate: 1.0,
  sendDefaultPii: true,
});
// User-level config from smithery.yaml
export const configSchema = z.object({
  apiKey: z.string().optional().describe("Your Unbrowse API key from the dashboard (starts with re_). Alternative to sessionToken."),
  sessionToken: z.string().optional().describe("Your session token (alternative to apiKey)."),
  password: z.string().optional().describe("Your encryption password for credential decryption. Only required if abilities need credentials."),
  debug: z.boolean().default(false).describe("Enable debug logging"),
  enableIndexTool: z.boolean().default(false).describe("Enable the ingest_api_endpoint tool for indexing new APIs"),
}).refine(
  (data) => data.apiKey || data.sessionToken,
  {
    message: "Either apiKey or sessionToken must be provided",
    path: ["apiKey", "sessionToken"],
  }
);

export default function createServer({
  config,
}: {
  config: z.infer<typeof configSchema>; // Define your config in smithery.yaml
}) {
  console.log("[INFO] createServer called - starting initialization");

  // Apply environment variable fallbacks
  const apiKey = config.apiKey || process.env.UNBROWSE_API_KEY;
  const sessionToken = config.sessionToken || process.env.UNBROWSE_SESSION_TOKEN;
  const password = config.password || process.env.UNBROWSE_PASSWORD || process.env.UNBROWSE_CREDENTIAL_KEY;

  // Validate that at least one auth method is provided
  const authToken = apiKey || sessionToken;
  if (!authToken) {
    throw new Error(
      "Authentication required: Provide either apiKey or sessionToken via config or environment variables " +
      "(UNBROWSE_API_KEY or UNBROWSE_SESSION_TOKEN)"
    );
  }

  // Detect auth type (API keys start with "re_", session tokens don't)
  const authType = apiKey && apiKey.startsWith("re_") ? "api_key" : "session_token";
  console.log(`[INFO] Authentication type: ${authType}`);

  // Create authenticated API client
  const apiClient: UnbrowseApiClient = createApiClient(authToken);
  console.log(`[INFO] API client created with base URL: ${UNBROWSE_API_BASE_URL}`);

  const server = Sentry.wrapMcpServerWithSentry(new McpServer({
    name: "Unbrowse MCP",
    version: "1.0.0",
    capabilities: {
      tools: {
        listChanged: true, // Enable dynamic tool registration
      },
    },
  }));

  console.log("[INFO] McpServer instance created");

  const accessibleAbilities: IndexedAbility[] = [];
  const availableCredentialKeys = new Set<string>();
  const credentialCache = new Map<string, Record<string, string> | null>();

  // Ability cache - populated by search_abilities, used by execute_ability
  // Keys are abilityId (used for execution), values are full ability objects
  const abilityCache = new Map<string, IndexedAbility>();

  const sanitizeEnvSegment = (value: string): string =>
    value
      .trim()
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .toUpperCase();

  const envCredentialOverrides = (() => {
    const mapping = new Map<string, string>();
    const candidateVarNames = [
      "UNBROWSE_TOOL_HEADERS",
      "UNBROWSE_DYNAMIC_HEADERS",
      "TOOL_DYNAMIC_HEADERS",
      "MCP_TOOL_HEADERS",
    ];

    for (const varName of candidateVarNames) {
      const raw = process.env[varName];
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          for (const [rawKey, rawValue] of Object.entries(parsed)) {
            if (typeof rawKey === "string" && typeof rawValue === "string") {
              mapping.set(rawKey, rawValue);
            }
          }
        }
      } catch (error) {
        console.warn(`[WARN] Failed to parse ${varName} as JSON:`, error);
      }
    }

    return mapping;
  })();

  const getEnvCandidatesForKey = (key: string): string[] => {
    const [rawDomain = "", rawHeader = ""] = key.split("::");
    const domainSegment = sanitizeEnvSegment(rawDomain);
    const headerSegment = sanitizeEnvSegment(rawHeader);
    const combinedSegment = sanitizeEnvSegment(key.replace(/::/g, "__"));
    const domainNoWww = domainSegment.replace(/^WWW_/, "");

    const baseCandidates = new Set<string>();

    if (combinedSegment) {
      baseCandidates.add(combinedSegment);
    }

    if (domainSegment && headerSegment) {
      baseCandidates.add(`${domainSegment}__${headerSegment}`);
      baseCandidates.add(`${domainSegment}_${headerSegment}`);
      baseCandidates.add(`${domainSegment}${headerSegment ? `__${headerSegment}` : ""}`);
      baseCandidates.add(`${domainSegment}${headerSegment ? `_${headerSegment}` : ""}`);
    }

    if (domainNoWww && headerSegment) {
      baseCandidates.add(`${domainNoWww}__${headerSegment}`);
      baseCandidates.add(`${domainNoWww}_${headerSegment}`);
    }

    if (headerSegment) {
      baseCandidates.add(headerSegment);
    }

    const expanded = new Set<string>();
    const prefixes = ["UNBROWSE", "ABILITY", "TOOL", "MCP"];

    for (const candidate of baseCandidates) {
      expanded.add(candidate);
      for (const prefix of prefixes) {
        if (candidate && prefix) {
          expanded.add(`${prefix}_${candidate}`);
        }
      }
    }

    return Array.from(expanded);
  };

  const envCredentialCache = new Map<string, string | null>();

  const getEnvCredentialForKey = (key: string): string | undefined => {
    if (envCredentialCache.has(key)) {
      const cached = envCredentialCache.get(key);
      return cached === null ? undefined : cached;
    }

    let value: string | undefined;

    if (envCredentialOverrides.has(key)) {
      value = envCredentialOverrides.get(key);
    } else {
      for (const candidate of getEnvCandidatesForKey(key)) {
        const envValue = process.env[candidate];
        if (envValue !== undefined) {
          value = envValue;
          break;
        }
      }

      if (!value) {
        const [rawDomain = "", rawHeader = ""] = key.split("::");
        const domainSegment = sanitizeEnvSegment(rawDomain);
        const headerSegment = sanitizeEnvSegment(rawHeader);

        if (headerSegment === "X_API_KEY" || headerSegment === "API_KEY") {
          const apiKeyCandidates = new Set<string>();

          if (domainSegment) {
            apiKeyCandidates.add(`${domainSegment}_API_KEY`);
            apiKeyCandidates.add(`${domainSegment}__API_KEY`);
            apiKeyCandidates.add(`${domainSegment}_KEY`);
            apiKeyCandidates.add(`${domainSegment}__KEY`);
          }

          const domainNoWww = domainSegment.replace(/^WWW_/, "");
          if (domainNoWww) {
            apiKeyCandidates.add(`${domainNoWww}_API_KEY`);
            apiKeyCandidates.add(`${domainNoWww}__API_KEY`);
          }

          apiKeyCandidates.add("UNBROWSE_API_KEY");
          apiKeyCandidates.add("API_KEY");

          for (const candidate of apiKeyCandidates) {
            const envValue = process.env[candidate];
            if (envValue !== undefined) {
              value = envValue;
              break;
            }
          }
        }
      }
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        envCredentialCache.set(key, trimmed);
        return trimmed;
      }
    }

    envCredentialCache.set(key, null);
    return undefined;
  };

  const getEnvCredentialsForAbility = (ability: IndexedAbility): Record<string, string> => {
    const credentials: Record<string, string> = {};
    if (!ability.dynamic_header_keys || ability.dynamic_header_keys.length === 0) {
      return credentials;
    }

    for (const key of ability.dynamic_header_keys) {
      const value = getEnvCredentialForKey(key);
      if (value !== undefined) {
        credentials[key] = value;
      }
    }

    return credentials;
  };

  const applyEnvCredentialsToCache = (
    domain: string,
    credentials: Record<string, string>,
  ): void => {
    const variants = new Set<string>([domain, ...candidateVariantsFromDomain(domain)]);
    for (const candidate of variants) {
      const existing = credentialCache.get(candidate) || undefined;
      credentialCache.set(candidate, { ...(existing || {}), ...credentials });
    }
  };

  const groupEnvCredentialsByDomain = (
    ability: IndexedAbility,
  ): Map<string, Record<string, string>> => {
    const map = new Map<string, Record<string, string>>();
    if (!ability.dynamic_header_keys) return map;

    for (const key of ability.dynamic_header_keys) {
      const value = getEnvCredentialForKey(key);
      if (value === undefined) continue;

      const [domainPart] = key.split("::");
      if (!domainPart) continue;

      if (!map.has(domainPart)) {
        map.set(domainPart, {});
      }

      map.get(domainPart)![key] = value;
    }

    return map;
  };

  // Lazy initialization state
  let initializationPromise: Promise<void> | null = null;
  let isInitialized = false;

  // Helper function to register an ability as an MCP tool (simplified version)
  const registerAbilityAsTool = (ability: IndexedAbility): void => {
    const toolName = ability.ability_name;

    // Build description with dependency information
    let toolDescription = ability.description || "";
    if (ability.dependency_order && ability.dependency_order.length > 0) {
      toolDescription += `\n\n**Dependencies (must be called first):** ${ability.dependency_order.join(", ")}`;
    }

    // Parse input schema to create zod schema
    const inputSchemaProps: Record<string, any> = {};
    if (ability.input_schema?.properties) {
      for (const [key, prop] of Object.entries(ability.input_schema.properties as Record<string, any>)) {
        let zodType: any;
        switch ((prop as any).type) {
          case 'string': zodType = z.string(); break;
          case 'number': zodType = z.number(); break;
          case 'integer': zodType = z.number().int(); break;
          case 'boolean': zodType = z.boolean(); break;
          case 'array': zodType = z.array(z.any()); break;
          case 'object': zodType = z.record(z.any()); break;
          default: zodType = z.any();
        }

        if (!ability.input_schema.required?.includes(key)) {
          zodType = zodType.optional();
        }
        if ((prop as any).description) {
          zodType = zodType.describe((prop as any).description);
        }
        inputSchemaProps[key] = zodType;
      }
    }

    // Register the tool - execution will use execute_ability internally
    server.registerTool(
      toolName,
      {
        title: ability.ability_name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        description: toolDescription,
        inputSchema: Object.keys(inputSchemaProps).length > 0 ? inputSchemaProps : { _placeholder: z.any().optional().describe("No parameters required") },
      },
      async (params) => {
        // Forward to server-side execute_ability
        const payload = { ...params };
        delete (payload as Record<string, unknown>)._placeholder;

        try {
          // Execute ability on the server using abilityId
          console.log(`[DEBUG] Executing ability - ID: ${ability.ability_id}, Name: ${ability.ability_name}`);
          const result = await apiClient.executeAbility(ability.ability_id, payload, {
            credentialKey: password,
          });

          // Handle error responses
          if (!result.success) {
            let errorMessage = result.error || 'Execution failed';
            if (result.credentialsExpired) {
              errorMessage += '\n\nCredentials have expired. Please re-authenticate.';
            }
            if (result.defunct) {
              errorMessage += `\n\nAbility is defunct (health: ${result.healthScore}). Search for alternative.`;
            }

            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: errorMessage,
                  credentialsExpired: result.credentialsExpired,
                  defunct: result.defunct,
                  executedAt: result.result?.executedAt || new Date().toISOString(),
                }, null, 2),
              }],
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: result.success,
                statusCode: result.result?.statusCode,
                responseBody: result.result?.body,
                executedAt: result.result?.executedAt,
                executionTimeMs: result.result?.executionTimeMs,
                health: result.health,
              }, null, 2),
            }],
          };
        } catch (error: any) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: error.message || String(error),
                executedAt: new Date().toISOString(),
              }, null, 2),
            }],
          };
        }
      },
    );

    console.log(`[INFO] Registered favorite ability as tool: ${toolName}`);
  };

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
      if (!password) {
        console.warn(`[WARN] Cannot decrypt credentials for ${candidate}: no password provided`);
        credentialCache.set(candidate, null);
        return null;
      }
      const decryptedCredentials = decryptCredentials(encryptedCredentials, password);
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

    if (!ability.dynamic_header_keys || ability.dynamic_header_keys.length === 0) {
      return true;
    }

    const envCredentialsByDomain = groupEnvCredentialsByDomain(ability);
    for (const [domain, creds] of envCredentialsByDomain.entries()) {
      applyEnvCredentialsToCache(domain, creds);
    }

    for (const key of ability.dynamic_header_keys) {
      let keySatisfied = false;

      if (getEnvCredentialForKey(key) !== undefined) {
        keySatisfied = true;
      }

      if (!keySatisfied) {
        for (const candidate of deriveCandidatesForKey(ability, key)) {
          if (!candidate) continue;
          const credentials = await fetchCredentialsForCandidate(candidate);
          if (credentials && credentials[key] !== undefined) {
            keySatisfied = true;
            break;
          }
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
    return
    // initializationPromise = (async () => {
    //   // Step 1: Load favorites and register them as tools
    //   try {
    //     console.log('[INFO] Loading favorited abilities...');
    //     const favoritesResult = await apiClient.listAbilities({ favorites: true });
    //     const favoriteAbilities = favoritesResult.abilities || [];
    //     console.log(`[INFO] Found ${favoriteAbilities.length} favorited abilities`);

    //     const registeredAbilityIds = new Set<string>();
    //     let registeredCount = 0;

    //     for (const ability of favoriteAbilities) {
    //       // Skip duplicates
    //       if (registeredAbilityIds.has(ability.ability_id)) {
    //         console.log(`[DEBUG] Skipping duplicate favorite: ${ability.ability_id}`);
    //         continue;
    //       }

    //       if (await abilityHasCredentialCoverage(ability)) {
    //         accessibleAbilities.push(ability);
    //         // Cache by abilityId for execution
    //         abilityCache.set(ability.ability_id, ability);

    //         // Register as individual MCP tool
    //         try {
    //           registerAbilityAsTool(ability);
    //           registeredAbilityIds.add(ability.ability_id);
    //           registeredCount++;
    //         } catch (error: any) {
    //           console.error(`[ERROR] Failed to register ${ability.ability_id}:`, error.message);
    //         }
    //       }
    //     }

    //     console.log(`[INFO] Registered ${registeredCount} favorite abilities as tools`);

    //     // Notify MCP client that tools have been added
    //     // We need to wait for the client to connect before sending the notification
    //     if (registeredCount > 0) {
    //       // Poll until client is connected, then send notification
    //       const waitForConnection = async () => {
    //         const maxWaitTime = 30000; // 30 seconds max
    //         const pollInterval = 100; // Check every 100ms
    //         const startTime = Date.now();

    //         while (!server.isConnected()) {
    //           if (Date.now() - startTime > maxWaitTime) {
    //             console.warn('[WARN] Client did not connect within 30 seconds, notification not sent');
    //             return;
    //           }
    //           await new Promise(resolve => setTimeout(resolve, pollInterval));
    //         }

    //         // Client is now connected, send notification
    //         server.sendToolListChanged();
    //         console.log('[INFO] Client connected, sent tools/list_changed notification');
    //       };

    //       // Don't await - let this run in background
    //       waitForConnection().catch(error => {
    //         console.error('[ERROR] Failed to send tool list changed notification:', error);
    //       });
    //     }
    //   } catch (error: any) {
    //     console.error(`[ERROR] Failed to load favorites:`, error.message);
    //   }

    //   // Step 2: Fetch all abilities from the API to populate the accessible abilities list
    //   // Pre-populate the cache with all abilities that have credential coverage
    //   try {
    //     const result = await apiClient.listAbilities();
    //     const candidateAbilities = result.abilities || [];
    //     console.log(
    //       `[INFO] Loaded ${candidateAbilities.length} abilities from API (available for search)`,
    //     );

    //     // Store them for credential coverage checking AND cache them
    //     // Skip abilities already added from favorites
    //     for (const ability of candidateAbilities) {
    //       // Skip if already cached (from favorites)
    //       if (abilityCache.has(ability.ability_id)) {
    //         continue;
    //       }

    //       if (await abilityHasCredentialCoverage(ability)) {
    //         accessibleAbilities.push(ability);
    //         abilityCache.set(ability.ability_id, ability);
    //       }
    //     }

    //     console.log(
    //       `[INFO] ${accessibleAbilities.length} abilities available with credential coverage`,
    //     );
    //     console.log(
    //       `[INFO] Pre-cached ${abilityCache.size} abilities for immediate execution`,
    //     );
    //     if (availableCredentialKeys.size > 0) {
    //       console.log(
    //         `[INFO] Detected ${availableCredentialKeys.size} credential key(s) from decrypted cookie jar entries`,
    //       );
    //     }
    //   } catch (error: any) {
    //     console.error(`[ERROR] Failed to load abilities from API:`, error.message);
    //     console.error(`[ERROR] Make sure the Unbrowse API is accessible at ${UNBROWSE_API_BASE_URL}`);
    //     console.error(`[ERROR] Verify your API key is valid and not expired`);
    //   }

    //   isInitialized = true;
    // })();

    // return initializationPromise;
  };

  // Tool: Execute Ability
  server.registerTool(
    "execute_ability",
    {
      title: "Execute Ability",
      description:
        "Executes a specific ability by abilityId with the provided parameters. This is always using a stringified json input for params.",
      inputSchema: {
        ability_id: z
          .string()
          .describe("The abilityId to execute (from search results or list_abilities)."),
        params: z
          .union([z.string(), z.record(z.any())])
          .optional()
          .describe("Parameters to pass to the ability (based on its input schema). Prefers to be a JSON string not an object. Example string: '{\"token_symbol\": \"$fdry\", \"limit\": 10}' or object: {\"token_symbol\": \"$fdry\", \"limit\": 10}."),
        transform_code: z
          .string()
          .optional()
          .describe(`Optional JavaScript code to transform/process the API response body.

CRITICAL: The data parameter is ALREADY A PARSED JAVASCRIPT OBJECT. Do NOT use JSON.parse() - it will fail!

The transform function receives ONLY the parsed response body from the API (the 'responseBody' field), NOT the entire execution result wrapper.

For example, if the execution returns:
{
  "success": true,
  "statusCode": 200,
  "responseBody": { "results": [...], "total": 100 },
  ...
}

Your transform function receives the ALREADY-PARSED object: { "results": [...], "total": 100 }

CORRECT transform examples:

1. Extract array from nested results:
(data) => data.results

2. Filter and map array items:
(data) => data.results.map(item => ({ name: item.user_name, image: item.profile_image_url }))

3. Aggregate/summarize data:
(data) => ({ total: data.results.length, avgPrice: data.results.reduce((sum, item) => sum + item.price, 0) / data.results.length })

4. Search/filter results:
(data) => data.results.filter(item => item.status === 'active' && item.price > 100)

5. Extract nested fields:
(data) => data.results.map(r => r.metadata.id)

INCORRECT examples (DO NOT DO THIS):
❌ (data) => JSON.parse(data).results  // WRONG - data is already an object, not a string!
❌ (data) => JSON.parse(data)  // WRONG - will throw "[object Object] is not valid JSON"

The code is executed in a safe sandbox and must be a valid arrow function or function expression.`),
      },
    },
    async ({ ability_id, params, transform_code }) => {
      try {
        // await ensureInitialized();

        console.log(`[TRACE] execute_ability tool called with ability_id: ${ability_id}`);
        console.log(`[TRACE] Executing ability ${ability_id} on server...`);

        // Parse params to object (handle both string and object input)
        const payload: Record<string, any> = params
          ? (typeof params === 'string' ? JSON.parse(params) : params)
          : {};
        console.log(`[TRACE] Params:`, payload);

        // Execute ability on the server with credential key from config
        // According to MCP_EXECUTION_GUIDE.md, password is the credential key
        const result = await apiClient.executeAbility(ability_id, payload, {
          transformCode: transform_code,
          credentialKey: password,
        });

        if (config.debug) {
          console.log(
            `[DEBUG] Execution result: ${result.success ? "SUCCESS" : "FAILED"}`,
          );
        }

        // Handle error responses
        if (!result.success) {
          let errorMessage = result.error || 'Execution failed';

          if (result.credentialsExpired) {
            errorMessage += '\n\nCredentials have expired. Please re-authenticate with the service.';
          }

          if (result.defunct) {
            errorMessage += `\n\nThis ability has been marked as defunct (health score: ${result.healthScore}). Please search for an alternative.`;
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: errorMessage,
                    credentialsExpired: result.credentialsExpired,
                    defunct: result.defunct,
                    healthScore: result.healthScore,
                    executedAt: result.result?.executedAt || new Date().toISOString(),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // Prepare success response with health information
        const responseData = {
          // success: result.success,
          // statusCode: result.result?.statusCode,
          abilityName: result.result?.abilityName,
          domain: result.result?.domain,
          responseBody: result.result?.body,
          // executedAt: result.result?.executedAt,
          // executionTimeMs: result.result?.executionTimeMs,
          transformed: transform_code ? true : false,
          // health: result.health,
        };

        let responseText = JSON.stringify(responseData, null, 2);

        // Truncate response if it exceeds 30k characters
        const MAX_RESPONSE_LENGTH = 30000;
        if (responseText.length > MAX_RESPONSE_LENGTH) {
          const truncatedBody = typeof result.result?.body === 'string'
            ? result.result.body.substring(0, MAX_RESPONSE_LENGTH - 1000)
            : JSON.stringify(result.result?.body).substring(0, MAX_RESPONSE_LENGTH - 1000);

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

  // Tool: Execute Multiple Abilities in Parallel
  server.registerTool(
    "execute_abilities",
    {
      title: "Execute Multiple Abilities in Parallel",
      description:
        "Executes multiple abilities simultaneously in parallel using Promise.all. Useful for batch operations like fetching multiple pages of a paginated API, or fetching data from multiple different APIs at once. Unlike execute_ability_chain (which runs sequentially with output piping), this runs all abilities independently and concurrently.",
      inputSchema: {
        abilities: z
          .array(
            z.object({
              ability_id: z.string().describe("The abilityId to execute"),
              params: z
                .union([z.string(), z.record(z.any())])
                .optional()
                .describe("Parameters to pass to this ability. Can be JSON string or object."),
              transform_code: z
                .string()
                .optional()
                .describe("Optional JavaScript transform code for this ability's response"),
            })
          )
          .min(1)
          .describe(`Array of abilities to execute in parallel. Each executes independently with no data sharing.

Common use cases:

1. **Pagination**: Fetch multiple pages of an API simultaneously
   Example:
   [
     { "ability_id": "github_search", "params": { "query": "react", "page": 1 } },
     { "ability_id": "github_search", "params": { "query": "react", "page": 2 } },
     { "ability_id": "github_search", "params": { "query": "react", "page": 3 } }
   ]

2. **Multiple APIs**: Fetch from different services at once
   Example:
   [
     { "ability_id": "github_user_profile", "params": { "username": "octocat" } },
     { "ability_id": "twitter_user_profile", "params": { "username": "octocat" } }
   ]

3. **Batch Operations**: Execute same ability with different inputs
   Example:
   [
     { "ability_id": "stock_price", "params": { "symbol": "AAPL" } },
     { "ability_id": "stock_price", "params": { "symbol": "GOOGL" } },
     { "ability_id": "stock_price", "params": { "symbol": "MSFT" } }
   ]`),
        aggregate_results: z
          .boolean()
          .optional()
          .default(false)
          .describe("If true, attempts to merge all successful results into a single array. Useful for pagination where each response has the same structure."),
      },
    },
    async ({ abilities, aggregate_results }) => {
      try {
        console.log(`[TRACE] execute_abilities tool called with ${abilities.length} abilities`);

        // Execute all abilities in parallel using Promise.allSettled
        const startTime = Date.now();
        const results = await Promise.allSettled(
          abilities.map(async ({ ability_id, params, transform_code }) => {
            // Parse params to object (handle both string and object input)
            const payload: Record<string, any> = params
              ? (typeof params === 'string' ? JSON.parse(params) : params)
              : {};

            console.log(`[TRACE] Executing ${ability_id} with params:`, payload);

            // Execute ability on the server
            const result = await apiClient.executeAbility(ability_id, payload, {
              transformCode: transform_code,
              credentialKey: password,
            });

            return {
              ability_id,
              params: payload,
              result,
            };
          })
        );
        const totalTime = Date.now() - startTime;

        // Separate successful and failed executions
        const successful = results
          .filter((r) => r.status === 'fulfilled' && r.value.result.success)
          .map((r) => (r as PromiseFulfilledResult<any>).value);

        const failed = results
          .map((r, idx) => {
            if (r.status === 'rejected') {
              return {
                ability_id: abilities[idx].ability_id,
                params: abilities[idx].params,
                error: r.reason?.message || String(r.reason),
                type: 'exception',
              };
            }
            if (r.status === 'fulfilled' && !r.value.result.success) {
              return {
                ability_id: r.value.ability_id,
                params: r.value.params,
                error: r.value.result.error || 'Execution failed',
                credentialsExpired: r.value.result.credentialsExpired,
                defunct: r.value.result.defunct,
                type: 'failed',
              };
            }
            return null;
          })
          .filter(Boolean);

        console.log(
          `[INFO] Parallel execution completed: ${successful.length} succeeded, ${failed.length} failed, ${totalTime}ms total`
        );

        // Prepare response
        const response: any = {
          success: failed.length === 0,
          total: abilities.length,
          successful: successful.length,
          failed: failed.length,
          totalExecutionTimeMs: totalTime,
        };

        // Handle aggregation if requested
        if (aggregate_results && successful.length > 0) {
          try {
            // Attempt to merge all responseBody arrays
            const aggregated: any[] = [];
            let aggregationSucceeded = true;

            for (const exec of successful) {
              const body = exec.result.result?.body;

              // Check if body is an array
              if (Array.isArray(body)) {
                aggregated.push(...body);
              } else if (body && typeof body === 'object') {
                // Try to find an array property (common patterns: results, data, items, etc.)
                const arrayProp = Object.keys(body).find(key => Array.isArray(body[key]));
                if (arrayProp) {
                  aggregated.push(...body[arrayProp]);
                } else {
                  // Can't aggregate non-array responses
                  aggregationSucceeded = false;
                  break;
                }
              } else {
                aggregationSucceeded = false;
                break;
              }
            }

            if (aggregationSucceeded) {
              response.aggregatedResults = aggregated;
              response.aggregatedCount = aggregated.length;
              response.note = `Successfully aggregated ${aggregated.length} items from ${successful.length} abilities`;
            } else {
              response.note = 'Aggregation requested but responses are not compatible (not all arrays)';
            }
          } catch (error: any) {
            console.warn(`[WARN] Aggregation failed: ${error.message}`);
            response.note = `Aggregation failed: ${error.message}`;
          }
        }

        // Include individual results
        response.results = successful.map((exec) => ({
          abilityId: exec.ability_id,
          abilityName: exec.result.result?.abilityName,
          domain: exec.result.result?.domain,
          statusCode: exec.result.result?.statusCode,
          responseBody: exec.result.result?.body,
          executionTimeMs: exec.result.result?.executionTimeMs,
        }));

        // Include failures if any
        if (failed.length > 0) {
          response.failures = failed;
        }

        // Truncate if response is too large
        let responseText = JSON.stringify(response, null, 2);
        const MAX_RESPONSE_LENGTH = 30000;

        if (responseText.length > MAX_RESPONSE_LENGTH) {
          // Try to truncate individual result bodies
          const truncatedResponse = { ...response };
          truncatedResponse.results = response.results.map((r: any) => {
            const bodyStr = JSON.stringify(r.responseBody);
            if (bodyStr.length > 5000) {
              return {
                ...r,
                responseBody: `[Truncated - original length: ${bodyStr.length} chars]`,
              };
            }
            return r;
          });

          if (response.aggregatedResults) {
            truncatedResponse.aggregatedResults = `[${response.aggregatedCount} items - truncated for display]`;
          }

          responseText = JSON.stringify(truncatedResponse, null, 2);
          response.truncated = true;
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
        console.error(`[ERROR] Parallel execution failed:`, error);
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
                2
              ),
            },
          ],
        };
      }
    }
  );

  // Tool: Execute Ability Chain (Workflow)
  server.registerTool(
    "execute_ability_chain",
    {
      title: "Execute Ability Chain",
      description:
        "Executes multiple abilities in sequence (pipeline/chain), where the output of one ability becomes the input to the next. Successful chains automatically create reusable workflow abilities.",
      inputSchema: {
        chain: z
          .string()
          .describe(`JSON array defining the chain of abilities to execute in sequence.

Structure:
[
  {
    "abilityId": "ability-1",
    "params": { /* parameters for first ability */ },
    "outputMapping": { "output.field": "input.field" }  // Optional: map output to next input
  },
  {
    "abilityId": "ability-2",
    "params": { /* base parameters */ }
  }
]

Features:
- Output of ability N is passed as input to ability N+1
- Use outputMapping to map specific fields (dot notation supported)
- Without outputMapping, entire output is merged with next step's params
- Maximum 10 abilities per chain
- Successful chains auto-create reusable workflow abilities

Example:
[
  {
    "abilityId": "twitter-search",
    "params": { "query": "AI agents", "count": 5 },
    "outputMapping": { "tweets.0.id": "tweetId" }
  },
  {
    "abilityId": "twitter-get-details",
    "params": {}
  }
]`),
        stop_on_error: z
          .boolean()
          .optional()
          .default(true)
          .describe("Stop chain execution if any step fails. Default: true. Set to false to execute all steps and get partial results."),
        transform_code: z
          .string()
          .optional()
          .describe("Optional JavaScript code to transform the final output (applied to last successful step's result)."),
      },
    },
    async ({ chain, stop_on_error, transform_code }) => {
      try {
        console.log(`[TRACE] execute_ability_chain tool called`);

        // Parse chain string to array
        const chainArray = JSON.parse(chain);
        console.log(`[TRACE] Chain length: ${chainArray.length} steps`);

        // Execute chain on the server
        const response = await fetch(`${UNBROWSE_API_BASE_URL}/my/abilities/chain/execute`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'X-Credential-Key': password || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chain: chainArray,
            stopOnError: stop_on_error,
            transformCode: transform_code,
          }),
        });

        const result = await response.json();

        if (config.debug) {
          console.log(`[DEBUG] Chain execution result: ${result.success ? "SUCCESS" : "FAILED"}`);
          console.log(`[DEBUG] Steps completed: ${result.stepsCompleted}/${result.stepsTotal}`);
        }

        // Format response
        if (!result.success) {
          const failedSteps = result.results?.filter((r: any) => !r.success) || [];
          const errorDetails = failedSteps.map((step: any) =>
            `- Step ${step.abilityId}: ${step.error || 'Unknown error'}`
          ).join('\n');

          return {
            content: [
              {
                type: "text",
                text: `Chain execution failed:\n\n${errorDetails}\n\nCompleted: ${result.stepsCompleted}/${result.stepsTotal} steps\nTotal time: ${result.totalExecutionTimeMs}ms`,
              },
            ],
            isError: true,
          };
        }

        // Success
        let responseText = `✅ Chain executed successfully!\n\n`;
        responseText += `📊 Results:\n`;
        responseText += `- Steps completed: ${result.stepsCompleted}/${result.stepsTotal}\n`;
        responseText += `- Total execution time: ${result.totalExecutionTimeMs}ms\n`;

        if (result.workflowAbilityId) {
          responseText += `\n🎉 Workflow ability auto-created!\n`;
          responseText += `- Workflow ID: ${result.workflowAbilityId}\n`;
          responseText += `- This chain is now reusable as a single ability\n`;
          responseText += `- Execute it with: execute_ability(ability_id="${result.workflowAbilityId}")\n`;
        }

        responseText += `\n📦 Final Output:\n${JSON.stringify(result.finalOutput, null, 2)}`;

        // Include step-by-step results if debugging
        if (config.debug && result.results) {
          responseText += `\n\n🔍 Step Details:\n`;
          result.results.forEach((step: any, idx: number) => {
            responseText += `\nStep ${idx + 1} (${step.abilityId}):\n`;
            responseText += `  Status: ${step.success ? '✅ Success' : '❌ Failed'}\n`;
            responseText += `  Time: ${step.executionTimeMs}ms\n`;
            if (!step.success && step.error) {
              responseText += `  Error: ${step.error}\n`;
            }
          });
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
        console.error(`[ERROR] Chain execution failed:`, error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to execute chain: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: Ingest API Endpoint (conditionally registered based on config)
  if (config.enableIndexTool) {
    console.log("[INFO] Index tool enabled via config.enableIndexTool");
    server.registerTool(
      "ingest_api_endpoint",
      {
        title: "Index API",
        description:
          "Index any url or cURL request for future usage.",
        inputSchema: {
          input: z
            .string()
            .describe("API URL or complete curl command. Examples:\n- 'https://api.github.com/users/octocat'\n- 'curl -X POST https://api.example.com/users -H \"Content-Type: application/json\" -d {\"name\":\"John\"}'"),
          service_name: z
            .string()
            .describe("Service name for grouping (e.g., 'github', 'stripe', 'openai')"),
          ability_name: z
            .string()
            .optional()
            .describe("Custom ability name (auto-generated from URL if not provided)"),
          description: z
            .string()
            .optional()
            .describe("Description of what this endpoint does (auto-generated if not provided)"),
        },
      },
      async ({ input, service_name, ability_name, description }) => {
      try {
        console.log(`[TRACE] Ingesting API endpoint: ${input}`);

        // Call the ingest API endpoint with authentication
        const response = await fetch(`${UNBROWSE_API_BASE_URL}/ingest/api`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input,
            service_name,
            ability_name,
            description,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: errorData.error || `API ingestion failed: ${response.status} ${response.statusText}`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const result = await response.json();

        console.log(`[INFO] Successfully ingested API endpoint: ${result.ability_id}`);

        // Add the newly ingested ability to the cache and permanent storage
        if (result.success && result.ability_id) {
          // Fetch the full ability data and add to cache
          try {
            const abilityResponse = await apiClient.getAbility(result.ability_id);
            if (abilityResponse.success && abilityResponse.ability) {
              const ability = abilityResponse.ability;
              abilityCache.set(ability.ability_id, ability);

              // Also add to accessibleAbilities array (permanent storage)
              const existingIndex = accessibleAbilities.findIndex(
                (a) => a.ability_id === ability.ability_id
              );
              if (existingIndex === -1) {
                accessibleAbilities.push(ability);
              } else {
                accessibleAbilities[existingIndex] = ability;
              }

              console.log(`[INFO] Cached newly ingested ability: ${ability.ability_id}`);
              console.log(`[INFO] Total accessible abilities: ${accessibleAbilities.length}`);
            }
          } catch (error: any) {
            console.warn(`[WARN] Failed to cache ingested ability: ${error.message}`);
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: result.success,
                  message: result.message,
                  ability_id: result.ability_id,
                  ability_name: result.ability_name,
                  input_schema: result.input_schema,
                  output_schema: result.output_schema,
                  note: "This ability is now available for execution via execute_ability tool",
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        console.error(`[ERROR] API ingestion failed:`, error);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: error.message || String(error),
                },
                null,
                2
              ),
            },
          ],
        };
      }
    },
    );
  } else {
    console.log("[INFO] Index tool disabled (set enableIndexTool=true in smithery.yaml to enable)");
  }

  // Tool: Search Abilities (Credential-aware)
  server.registerTool(
    "search_abilities",
    {
      title: "Search Abilities",
      description:
        "Searches for abilities across both your personal abilities and the global published index. Use this when user requests for something that you do not have capabilities of doing.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe(
            `Detailed natural language description of the capability or action needed. Format your query with comprehensive context including: purpose, use cases, parameters (with types and defaults), concrete examples with parameter values, and related queries it can fulfill. Be explicit about what data is returned and how it relates to other abilities.

Examples of well-formatted queries:

"Retrieves a paginated list of processed invoices from Zeemart's invoice management service, sorted by invoice date in descending order."

"Retrieves detailed information for a specific Statement of Account (SOA) by its ID for a given company from Zeemart's payment management service."

For simpler searches, you can use shorter queries like 'create trade', 'fetch token prices', or 'send email notification', but detailed queries following the format above will yield better-matched abilities with clearer usage instructions.`,
          ),
        domains: z
          .array(z.string())
          .optional()
          .describe(
            `Optional array of domains to filter results. Only abilities from these domains will be returned. This filtering happens at the Infraxa vector database level for optimal performance. Examples: ["api.github.com", "github.com"], ["api.stripe.com"], ["twitter.com", "x.com"]`,
          ),
      },
    },
    async ({ query, domains }) => {
      // Ensure abilities are loaded
      // await ensureInitialized();

      const resultLimit = 20;

      // Search abilities using server-side Infraxa vector search with optional domain filtering
      const result = await apiClient.searchAbilities(query, resultLimit, domains);
      const matches = result.abilities;
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
          `[DEBUG] Search "${query}" returned ${matches.length} abilities (limit ${resultLimit}), available domains: ${availableDomains.length}`,
        );
      }

      // Populate the ability cache with search results using abilityId
      for (const ability of matches) {
        abilityCache.set(ability.ability_id, ability);

        // Also add to accessibleAbilities array if not already present (permanent storage)
        const existingIndex = accessibleAbilities.findIndex(
          (a) => a.ability_id === ability.ability_id
        );
        if (existingIndex === -1) {
          accessibleAbilities.push(ability);
        } else {
          // Update existing ability with latest data
          accessibleAbilities[existingIndex] = ability;
        }
      }
      console.log(`[INFO] Cached ${matches.length} abilities from search results`);
      console.log(`[INFO] Total accessible abilities: ${accessibleAbilities.length}`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                query,
                count: matches.length,
                message: `Found ${matches.length} matching abilities. These are now cached and ready to execute. Use execute_ability with the abilityId and params.`,
                availableDomains,
                results: matches.map((a) => ({
                  abilityId: a.ability_id,
                  abilityName: a.ability_name,
                  serviceName: a.service_name,
                  domain: a.domain,
                  description: formatAbilityDescription(a),
                  inputSchema: a.input_schema,
                  outputSchema: a.output_schema,
                  dynamicHeadersRequired: a.requires_dynamic_headers,
                  dynamicHeaderKeys: a.dynamic_header_keys,
                  healthScore: a.health_score,
                  dependencyOrder: a.dependency_order,
                  missingDependencies:
                    a.dependencies?.missing?.map((d) => d.ability_id) || [],
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

  // Start background initialization - loads abilities for search/execute
  // Note: autoRegisterFavorites is deprecated and removed since we can't block synchronously
  // Users should use search_abilities to discover abilities, then execute_ability to run them
  // ensureInitialized().catch((error) => {
  //   console.error('[ERROR] Background initialization failed:', error);
  // });

  return server.server;
}
