# Dynamic Headers Storage and Usage Guide

## Overview

The system stores information about which HTTP headers require dynamic values (credentials) for each ability. This allows the system to track which abilities are publicly accessible vs. which require authentication.

## Storage Architecture

### Vector Database Storage

When abilities are extracted from HAR files and stored in the vector database, the following header-related metadata is preserved:

```typescript
{
  ability_id: "unique-id",
  ability_name: "Get User Profile",
  service_name: "api.github.com",
  description: "Retrieves user profile",
  embedding: [...], // 3072-dim vector
  metadata: {
    // Static headers (always the same, safe to expose)
    static_headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },

    // Dynamic header keys (requires credentials at runtime)
    dynamic_header_keys: ["Authorization", "X-API-Key"],

    // Redacted dynamic header values (for reference only)
    dynamic_headers: {
      "Authorization": "[REDACTED]",
      "X-API-Key": "[REDACTED]"
    },

    // Other metadata
    session_id: "session-123",
    input_schema: {...},
    wrapper_code: "...",
    // ...
  }
}
```

### File Backup Storage

The same information is stored in JSON files at `data/{ability_name}.json`:

```json
{
  "ability_id": "...",
  "ability_name": "...",
  "dynamic_header_keys": ["Authorization"],
  "static_headers": {...},
  "dynamic_headers": {
    "Authorization": "[REDACTED]"
  },
  "wrapper_code": "...",
  "execution": {...}
}
```

## Data Model

### Ability Interface

```typescript
interface Ability {
  ability_id: string;
  ability_name: string;
  service_name: string;
  description: string;

  // Header information
  requires_dynamic_headers: boolean;      // true if dynamic_header_keys.length > 0
  dynamic_header_keys?: string[];         // Which headers need credentials
  static_headers?: Record<string, string>; // Safe headers

  // Other fields
  input_schema?: any;
  wrapper_code?: string;
  // ...
}
```

### Ability Record Interface

```typescript
interface AbilityRecord {
  ability: Ability;
  record: {
    input: {
      static_headers?: any[];
    };
    dynamic_headers_required?: string[]; // Same as dynamic_header_keys
    wrapper_code?: string;
    execution?: any;
  };
}
```

## Public vs Private Abilities

### Public Abilities (No Authentication)

Abilities with **no dynamic headers** are exposed through the public API:

- `dynamic_header_keys: []`
- `requires_dynamic_headers: false`
- Accessible via `/abilities` and `/abilities/search` endpoints

**Example:**
```json
{
  "ability_name": "Get Public Repository Info",
  "requires_dynamic_headers": false,
  "dynamic_header_keys": [],
  "static_headers": {
    "Accept": "application/json"
  }
}
```

### Private Abilities (Require Authentication)

Abilities with **dynamic headers** are stored but NOT exposed through public API:

- `dynamic_header_keys: ["Authorization", ...]`
- `requires_dynamic_headers: true`
- Filtered out from public endpoints

**Example:**
```json
{
  "ability_name": "Get Private User Profile",
  "requires_dynamic_headers": true,
  "dynamic_header_keys": ["Authorization"],
  "static_headers": {
    "Accept": "application/json"
  }
}
```

## How It Works

### 1. HAR Ingestion

When a HAR file is uploaded via `/ingest`:

```
HAR File → Reverse Agent → Extract Abilities → Identify Dynamic Headers
                                                        ↓
                                              Store in Vector DB
```

The system:
1. Analyzes each request to identify which headers vary across requests
2. Marks varying headers as "dynamic" (likely credentials)
3. Stores dynamic header **keys** (not values) in metadata
4. Redacts dynamic header **values** for security

### 2. Ability Retrieval

When searching or listing abilities:

```typescript
// Repository filters abilities
const dynamicHeaderKeys = attrs.dynamic_header_keys || [];

if (dynamicHeaderKeys.length > 0) {
  continue; // Skip - requires authentication
}

// Only return abilities with no dynamic headers
return {
  requires_dynamic_headers: false,
  dynamic_header_keys: [],
  // ...
}
```

### 3. Execution Requirements

When a consumer wants to execute an ability:

```typescript
// Get ability details
const ability = await fetch('/abilities/abc123').then(r => r.json());

// Check if credentials needed
if (ability.requires_dynamic_headers) {
  console.log('Headers needed:', ability.dynamic_header_keys);
  // User must provide these headers
}

// Execute with static headers only (public abilities)
const result = await executeAbility({
  headers: ability.static_headers,
  // ...
});
```

## Storage Flow Diagram

