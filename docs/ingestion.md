# Ingestion Endpoints

All endpoints in this section require authentication via API key or session token.

Ingestion endpoints allow you to reverse-engineer APIs from:
- **HAR files**: Browser network recordings containing full API request/response data
- **Single API endpoints**: Quick ingestion from URLs or curl commands
- **Batch URLs**: Multiple endpoints ingested in one request

## HAR File Ingestion

### POST /ingest

Ingest a HAR (HTTP Archive) file to automatically reverse-engineer and create wrappers for all API endpoints found.

**Authentication:** Required (API Key or Session)

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `file`: HAR file (.har or .json)

**Request:**
```bash
curl -X POST http://localhost:4111/ingest \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5" \
  -F "file=@recording.har"
```

**Response:**
```json
{
  "success": true,
  "message": "HAR file accepted for processing. Large files will be chunked and processed in parallel.",
  "data": {
    "ingestion_id": "uuid-abc123",
    "session_id": "session-1761536238683-uuid-def456",
    "har_file": {
      "filename": "recording.har",
      "local_path": "/path/to/har-uploads/har-1761536238683-uuid.har",
      "file_size": 2458624,
      "total_entries": 145
    },
    "deduplication": {
      "exact_hash": "7a8b9c0d1e2f3456...",
      "max_similarity_to_existing": "12.5%",
      "threshold": "95%",
      "status": "unique"
    },
    "storage": {
      "vector_db": "Abilities will be indexed in Infraxa vector DB for semantic search",
      "backup_dir": "data/",
      "note": "Use GET /abilities/search with natural language queries to find abilities once processing is complete"
    },
    "processing": {
      "mode": "chunked_queued",
      "max_tokens_per_chunk": 100000,
      "group_by_domain": true,
      "continuation_passes": 3,
      "rate_limits": {
        "max_tokens_per_minute": "4M",
        "max_requests_per_minute": 480
      },
      "status": "Processing in background. Check server logs for progress.",
      "note": "Large HAR files are automatically split into chunks and queued for sequential processing to respect xAI rate limits"
    }
  }
}
```

**Duplicate Detection:**

Exact duplicate:
```json
{
  "success": false,
  "error": "This HAR file has already been ingested (exact duplicate)",
  "data": {
    "existing_ingestion_id": "uuid-old",
    "existing_session_id": "session-old",
    "ingested_at": "2025-10-26T12:00:00.000Z"
  }
}
```

Similar HAR (95% similarity threshold):
```json
{
  "success": false,
  "error": "This HAR file is too similar to a previously ingested file (97.8% similarity)",
  "data": {
    "similarity_percentage": "97.8",
    "similar_to_file": "previous-recording.har",
    "similar_to_ingestion_id": "uuid-old",
    "ingested_at": "2025-10-26T12:00:00.000Z",
    "threshold": "95%"
  }
}
```

**Validation:**
- File must have `.har` extension or `application/json` mime type
- File size limits apply (check server configuration)
- HAR must be valid JSON with proper structure

**HTTP Status Codes:**
- `200`: Success (processing started)
- `400`: Invalid file type or format
- `401`: Authentication required
- `409`: Duplicate file detected
- `500`: Server error

**Processing Flow:**

1. **Upload**: File is uploaded and saved locally
2. **Deduplication**:
   - Exact hash check (SHA-256)
   - MinHash similarity check (95% threshold)
3. **Chunking**: Large HAR files are split into chunks by domain
4. **Queuing**: Chunks are queued for sequential processing
5. **Wrapper Generation**:
   - Agent loads HAR chunk
   - Analyzes endpoints
   - Generates input/output schemas
   - Creates executable wrappers
   - Stores in user's private vector DB
6. **Credential Extraction**: Headers, cookies, and auth tokens are encrypted and stored

**Configuration (from `har-config.ts`):**
- `maxTokensPerChunk`: 100,000 tokens per chunk
- `groupByDomain`: true (chunks organized by domain)
- `continuationPasses`: 3 (max iterations per chunk)

**Background Processing:**
- Processing is asynchronous (non-blocking)
- Check server logs for real-time progress
- Abilities appear in `/my/abilities` as they're created
- Processing can take 1-30 minutes depending on HAR size

**Best Practices:**
- Record HAR files during normal API usage (not just one request)
- Include authentication flows in the recording
- Filter out unnecessary requests (ads, trackers, analytics)
- Use Chrome DevTools or browser extensions to export HAR
- Keep HAR files under 100MB for best performance

---

## Quick API Endpoint Ingestion

### POST /ingest/api

Quickly ingest a single API endpoint from a URL or curl command.

**Authentication:** Required (Session Token - API Key not supported for this endpoint)

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "input": "https://api.example.com/users/123",
  "service_name": "Example API",
  "ability_name": "get_user",
  "description": "Get user by ID"
}
```

**Curl Command Input:**
```json
{
  "input": "curl 'https://api.example.com/users' -H 'Authorization: Bearer token123'",
  "service_name": "Example API",
  "ability_name": "list_users",
  "description": "List all users"
}
```

**Field Descriptions:**
- `input` (required): URL or curl command
- `service_name` (required): Name of the service/API
- `ability_name` (optional): Custom name for the ability
- `description` (optional): Description of what the endpoint does

**Request:**
```bash
curl -X POST http://localhost:4111/ingest/api \
  -H "Authorization: Bearer <session-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "https://api.example.com/users/123",
    "service_name": "Example API"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "API endpoint ingested successfully",
  "ability_id": "uuid-abc123",
  "ability_name": "get_user",
  "service_name": "Example API",
  "endpoint": "https://api.example.com/users/123",
  "input_schema": {
    "type": "object",
    "properties": {
      "userId": {
        "type": "string",
        "description": "User ID to fetch"
      }
    }
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "name": { "type": "string" },
      "email": { "type": "string" }
    }
  }
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Invalid input or missing required fields
- `401`: Authentication required (session only)
- `500`: Server error

