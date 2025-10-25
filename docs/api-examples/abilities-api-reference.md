# Abilities API Reference

## Overview

The Abilities API allows you to retrieve, search, and manage AI agent abilities. Each ability represents a callable function or API endpoint that can be executed by agents.

## Authentication

All protected endpoints require Bearer token authentication:

```bash
Authorization: Bearer <your-api-key>
```

## Base URL

- **Production**: `https://agent.unbrowse.ai`
- **Local Development**: `http://localhost:4111`

---

## Endpoints

### GET `/my/abilities`

Retrieve the authenticated user's abilities (private + published).

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Maximum number of results (default: 50, max: 100) |
| `offset` | integer | No | Offset for pagination (default: 0) |
| `favorites` | boolean | No | Filter to only favorite abilities |
| `published` | boolean | No | Filter to only published abilities |

#### Example Request

```bash
curl -H "Authorization: Bearer re_A8xtVbkzVv18VXnjjgcAweREhrYuwJwSP1zBQ8wHnLC6" \
  "https://agent.unbrowse.ai/my/abilities?limit=5"
```

#### Response Schema

```typescript
interface AbilitiesResponse {
  success: boolean;
  count: number;
  abilities: Ability[];
}

interface Ability {
  // Identifiers
  userAbilityId: string;          // UUID for this user's copy
  userId: string;                 // User who owns/created this
  abilityId: string;              // Semantic ID (e.g., "get-featured-messages")
  vectorId: number | null;        // Infraxa vector DB ID (null if not published)

  // Basic Information
  abilityName: string;            // Display name
  serviceName: string;            // Service provider (e.g., "stocktwits")
  domain: string;                 // API domain (e.g., "api.stocktwits.com")
  description: string;            // What the ability does

  // Vector Embedding
  embedding: number[];            // Dense vector (1536 dimensions for semantic search)

  // Dynamic Headers (Authentication)
  dynamicHeaderKeys: string[];    // Headers that need user values (e.g., ["Authorization"])
  dynamicHeadersRequired: boolean; // Whether auth is required

  // Additional Metadata
  metadata: {
    [key: string]: any;           // Flexible metadata object
    dependency_order?: string[];   // Array of dependent ability IDs
    wrapper_code?: string;        // JavaScript wrapper function
    api_endpoint?: string;        // API endpoint path
    required_scopes?: string[];   // OAuth scopes needed
    rate_limit?: string;          // Rate limit info
  };

  // User Features
  isFavorite: boolean;            // User's favorite status
  isPublished: boolean;           // Published to marketplace
  publishedAt: string | null;     // ISO timestamp when published

  // Timestamps
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp
}
```

#### Example Response

```json
{
  "success": true,
  "count": 6,
  "abilities": [
    {
      "userAbilityId": "90ea11f6-a69b-4bd4-b021-0fd8181ba2c8",
      "userId": "1039aa81-14c1-4a15-9a96-f1c0e19e8e79",
      "abilityId": "get-featured-messages",
      "vectorId": null,
      "abilityName": "get-featured-messages",
      "serviceName": "stocktwits",
      "domain": "api.stocktwits.com",
      "description": "Retrieve featured messages and discussions from StockTwits. Use for getting highlighted content and community insights. Example: regions='US'.",
      "embedding": [
        -0.020843178,
        0.012308727,
        -0.0062409844,
        -0.05164682
        // ... 1532 more values (1536 total dimensions)
      ],
      "dynamicHeaderKeys": ["Authorization"],
      "dynamicHeadersRequired": true,
      "metadata": {},
      "isFavorite": true,
      "isPublished": false,
      "publishedAt": null,
      "createdAt": "2025-01-19T03:56:38.752Z",
      "updatedAt": "2025-01-19T05:47:41.129Z"
    },
    {
      "userAbilityId": "example-ability-2",
      "userId": "1039aa81-14c1-4a15-9a96-f1c0e19e8e79",
      "abilityId": "github-create-issue",
      "vectorId": 12345,
      "abilityName": "Create GitHub Issue",
      "serviceName": "GitHub API",
      "domain": "api.github.com",
      "description": "Creates a new issue in a GitHub repository with title, body, labels, and assignees. Requires repo access token.",
      "embedding": [0.123, -0.456, 0.789, -0.234],
      "dynamicHeaderKeys": ["Authorization", "X-GitHub-Api-Version"],
      "dynamicHeadersRequired": true,
      "metadata": {
        "dependency_order": ["github-auth-v1", "github-get-repo-v1"],
        "wrapper_code": "async function createIssue(repo, title, body) { /* ... */ }",
        "api_endpoint": "POST /repos/{owner}/{repo}/issues",
        "required_scopes": ["repo"],
        "rate_limit": "5000/hour"
      },
      "isFavorite": false,
      "isPublished": true,
      "publishedAt": "2025-01-15T10:30:00.000Z",
      "createdAt": "2025-01-10T08:00:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

---

## Field Descriptions

### Identifiers

- **userAbilityId**: Unique identifier for this specific user's instance of the ability
- **userId**: The user who created or owns this ability
- **abilityId**: A semantic, human-readable identifier (e.g., `github-create-issue`)
- **vectorId**: ID in the Infraxa vector database (only set when ability is published)

### Basic Information

- **abilityName**: Display name shown to users
- **serviceName**: The external service this ability interacts with (e.g., "GitHub API", "Stripe API")
- **domain**: The API domain for the service (e.g., `api.github.com`)
- **description**: Human-readable description of what the ability does

### Embedding

- **embedding**: A 1536-dimensional vector used for semantic similarity search. Generated from the ability's description using OpenAI's text-embedding model.

### Dynamic Headers

- **dynamicHeaderKeys**: Array of HTTP header names that require user-provided values (typically authentication headers like `Authorization`)
- **dynamicHeadersRequired**: Boolean indicating if the ability requires authentication

### Metadata

The `metadata` field is a flexible JSON object that can contain:

- **dependency_order**: Array of ability IDs that this ability depends on
- **wrapper_code**: JavaScript code that wraps the API call
- **api_endpoint**: The HTTP endpoint path
- **required_scopes**: OAuth scopes needed for authentication
- **rate_limit**: Rate limiting information
- Any other custom fields

### User Features

- **isFavorite**: Whether the user has marked this as a favorite
- **isPublished**: Whether this ability has been published to the public marketplace
- **publishedAt**: ISO 8601 timestamp when the ability was published (null if not published)

### Timestamps

- **createdAt**: ISO 8601 timestamp when the ability was created
- **updatedAt**: ISO 8601 timestamp of the last update

---

## Error Responses

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Authentication required"
}
```

### 401 Invalid API Key

```json
{
  "success": false,
  "error": "API key not found or has been revoked"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Failed to list abilities"
}
```

---

## Notes

1. **Embedding Dimension**: All embeddings are 1536-dimensional vectors (truncated in examples for brevity)
2. **Credential Filtering**: Abilities requiring credentials are filtered based on whether the user has stored credentials for that domain
3. **Favorites**: Favorited abilities are always included in results, even if credentials are missing
4. **Published Abilities**: Can be discovered by other users through the public search endpoint
5. **Vector Search**: The embedding vectors enable semantic similarity search across abilities

---

## Related Endpoints

- `GET /abilities` - List public published abilities (no auth required)
- `GET /abilities/search` - Search abilities with token charging (auth required)
- `GET /my/abilities/favorites` - Get only favorite abilities
- `POST /my/abilities/:abilityId/favorite` - Toggle favorite status
- `POST /my/abilities/:abilityId/publish` - Publish ability to marketplace
- `DELETE /my/abilities/:abilityId` - Delete user ability
