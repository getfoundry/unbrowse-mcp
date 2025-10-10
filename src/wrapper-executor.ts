/**
 * Wrapper Execution Engine for Unbrowse MCP
 *
 * Evaluates wrapper code from wrapper-storage with:
 * - Fetch override to inject dynamic headers (from cookiejar) and static headers
 * - Secure sandbox execution with credential injection
 * - Response handling and error logging
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getCookieJar } from './mock-endpoints.js';
import vm from 'vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WRAPPER_STORAGE_PATH = join(__dirname, 'wrapper-storage');

/**
 * Interface for wrapper execution result
 */
export interface WrapperExecutionResult {
  success: boolean;
  statusCode?: number;
  responseBody?: any;
  responseHeaders?: Record<string, string>;
  error?: string;
  executedAt: string;
}

/**
 * Interface for wrapper data from storage
 */
interface WrapperData {
  input: {
    service_name: string;
    ability_id: string;
    ability_name: string;
    wrapper_code: string;
    static_headers: Array<{
      key: string;
      value_code: string;
    }>;
    dynamic_header_keys: string[];
    input_schema: any;
  };
}

/**
 * Creates a fetch override function that injects headers from cookiejar
 *
 * @param serviceName - Service name for credential lookup
 * @param staticHeaders - Static headers from wrapper definition
 * @param dynamicHeaderKeys - Keys for dynamic headers to retrieve from cookiejar
 * @param secret - Secret for decrypting credentials
 * @returns Overridden fetch function with header injection
 */
