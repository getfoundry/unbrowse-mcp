# Server-Side Ability Execution Endpoint Specification

## Overview

This document specifies the exact implementation requirements for the new server-side ability execution endpoint. This endpoint will execute wrapper code on the server, ensuring that wrapper code is never extractable from the API.

## Endpoint Definition

```
POST /abilities/:abilityId/execute
```

### Authentication

- **Header**: `Authorization: Bearer <api_key>`
- Must validate API key and identify the authenticated user
- All credential access should be scoped to the authenticated user

### Request Parameters

#### Path Parameters
- `abilityId` (string, required): The ID of the ability to execute

#### Request Body (JSON)
```typescript
{
  params: Record<string, any>;        // Input parameters for the ability
  transformCode?: string;              // Optional JS transformation code
}
```

### Response Format

#### Success Response (200 OK)
```typescript
{
  success: true;
  result: {
    statusCode: number;               // HTTP status from the wrapped API call
    body: any;                        // Response body (parsed JSON or text)
    headers: Record<string, string>;  // Response headers
    executedAt: string;               // ISO timestamp
  }
}
```

#### Error Response (4xx/5xx)
```typescript
{
  success: false;
  error: string;                      // Error message
  credentialsExpired?: boolean;       // True if auth failed (401-499)
  loginAbilities?: Array<{            // Suggested login abilities
    id: string;
    name: string;
    description: string;
  }>;
  executedAt: string;
}
```

---

## Implementation Details

### 1. Retrieve Ability Metadata

Fetch the ability from your database using the `abilityId`:

```typescript
const ability = await db.getAbility(abilityId, userId);

if (!ability) {
  return {
    success: false,
    error: `Ability not found: ${abilityId}`
  };
}
```

**Required fields from ability:**
- `ability_id`: string
- `ability_name`: string
- `service_name`: string
- `wrapper_code`: string (the JS function to execute)
- `static_headers`: Record<string, string> or Array<{key: string, value_code: string}>
- `dynamic_header_keys`: string[] (e.g., `["twitter.com::Authorization", "twitter.com::Cookie"]`)
- `requires_dynamic_headers`: boolean
- `dependency_order`: string[] (optional, for validation)

### 2. Check Dependencies

```typescript
// Check for missing dependencies
if (ability.dependencies?.missing && ability.dependencies.missing.length > 0) {
  const missingDeps = ability.dependencies.missing.map(d => d.ability_id).join(", ");
  return {
    success: false,
    error: `Missing dependencies: ${missingDeps}. Execute these abilities first.`,
    executedAt: new Date().toISOString()
  };
}
```

### 3. Resolve Credentials (Server-Side)

**Extract domains from dynamic header keys:**
```typescript
const domains = new Set<string>();
if (ability.requires_dynamic_headers && ability.dynamic_header_keys) {
  ability.dynamic_header_keys.forEach(key => {
    const domain = key.split("::")[0];  // "twitter.com::Authorization" -> "twitter.com"
    if (domain) domains.add(domain);
  });
}
```

**Fetch encrypted credentials from your database:**
```typescript
const credentialsMap: Record<string, string> = {};

for (const domain of domains) {
  // Fetch credentials for this domain for the authenticated user
  const credentials = await db.getCredentialsForDomain(userId, domain);

  if (credentials && credentials.length > 0) {
    // Decrypt credentials using the user's password/key
    for (const cred of credentials) {
      const decryptedValue = decrypt(cred.encryptedValue, userPasswordKey);
      credentialsMap[cred.credentialKey] = decryptedValue;
    }
  }
}
```

**Validate all required credentials are present:**
```typescript
if (ability.requires_dynamic_headers) {
  const missingHeaders = ability.dynamic_header_keys.filter(
    key => credentialsMap[key] === undefined
  );

  if (missingHeaders.length > 0) {
    const requiredDomains = Array.from(
      new Set(missingHeaders.map(key => key.split("::")[0]).filter(Boolean))
    );

    return {
      success: false,
      error: `Credentials not available. Missing headers: ${missingHeaders.join(", ")}. Please store credentials for domains: ${requiredDomains.join(", ")}.`,
      executedAt: new Date().toISOString()
    };
  }
}
```

### 4. Create Fetch Override with Header Injection

