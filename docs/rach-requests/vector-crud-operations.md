# Feature Request: Vector CRUD Operations

## Status
✅ **Implemented** (2025-10-25)

## Priority
🔥 **High** - Direct database access for debugging and management

## Overview
Add REST API endpoints for **direct CRUD operations** on Infraxa vectors without requiring semantic search. This allows retrieving, updating, and deleting vectors by their numeric ID.

## Problem Statement

Previously, there was **no way** to directly access vectors in the Infraxa database:
- **No direct retrieval**: Could only find vectors via semantic search
- **No metadata updates**: Couldn't update vector attributes without re-indexing
- **No direct deletion**: Had to delete entire collections or rely on TTL
- **No debugging**: Couldn't inspect specific vectors by ID

**Example Issues**:
```bash
# Before: How do I update the description of vector ID 123456789?
# Answer: You can't. You have to delete and re-index.

# Before: How do I see what attributes are stored for vector ID 987654321?
# Answer: You have to search for it semantically and hope it comes up.
```

## Implemented Solution

### New REST API Endpoints

All endpoints are **protected** (require Better Auth session or API key).

#### 1. GET `/vectors/:vectorId`
Retrieve a vector by its numeric ID with full attributes.

**Request:**
```bash
curl http://localhost:4111/vectors/123456789 \
  -H "Cookie: better-auth.session_token=YOUR_TOKEN"
```

**Response (Success):**
```json
{
  "success": true,
  "vector": {
    "id": 123456789,
    "attributes": {
      "ability_id": "github-create-repo-v1",
      "ability_name": "Create GitHub Repository",
      "service_name": "GitHub API",
      "domain": "api.github.com",
      "description": "Creates a new GitHub repository",
      "method": "POST",
      "path": "/user/repos"
    }
  }
}
```

**Response (Not Found):**
```json
{
  "success": false,
  "error": "Vector not found: 123456789"
}
```

#### 2. PUT `/vectors/:vectorId/metadata`
Update vector metadata (attributes) without changing the embedding.

**Request:**
```bash
curl -X PUT http://localhost:4111/vectors/123456789/metadata \
  -H "Cookie: better-auth.session_token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "attributes": {
      "description": "Updated description for this endpoint",
      "tags": ["api", "github", "repositories"],
      "custom_field": "custom value"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Vector metadata updated successfully",
  "vectorId": 123456789,
  "attributes": {
    "description": "Updated description for this endpoint",
    "tags": ["api", "github", "repositories"],
    "custom_field": "custom value"
  }
}
```

**Notes:**
- Updates **only** the metadata/attributes
- The embedding vector remains unchanged
- Useful for fixing typos, adding tags, or enriching metadata

#### 3. DELETE `/vectors/:vectorId`
Delete a vector from both Infraxa and PostgreSQL.

**Request:**
```bash
curl -X DELETE http://localhost:4111/vectors/123456789 \
  -H "Cookie: better-auth.session_token=YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Vector deleted successfully",
  "vectorId": 123456789
}
```

**Notes:**
- Deletes from Infraxa vector database
- Also deletes from PostgreSQL `abilities` table (dual storage)
- Operation is **permanent** - cannot be undone

## Technical Implementation

### Files Modified

1. **`src/server/routes.ts`** (lines 1957-2150)
   - Added `getVectorByIdRoute`
   - Added `updateVectorMetadataRoute`
   - Added `deleteVectorByIdRoute`
   - All routes require authentication via Better Auth

2. **Infraxa API Integration**
   - Uses existing `VectorDBClient.getVectorById()` method
   - Direct HTTP calls to Infraxa API for update/delete:
     - `PUT /tenants/{tenant}/blobs/{collection}/vectors/{id}/attributes`
     - `DELETE /tenants/{tenant}/blobs/{collection}/vectors/{id}`

3. **Dual Storage Cleanup**
   - Delete operation removes from both Infraxa and PostgreSQL
   - Ensures data consistency across storage systems

### Authentication

All endpoints use the `auth.api.getSession()` middleware:
```typescript
const session = await auth.api.getSession({ headers: c.req.raw.headers });
if (!session) {
  return c.json({ success: false, error: "Authentication required" }, 401);
}
```

Supports:
- ✅ Better Auth session cookies
- ✅ Bearer tokens (BetterAuth)
- ✅ API keys (via Authorization header)

### Error Handling

**400 Bad Request**:
- Invalid vector ID (not a number)
- Missing or invalid attributes in PUT request

**401 Unauthorized**:
- No authentication token provided
- Invalid or expired token

**404 Not Found**:
- Vector does not exist

**500 Internal Server Error**:
- Infraxa API errors
- PostgreSQL errors (logged but non-fatal)

## Use Cases

### 1. Debugging Indexed Abilities
```bash
# Check what attributes are stored for a specific vector
curl http://localhost:4111/vectors/1234567890 \
  -H "Cookie: better-auth.session_token=..."
```

### 2. Bulk Metadata Updates
```bash
# Update descriptions for multiple vectors
for id in 123 456 789; do
  curl -X PUT http://localhost:4111/vectors/$id/metadata \
    -H "Cookie: better-auth.session_token=..." \
    -H "Content-Type: application/json" \
    -d '{"attributes":{"updated_at":"2025-10-25"}}'
done
```

### 3. Cleaning Up Stale Vectors
```bash
# Delete vectors that are no longer valid
curl -X DELETE http://localhost:4111/vectors/9999999 \
  -H "Cookie: better-auth.session_token=..."
```

### 4. Adding Tags After Indexing
```bash
# Add semantic tags to improve searchability
curl -X PUT http://localhost:4111/vectors/555555/metadata \
  -H "Cookie: better-auth.session_token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "attributes": {
      "tags": ["payment", "stripe", "api", "checkout"],
      "category": "payments"
    }
  }'
```

