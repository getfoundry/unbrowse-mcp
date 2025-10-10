# Unbrowse MCP Server

[![smithery badge](https://smithery.ai/badge/@lekt9/unbrowse-mcp)](https://smithery.ai/server/@lekt9/unbrowse-mcp)

A Model Context Protocol (MCP) server that provides access to indexed web abilities from wrapper-storage with secure credential management and automatic header injection.

## Overview

This MCP server implements the private registry capabilities described in `master.md`, serving as a stub for the Unbrowse platform's ability indexing and execution system.

### Key Features

- **Private Registry** - Lists indexed abilities from `wrapper-storage/` with credential-based filtering
- **Secure Cookiejar** - AES-256-GCM encrypted credential storage with SECRET-based decryption
- **Wrapper Execution** - Evaluates wrapper code with fetch override to inject headers automatically
- **Header Injection** - Automatically injects both static and dynamic headers during execution
- **Credential Filtering** - Only exposes abilities that match user's available credentials
- **Dependency Order Tracking** - Each ability shows which other abilities must be called first in sequence
- **Domain-Based Search** - Filter abilities by cookie domains you have access to
- **401+ Error Handling** - Automatically marks credentials as expired and suggests login abilities
- **Login Ability Detection** - Finds authentication endpoints when credentials expire

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Unbrowse MCP Server                      │
├─────────────────────────────────────────────────────────────┤
│  Tools:                                                      │
│  • list_abilities - Query indexed abilities                 │
│  • get_credentials - Retrieve decrypted creds               │
│  • store_credentials - Store encrypted creds                │
│  • execute_ability - Run wrapper with header injection      │
│  • get_ability_info - Get metadata without execution        │
├─────────────────────────────────────────────────────────────┤
│  Components:                                                 │
│  ┌──────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │   Mock       │  │  Wrapper    │  │   Credential    │   │
│  │  Endpoints   │  │  Executor   │  │   Cookiejar     │   │
│  └──────────────┘  └─────────────┘  └─────────────────┘   │
│         │                 │                   │             │
│         └─────────────────┴───────────────────┘             │
│                           │                                 │
├───────────────────────────┼─────────────────────────────────┤
│                           ▼                                 │
│                  wrapper-storage/                           │
│                  (Indexed Abilities)                        │
└─────────────────────────────────────────────────────────────┘
```

## Setup

### Prerequisites

- Node.js 18+
- pnpm (or npm)
- A SECRET environment variable for credential encryption

### Installation

1. Clone the repository
2. Install dependencies:

```bash
pnpm install
```

3. Configure your secret in `smithery.yaml` or set the `SECRET` environment variable:

```bash
export SECRET="your-secret-key-here"
```

### Installing via Smithery

To install Unbrowse automatically via [Smithery](https://smithery.ai/server/@lekt9/unbrowse-mcp):

```bash
npx -y @smithery/cli install @lekt9/unbrowse-mcp
```

### Development

Run the server in development mode:

```bash
pnpm dev
```

### Build

Build for production:

```bash
pnpm build
```

## Usage

### Available Tools

#### 1. `list_abilities`

Lists all indexed abilities from wrapper-storage with credential filtering and optional domain-based filtering.

**Input:**
```json
{
  "userCredentials": ["www.hedgemony.fund::cookie", "www.wom.fun::authorization"],
  "filterByDomains": true
}
```

**Output:**
```json
{
  "success": true,
  "count": 17,
  "availableDomains": ["www.hedgemony.fund", "www.wom.fun"],
  "abilities": [
    {
      "id": "get-hedgemony-stats-simple",
      "name": "get_hedgemony_stats_simple",
      "service": "hedgemony-fund",
      "description": "Get simple statistics from Hedgemony...\n\n**Required Credentials:** www.hedgemony.fund::cookie, www.hedgemony.fund::referer",
      "requiresCreds": true,
      "neededCreds": ["www.hedgemony.fund::cookie", "www.hedgemony.fund::referer"],
      "dependencyOrder": [],
      "missingDependencies": [],
      "ponScore": 0.23,
      "successRate": 0.95
    },
    {
      "id": "get-hedgemony-plus-news-archive",
      "name": "get_hedgemony_plus_news_archive",
      "service": "hedgemony-fund",
      "description": "Retrieve the news archive page...\n\n**Dependency Order:** This ability must be called AFTER: `get-hedgemony-plus`\nCall these abilities in sequence before executing this one.",
      "requiresCreds": true,
      "neededCreds": ["www.hedgemony.fund::cookie"],
      "dependencyOrder": ["get-hedgemony-plus"],
      "missingDependencies": [],
      "ponScore": 0.18,
      "successRate": 0.95
    }
  ]
}
```

#### 2. `store_credentials`

Stores encrypted credentials in the cookiejar.

**Input:**
```json
{
  "serviceName": "hedgemony-fund",
  "credentialKey": "www.hedgemony.fund::cookie",
  "credentialValue": "session=abc123; token=xyz789"
}
```

**Output:**
```json
{
  "success": true,
  "message": "Credential www.hedgemony.fund::cookie stored for hedgemony-fund"
}
```

#### 3. `get_credentials`

Retrieves and decrypts credentials for a service.

**Input:**
```json
{
  "serviceName": "hedgemony-fund"
}
```

**Output:**
```json
{
  "success": true,
  "serviceName": "hedgemony-fund",
  "credentials": {
    "www.hedgemony.fund::cookie": "session=abc123; token=xyz789",
    "www.hedgemony.fund::referer": "https://www.hedgemony.fund/"
  }
}
```

#### 4. `execute_ability`

Executes a wrapper with automatic credential injection via fetch override. On 401+ errors, marks credentials as expired and suggests login abilities.

**Input:**
```json
{
  "abilityId": "get-hedgemony-stats-simple",
  "payload": {
    "tier": "plus"
  },
  "options": {}
}
```

**Output (Success):**
```json
{
  "success": true,
  "statusCode": 200,
  "responseBody": {
    "totalPnl": 46.71,
    "totalTrades": 4,
    "winRate": 75,
    "leveragedVolume": 3000000,
    "activeTrades": 5
  },
  "responseHeaders": {
    "content-type": "application/json"
  },
  "executedAt": "2025-10-10T12:00:00.000Z"
}
```

**Output (401 - Credentials Expired):**
```json
{
  "success": false,
  "statusCode": 401,
  "error": "Authentication failed (401). Credentials marked as expired. Please authenticate using one of these login abilities: hedgemony-login",
  "credentialsExpired": true,
  "loginAbilities": [
    {
      "id": "hedgemony-login",
      "name": "hedgemony_fund_login",
      "description": "Login to Hedgemony Fund to obtain authentication cookies"
    }
  ],
  "executedAt": "2025-10-10T12:00:00.000Z"
}
```

#### 5. `get_ability_info`

Gets metadata about an ability without executing it, including dependency order information.

**Input:**
```json
{
  "abilityId": "get-hedgemony-plus-news-archive"
}
```

**Output:**
```json
{
  "success": true,
  "serviceName": "hedgemony-fund",
  "abilityName": "get_hedgemony_plus_news_archive",
  "description": "Retrieve the news archive page from Hedgemony plus section...",
  "inputSchema": {
    "type": "object",
    "properties": {
      "_rsc": {
        "type": "string",
        "description": "React Server Component identifier."
      }
    }
  },
  "staticHeaders": 14,
  "dynamicHeaderKeys": ["www.hedgemony.fund::cookie", "www.hedgemony.fund::next-router-state-tree"],
  "requiresCreds": true,
  "dependencyOrder": ["get-hedgemony-plus"],
  "dependencies": {
    "missing": [
      {
        "abilityId": "get-hedgemony-plus",
        "abilityName": "get_hedgemony_plus",
        "reference": "get_hedgemony_plus"
      }
    ]
  },
  "dependencyInfo": "\n\nDependency Order: Call these abilities first in sequence:\n  1. get-hedgemony-plus\n\nMissing Dependencies:\n  - get-hedgemony-plus (get_hedgemony_plus)"
}
```

### Resources

#### `unbrowse://abilities`

Access the full ability index in JSON format.

### Prompts

#### `discover_abilities`

Intent-based ability discovery with credential awareness.

**Arguments:**
```json
{
  "intent": "get trading statistics",
  "userCredentials": ["www.hedgemony.fund::cookie"]
}
```

## Enhanced Features

### Dependency Order Tracking

Abilities can depend on other abilities being executed first. For example, `get-hedgemony-plus-news-archive` requires `get-hedgemony-plus` to be called first to establish the necessary session state.

**How it works:**
1. Each ability stores a `dependency_order` array listing prerequisite ability IDs
2. Tool descriptions automatically include this information
3. When listing abilities, dependency order is shown in the description
4. When executing an ability with missing dependencies, an error is returned

**Example workflow:**
```javascript
// 1. Check ability info
get_ability_info({ abilityId: "get-hedgemony-plus-news-archive" })
// Returns: dependencyOrder: ["get-hedgemony-plus"]

// 2. Execute dependencies first
execute_ability({ abilityId: "get-hedgemony-plus" })

// 3. Then execute the dependent ability
execute_ability({ abilityId: "get-hedgemony-plus-news-archive" })
```

### Domain-Based Filtering

Search for abilities based on the domains of your available credentials.

**How it works:**
1. Credentials are stored with keys like `www.hedgemony.fund::cookie`
2. Domains are extracted from credential keys (e.g., `www.hedgemony.fund`)
3. When filtering by domains, only abilities requiring credentials from those domains are shown
4. Available domains are returned in the `availableDomains` field

**Example:**
```javascript
// List only abilities for domains you have credentials for
list_abilities({
  userCredentials: ["www.hedgemony.fund::cookie", "www.wom.fun::api-key"],
  filterByDomains: true
})
// Returns only abilities for www.hedgemony.fund and www.wom.fun
```

### Automatic Credential Expiration Handling

When an API call returns a 401+ status code (authentication/authorization error), the system automatically:

1. **Marks credentials as expired** - Prevents future attempts with invalid credentials
2. **Finds login abilities** - Searches for authentication endpoints for that service
3. **Suggests next steps** - Returns login ability IDs to guide re-authentication

**How it works:**
```javascript
// Execute ability with expired credentials
execute_ability({ abilityId: "get-hedgemony-stats-simple" })

// Returns:
{
  "success": false,
  "statusCode": 401,
  "credentialsExpired": true,
  "loginAbilities": [
    {
      "id": "hedgemony-login",
      "name": "hedgemony_fund_login",
      "description": "Login to Hedgemony Fund..."
    }
  ]
}

// Re-authenticate
execute_ability({ abilityId: "hedgemony-login", payload: { username: "...", password: "..." } })

// Store new credentials
store_credentials({
  serviceName: "hedgemony-fund",
  credentialKey: "www.hedgemony.fund::cookie",
  credentialValue: "new-session-cookie"
})

// Retry original request
execute_ability({ abilityId: "get-hedgemony-stats-simple" })
```

### Login Ability Detection

The system can automatically find login/authentication abilities for a service by:

1. Matching service name
2. Looking for abilities that don't require credentials (they're the auth step)
3. Searching for keywords like "login", "auth", "signin" in ability names/descriptions

This enables automatic recovery from expired credentials.

## How It Works

### 1. Wrapper Storage

Abilities are stored as JSON files in `src/wrapper-storage/` with:

- `wrapper_code` - JavaScript function that makes the API request
- `static_headers` - Headers defined in wrapper code
- `dynamic_header_keys` - Credentials needed from cookiejar
- `input_schema` - JSON schema for input validation
- `output_schema` - Expected response structure

### 2. Credential Management

Credentials are:

1. Encrypted with AES-256-GCM using the SECRET environment variable
2. Stored in-memory (ready for Convex DB integration)
3. Decrypted on-demand during wrapper execution
4. Injected automatically via fetch override

### 3. Fetch Override

When executing a wrapper, the system:

1. **Loads wrapper code** from storage
2. **Evaluates static headers** from wrapper definition (e.g., `user-agent`, `accept`)
3. **Retrieves dynamic headers** from encrypted cookiejar (e.g., `cookie`, `authorization`)
4. **Creates fetch override** that merges all headers
5. **Executes wrapper** in VM sandbox with overridden fetch
6. **Returns response** with status, body, and headers

Example flow:

```javascript
// Original wrapper code uses fetch normally
const response = await fetch(url, { method: 'GET', headers });

// But our override intercepts and injects:
const mergedHeaders = {
  ...staticHeaders,      // From wrapper definition
  ...dynamicHeaders,     // From cookiejar (decrypted)
  ...headers             // From wrapper code
};

// Then calls real fetch with merged headers
return fetch(url, { method: 'GET', headers: mergedHeaders });
```

### 4. Credential Filtering

The `/list` endpoint filters abilities based on:

- **No dynamic headers required** → Always shown
- **Has dynamic headers** → Only shown if user has ALL required credentials

This implements the "shared graph with credential filtering" described in `master.md`.

## Security

### Encryption

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key Derivation:** scrypt with random salts
- **Format:** `salt:iv:authTag:encryptedData`
- **Auth Tag:** Prevents tampering

### Sandbox Execution

Wrapper code runs in a VM context with:

- Limited global scope
- No filesystem access
- Controlled environment variables
- Isolated from main process

### Environment Variables

The `SECRET` should be:

- At least 32 characters long
- Stored securely (e.g., environment variable, secrets manager)
- Never committed to version control
- Rotated periodically

## Integration with master.md

This implementation provides stubs for:

### ✅ Private Registry (`/list` endpoint)
- Serves indexed abilities from wrapper-storage
- Filters by user credentials
- Returns PoN scores and success rates

### ✅ Cookie Jar (`/cookiejar` endpoint)
- Encrypted credential storage
- SECRET-based encryption/decryption
- Per-service credential management

### ✅ Wrapper Execution
- Evaluates wrapper code in sandbox
- Fetch override with header injection
- Static + dynamic header merging

### ✅ Credential Filtering
- Shared graph model
- Access control via `requiresDynamicHeaders`
- User-specific ability visibility

### 🔄 Ready for Integration
- **Convex DB** - Replace in-memory store with Convex tables
- **FalkorDB** - Connect to graph index for advanced retrieval
- **PoN Scoring** - Currently mock; ready for KGE integration
- **LAM Recommendations** - Placeholder for transformer-based tool composition

## File Structure

```
unbrowse/
├── src/
│   ├── index.ts              # MCP server with tool definitions
│   ├── mock-endpoints.ts     # /list and /cookiejar implementations
│   ├── wrapper-executor.ts   # Wrapper eval with fetch override
│   └── wrapper-storage/      # Indexed abilities (JSON files)
│       ├── hedgemony-fund_get-hedgemony-stats-simple_*.json
│       ├── wom-fun_get-supabase-vtnzhqawildiecaasapv-tokens_*.json
│       └── ...
├── smithery.yaml             # Config schema with SECRET
├── package.json
└── README.md
```

## Testing

### Test Credential Storage

```bash
# Using MCP client (e.g., Claude Desktop):
store_credentials({
  serviceName: "hedgemony-fund",
  credentialKey: "www.hedgemony.fund::cookie",
  credentialValue: "your-cookie-value"
})
```

### Test Ability Execution

```bash
# Execute without credentials (should work for public abilities)
execute_ability({
  abilityId: "get-hedgemony-stats-simple",
  payload: { tier: "plus" }
})

# With credentials stored, it will inject them automatically
```

### Test Listing

```bash
# List all abilities
list_abilities({ userCredentials: [] })

# List with credentials
list_abilities({ 
  userCredentials: ["www.hedgemony.fund::cookie"] 
})
```

## Roadmap

- [ ] Convex DB integration for persistent credentials
- [ ] FalkorDB connection for graph-based retrieval
- [ ] Real PoN scoring with KGE embeddings
- [ ] LAM integration for intelligent ability composition
- [ ] Rate limiting and usage tracking
- [ ] Webhook support for async execution
- [ ] Ability versioning and upgrades

## Contributing

This is a stub implementation for the Unbrowse platform. For questions or contributions, refer to `master.md` for the full technical specification.

## License

ISC
