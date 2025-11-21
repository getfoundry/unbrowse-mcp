# Unbrowse MCP Server

[![smithery badge](https://smithery.ai/badge/@lekt9/unbrowse-mcp)](https://smithery.ai/server/@lekt9/unbrowse-mcp)

A Model Context Protocol (MCP) server that provides access to indexed web abilities from wrapper-storage with secure credential management and automatic header injection.

## Overview

This MCP server connects to the Unbrowse API ([API Documentation](./docs/API_COMPLETE_GUIDE.md)) to provide AI assistants with access to your indexed web API abilities. All abilities are fetched from the cloud API with secure credential management and automatic header injection.

### Key Features

- **Cloud-Based Ability Registry** - Fetches your indexed abilities from the Unbrowse API (GET /my/abilities)
- **API Key Authentication** - Authenticates to Unbrowse API using long-lived API keys
- **Client-Side Credential Decryption** - AES-256-GCM encrypted credentials are decrypted locally using your password
- **Zero-Knowledge Security** - Password never leaves your machine; credentials encrypted on server
- **Wrapper Execution** - Evaluates wrapper code with fetch override to inject headers automatically
- **Header Injection** - Automatically injects both static and dynamic headers during execution
- **Credential Filtering** - Only exposes abilities you have credentials for
- **Dependency Order Tracking** - Each ability shows which other abilities must be called first in sequence
- **Semantic Search** - Search abilities using natural language queries
- **API Indexing** - Ingest new API endpoints directly from the MCP (optional tool)
- **401+ Error Handling** - Automatically marks credentials as expired and suggests login abilities

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Unbrowse MCP Server                      │
├─────────────────────────────────────────────────────────────┤
│  Tools:                                                      │
│  • search_abilities - Search your indexed abilities         │
│  • execute_ability - Run ability with credential injection  │
│  • ingest_api_endpoint - Index new API endpoints (optional) │
├─────────────────────────────────────────────────────────────┤
│  Authentication:                                             │
│  • API Key → Authenticates to Unbrowse API                  │
│  • Password → Decrypts credentials (client-side only)       │
├─────────────────────────────────────────────────────────────┤
│  Components:                                                 │
│  ┌──────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │   API Client │  │  Wrapper    │  │   Credential    │   │
│  │ (Authed)     │  │  Executor   │  │   Decryption    │   │
│  └──────────────┘  └─────────────┘  └─────────────────┘   │
│         │                 │                   │             │
│         └─────────────────┴───────────────────┘             │
│                           │                                 │
├───────────────────────────┼─────────────────────────────────┤
│                           ▼                                 │
│         Unbrowse API (https://agent.unbrowse.ai)            │
│                  • GET /my/abilities                        │
│                  • GET /my/credentials/:domain              │
│                  • POST /ingest/api                         │
│                  • DELETE /my/credentials/:domain           │
└─────────────────────────────────────────────────────────────┘
```

### Authentication Flow

The MCP server uses a **flexible authentication** model with two options:

#### Option 1: API Key Authentication (Recommended)
   - All API requests include `Authorization: Bearer <apiKey>` header
   - API key authenticates you to the Unbrowse platform (format: `re_xxxxx`)
   - Allows access to your personal abilities and credentials
   - Can be revoked without changing your password
   - Best for production use

#### Option 2: Session Token Authentication
   - Use session tokens from your browser after logging in
   - Session tokens expire based on your auth configuration
   - Useful for development or testing
   - Can be obtained from browser cookies

#### Password-Based Decryption (Optional)
   - **Only required if your abilities need credential decryption**
   - Credentials are stored encrypted on the Unbrowse server
   - Your password is used to decrypt them locally in the MCP server
   - Password **never leaves** your machine
   - Follows zero-knowledge encryption model
   - If you don't use encrypted credentials, password is not needed

```
┌─────────────┐                           ┌──────────────┐                  ┌─────────────┐
│  MCP Server │──API Key or Session Token─▶│ Unbrowse API │                  │  Encrypted  │
│             │                            │              │                  │ Credentials │
│             │◀────Encrypted Creds────────│              │◀─────Stored─────│  (Server)   │
│             │                            └──────────────┘                  └─────────────┘
│             │
│   Password  │────Decrypt (optional)─────▶│  Plaintext   │
│  (Local)    │    if creds needed         │  Credentials │
│             │                            │  (In Memory) │
└─────────────┘                            └──────────────┘
```

## Setup

### Prerequisites

- Node.js 18+
- pnpm (or npm)
- An Unbrowse account
- **Authentication**: Either an API key OR session token (choose one)
- **Password** (optional): Only needed if your abilities require credential decryption

### Getting Your API Key

Follow the complete authentication workflow from the [API Complete Guide](./docs/API_COMPLETE_GUIDE.md#quick-start):

1. **Register an account** (if you don't have one):
```bash
curl -X POST https://agent.unbrowse.ai/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "YourSecurePassword123",
    "name": "Your Name"
  }'
```

2. **Login to get a JWT token**:
```bash
curl -X POST https://agent.unbrowse.ai/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "YourSecurePassword123"
  }'
```
Save the returned `token` value from the response.

3. **Create an API key** using your JWT token:
```bash
curl -X POST https://agent.unbrowse.ai/my/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MCP Server Key",
    "expiresAt": "2026-12-31T23:59:59Z"
  }'
