# Server-Side Ability Execution Implementation

## Overview

This document describes the implementation of server-side ability execution. This feature moves wrapper code execution from the MCP client to the server, ensuring wrapper code never leaves the server and providing better security.

## Architecture

### Components

1. **Credential Decryption Service** (`src/server/credential-service.ts`)
   - `decryptCredential()` - Decrypts a single credential using AES-256-GCM
   - `decryptCredentialsForExecution()` - Decrypts multiple credentials for execution
   - Handles client-encrypted credentials stored as `{"ciphertext": "...", "iv": "..."}`

2. **Ability Execution Service** (`src/server/ability-execution-service.ts`)
   - `createFetchOverride()` - Creates a fetch function with injected headers
   - `executeWrapper()` - Runs wrapper code in VM sandbox
   - `applyTransform()` - Applies optional client transformation to response
   - Includes 30-second timeout for wrapper execution
   - Includes 5-second timeout for transformations

3. **Execution Route** (`src/server/routes/execution.ts`)
   - `POST /my/abilities/:abilityId/execute` endpoint
   - Handles authentication, credential resolution, execution, and billing

## API Specification

### Endpoint

```
POST /my/abilities/:abilityId/execute
```

### Authentication

- **Required:** Bearer token in `Authorization` header
- **Required:** Decryption key in `X-Credential-Key` header (base64-encoded AES-256 key)

### Request Body

```json
{
  "params": {
    "username": "octocat",
    "limit": 10
  },
  "transformCode": "(data) => ({ name: data.name, followers: data.followers_count })"
}
```

**Fields:**
- `params` (required): Input parameters for the ability
- `transformCode` (optional): JavaScript transformation function

### Success Response (200 OK)

```json
{
  "success": true,
  "result": {
    "statusCode": 200,
    "body": {
      "name": "Octocat",
      "followers_count": 1000
    },
    "headers": {
      "content-type": "application/json"
    },
    "executedAt": "2025-10-27T12:34:56.789Z",
    "executionTimeMs": 1234
  }
}
```

### Error Response - Missing Credentials (400 Bad Request)

```json
{
  "success": false,
  "error": "Missing required credentials. This ability requires: twitter.com::Authorization, twitter.com::Cookie"
}
```

### Error Response - Credentials Expired (401 Unauthorized)

```json
{
  "success": false,
  "error": "Authentication failed (401). Credentials may be expired or invalid.",
  "credentialsExpired": true,
  "loginAbilities": [],
  "result": {
    "statusCode": 401,
    "body": null,
    "headers": {},
    "executedAt": "2025-10-27T12:34:56.789Z",
    "executionTimeMs": 1234
  }
}
```

### Error Response - Ability Not Found (404 Not Found)

```json
{
  "success": false,
  "error": "Ability not found: abc-123-def"
}
```

## Implementation Details

### Credential Resolution Flow

1. Client encrypts credentials using AES-256-GCM with their own key
2. Client stores encrypted credentials via credentials API
3. Server stores: `{"ciphertext": "base64...", "iv": "base64..."}`
4. When executing:
   - Client sends decryption key in `X-Credential-Key` header
   - Server decrypts credentials using `decryptCredential()`
   - Server injects decrypted credentials into fetch headers
   - Server never stores plaintext credentials

### VM Sandbox Security

**Allowed Globals:**
- `fetch` (overridden with header injection)
- `console`
- `URL`
- `Error`
- `Response`
- `Headers`
- `Request`
- `Buffer`

**Blocked:**
- `require`
- `import`
- Real `process.env` (empty object provided)
- File system access
- Network access (except via overridden fetch)

### Header Injection

**Static Headers:**
- Evaluated from `metadata.static_headers`
- Format: `{"key": "value"}` or array of `{"key": "service::HeaderName", "value_code": "() => 'value'"}`
- Injected into every fetch request

**Dynamic Headers:**
- From `dynamicHeaderKeys` array (format: `"domain::HeaderName"`)
- Decrypted from user credentials
- Injected into every fetch request
- Example: `["twitter.com::Authorization", "twitter.com::Cookie"]`

**Header Merging:**
- Static headers applied first
- Dynamic headers override static
- Original request headers override both
- Special case: Cookie headers are concatenated with `; `

**Forbidden Headers (removed):**
- `Content-Length`
- `Transfer-Encoding`
- `Host`
- `Connection`
- `Keep-Alive`
- `Upgrade`

### Token Charging

- Uses existing `chargeForExecution()` from `token-service.ts`
- Charges based on similarity score (0.95 for direct execution)
- Revenue split:
  - 50% to indexer (ability creator)
  - 30% to domain owner
  - 20% to platform
- Only charges on successful execution

### Usage Tracking

