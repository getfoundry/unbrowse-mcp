# Ability Storage Format Documentation

## Overview

This document describes the comprehensive format in which API abilities are stored in the system. Abilities represent individual API endpoints that have been reverse-engineered from HAR (HTTP Archive) files and are stored in both a vector database for semantic search and as JSON files for backup.

## Root Structure

All abilities are stored within a response object with the following structure:

```json
{
  "success": true,
  "count": 16,
  "abilities": [
    // Array of ability objects
  ]
}
```

### Root Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Indicates if the operation was successful |
| `count` | number | Total number of abilities in the response |
| `abilities` | array | Array of ability objects |

---

## Individual Ability Object Structure

Each ability object contains comprehensive metadata about the API endpoint:

```json
{
  "ability_id": "get-token-top-voices",
  "ability_name": "get_token_top_voices",
  "service_name": "wom-fun",
  "description": "Fetch top 5 voices (influencers) for a token by WOM rank...",
  "input_schema": { /* JSON Schema */ },
  "request_method": "GET",
  "request_url": "https://example.com/api/endpoint",
  "dependency_order": ["get-token-details"],
  "requires_dynamic_headers": false,
  "dynamic_header_keys": [],
  "static_headers": { /* Headers object */ },
  "wrapper_code": "/* JavaScript code */",
  "generated_at": "2025-10-20T16:23:58.751Z"
}
```

---

## Detailed Field Descriptions

### Core Identity Fields

| Field | Type | Required | Example | Description |
|-------|------|----------|---------|-------------|
| `ability_id` | string | ✅ | `"get-token-top-voices"` | Unique identifier for the ability (kebab-case) |
| `ability_name` | string | ✅ | `"get_token_top_voices"` | Programmatic name (snake_case) |
| `service_name` | string | ✅ | `"wom-fun"` | Service/domain name this ability belongs to |
| `description` | string | ✅ | `"Fetch top 5 voices..."` | Human-readable description with usage examples |

### Schema Definition Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `input_schema` | object | ✅ | JSON Schema defining the input parameters |
| `request_method` | string | ✅ | HTTP method (GET, POST, PUT, DELETE, etc.) |
| `request_url` | string | ✅ | Full URL with encoded query parameters |

### Dependency & Execution Fields

| Field | Type | Required | Example | Description |
|-------|------|----------|---------|-------------|
| `dependency_order` | array | ✅ | `["get-token-details"]` | List of ability IDs that should be executed first |
| `requires_dynamic_headers` | boolean | ✅ | `false` | Whether the ability requires dynamically generated headers |
| `dynamic_header_keys` | array | ✅ | `[]` | List of header keys that need dynamic values |

### Header Management Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `static_headers` | object | ✅ | Static HTTP headers that don't change between requests |

### Code Generation Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `wrapper_code` | string | ✅ | Generated JavaScript wrapper function for execution |
| `generated_at` | string | ✅ | ISO 8601 timestamp when the ability was generated |

---

## Input Schema Format

The `input_schema` field follows JSON Schema specification:

```json
{
  "type": "object",
  "description": "Parameters for top voices.",
  "properties": {
    "token_symbol": {
      "type": "string",
      "description": "Token symbol.",
      "example": "$fdry"
    }
  },
  "required": ["token_symbol"]
}
```

### Schema Components

| Component | Type | Description |
|-----------|------|-------------|
| `type` | string | Always `"object"` for ability inputs |
| `description` | string | Human-readable description of the parameters |
| `properties` | object | Map of parameter names to their schemas |
| `required` | array | List of required parameter names |

### Parameter Schema

Each parameter in `properties` can include:

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Data type (`string`, `number`, `boolean`, `array`) |
| `description` | string | Parameter description |
| `example` | any | Example value for the parameter |
| `default` | any | Default value if not provided |

---

## Request URL Format

The `request_url` field contains the fully constructed URL with encoded parameters:

```json
{
  "request_url": "https://vtnzhqawildiecaasapv.supabase.co/rest/v1/token_top_voices?select=user_name%2Cprofile_image_url&token_symbol=eq.%24fdry&order=wom_voice_rank.asc&limit=5"
}
```

### URL Components

- **Base URL:** The API endpoint base
- **Path:** Resource path (e.g., `/rest/v1/token_top_voices`)
- **Query Parameters:** URL-encoded parameters with proper escaping
- **Filters:** Database-style filters (e.g., `eq.%24fdry` for equals `$fdry`)

---

## Static Headers Format

The `static_headers` object contains all HTTP headers that remain constant:

