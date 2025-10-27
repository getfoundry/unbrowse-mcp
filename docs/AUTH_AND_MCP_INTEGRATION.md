# Authentication & MCP Integration Guide

This guide explains how user authentication is integrated with Mastra's RuntimeContext and MCP (Model Context Protocol) clients for secure, user-specific AI workflows.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      API Request Flow                            │
└─────────────────────────────────────────────────────────────────┘

1. Client Request to YOUR Custom API Route
   ↓
   Headers:
   - Authorization: Bearer <api-key>
   - X-Credential-Password: meowmeow (optional, for MCP)
   ↓
2. authMiddleware (middleware.ts)
   ↓
   Validates API key via Unkey
   Sets: c.set('userId', ...) and c.set('authMethod', 'api_key')
   ↓
3. mastraAuthMiddleware (mastra-auth-middleware.ts)
   ↓
   Creates RuntimeContext with:
   - userId (from auth)
   - userApiKey (from Authorization header)
   - password (from X-Credential-Password header, if present)
   - authMethod
   ↓
4. Your Route Handler
   ↓
   Gets RuntimeContext: getRuntimeContext(c)
   ↓
5. MCP Client Initialization (if password present)
   ↓
   createUserMCPClient(runtimeContext)
   Builds URL: http://localhost:8081/mcp?apiKey=re_xxx&password=yyy
   ↓
6. Agent Execution with MCP Tools
   ↓
   agent.generate(prompt, { toolsets: await mcp.getToolsets() })
   ↓
7. Cleanup
   ↓
   await mcp.disconnect()
```

## Components

### 1. Authentication Middleware

**File**: [src/server/middleware.ts](../src/server/middleware.ts)

The `authMiddleware` handles initial authentication:
- Validates API keys via Unkey
- Falls back to BetterAuth session if no API key
- Sets `userId` and `authMethod` in Hono context

### 2. Mastra Auth Middleware

**File**: [src/server/mastra-auth-middleware.ts](../src/server/mastra-auth-middleware.ts)

The `mastraAuthMiddleware` creates a RuntimeContext with user credentials:

```typescript
import { RuntimeContext } from '@mastra/core/runtime-context';

// Creates RuntimeContext with:
// - userId: for user identification
// - userApiKey: raw API key for MCP authentication
// - authMethod: 'api_key' or 'session'
// - user: user object if available
```

**Helper function**:
```typescript
import { getRuntimeContext } from '../server/mastra-auth-middleware';

// In any route handler
const runtimeContext = getRuntimeContext(c);
const userId = runtimeContext.get('userId');
const userApiKey = runtimeContext.get('userApiKey');
```

### 3. MCP Client Factory

**File**: [src/server/mcp-client-factory.ts](../src/server/mcp-client-factory.ts)

Factory function for creating user-specific MCP clients following Mastra's pattern:

**Key Points:**
- Credentials are passed as **URL query parameters**
- MCP base URL is configured via `MCP_URL` environment variable
- Pattern: `http://localhost:8081/mcp?apiKey=re_xxx&password=yyy`

```typescript
import { createUserMCPClient } from '../server/mcp-client-factory';

// RuntimeContext must contain:
// - userId (from auth middleware)
// - userApiKey (from Authorization header)
// - password (from request body, optional)

const mcpClient = await createUserMCPClient(runtimeContext);
// Builds URL: http://localhost:8081/mcp?apiKey=re_xxx&password=yyy

// Get toolsets for agent
const toolsets = await mcpClient.getToolsets();

// Always disconnect when done
await mcpClient.disconnect();
```

**Environment Configuration:**
```env
MCP_URL=http://localhost:8081/mcp
```

## Usage Examples

### Example 1: Using MCP in a Route Handler (Mastra Pattern)