```
**⚠️ Important**: Save the returned `key` value - it's only shown once! This is your API key for the MCP server.

The API key format is `re_xxxxxxxxxxxx` (managed by Unkey integration).

### Installation

1. Clone the repository
2. Install dependencies:

```bash
pnpm install
```

3. Configure your authentication in `smithery.yaml`, MCP settings, or environment variables:

**Authentication (choose ONE method):**
   - `apiKey`: Your Unbrowse API key (from step 3 above, format: `re_xxxxx`)
   - OR `sessionToken`: Session token from browser cookies after logging in
   - Can also use environment variables: `UNBROWSE_API_KEY` or `UNBROWSE_SESSION_TOKEN`

**Credential Decryption (optional):**
   - `password`: Your encryption password for credential decryption
   - Only required if your abilities need to decrypt stored credentials
   - Can also use environment variable: `UNBROWSE_PASSWORD`

The Unbrowse API base URL is fixed to `https://agent.unbrowse.ai`

### Installing via Smithery

To install Unbrowse automatically via [Smithery](https://smithery.ai/server/@lekt9/unbrowse-mcp):

```bash
npx -y @smithery/cli install @lekt9/unbrowse-mcp
```

### Environment Variable Configuration

All configuration options can be set via environment variables instead of `smithery.yaml`:

```bash
# Authentication (choose ONE)
export UNBROWSE_API_KEY="re_xxxxxxxxxxxxx"
# OR
export UNBROWSE_SESSION_TOKEN="cm4xxxxxxxxxxxxx"

# Credential decryption (optional - only if abilities need it)
export UNBROWSE_PASSWORD="your-encryption-password"

# Optional: Enable debug logging
export DEBUG="true"

# Optional: Enable API indexing tool
export ENABLE_INDEX_TOOL="true"
```

**Benefits of environment variables:**
- Easier to manage secrets in production
- Works with Docker, CI/CD, and cloud platforms
- No need to modify `smithery.yaml`
- Can override config values dynamically

See [.env.example](.env.example) for a complete template.

### Developer Mode (RAG Support)

Enable developer mode to get detailed API usage documentation in search results, including ready-to-use `fetch()` code snippets. This is ideal for "vibe coding" or RAG workflows where you want to copy-paste ability execution code directly into your application.

**Enable via config:**
```yaml
config:
  devMode: true
```

**Enable via environment variable:**
```bash
export DEV_MODE="true"
```

**Output Example:**
When enabled, `search_abilities` results include a `usage` field:

```json
{
  "usage": {
    "fetchSnippet": "const execute_ability = async (params) => { ... }",
    "endpoint": "https://agent.unbrowse.ai/my/abilities/...",
    "bodySchema": { ... }
  }
}
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

#### 1. `search_abilities`

Searches your indexed abilities from the Unbrowse API. Abilities are cached for execution.

**Input:**
```json
{
  "query": "github user profile",
  "limit": 20
}
```

**Output:**
```json
{
  "success": true,
  "query": "github user profile",
  "count": 3,
  "message": "Found 3 matching abilities. These are now cached and ready to execute.",
  "availableDomains": ["api.github.com"],
  "abilities": [
    {
      "id": "get-github-user",
      "name": "Get GitHub User",
      "service": "github",
      "description": "Fetch GitHub user profile by username\n\n**Required Credentials:** api.github.com::Authorization",
      "inputSchema": {
        "type": "object",
        "properties": {
          "username": { "type": "string", "description": "GitHub username" }
        }
      },
      "requiresCreds": true,
      "neededCreds": ["api.github.com::Authorization"],
      "dependencyOrder": [],
      "missingDependencies": []
    }
  ]
}
```

#### 2. `execute_ability`

Executes a cached ability with automatic credential injection. Credentials are decrypted locally and injected into API requests.

**Input:**
```json
{
  "ability_id": "get-github-user",
  "params": "{\"username\":\"octocat\"}",
  "transform_code": "(data) => ({ login: data.login, name: data.name, bio: data.bio })"
}
```

**Note**: `params` must be a JSON string, not a JSON object.

**Output (Success):**
```json
{
  "success": true,
  "statusCode": 200,
  "responseBody": {
    "login": "octocat",
    "name": "The Octocat",
    "bio": "GitHub mascot"
  },
  "responseHeaders": {
    "content-type": "application/json; charset=utf-8"
  },
  "executedAt": "2025-10-25T12:00:00.000Z",
  "transformed": true
}
```

**Output (401 - Credentials Expired):**
```json
{
  "success": false,
  "statusCode": 401,
  "error": "Authentication failed (401). Credentials marked as expired.",
  "credentialsExpired": true,
  "loginAbilities": [],
  "executedAt": "2025-10-25T12:00:00.000Z"
}
```

**Transform Code Examples:**

The optional `transform_code` parameter allows you to process API responses:

1. **Filter fields**: `(data) => ({ name: data.name, id: data.id })`
2. **Array operations**: `(data) => data.items.filter(x => x.active)`
3. **Aggregations**: `(data) => ({ total: data.length, sum: data.reduce((a,b) => a + b.value, 0) })`

#### 3. `ingest_api_endpoint` (Optional)

Index new API endpoints for future use. Requires `enableIndexTool: true` in configuration.

**Input:**
```json
{
  "input": "https://api.github.com/users/octocat",
  "service_name": "github",
  "ability_name": "get-github-user",
  "description": "Fetch GitHub user profile"
}
```

**Output:**
```json
{
  "success": true,
  "message": "API endpoint ingested successfully",
  "ability_id": "get-github-user",
  "ability_name": "Get GitHub User",
  "input_schema": { "type": "object", "properties": { "username": { "type": "string" } } },
  "note": "This ability is now available for execution via execute_ability tool"
}
```

### Credential Management

Credentials are managed through the Unbrowse API and decrypted locally in the MCP server.

#### Storing Credentials

Use the Unbrowse API to store encrypted credentials (see [Credentials Storage Guide](./docs/CREDENTIALS_STORAGE.md)):

```bash
# Client-side: Encrypt credentials before uploading
# (See API documentation for encryption implementation)

curl -X POST https://agent.unbrowse.ai/my/credentials/stream \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "api.github.com",
    "credentials": [
      {
        "type": "header",
        "key": "Authorization",
        "encryptedValue": "{\"ciphertext\":\"...\",\"iv\":\"...\"}"
      }
    ]
  }'