```typescript
import vm from "vm";
import { ProxyAgent } from "undici";

function createFetchOverride(
  serviceName: string,
  staticHeaders: Array<{ key: string; value_code: string }> | Record<string, string>,
  dynamicHeaderKeys: string[],
  injectedCredentials: Record<string, string>
) {
  // Optional: support proxy from environment
  const proxyUrl = process.env.PROXY_URL;
  const proxyAgent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

  return async function overriddenFetch(
    url: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> {
    // Evaluate static headers
    const evaluatedStaticHeaders: Record<string, string> = {};

    // Handle both array and object formats for static headers
    const headersArray = Array.isArray(staticHeaders)
      ? staticHeaders
      : Object.entries(staticHeaders).map(([key, value]) => ({
          key: `${serviceName}::${key}`,
          value_code: `() => '${value.replace(/'/g, "\\'")}'`
        }));

    for (const header of headersArray) {
      try {
        const headerName = header.key.split("::")[1];
        if (headerName) {
          // Execute value_code: format is "() => 'value'"
          const evalFn = new Function(`return (${header.value_code})`)();
          evaluatedStaticHeaders[headerName] = evalFn();
        }
      } catch (error) {
        console.warn(`Failed to evaluate static header ${header.key}:`, error);
      }
    }

    // Extract header names from dynamic header keys and map to credentials
    const dynamicHeaderNames: Record<string, string> = {};
    for (const key of dynamicHeaderKeys) {
      const headerName = key.split("::")[1];  // "twitter.com::Authorization" -> "Authorization"
      if (headerName && injectedCredentials[key]) {
        dynamicHeaderNames[headerName] = injectedCredentials[key];
      }
    }

    // Merge headers with special handling for Cookie headers
    const originalHeaders = (init?.headers as Record<string, string>) || {};
    const mergedHeaders: Record<string, string> = {
      ...evaluatedStaticHeaders,
      ...dynamicHeaderNames,
      ...originalHeaders,
    };

    // Special case: Merge multiple Cookie headers instead of overriding
    const cookieHeaders: string[] = [];
    if (evaluatedStaticHeaders['Cookie']) cookieHeaders.push(evaluatedStaticHeaders['Cookie']);
    if (dynamicHeaderNames['Cookie']) cookieHeaders.push(dynamicHeaderNames['Cookie']);
    if (originalHeaders['Cookie']) cookieHeaders.push(originalHeaders['Cookie']);
    if (cookieHeaders.length > 1) {
      mergedHeaders['Cookie'] = cookieHeaders.join('; ');
    }

    // Remove forbidden headers that cause fetch errors
    const forbiddenHeaders = [
      'Content-Length', 'content-length',
      'Transfer-Encoding', 'transfer-encoding',
      'Host', 'host',
      'Connection', 'connection',
      'Keep-Alive', 'keep-alive',
      'Upgrade', 'upgrade',
    ];

    for (const header of forbiddenHeaders) {
      delete mergedHeaders[header];
    }

    const newInit: RequestInit = {
      ...init,
      headers: mergedHeaders,
      ...(proxyAgent ? { dispatcher: proxyAgent } : {}),
    };

    return fetch(url, newInit);
  };
}
```

### 5. Execute Wrapper Code in VM Sandbox

```typescript
async function executeWrapper(
  abilityId: string,
  payload: Record<string, any>,
  wrapperCode: string,
  serviceName: string,
  staticHeaders: any,
  dynamicHeaderKeys: string[],
  injectedCredentials: Record<string, string>
): Promise<{
  success: boolean;
  statusCode?: number;
  responseBody?: any;
  responseHeaders?: Record<string, string>;
  error?: string;
  credentialsExpired?: boolean;
  loginAbilities?: any[];
  executedAt: string;
}> {
  const executedAt = new Date().toISOString();

  try {
    // Create fetch override with header injection
    const fetchOverride = createFetchOverride(
      serviceName,
      staticHeaders,
      dynamicHeaderKeys,
      injectedCredentials
    );

    // Create sandbox context
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
        env: process.env,  // Optional: expose env vars
      },
    };

    const context = vm.createContext(sandbox);

    // Strip ES6 export keywords
    let cleanedCode = wrapperCode
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

    // Execute wrapper with payload
    const response: Response = await wrapperFn(payload, {});

    const statusCode = response.status;
    const ok = response.ok;

    // Handle 401+ errors (authentication/authorization failures)
    if (statusCode >= 401 && statusCode < 500) {
      // Mark credentials as expired in database
      await db.expireCredentials(userId, serviceName);

      // Find login abilities for this service
      const loginAbilities = await db.searchAbilities(userId, `login ${serviceName}`)
        .then(results => results
          .filter(a => !a.requires_dynamic_headers)
          .map(a => ({
            id: a.ability_id,
            name: a.ability_name,
            description: a.description,
          }))
        );

      let errorMessage = `Authentication failed (${statusCode}). Credentials marked as expired.`;

      if (loginAbilities.length > 0) {
        errorMessage += ` Please authenticate using one of these login abilities: ${loginAbilities.map(a => a.id).join(", ")}`;
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

    // Parse response body
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
```

### 6. Apply Optional Transform Code

```typescript
let processedResponseBody = result.responseBody;

if (transformCode && result.success && result.responseBody) {
  try {
    // Create safe sandbox for transformation
    const transformSandbox = {
      console,
      JSON,
      Object,
      Array,
      Math,
      String,
      Number,
      Boolean,
    };

    const transformContext = vm.createContext(transformSandbox);

    // Wrap the transform code to make it executable
    const wrappedTransform = `
      const transformFn = ${transformCode};
      transformFn;
    `;

    const transformScript = new vm.Script(wrappedTransform);
    const transformFn = transformScript.runInContext(transformContext);

    if (typeof transformFn !== 'function') {
      throw new Error('Transform code must be a function');
    }

    // Execute transformation
    processedResponseBody = transformFn(result.responseBody);
  } catch (error: any) {
    console.error('Transformation failed:', error.message);
    // Include error in response
    processedResponseBody = {
      _transform_error: error.message,
      _original_data: result.responseBody,
    };
  }
}
```

### 7. Return Response

```typescript
// Truncate if response is too large (optional)
const MAX_RESPONSE_LENGTH = 30000;
let responseText = JSON.stringify(processedResponseBody);

if (responseText.length > MAX_RESPONSE_LENGTH) {
  processedResponseBody = responseText.substring(0, MAX_RESPONSE_LENGTH) +
    `\n\n[... Response truncated. Original length: ${responseText.length} characters]`;
}

return {
  success: result.success,
  result: {
    statusCode: result.statusCode,
    body: processedResponseBody,
    headers: result.responseHeaders,
    executedAt: result.executedAt,
  },
  ...(result.error && { error: result.error }),
  ...(result.credentialsExpired && { credentialsExpired: result.credentialsExpired }),
  ...(result.loginAbilities && { loginAbilities: result.loginAbilities }),
};
```

---

## Complete Endpoint Implementation (Pseudocode)

```typescript
// POST /abilities/:abilityId/execute
async function executeAbilityEndpoint(req, res) {
  const { abilityId } = req.params;
  const { params, transformCode } = req.body;
  const userId = req.user.id;  // From auth middleware

  try {
    // 1. Fetch ability
    const ability = await db.getAbility(abilityId, userId);
    if (!ability) {
      return res.status(404).json({
        success: false,
        error: `Ability not found: ${abilityId}`
      });
    }

    // 2. Check dependencies
    if (ability.dependencies?.missing?.length > 0) {
      const missingDeps = ability.dependencies.missing.map(d => d.ability_id).join(", ");
      return res.status(400).json({
        success: false,
        error: `Missing dependencies: ${missingDeps}`,
        executedAt: new Date().toISOString()
      });
    }

    // 3. Resolve credentials
    const credentialsMap: Record<string, string> = {};

    if (ability.requires_dynamic_headers && ability.dynamic_header_keys) {
      const domains = new Set<string>();
      ability.dynamic_header_keys.forEach(key => {
        const domain = key.split("::")[0];
        if (domain) domains.add(domain);
      });

      for (const domain of domains) {
        const credentials = await db.getCredentialsForDomain(userId, domain);
        if (credentials) {
          for (const cred of credentials) {
            const decryptedValue = decrypt(cred.encryptedValue, userPasswordKey);
            credentialsMap[cred.credentialKey] = decryptedValue;
          }
        }
      }

      // Validate all required credentials are present
      const missingHeaders = ability.dynamic_header_keys.filter(
        key => credentialsMap[key] === undefined
      );

      if (missingHeaders.length > 0) {
        const requiredDomains = Array.from(
          new Set(missingHeaders.map(key => key.split("::")[0]).filter(Boolean))
        );

        return res.status(400).json({
          success: false,
          error: `Missing credentials for headers: ${missingHeaders.join(", ")}. Store credentials for: ${requiredDomains.join(", ")}`,
          executedAt: new Date().toISOString()
        });
      }
    }

    // 4. Transform static headers to array format
    const staticHeadersArray = Array.isArray(ability.static_headers)
      ? ability.static_headers
      : Object.entries(ability.static_headers || {}).map(([key, value]) => ({
          key: `${ability.service_name}::${key}`,
          value_code: `() => '${value.replace(/'/g, "\\'")}'`
        }));

    // 5. Execute wrapper
    const result = await executeWrapper(
      abilityId,
      params || {},
      ability.wrapper_code,
      ability.service_name,
      staticHeadersArray,
      ability.dynamic_header_keys || [],
      credentialsMap
    );

    // 6. Apply transform if provided
    let processedBody = result.responseBody;
    if (transformCode && result.success && result.responseBody) {
      try {
        const transformSandbox = { console, JSON, Object, Array, Math, String, Number, Boolean };
        const transformContext = vm.createContext(transformSandbox);
        const wrappedTransform = `const transformFn = ${transformCode}; transformFn;`;
        const transformScript = new vm.Script(wrappedTransform);
        const transformFn = transformScript.runInContext(transformContext);

        if (typeof transformFn === 'function') {
          processedBody = transformFn(result.responseBody);
        }
      } catch (error) {
        processedBody = {
          _transform_error: error.message,
          _original_data: result.responseBody
        };
      }
    }

    // 7. Return response
    const statusCode = result.success ? 200 : (result.statusCode >= 400 ? result.statusCode : 500);

    return res.status(statusCode).json({
      success: result.success,
      result: {
        statusCode: result.statusCode,
        body: processedBody,
        headers: result.responseHeaders,
        executedAt: result.executedAt,
      },
      ...(result.error && { error: result.error }),
      ...(result.credentialsExpired && { credentialsExpired: result.credentialsExpired }),
      ...(result.loginAbilities && { loginAbilities: result.loginAbilities }),
    });

  } catch (error) {
    console.error('Execution error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      executedAt: new Date().toISOString()
    });
  }
}
```

---

## Key Security Considerations

1. **Wrapper Code Never Leaves Server**: The `wrapper_code` field should NEVER be included in the response
2. **User-Scoped Credentials**: Always fetch credentials scoped to the authenticated user
3. **VM Sandbox**: Execute wrapper code in a VM sandbox with limited globals
4. **Forbidden Headers**: Filter out problematic headers that cause fetch errors
5. **Credential Encryption**: Store and decrypt credentials securely
6. **Authentication**: Validate API key on every request
7. **Rate Limiting**: Consider implementing rate limiting on this endpoint

---

## Dependencies Required

```json
{
  "dependencies": {
    "vm": "built-in Node.js module",
    "undici": "^6.0.0 (for ProxyAgent, optional)"
  }
}
```

---

## Testing the Endpoint

```bash
# Execute an ability with parameters
curl -X POST http://localhost:4111/abilities/twitter_get_user_profile/execute \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "username": "elonmusk"
    }
  }'

# Execute with transformation
curl -X POST http://localhost:4111/abilities/twitter_get_user_profile/execute \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "username": "elonmusk"
    },
    "transformCode": "(data) => ({ name: data.name, followers: data.followers_count })"
  }'
```

---

## Migration Notes

Once this endpoint is implemented, the MCP client can be simplified to:

1. Remove `wrapper-executor-enhanced.ts` dependency
2. Remove VM execution from MCP client
3. Remove credential decryption from MCP client
4. Simply call `apiClient.executeAbility(abilityId, params, { transformCode })`

This ensures wrapper code is NEVER accessible via the API and execution happens in a controlled server environment.
