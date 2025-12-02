/**
 * Enhanced Wrapper Execution Engine for Unbrowse MCP
 *
 * Enhancements:
 * - 401+ error detection and credential expiration
 * - Automatic login ability suggestions
 * - Dependency order validation
 */
import vm from "vm";
import { ProxyAgent } from "undici";
/**
 * Creates a fetch override function that injects headers from provided credentials
 * and optionally uses a proxy from environment variables
 */
function createFetchOverride(serviceName, staticHeaders, dynamicHeaderKeys, injectedCredentials) {
    // Create ProxyAgent if proxy URL is configured in environment
    const proxyUrl = process.env['PROXY_URL'];
    const proxyAgent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
    if (proxyAgent) {
        console.log(`[INFO] Using proxy: ${proxyUrl.replace(/:[^:@]+@/, ':****@')}`);
    }
    return async function overriddenFetch(url, init) {
        // Use injected credentials directly (already filtered by endpoint)
        const dynamicHeaders = injectedCredentials;
        // Evaluate static headers
        const evaluatedStaticHeaders = {};
        for (const header of staticHeaders) {
            try {
                const headerName = header.key.split("::")[1];
                if (headerName) {
                    // Use Function constructor instead of eval for bundler compatibility
                    // value_code format: "() => 'value'"
                    const evalFn = new Function(`return (${header.value_code})`)();
                    evaluatedStaticHeaders[headerName] = evalFn();
                }
            }
            catch (error) {
                console.warn(`[WARN] Failed to evaluate static header ${header.key}:`, error);
            }
        }
        // Extract header names from dynamic header keys
        const dynamicHeaderNames = {};
        for (const key of dynamicHeaderKeys) {
            const headerName = key.split("::")[1];
            if (headerName && dynamicHeaders[key]) {
                dynamicHeaderNames[headerName] = dynamicHeaders[key];
            }
        }
        // Merge headers with special handling for Cookie headers
        const originalHeaders = init?.headers || {};
        const mergedHeaders = {
            ...evaluatedStaticHeaders,
            ...dynamicHeaderNames,
            ...originalHeaders,
        };
        // Special case: Merge Cookie headers instead of overriding
        const cookieHeaders = [];
        if (evaluatedStaticHeaders['Cookie'])
            cookieHeaders.push(evaluatedStaticHeaders['Cookie']);
        if (dynamicHeaderNames['Cookie'])
            cookieHeaders.push(dynamicHeaderNames['Cookie']);
        if (originalHeaders['Cookie'])
            cookieHeaders.push(originalHeaders['Cookie']);
        if (cookieHeaders.length > 1) {
            // Merge multiple cookie headers with semicolon separator
            mergedHeaders['Cookie'] = cookieHeaders.join('; ');
        }
        // Remove forbidden/problematic headers that should be auto-calculated by fetch
        // These headers cause errors if manually set or modified
        const forbiddenHeaders = [
            'Content-Length', // Causes UND_ERR_REQ_CONTENT_LENGTH_MISMATCH
            'content-length',
            'Transfer-Encoding', // Can cause chunking issues
            'transfer-encoding',
            'Host', // Should match the URL automatically
            'host',
            'Connection', // Forbidden in fetch API
            'connection',
            'Keep-Alive', // Forbidden in fetch API
            'keep-alive',
            'Upgrade', // Forbidden in fetch API
            'upgrade',
        ];
        for (const header of forbiddenHeaders) {
            delete mergedHeaders[header];
        }
        const newInit = {
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
export async function executeWrapper(abilityId, payload, options = {}, injectedCredentials = {}, providedWrapperData, secret, apiClient = null) {
    const executedAt = new Date().toISOString();
    try {
        let wrapperData;
        // Use provided wrapper data if available (from cache), otherwise fetch from API
        if (providedWrapperData) {
            console.log(`[TRACE] Using provided wrapper data for: ${abilityId}`);
            wrapperData = providedWrapperData;
        }
        else {
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
        const { service_name, wrapper_code, static_headers, dynamic_header_keys, dependency_order, } = wrapperData.input;
        console.log(`[TRACE] Extracted wrapper code starts with:`, wrapper_code.substring(0, 100));
        // Check for missing dependencies
        if (wrapperData.dependencies?.missing &&
            wrapperData.dependencies.missing.length > 0) {
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
        const fetchOverride = createFetchOverride(service_name, static_headers, dynamic_header_keys, injectedCredentials);
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
        const response = await wrapperFn(payload, options);
        const statusCode = response.status;
        const ok = response.ok;
        // Handle 401+ errors (authentication/authorization failures)
        if (statusCode >= 401 && statusCode < 500) {
            // Mark credentials as expired via API (if apiClient is available)
            if (apiClient) {
                try {
                    await apiClient.expireCredentials(service_name);
                }
                catch (error) {
                    console.error(`[ERROR] Failed to expire credentials for ${service_name}:`, error.message);
                }
            }
            // Find login abilities for this service via API search
            let loginAbilities = [];
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
                }
                catch (error) {
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
        let responseBody;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            responseBody = await response.json();
        }
        else if (contentType.includes("text/")) {
            responseBody = await response.text();
        }
        else {
            responseBody = await response.text();
        }
        // Extract response headers
        const responseHeaders = {};
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
    }
    catch (error) {
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
export async function listAvailableWrappers(apiClient) {
    try {
        // Fetch from API instead of local storage
        const result = await apiClient.listAbilities();
        return result.abilities.map((a) => a.ability_id);
    }
    catch (error) {
        console.error("Error listing wrappers:", error);
        return [];
    }
}
/**
 * Gets wrapper metadata including dependency order
 */
export async function getWrapperMetadata(abilityId, apiClient) {
    try {
        // Fetch from API instead of local storage
        const apiResponse = await apiClient.getAbility(abilityId);
        if (!apiResponse.success || !apiResponse.wrapper) {
            return null;
        }
        const wrapperData = apiResponse.wrapper;
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
    }
    catch (error) {
        console.error(`Error getting wrapper metadata for ${abilityId}:`, error);
        return null;
    }
}