function createFetchOverride(
  serviceName: string,
  staticHeaders: Array<{ key: string; value_code: string }>,
  dynamicHeaderKeys: string[],
  secret: string,
) {
  return async function overriddenFetch(
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> {
    // Get dynamic headers from cookiejar
    let dynamicHeaders: Record<string, string> = {};

    if (dynamicHeaderKeys.length > 0) {
      try {
        const credentials = await getCookieJar(serviceName, secret);
        if (credentials) {
          dynamicHeaders = credentials;
        }
      } catch (error) {
        console.warn(`[WARN] Failed to get credentials for ${serviceName}:`, error);
        // Continue without dynamic headers - wrapper will handle missing auth
      }
    }

    // Evaluate static headers (they're stored as code strings)
    const evaluatedStaticHeaders: Record<string, string> = {};
    for (const header of staticHeaders) {
      try {
        // Extract header name from key (format: "service::header-name")
        const headerName = header.key.split('::')[1];
        if (headerName) {
          // Evaluate the value_code (e.g., "() => 'value'")
          const evalFn = eval(header.value_code);
          evaluatedStaticHeaders[headerName] = evalFn();
        }
      } catch (error) {
        console.warn(`[WARN] Failed to evaluate static header ${header.key}:`, error);
      }
    }

    // Extract header names from dynamic header keys (format: "service::header-name")
    const dynamicHeaderNames: Record<string, string> = {};
    for (const key of dynamicHeaderKeys) {
      const headerName = key.split('::')[1];
      if (headerName && dynamicHeaders[key]) {
        dynamicHeaderNames[headerName] = dynamicHeaders[key];
      }
    }

    // Merge headers: existing init headers < static headers < dynamic headers
    const mergedHeaders = {
      ...evaluatedStaticHeaders,
      ...dynamicHeaderNames,
      ...(init?.headers as Record<string, string> || {}),
    };

    // Create new init with merged headers
    const newInit: RequestInit = {
      ...init,
      headers: mergedHeaders,
    };

    // Call original fetch with injected headers
    return fetch(url, newInit);
  };
}

/**
 * Executes a wrapper from wrapper-storage with credential injection
 *
 * @param abilityId - ID of the ability to execute
 * @param payload - Input payload matching the ability's input schema
 * @param secret - Secret for decrypting credentials from cookiejar
 * @param options - Additional options (e.g., baseUrl override)
 * @returns Execution result with response data
 */
export async function executeWrapper(
  abilityId: string,
  payload: Record<string, any>,
  secret: string,
  options: Record<string, any> = {},
): Promise<WrapperExecutionResult> {
  const executedAt = new Date().toISOString();

  try {
    // Find wrapper file in storage
    const files = await readFile(WRAPPER_STORAGE_PATH, 'utf-8').catch(() => '[]');
    const { readdir } = await import('fs/promises');
    const fileList = await readdir(WRAPPER_STORAGE_PATH);

    const matchingFile = fileList.find(f => f.includes(abilityId));

    if (!matchingFile) {
      return {
        success: false,
        error: `Ability not found: ${abilityId}`,
        executedAt,
      };
    }

    // Load wrapper data
    const filePath = join(WRAPPER_STORAGE_PATH, matchingFile);
    const content = await readFile(filePath, 'utf-8');
    const wrapperData: WrapperData = JSON.parse(content);

    const {
      service_name,
      wrapper_code,
      static_headers,
      dynamic_header_keys,
    } = wrapperData.input;

    // Create fetch override with header injection
    const fetchOverride = createFetchOverride(
      service_name,
      static_headers,
      dynamic_header_keys,
      secret,
    );

    // Create sandbox context for wrapper execution
    const sandbox = {
      fetch: fetchOverride,
      console,
      URL,
      Error,
      Response,
      Headers,
      Request,
      // Add other necessary globals
      Buffer,
      process: {
        env: process.env,
      },
    };

    // Create VM context
    const context = vm.createContext(sandbox);

    // Execute wrapper code in sandbox
    const script = new vm.Script(wrapper_code);
    script.runInContext(context);

    // Get the exported wrapper function from sandbox
    const wrapperFn = (sandbox as any).wrapper || (sandbox as any).exports?.wrapper;

    if (!wrapperFn || typeof wrapperFn !== 'function') {
      return {
        success: false,
        error: 'Wrapper function not found in wrapper code',
        executedAt,
      };
    }

    // Execute wrapper with payload and options
    const response: Response = await wrapperFn(payload, options);

    // Extract response data
    const statusCode = response.status;
    const ok = response.ok;

    // Get response body (handle different content types)
    let responseBody: any;
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      responseBody = await response.json();
    } else if (contentType.includes('text/')) {
      responseBody = await response.text();
    } else {
      // For binary or other types, get as text
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
 * Lists available wrappers from storage
 *
 * @returns Array of available ability IDs
 */
export async function listAvailableWrappers(): Promise<string[]> {
  try {
    const { readdir } = await import('fs/promises');
    const files = await readdir(WRAPPER_STORAGE_PATH);

    return files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        // Extract ability_id from filename pattern: {service}_{ability_id}_{timestamp}.json
        const parts = f.replace('.json', '').split('_');
        // Find the ability_id part (between service and timestamp)
        const serviceParts = [];
        const timestampIndex = parts.findIndex(p => /^\d+$/.test(p));

        if (timestampIndex > 0) {
          // Everything between service start and timestamp is the ability_id
          return parts.slice(1, timestampIndex).join('_');
        }

        return f.replace('.json', '');
      });
  } catch (error) {
    console.error('Error listing wrappers:', error);
    return [];
  }
}

/**
 * Gets wrapper metadata without executing it
 *
 * @param abilityId - ID of the ability
 * @returns Wrapper metadata or null if not found
 */
export async function getWrapperMetadata(abilityId: string): Promise<{
  serviceName: string;
  abilityName: string;
  description: string;
  inputSchema: any;
  staticHeaders: number;
  dynamicHeaderKeys: string[];
  requiresCreds: boolean;
} | null> {
  try {
    const { readdir } = await import('fs/promises');
    const files = await readdir(WRAPPER_STORAGE_PATH);

    const matchingFile = files.find(f => f.includes(abilityId));

    if (!matchingFile) {
      return null;
    }

    const filePath = join(WRAPPER_STORAGE_PATH, matchingFile);
    const content = await readFile(filePath, 'utf-8');
    const wrapperData: WrapperData = JSON.parse(content);

    return {
      serviceName: wrapperData.input.service_name,
      abilityName: wrapperData.input.ability_name,
      description: wrapperData.input.description || '',
      inputSchema: wrapperData.input.input_schema,
      staticHeaders: wrapperData.input.static_headers.length,
      dynamicHeaderKeys: wrapperData.input.dynamic_header_keys,
      requiresCreds: wrapperData.input.dynamic_header_keys.length > 0,
    };
  } catch (error) {
    console.error(`Error getting wrapper metadata for ${abilityId}:`, error);
    return null;
  }
}
