/**
 * Enhanced Wrapper Execution Engine for Unbrowse MCP
 *
 * Enhancements:
 * - 401+ error detection and credential expiration
 * - Automatic login ability suggestions
 * - Dependency order validation
 */

import type { UnbrowseApiClient } from "./api-client.js";
import vm from "vm";
import { ProxyAgent } from "undici";

/**
 * Interface for wrapper execution result
 */
export interface WrapperExecutionResult {
  success: boolean;
  statusCode?: number;
  responseBody?: any;
  responseHeaders?: Record<string, string>;
  error?: string;
  credentialsExpired?: boolean;
  loginAbilities?: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  executedAt: string;
}

interface WrapperData {
  input: {
    session_id?: string;
    service_name: string;
    ability_id: string;
    ability_name: string;
    description?: string;
    wrapper_code: string;
    static_headers: Array<{
      key: string;
      value_code: string;
    }>;
    dynamic_header_keys: string[];
    input_schema: any;
    dependency_order?: string[];
    http_method?: string;
    url?: string;
    test_inputs?: any;
  };
  dependencies?: {
    missing?: Array<{
      ability_id: string;
      ability_name: string;
      reference: string;
    }>;
  };
  schemas?: {
    input?: any;
    output?: any;
  };
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Creates a fetch override function that injects headers from provided credentials
 * and optionally uses a proxy from environment variables
 */
function createFetchOverride(
  serviceName: string,
  staticHeaders: Array<{ key: string; value_code: string }>,
  dynamicHeaderKeys: string[],
  injectedCredentials: Record<string, string>,
) {
  // Create ProxyAgent if proxy URL is configured in environment
  const proxyUrl = process.env['PROXY_URL'];
  const proxyAgent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

  if (proxyAgent) {
    console.log(`[INFO] Using proxy: ${proxyUrl.replace(/:[^:@]+@/, ':****@')}`);
  }

  return async function overriddenFetch(
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> {
    // Use injected credentials directly (already filtered by endpoint)
    const dynamicHeaders: Record<string, string> = injectedCredentials;

    // Evaluate static headers
    const evaluatedStaticHeaders: Record<string, string> = {};
    for (const header of staticHeaders) {
      try {
        const headerName = header.key.split("::")[1];
        if (headerName) {
          // Use Function constructor instead of eval for bundler compatibility
          // value_code format: "() => 'value'"
          const evalFn = new Function(`return (${header.value_code})`)();
          evaluatedStaticHeaders[headerName] = evalFn();
        }
      } catch (error) {
        console.warn(
          `[WARN] Failed to evaluate static header ${header.key}:`,
          error,
        );
      }
    }

    // Extract header names from dynamic header keys
    const dynamicHeaderNames: Record<string, string> = {};
    for (const key of dynamicHeaderKeys) {
      const headerName = key.split("::")[1];
      if (headerName && dynamicHeaders[key]) {
        dynamicHeaderNames[headerName] = dynamicHeaders[key];
      }
    }

    // Merge headers
    const mergedHeaders = {
      ...evaluatedStaticHeaders,
      ...dynamicHeaderNames,
      ...((init?.headers as Record<string, string>) || {}),
    };

    const newInit: RequestInit = {
      ...init,
      headers: mergedHeaders,
      // Add proxy dispatcher if configured
      ...(proxyAgent ? { dispatcher: proxyAgent } : {}),
    };

    return fetch(url, newInit);
  };
}

/**
 * Executes a wrapper with credential injection and 401+ error handling
 */
export async function executeWrapper(
  abilityId: string,
  payload: Record<string, any>,
  options: Record<string, any> = {},
  injectedCredentials: Record<string, string> = {},
  providedWrapperData?: WrapperData,
  secret?: string,
  apiClient: UnbrowseApiClient | null = null,
): Promise<WrapperExecutionResult> {
  const executedAt = new Date().toISOString();

  try {
    let wrapperData: WrapperData;

    // Use provided wrapper data if available (from cache), otherwise fetch from API
    if (providedWrapperData) {
      console.log(`[TRACE] Using provided wrapper data for: ${abilityId}`);
      wrapperData = providedWrapperData;
    } else {
      if (!apiClient) {
        return {
          success: false,
          error: `API client is required to fetch wrapper data for ${abilityId}`,
          executedAt,
        };
      }

      console.log(`[TRACE] Fetching wrapper data from API for: ${abilityId}`);

      // Fetch wrapper data from API instead of local storage
      const apiResponse = await apiClient.getAbility(abilityId);

      console.log(`[TRACE] ========== FULL API RESPONSE ==========`);
      console.log(JSON.stringify(apiResponse, null, 2));
      console.log(`[TRACE] ==========================================`);

      if (!apiResponse.success || !apiResponse.wrapper) {
        return {
          success: false,
          error: `Ability not found: ${abilityId}`,
          executedAt,
        };
      }

      wrapperData = apiResponse.wrapper;
    }

    console.log(`[TRACE] ========== WRAPPER DATA STRUCTURE ==========`);
    console.log(JSON.stringify(wrapperData, null, 2));
    console.log(`[TRACE] ===============================================`);

    const {
      service_name,
      wrapper_code,
      static_headers,
      dynamic_header_keys,
      dependency_order,
    } = wrapperData.input;

    console.log(`[TRACE] Extracted wrapper code starts with:`, wrapper_code.substring(0, 100));

    // Check for missing dependencies
    if (
      wrapperData.dependencies?.missing &&
      wrapperData.dependencies.missing.length > 0
    ) {
      const missingDeps = wrapperData.dependencies.missing
        .map((d) => d.ability_id)
        .join(", ");
      return {
        success: false,
        error: `Missing dependencies: ${missingDeps}. Execute these abilities first.`,
        executedAt,
      };
    }

    // Create fetch override with header injection using provided credentials
    const fetchOverride = createFetchOverride(
      service_name,
      static_headers,
      dynamic_header_keys,
      injectedCredentials,
    );

    // Create sandbox context with access to process.env and secret
    const sandbox = {
      fetch: fetchOverride,
      console,
      URL,
      Error,
      Response,
      Headers,
      Request,
      Buffer,
      process: {
        env: {
          ...process.env,
          ...(secret ? { SECRET: secret } : {}),
        },
      },
    };

    const context = vm.createContext(sandbox);

    // Strip ES6 export keywords since we're executing in a VM context
    // The wrapper function will be available in the sandbox scope
    let cleanedCode = wrapper_code
      .replace(/export\s+async\s+function/g, 'async function')
      .replace(/export\s+function/g, 'function')
      .replace(/export\s+const/g, 'const')
      .replace(/export\s+let/g, 'let')
      .replace(/export\s+var/g, 'var');

    // Wrap in IIFE to execute and capture the wrapper function
    const moduleWrapper = `
      (function() {
        ${cleanedCode}
        return wrapper;
      })()
    `;

    console.log(`[TRACE] Executing wrapper code (exports stripped)`);

    // Execute wrapper code
    const script = new vm.Script(moduleWrapper);
    const wrapperFn = script.runInContext(context);

    if (!wrapperFn || typeof wrapperFn !== "function") {
      return {
        success: false,
        error: "Wrapper function not found in wrapper code",
        executedAt,
      };
    }

    // Execute wrapper
    const response: Response = await wrapperFn(payload, options);

    const statusCode = response.status;
    const ok = response.ok;

    // Handle 401+ errors (authentication/authorization failures)
    if (statusCode >= 401 && statusCode < 500) {
      // Mark credentials as expired via API (if apiClient is available)
      if (apiClient) {
        try {
          await apiClient.expireCredentials(service_name);
        } catch (error: any) {
          console.error(`[ERROR] Failed to expire credentials for ${service_name}:`, error.message);
        }
      }

      // Find login abilities for this service via API search
      let loginAbilities: Array<{ id: string; name: string; description: string }> = [];
      if (apiClient) {
        try {
          const searchResult = await apiClient.searchAbilities(`login ${service_name}`);
          loginAbilities = searchResult.abilities
            .filter(a => !a.requires_dynamic_headers)
            .map(a => ({
              id: a.ability_id,
              name: a.ability_name,
              description: a.description,
            }));
        } catch (error: any) {
          console.error(`[ERROR] Failed to find login abilities for ${service_name}:`, error.message);
        }
      }

      let errorMessage = `Authentication failed (${statusCode}). Credentials marked as expired.`;

      if (loginAbilities.length > 0) {
        errorMessage += ` Please authenticate using one of these login abilities: ${loginAbilities.map((a) => a.id).join(", ")}`;
      }

      return {
        success: false,
        statusCode,
        error: errorMessage,
        credentialsExpired: true,
        loginAbilities,
        executedAt,
      };
    }

    // Get response body
    let responseBody: any;
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      responseBody = await response.json();
    } else if (contentType.includes("text/")) {
      responseBody = await response.text();
    } else {
      responseBody = await response.text();
    }

    // Extract response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      success: ok,
      statusCode,
      responseBody,
      responseHeaders,
      executedAt,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || String(error),
      executedAt,
    };
  }
}

