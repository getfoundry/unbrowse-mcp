# Migration Guide: API Key Authentication Update

## Overview

The Unbrowse MCP server has been updated to use API key authentication following the [API Complete Guide](docs/API_COMPLETE_GUIDE.md). This document explains the changes and how to migrate your setup.

## What Changed?

### Before (Old System)
- ❌ No authentication to Unbrowse API
- ❌ Used service name as identifier
- ❌ Public endpoints: `/abilities`, `/cookie-jar/:serviceName`
- ⚠️ Password-only security

### After (New System)
- ✅ API key authentication via `Authorization: Bearer <key>` header
- ✅ User-specific abilities and credentials
- ✅ Authenticated endpoints: `/my/abilities`, `/my/credentials/:domain`
- ✅ **Dual authentication**: API key + password (zero-knowledge encryption)

## Migration Steps

### Step 1: Get Your API Key

1. **Register an account** (if you don't have one):
```bash
curl -X POST http://localhost:4111/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "YourSecurePassword123",
    "name": "Your Name"
  }'
```

2. **Login to get a JWT token**:
```bash
curl -X POST http://localhost:4111/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "YourSecurePassword123"
  }'
```
**Save the `token` from the response.**

3. **Create an API key**:
```bash
curl -X POST http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MCP Server Key",
    "expiresAt": "2026-12-31T23:59:59Z"
  }'
```
**⚠️ Save the `key` from the response - it's only shown once!**

### Step 2: Update Your Configuration

#### Claude Desktop (config.json)

**Old configuration:**
```json
{
  "mcpServers": {
    "unbrowse": {
      "command": "node",
      "args": ["/path/to/unbrowse-mcp/build/index.js"],
      "env": {
        "PASSWORD": "your-encryption-password"
      }
    }
  }
}
```

**New configuration:**
```json
{
  "mcpServers": {
    "unbrowse": {
      "command": "node",
      "args": ["/path/to/unbrowse-mcp/build/index.js"],
      "env": {
        "API_KEY": "re_xxxxxxxxxxxx",
        "PASSWORD": "your-encryption-password"
      }
    }
  }
}
```

#### Smithery Configuration

**Old smithery.yaml:**
```yaml
config:
  debug: false
  password: "your-password"
  enableIndexTool: false
```

**New smithery.yaml:**
```yaml
config:
  apiKey: "re_xxxxxxxxxxxx"
  password: "your-password"
  debug: false
  enableIndexTool: false
```

> **Note:** The Unbrowse API base URL is now fixed to `https://agent.unbrowse.ai` and does not require configuration.

### Step 3: Migrate Your Credentials (If Needed)

If you previously stored credentials using the old system, you'll need to upload them to the new authenticated endpoints:

```javascript
// Old format (service name based)
// No longer supported

// New format (domain based, with encryption)
const encryptedCreds = [
  {
    type: "header",
    key: "Authorization",
    encryptedValue: "{\"ciphertext\":\"...\",\"iv\":\"...\"}"
  }
];

fetch('http://localhost:4111/my/credentials/stream', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer re_xxxxxxxxxxxx',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    domain: 'api.github.com',
    credentials: encryptedCreds
  })
});
```

**Note**: Credentials must be encrypted **client-side** before upload using AES-256-GCM. See [CREDENTIALS_STORAGE.md](docs/CREDENTIALS_STORAGE.md) for details.

### Step 4: Rebuild and Restart

```bash
cd /path/to/unbrowse-mcp
pnpm install  # Update dependencies if needed
pnpm build    # Rebuild with new code
```

Then restart your MCP client (Claude Desktop, etc.).

## API Endpoint Changes

### Abilities

| Old Endpoint | New Endpoint | Auth Required |
|-------------|-------------|---------------|
| `GET /abilities` | `GET /my/abilities` | ✅ API Key |
| `GET /abilities/search` | Client-side filtering via `/my/abilities` | ✅ API Key |
| N/A | `GET /public/abilities?q=<query>` | ❌ Public |
| `GET /abilities/:id` | Same (still works) | ⚠️ Varies |

### Credentials

| Old Endpoint | New Endpoint | Auth Required |
|-------------|-------------|---------------|
| `GET /cookie-jar/:serviceName` | `GET /my/credentials/:domain` | ✅ API Key |
| `POST /credentials` | `POST /my/credentials/stream` | ✅ API Key |
| `POST /credentials/:serviceName/expire` | `DELETE /my/credentials/:domain` | ✅ API Key |

### New Endpoints

- `GET /my/abilities/favorites` - Get only favorited abilities
- `POST /my/abilities/:abilityId/favorite` - Toggle favorite status
- `POST /my/abilities/:abilityId/publish` - Publish ability to community
- `DELETE /my/abilities/:abilityId` - Delete an ability
- `GET /analytics/public/popular` - Get popular published abilities

## Breaking Changes

### 1. API Client Constructor

**Old:**
```typescript
const apiClient = new UnbrowseApiClient();
```

**New:**
```typescript
const apiClient = createApiClient(apiKey);
```

### 2. listAbilities() Parameters

**Old:**
```typescript
await apiClient.listAbilities({
  userCreds: ['domain::header'],
  filterByDomains: true,
  forToolRegistration: true
});
```

**New:**
```typescript
await apiClient.listAbilities({
  favorites: false,
  published: false
});
```

### 3. searchAbilities() Parameters

**Old:**
```typescript
await apiClient.searchAbilities(query, {
  userCreds: ['domain::header'],
  filterByDomains: true
});
```

**New:**
```typescript
// Client-side filtering
await apiClient.searchAbilities(query, {
  favorites: false,
  published: false
});
```

### 4. Credential Format

**Old (service name based):**
```typescript
await apiClient.getCookieJar('hedgemony-fund');
```

**New (domain based):**
```typescript
await apiClient.getCredentialsForDomain('www.hedgemony.fund');
// Or use the compatibility alias:
await apiClient.getCookieJar('www.hedgemony.fund');
```

## Security Improvements

### 1. User Isolation
- Each user now has their own abilities and credentials
- No cross-user data leakage
- Proper multi-tenancy support

### 2. Zero-Knowledge Encryption
- Credentials are encrypted **client-side** before upload
- Password never leaves your machine
- Server only stores encrypted values

### 3. API Key Management
- Create/revoke keys without changing password
- Per-key expiration dates
- Usage tracking (last used time)

### 4. Rate Limiting Support
- API keys can have rate limits
- Protection against abuse
- Fair usage policies

## Troubleshooting

### Error: "No token provided"
**Cause**: API key not configured or not being sent
**Solution**: Verify `apiKey` in config and check it's being passed to API client

### Error: "Invalid or expired token"
**Cause**: API key is invalid or has been revoked
**Solution**: Create a new API key via `POST /my/api-keys`

### Error: "Failed to decrypt credentials"
**Cause**: Wrong password or credentials encrypted with different password
**Solution**: Verify password matches the one used for encryption

### Empty abilities list
**Cause**: You haven't ingested any abilities yet or credentials are missing
**Solution**:
1. Check abilities exist: `GET /my/abilities`
2. Ingest new abilities: `POST /ingest/api`
3. Verify credentials are uploaded for abilities that require auth

## Getting Help

- **API Documentation**: See [API_COMPLETE_GUIDE.md](docs/API_COMPLETE_GUIDE.md)
- **Credentials Guide**: See [CREDENTIALS_STORAGE.md](docs/CREDENTIALS_STORAGE.md)
- **Issues**: Report at [GitHub Issues](https://github.com/your-org/unbrowse-mcp/issues)

## Rollback (Emergency)

If you need to temporarily roll back:

1. Checkout the previous version:
```bash
git checkout <previous-commit-hash>
```

2. Rebuild:
```bash
pnpm build
```

3. Restart your MCP client

However, note that the old version won't work with the new authenticated API endpoints.
