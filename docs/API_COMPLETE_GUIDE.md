# Reverse Engineer API - Complete Guide

**Version**: 2.0.0 (JWT Authentication)
**Base URL**: `http://localhost:4111` (development) | `https://your-domain.com` (production)

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Authentication](#authentication)
4. [API Endpoints](#api-endpoints)
   - [Health & Documentation](#health--documentation)
   - [Authentication Endpoints](#authentication-endpoints)
   - [User Abilities](#user-abilities)
   - [Public Abilities](#public-abilities)
   - [Ability Search (Protected)](#ability-search-protected)
   - [Credentials Storage](#credentials-storage)
   - [API Keys](#api-keys)
   - [Token & Rewards System](#token--rewards-system)
   - [Domain Verification](#domain-verification)
   - [Analytics](#analytics)
   - [Ingestion](#ingestion)
5. [Common Workflows](#common-workflows)
6. [Error Handling](#error-handling)

---

## Quick Reference: All Endpoints

### Public Routes (No Authentication)
- `GET /health` - Health check
- `GET /public/abilities?q=<query>` - Search published abilities
- `GET /abilities/:id` - Get ability details by ID
- `GET /analytics/public/popular` - Popular abilities leaderboard
- `GET /analytics/public/top-earning` - Top-earning abilities
- `GET /docs/openapi.json` - OpenAPI specification

### Authentication Routes
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current user info

### User Abilities (Protected)
- `GET /my/abilities` - List your abilities
- `GET /my/abilities/favorites` - List favorite abilities
- `POST /my/abilities/:id/favorite` - Toggle favorite status
- `POST /my/abilities/:id/publish` - Publish ability
- `DELETE /my/abilities/:id` - Delete ability

### Search (Protected, Token-Charged)
- `GET /abilities/search?q=<query>` - Search your personal abilities

### Credentials (Protected)
- `POST /my/credentials/stream` - Upload encrypted credentials
- `GET /my/credentials` - List all credentials
- `GET /my/credentials/:domain` - Get credentials by domain
- `DELETE /my/credentials/:domain` - Delete domain credentials
- `DELETE /my/credentials/by-id/:id` - Delete specific credential

### API Keys (Protected)
- `POST /my/api-keys` - Create API key
- `GET /my/api-keys` - List API keys
- `DELETE /my/api-keys/:id` - Revoke API key

### Tokens & Rewards (Protected)
- `GET /my/tokens/balance` - Get token balance
- `POST /my/tokens/purchase` - Purchase tokens
- `GET /my/tokens/transactions` - Transaction history

### Domain Verification (Protected)
- `POST /my/domains/verify` - Request verification
- `POST /my/domains/:domain/verify` - Verify via DNS
- `GET /my/domains` - List domains
- `DELETE /my/domains/:domain` - Delete domain

### Analytics (Protected)
- `GET /analytics/my/stats` - Your usage stats
- `GET /analytics/my/abilities/:id` - Ability analytics
- `GET /analytics/my/earnings` - Your earnings
- `GET /analytics/my/spending` - Your spending
- `GET /analytics/my/recent-charges` - Recent charges
- `GET /analytics/platform/revenue` - Platform revenue (admin)

### Ingestion (Protected)
- `POST /ingest` - Upload HAR file
- `POST /ingest/api` - Ingest single API endpoint
- `POST /ingest/urls` - Batch ingest URLs

---

## Overview

The **Reverse Engineer API** is a platform for:
- 🔍 **Reverse engineering APIs** from HAR files or direct API endpoints
- 🎯 **Semantic search** across discovered API abilities
- 🔐 **Secure credential storage** (client-side encrypted, AES-256-GCM)
- ⭐ **Favorites system** for quick access to frequently used abilities
- 📊 **Analytics** for tracking ability usage and earnings
- 🔑 **API key management** with Unkey integration
- 💰 **Token-based rewards** for ability creators and indexers
- ✅ **Domain verification** for proving API ownership

### Technology Stack

- **Framework**: Mastra 0.21.1 (AI agent framework)
- **Authentication**: BetterAuth 1.3.29 with JWT tokens
- **Database**: PostgreSQL (users, credentials, analytics) + Infraxa Vector DB (semantic search)
- **Testing**: Vitest (integration) + Mocha (unit tests)

### Key Features

- **JWT-based authentication** (stateless, 7-day expiration)
- **Zero-knowledge credential storage** (encrypted client-side before upload)
- **Vector database search** (1536-dimension embeddings via OpenAI)
- **Automatic ability generation** from API traffic
- **Multi-tenant isolation** (per-user abilities and credentials)
- **Token-based monetization** (earn from published abilities, pay for searches)
- **Domain verification** (prove ownership via DNS TXT records)
- **Comprehensive analytics** (earnings, spending, usage stats)

---

## Quick Start

### 1. Register & Get JWT Token

```bash
# Register a new account
curl -X POST http://localhost:4111/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123",
    "name": "Your Name"
  }'

# Response includes JWT token:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "Your Name"
  }
}

# Save the token - you'll need it for all authenticated requests
export JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 2. Verify Authentication

```bash
curl -X GET http://localhost:4111/auth/me \
  -H "Authorization: Bearer $JWT_TOKEN"

# Response:
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "Your Name"
  }
}
```

### 3. Create an API Key (Optional)

API keys provide programmatic access via Unkey integration:

```bash
curl -X POST http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production API Key",
    "expiresAt": "2026-12-31T23:59:59Z"
  }'

# Response:
{
  "success": true,
  "message": "API key created successfully. Store securely - shown only once!",
  "key": "re_xxxxxxxxxxxx",
  "keyId": "key_123",
  "apiKeyId": "api_abc123"
}

# Save this key - it's only shown once!
export API_KEY="re_xxxxxxxxxxxx"
```

### 4. Ingest Your First API

```bash
# Upload a HAR file (browser network capture)
curl -X POST http://localhost:4111/ingest \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -F "file=@my-api-capture.har"

# Or ingest a single API endpoint
curl -X POST http://localhost:4111/ingest/api \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "https://api.github.com/users/octocat",
    "service_name": "github",
    "ability_name": "get-github-user",
    "description": "Fetch GitHub user profile"
  }'
```

### 5. List Your Abilities

```bash
curl -X GET http://localhost:4111/my/abilities \
  -H "Authorization: Bearer $JWT_TOKEN"

# Response:
{
  "success": true,
  "count": 5,
  "abilities": [
    {
      "userAbilityId": "uab_123",
      "abilityId": "get-github-user",
      "abilityName": "Get GitHub User",
      "serviceName": "github",
      "domain": "api.github.com",
      "description": "Fetch GitHub user profile",
      "dynamicHeadersRequired": false,
      "isFavorite": false,
      "isPublished": false,
      "createdAt": "2025-10-24T10:00:00.000Z"
    }
  ]
}
```

---

## Authentication

The API uses **JWT (JSON Web Token) authentication** powered by BetterAuth.

### How It Works

1. **Register** or **Login** to get a JWT token
2. **Include the token** in the `Authorization` header for all requests
3. **Tokens expire after 7 days** - login again to get a new token

### Authentication Methods

#### Method 1: JWT Token (Recommended)

Used for all API requests after registration/login.

**Header Format**: `Authorization: Bearer <your_jwt_token>`

**Example**:
```bash
curl -X GET http://localhost:4111/my/abilities \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### Method 2: API Key (Optional, for Programmatic Access)

Create API keys via Unkey for long-lived access.

**Header Format**: `Authorization: Bearer re_<your_api_key>`

**Example**:
```bash
curl -X GET http://localhost:4111/my/abilities \
  -H "Authorization: Bearer re_xxxxxxxxxxxx"
```

### Token Management

**Token Expiration**: JWT tokens expire after 7 days
**Refresh Strategy**: Login again to get a new token
**Security**: Tokens are signed with `JWT_SECRET` or `BETTER_AUTH_SECRET`

---

## API Endpoints

### Health & Documentation

#### `GET /health`

Check if the API is running.

**Authentication**: None required

**Response**:
```json
{
  "ok": true,
  "service": "unbrowse-agent-api",
  "timestamp": 1729740000000
}
```

**Example**:
```bash
curl http://localhost:4111/health
```

---

### Authentication Endpoints

#### `POST /auth/register`

Register a new user account.

**Authentication**: None required

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "Your Name"
}
```

**Validations**:
- Email must be valid format
- Password minimum 8 characters
- Name is required

**Response** (200 OK):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "Your Name"
  }
}
```

**Error Response** (400 Bad Request):
```json
{
  "success": false,
  "error": "Email, password, and name are required"
}
```

**Example**:
```bash
curl -X POST http://localhost:4111/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "MyPassword123",
    "name": "John Doe"
  }'
```

---

#### `POST /auth/login`

Login to get a JWT token.

**Authentication**: None required

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "Your Name"
  }
}
```

**Error Responses**:

*401 Unauthorized* - Invalid credentials:
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

*401 Unauthorized* - Email not verified (if email verification enabled):
```json
{
  "success": false,
  "error": "Email not verified"
}
```

**Example**:
```bash
curl -X POST http://localhost:4111/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123"
  }'
```

---

#### `GET /auth/me`

Get current user information from JWT token.

**Authentication**: JWT token required

**Headers**:
```
Authorization: Bearer <your_jwt_token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "Your Name"
  }
}
```

**Error Response** (401 Unauthorized):
```json
{
  "success": false,
  "authenticated": false,
  "error": "Invalid or expired token"
}
```

**Example**:
```bash
curl -X GET http://localhost:4111/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### User Abilities

#### `GET /my/abilities`

List all abilities for authenticated user.

**Authentication**: JWT token required

**Query Parameters**:
- `favorites=true` - Only return favorited abilities
- `published=true` - Only return published abilities

**Response**:
```json
{
  "success": true,
  "count": 15,
  "abilities": [
    {
      "userAbilityId": "uab_123",
      "abilityId": "get-github-user",
      "abilityName": "Get GitHub User",
      "serviceName": "github",
      "domain": "api.github.com",
      "description": "Fetch GitHub user profile by username",
      "isFavorite": false,
      "isPublished": false,
      "dynamicHeadersRequired": false,
      "createdAt": "2025-10-24T01:30:00.000Z"
    }
  ]
}
```

**Access Control Logic**:
- ✅ Always shows favorited abilities
- ✅ Shows abilities without authentication (`dynamicHeadersRequired: false`)
- ✅ Shows abilities where user has stored credentials
- ❌ Hides abilities requiring credentials user hasn't stored

**Example**:
```bash
# List all abilities
curl -X GET http://localhost:4111/my/abilities \
  -H "Authorization: Bearer $JWT_TOKEN"

# List only favorites
curl -X GET "http://localhost:4111/my/abilities?favorites=true" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

#### `GET /my/abilities/favorites`

Get only favorited abilities (useful for MCP pre-registration).

**Authentication**: JWT token required

**Response**: Same format as `/my/abilities` but filtered to favorites only.

**Example**:
```bash
curl -X GET http://localhost:4111/my/abilities/favorites \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

#### `POST /my/abilities/:abilityId/favorite`

Toggle favorite status for an ability.

**Authentication**: JWT token required

**URL Parameters**:
- `abilityId` - The ability ID to favorite/unfavorite

**Request Body**:
```json
{
  "isFavorite": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Added to favorites"
}
```

**Example**:
```bash
# Add to favorites
curl -X POST http://localhost:4111/my/abilities/uab_123/favorite \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isFavorite": true}'

# Remove from favorites
curl -X POST http://localhost:4111/my/abilities/uab_123/favorite \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isFavorite": false}'
```

---

#### `POST /my/abilities/:abilityId/publish`

Publish an ability to shared tenant (makes it discoverable by other users).

**Authentication**: JWT token required

**URL Parameters**:
- `abilityId` - The ability ID to publish

**Response**:
```json
{
  "success": true,
  "message": "Ability published successfully"
}
```

**Example**:
```bash
curl -X POST http://localhost:4111/my/abilities/uab_123/publish \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

#### `DELETE /my/abilities/:abilityId`

Delete an ability.

**Authentication**: JWT token required

**URL Parameters**:
- `abilityId` - The ability ID to delete

**Response**:
```json
{
  "success": true,
  "message": "Ability deleted successfully"
}
```

**Example**:
```bash
curl -X DELETE http://localhost:4111/my/abilities/uab_123 \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Public Abilities

Public abilities are published by users and shared with the community. These endpoints do not require authentication.

#### `GET /public/abilities`

Search published abilities from all users.

**Authentication**: None (public endpoint)

**Security**: Requires search query to prevent bulk extraction of all published abilities.

**Query Parameters**:
- `q` (required) - Search query (minimum 2 characters)
  - Also accepts `query` or `search` as alternatives
- `limit` (optional) - Number of results (1-100, default: 30)

**Response**:
```json
{
  "success": true,
  "count": 5,
  "query": "github",
  "abilities": [
    {
      "userAbilityId": "uab_123",
      "abilityId": "get-github-user",
      "abilityName": "Get GitHub User",
      "serviceName": "github",
      "domain": "api.github.com",
      "description": "Fetch GitHub user profile by username",
      "publishedAt": "2025-10-24T01:30:00.000Z",
      "isPublished": true,
      "isFavorite": false
    }
  ]
}
```

**Example**:
```bash
# Search for GitHub abilities
curl -X GET "http://localhost:4111/public/abilities?q=github"

# Search with limit
curl -X GET "http://localhost:4111/public/abilities?q=api&limit=50"

# Error: no search query
curl -X GET http://localhost:4111/public/abilities
# Returns 400: "Search query required. Use ?q=<search_term> to search published abilities"
```

**Use Cases**:
- Search community-contributed API wrappers by keyword
- Discover APIs by service name or domain
- Find pre-built integrations
- Search by ability description

**Notes**:
- Searches across: ability name, service name, domain, and description
- Results are ordered by publish date (newest first)
- Query is case-insensitive

---

#### `GET /analytics/public/popular`

Get leaderboard of most-used published abilities.

**Authentication**: None (public endpoint)

**Query Parameters**:
- `limit` (optional) - Number of results (1-100, default: 10)

**Response**:
```json
{
  "success": true,
  "count": 10,
  "popular": [
    {
      "publicAbilityId": "pub_xyz789",
      "abilityName": "Get GitHub User",
      "serviceName": "github",
      "description": "Fetch GitHub user profile by username",
      "totalUsageCount": 1523,
      "uniqueUsers": 48,
      "lastUsed": "2025-10-24T05:15:00.000Z",
      "publishedAt": "2025-10-20T01:30:00.000Z"
    }
  ]
}
```

**Example**:
```bash
# Get top 10 most-used abilities
curl -X GET http://localhost:4111/analytics/public/popular

# Get top 25
curl -X GET "http://localhost:4111/analytics/public/popular?limit=25"
```

---

### Ability Search (Protected)

#### `GET /abilities/search`

Search your personal abilities with token charging. This endpoint searches only your private and published abilities with credential filtering.

**Authentication**: JWT token or API key required

**Cost**: Variable based on query length (see Token & Rewards System)

**Query Parameters**:
- `q` (required) - Search query (minimum 1 character)
- `top_k` (optional) - Number of results (default: 10)

**Response**:
```json
{
  "success": true,
  "query": "github",
  "count": 5,
  "cost": "0.000100",
  "results": [
    {
      "userAbilityId": "uab_123",
      "abilityId": "get-github-user",
      "abilityName": "Get GitHub User",
      "serviceName": "github",
      "domain": "api.github.com",
      "description": "Fetch GitHub user profile by username",
      "isFavorite": true,
      "isPublished": false
    }
  ]
}
```

**Error - Insufficient Tokens** (402 Payment Required):
```json
{
  "success": false,
  "error": "Insufficient tokens. Please purchase tokens to continue.",
  "balance_required": "0.000100"
}
```

**Example**:
```bash
curl -X GET "http://localhost:4111/abilities/search?q=github&top_k=10" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Key Differences from `/public/abilities`**:
- `/abilities/search` - Searches YOUR personal abilities (private + published), charges tokens
- `/public/abilities` - Searches ALL published abilities from all users, free but requires query parameter

---

### Credentials Storage

For complete documentation, see [CREDENTIALS_STORAGE.md](./CREDENTIALS_STORAGE.md).

#### `POST /my/credentials/stream`

Upload encrypted credentials for a domain.

**Authentication**: JWT token required

**⚠️ Security Note**: Credentials must be encrypted **client-side** using AES-256-GCM before upload. The server stores only encrypted values.

**Request Body**:
```json
{
  "domain": "api.github.com",
  "credentials": [
    {
      "type": "header",
      "key": "Authorization",
      "encryptedValue": "{\"ciphertext\":\"base64...\",\"iv\":\"base64...\"}"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "count": 1,
  "credentials": [
    {
      "credentialId": "cred_abc123",
      "domain": "api.github.com",
      "credentialType": "header",
      "credentialKey": "Authorization",
      "encryptedValue": "{...}",
      "createdAt": "2025-10-24T01:30:00.000Z"
    }
  ]
}
```

**Example** (requires client-side encryption):
```javascript
// Client-side encryption (browser/extension)
import { encrypt } from './crypto';

const encryptionKey = localStorage.getItem('userEncryptionKey');
const credentials = [{
  type: 'header',
  key: 'Authorization',
  value: 'Bearer ghp_myGitHubToken123'  // Plaintext
}];

const encrypted = credentials.map(cred => ({
  type: cred.type,
  key: cred.key,
  encryptedValue: JSON.stringify(encrypt(cred.value, encryptionKey))
}));

// Upload to API
await fetch('http://localhost:4111/my/credentials/stream', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    domain: 'api.github.com',
    credentials: encrypted
  })
});
```

---

#### `GET /my/credentials`

List all stored credentials.

**Authentication**: JWT token required

**Query Parameters**:
- `grouped=true` - Group credentials by domain

**Response** (ungrouped):
```json
{
  "success": true,
  "count": 5,
  "credentials": [
    {
      "credentialId": "cred_abc123",
      "domain": "api.github.com",
      "credentialType": "header",
      "credentialKey": "Authorization",
      "encryptedValue": "{\"ciphertext\":\"...\",\"iv\":\"...\"}",
      "createdAt": "2025-10-24T01:00:00.000Z"
    }
  ]
}
```

**Response** (grouped):
```json
{
  "success": true,
  "grouped": true,
  "credentials": {
    "api.github.com": [
      {
        "credentialId": "cred_abc123",
        "credentialType": "header",
        "credentialKey": "Authorization",
        "encryptedValue": "{...}",
        "createdAt": "2025-10-24T01:00:00.000Z"
      }
    ],
    "api.stripe.com": [...]
  }
}
```

**Example**:
```bash
# List all credentials
curl -X GET http://localhost:4111/my/credentials \
  -H "Authorization: Bearer $JWT_TOKEN"

# List grouped by domain
curl -X GET "http://localhost:4111/my/credentials?grouped=true" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

#### `GET /my/credentials/:domain`

Get credentials for a specific domain.

**Authentication**: JWT token required

**URL Parameters**:
- `domain` - The domain to get credentials for (e.g., `api.github.com`)

**Response**:
```json
{
  "success": true,
  "domain": "api.github.com",
  "count": 2,
  "credentials": [...]
}
```

**Example**:
```bash
curl -X GET http://localhost:4111/my/credentials/api.github.com \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

#### `DELETE /my/credentials/:domain`

Delete all credentials for a domain.

**Authentication**: JWT token required

**URL Parameters**:
- `domain` - The domain to delete credentials for

**Response**:
```json
{
  "success": true,
  "domain": "api.github.com",
  "deletedCount": 2
}
```

**Example**:
```bash
curl -X DELETE http://localhost:4111/my/credentials/api.github.com \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

#### `DELETE /my/credentials/by-id/:credentialId`

Delete a specific credential by ID.

**Authentication**: JWT token required

**URL Parameters**:
- `credentialId` - The credential ID to delete

**Response**:
```json
{
  "success": true,
  "credentialId": "cred_abc123"
}
```

**Example**:
```bash
curl -X DELETE http://localhost:4111/my/credentials/by-id/cred_abc123 \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### API Keys

#### `POST /my/api-keys`

Create a new API key via Unkey.

**Authentication**: JWT token required

**Request Body**:
```json
{
  "name": "Production API",
  "expiresAt": "2026-01-01T00:00:00Z",
  "ratelimit": {
    "type": "fast",
    "limit": 100,
    "duration": 60000
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "API key created successfully",
  "key": "re_xxxxxxxxxxxx",
  "keyId": "key_abc123",
  "apiKeyId": "api_abc123"
}
```

**⚠️ Important**: The `key` is only returned once. Store it securely!

**Example**:
```bash
curl -X POST http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Production Key",
    "expiresAt": "2026-12-31T23:59:59Z"
  }'
```

---

#### `GET /my/api-keys`

List all API keys for the authenticated user.

**Authentication**: JWT token required

**Response**:
```json
{
  "success": true,
  "count": 3,
  "keys": [
    {
      "apiKeyId": "api_abc123",
      "name": "Production API",
      "keyPrefix": "re_ABC123...",
      "createdAt": "2025-10-24T01:00:00.000Z",
      "expiresAt": "2026-01-01T00:00:00.000Z",
      "lastUsedAt": "2025-10-24T02:00:00.000Z",
      "revokedAt": null
    }
  ]
}
```

**Example**:
```bash
curl -X GET http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

#### `DELETE /my/api-keys/:apiKeyId`

Revoke an API key permanently.

**Authentication**: JWT token required

**URL Parameters**:
- `apiKeyId` - The API key ID to revoke

**Response**:
```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

**Example**:
```bash
curl -X DELETE http://localhost:4111/my/api-keys/api_abc123 \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Token & Rewards System

The platform uses a token-based rewards system for monetizing API abilities and searches.

#### `GET /my/tokens/balance`

Get your current token balance and lifetime statistics.

**Authentication**: JWT token or API key required

**Response**:
```json
{
  "success": true,
  "balance": {
    "current": "10.50",
    "lifetimeEarned": "25.00",
    "lifetimeSpent": "14.50",
    "lifetimePurchased": "10.00"
  }
}
```

**Example**:
```bash
curl -X GET http://localhost:4111/my/tokens/balance \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

#### `POST /my/tokens/purchase`

Purchase tokens to use for searches and accessing paid abilities.

**Authentication**: JWT token or API key required

**Request Body**:
```json
{
  "amount": 10.00,
  "paymentMethod": "stripe",
  "paymentDetails": {
    "paymentMethodId": "pm_123456"
  }
}
```

**Parameters**:
- `amount` (required) - USD amount to purchase ($1.00 minimum, $10,000 maximum)
- `paymentMethod` (optional) - Payment method type (default: "simulated")
- `paymentDetails` (optional) - Payment processor details

**Response**:
```json
{
  "success": true,
  "message": "Tokens purchased successfully",
  "purchase": {
    "amount": "10.00",
    "newBalance": "20.50",
    "transactionId": "txn_abc123"
  }
}
```

**Error Responses**:

*400 Bad Request* - Invalid amount:
```json
{
  "success": false,
  "error": "Minimum purchase amount is $1.00 USD"
}
```

**Example**:
```bash
curl -X POST http://localhost:4111/my/tokens/purchase \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10.00,
    "paymentMethod": "stripe"
  }'
```

**Notes**:
- Tokens are denominated in USD (1 token = $1.00 USD)
- Minimum purchase: $1.00
- Maximum purchase: $10,000 per transaction
- Currently uses simulated payments (Stripe integration pending)

---

#### `GET /my/tokens/transactions`

Get your token transaction history.

**Authentication**: JWT token or API key required

**Query Parameters**:
- `limit` (optional) - Number of transactions to return (1-100, default: 50)

**Response**:
```json
{
  "success": true,
  "count": 10,
  "transactions": [
    {
      "transactionId": "txn_abc123",
      "type": "purchase",
      "amount": "10.00",
      "balance": "20.50",
      "description": "Token purchase",
      "createdAt": "2025-10-24T10:30:00.000Z"
    },
    {
      "transactionId": "txn_def456",
      "type": "search_charge",
      "amount": "-0.000100",
      "balance": "20.499900",
      "description": "Search query: github",
      "createdAt": "2025-10-24T10:35:00.000Z"
    }
  ]
}
```

**Transaction Types**:
- `purchase` - Token purchase via payment
- `search_charge` - Charge for using `/abilities/search`
- `ability_charge` - Charge for using a paid ability
- `earning` - Earnings from your published abilities being used

**Example**:
```bash
curl -X GET "http://localhost:4111/my/tokens/transactions?limit=20" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Domain Verification

Domain verification allows you to prove ownership of API domains, which can increase trust and earnings for your published abilities.

#### `POST /my/domains/verify`

Request verification for a domain you own.

**Authentication**: JWT token or API key required

**Request Body**:
```json
{
  "domain": "api.example.com"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Verification record created. Add the TXT record to your DNS.",
  "domain": "api.example.com",
  "verificationToken": "unbrowse-verify-abc123def456",
  "txtRecord": {
    "name": "_unbrowse-verify.api.example.com",
    "type": "TXT",
    "value": "unbrowse-verify-abc123def456"
  },
  "instructions": "Add this TXT record to your DNS, then call POST /my/domains/:domain/verify"
}
```

**Example**:
```bash
curl -X POST http://localhost:4111/my/domains/verify \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "api.example.com"
  }'
```

---

#### `POST /my/domains/:domain/verify`

Verify domain ownership via DNS TXT record.

**Authentication**: JWT token or API key required

**URL Parameters**:
- `domain` - The domain to verify (e.g., `api.example.com`)

**Response** (Success):
```json
{
  "success": true,
  "message": "Domain verified successfully!",
  "domain": "api.example.com",
  "verifiedAt": "2025-10-24T10:30:00.000Z"
}
```

**Response** (Failed):
```json
{
  "success": false,
  "error": "DNS verification failed. TXT record not found or incorrect.",
  "expected": "unbrowse-verify-abc123def456",
  "found": null
}
```

**Example**:
```bash
curl -X POST http://localhost:4111/my/domains/api.example.com/verify \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Workflow**:
1. Call `POST /my/domains/verify` to get verification token
2. Add TXT record to your DNS: `_unbrowse-verify.api.example.com` = `unbrowse-verify-abc123def456`
3. Wait for DNS propagation (typically 1-5 minutes)
4. Call `POST /my/domains/:domain/verify` to complete verification
5. Once verified, abilities for that domain show "Verified Owner" badge

---

#### `GET /my/domains`

List all your domain verification records.

**Authentication**: JWT token or API key required

**Response**:
```json
{
  "success": true,
  "count": 2,
  "domains": [
    {
      "domainId": "dom_abc123",
      "domain": "api.example.com",
      "verificationToken": "unbrowse-verify-abc123",
      "verified": true,
      "verifiedAt": "2025-10-24T10:30:00.000Z",
      "createdAt": "2025-10-24T10:00:00.000Z"
    },
    {
      "domainId": "dom_def456",
      "domain": "api.test.com",
      "verificationToken": "unbrowse-verify-def456",
      "verified": false,
      "verifiedAt": null,
      "createdAt": "2025-10-24T11:00:00.000Z"
    }
  ]
}
```

**Example**:
```bash
curl -X GET http://localhost:4111/my/domains \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

#### `DELETE /my/domains/:domain`

Delete a domain verification record (only unverified domains can be deleted).

**Authentication**: JWT token or API key required

**URL Parameters**:
- `domain` - The domain to delete

**Response**:
```json
{
  "success": true,
  "message": "Domain verification deleted successfully"
}
```

**Error Response** (Verified domain):
```json
{
  "success": false,
  "error": "Cannot delete verified domain. Contact support if you need to remove it."
}
```

**Example**:
```bash
curl -X DELETE http://localhost:4111/my/domains/api.test.com \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Analytics

#### `GET /analytics/my/stats`

Get usage statistics for authenticated user.

**Authentication**: JWT token required

**Response**:
```json
{
  "success": true,
  "stats": {
    "totalAbilities": 15,
    "totalExecutions": 342,
    "successRate": 0.95,
    "topAbilities": [
      {
        "abilityName": "Get GitHub User",
        "executionCount": 150
      }
    ]
  }
}
```

**Example**:
```bash
curl -X GET http://localhost:4111/analytics/my/stats \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

#### `GET /analytics/my/abilities/:abilityId`

Get detailed analytics for a specific ability.

**Authentication**: JWT token required

**URL Parameters**:
- `abilityId` - The ability ID to get analytics for

**Response**:
```json
{
  "success": true,
  "abilityId": "get-github-user",
  "analytics": {
    "totalExecutions": 150,
    "successCount": 145,
    "failureCount": 5,
    "avgExecutionTime": 234,
    "recentExecutions": [...]
  }
}
```

**Example**:
```bash
curl -X GET http://localhost:4111/analytics/my/abilities/uab_123 \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

#### `GET /analytics/public/popular`

Get most popular published abilities (public endpoint).

**Authentication**: None required

**Query Parameters**:
- `limit=10` - Number of results to return (default: 10, max: 100)

**Response**:
```json
{
  "success": true,
  "count": 10,
  "abilities": [
    {
      "abilityName": "Get Weather Data",
      "executionCount": 5000,
      "publishedBy": "user_123"
    }
  ]
}
```

**Example**:
```bash
curl -X GET "http://localhost:4111/analytics/public/popular?limit=20"
```

---

#### `GET /analytics/my/earnings`

Get your earnings as an ability indexer (from users consuming your published abilities).

**Authentication**: JWT token or API key required

**Response**:
```json
{
  "success": true,
  "earnings": {
    "totalEarnings": "12.45",
    "thisMonth": "3.20",
    "thisWeek": "0.85",
    "today": "0.15",
    "topEarningAbilities": [
      {
        "abilityId": "get-github-user",
        "abilityName": "Get GitHub User",
        "earnings": "5.30",
        "usageCount": 530
      }
    ]
  }
}
```

**Example**:
```bash
curl -X GET http://localhost:4111/analytics/my/earnings \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

#### `GET /analytics/my/spending`

Get your spending breakdown (tokens spent on searches and abilities).

**Authentication**: JWT token or API key required

**Response**:
```json
{
  "success": true,
  "spending": {
    "totalSpent": "8.75",
    "thisMonth": "2.40",
    "thisWeek": "0.60",
    "today": "0.10",
    "breakdown": {
      "searches": "1.25",
      "abilityUsage": "7.50"
    },
    "topSpendingAbilities": [
      {
        "abilityId": "premium-data-api",
        "abilityName": "Premium Data API",
        "spent": "4.20",
        "usageCount": 42
      }
    ]
  }
}
```

**Example**:
```bash
curl -X GET http://localhost:4111/analytics/my/spending \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

#### `GET /analytics/my/recent-charges`

Get your recent token charges with details.

**Authentication**: JWT token or API key required

**Query Parameters**:
- `limit` (optional) - Number of charges to return (1-100, default: 20)

**Response**:
```json
{
  "success": true,
  "count": 5,
  "charges": [
    {
      "chargeId": "chg_abc123",
      "amount": "0.000100",
      "type": "search",
      "description": "Search query: github api",
      "metadata": {
        "query": "github api",
        "queryLength": 10
      },
      "createdAt": "2025-10-24T10:35:00.000Z"
    },
    {
      "chargeId": "chg_def456",
      "amount": "0.100000",
      "type": "ability_usage",
      "description": "Used ability: Premium Data API",
      "metadata": {
        "abilityId": "premium-data-api",
        "abilityName": "Premium Data API"
      },
      "createdAt": "2025-10-24T10:30:00.000Z"
    }
  ]
}
```

**Example**:
```bash
curl -X GET "http://localhost:4111/analytics/my/recent-charges?limit=10" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

#### `GET /analytics/public/top-earning`

Get leaderboard of top-earning published abilities (public endpoint).

**Authentication**: None required

**Query Parameters**:
- `limit` (optional) - Number of abilities to return (1-50, default: 10)

**Response**:
```json
{
  "success": true,
  "count": 10,
  "abilities": [
    {
      "abilityId": "premium-data-api",
      "abilityName": "Premium Data API",
      "serviceName": "Data Provider",
      "domain": "api.dataprovider.com",
      "totalEarnings": "245.50",
      "usageCount": 2455,
      "uniqueUsers": 87,
      "publishedBy": "user_abc123",
      "publishedAt": "2025-09-15T10:00:00.000Z"
    }
  ]
}
```

**Example**:
```bash
curl -X GET "http://localhost:4111/analytics/public/top-earning?limit=20"
```

**Use Cases**:
- Discover high-value abilities to use or replicate
- See which API domains are most valuable
- Understand earning potential for publishing abilities

---

#### `GET /analytics/platform/revenue`

Get platform-wide revenue statistics (admin only).

**Authentication**: JWT token or API key required (admin role)

**Response**:
```json
{
  "success": true,
  "revenue": {
    "totalRevenue": "5420.30",
    "platformFees": "542.03",
    "indexerEarnings": "4878.27",
    "thisMonth": {
      "revenue": "1250.00",
      "platformFees": "125.00",
      "indexerEarnings": "1125.00"
    },
    "breakdown": {
      "searchCharges": "150.45",
      "abilityCharges": "5269.85"
    }
  }
}
```

**Example**:
```bash
curl -X GET http://localhost:4111/analytics/platform/revenue \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Notes**:
- Currently requires authentication but no admin role check (TODO)
- Platform takes 10% fee on all transactions
- Remaining 90% goes to ability indexers/creators

---

### Ingestion

#### `POST /ingest`

Upload and process a HAR file (HTTP Archive).

**Authentication**: JWT token required

**Content-Type**: `multipart/form-data`

**Form Data**:
- `file` - HAR file (.har or .json format)

**Response**:
```json
{
  "success": true,
  "message": "HAR file accepted for processing",
  "data": {
    "session_id": "session-123-uuid",
    "har_file": {
      "filename": "capture.har",
      "local_path": "/path/to/har-123-uuid.har",
      "file_size": 1048576
    },
    "processing": {
      "mode": "chunked_queued",
      "max_tokens_per_chunk": 100000,
      "status": "Processing in background"
    }
  }
}
```

**Processing**:
- Large HAR files are automatically chunked
- Processing happens in the background
- Respects xAI rate limits (4M tokens/min, 480 requests/min)

**Example**:
```bash
curl -X POST http://localhost:4111/ingest \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -F "file=@my-capture.har"
```

---

#### `POST /ingest/api`

Ingest a single API endpoint directly.

**Authentication**: JWT token required (API key auth not supported for this endpoint)

**Request Body**:
```json
{
  "input": "https://api.github.com/users/octocat",
  "service_name": "github",
  "ability_name": "get-github-user",
  "description": "Fetch GitHub user profile by username"
}
```

**Parameters**:
- `input` - URL or curl command to ingest
- `service_name` - Name of the service (e.g., "github", "stripe")
- `ability_name` (optional) - Custom ability name
- `description` (optional) - Ability description

**Response**:
```json
{
  "success": true,
  "message": "API endpoint ingested successfully",
  "ability_id": "get-github-user",
  "ability_name": "Get GitHub User",
  "stored": true
}
```

**Example**:
```bash
# Ingest from URL
curl -X POST http://localhost:4111/ingest/api \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "https://api.github.com/repos/octocat/hello-world",
    "service_name": "github"
  }'

# Ingest from curl command
curl -X POST http://localhost:4111/ingest/api \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "curl https://api.stripe.com/v1/customers -u sk_test_xxx:",
    "service_name": "stripe"
  }'
```

---

#### `POST /ingest/urls`

Batch ingest multiple URLs or curl commands.

**Authentication**: JWT token required (API key auth not supported for this endpoint)

**Request Body**:
```json
{
  "text": "https://api.github.com/users/octocat\nhttps://api.github.com/repos/octocat/hello-world\ncurl https://api.stripe.com/v1/customers -u sk_test_xxx:",
  "service_name": "mixed-apis"
}
```

**Parameters**:
- `text` - Text containing URLs and/or curl commands (newline separated)
- `service_name` - Service name for all ingested abilities

**Response**:
```json
{
  "success": true,
  "message": "URL ingestion completed successfully",
  "data": {
    "session_id": "url-ingestion-123-uuid",
    "service_name": "mixed-apis",
    "text_length": 250,
    "tool_calls_count": 3,
    "abilities_ingested": 3,
    "abilities": [
      {
        "ability_id": "get-github-user",
        "ability_name": "Get GitHub User",
        "success": true
      }
    ]
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:4111/ingest/urls \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "https://api.github.com/users/octocat\nhttps://api.github.com/repos/octocat/hello-world",
    "service_name": "github"
  }'
```

---

## Common Workflows

### Workflow 1: Complete Setup - Register to First API Call

```bash
# 1. Register
RESPONSE=$(curl -s -X POST http://localhost:4111/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@example.com",
    "password": "SecurePass123",
    "name": "Developer"
  }')

# 2. Extract JWT token
JWT_TOKEN=$(echo $RESPONSE | jq -r '.token')
echo "JWT Token: $JWT_TOKEN"

# 3. Verify authentication
curl -X GET http://localhost:4111/auth/me \
  -H "Authorization: Bearer $JWT_TOKEN"

# 4. Ingest an API
curl -X POST http://localhost:4111/ingest/api \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "https://api.github.com/users/octocat",
    "service_name": "github"
  }'

# 5. List abilities
curl -X GET http://localhost:4111/my/abilities \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Workflow 2: Store Encrypted Credentials

```javascript
// Client-side (browser or extension)
import crypto from 'crypto';

// 1. Generate or retrieve user's encryption key (stored locally, never sent to server)
let encryptionKey = localStorage.getItem('encryptionKey');
if (!encryptionKey) {
  encryptionKey = crypto.randomBytes(32).toString('hex');
  localStorage.setItem('encryptionKey', encryptionKey);
}

// 2. Encrypt credential
function encryptCredential(value, key) {
  const iv = crypto.randomBytes(12);
  const keyBuffer = crypto.createHash('sha256').update(key).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  let encrypted = cipher.update(value, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([encrypted, authTag]);

  return {
    ciphertext: combined.toString('base64'),
    iv: iv.toString('base64')
  };
}

// 3. Prepare credentials
const credentials = [{
  type: 'header',
  key: 'Authorization',
  value: 'Bearer ghp_myGitHubPersonalAccessToken'
}];

const encryptedCreds = credentials.map(cred => ({
  type: cred.type,
  key: cred.key,
  encryptedValue: JSON.stringify(encryptCredential(cred.value, encryptionKey))
}));

// 4. Upload to API
const response = await fetch('http://localhost:4111/my/credentials/stream', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    domain: 'api.github.com',
    credentials: encryptedCreds
  })
});

console.log(await response.json());
// Now abilities requiring GitHub auth will appear in your searches!
```

---

### Workflow 3: HAR File Ingestion

```bash
# 1. Capture HAR file
# In Chrome/Firefox: DevTools > Network > Right-click > Save all as HAR

# 2. Upload HAR file
JWT_TOKEN="your_jwt_token"

curl -X POST http://localhost:4111/ingest \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -F "file=@github-browsing.har"

# Response includes session_id for tracking
# {
#   "success": true,
#   "data": {
#     "session_id": "session-123-uuid",
#     "processing": {
#       "status": "Processing in background"
#     }
#   }
# }

# 3. Wait for processing (30 seconds to 2 minutes depending on file size)
sleep 60

# 4. Check discovered abilities
curl -X GET http://localhost:4111/my/abilities \
  -H "Authorization: Bearer $JWT_TOKEN"

# 5. Favorite important ones for quick access
curl -X POST http://localhost:4111/my/abilities/uab_123/favorite \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isFavorite": true}'
```

---

### Workflow 4: API Key Management

```bash
JWT_TOKEN="your_jwt_token"

# 1. Create a new API key
NEW_KEY=$(curl -s -X POST http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Key v2",
    "expiresAt": "2026-12-31T23:59:59Z"
  }' | jq -r '.key')

echo "New API Key: $NEW_KEY"
# Save this key securely!

# 2. Test the new key
curl -X GET http://localhost:4111/my/abilities \
  -H "Authorization: Bearer $NEW_KEY"

# 3. List all keys
curl -X GET http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer $JWT_TOKEN"

# 4. Revoke old key
curl -X DELETE http://localhost:4111/my/api-keys/OLD_KEY_ID \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Workflow 5: Publish & Share Abilities

```bash
JWT_TOKEN="your_jwt_token"

# 1. List your private abilities
curl -X GET http://localhost:4111/my/abilities \
  -H "Authorization: Bearer $JWT_TOKEN"

# Response shows your private abilities:
# {
#   "abilities": [
#     {
#       "userAbilityId": "uab_123",
#       "abilityName": "Get GitHub User",
#       "published": false,  ← Private
#       "isFavorite": false
#     }
#   ]
# }

# 2. Mark an ability as favorite (for quick access)
curl -X POST http://localhost:4111/my/abilities/uab_123/favorite \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isFavorite": true}'

# 3. Publish ability to share with community
curl -X POST http://localhost:4111/my/abilities/uab_123/publish \
  -H "Authorization: Bearer $JWT_TOKEN"

# Response: { "success": true, "message": "Ability published successfully" }

# 4. Search for your published ability (no auth required)
curl -X GET "http://localhost:4111/public/abilities?q=github"

# Response includes your published ability:
# {
#   "success": true,
#   "count": 1,
#   "query": "github",
#   "abilities": [
#     {
#       "userAbilityId": "uab_123",
#       "abilityName": "Get GitHub User",
#       "serviceName": "github",
#       "publishedAt": "2025-10-24T10:30:00Z",
#       "isPublished": true
#     }
#   ]
# }

# 5. Check popular abilities leaderboard
curl -X GET "http://localhost:4111/analytics/public/popular?limit=10"

# 6. List only your favorites
curl -X GET http://localhost:4111/my/abilities/favorites \
  -H "Authorization: Bearer $JWT_TOKEN"

# 7. Filter to only published abilities
curl -X GET "http://localhost:4111/my/abilities?published=true" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Workflow Summary**:
1. Create abilities (via HAR ingestion or direct API ingestion)
2. Test and favorite useful abilities
3. Publish the best ones to share with community
4. Community discovers via search: `/public/abilities?q=<keyword>`
5. Track usage with analytics endpoints

**Security Note**:
- `/public/abilities` requires a search query (`?q=`) to prevent bulk extraction
- This protects the community database while enabling discovery

---

## Error Handling

### Standard Error Response Format

All errors return this format:

```json
{
  "success": false,
  "error": "Description of what went wrong"
}
```

### HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 200 | Success | Request completed successfully |
| 400 | Bad Request | Invalid input, missing parameters, malformed JSON |
| 401 | Unauthorized | Missing, invalid, or expired JWT token |
| 403 | Forbidden | Authenticated but not authorized for this resource |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Internal server error, database connection issues |

### Common Error Scenarios

#### 401 Unauthorized - No Token

```json
{
  "success": false,
  "authenticated": false,
  "error": "No token provided"
}
```

**Solution**: Include `Authorization: Bearer <token>` header

---

#### 401 Unauthorized - Invalid Token

```json
{
  "success": false,
  "authenticated": false,
  "error": "Invalid or expired token"
}
```

**Solutions**:
1. Check token is correctly copied (no extra spaces)
2. Login again to get a fresh token (tokens expire after 7 days)
3. Verify JWT_SECRET environment variable is consistent

---

#### 400 Bad Request - Missing Parameters

```json
{
  "success": false,
  "error": "Email, password, and name are required"
}
```

**Solution**: Check request body includes all required fields

---

#### 400 Bad Request - Invalid Email/Password

```json
{
  "success": false,
  "error": "Email not verified"
}
```

**Solution**: If email verification is enabled (with Resend), check email for verification link

---

#### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Failed to ingest HAR file"
}
```

**Common Causes**:
1. Database connection issues
2. Vector DB (Infraxa) timeout
3. Invalid HAR file format
4. Exceeded rate limits

**Solutions**:
1. Check server logs for details
2. Verify database is running
3. Ensure HAR file is valid JSON
4. Wait before retrying if rate limited

---

## Additional Resources

- **[AUTHENTICATION.md](./AUTHENTICATION.md)** - Deep dive into JWT authentication
- **[CREDENTIALS_STORAGE.md](./CREDENTIALS_STORAGE.md)** - Client-side encryption guide
- **[HAR_CHUNKING.md](./HAR_CHUNKING.md)** - How large HAR files are processed
- **[API_INGESTION.md](./API_INGESTION.md)** - Detailed ingestion workflow
- **[DATABASE.md](./DATABASE.md)** - Database schema and queries
- **[TESTING.md](./TESTING.md)** - Running and writing tests

---

## Changelog

### Version 2.1.0 (2025-10-26)

**New Features**:
- Token & Rewards System
  - `GET /my/tokens/balance` - Check token balance and lifetime stats
  - `POST /my/tokens/purchase` - Purchase tokens ($1-$10,000 per transaction)
  - `GET /my/tokens/transactions` - Transaction history with filtering
- Domain Verification
  - `POST /my/domains/verify` - Request domain verification
  - `POST /my/domains/:domain/verify` - Verify ownership via DNS TXT record
  - `GET /my/domains` - List verified domains
  - `DELETE /my/domains/:domain` - Remove unverified domains
- Enhanced Analytics
  - `GET /analytics/my/earnings` - Track earnings as ability indexer
  - `GET /analytics/my/spending` - Spending breakdown by category
  - `GET /analytics/my/recent-charges` - Recent charges with metadata
  - `GET /analytics/public/top-earning` - Top-earning abilities leaderboard
  - `GET /analytics/platform/revenue` - Platform revenue stats (admin)
- Protected Search
  - `GET /abilities/search` - Token-charged personal ability search

**Updated**:
- Documentation now includes all 40+ API endpoints
- Fixed embedding dimension documentation (1536 dimensions, not 3072)
- Added comprehensive examples for all new routes
- Updated Table of Contents with new sections

### Version 2.0.0 (2025-10-24)

**⚠️ Breaking Changes**:
- Removed Phantom wallet authentication (commented out, not implemented)
- Removed BetterAuth handler routes
- Switched to JWT token-based authentication

**New Features**:
- JWT authentication with BetterAuth backend
- Stateless authentication (no session cookies)
- 7-day token expiration
- POST /auth/register endpoint
- POST /auth/login endpoint
- GET /auth/me endpoint

**Updated**:
- All authentication examples use JWT tokens
- Authorization header format: `Authorization: Bearer <token>`
- Simplified authentication flow

**Preserved**:
- All user abilities endpoints
- Credentials storage (client-encrypted)
- API key management (Unkey)
- Analytics endpoints
- HAR ingestion
- Multi-tenant isolation

---

## Support & Contributing

- **Issues**: [GitHub Issues](https://github.com/your-org/reverse-engineer/issues)
- **Documentation**: This guide + linked resources
- **Questions**: Create a discussion in GitHub

**Environment Variables**: See `.env.example` for complete configuration

**Prerequisites**:
- Node.js 20+
- PostgreSQL 15+
- Infraxa account (vector database)
- Optional: Resend account (email verification)
- Optional: Unkey account (API key management)

---

*Last Updated: 2025-10-26*
*API Version: 2.1.0*
*Framework: Mastra 0.21.1 + BetterAuth 1.3.29 + JWT*
*Total Endpoints: 40+*
