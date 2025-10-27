# API Overview

## Base URL
```
http://localhost:4111
```

## Authentication
All protected endpoints require authentication via one of:
- **API Key**: Pass in `Authorization: Bearer <api_key>` header
- **Session Token**: BetterAuth session cookie

## API Endpoints Summary

### Public Endpoints (No Auth Required)
- `GET /health` - Health check
- `GET /public/abilities` - Search published abilities (requires API key but no session)
- `GET /abilities/:id` - Get ability details
- `GET /analytics/public/popular` - Get popular abilities
- `GET /analytics/public/top-earning` - Get top earning abilities
- `GET /docs/openapi.json` - OpenAPI specification

### Token/Balance Management (Protected)
- `GET /my/tokens/balance` - Get user's token balance
- `POST /my/tokens/purchase` - Purchase tokens
- `GET /my/tokens/transactions` - Get transaction history

### Domain Verification (Protected)
- `POST /my/domains/verify` - Request domain verification
- `POST /my/domains/:domain/verify` - Verify domain ownership
- `GET /my/domains` - Get user's domains
- `DELETE /my/domains/:domain` - Delete domain verification

### API Key Management (Protected)
- `POST /my/api-keys` - Create new API key
- `GET /my/api-keys` - List user's API keys
- `DELETE /my/api-keys/:apiKeyId` - Revoke API key

### User Abilities Management (Protected)
- `GET /my/abilities` - Get user's abilities
- `GET /my/abilities/favorites` - Get favorite abilities
- `POST /my/abilities/:abilityId/favorite` - Toggle favorite status
- `POST /my/abilities/:abilityId/publish` - Publish ability
- `DELETE /my/abilities/:abilityId` - Delete ability

### Analytics (Protected)
- `GET /analytics/my/stats` - Get user's ability usage stats
- `GET /analytics/my/abilities/:abilityId` - Get detailed ability stats
- `GET /analytics/my/earnings` - Get user's earnings as indexer
- `GET /analytics/my/spending` - Get user's spending breakdown
- `GET /analytics/my/recent-charges` - Get recent charges
- `GET /analytics/platform/revenue` - Get platform revenue (admin)

### Credentials Management (Protected)
- `POST /my/credentials/stream` - Stream/upsert credentials
- `GET /my/credentials` - List all credentials
- `GET /my/credentials/:domain` - Get credentials by domain
- `DELETE /my/credentials/:domain` - Delete all credentials for domain
- `DELETE /my/credentials/by-id/:credentialId` - Delete specific credential

### Ingestion (Protected)
- `POST /ingest` - Ingest HAR file
- `POST /ingest/api` - Quick ingest single API endpoint
- `POST /ingest/urls` - Batch URL ingestion

## Common Response Format

Success:
```json
{
  "success": true,
  "data": { ... },
  "count": 10
}
```

Error:
```json
{
  "success": false,
  "error": "Error message"
}
```

## Rate Limits
- Max tokens per minute: 4M
- Max requests per minute: 480

## Next Steps
See individual endpoint documentation for detailed request/response examples.
