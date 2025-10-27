# Quick Start: MCP Integration with User Authentication

This is a quick reference for setting up MCP (Model Context Protocol) with user authentication in your Mastra routes.

## TL;DR

**Client sends:**
```bash
curl -X POST http://localhost:4111/your-route \
  -H "Authorization: Bearer re_YourApiKey" \
  -H "X-Credential-Password: meowmeow" \
  -d '{"your": "data"}'
```

**Server route uses:**
```typescript
const runtimeContext = getRuntimeContext(c);
const mcp = await createUserMCPClient(runtimeContext);
const agent = mastra.getAgent("myAgent");
const result = await agent.generate(prompt, {
  toolsets: await mcp.getToolsets()
});
await mcp.disconnect();
```

**MCP gets URL:**
```
http://localhost:8081/mcp?apiKey=re_YourApiKey&password=meowmeow
```

---

## Setup Checklist

### 1. Environment Configuration

Add to your `.env`:
```env
MCP_URL=http://localhost:8081/mcp
```

### 2. Middleware Already Configured

The middleware chain is already set up in [`src/mastra/index.ts`](../src/mastra/index.ts):
```typescript
mastra.setServerMiddleware([
  { path: '*', handler: authMiddleware },        // Validates API key
  { path: '*', handler: mastraAuthMiddleware }   // Creates RuntimeContext
]);
```

✅ **You don't need to configure this - it's global!**

### 3. Create Your Route

```typescript
// src/server/routes/my-route.ts
import { registerApiRoute } from "@mastra/core/server";
import { apiKeyAuth } from "../api-key-auth.js";
import { getRuntimeContext } from "../mastra-auth-middleware.js";
import { createUserMCPClient } from "../mcp-client-factory.js";
import { mastra } from "../../mastra/index.js";

export const myRoute = registerApiRoute("/api/my-endpoint", {
  method: "POST",
  middleware: [apiKeyAuth],  // Required for authentication
  handler: async (c) => {
    try {
      const body = await c.req.json();

      // RuntimeContext is automatically populated with:
      // - userId, userApiKey (from Authorization header)
      // - password (from X-Credential-Password header)
      const runtimeContext = getRuntimeContext(c);

      // Create MCP client with user's credentials
      const mcpClient = await createUserMCPClient(runtimeContext);

      // Get agent and execute with MCP tools
      const agent = mastra.getAgent("myAgent");
      const response = await agent.generate(body.prompt, {
        toolsets: await mcpClient.getToolsets()
      });

      // IMPORTANT: Always disconnect
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

### 4. Register Your Route

Add to [`src/server/routes/index.ts`](../src/server/routes/index.ts):
```typescript
import { myRoute } from './my-route.js';

export const apiRoutes = [
  // ... existing routes
  myRoute,
];
```

---

## How It Works

### Request Headers

| Header | Required | Purpose | Example |
|--------|----------|---------|---------|
| `Authorization` | ✅ Yes | User's API key | `Bearer re_9wEWNJG32x6...` |
| `X-Credential-Password` | ⚠️ Optional* | Password for MCP | `meowmeow` |
| `Content-Type` | ✅ Yes | Request format | `application/json` |

**Optional but required if you want MCP tools to work!*

### What Happens Automatically

1. **`authMiddleware`** validates the API key via Unkey
2. **`mastraAuthMiddleware`** creates RuntimeContext with:
   - `userId` - from validated API key
   - `userApiKey` - raw API key from `Authorization` header
   - `password` - from `X-Credential-Password` header (if present)

3. **`createUserMCPClient()`** builds the MCP URL:
   ```
   http://localhost:8081/mcp?apiKey=USER_API_KEY&password=PASSWORD
   ```

### Key Points

- ✅ **Password goes in header**, not request body
- ✅ **Always disconnect MCP client** after use
- ✅ **Middleware is global** - runs on all routes automatically
- ✅ **Get agent from `mastra.getAgent()`**, don't create new instances

---

## Client Examples

### Option 1: API Key Authentication

**JavaScript/TypeScript**

```typescript
async function callAPI(prompt: string, password: string) {
  const response = await fetch('http://localhost:4111/api/my-endpoint', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer re_YourApiKey',
      'X-Credential-Password': password,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt })
  });

  return await response.json();
}

