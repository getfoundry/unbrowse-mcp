# Session Authentication with MCP

This guide explains how session/cookie authentication works with MCP integration.

## Overview

Your system supports **two authentication methods**:

1. **API Key Authentication** - User provides `Authorization: Bearer re_xxx` header
2. **Session/Cookie Authentication** - User logs in via BetterAuth, browser sends cookies automatically

Both methods work seamlessly with MCP! 🎉

## The Problem

When users authenticate with **sessions/cookies**, there's no API key in the request headers. But MCP needs an API key to authenticate.

## The Solution

When a user authenticates with **session/cookies**, the system **automatically creates or fetches an API key** from the database to use for MCP authentication.

## How It Works

### 1. User Logs In (Session Auth)

```typescript
// User logs in via BetterAuth
const response = await fetch('http://localhost:4111/api/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

// Browser stores session cookie automatically
```

### 2. User Makes API Request (No API Key Needed!)

```typescript
// User makes request - NO Authorization header!
const response = await fetch('http://localhost:4111/api/my-endpoint', {
  method: 'POST',
  credentials: 'include',  // Browser sends cookies
  headers: {
    'X-Credential-Password': 'meowmeow',  // For MCP
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ prompt: 'What is the weather?' })
});
```

### 3. Server Processes Request

```
┌─────────────────────────────────────────────────────────────┐
│                    Server Processing                         │
└─────────────────────────────────────────────────────────────┘

1. Request arrives with session cookie
   ↓
2. authMiddleware validates session
   ↓
   Sets: c.set('userId', 'user-123')
   Sets: c.set('authMethod', 'session')
   ↓
3. mastraAuthMiddleware runs
   ↓
   Detects: authMethod === 'session'
   ↓
   Calls: getOrCreateMCPApiKey('user-123')
   ↓
   Database Check:
   - Found existing API key? → Use it
   - No API key? → Create new one (expires in 7 days)
   ↓
   Sets: runtimeContext.set('userApiKey', 're_AutoCreatedKey')
   ↓
4. Route handler executes
   ↓
   createUserMCPClient(runtimeContext)
   ↓
   Builds MCP URL: http://localhost:8081/mcp?apiKey=re_AutoCreated&password=meowmeow
   ↓
5. Agent executes with MCP tools
```

## Code Example

### Client Side (Browser)

```typescript
// After user logs in, just make requests - that's it!
async function askAgent(prompt: string) {
  const response = await fetch('http://localhost:4111/api/chat-with-mcp', {
    method: 'POST',
    credentials: 'include',  // Send cookies
    headers: {
      'X-Credential-Password': 'meowmeow',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt })
  });

  return await response.json();
}

// No API key needed!
const result = await askAgent("What's the weather in Tokyo?");
```

### Server Side Route

```typescript
// src/server/routes/chat-with-mcp.ts
import { registerApiRoute } from "@mastra/core/server";
import { apiKeyAuth } from "../api-key-auth.js";
import { getRuntimeContext } from "../mastra-auth-middleware.js";
import { createUserMCPClient } from "../mcp-client-factory.js";
import { mastra } from "../../mastra/index.js";

export const chatWithMCPRoute = registerApiRoute("/api/chat-with-mcp", {
  method: "POST",
  middleware: [apiKeyAuth],  // Accepts BOTH API key AND session auth
  handler: async (c) => {
    try {
      const body = await c.req.json();

      // Get RuntimeContext
      // This contains userApiKey whether user authenticated via:
      // - API key (from Authorization header)
      // - Session (auto-created/fetched from database)
      const runtimeContext = getRuntimeContext(c);

      console.log('Auth method:', runtimeContext.get('authMethod'));
      // Logs: 'api_key' or 'session'

      // Initialize MCP - works for both auth methods!
      const mcpClient = await createUserMCPClient(runtimeContext);

      // Execute agent
      const agent = mastra.getAgent("chatAgent");
      const response = await agent.generate(body.prompt, {
        toolsets: await mcpClient.getToolsets()
      });

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

## API Key Management for Session Users

### Automatic Creation

When a session-authenticated user first uses MCP:

```typescript
// src/server/user-api-key-helper.ts
export async function getOrCreateMCPApiKey(userId: string): Promise<string> {
  // Check for existing active API key
  const existingKey = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.userId, userId),
      isNull(apiKeys.revokedAt)
    )
  });

  if (existingKey) {
    // Can't retrieve the key value from Unkey after creation
    // So we create a new session key
  }

  // Create new API key via Unkey
  const apiKeyService = getApiKeyService();
  const result = await apiKeyService.createKey({
    userId,
    name: 'MCP Session Key (Auto-created)',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)  // 7 days
  });

  return result.key;  // Returns: "re_xxxxxxxxxxxxx"
}
```

### Key Characteristics

- **Auto-created**: First time user uses MCP with session auth
- **Name**: "MCP Session Key (Auto-created)"
- **Expiration**: 7 days
- **Renewal**: New key created each time (Unkey doesn't allow retrieving key values)

### Viewing Keys

Users can see their auto-created keys in the API keys dashboard:

```bash
curl http://localhost:4111/api/api-keys \
  -b cookies.txt
