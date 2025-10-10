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
  listAbilities,
  getCookieJar,
  setCookieJar,
  formatAbilityDescription,
  getAvailableDomains,
  findLoginAbilities,
  markCredentialsExpired,
} from "./mock-endpoints-enhanced.js";
import {
  executeWrapper,
  getWrapperMetadata,
  listAvailableWrappers,
} from "./wrapper-executor-enhanced.js";

// User-level config from smithery.yaml
export const configSchema = z.object({
  debug: z.boolean().default(false).describe("Enable debug logging"),
  secret: z
    .string()
    .describe("Secret key for encrypting/decrypting credentials"),
});

export default function createServer({
  config,
}: {
  config: z.infer<typeof configSchema>; // Define your config in smithery.yaml
}) {
  const server = new McpServer({
    name: "Unbrowse MCP",
    version: "1.0.0",
  });

  // Tool: List Indexed Abilities (Private Registry)
  // Corresponds to /list endpoint serving abilities from wrapper-storage
  server.registerTool(
    "list_abilities",
    {
      title: "List Indexed Abilities",
      description:
        "Lists all indexed tools/abilities from the private registry. Filters based on user credentials and optionally by cookie domains. Each ability includes dependency order showing which abilities must be called first in sequence.",
      inputSchema: {
        userCredentials: z
          .array(z.string())
          .optional()
          .describe(
            "Array of credential keys the user has access to (e.g., ['www.hedgemony.fund::cookie'])",
          ),
        filterByDomains: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "Filter abilities to only those matching domains from available credentials",
          ),
      },
    },
    async ({ userCredentials, filterByDomains }) => {
      const abilities = await listAbilities(
        userCredentials || [],
        filterByDomains || false,
      );
      const availableDomains = getAvailableDomains();

      if (config.debug) {
        console.log(
          `[DEBUG] Listed ${abilities.length} abilities for user with ${(userCredentials || []).length} credentials`,
        );
        console.log(
          `[DEBUG] Available domains: ${availableDomains.join(", ")}`,
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                count: abilities.length,
                availableDomains,
                abilities: abilities.map((a) => ({
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

  // Tool: Get Credentials from Cookie Jar
  // Corresponds to /cookiejar GET endpoint with SECRET-based decryption
  server.registerTool(
    "get_credentials",
    {
      title: "Get Credentials from Cookie Jar",
      description:
        "Retrieves encrypted credentials for a service, decrypted using the SECRET environment variable. Returns credential key-value pairs needed for API execution.",
      inputSchema: {
        serviceName: z
          .string()
          .describe(
            "Name of the service to get credentials for (e.g., 'hedgemony-fund', 'wom-fun')",
          ),
      },
    },
    async ({ serviceName }) => {
      try {
        const credentials = await getCookieJar(serviceName, config.secret);

        if (config.debug) {
          console.log(`[DEBUG] Retrieved credentials for ${serviceName}`);
        }

        if (!credentials) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: `No credentials found for service: ${serviceName}`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  serviceName,
                  credentials,
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
                  error: error.message,
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

  // Tool: Store Credentials in Cookie Jar
  // Corresponds to /cookiejar POST endpoint with SECRET-based encryption
  server.registerTool(
    "store_credentials",
    {
      title: "Store Credentials in Cookie Jar",
      description:
        "Stores encrypted credentials for a service using the SECRET environment variable. Use this to save cookies, tokens, or other auth credentials needed for API execution.",
      inputSchema: {
        serviceName: z
          .string()
          .describe("Name of the service (e.g., 'hedgemony-fund', 'wom-fun')"),
        credentialKey: z
          .string()
          .describe(
            "Credential key (e.g., 'www.hedgemony.fund::cookie', 'authorization')",
          ),
        credentialValue: z
          .string()
          .describe("Credential value to encrypt and store"),
      },
    },
    async ({ serviceName, credentialKey, credentialValue }) => {
      try {
        await setCookieJar(
          serviceName,
          credentialKey,
          credentialValue,
          config.secret,
        );

        if (config.debug) {
          console.log(
            `[DEBUG] Stored credential ${credentialKey} for ${serviceName}`,
          );
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Credential ${credentialKey} stored for ${serviceName}`,
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
                  error: error.message,
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
      const abilities = await listAbilities([]);

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(abilities, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    },
  );

  // Tool: Execute Wrapper with Credential Injection
  // Evaluates wrapper code and injects headers from cookiejar
  server.registerTool(
    "execute_ability",
    {
      title: "Execute Ability",
      description:
        "Executes a wrapper/ability with automatic credential injection. The wrapper code is evaluated with a fetch override that injects both static headers (from wrapper definition) and dynamic headers (from encrypted cookiejar). This enables seamless API execution with authentication. On 401+ errors, credentials are automatically marked as expired and login abilities are suggested.",
      inputSchema: {
        abilityId: z
          .string()
          .describe(
            "The ability ID to execute (e.g., 'get-hedgemony-stats-simple')",
          ),
        payload: z
          .record(z.any())
          .optional()
          .describe(
            "Input payload matching the ability's input schema (e.g., {tier: 'plus'})",
          ),
        options: z
          .record(z.any())
          .optional()
          .describe(
            "Additional options like baseUrl override (e.g., {baseUrl: 'https://example.com'})",
          ),
      },
    },
    async ({ abilityId, payload, options }) => {
      try {
        if (config.debug) {
          console.log(
            `[DEBUG] Executing ability: ${abilityId} with payload:`,
            payload,
          );
        }

        const result = await executeWrapper(
          abilityId,
          payload || {},
          config.secret,
          options || {},
        );

        if (config.debug) {
          console.log(
            `[DEBUG] Execution result: ${result.success ? "SUCCESS" : "FAILED"} (${result.statusCode || "N/A"})`,
          );
          if (result.credentialsExpired) {
            console.log(
              `[DEBUG] Credentials expired. Login abilities: ${result.loginAbilities?.map((a) => a.id).join(", ")}`,
            );
          }
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

  // Prompt: Query Abilities
  // Helps agents discover and compose abilities
  server.registerPrompt(
    "discover_abilities",
    {
      title: "Discover Abilities",
      description:
        "Search for abilities in the index based on intent, with credential-aware filtering",
      argsSchema: {
        intent: z
          .string()
          .describe(
            "What you want to accomplish (e.g., 'get trading statistics', 'fetch token data')",
          ),
        userCredentials: z
          .array(z.string())
          .optional()
          .describe("Credentials you have access to"),
      },
    },
    async ({ intent, userCredentials }) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Find abilities that can help with: ${intent}. I have access to these credentials: ${(userCredentials || []).join(", ") || "none"}. Show me relevant abilities from the index with their descriptions and requirements.`,
            },
          },
        ],
      };
    },
  );

  return server.server;
}