Records to `abilityUsage` table:
- `usageId` - UUID
- `userAbilityId` - Ability ID
- `executedBy` - User ID
- `executedAt` - Timestamp
- `executionTimeMs` - Duration
- `success` - Boolean
- `errorMessage` - Error if failed
- `inputSchema` - Request params
- `outputSchema` - Response body
- `metadata` - Additional info (transform applied, credentials used, response size)

## Testing

### Prerequisites

1. Start the server: `npm start`
2. Have a valid API key with credits
3. Have an ability with wrapper code stored in metadata
4. Have encrypted credentials stored (if ability requires them)
5. Have the decryption key for your credentials

### Test Case 1: Execute Ability Without Credentials

```bash
curl -X POST http://localhost:4111/my/abilities/{abilityId}/execute \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-Credential-Key: YOUR_BASE64_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "query": "test"
    }
  }'
```

### Test Case 2: Execute Ability With Credentials

```bash
curl -X POST http://localhost:4111/my/abilities/{abilityId}/execute \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-Credential-Key: YOUR_BASE64_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "username": "elonmusk"
    }
  }'
```

### Test Case 3: Execute With Transformation

```bash
curl -X POST http://localhost:4111/my/abilities/{abilityId}/execute \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-Credential-Key: YOUR_BASE64_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "username": "elonmusk"
    },
    "transformCode": "(data) => ({ name: data.name, followers: data.followers_count })"
  }'
```

### Test Case 4: Missing Decryption Key

```bash
curl -X POST http://localhost:4111/my/abilities/{abilityId}/execute \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "params": {}
  }'
```

Expected: 400 error about missing `X-Credential-Key`

### Test Case 5: Invalid Decryption Key

```bash
curl -X POST http://localhost:4111/my/abilities/{abilityId}/execute \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-Credential-Key: INVALID_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "params": {}
  }'
```

Expected: 400 error about failed decryption

## Security Considerations

### ✅ Implemented

1. **Wrapper Code Protection:** Wrapper code stored in database, never exposed via API
2. **VM Sandboxing:** Execution in isolated VM context with limited globals
3. **Credential Encryption:** Client-side encryption, server only decrypts during execution
4. **Header Validation:** Forbidden headers removed to prevent fetch errors
5. **Timeout Protection:** 30s for wrapper, 5s for transforms
6. **Response Truncation:** Max 30,000 characters
7. **Authentication Required:** API key + decryption key
8. **Usage Tracking:** All executions logged for audit

### ⚠️ Recommendations

1. **Rate Limiting:** Consider per-user execution rate limits
2. **Credential Expiration:** Implement automatic credential expiration on 401-499 errors
3. **Login Ability Discovery:** Populate `loginAbilities` array when credentials expire
4. **Dependency Execution:** Implement automatic dependency resolution
5. **Transform Whitelisting:** Consider limiting allowed operations in transform code
6. **Wrapper Code Encryption:** Consider encrypting wrapper_code in database
7. **Audit Logging:** Log all execution attempts (success and failure)

## Migration from MCP Client Execution

### Before (MCP Client)
```typescript
// MCP client fetches ability with wrapper code
const ability = await apiClient.getAbility(abilityId);

// MCP client executes wrapper code locally
const result = await executeLocally(ability.wrapper_code, params);
```

### After (Server Execution)
```typescript
// MCP client calls execution endpoint
const result = await apiClient.executeAbility(abilityId, {
  params,
  transformCode,
});
```

### Benefits

1. **Security:** Wrapper code never leaves the server
2. **Consistency:** Single execution environment (server VM)
3. **Monitoring:** Centralized logging and analytics
4. **Billing:** Accurate token charging
5. **Credential Safety:** Decryption keys only in transit, not stored

## Files Modified/Created

### Created
- `src/server/ability-execution-service.ts` - Core execution logic
- `src/server/routes/execution.ts` - Execution endpoint
- `docs/SERVER_SIDE_EXECUTION.md` - This documentation

### Modified
- `src/server/credential-service.ts` - Added decryption functions
- `src/server/routes/index.ts` - Registered execution route

### Database Schema
No changes required. Uses existing:
- `userAbilities.metadata` - Stores `wrapper_code` and `static_headers`
- `userAbilities.dynamicHeaderKeys` - Stores required credential keys
- `userCredentials` - Stores encrypted credentials
- `abilityUsage` - Tracks execution history

## Next Steps

1. Test with real abilities that have wrapper code
2. Implement credential expiration handling
3. Implement login ability discovery
4. Add dependency resolution
5. Consider adding execution history endpoint
6. Add monitoring/alerting for failed executions
7. Optimize performance (caching, connection pooling)

## Support

For issues or questions:
1. Check server logs for execution errors
2. Verify decryption key is correct (base64-encoded 256-bit key)
3. Verify ability has wrapper code in metadata
4. Verify credentials are stored for required domains
5. Check API key has sufficient credits
