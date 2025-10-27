# Chat Agent with MCP Integration

The chat agent now has full MCP (Model Context Protocol) integration, allowing it to dynamically access user-specific abilities and tools.

## What Was Added

### 1. MCP Integration in Chat Agent

**File**: [src/mastra/agents/chat-agent.ts](../src/mastra/agents/chat-agent.ts)

The chat agent now includes:
- `getMCPToolsetsForUser(runtimeContext)` - Fetches MCP tools for authenticated users
- `disconnectMCPClient(toolsets)` - Cleanup helper for MCP connections

### 2. Custom Chat Route with MCP

**File**: [src/server/routes/chat-with-mcp.ts](../src/server/routes/chat-with-mcp.ts)

A custom `/chat` route that:
- Authenticates users (API key OR session/cookies)
- Initializes MCP with user credentials
- Streams agent responses
- Properly cleans up MCP connections

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    /chat Endpoint Flow                       │
└─────────────────────────────────────────────────────────────┘

1. Client Request
   ↓
   POST /chat
   Headers:
   - Authorization: Bearer re_xxx (API key auth)
   OR
   - Cookie: session=xxx (session auth)
   - X-Credential-Password: meowmeow (for MCP)

   Body: { "messages": [...] }
   ↓
2. Auth Middleware
   ↓
   - Validates API key OR session
   - Creates RuntimeContext with userId, userApiKey
   ↓
3. Chat Route Handler
   ↓
   - Calls getMCPToolsetsForUser(runtimeContext)
   - Initializes MCP: http://localhost:8081/mcp?apiKey=re_xxx&password=yyy
   ↓
4. Agent Execution
   ↓
   - chatAgent.stream(message, { toolsets: mcpToolsets })
   - Agent has access to user's MCP abilities
   ↓
5. Streaming Response
   ↓
   - Text chunks streamed to client
   - MCP client disconnected after completion
```

## Usage Examples

### Client Side (Browser with Session Auth)

```typescript
async function chatWithAgent(message: string) {
  const response = await fetch('http://localhost:4111/chat', {
    method: 'POST',
    credentials: 'include',  // Send session cookies
    headers: {
      'X-Credential-Password': 'meowmeow',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'user',
          content: message
        }
      ]
    })
  });

  // Handle streaming response
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    console.log(chunk);  // Display to user
  }
}

// User is already logged in
await chatWithAgent("What's the weather in Tokyo?");
```

### Client Side (API Key Auth)

```typescript
async function chatWithAgentAPIKey(message: string, apiKey: string) {
  const response = await fetch('http://localhost:4111/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'X-Credential-Password': 'meowmeow',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'user',
          content: message
        }
      ]
    })
  });

  // Handle streaming response...
}

await chatWithAgentAPIKey("Search for a weather API", "re_YourApiKey");
```

### cURL Example (Session Auth)

```bash
# 1. Login first
curl -X POST http://localhost:4111/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "pass"}' \
  -c cookies.txt

# 2. Chat with agent
curl -X POST http://localhost:4111/chat \
  -H "X-Credential-Password: meowmeow" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Find me a weather API and get Tokyo weather"
      }
    ]
  }'
```

### cURL Example (API Key Auth)

```bash
curl -X POST http://localhost:4111/chat \
  -H "Authorization: Bearer re_YourApiKey" \
  -H "X-Credential-Password: meowmeow" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Search for APIs related to weather"
      }
    ]
  }'
```

## What the Agent Can Do

With MCP integration, the chat agent can:

1. **Search for abilities** - Find relevant APIs/abilities in the user's repository
2. **Execute abilities** - Run abilities with appropriate parameters
3. **Handle authentication** - Use user's credentials automatically
4. **Chain operations** - Execute multiple abilities in sequence

Example conversation:

```
User: "Get the weather in Tokyo"

Agent: Let me search for a weather API...
      [Uses MCP to search abilities]

      Found "get-weather" ability. Executing...
      [Uses MCP to execute ability]

      The weather in Tokyo is currently sunny, 22°C.