const result = await callAPI("What's the weather?", "meowmeow");
```

### Option 2: Session/Cookie Authentication

**JavaScript/TypeScript**

```typescript
async function callAPIWithSession(prompt: string, password: string) {
  const response = await fetch('http://localhost:4111/api/my-endpoint', {
    method: 'POST',
    credentials: 'include',  // ✅ Include cookies for session auth
    headers: {
      // ❌ NO Authorization header needed - cookies handle it
      'X-Credential-Password': password,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt })
  });

  return await response.json();
}

// User is already logged in with session
const result = await callAPIWithSession("What's the weather?", "meowmeow");
```

**How it works:**
- User logs in via BetterAuth (session/cookies)
- Browser automatically sends session cookies with each request
- Server middleware validates session → gets `userId`
- Server automatically creates/fetches an API key for MCP authentication
- MCP receives: `http://localhost:8081/mcp?apiKey=re_AutoCreated&password=meowmeow`

### cURL with API Key

```bash
curl -X POST http://localhost:4111/api/my-endpoint \
  -H "Authorization: Bearer re_YourApiKey" \
  -H "X-Credential-Password: meowmeow" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is the weather?"}'
```

### cURL with Session (Cookies)

```bash
# First login to get session cookie
curl -X POST http://localhost:4111/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "pass"}' \
  -c cookies.txt

# Then use the session cookie
curl -X POST http://localhost:4111/api/my-endpoint \
  -H "X-Credential-Password: meowmeow" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"prompt": "What is the weather?"}'
```

---

## Common Mistakes

### ❌ DON'T: Put password in request body
```typescript
// WRONG!
body: JSON.stringify({
  prompt: "Hello",
  password: "meowmeow"  // ❌ Never do this
})
```

### ✅ DO: Put password in header
```typescript
// CORRECT!
headers: {
  'X-Credential-Password': 'meowmeow'  // ✅ Always use header
}
```

---

### ❌ DON'T: Forget to disconnect MCP
```typescript
// WRONG!
const mcp = await createUserMCPClient(runtimeContext);
const result = await agent.generate(...);
// ❌ Memory leak! Always disconnect
```

### ✅ DO: Always disconnect
```typescript
// CORRECT!
const mcp = await createUserMCPClient(runtimeContext);
try {
  const result = await agent.generate(...);
  return result;
} finally {
  await mcp.disconnect();  // ✅ Cleanup
}
```

---

### ❌ DON'T: Create new agent instances
```typescript
// WRONG!
const agent = new Agent({ ... });  // ❌ Don't create new
```

### ✅ DO: Get agent from Mastra
```typescript
// CORRECT!
const agent = mastra.getAgent("myAgent");  // ✅ Use existing
```

---

## Testing

### Test without MCP (no password)
```bash
curl -X POST http://localhost:4111/api/my-endpoint \
  -H "Authorization: Bearer re_YourApiKey" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello"}'
```
→ Works, but agent won't have MCP tools

### Test with MCP (with password)
```bash
curl -X POST http://localhost:4111/api/my-endpoint \
  -H "Authorization: Bearer re_YourApiKey" \
  -H "X-Credential-Password: meowmeow" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is the weather?"}'
```
→ Works with MCP tools available to agent

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "userId not found" | Add `middleware: [apiKeyAuth]` to route |
| "API key required" | Send `Authorization: Bearer <key>` header |
| MCP tools not available | Send `X-Credential-Password` header |
| "MCP_URL not configured" | Add `MCP_URL` to `.env` file |
| Memory leaks | Always call `await mcp.disconnect()` |

---

## Next Steps

- 📖 Read the [full documentation](./AUTH_AND_MCP_INTEGRATION.md)
- 🔍 See [execution route example](../src/server/routes/execution.ts)
- 🛠️ Check [MCP client factory](../src/server/mcp-client-factory.ts)

## Files Created

- [`src/server/mastra-auth-middleware.ts`](../src/server/mastra-auth-middleware.ts) - Creates RuntimeContext
- [`src/server/mcp-client-factory.ts`](../src/server/mcp-client-factory.ts) - MCP client factory
- [`docs/AUTH_AND_MCP_INTEGRATION.md`](./AUTH_AND_MCP_INTEGRATION.md) - Full documentation
