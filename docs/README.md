# Reverse Engineer API Documentation

Complete API documentation for the Unbrowse Reverse Engineer platform, generated from actual curl requests and real API responses.

## 📚 Documentation Index

### Getting Started
- [**API Overview**](./api-overview.md) - Base URL, authentication, and endpoint summary

### Public Endpoints (No Auth Required)
- [**Public Endpoints**](./public-endpoints.md)
  - Health check
  - Search published abilities
  - Get ability details
  - Popular abilities leaderboard
  - Top earning abilities
  - OpenAPI specification

### Protected Endpoints (Auth Required)

#### Account & Tokens
- [**Token Management**](./tokens.md)
  - Get token balance
  - Purchase tokens
  - Transaction history

#### Domain & API Key Management
- [**Domain Verification**](./domains.md)
  - Request verification
  - Verify ownership via DNS
  - List user domains
  - Delete verification

- [**API Key Management**](./api-keys.md)
  - Create API key
  - List API keys
  - Revoke API key

#### Ability Management
- [**User Abilities**](./abilities.md)
  - Get user abilities
  - Get favorites
  - Toggle favorite
  - Publish ability
  - Delete ability

- [**MCP Execution Guide**](./MCP_EXECUTION_GUIDE.md) ⭐
  - Quick start for MCP servers
  - Complete TypeScript examples
  - Error handling patterns
  - Full working code samples

#### Analytics & Insights
- [**Analytics**](./analytics.md)
  - User statistics
  - Ability details
  - Earnings breakdown
  - Spending analysis
  - Recent charges
  - Platform revenue (admin)

#### Security & Storage
- [**Credentials Management**](./credentials.md)
  - Stream/upload credentials
  - List credentials (flat or grouped)
  - Get credentials by domain
  - Delete by domain
  - Delete specific credential

#### Ingestion & Reverse Engineering
- [**Ingestion**](./ingestion.md)
  - HAR file ingestion
  - Quick API endpoint ingestion
  - Batch URL ingestion

## 🔑 Authentication

All requests to protected endpoints must include authentication via:

**API Key (Recommended for programmatic access):**
```bash
curl http://localhost:4111/my/abilities \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Session Token (Browser-based):**
- Managed automatically by BetterAuth
- Cookie-based session management

## 🌐 Base URL

Development:
```
http://localhost:4111
```

Production: (TBD)

## 📊 Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "count": 10
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

## 🚀 Quick Start

### 1. Get an API Key
```bash
# Create an API key (requires session auth initially)
curl -X POST http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer <session-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "My First Key"}'
```

Save the returned API key - it's only shown once!

### 2. Check Your Balance
```bash
curl http://localhost:4111/my/tokens/balance \
  -H "Authorization: Bearer re_YourApiKey"
```

### 3. List Your Abilities
```bash
curl http://localhost:4111/my/abilities \
  -H "Authorization: Bearer re_YourApiKey"
```

### 4. Ingest an API
```bash
# Option A: HAR file
curl -X POST http://localhost:4111/ingest \
  -H "Authorization: Bearer re_YourApiKey" \
  -F "file=@recording.har"

# Option B: Quick single endpoint
curl -X POST http://localhost:4111/ingest/api \
  -H "Authorization: Bearer <session-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "https://api.example.com/users",
    "service_name": "Example API"
  }'
```

## 💡 Common Use Cases

### Reverse Engineer an API from Browser Traffic
1. Record HAR file in Chrome DevTools (Network tab → Export HAR)
2. Upload HAR: `POST /ingest`
3. Wait for processing (check logs)
4. List abilities: `GET /my/abilities`
5. Search abilities: `GET /public/abilities?q=search query`

### Publish an Ability to Marketplace
1. Find ability ID: `GET /my/abilities`
2. Publish: `POST /my/abilities/:id/publish`
3. Check earnings: `GET /analytics/my/earnings`

### Monitor Usage & Costs
1. View stats: `GET /analytics/my/stats`
2. Check spending: `GET /analytics/my/spending`
3. Recent charges: `GET /analytics/my/recent-charges`

### Manage Credentials
1. List all: `GET /my/credentials?grouped=true`
2. View by domain: `GET /my/credentials/api.example.com`
3. Delete domain: `DELETE /my/credentials/api.example.com`

## 🔒 Security Best Practices

### API Keys
- Store API keys securely (password manager, secrets manager)
- Rotate keys every 90 days
- Use separate keys per environment (dev, staging, prod)
- Revoke immediately if compromised
- Never commit keys to version control

### Credentials
- All credentials are AES-256 encrypted at rest
- Encryption happens client-side
- API never sees plaintext credentials
- Each user has isolated credential storage
- Credentials never shared between users

### Domain Verification
- Proves ownership via DNS TXT records
- Required for earning revenue from published abilities
- Only one user can verify each domain
- Verification is permanent (contact support to change)

## 📈 Rate Limits

Current limits:
- **4M tokens/minute** (LLM processing)
- **480 requests/minute** (API calls)

Rate limit headers (TBD):
```
X-RateLimit-Limit: 480
X-RateLimit-Remaining: 450
X-RateLimit-Reset: 1635724800
```

## 🐛 Error Handling

### Common HTTP Status Codes
- `200` - Success
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (auth required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

### Error Response Examples

Authentication required:
```json
{
  "success": false,
  "error": "Authentication required"
}
```

Invalid input:
```json
{
  "success": false,
  "error": "Invalid amount. Must be a positive number representing USD value."
}
```

Rate limit exceeded:
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later."
}
```

## 🧪 Testing with Provided API Key

Throughout this documentation, we use this test API key:
```
re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5
```

**⚠️ This is a real API key for testing purposes. Do not use in production!**

## 📝 OpenAPI Specification

Get the full OpenAPI 3.1.0 spec:
```bash
curl http://localhost:4111/docs/openapi.json
```

Use with:
- Swagger UI
- Postman
- Insomnia
- OpenAPI generators

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/anthropics/claude-code/issues)
- **Documentation**: This repository
- **API Status**: Check `/health` endpoint

## 📜 Changelog

### 2025-10-27 - Initial Documentation
- Complete API documentation from real curl requests
- All endpoints tested with actual API key
- Response examples from live API
- Comprehensive error handling documented

## 📄 License

[Add your license here]

---

**Generated**: October 27, 2025
**API Version**: 1.0.0
**Documentation Version**: 1.0.0
