# API Ingestion Guide

## Overview

The API Ingestion feature allows you to quickly index a single API endpoint without needing a HAR file. Simply provide a URL or curl command, and the system will:

1. Execute the API request to get a live response
2. Automatically generate **input schema** from URL parameters and request body
3. Automatically generate **output schema** from the actual response using genson-js
4. Create a wrapper function for the endpoint
5. Store the ability in the vector database for semantic search

## Use Cases

- **Quick API indexing**: Add known APIs to your collection without capturing HAR files
- **Testing APIs**: Verify API responses and generate schemas on the fly
- **Documentation**: Auto-generate schemas for API endpoints
- **Prototyping**: Quickly create wrappers for external APIs

## API Endpoints

### 1. Single Endpoint Ingestion

```
POST /ingest/api
```

Direct ingestion of a single API endpoint.

#### Request Body

```json
{
  "input": "string (required)",
  "service_name": "string (required)",
  "ability_name": "string (optional)",
  "description": "string (optional)"
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | string | ✅ | API URL or complete curl command |
| `service_name` | string | ✅ | Service name for grouping (e.g., "github", "stripe") |
| `ability_name` | string | ❌ | Custom ability name (auto-generated from URL if not provided) |
| `description` | string | ❌ | Description of what this endpoint does (auto-generated if not provided) |

#### Response

```json
{
  "success": true,
  "message": "Successfully ingested API endpoint: get_users_octocat",
  "ability_id": "get-users-octocat",
  "ability_name": "get_users_octocat",
  "input_schema": { /* JSON Schema */ },
  "output_schema": { /* JSON Schema */ },
  "wrapper_path": "/app/generated/github/data/get_users_octocat.json",
  "vector_id": 12345
}
```

---

### 2. Batch URL Ingestion

```
POST /ingest/urls
```

Ingest multiple URLs from text (like API documentation, README files, or curl command lists). The agent will extract all URLs/curl commands and process them autonomously.

#### Request Body

```json
{
  "text": "string (required)",
  "service_name": "string (required)"
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | ✅ | Text containing URLs, curl commands, or API documentation |
| `service_name` | string | ✅ | Service name for grouping all discovered endpoints |

#### Response

```json
{
  "success": true,
  "message": "URL ingestion started. Processing will continue in the background.",
  "data": {
    "session_id": "url-ingestion-1761026000000-abc123",
    "service_name": "github",
    "text_length": 1234,
    "storage": {
      "vector_db": "Abilities stored in user-scoped database with vector embeddings",
      "backup_dir": "generated/",
      "note": "Use GET /my/abilities to list your abilities, or search with GET /public/abilities?q=<query> after publishing"
    },
    "status": "Processing in background. Check server logs for progress."
  }
}
```

---

## Usage Examples

### Single Endpoint Examples

#### Example 1: Simple GET Request

**Request:**
```bash
curl -X POST http://localhost:4111/ingest/api \
  -H "Content-Type: application/json" \
  -d '{
    "input": "https://api.github.com/users/octocat",
    "service_name": "github"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully ingested API endpoint: get_users_octocat",
  "ability_id": "get-users-octocat",
  "ability_name": "get_users_octocat",
  "input_schema": {
    "type": "object",
    "properties": {},
    "required": []
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "login": { "type": "string" },
      "id": { "type": "number" },
      "avatar_url": { "type": "string" },
      "name": { "type": "string" }
    },
    "required": ["login", "id", "avatar_url", "name"]
  },
  "wrapper_path": "/app/generated/github/data/get_users_octocat.json",
  "vector_id": 1
}
```

#### Example 2: API with Query Parameters

**Request:**
```bash
curl -X POST http://localhost:4111/ingest/api \
  -H "Content-Type: application/json" \
  -d '{
    "input": "https://api.example.com/search?q=test&limit=10",
    "service_name": "example-api",
    "description": "Search API with query and limit parameters"
  }'
```

**Generated Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "q": {
      "type": "string",
      "description": "Query parameter: q",
      "example": "test"
    },
    "limit": {
      "type": "number",
      "description": "Query parameter: limit",
      "example": 10
    }
  },
  "required": ["q", "limit"]
}
```

#### Example 3: Using curl Command

**Request:**
```bash
curl -X POST http://localhost:4111/ingest/api \
  -H "Content-Type: application/json" \
  -d '{
    "input": "curl -X POST https://api.example.com/users -H \"Content-Type: application/json\" -H \"Authorization: Bearer token123\" -d {\"name\":\"John\",\"email\":\"john@example.com\"}",
    "service_name": "example-api",
    "ability_name": "create_user",
    "description": "Create a new user"
  }'
```

**What gets extracted:**
- **Method:** POST
- **URL:** https://api.example.com/users
- **Headers:** Content-Type, Authorization (redacted in storage)
- **Body:** `{"name":"John","email":"john@example.com"}`

**Generated Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Body parameter: name",
      "example": "John"
    },
    "email": {
      "type": "string",
      "description": "Body parameter: email",
      "example": "john@example.com"
    }
  },
  "required": ["name", "email"]
}
```

---

### Batch URL Ingestion Examples

