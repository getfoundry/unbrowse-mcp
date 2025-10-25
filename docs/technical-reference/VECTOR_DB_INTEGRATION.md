# Vector Database Integration

## Overview

The system now stores all ability data in a vector database (Infraxa) for semantic search capabilities, while maintaining JSON file backups for redundancy.

## Architecture

### Components

1. **[vector-db-client.ts](src/mastra/tools/vector-db-client.ts)** - Client wrapper for Infraxa vector DB API
2. **[embeddings.ts](src/mastra/tools/embeddings.ts)** - OpenAI embedding generation utilities
3. **[har-tools.ts](src/mastra/tools/har-tools.ts)** - Updated to store abilities in vector DB

### Storage Strategy

**Dual Storage Approach:**
- **Primary:** Vector Database (Infraxa) - enables semantic search
- **Backup:** JSON files in `data/` directory - fallback and debugging

## Data Flow

### 1. Ability Storage (`generateWrapperTool`)

```
HAR Request → Generate Wrapper → Execute → Store in Vector DB + File
```

For each ability:
1. Creates rich embedding text from ability metadata
2. Generates 3072-dimension embedding using AI SDK with Google Gemini `gemini-embedding-001`
3. Stores vector with metadata in Infraxa
4. Saves JSON backup file locally

**Stored Metadata:**
- `ability_id`, `ability_name`, `service_name`, `description`
- `session_id`, `dynamic_header_keys`, `static_headers`, `dynamic_headers`
- `input_schema`, `dependency_order`, `request_method`, `request_url`
- `wrapper_code`, `execution_success`, `execution_status`
- `generated_at`, `file_backup_path`

### 2. Semantic Search (`searchAbilitiesTool`)

```
Natural Language Query → Generate Embedding → Vector Search → Results
```

Features:
- Natural language queries (e.g., "get user profile", "list orders")
- Semantic similarity matching using cosine distance
- Returns top-k most relevant abilities

## Configuration

### Environment Variables

```bash
# Required
GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key

# Vector DB Configuration
VECTOR_DB_API=https://dev-beta.infraxa.ai
VECTOR_DB_TENANT=reverse_engineer
```

### Vector DB Structure

**Tenant:** `reverse_engineer`
- Contains all ability collections

**Collections:** One per service
- Collection ID format: `abilities_{service_name}`
- Example: `abilities_api_github_com`

**Vectors:**
- Dimension: 3072 (from Gemini `gemini-embedding-001`)
- ID: Numeric hash of `ability_id`
- Includes all metadata as attributes

## Usage

### Storing Abilities

The `generateWrapperTool` automatically stores abilities:

```typescript
// This happens automatically when you generate a wrapper
const result = await generateWrapperTool.execute({
  context: {
    ability_id: "...",
    ability_name: "...",
    service_name: "...",
    // ... other fields
  }
});

// Result includes:
// - success: true/false
// - wrapper_path: path to JSON backup
// - vector_id: numeric ID in vector DB
// - evaluation_result: execution results
```

### Searching Abilities

Use the new `searchAbilitiesTool`:

```typescript
const results = await searchAbilitiesTool.execute({
  context: {
    query: "get user profile information",
    service_name: "api.github.com",
    limit: 10
  }
});

// Returns:
// {
//   success: true,
//   message: "Found 5 results",
//   results: [
//     { vector_id: 123, distance: 0.12, ... },
//     { vector_id: 456, distance: 0.18, ... },
//   ],
//   count: 5
// }
```

### Direct Client Usage

```typescript
import { getVectorDBClient } from './vector-db-client';
import { generateEmbedding } from './embeddings';

const client = getVectorDBClient();

// Initialize tenant (one-time setup)
await client.initializeTenant();

// Store an ability
// Uses AI SDK with Google Gemini gemini-embedding-001 (3072 dimensions)
const embedding = await generateEmbedding("Ability description");
await client.storeAbility({
  ability_id: "unique-id",
  ability_name: "Get User",
  service_name: "api.example.com",
  description: "Gets user profile data",
  embedding: embedding.embedding,
  metadata: { /* ... */ }
});

// Search abilities
const queryEmbedding = await generateEmbedding("find user data");
const results = await client.searchAbilities(
  "api.example.com",
  queryEmbedding.embedding,
  10
);
```

## Error Handling

The system is designed to be resilient:

1. **Vector DB Failure:** Falls back to file-only storage
2. **Embedding Failure:** Returns error, no storage occurs
3. **Partial Failure:** Stores in file, logs vector DB error

All failures are logged and included in response messages.

## Benefits

### Semantic Search
- Find abilities by natural language description
- No need to know exact naming conventions
- Discovers related abilities

### Scalability
- Handles millions of vectors
- Fast vector similarity search
- Distributed architecture

### Flexibility
- Metadata stored as attributes for filtering
- Multiple collections per tenant
- Easy to add new services

## Future Enhancements

1. **Knowledge Graph:** Link related abilities (dependencies)
2. **Hybrid Search:** Combine vector + keyword search
3. **Auto-categorization:** Cluster abilities by functionality
4. **Usage Analytics:** Track which abilities are most searched/used
5. **Version Control:** Store multiple versions of ability embeddings

## Troubleshooting

### Vector DB Connection Issues
- Check `VECTOR_DB_API` environment variable
- Verify network connectivity to Infraxa
- Check API status at https://dev-beta.infraxa.ai

### Embedding Generation Failures
- Verify `GOOGLE_GENERATIVE_AI_API_KEY` is set correctly
- Check Google API quota/rate limits
- Review text length limits for Gemini embedding model
- Ensure AI SDK and @ai-sdk/google packages are installed

### Search Returns No Results
- Verify collection exists for service
- Check tenant initialization
- Ensure abilities were stored successfully

### File Backup Missing
- Check `data/` directory permissions
- Verify disk space available
- Review execution logs for errors