```json
{
  "host": "vtnzhqawildiecaasapv.supabase.co",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0",
  "accept": "*/*",
  "accept-language": "en-US,en;q=0.5",
  "accept-encoding": "gzip, deflate, br, zstd",
  "referer": "https://www.wom.fun/",
  "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "origin": "https://www.wom.fun",
  "sec-gpc": "1",
  "connection": "keep-alive",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "cross-site",
  "priority": "u=4",
  "te": "trailers"
}
```

### Common Header Categories

| Category | Typical Headers |
|----------|-----------------|
| **Authentication** | `apikey`, `authorization`, `cookie` |
| **Client Info** | `user-agent`, `origin`, `referer` |
| **Content Negotiation** | `accept`, `accept-language`, `accept-encoding` |
| **Security** | `sec-gpc`, `sec-fetch-*` |
| **Connection** | `connection`, `te`, `priority` |

---

## Wrapper Code Format

The `wrapper_code` field contains a complete JavaScript function for executing the ability:

```javascript
export async function wrapper(payload, options) {
  options = options || {};

  if (!payload.token_symbol) {
    throw new Error('token_symbol is required');
  }

  const baseUrl = options.baseUrl || 'https://vtnzhqawildiecaasapv.supabase.co';
  const url = new URL('/rest/v1/token_top_voices', baseUrl);
  url.searchParams.set('select', 'user_name,profile_image_url');
  url.searchParams.set('token_symbol', `eq.${payload.token_symbol}`);
  url.searchParams.set('order', 'wom_voice_rank.asc');
  url.searchParams.set('limit', '5');

  const headers = { ...(options.staticHeaders || {}), ...(options.dynamicHeaders || {}) };
  const response = await fetch(url.toString(), { method: 'GET', headers });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response;
}

export const DYNAMIC_HEADER_KEYS = [];
```

### Wrapper Components

| Component | Description |
|-----------|-------------|
| **Input Validation** | Checks for required parameters |
| **URL Construction** | Builds the request URL dynamically |
| **Parameter Handling** | Converts input to URL parameters |
| **Header Merging** | Combines static and dynamic headers |
| **Error Handling** | Throws descriptive errors for failures |
| **Response Return** | Returns the fetch response object |

### Dynamic Header Keys

The `DYNAMIC_HEADER_KEYS` export lists headers that need dynamic values:

```javascript
export const DYNAMIC_HEADER_KEYS = []; // Empty for static-only abilities
```

---

## Dependency Order Format

The `dependency_order` array defines execution dependencies:

```json
{
  "dependency_order": ["get-token-details"]
}
```

### Dependency Types

| Dependency Type | Example | Use Case |
|-----------------|---------|----------|
| **Prerequisite** | `["get-token-details"]` | Must get token info before other operations |
| **Sequential** | `["step1", "step2"]` | Multiple steps in specific order |
| **None** | `[]` | Independent operation |

---

## Dynamic Headers Support

### Static-Only Abilities (Most Common)

```json
{
  "requires_dynamic_headers": false,
  "dynamic_header_keys": []
}
```

### Dynamic Header Abilities

```json
{
  "requires_dynamic_headers": true,
  "dynamic_header_keys": ["authorization", "x-csrf-token"]
}
```

**Note:** Abilities requiring dynamic headers are filtered out from the public API index.

---

## Timestamp Format

The `generated_at` field uses ISO 8601 format:

```json
{
  "generated_at": "2025-10-20T16:23:58.751Z"
}
```

### Format Components

- **Date:** `2025-10-20` (YYYY-MM-DD)
- **Time:** `16:23:58.751` (HH:MM:SS.sss)
- **Timezone:** `Z` (UTC)

---

## Storage Implementation

### Vector Database Storage

Abilities are stored in a vector database with:

- **Embeddings:** Generated from `description` + `ability_name`
- **Metadata:** All ability fields as searchable attributes
- **Collections:** Organized by `service_name`

### JSON File Backup

Abilities are also stored as JSON files in the `data/` directory:

```
data/
├── abilities-2025-10-20.json
├── abilities-2025-10-21.json
└── ...
```

---

## Example Complete Ability

Here's a complete example showing all fields:

