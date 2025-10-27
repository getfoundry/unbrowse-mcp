# MCP Server Ability Execution Guide

A comprehensive guide for integrating ability execution into your MCP (Model Context Protocol) servers.

## Table of Contents

- [Quick Start](#quick-start)
- [Authentication Setup](#authentication-setup)
- [Finding Abilities](#finding-abilities)
- [Executing Abilities](#executing-abilities)
- [Error Handling](#error-handling)
- [TypeScript Examples](#typescript-examples)
- [Complete MCP Tool Example](#complete-mcp-tool-example)

---

## Quick Start

Execute an ability in 3 simple steps:

```bash
# 1. List your abilities
curl 'http://localhost:4111/my/abilities' \
  -H "Authorization: Bearer YOUR_API_KEY"

# 2. Get an ability's abilityId from the response

# 3. Execute the ability
curl -X POST 'http://localhost:4111/my/abilities/ABILITY_ID/execute' \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-Credential-Key: YOUR_CREDENTIAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "address": "2ZiSPGncrkwWa6GBZB4EDtsfq7HEWwkwsPFzEXieXjNL"
    }
  }'
```

**Important:** The `params` field must be a JSON object, **NOT** a JSON string.

---

## Authentication Setup

### 1. API Key

Get your API key from the platform. It starts with `re_` and is used for authentication.

```bash
Authorization: Bearer re_REDACTED_KEY_1
```

### 2. Credential Key

The credential key is used to decrypt your stored credentials. You created this when you first stored credentials.

**Format:** Base64-encoded 256-bit AES key

**Example:**
```bash
X-Credential-Key: meowmeow
```

**Where to get it:**
- If you're using the MCP credential flow, this key is stored locally
- It's the same key you used when storing credentials via `/my/credentials/stream`
- For testing, you can use a simple string like `"meowmeow"`

**Security Note:** This key should be stored securely in your MCP server's configuration and never committed to version control.

---

## Finding Abilities

### List All Your Abilities

```bash
curl 'http://localhost:4111/my/abilities' \
  -H "Authorization: Bearer re_REDACTED_KEY_1"
```

**Response:**
```json
{
  "success": true,
  "count": 1,
  "abilities": [
    {
      "userAbilityId": "77cfa22f-d05a-4a54-8353-efd8fdfa5da2",
      "abilityId": "6317eb60-c1ff-4ee7-a016-6acaad33742c",
      "abilityName": "get_token_account_info",
      "serviceName": "solscan",
      "domain": "api-v2.solscan.io",
      "description": "Retrieves detailed information about a Solana token account...",
      "dynamicHeaderKeys": [],
      "dynamicHeadersRequired": false,
      "isFavorite": false,
      "isPublished": false,
      "metadata": {
        "input_schema": {
          "type": "object",
          "required": ["address"],
          "properties": {
            "address": {
              "type": "string",
              "example": "2ZiSPGncrkwWa6GBZB4EDtsfq7HEWwkwsPFzEXieXjNL",
              "description": "The Solana token mint address"
            }
          }
        }
      }
    }
  ]
}
```

**Key Fields:**
- `abilityId` - Use this to execute the ability
- `abilityName` - Human-readable name
- `description` - What the ability does
- `metadata.input_schema` - Required parameters
- `dynamicHeadersRequired` - Whether credentials are needed

### List Only Favorites

```bash
curl 'http://localhost:4111/my/abilities?favorites=true' \
  -H "Authorization: Bearer re_REDACTED_KEY_1"
```

### List Only Published Abilities

```bash
curl 'http://localhost:4111/my/abilities?published=true' \
  -H "Authorization: Bearer re_REDACTED_KEY_1"
```

### Search Public Abilities

```bash
curl 'http://localhost:4111/public/abilities?q=github' \
  -H "Authorization: Bearer re_REDACTED_KEY_1"
```

---

## Executing Abilities

### Basic Execution (No Credentials Required)

For abilities that don't require authentication (like public APIs):

```bash
curl -X POST 'http://localhost:4111/my/abilities/77cfa22f-d05a-4a54-8353-efd8fdfa5da2/execute' \
  -H "Authorization: Bearer re_REDACTED_KEY_1" \
  -H "X-Credential-Key: meowmeow" \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "address": "2ZiSPGncrkwWa6GBZB4EDtsfq7HEWwkwsPFzEXieXjNL"
    }
  }'
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "result": {
    "statusCode": 200,
    "body": {
      "success": true,
      "data": {
        "account": "2ZiSPGncrkwWa6GBZB4EDtsfq7HEWwkwsPFzEXieXjNL",
        "tokenInfo": {
          "icon": "https://assets.coingecko.com/coins/images/68735/standard/BcTC1QPg.png",
          "decimals": 9,
          "supply": "999983685178728005"
        }
      }
    },
    "headers": {
      "content-type": "application/json; charset=utf-8"
    },
    "executedAt": "2025-10-27T08:55:58.079Z",
    "executionTimeMs": 410
  },
  "health": {
    "score": 100,
    "totalExecutions": 1,
    "successRate": "100.0%"
  }
}
```

### Execution with Credentials

For abilities that require authentication (Twitter, GitHub, etc.):

```bash
curl -X POST 'http://localhost:4111/my/abilities/ABILITY_ID/execute' \
  -H "Authorization: Bearer re_REDACTED_KEY_1" \
  -H "X-Credential-Key: meowmeow" \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "username": "elonmusk",
      "count": 10
    }
  }'
```

**Note:** The server will automatically inject your stored credentials (Authorization headers, Cookies, etc.) into the API request.

### Execution with Response Transformation

Transform the API response before returning it:

```bash
curl -X POST 'http://localhost:4111/my/abilities/ABILITY_ID/execute' \
  -H "Authorization: Bearer re_REDACTED_KEY_1" \
  -H "X-Credential-Key: meowmeow" \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "address": "2ZiSPGncrkwWa6GBZB4EDtsfq7HEWwkwsPFzEXieXjNL"
    },
    "transformCode": "(data) => ({ name: data.data.tokenInfo.name, price: data.data.tokenInfo.price_usdt })"
  }'
```

**Response with Transform:**
```json
{
  "success": true,
  "result": {
    "statusCode": 200,
    "body": {
      "name": "Foundry",
      "price": 0.0016483773987341186
    },
    "executedAt": "2025-10-27T09:00:00.000Z",
    "executionTimeMs": 350
  },
  "health": {
    "score": 100,
    "totalExecutions": 2,
    "successRate": "100.0%"
  }
}
```

### Request Body Format

**✅ CORRECT:**
```json
{
  "params": {
    "address": "2ZiSPGncrkwWa6GBZB4EDtsfq7HEWwkwsPFzEXieXjNL",
    "limit": 10
  },
  "transformCode": "(data) => ({ versionOnly: data.version })"
}
```

**❌ WRONG:**
```json
{
  "params": "{\"address\": \"2ZiSPGncrkwWa6GBZB4EDtsfq7HEWwkwsPFzEXieXjNL\"}",
  "transformCode": "(data) => ({ versionOnly: data.version })"
}
```

**Key Points:**
- `params` is an **object**, not a string
- `transformCode` is optional
- `transformCode` must be a function expression: `(data) => ...` or `function(data) { ... }`

---

## Error Handling

### 400 - Missing Credential Key

**Error:**
```json
{
  "success": false,
  "error": "Missing X-Credential-Key header. This header is required to decrypt stored credentials."
}
```

**Solution:** Add the `X-Credential-Key` header with your credential decryption key.

### 400 - Missing Required Credentials

**Error:**
```json
{
  "success": false,
  "error": "Missing required credentials. This ability requires: twitter.com::Authorization, twitter.com::Cookie"
}
```

**Solution:** Store credentials for the required domain first using the `/my/credentials/stream` endpoint.

### 401 - Authentication Failed

**Error:**
```json
{
  "success": false,
  "error": "API key not found or has been revoked"
}
```

**Solution:** Check that your API key is valid and not expired.

### 401 - Credentials Expired

**Error:**
```json
{
  "success": false,
  "error": "Authentication failed (401). Credentials may be expired or invalid.",
  "credentialsExpired": true,
  "loginAbilities": [],
  "result": {
    "statusCode": 401,
    "executedAt": "2025-10-27T12:34:56.789Z"
  }
}
```

**Solution:** Re-authenticate with the service and update your stored credentials.

### 404 - Ability Not Found

**Error:**
```json
{
  "success": false,
  "error": "Ability not found: 848195a8-517f-434b-94f9-d0a630bb98cc"
}
```

**Solution:**
1. Verify the ability ID is correct
2. Check that the ability exists using `/my/abilities`
3. Make sure you're using the `abilityId` field from the response

### 410 - Ability Defunct

**Error:**
```json
{
  "success": false,
  "error": "This ability has been marked as defunct due to repeated failures. Please search for an alternative.",
  "defunct": true,
  "healthScore": 12.5,
  "totalExecutions": 50,
  "successRate": "10.0%"
}
```

**Solution:** This ability has failed too many times. Search for an alternative ability or reset its health if you believe the underlying API is working again.

### 500 - Internal Server Error

**Error:**
```json
{
  "success": false,
  "error": "Internal server error during execution",
  "executedAt": "2025-10-27T12:34:56.789Z"
}
```

**Solution:** Check server logs for details. This could be:
- Invalid wrapper code
- Network issues
- VM timeout (30 seconds)
- Transform code errors

---

## TypeScript Examples

### Basic Fetch Wrapper

```typescript
interface ExecuteAbilityOptions {
  abilityId: string;
  params: Record<string, any>;
  transformCode?: string;
}

interface ExecuteAbilityResult {
  success: boolean;
  result?: {
    statusCode: number;
    body: any;
    headers: Record<string, string>;
    executedAt: string;
    executionTimeMs: number;
  };
  health?: {
    score: number;
    totalExecutions: number;
    successRate: string;
  };
  error?: string;
  credentialsExpired?: boolean;
  defunct?: boolean;
}

async function executeAbility(
  apiKey: string,
  credentialKey: string,
  options: ExecuteAbilityOptions
): Promise<ExecuteAbilityResult> {
  const response = await fetch(
    `http://localhost:4111/my/abilities/${options.abilityId}/execute`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Credential-Key': credentialKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        params: options.params,
        transformCode: options.transformCode,
      }),
    }
  );

  return await response.json();
}
```

### Usage Example

```typescript
const result = await executeAbility(
  're_REDACTED_KEY_1',
  'meowmeow',
  {
    abilityId: '77cfa22f-d05a-4a54-8353-efd8fdfa5da2',
    params: {
      address: '2ZiSPGncrkwWa6GBZB4EDtsfq7HEWwkwsPFzEXieXjNL',
    },
  }
);

if (result.success) {
  console.log('Token info:', result.result?.body);
  console.log('Health score:', result.health?.score);
} else {
  console.error('Error:', result.error);

  if (result.credentialsExpired) {
    console.log('Credentials expired. Please re-authenticate.');
  }

  if (result.defunct) {
    console.log('Ability is defunct. Search for an alternative.');
  }
}
```

### With Error Handling

```typescript
async function safeExecuteAbility(
  apiKey: string,
  credentialKey: string,
  options: ExecuteAbilityOptions
): Promise<any> {
  try {
    const result = await executeAbility(apiKey, credentialKey, options);

    if (!result.success) {
      if (result.credentialsExpired) {
        throw new Error('Credentials expired. Please re-authenticate.');
      }

      if (result.defunct) {
        throw new Error('Ability is defunct. Please use an alternative.');
      }

      throw new Error(result.error || 'Unknown error');
    }

    return result.result?.body;
  } catch (error) {
    console.error('Failed to execute ability:', error);
    throw error;
  }
}
```

### List Abilities Helper

```typescript
interface Ability {
  userAbilityId: string;
  abilityName: string;
  serviceName: string;
  domain: string;
  description: string;
  dynamicHeadersRequired: boolean;
  metadata: {
    input_schema?: any;
    output_schema?: any;
  };
}

async function listAbilities(
  apiKey: string,
  filters?: {
    favorites?: boolean;
    published?: boolean;
  }
): Promise<Ability[]> {
  const params = new URLSearchParams();
  if (filters?.favorites) params.set('favorites', 'true');
  if (filters?.published) params.set('published', 'true');

  const url = `http://localhost:4111/my/abilities${params.toString() ? '?' + params.toString() : ''}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to list abilities');
  }

  return data.abilities;
}
```

---

## Complete MCP Tool Example

Here's a complete MCP tool implementation for executing abilities:

```typescript
import { z } from 'zod';

// Tool schema
const executeAbilitySchema = z.object({
  abilityId: z.string().describe('The abilityId of the ability to execute'),
  params: z.record(z.any()).describe('Parameters to pass to the ability'),
  transformCode: z.string().optional().describe('Optional JavaScript function to transform the response'),
});

// MCP tool definition
const executeAbilityTool = {
  name: 'execute_ability',
  description: 'Execute a reverse-engineered API ability with automatic credential injection',
  inputSchema: executeAbilitySchema,
  handler: async (args: z.infer<typeof executeAbilitySchema>) => {
    const API_KEY = process.env.UNBROWSE_API_KEY;
    const CREDENTIAL_KEY = process.env.UNBROWSE_CREDENTIAL_KEY;

    if (!API_KEY || !CREDENTIAL_KEY) {
      return {
        content: [{
          type: 'text',
          text: 'Error: UNBROWSE_API_KEY and UNBROWSE_CREDENTIAL_KEY must be set in environment variables',
        }],
      };
    }

    try {
      const response = await fetch(
        `http://localhost:4111/my/abilities/${args.abilityId}/execute`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'X-Credential-Key': CREDENTIAL_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            params: args.params,
            transformCode: args.transformCode,
          }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        let errorMessage = `Error: ${result.error}`;

        if (result.credentialsExpired) {
          errorMessage += '\n\nCredentials have expired. Please re-authenticate with the service.';
        }

        if (result.defunct) {
          errorMessage += '\n\nThis ability has been marked as defunct due to repeated failures. Please search for an alternative.';
        }

        return {
          content: [{
            type: 'text',
            text: errorMessage,
          }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              data: result.result.body,
              statusCode: result.result.statusCode,
              executionTime: result.result.executionTimeMs + 'ms',
              healthScore: result.health?.score,
              successRate: result.health?.successRate,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to execute ability: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  },
};

// Tool for listing abilities
const listAbilitiesTool = {
  name: 'list_abilities',
  description: 'List all available abilities',
  inputSchema: z.object({
    favorites: z.boolean().optional().describe('Only show favorited abilities'),
    published: z.boolean().optional().describe('Only show published abilities'),
  }),
  handler: async (args: { favorites?: boolean; published?: boolean }) => {
    const API_KEY = process.env.UNBROWSE_API_KEY;

    if (!API_KEY) {
      return {
        content: [{
          type: 'text',
          text: 'Error: UNBROWSE_API_KEY must be set in environment variables',
        }],
      };
    }

    try {
      const params = new URLSearchParams();
      if (args.favorites) params.set('favorites', 'true');
      if (args.published) params.set('published', 'true');

      const url = `http://localhost:4111/my/abilities${params.toString() ? '?' + params.toString() : ''}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
      });

      const result = await response.json();

      if (!result.success) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${result.error}`,
          }],
          isError: true,
        };
      }

      const abilities = result.abilities.map((ability: any) => ({
        id: ability.userAbilityId,
        name: ability.abilityName,
        service: ability.serviceName,
        domain: ability.domain,
        description: ability.description,
        requiresCredentials: ability.dynamicHeadersRequired,
        inputSchema: ability.metadata?.input_schema,
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            count: result.count,
            abilities,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to list abilities: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  },
};

// Export tools
export const tools = [
  executeAbilityTool,
  listAbilitiesTool,
];
```

### Environment Setup

Create a `.env` file:

```bash
UNBROWSE_API_KEY=re_REDACTED_KEY_1
UNBROWSE_CREDENTIAL_KEY=meowmeow
```

### Usage in MCP Client

```typescript
// List abilities
const abilities = await client.callTool('list_abilities', {
  favorites: true,
});

// Execute an ability
const result = await client.callTool('execute_ability', {
  abilityId: '77cfa22f-d05a-4a54-8353-efd8fdfa5da2',
  params: {
    address: '2ZiSPGncrkwWa6GBZB4EDtsfq7HEWwkwsPFzEXieXjNL',
  },
});

// Execute with transformation
const transformed = await client.callTool('execute_ability', {
  abilityId: '77cfa22f-d05a-4a54-8353-efd8fdfa5da2',
  params: {
    address: '2ZiSPGncrkwWa6GBZB4EDtsfq7HEWwkwsPFzEXieXjNL',
  },
  transformCode: '(data) => ({ name: data.data.tokenInfo.name, supply: data.data.tokenInfo.supply })',
});
```

---

## Common Patterns

### 1. Execute with Retry on Credential Expiration

```typescript
async function executeWithRetry(
  apiKey: string,
  credentialKey: string,
  abilityId: string,
  params: Record<string, any>,
  maxRetries: number = 1
): Promise<any> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await executeAbility(apiKey, credentialKey, {
      abilityId,
      params,
    });

    if (result.success) {
      return result.result?.body;
    }

    if (result.credentialsExpired && attempt < maxRetries) {
      console.log('Credentials expired. Re-authenticating...');
      // TODO: Trigger re-authentication flow
      await reAuthenticate();
      continue;
    }

    throw new Error(result.error || 'Unknown error');
  }
}
```

### 2. Batch Execute Multiple Abilities

```typescript
async function batchExecute(
  apiKey: string,
  credentialKey: string,
  executions: Array<{ abilityId: string; params: Record<string, any> }>
): Promise<any[]> {
  const results = await Promise.allSettled(
    executions.map(exec =>
      executeAbility(apiKey, credentialKey, exec)
    )
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled' && result.value.success) {
      return result.value.result?.body;
    }

    return {
      error: result.status === 'rejected'
        ? result.reason
        : result.value.error,
      abilityId: executions[index].abilityId,
    };
  });
}
```

### 3. Cache Results

```typescript
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function executeWithCache(
  apiKey: string,
  credentialKey: string,
  abilityId: string,
  params: Record<string, any>
): Promise<any> {
  const cacheKey = `${abilityId}:${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const result = await executeAbility(apiKey, credentialKey, {
    abilityId,
    params,
  });

  if (result.success) {
    cache.set(cacheKey, {
      data: result.result?.body,
      timestamp: Date.now(),
    });
    return result.result?.body;
  }

  throw new Error(result.error || 'Unknown error');
}
```

---

## Additional Resources

- **API Overview:** [/docs/api-overview.md](/docs/api-overview.md)
- **Abilities Management:** [/docs/abilities.md](/docs/abilities.md)
- **Credentials Management:** [/docs/credentials.md](/docs/credentials.md)
- **Server-Side Execution:** [/docs/SERVER_SIDE_EXECUTION.md](/docs/SERVER_SIDE_EXECUTION.md)
- **Health Tracking:** [/docs/ABILITY_HEALTH_TRACKING.md](/docs/ABILITY_HEALTH_TRACKING.md)

---

## Support

For issues or questions:
1. Check server logs for execution errors
2. Verify API key and credential key are correct
3. Verify ability exists using `/my/abilities`
4. Check ability health using `/my/abilities/:abilityId/health`
5. Review input_schema in ability metadata for correct parameters

**Common Mistakes:**
- Using `userAbilityId` instead of `abilityId` for execution
- Passing `params` as a JSON string instead of an object
- Missing the `X-Credential-Key` header
- Using expired API keys or credentials
