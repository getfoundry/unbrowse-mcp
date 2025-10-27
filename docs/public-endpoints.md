# Public Endpoints

## Health Check

### GET /health

Check if the API server is running.

**Authentication:** None required

**Request:**
```bash
curl http://localhost:4111/health
```

**Response:**
```json
{
  "ok": true,
  "service": "unbrowse-agent-api",
  "timestamp": 1761536238683
}
```

---

## Search Published Abilities

### GET /public/abilities

Search for published abilities using semantic search. Requires API key authentication but filters based on user's available credentials.

**Authentication:** API Key required

**Query Parameters:**
- `q` (required): Search query string
- `top_k` (optional): Number of results to return (default: 10)

**Request:**
```bash
curl 'http://localhost:4111/public/abilities?q=test&top_k=5' \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "query": "test",
  "count": 0,
  "results": []
}
```

**Notes:**
- Results are filtered based on:
  - User's available credentials
  - Only returns abilities user can actually execute
  - Abilities requiring no auth are always included

---

## Get Ability Details

### GET /abilities/:id

Get details for a specific published ability by ID.

**Authentication:** Optional (better results with auth)

**Path Parameters:**
- `id`: Ability ID (UUID)

**Request:**
```bash
curl http://localhost:4111/abilities/cb889ba2-a095-40df-b5d0-306a6e6a8697 \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response (Success):**
```json
{
  "success": true,
  "ability": {
    "abilityId": "cb889ba2-a095-40df-b5d0-306a6e6a8697",
    "abilityName": "get_version_info",
    "serviceName": "zeemart-buyer",
    "domain": "dev-buyer.zeemart.co",
    "description": "Fetches the version information...",
    "embedding": [...],
    "createdAt": "2025-10-26T12:14:09.861Z",
    "updatedAt": "2025-10-26T12:14:09.861Z"
  }
}
```

**Response (Not Found):**
```json
{
  "success": false,
  "error": "Ability not found, not published, or you don't have the required credentials to access it"
}
```

**HTTP Status Codes:**
- `200`: Success
- `404`: Ability not found or not accessible
- `401`: Authentication required for this ability

---

## Get Popular Abilities

### GET /analytics/public/popular

Get leaderboard of most popular published abilities.

**Authentication:** None required

**Query Parameters:**
- `limit` (optional): Number of results (1-100, default: 10)

**Request:**
```bash
curl 'http://localhost:4111/analytics/public/popular?limit=20'
```

**Response:**
```json
{
  "success": true,
  "count": 0,
  "abilities": []
}
```

**Response Fields:**
Each ability in the array contains:
- `abilityId`: Unique identifier
- `abilityName`: Name of the ability
- `serviceName`: Service it belongs to
- `executionCount`: Number of times executed
- `successRate`: Percentage of successful executions
- `avgExecutionTime`: Average execution time in ms

---

## Get Top Earning Abilities

### GET /analytics/public/top-earning

Get leaderboard of highest earning published abilities.

**Authentication:** None required

**Query Parameters:**
- `limit` (optional): Number of results (1-50, default: 10)

**Request:**
```bash
curl 'http://localhost:4111/analytics/public/top-earning?limit=15'
```

**Response:**
```json
{
  "success": true,
  "count": 0,
  "abilities": []
}
```

**Response Fields:**
Each ability in the array contains:
- `abilityId`: Unique identifier
- `abilityName`: Name of the ability
- `serviceName`: Service it belongs to
- `totalEarned`: Total amount earned (in USD)
- `executionCount`: Number of times executed
- `creatorId`: User ID of ability creator

---

## OpenAPI Specification

### GET /docs/openapi.json

Get the OpenAPI 3.1.0 specification for this API.

**Authentication:** None required

**Request:**
```bash
curl http://localhost:4111/docs/openapi.json
```

**Response:**
```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Reverse Engineer API",
    "version": "1.0.0",
    "description": "# Reverse Engineer API\n\nMulti-tenant API reverse engineering and ability management platform..."
  },
  "paths": { ... },
  "components": { ... }
}
```

**Notes:**
- Full OpenAPI specification with all endpoints documented
- Includes request/response schemas
- Can be used with Swagger UI or other OpenAPI tools
