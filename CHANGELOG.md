# Changelog

## [Unreleased]

### Removed
- Configuration option for the Unbrowse API base URL; requests now always target `https://index.unbrowse.ai`.

### Changed
- `createApiClient` now accepts only the API key and handles the base URL internally.
- `configSchema` no longer exposes `baseUrl`; server logging references the fixed endpoint.

## [2.0.0] - 2025-10-25

### Breaking Changes

#### Authentication System Overhaul
- **BREAKING**: Migrated from unauthenticated API access to JWT/API key authentication
- **BREAKING**: All API requests now require authentication via `Authorization: Bearer <apiKey>` header
- **BREAKING**: Configuration now requires `apiKey` parameter (get from `POST /my/api-keys`)
- **BREAKING**: API endpoints changed from `/abilities` to `/my/abilities`
- **BREAKING**: Credential endpoints changed from `/cookie-jar/:service` to `/my/credentials/:domain`

#### API Client Changes
- **BREAKING**: Removed default `apiClient` export
- **BREAKING**: Must use `createApiClient(apiKey)` factory function
- **BREAKING**: `listAbilities()` parameters changed - removed `userCreds`, `filterByDomains`, `forToolRegistration`
- **BREAKING**: `searchAbilities()` now uses client-side filtering instead of server-side
- **BREAKING**: Credential methods now use domain-based keys instead of service names

### New Features

#### Dual Authentication Model
- **API Key**: Authenticates requests to Unbrowse API (server-level)
- **Password**: Decrypts credentials client-side (zero-knowledge encryption)
- Users can revoke API keys without changing their encryption password

#### User-Specific Data Isolation
- Each user has their own abilities and credentials
- No cross-user data leakage
- Full multi-tenancy support

#### New API Endpoints
- `GET /my/abilities/favorites` - Get only favorited abilities
- `POST /my/abilities/:abilityId/favorite` - Toggle favorite status
- `POST /my/abilities/:abilityId/publish` - Publish ability to community
- `DELETE /my/abilities/:abilityId` - Delete an ability
- `GET /public/abilities?q=<query>` - Search published community abilities (no auth required)
- `GET /analytics/public/popular` - Get popular published abilities
- `DELETE /my/credentials/:domain` - Delete credentials for a domain
- `DELETE /my/credentials/by-id/:credentialId` - Delete specific credential

#### Configuration Updates
- Added `apiKey` (required): Your Unbrowse API key
- Renamed `password` field with explicit description

### Changed

#### API Client (`src/api-client.ts`)
- Constructor now requires `apiKey` and uses the fixed Unbrowse base URL
- All requests include `Authorization: Bearer ${apiKey}` header
- `listAbilities()` now fetches from `/my/abilities` with `favorites` and `published` filters
- `searchAbilities()` performs client-side filtering on user's abilities
- Added `searchPublicAbilities()` for searching community-published abilities
- `getCredentialsForDomain()` replaces service-based credential lookup
- `getCookieJar()` now uses domain-based lookup (compatibility alias)
- `storeCredentials()` now uses `/my/credentials/stream` endpoint
- Added `deleteCredentialsForDomain()` and `deleteCredentialById()`

#### Main Server (`src/index.ts`)
- Creates authenticated `UnbrowseApiClient` instance on startup
- Passes `apiKey` from config to API client
- Updated error messages to include the fixed base URL
- `ingest_api_endpoint` tool now sends authenticated requests

#### Wrapper Executor (`src/wrapper-executor-enhanced.ts`)
- Added `apiClient` parameter to `executeWrapper()` function
- Added `apiClient` parameter to `listAvailableWrappers()` helper
- Added `apiClient` parameter to `getWrapperMetadata()` helper
- Added null checks before using apiClient
- Fixed credential expiration handling to work with new endpoints

### Security Improvements

1. **User Isolation**: Abilities and credentials are now per-user
2. **Zero-Knowledge Encryption**: Password never leaves client machine
3. **API Key Management**:
   - Create/revoke keys independently of password
   - Per-key expiration dates
   - Usage tracking (last used timestamps)
4. **Rate Limiting Support**: API keys can have rate limits configured

### Documentation

#### New Files
- `MIGRATION_GUIDE.md` - Step-by-step migration instructions
- `CHANGELOG.md` - This file

#### Updated Files
- `README.md` - Updated with new authentication flow and setup instructions
- `smithery.yaml` - Documented `apiKey` and password configuration requirements

### Migration Path

To upgrade from v1.x to v2.0.0:

1. **Get your API key**:
   ```bash
   # Register (if needed)
   curl -X POST http://localhost:4111/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"your@email.com","password":"SecurePass123","name":"Your Name"}'

   # Login to get JWT
   curl -X POST http://localhost:4111/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"your@email.com","password":"SecurePass123"}'

   # Create API key
   curl -X POST http://localhost:4111/my/api-keys \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"MCP Server Key","expiresAt":"2026-12-31T23:59:59Z"}'
   ```

2. **Update configuration**:
   - Add `apiKey: "re_xxxxxxxxxxxx"` to your config
   - Add `password: "your-encryption-password"` (explicitly)
   - Base URL is fixed to `https://index.unbrowse.ai`

3. **Rebuild**:
   ```bash
   pnpm install
   pnpm build
   ```

4. **Restart your MCP client** (Claude Desktop, etc.)

See [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) for detailed migration instructions.

### Internal Changes

- Removed default API client singleton
- API client now created per-server instance with user credentials
- Improved error handling for authentication failures
- Better separation of concerns between authentication and encryption

### Compatibility Notes

- **Backward Compatible**: `getCookieJar()` method still works (calls `getCredentialsForDomain()` internally)
- **Not Compatible**: Cannot use old endpoints - server must support new authenticated endpoints
- **Client-Side Breaking**: Must update client code to use new authentication model

### Tested On

- Node.js 20+
- Unbrowse API v2.0.0 (with JWT authentication)
- MCP SDK (latest)

---

## [1.0.0] - Previous Version

Initial release with:
- Unauthenticated API access
- Service-based credential storage
- Mock endpoints
- Basic wrapper execution
