/**
 * Unbrowse MCP Server
 *
 * Provides access to indexed abilities from wrapper-storage and secure credential retrieval.
 * Implements dual registry system:
 *
 * Tool Registration (Private Registry):
 * - Only abilities user has credentials for are registered as MCP tools
 * - User can only execute what they have credentials for (not public abilities)
 * - Filtered by subdomain matching from credentials
 *
 * Search/Find (Searchable Registry):
 * - Public abilities: Always searchable (no credential requirement)
 * - Private abilities: Searchable if user has credentials + subdomain match (default)
 * - Optional: Can disable domain filtering to search broader
 * - Credentials are fetched separately via get_credentials (never included in list responses)
 *
 * Credential Management:
 * - Credentials are retrieved (decrypted) from wrapper-storage using SECRET key
 * - Credential storage is handled by external encrypted API (not via MCP)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  listAbilities,
  getCookieJar,
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
  userCredentials: z
    .string()
    .default("")
    .describe(
      "Comma-separated list of credential keys for private registry filtering",
    ),
  filterByDomains: z
    .boolean()
    .default(true)
    .describe("Only register tools for domains matching user credentials"),
});

export default async function createServer({
  config,
}: {
  config: z.infer<typeof configSchema>; // Define your config in smithery.yaml
}) {
  const server = new McpServer({
    name: "Unbrowse MCP",
    version: "1.0.0",
  });

  // Load and register abilities from private registry endpoint on startup
  // This filters based on user credentials and domain matching
  console.log("[INFO] Initializing Unbrowse MCP Server...");

  if (config.debug) {
    console.log("[DEBUG] Loading abilities from private registry...");
  }

  try {
    // Parse user credentials from config
    const userCredsList = config.userCredentials
      ? config.userCredentials
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    if (config.debug) {
      console.log(
        `[DEBUG] User credentials: ${userCredsList.length > 0 ? userCredsList.join(", ") : "none (public only)"}`,
      );
      console.log(`[DEBUG] Filter by domains: ${config.filterByDomains}`);
    }

    // Call private registry endpoint to get abilities user has credentials for
    // Only register tools for abilities the user can actually execute (has credentials)
    const abilities = await listAbilities(
      userCredsList,
      config.filterByDomains,
      true, // forToolRegistration=true: Only abilities with credentials (not public)
    );

    console.log(`[INFO] Loaded ${abilities.length} abilities from registry`);

    if (config.debug) {
      console.log(
        `[DEBUG] Private registry returned ${abilities.length} abilities accessible to user`,
      );
    }

    // Register each ability as a separate MCP tool
    for (const ability of abilities) {
      const toolName = ability.abilityName;
      const toolDescription = formatAbilityDescription(ability);

      // Convert JSON Schema to Zod schema for inputSchema
      const inputSchemaProps: Record<string, any> = {};

      if (ability.inputSchema?.properties) {
        for (const [key, prop] of Object.entries(
          ability.inputSchema.properties as Record<string, any>,
        )) {
          // Simple mapping of JSON Schema types to Zod
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

          // Make optional if not in required array
          if (!ability.inputSchema.required?.includes(key)) {
            zodType = zodType.optional();
          }

          // Add description if available
          if (prop.description) {
            zodType = zodType.describe(prop.description);
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
            if (config.debug) {
              console.log(
                `[DEBUG] Executing ability: ${ability.abilityId} with params:`,
                params,
              );
            }

            // Remove placeholder param if it exists
            const payload = { ...params };
            delete payload._placeholder;

            const result = await executeWrapper(
              ability.abilityId,
              payload,
              config.secret,
              {},
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
    }

    if (config.debug) {
      console.log(`[DEBUG] Registered ${abilities.length} ability tools`);
    }
  } catch (error: any) {
    console.error("[ERROR] Failed to load abilities:", error?.message || error);
    console.error(
      "[ERROR] Server will continue but dynamic abilities will not be available",
    );
    console.error(
      "[ERROR] Check that wrapper-storage directory is included in the deployment",
    );
  }

  console.log("[INFO] Server initialization complete");

  // Tool: List Indexed Abilities (Private Registry)
  // Corresponds to /list endpoint serving abilities from wrapper-storage
  server.registerTool(
    "list_abilities",
    {
      title: "List Indexed Abilities",
      description:
        "Lists abilities from the searchable registry. Public abilities are always included. Private abilities are included only if you have credentials and match subdomain filtering (default enabled). Credentials are fetched separately and never included in this response. Each ability includes dependency order showing which abilities must be called first in sequence.",
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
      // For list/search: public always + private with credentials (searchable registry)
      const abilities = await listAbilities(
        userCredentials || [],
        filterByDomains !== false, // Default true for domain filtering
        false, // forToolRegistration=false for searchable registry
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
                  neededCreds: a.dynamicHeaderKeys, // Shows what credentials are needed, but not the actual values
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