#### Example 4: Ingest from README Content

**Request:**
```bash
curl -X POST http://localhost:4111/ingest/urls \
  -H "Content-Type: application/json" \
  -d '{
    "text": "# GitHub API\n\nGet user info: https://api.github.com/users/octocat\nList repos: https://api.github.com/users/octocat/repos\nGet repo: https://api.github.com/repos/octocat/hello-world",
    "service_name": "github"
  }'
```

**What happens:**
- Agent extracts 3 URLs from the text
- Ingests each one using `ingest-api-endpoint` tool
- All abilities stored under service name "github"
- Processing happens in background

#### Example 5: Ingest from curl Command List

**Request:**
```bash
curl -X POST http://localhost:4111/ingest/urls \
  -H "Content-Type: application/json" \
  -d '{
    "text": "curl https://api.stripe.com/v1/customers\ncurl https://api.stripe.com/v1/charges\ncurl https://api.stripe.com/v1/invoices",
    "service_name": "stripe"
  }'
```

#### Example 6: Ingest from API Documentation

**Request:**
```bash
curl -X POST http://localhost:4111/ingest/urls \
  -H "Content-Type: application/json" \
  -d '{
    "text": "## Available Endpoints\n\n### Users\n- GET /api/v1/users - List all users\n- GET /api/v1/users/:id - Get user by ID\n\nExample:\ncurl -X GET https://api.example.com/v1/users\ncurl -X GET https://api.example.com/v1/users/123",
    "service_name": "example-api"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "URL ingestion started. Processing will continue in the background.",
  "data": {
    "session_id": "url-ingestion-1761026000000-abc123",
    "service_name": "example-api",
    "text_length": 234,
    "status": "Processing in background. Check server logs for progress."
  }
}
```

**Check Progress:**
```bash
# Watch server logs
docker logs -f reverse-engineer-app

# Or search for ingested abilities
curl "http://localhost:4111/abilities/search?q=users"
```

---

## Generated Files

### File Structure

```
generated/
└── {service_name}/
    └── data/
        └── {ability_name}.json
```

### Example Generated File

**Location:** `generated/github/data/get_users_octocat.json`

```json
{
  "session_id": "api-ingestion-1761026000000-abc123",
  "service_name": "github",
  "ability_id": "get-users-octocat",
  "ability_name": "get_users_octocat",
  "description": "GET /users/octocat - Auto-generated from API ingestion",
  "dynamic_header_keys": [],
  "static_headers": {
    "user-agent": "curl/7.64.1",
    "accept": "*/*"
  },
  "dynamic_headers": {},
  "input_schema": {
    "type": "object",
    "properties": {},
    "required": []
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "login": { "type": "string" },
      "id": { "type": "number" },
      "avatar_url": { "type": "string" }
    },
    "required": ["login", "id", "avatar_url"]
  },
  "dependency_order": [],
  "generated_at": "2025-10-21T08:00:00.000Z",
  "request_details": {
    "method": "GET",
    "url": "https://api.github.com/users/octocat",
    "headers": {},
    "body": null
  },
  "execution": {
    "success": true,
    "status": 200,
    "input": {},
    "output": { /* actual API response */ },
    "outputSchema": { /* genson-generated schema */ }
  },
  "wrapper_code": "export async function wrapper(payload, options) { /* ... */ }"
}
```

## Generated Wrapper Code

The tool automatically generates a wrapper function:

```javascript
export async function wrapper(payload, options) {
  options = options || {};

  const baseUrl = options.baseUrl || 'https://api.github.com';
  const url = new URL('/users/octocat', baseUrl);

  const headers = { ...(options.staticHeaders || {}), ...(options.dynamicHeaders || {}) };

  const fetchOptions = {
    method: 'GET',
    headers,
  };

  const response = await fetch(url.toString(), fetchOptions);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response;
}

export const DYNAMIC_HEADER_KEYS = [];
```

## Header Handling

### Dynamic Headers (Redacted)

Headers that contain credentials are automatically detected and redacted:

- `authorization`
- `cookie`
- `x-api-key`
- `apikey`

These headers are:
- Stored as `[REDACTED]` in the file and vector DB
- Marked in `dynamic_header_keys` array
- Expected to be provided at runtime via `options.dynamicHeaders`

### Static Headers (Preserved)

All other headers are preserved as-is and stored in `static_headers`.

## Vector Database Integration

All ingested abilities are automatically:

1. **Embedded** using Google Gemini embeddings
2. **Stored** in Infraxa Vector DB with metadata
3. **Searchable** via semantic search at `/abilities/search`

## Using the Reverse Agent

You can also use the reverse agent to ingest APIs programmatically:

```javascript
const agent = mastra.getAgent("reverseAgent");

const result = await agent.generate(
  "Ingest the GitHub user API: https://api.github.com/users/octocat",
  {
    memory: {
      thread: "api-ingestion-session",
      resource: "quick_ingest"
    }
  }
);
```

The agent has access to the `ingest-api-endpoint` tool and will use it automatically.

## Limitations

### Current Limitations

1. **Authentication:** The tool executes the request with headers provided in the curl command. If the API requires auth, include it in the curl command.