```typescript
// src/server/routes/my-route.ts
import { registerApiRoute } from "@mastra/core/server";
import { apiKeyAuth } from "../api-key-auth.js";
import { getRuntimeContext } from "../mastra-auth-middleware.js";
import { createUserMCPClient } from "../mcp-client-factory.js";
import { mastra } from "../../mastra/index.js";

export const myRoute = registerApiRoute("/api/my-endpoint", {
  method: "POST",
  middleware: [apiKeyAuth],
  handler: async (c) => {
    try {
      // 1. Parse request body to get password
      const body = await c.req.json();
      const { userPrompt, password } = body;

      // 2. Get RuntimeContext and add password
      const runtimeContext = getRuntimeContext(c);
      if (password) {
        runtimeContext.set('password', password);
      }

      // 3. Initialize MCP client with user's credentials
      // This builds URL: http://localhost:8081/mcp?apiKey=re_xxx&password=yyy
      const mcpClient = await createUserMCPClient(runtimeContext);

      // 4. Get agent from Mastra instance
      const agent = mastra.getAgent("myAgent");

      // 5. Execute with MCP toolsets
      const response = await agent.generate(userPrompt, {
        toolsets: await mcpClient.getToolsets()
      });

      // 6. Clean up - ALWAYS disconnect
      await mcpClient.disconnect();

      return c.json({ data: response.text });
    } catch (error) {
      console.error('[Route] Error:', error);
      return c.json({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
});
```

**Request Example:**
```bash
curl -X POST http://localhost:4111/api/my-endpoint \
  -H "Authorization: Bearer re_YourApiKeyHere" \
  -H "X-Credential-Password: meowmeow" \
  -H "Content-Type: application/json" \
  -d '{
    "userPrompt": "What is the weather?"
  }'
```

**Important:** Password is sent via `X-Credential-Password` header, NOT in request body!

### Example 2: Using RuntimeContext in Tools

```typescript
// src/mastra/tools/my-tool.ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const myTool = createTool({
  id: 'my-tool',
  description: 'A tool that uses user credentials',
  inputSchema: z.object({
    query: z.string()
  }),
  execute: async ({ context, runtimeContext }) => {
    // Access user credentials from RuntimeContext
    const userId = runtimeContext.get('userId');
    const userApiKey = runtimeContext.get('userApiKey');

    if (!userId) {
      throw new Error('User authentication required');
    }

    // Make authenticated API call with user's credentials
    const response = await fetch('https://api.example.com/data', {
      headers: {
        'Authorization': `Bearer ${userApiKey}`,
        'X-User-Id': userId
      }
    });

    return await response.json();
  }
});
```

### Example 3: Complete Execution Flow

Here's a complete example showing the full flow from client request to MCP execution:

```typescript
// Client makes request
const response = await fetch('http://localhost:4111/my/abilities/abc123/execute', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer re_9wEWNJG32x6z7ReYwuGQjXKGfoK4ExUdtD9QwUqvdLRo',
    'X-Credential-Password': 'meowmeow',  // Password for MCP (optional)
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    params: { city: "Tokyo" }
  })
});

// Server route handler
export const executeRoute = registerApiRoute("/my/abilities/:abilityId/execute", {
  method: "POST",
  middleware: [apiKeyAuth],  // Auth middleware runs first
  handler: async (c) => {
    const body = await c.req.json();
    const { params } = body;

    // Get RuntimeContext - already populated by mastraAuthMiddleware with:
    // - userId, userApiKey (from Authorization header)
    // - password (from X-Credential-Password header, if sent)
    const runtimeContext = getRuntimeContext(c);

    // Initialize MCP with user credentials
    // URL will be: http://localhost:8081/mcp?apiKey=re_9wE...&password=meowmeow
    const mcpClient = await createUserMCPClient(runtimeContext);

    // Execute agent with MCP tools
    const agent = mastra.getAgent("weatherAgent");
    const result = await agent.generate(
      `Get weather for ${params.city}`,
      { toolsets: await mcpClient.getToolsets() }
    );

    // Cleanup
    await mcpClient.disconnect();

    return c.json({ success: true, result: result.text });
  }
});
```

## Security Considerations

### 1. API Key Storage

- **Never log or expose user API keys** in responses or logs
- API keys are only stored in RuntimeContext during the request lifecycle
- Keys are passed securely to MCP servers via headers or environment variables