```

#### Listing Credentials

```bash
curl -X GET https://agent.unbrowse.ai/my/credentials?grouped=true \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### Environment Variable Credentials

For non-sensitive or frequently rotated credentials, you can use environment variables instead of storing in the API:

```bash
# Option 1: JSON format (recommended)
export UNBROWSE_TOOL_HEADERS='{"api.github.com::Authorization":"Bearer ghp_..."}'

# Option 2: Sanitized variable names
export API_GITHUB_COM__AUTHORIZATION="Bearer ghp_..."
```

See the [Environment Credential Overrides](#environment-based-credential-overrides) section for more details.

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

### 1. Cloud-Based Ability Registry

Abilities are stored on the Unbrowse API and fetched on-demand:

- **Initialization**: MCP server fetches all abilities via `GET /my/abilities`
- **Search**: Client-side filtering on ability name, description, and service
- **Caching**: Search results are cached locally for immediate execution
- **Metadata**: Each ability includes wrapper code, schemas, headers, and dependencies

### 2. Credential Management

Credentials follow a zero-knowledge encryption model:

1. **Client-side encryption**: Credentials encrypted with AES-256-GCM before upload
2. **Server storage**: Only encrypted values stored on Unbrowse API
3. **Local decryption**: MCP server decrypts using your password (never sent to server)
4. **Automatic injection**: Decrypted credentials injected into API requests via fetch override

### Environment-Based Credential Overrides

Some tools (especially internal automation endpoints) expect API keys that live in your runtime environment. You can inject these headers without storing them in the encrypted cookie jar:

- **JSON mapping (recommended):** set `UNBROWSE_TOOL_HEADERS` (or `UNBROWSE_DYNAMIC_HEADERS`, `TOOL_DYNAMIC_HEADERS`, `MCP_TOOL_HEADERS`) to a JSON object whose keys match `dynamic_header_keys`. Example:

  ```bash
  UNBROWSE_TOOL_HEADERS='{"reverse-engineer::x-api-key":"sk_live_123","reverse-engineer::authorization":"Bearer eyJ..."}'
  ```

- **Sanitized variables:** expose individual headers with the `DOMAIN__HEADER` pattern (uppercase, non-alphanumeric → `_`). Examples:
  - `reverse-engineer::x-api-key` → `REVERSE_ENGINEER__X_API_KEY=sk_live_123`
  - `www.wom.fun::authorization` → `WWW_WOM_FUN__AUTHORIZATION=Bearer eyJ...`

- **Convenience keys:** when the header is `x-api-key` / `api-key`, the server also checks `REVERSE_ENGINEER_API_KEY`, `UNBROWSE_API_KEY`, and plain `API_KEY`.

Environment values are merged with stored credentials before execution, so you can mix both approaches. If any required headers are still missing, the MCP response lists the unresolved keys and domains so you know exactly what to provide.

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

Abilities are filtered based on credential availability:

- **No dynamic headers required** → Always accessible (public APIs)
- **Has dynamic headers** → Only accessible if you have ALL required credentials (either stored in API or via environment variables)
- **Favorited abilities** → Always shown regardless of credentials

This ensures you only see abilities you can actually execute.

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

### Password Security

The `PASSWORD` should be:

- At least 32 characters long for strong encryption
- Stored securely in your MCP configuration
- Never committed to version control
- Unique to your Unbrowse MCP installation
- Used only to encrypt/decrypt your own stored credentials

## API Integration

This MCP server integrates with the Unbrowse API to provide:

### ✅ Ability Registry
- Fetches abilities from `GET /my/abilities`
- Supports semantic search and filtering
- Caches results for immediate execution
- Automatic credential coverage checking

### ✅ Credential Management
- Zero-knowledge encryption (password never sent to server)
- Fetches encrypted credentials from `GET /my/credentials/:domain`
- Client-side AES-256-GCM decryption
- Automatic credential expiration on 401+ errors

### ✅ Wrapper Execution
- Evaluates wrapper code in VM sandbox
- Fetch override with automatic header injection
- Static + dynamic header merging
- Response transformation support

### ✅ API Indexing
- Ingest new endpoints via `POST /ingest/api`
- Supports URLs and curl commands
- Optional tool (configurable via `enableIndexTool`)

### 🔗 Related Documentation
- **[API Complete Guide](./docs/API_COMPLETE_GUIDE.md)** - Full API reference
- **[Authentication](./docs/AUTHENTICATION.md)** - JWT and API key auth
- **[Credentials Storage](./docs/CREDENTIALS_STORAGE.md)** - Encryption implementation

## File Structure

```
unbrowse/
├── src/
│   ├── index.ts                        # MCP server with tool definitions
│   ├── api-client.ts                   # Unbrowse API client (authenticated)
│   ├── wrapper-executor-enhanced.ts    # Wrapper eval with fetch override
│   ├── crypto-utils.ts                 # AES-256-GCM credential decryption
│   └── types.ts                        # TypeScript type definitions
├── docs/
│   ├── API_COMPLETE_GUIDE.md           # Complete API reference
│   ├── AUTHENTICATION.md               # Auth implementation details
│   └── CREDENTIALS_STORAGE.md          # Encryption guide
├── smithery.yaml                       # Config schema (apiKey, password)
├── package.json
├── tsconfig.json
└── README.md
```

## Testing

### Test API Connection

First, verify your API key works:

```bash
curl -X GET https://agent.unbrowse.ai/my/abilities \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Test Ability Search

Using the MCP client (e.g., Claude Desktop, Cline):

```typescript
// Search for abilities
search_abilities({
  query: "github user",
  limit: 10
})
```

### Test Ability Execution

```typescript
// Execute a public API (no credentials needed)
execute_ability({
  ability_id: "some-public-api",
  params: '{"key": "value"}'
})

// Execute with credentials (automatically decrypted and injected)
execute_ability({
  ability_id: "authenticated-api",
  params: '{"username": "octocat"}'
})
```

### Test API Indexing (Optional)

```typescript
ingest_api_endpoint({
  input: "https://api.github.com/users/octocat",
  service_name: "github",
  ability_name: "get-github-user",
  description: "Fetch GitHub user profile"
})
```

## Roadmap

- [x] API key authentication with Unkey integration
- [x] Zero-knowledge credential encryption
- [x] Cloud-based ability registry
- [x] Semantic search for abilities
- [x] Automatic credential injection
- [x] Response transformation support
- [x] Dependency order tracking
- [ ] Browser extension for credential capture
- [ ] Webhook support for async execution
- [ ] Ability versioning and upgrades
- [ ] Analytics dashboard
- [ ] Collaborative ability sharing

## Contributing

This MCP server is part of the Unbrowse platform. For questions or contributions:

- **API Issues**: Check the [API Complete Guide](./docs/API_COMPLETE_GUIDE.md)
- **MCP Issues**: Open an issue on GitHub
- **Feature Requests**: Discuss in GitHub Discussions

## License

ISC