```json
{
  "ability_id": "get-token-top-voices",
  "ability_name": "get_token_top_voices",
  "service_name": "wom-fun",
  "description": "Fetch top 5 voices (influencers) for a token by WOM rank. Returns usernames and profile images. Use for identifying key promoters. Example: token_symbol='$fdry'.",
  "input_schema": {
    "type": "object",
    "description": "Parameters for top voices.",
    "properties": {
      "token_symbol": {
        "type": "string",
        "description": "Token symbol.",
        "example": "$fdry"
      }
    },
    "required": ["token_symbol"]
  },
  "request_method": "GET",
  "request_url": "https://vtnzhqawildiecaasapv.supabase.co/rest/v1/token_top_voices?select=user_name%2Cprofile_image_url&token_symbol=eq.%24fdry&order=wom_voice_rank.asc&limit=5",
  "dependency_order": ["get-token-details"],
  "requires_dynamic_headers": false,
  "dynamic_header_keys": [],
  "static_headers": {
    "host": "vtnzhqawildiecaasapv.supabase.co",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0",
    "accept": "*/*",
    "accept-language": "en-US,en;q=0.5",
    "accept-encoding": "gzip, deflate, br, zstd",
    "referer": "https://www.wom.fun/",
    "accept-profile": "public",
    "apikey": "SUPABASE_ANON_KEY_REDACTED",
    "authorization": "Bearer SUPABASE_ANON_KEY_REDACTED",
    "x-client-info": "supabase-js-web/2.51.0",
    "origin": "https://www.wom.fun",
    "sec-gpc": "1",
    "connection": "keep-alive",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
    "priority": "u=4",
    "te": "trailers"
  },
  "wrapper_code": "export async function wrapper(payload, options) {\n  options = options || {};\n\n  if (!payload.token_symbol) {\n    throw new Error('token_symbol is required');\n  }\n\n  const baseUrl = options.baseUrl || 'https://vtnzhqawildiecaasapv.supabase.co';\n  const url = new URL('/rest/v1/token_top_voices', baseUrl);\n  url.searchParams.set('select', 'user_name,profile_image_url');\n  url.searchParams.set('token_symbol', `eq.${payload.token_symbol}`);\n  url.searchParams.set('order', 'wom_voice_rank.asc');\n  url.searchParams.set('limit', '5');\n\n  const headers = { ...(options.staticHeaders || {}), ...(options.dynamicHeaders || {}) };\n  const response = await fetch(url.toString(), { method: 'GET', headers });\n  if (!response.ok) {\n    throw new Error(`Request failed: ${response.status} ${response.statusText}`);\n  }\n  return response;\n}\n\nexport const DYNAMIC_HEADER_KEYS = [];",
  "generated_at": "2025-10-20T16:23:58.751Z"
}
```

---

## Validation Rules

### Required Fields

All abilities must include:
- `ability_id`
- `ability_name`
- `service_name`
- `description`
- `input_schema`
- `request_method`
- `request_url`
- `dependency_order`
- `requires_dynamic_headers`
- `dynamic_header_keys`
- `static_headers`
- `wrapper_code`
- `generated_at`

### Naming Conventions

| Field | Convention | Example |
|-------|------------|---------|
| `ability_id` | kebab-case | `get-token-top-voices` |
| `ability_name` | snake_case | `get_token_top_voices` |
| `service_name` | kebab-case | `wom-fun` |

### URL Encoding

All URLs in `request_url` must be properly URL-encoded:
- Spaces → `%20`
- `$` → `%24`
- `&` → `%26`
- `=` → `%3D`
- `?` → `%3F`

---

## Usage Examples

### 1. Parsing an Ability

```javascript
const ability = response.abilities[0];

// Extract basic info
const { ability_id, ability_name, service_name } = ability;
console.log(`Ability: ${ability_name} from ${service_name}`);

// Parse input schema
const requiredParams = ability.input_schema.required;
const hasRequiredParams = requiredParams.length > 0;

// Check if public
const isPublic = !ability.requires_dynamic_headers;
```

### 2. Executing an Ability

```javascript
// Get wrapper code
const wrapperCode = ability.wrapper_code;

// Create function
const wrapperFn = new Function('return ' + wrapperCode)();

// Execute with parameters
const result = await wrapperFn(
  { token_symbol: '$fdry' }, // payload
  { baseUrl: 'https://api.example.com' } // options
);
```

### 3. Building Search Index

```javascript
// Create searchable text
const searchText = [
  ability.ability_name,
  ability.service_name,
  ability.description,
  ...Object.keys(ability.input_schema.properties)
].join(' ');

// Use for semantic search or filtering
```

---

## Evolution and Compatibility

### Version Considerations

- **Backward Compatibility:** New fields are added as optional
- **Breaking Changes:** Require version bump in API
- **Deprecated Fields:** Marked but maintained for compatibility

### Extensibility

The format supports:
- New header types
- Additional authentication methods
- Enhanced schema validation
- Custom execution contexts

---

## Related Documentation

- [API Documentation](./API_DOCUMENTATION.md) - How to access abilities via API
- [DATABASE.md](./DATABASE.md) - Database schema and storage
- [VECTOR_DB_INTEGRATION.md](./VECTOR_DB_INTEGRATION.md) - Vector database details
- [DYNAMIC_HEADERS_GUIDE.md](./DYNAMIC_HEADERS_GUIDE.md) - Dynamic header handling