```

## Agent Configuration

**File**: [src/mastra/agents/chat-agent.ts](../src/mastra/agents/chat-agent.ts)

```typescript
export const chatAgent = new Agent({
  name: 'Chat Agent',
  instructions: `
You are unbrowse. You help users by searching for and executing abilities based on their requirements.

You have access to MCP (Model Context Protocol) tools that allow you to:
- Search for available abilities in the user's ability repository
- Execute abilities with the appropriate parameters
- Handle authentication and credentials automatically

When a user asks you to do something:
1. Search for relevant abilities that can help
2. Execute the appropriate ability with the correct parameters
3. Return the results to the user in a clear, helpful way

Always be helpful, precise, and explain what you're doing.`,
  model: openrouter("x-ai/grok-4-fast"),
  tools: { },  // Tools are provided dynamically via toolsets
  memory: new Memory({
    storage: new LibSQLStore({
      url: ':memory:',
    }),
  }),
});
```

## How MCP Tools Are Loaded

```typescript
// In the /chat route handler
export async function getMCPToolsetsForUser(runtimeContext: RuntimeContext) {
  const userId = runtimeContext.get('userId');
  const userApiKey = runtimeContext.get('userApiKey');
  const password = runtimeContext.get('password');

  if (!userId || !userApiKey) {
    return {};  // No MCP tools available
  }

  // Build MCP URL with user credentials
  const mcpUrl = new URL(process.env.MCP_URL);
  mcpUrl.searchParams.set('apiKey', userApiKey);
  if (password) {
    mcpUrl.searchParams.set('password', password);
  }

  // Create MCP client
  const mcpClient = new MCPClient({
    servers: {
      unbrowseMCP: {
        url: mcpUrl,
      },
    },
  });

  // Get toolsets
  return await mcpClient.getToolsets();
}
```

## Authentication Support

The chat endpoint supports **both** authentication methods:

### ✅ API Key Authentication
- Client sends: `Authorization: Bearer re_xxx`
- MCP uses: User-provided API key

### ✅ Session/Cookie Authentication
- Client sends: Session cookies
- MCP uses: Auto-created API key from database

Both work seamlessly! The agent doesn't need to know which method was used.

## Security

- ✅ **User isolation** - Each user only accesses their own abilities
- ✅ **Credential management** - Passwords never logged or exposed
- ✅ **Auto cleanup** - MCP connections properly closed
- ✅ **Auth required** - Endpoint requires authentication

## Testing

### Test with Session Auth

```typescript
// 1. Login
const loginResponse = await fetch('http://localhost:4111/api/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'password'
  })
});

// 2. Chat (cookies sent automatically)
const chatResponse = await fetch('http://localhost:4111/chat', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'X-Credential-Password': 'meowmeow',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    messages: [{
      role: 'user',
      content: 'Search for weather APIs'
    }]
  })
});
```

### Test with API Key

```typescript
const response = await fetch('http://localhost:4111/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer re_YourApiKey',
    'X-Credential-Password': 'meowmeow',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    messages: [{
      role: 'user',
      content: 'Find APIs for getting stock prices'
    }]
  })
});
```

## Environment Configuration

Ensure `MCP_URL` is set in `.env`:

```env
MCP_URL=http://localhost:8081/mcp
```

## Files Modified/Created

- ✅ [src/mastra/agents/chat-agent.ts](../src/mastra/agents/chat-agent.ts) - Added MCP helper functions
- ✅ [src/server/routes/chat-with-mcp.ts](../src/server/routes/chat-with-mcp.ts) - NEW: Custom chat route
- ✅ [src/server/routes/index.ts](../src/server/routes/index.ts) - Export new chat route
- ✅ [src/mastra/index.ts](../src/mastra/index.ts) - Use custom chat route instead of default

## Related Documentation

- [Quick Start Guide](./QUICK_START_MCP.md) - Basic MCP setup
- [Session Auth Guide](./SESSION_AUTH_WITH_MCP.md) - Session authentication details
- [Full Auth Guide](./AUTH_AND_MCP_INTEGRATION.md) - Complete architecture

## Summary

The `/chat` endpoint now:
- ✅ Authenticates users (API key OR session)
- ✅ Loads MCP tools with user credentials
- ✅ Gives agent access to user's abilities
- ✅ Streams responses in real-time
- ✅ Properly cleans up connections

**The chat agent now has full access to your MCP abilities!** 🎉