**Notes:**
- Session token required (BetterAuth) - API keys not supported
- Makes actual request to the endpoint to infer schema
- Stores ability in user's private collection
- Credentials from curl command are encrypted and stored

**Input Formats:**

URL with query params:
```
https://api.example.com/users?role=admin&limit=10
```

Curl command:
```
curl 'https://api.example.com/users' \
  -H 'Authorization: Bearer token123' \
  -H 'Content-Type: application/json' \
  -d '{"name":"John"}'
```

**Limitations:**
- Only works for GET and simple POST requests
- Complex authentication flows require HAR ingestion
- No support for multi-step API calls

---

## Batch URL Ingestion

### POST /ingest/urls

Ingest multiple URLs/curl commands in one request. The agent analyzes all URLs and creates wrappers.

**Authentication:** Required (Session Token - API Key not supported for this endpoint)

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "text": "Here are the API endpoints:\n\ncurl 'https://api.example.com/users' -H 'Authorization: Bearer token'\ncurl 'https://api.example.com/posts' -H 'Authorization: Bearer token'\n\nhttps://api.example.com/comments?postId=123",
  "service_name": "Example API"
}
```

**Field Descriptions:**
- `text` (required): Text containing URLs and/or curl commands (can include prose)
- `service_name` (required): Name of the service/API

**Request:**
```bash
curl -X POST http://localhost:4111/ingest/urls \
  -H "Authorization: Bearer <session-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "API Endpoints:\n\ncurl https://api.example.com/users\nhttps://api.example.com/posts",
    "service_name": "Example API"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "URL ingestion completed successfully.",
  "data": {
    "session_id": "url-ingestion-1761536238683-uuid",
    "service_name": "Example API",
    "text_length": 152,
    "tool_calls_count": 3,
    "abilities_ingested": 2,
    "abilities": [
      {
        "ability_id": "uuid-abc123",
        "ability_name": "list_users",
        "success": true
      },
      {
        "ability_id": "uuid-def456",
        "ability_name": "list_posts",
        "success": true
      }
    ],
    "storage": {
      "vector_db": "Abilities indexed in Infraxa vector DB for semantic search",
      "backup_dir": "generated/",
      "note": "Use GET /abilities/search with natural language queries to find abilities"
    },
    "status": "Processing complete"
  }
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Invalid input or missing required fields
- `401`: Authentication required (session only)
- `500`: Server error

**Processing:**
- The agent extracts all URLs and curl commands from the text
- Each endpoint is analyzed and wrapped
- Processing is synchronous (blocks until complete)
- Can take 30 seconds to 5 minutes depending on number of URLs

**Input Format:**
- Free-form text with URLs and curl commands
- Agent is intelligent enough to extract endpoints from prose
- Supports mixed content (documentation, comments, etc.)

**Example Text:**
```
These are the API endpoints for the user service:

1. List users:
curl 'https://api.example.com/users' \
  -H 'Authorization: Bearer token123'

2. Get user by ID:
GET https://api.example.com/users/{id}

3. Create user:
curl -X POST 'https://api.example.com/users' \
  -H 'Content-Type: application/json' \
  -d '{"name":"John","email":"john@example.com"}'
```

**Best Practices:**
- Include authentication headers in curl commands
- Provide meaningful service names
- Group related endpoints together
- Include example responses in curl commands for better schema inference
- Keep batches under 20 URLs for best performance

---

## Comparison: When to Use Each Endpoint

| Feature | HAR Ingestion | Quick API | Batch URLs |
|---------|--------------|-----------|------------|
| **Best For** | Full API discovery | Single endpoint | Multiple endpoints |
| **Authentication** | API Key or Session | Session only | Session only |
| **Speed** | Slow (1-30 min) | Fast (5-30 sec) | Medium (30 sec - 5 min) |
| **Credentials** | Auto-extracted | From curl | From curl |
| **Complexity** | High | Low | Medium |
| **Schema Quality** | Excellent | Good | Good |
| **Use Case** | Complete API reverse engineering | Quick wrapper creation | Documenting API endpoints |

**Recommendations:**
- **HAR**: Use for comprehensive API discovery and complex authentication flows
- **Quick API**: Use for quick prototyping and simple endpoints
- **Batch URLs**: Use when you have API documentation or a list of endpoints

## Error Handling

All ingestion endpoints may return errors for:

**Invalid Authentication:**
```json
{
  "success": false,
  "error": "Authentication required. Provide either a BetterAuth session token or Unkey API key in Authorization header."
}
```

**Invalid File:**
```json
{
  "success": false,
  "error": "Invalid file type. Please upload a HAR file (.har or .json)"
}
```

**Processing Failure:**
```json
{
  "success": false,
  "error": "Failed to process HAR file. Please check the file format and try again."
}
```

**Rate Limiting:**
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later."
}
```