## Vector ID Generation

Vector IDs are generated from ability IDs using SHA-256 hash:

```typescript
// From vector-db-client.ts:154-158
private generateNumericId(abilityId: string): number {
  const hash = createHash('sha256').update(abilityId).digest();
  // Take first 4 bytes and convert to positive integer
  return Math.abs(hash.readInt32BE(0));
}
```

**Example:**
```javascript
const crypto = require('crypto');

function getVectorId(abilityId) {
  const hash = crypto.createHash('sha256').update(abilityId).digest();
  return Math.abs(hash.readInt32BE(0));
}

console.log(getVectorId('github-create-repo-v1'));
// Output: 1234567890 (deterministic)
```

## Performance Considerations

### GET Operation
- ⚡ **Fast**: Direct lookup by ID in Infraxa (O(1))
- No embedding calculation needed
- No semantic search overhead

### PUT Operation
- ⚡ **Fast**: Updates only metadata, not the vector
- No re-embedding required
- Instant propagation to search results

### DELETE Operation
- ⚡ **Fast**: Direct deletion by ID
- Dual delete (Infraxa + PostgreSQL) runs sequentially
- PostgreSQL delete is non-blocking (won't fail if not found)

## Limitations

1. **No Embedding Updates**
   - Can't update the vector embedding itself
   - To change embedding, must delete and re-index

2. **No Batch Operations**
   - Must call endpoints individually for each vector
   - Future: Add batch update/delete endpoints

3. **No Soft Deletes**
   - Delete is permanent
   - No trash/recovery mechanism

4. **ID Must Be Known**
   - Can't search by ability_id string
   - Must convert ability_id → vector_id first using hash function

## Future Enhancements

### Phase 1: Batch Operations
- [ ] `POST /vectors/batch/get` - Get multiple vectors by ID
- [ ] `PUT /vectors/batch/metadata` - Update multiple vectors
- [ ] `DELETE /vectors/batch` - Delete multiple vectors

### Phase 2: Query by Ability ID
- [ ] `GET /vectors/by-ability/:abilityId` - Get vector by ability_id string
- [ ] Auto-convert ability_id → vector_id using hash function

### Phase 3: Soft Deletes
- [ ] Add `deleted_at` attribute instead of hard delete
- [ ] Filter out deleted vectors from search results
- [ ] Add `/vectors/:id/restore` endpoint

### Phase 4: Vector Statistics
- [ ] `GET /vectors/:id/stats` - Get usage statistics
- [ ] Track: search appearances, click-through rate, last used

## Testing

### Manual Testing
```bash
# 1. Register a user and get session token
curl -X POST http://localhost:4111/better-auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123","name":"Test"}'

# Extract token from response
TOKEN="your-token-here"

# 2. Test GET (should return 404 for non-existent vector)
curl http://localhost:4111/vectors/999999999 \
  -H "Cookie: better-auth.session_token=$TOKEN"

# 3. Ingest a test ability to get a real vector ID
curl -X POST http://localhost:4111/ingest/api \
  -H "Cookie: better-auth.session_token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "curl https://api.github.com/user",
    "service_name": "GitHub Test",
    "ability_name": "Get Current User"
  }'

# Extract vector_id from response or calculate from ability_id
# Then test GET, PUT, DELETE with real vector ID
```

### Integration Tests
```typescript
describe('Vector CRUD API', () => {
  it('should get vector by ID', async () => {
    const response = await fetch(`${API_URL}/vectors/${vectorId}`, {
      headers: { Cookie: `better-auth.session_token=${token}` }
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.vector.id).toBe(vectorId);
  });

  it('should update vector metadata', async () => {
    const response = await fetch(`${API_URL}/vectors/${vectorId}/metadata`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `better-auth.session_token=${token}`
      },
      body: JSON.stringify({
        attributes: { description: 'Updated description' }
      })
    });
    expect(response.status).toBe(200);
  });

  it('should delete vector by ID', async () => {
    const response = await fetch(`${API_URL}/vectors/${vectorId}`, {
      method: 'DELETE',
      headers: { Cookie: `better-auth.session_token=${token}` }
    });
    expect(response.status).toBe(200);
  });
});
```

## Security Considerations

1. **Authentication Required**
   - All endpoints require valid session/API key
   - Prevents unauthorized access to vector database

2. **No Bulk Extraction**
   - Can't list all vectors
   - Must know specific vector IDs
   - Prevents database scraping

3. **User Isolation** (TODO)
   - Currently: Any authenticated user can access any vector
   - Future: Add user_id checks to limit access to user's own vectors

4. **Rate Limiting**
   - Uses Better Auth rate limiting (100 req/min)
   - Prevents abuse of delete endpoint

## Related Features

- ✅ User-scoped ability storage (user_abilities table)
- ✅ Dual storage (Infraxa + PostgreSQL)
- ✅ KGE graph for dependency tracking
- ⏸️ Hybrid search (rach-requests/hybrid-search-feature.md)

## References

- Infraxa API Documentation: https://dev-beta.infraxa.ai/docs
- Vector DB Client: `src/mastra/tools/vector-db-client.ts`
- Ability Repository: `src/server/ability-repository-user.ts`
- Better Auth Docs: https://www.better-auth.com/docs

## Changelog

### 2025-10-25
- ✅ Initial implementation
- ✅ GET /vectors/:vectorId
- ✅ PUT /vectors/:vectorId/metadata
- ✅ DELETE /vectors/:vectorId
- ✅ Authentication via Better Auth
- ✅ Dual storage cleanup (Infraxa + PostgreSQL)