### 2. MCP Server Authentication

When configuring HTTPS MCP servers:

```typescript
{
  servers: {
    secureServer: {
      url: new URL('https://mcp.example.com'),
      requestInit: {
        headers: {
          // ✅ GOOD: User's API key for user-specific access
          Authorization: `Bearer ${runtimeContext.get('userApiKey')}`,

          // ❌ BAD: Shared server key (all users would share access)
          // 'X-Server-Key': process.env.SHARED_SERVER_KEY
        }
      }
    }
  }
}
```

### 3. Rate Limiting

User-specific MCP clients enable per-user rate limiting:

```typescript
const mcpClient = await createUserMCPClient(runtimeContext, {
  servers: {
    rateLimitedServer: {
      url: new URL('https://api.example.com'),
      requestInit: {
        headers: {
          // Server can rate-limit based on user
          'X-User-Id': runtimeContext.get('userId'),
          Authorization: `Bearer ${runtimeContext.get('userApiKey')}`
        }
      }
    }
  }
});
```

## Testing

### Testing with curl

```bash
# Make authenticated request
curl -X POST http://localhost:4111/my/abilities/:abilityId/execute \
  -H "Authorization: Bearer re_YourApiKeyHere" \
  -H "Content-Type: application/json" \
  -d '{
    "params": {"query": "test"}
  }'
```

### Testing RuntimeContext in Tools

```typescript
// In your tool's execute function
execute: async ({ context, runtimeContext }) => {
  console.log('User ID:', runtimeContext.get('userId'));
  console.log('Auth method:', runtimeContext.get('authMethod'));
  console.log('Has API key:', !!runtimeContext.get('userApiKey'));

  // Your tool logic here
}
```

## Troubleshooting

### Issue: RuntimeContext is undefined

**Cause**: The route is not using the middleware chain

**Solution**: Ensure your route includes `apiKeyAuth` middleware:

```typescript
export const myRoute = registerApiRoute("/api/endpoint", {
  method: "POST",
  middleware: [apiKeyAuth], // ✅ Required
  handler: async (c) => {
    const runtimeContext = getRuntimeContext(c);
    // ...
  }
});
```

### Issue: userApiKey is null in RuntimeContext

**Cause**: Request doesn't include Authorization header

**Solution**: Ensure client sends Bearer token:

```typescript
fetch('/api/endpoint', {
  headers: {
    'Authorization': 'Bearer re_YourApiKey',
    'Content-Type': 'application/json'
  }
})
```

### Issue: MCP server connection fails

**Cause**: User's API key not accepted by MCP server

**Solution**: Check MCP server configuration and ensure it accepts the user's credentials:

```typescript
// Debug: Log what's being sent to MCP server
const userApiKey = runtimeContext.get('userApiKey');
console.log('Connecting to MCP with key:', userApiKey?.substring(0, 10) + '...');

const mcpClient = await createUserMCPClient(runtimeContext, {
  servers: {
    debugServer: {
      url: new URL('https://mcp.example.com'),
      requestInit: {
        headers: {
          Authorization: `Bearer ${userApiKey}`
        }
      }
    }
  }
});
```

## Best Practices

1. **Always disconnect MCP clients** after use to prevent resource leaks
2. **Use cached clients** for long-running processes or multiple operations
3. **Pass RuntimeContext** to agent.generate() for tools to access user context
4. **Configure MCP servers per-user** for security and isolation
5. **Handle authentication errors** gracefully in tools and routes

## Related Files

- [src/server/middleware.ts](../src/server/middleware.ts) - Initial authentication
- [src/server/mastra-auth-middleware.ts](../src/server/mastra-auth-middleware.ts) - RuntimeContext creation
- [src/server/mcp-client-factory.ts](../src/server/mcp-client-factory.ts) - MCP client factory
- [src/server/routes/execution.ts](../src/server/routes/execution.ts) - Example usage in route
- [src/mastra/index.ts](../src/mastra/index.ts) - Middleware registration