```

Response:
```json
{
  "keys": [
    {
      "apiKeyId": "uuid",
      "name": "MCP Session Key (Auto-created)",
      "keyPrefix": "re_abc123...",
      "createdAt": "2025-01-27T10:00:00Z",
      "expiresAt": "2025-02-03T10:00:00Z",
      "lastUsedAt": "2025-01-27T11:30:00Z"
    }
  ]
}
```

## Benefits

✅ **Seamless UX** - Users don't need to manage API keys manually
✅ **Secure** - Keys are created per-user and expire
✅ **Works with both auth methods** - API key OR session
✅ **MCP integration just works** - No client-side changes needed

## Comparison

### API Key Auth

```typescript
// Client sends API key
fetch('/api/endpoint', {
  headers: {
    'Authorization': 'Bearer re_UserProvidedKey',
    'X-Credential-Password': 'meowmeow'
  }
});

// Server uses: re_UserProvidedKey for MCP
```

### Session Auth

```typescript
// Client sends cookies
fetch('/api/endpoint', {
  credentials: 'include',
  headers: {
    'X-Credential-Password': 'meowmeow'
  }
});

// Server auto-creates: re_AutoCreatedKey for MCP
```

## Security Considerations

### ✅ Safe

- Auto-created keys expire after 7 days
- Keys are tied to specific users
- Keys can be revoked by users
- All key operations are logged in audit log

### ⚠️ Note

- New key is created for each session (Unkey limitation)
- Old auto-created keys accumulate in database
- Consider adding cleanup job for expired auto-created keys

## Cleanup Recommendation

Add a cron job to clean up expired auto-created keys:

```typescript
// src/server/jobs/cleanup-expired-keys.ts
import { getDatabaseClient } from '../db/client.js';
import { apiKeys } from '../db/schema.js';
import { and, lt, like } from 'drizzle-orm';

export async function cleanupExpiredAutoCreatedKeys() {
  const db = getDatabaseClient().getDb();

  const deleted = await db
    .delete(apiKeys)
    .where(
      and(
        like(apiKeys.name, 'MCP Session Key (Auto-created)'),
        lt(apiKeys.expiresAt, new Date())
      )
    );

  console.log(`Cleaned up ${deleted.rowCount} expired auto-created keys`);
}

// Run daily
setInterval(cleanupExpiredAutoCreatedKeys, 24 * 60 * 60 * 1000);
```

## Testing

### Test with Session Auth

```bash
# 1. Login
curl -X POST http://localhost:4111/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}' \
  -c cookies.txt

# 2. Use MCP (API key auto-created!)
curl -X POST http://localhost:4111/api/chat-with-mcp \
  -H "X-Credential-Password: meowmeow" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"prompt": "What is the weather?"}'

# 3. Check server logs
# You'll see: "[MastraAuth] User authenticated with session, fetching/creating API key for MCP..."
# You'll see: "[MastraAuth] Got API key for session user"
```

### Test with API Key Auth

```bash
# Works the same way, but uses provided API key
curl -X POST http://localhost:4111/api/chat-with-mcp \
  -H "Authorization: Bearer re_YourApiKey" \
  -H "X-Credential-Password: meowmeow" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is the weather?"}'
```

## Summary

**Key Takeaways:**

1. ✅ **Both auth methods work** - API key OR session/cookies
2. ✅ **Session users get auto-created API keys** for MCP
3. ✅ **No client changes needed** - just send credentials: 'include'
4. ✅ **Server handles everything** - middleware creates/fetches keys automatically
5. ✅ **Secure and audited** - keys expire, logged, revocable

**Files Modified:**
- [src/server/mastra-auth-middleware.ts](../src/server/mastra-auth-middleware.ts) - Auto-creates keys for session users
- [src/server/user-api-key-helper.ts](../src/server/user-api-key-helper.ts) - Helper to get/create keys

**Related Docs:**
- [Quick Start Guide](./QUICK_START_MCP.md) - Basic setup
- [Full Auth Guide](./AUTH_AND_MCP_INTEGRATION.md) - Detailed architecture