/**
 * Lists available wrappers
 */
export async function listAvailableWrappers(apiClient: UnbrowseApiClient): Promise<string[]> {
  try {
    // Fetch from API instead of local storage
    const result = await apiClient.listAbilities();
    return result.abilities.map((a) => a.ability_id);
  } catch (error) {
    console.error("Error listing wrappers:", error);
    return [];
  }
}

/**
 * Gets wrapper metadata including dependency order
 */
export async function getWrapperMetadata(
  abilityId: string,
  apiClient: UnbrowseApiClient
): Promise<{
  serviceName: string;
  abilityName: string;
  description: string;
  inputSchema: any;
  staticHeaders: number;
  dynamicHeaderKeys: string[];
  requiresCreds: boolean;
  dependencyOrder: string[];
  dependencies?: {
    missing?: Array<{
      ability_id: string;
      ability_name: string;
      reference: string;
    }>;
  };
} | null> {
  try {
    // Fetch from API instead of local storage
    const apiResponse = await apiClient.getAbility(abilityId);

    if (!apiResponse.success || !apiResponse.wrapper) {
      return null;
    }

    const wrapperData: WrapperData = apiResponse.wrapper;

    return {
      serviceName: wrapperData.input.service_name,
      abilityName: wrapperData.input.ability_name,
      description: wrapperData.input.description || "",
      inputSchema: wrapperData.input.input_schema,
      staticHeaders: wrapperData.input.static_headers.length,
      dynamicHeaderKeys: wrapperData.input.dynamic_header_keys,
      requiresCreds: wrapperData.input.dynamic_header_keys.length > 0,
      dependencyOrder: wrapperData.input.dependency_order || [],
      dependencies: wrapperData.dependencies,
    };
  } catch (error) {
    console.error(`Error getting wrapper metadata for ${abilityId}:`, error);
    return null;
  }
}
