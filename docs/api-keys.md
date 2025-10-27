# API Key Management

All endpoints in this section require authentication via API key or session token.

API keys allow programmatic access to the API without requiring browser sessions. They can be used for:
- CI/CD pipelines
- Scripts and automation
- Third-party integrations
- MCP (Model Context Protocol) servers

## Create API Key

### POST /my/api-keys

Create a new API key for the authenticated user.

**Authentication:** Required (API Key or Session)

**Request Body:**
```json
{
  "name": "Production Server",
  "expiresAt": "2026-10-27T00:00:00.000Z",
  "ratelimit": {
    "limit": 1000,
    "duration": 3600000
  }
}
```

**Field Descriptions:**
- `name` (required): Human-readable name for the API key
- `expiresAt` (optional): Expiration date (ISO 8601 format). Default: 1 year from creation
- `ratelimit` (optional): Custom rate limit configuration
  - `limit`: Number of requests allowed
  - `duration`: Time window in milliseconds

**Request:**
```bash
curl -X POST http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My API Key",
    "expiresAt": "2026-10-27T00:00:00.000Z"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "API key created successfully. Store the key securely - it won't be shown again.",
  "key": "re_NewApiKey123abc456def789ghi",
  "keyId": "key_abc123",
  "apiKeyId": "18154cf0-e7d1-497b-b417-f41b8a63786a"
}
```

**Response Fields:**
- `key`: **Full API key (only shown once!)** - Store this securely
- `keyId`: Short identifier for the key
- `apiKeyId`: UUID for the API key record

**⚠️ Important Security Notes:**
- The full API key is **only returned once** during creation
- Store it securely (password manager, secrets manager, etc.)
- If lost, you must revoke and create a new key
- Never commit API keys to version control

**Validation:**
- `name` is required and must be a string
- `expiresAt` must be a valid ISO 8601 date string (if provided)
- `ratelimit` must have both `limit` and `duration` if provided

**HTTP Status Codes:**
- `200`: Success
- `400`: Invalid request body (missing name or invalid format)
- `401`: Authentication required
- `500`: Server error

---

## List API Keys

### GET /my/api-keys

List all API keys for the authenticated user.

**Authentication:** Required (API Key or Session)

**Request:**
```bash
curl http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "keys": [
    {
      "apiKeyId": "18154cf0-e7d1-497b-b417-f41b8a63786a",
      "name": "asdf",
      "keyPrefix": "re_B1K9vr8t...",
      "createdAt": "2025-10-27T03:24:29.093Z",
      "expiresAt": "2026-10-27T03:24:27.352Z",
      "lastUsedAt": "2025-10-27T03:40:03.013Z",
      "revokedAt": null
    },
    {
      "apiKeyId": "988a313e-751e-4d4a-ad11-436eae567423",
      "name": "meow",
      "keyPrefix": "re_AgRc8FxE...",
      "createdAt": "2025-10-26T12:43:05.106Z",
      "expiresAt": "2026-10-26T12:43:03.263Z",
      "lastUsedAt": "2025-10-26T15:06:03.620Z",
      "revokedAt": null
    }
  ]
}
```

**Response Fields (per key):**
- `apiKeyId`: UUID for the key
- `name`: Human-readable name
- `keyPrefix`: First few characters of the key (for identification)
- `createdAt`: When the key was created
- `expiresAt`: When the key expires (null if no expiration)
- `lastUsedAt`: Last time the key was used (null if never used)
- `revokedAt`: When the key was revoked (null if active)

**Key Status:**
- Active: `revokedAt` is null and `expiresAt` is in the future (or null)
- Revoked: `revokedAt` is not null
- Expired: `expiresAt` is in the past

**HTTP Status Codes:**
- `200`: Success
- `401`: Authentication required
- `500`: Server error

**Notes:**
- Full API keys are never returned after creation
- Only the prefix (first 12 characters) is shown for identification
- Revoked keys remain in the list for audit purposes

---

## Revoke API Key

### DELETE /my/api-keys/:apiKeyId

Revoke (deactivate) an API key. Revoked keys cannot be un-revoked.

**Authentication:** Required (API Key or Session)

**Path Parameters:**
- `apiKeyId`: The UUID of the API key to revoke

**Request:**
```bash
curl -X DELETE http://localhost:4111/my/api-keys/18154cf0-e7d1-497b-b417-f41b8a63786a \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response (Success):**
```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

**Response (Not Found):**
```json
{
  "success": false,
  "error": "API key not found or does not belong to this user"
}
```

**Response (Already Revoked):**
```json
{
  "success": false,
  "error": "API key is already revoked"
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Key not found or already revoked
- `401`: Authentication required
- `500`: Server error

**Notes:**
- Revocation is immediate - the key cannot be used after this call returns
- Revoked keys cannot be reactivated
- The key record remains in the database for audit purposes
- If you revoke the key you're currently using, subsequent requests will fail

**Best Practices:**
- Rotate API keys regularly (every 90 days recommended)
- Revoke keys immediately if compromised
- Use separate keys for different environments (dev, staging, prod)
- Monitor `lastUsedAt` to detect unused or stale keys