2. **Single Request Only:** This tool ingests ONE endpoint per call. For complex workflows with multiple dependent endpoints, use HAR ingestion instead.

3. **No Dynamic Parameter Detection:** Input schema is inferred from the provided example values. It cannot detect optional parameters or parameter constraints.

4. **Response-Based Schema:** Output schema is generated from a single response. It may not capture all possible response variations.

### When to Use HAR Ingestion Instead

Use HAR ingestion when you need:
- Multiple related endpoints
- Complete authentication flows
- Dependency chains between endpoints
- Multiple request/response examples

## Error Handling

### Common Errors

#### Missing Required Fields
```json
{
  "success": false,
  "error": "Missing required fields: input (URL or curl) and service_name are required"
}
```

**Solution:** Provide both `input` and `service_name`.

#### API Request Failed
```json
{
  "success": false,
  "message": "API request failed with status 401: Unauthorized"
}
```

**Solution:** Check authentication headers in your curl command or URL.

#### Invalid URL
```json
{
  "success": false,
  "message": "Failed to extract URL from input"
}
```

**Solution:** Ensure the URL is valid or the curl command is properly formatted.

## Best Practices

1. **Service Naming:** Use consistent service names (e.g., "github", "stripe", "openai")

2. **Descriptions:** Provide clear descriptions for better semantic search:
   ```json
   {
     "description": "Get user profile by username. Returns name, avatar, bio, and stats."
   }
   ```

3. **Ability Naming:** Use descriptive names:
   - ✅ `create_user`, `get_order_status`
   - ❌ `api1`, `endpoint2`

4. **Test First:** Test the curl command or URL manually before ingesting

5. **Redact Secrets:** Don't include real API keys in examples. Use placeholders:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN_HERE" ...
   ```

## Endpoint Comparison

| Feature | `/ingest/api` | `/ingest/urls` | `/ingest` (HAR) |
|---------|---------------|----------------|-----------------|
| **Input** | Single URL/curl | Text with URLs | HAR file upload |
| **Processing** | Synchronous | Async (agent) | Async (agent) |
| **Best For** | Single endpoint | Multiple known URLs | Complete app flows |
| **Dependencies** | Not supported | Not supported | Fully supported |
| **Auth Flows** | Basic | Basic | Complete flows |
| **Schema Accuracy** | Single example | Single example each | Multiple examples |
| **Speed** | Fast | Medium | Slower |
| **Agent Used** | No (direct tool) | Yes (extracts URLs) | Yes (analyzes flow) |

## Proxy Configuration

The API ingestion and wrapper execution features support optional proxy configuration for routing requests through a proxy server.

### Setup

Add the `PROXY_URL` environment variable to your `.env` file:

```bash
# Format: http://username:password@host:port
PROXY_URL=http://user:pass@geo.iproyal.com:12321
```

### What Uses the Proxy

The proxy is automatically applied to:

1. **API Ingestion Requests** - When executing live API requests during ingestion
2. **Generated Wrapper Code** - All generated wrapper functions will use the proxy if configured
3. **Wrapper Execution Tests** - When testing wrappers with the execute tool

### What Does NOT Use the Proxy

- Vector database requests (Infraxa)
- PostgreSQL database connections
- HAR file loading
- Internal service communication

### Example

```bash
# Set proxy in .env
PROXY_URL=http://YDBgUAMXA1mV8fkH:Kwn2JUIrxxBmC6ay@geo.iproyal.com:12321

# Ingest API - request will go through proxy
curl -X POST http://localhost:4111/ingest/api \
  -H "Content-Type: application/json" \
  -d '{
    "input": "https://api.github.com/users/octocat",
    "service_name": "github"
  }'
```

**Console Output:**
```
[API-Ingestion] Executing live API request... (via proxy: http://YDB***@geo.iproyal.com:12321)
```

### Generated Wrapper Example

When proxy is configured, generated wrappers will include:

```javascript
export async function wrapper(payload, options) {
  options = options || {};

  const baseUrl = options.baseUrl || 'https://api.github.com';
  const url = new URL('/users/octocat', baseUrl);

  const headers = { ...(options.staticHeaders || {}), ...(options.dynamicHeaders || {}) };

  let fetchOptions = {
    method: 'GET',
    headers,
  };

  // Apply proxy if configured
  if (process.env.PROXY_URL) {
    try {
      const { ProxyAgent } = await import('undici');
      const proxyAgent = new ProxyAgent(process.env.PROXY_URL);
      fetchOptions.dispatcher = proxyAgent;
    } catch (error) {
      console.warn('[Wrapper] Failed to configure proxy:', error.message);
    }
  }

  const response = await fetch(url.toString(), fetchOptions);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response;
}
```

### Proxy Status Logging

The system will log proxy status:
- Credentials are redacted in logs for security
- Only first 3 characters of username shown
- Password always hidden

## See Also

- [ABILITY_FORMAT.md](ABILITY_FORMAT.md) - Ability storage format
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [VECTOR_DB_INTEGRATION.md](VECTOR_DB_INTEGRATION.md) - Vector database details