```
┌─────────────────┐
│   HAR Upload    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Reverse Agent Analysis │
│  - Extract requests     │
│  - Identify headers     │
│  - Classify dynamic vs  │
│    static               │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Store in Vector DB             │
│  ─────────────────────          │
│  metadata: {                    │
│    dynamic_header_keys: [...],  │ ← Keys stored
│    dynamic_headers: {           │
│      "Auth": "[REDACTED]"       │ ← Values redacted
│    },                           │
│    static_headers: {...}        │ ← Safe to expose
│  }                              │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Backup to JSON File    │
│  - Same data structure  │
│  - Disaster recovery    │
└─────────────────────────┘
```

## API Behavior

> **Note**: Legacy routes (`GET /abilities`, `GET /abilities/search`, `GET /abilities/:id`) have been removed.
> Use the new user-scoped routes instead.

### GET /my/abilities

Returns user's own abilities (requires authentication):

```json
{
  "success": true,
  "count": 10,
  "abilities": [
    {
      "userAbilityId": "uab_123",
      "abilityName": "Get User Profile",
      "serviceName": "myapi",
      "dynamicHeadersRequired": true,
      "dynamicHeaderKeys": ["Authorization"],
      "isFavorite": false,
      "isPublished": false
    }
  ]
}
```

**Automatically filters out abilities requiring credentials unless:**
- The ability is favorited, OR
- User has stored credentials for that domain, OR
- The ability doesn't require credentials

### GET /public/abilities?q=...

Search published abilities (no auth required, but requires search query):

```json
{
  "success": true,
  "count": 3,
  "query": "github",
  "abilities": [
    {
      "userAbilityId": "uab_456",
      "abilityName": "Get GitHub User",
      "serviceName": "github",
      "dynamicHeadersRequired": false,
      "isPublished": true
    }
  ]
}
```

**Security**: Requires `?q=` parameter to prevent bulk extraction.

### Legacy Routes (Removed)

Includes header requirements:

```json
{
  "metadata": {
    "input_schema": {...},
    "static_headers": {...},
    "dynamic_headers_required": [] // Empty for public abilities
  }
}
```

## Security Considerations

### What is Stored

✅ **Safe to Store:**
- Header names/keys (e.g., "Authorization", "X-API-Key")
- Static header values (e.g., "Content-Type: application/json")
- Redacted placeholders (e.g., "Authorization: [REDACTED]")

❌ **Never Stored:**
- Actual credential values
- API keys, tokens, passwords
- Session cookies

### Why We Redact

Dynamic header values contain sensitive credentials:
- Bearer tokens
- API keys
- Session IDs
- OAuth tokens

These are **redacted before storage** to prevent credential leakage.

## Use Cases

### Use Case 1: Public API Index

**Goal:** Build a searchable index of public APIs

```typescript
// Search for public endpoints
const results = await fetch('/abilities/search?q=get user repositories');

// All results are public (no auth required)
results.abilities.forEach(ability => {
  console.log(ability.ability_name);
  console.log('Auth required:', ability.requires_dynamic_headers); // Always false
});
```

### Use Case 2: Credential Injection (Future)

**Goal:** Execute abilities that require authentication

```typescript
// Get ability with auth requirements
const ability = getAbilityFromStorage('private-endpoint');

if (ability.requires_dynamic_headers) {
  // Inject credentials
  const headers = {
    ...ability.static_headers,
    // Add dynamic headers
    'Authorization': getUserToken(),
    'X-API-Key': getApiKey()
  };

  // Execute with credentials
  await executeAbility(ability, { headers });
}
```

### Use Case 3: Capability Discovery

**Goal:** Understand what APIs can do

```typescript
// Browse all public capabilities
const abilities = await fetch('/abilities').then(r => r.json());

abilities.forEach(ability => {
  console.log(`${ability.service_name}: ${ability.description}`);
  console.log('Static headers:', ability.static_headers);
  console.log('Auth needed:', ability.requires_dynamic_headers);
});
```

## Future Enhancements

1. **Credential Vault Integration**
   - Store user-provided credentials
   - Match credentials to dynamic_header_keys
   - Automatically inject at execution time

2. **OAuth Flow Support**
   - Detect OAuth requirements from headers
   - Guide users through auth flow
   - Store refresh tokens securely

3. **Header Templates**
   - Define templates for common auth patterns
   - Map header keys to credential types
   - Suggest auth methods to users

4. **Selective Exposure**
   - Allow exposing private abilities to authenticated users
   - API key-based access control
   - Per-user ability permissions

## Summary

| Aspect | Implementation |
|--------|---------------|
| **Storage** | Vector DB metadata + JSON backup |
| **Keys Stored** | Yes - dynamic_header_keys array |
| **Values Stored** | No - redacted as "[REDACTED]" |
| **Public API** | Filters out abilities with dynamic headers |
| **Private Abilities** | Stored but not exposed via API |
| **Security** | No credentials stored, only header names |

The system successfully tracks which headers are dynamic while maintaining security by never storing actual credential values.
