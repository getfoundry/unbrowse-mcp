# Authentication Guide

Complete guide to authentication in the Reverse Engineer API, covering both session-based and API key authentication.

**Version**: 4.0.0
**Authentication Methods**: Better Auth Sessions + Unkey API Keys
**Backend**: Better Auth 1.3.29 with Bearer Plugin + Unkey API Key Service
**Framework**: Mastra 0.21.1

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication Methods Comparison](#authentication-methods-comparison)
3. [Architecture](#architecture)
4. [Quick Start](#quick-start)
5. [Better Auth Endpoints](#better-auth-endpoints)
6. [Frontend Integration](#frontend-integration)
7. [Using the Official Client](#using-the-official-client)
8. [API Key Authentication](#api-key-authentication)
9. [Testing Authentication](#testing-authentication)
10. [Security Best Practices](#security-best-practices)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The Reverse Engineer API supports **two authentication methods** that work seamlessly together:

1. **Better Auth Sessions** - For user-facing applications (web, mobile)
2. **Unkey API Keys** - For programmatic access (CLI tools, scripts, server-to-server)

Both methods use the same `Authorization: Bearer <token>` header format, and the API automatically detects which type of token you're using.

### Key Features

- ✅ **Dual authentication system** - Session tokens OR API keys
- ✅ **Better Auth native endpoints** - No custom wrappers, just Better Auth
- ✅ **Unkey API key management** - Enterprise-grade API key service
- ✅ **Automatic fallback** - API tries API key auth first, then session auth
- ✅ **Bearer token authentication** - Industry-standard RFC 6750
- ✅ **Session tokens** - Secure, 7-day cryptographically-signed tokens
- ✅ **API keys with rate limiting** - Optional rate limits per key
- ✅ **Email/password authentication** - Simple username/password flow
- ✅ **PostgreSQL storage** - User data and sessions in database
- ✅ **Multi-tenant isolation** - Users only see their own data
- ✅ **Official client library** - Use `better-auth/client` for frontend
- ✅ **Usage tracking** - Track last used timestamp for API keys

### What Changed in v4.0.0

**Removed**:
- ❌ Custom auth wrapper routes at `/auth/*`
- ❌ Custom response formats

**Added**:
- ✅ Better Auth native endpoints at `/better-auth/*`
- ✅ Standard Better Auth response formats
- ✅ Full compatibility with Better Auth client library
- ✅ Unkey API key authentication for programmatic access

---

## Authentication Methods Comparison

Choose the right authentication method for your use case:

| Feature | Session Tokens | API Keys |
|---------|---------------|----------|
| **Best For** | Web apps, mobile apps, user-facing | CLI tools, scripts, server-to-server, automation |
| **Lifetime** | 7 days (auto-refresh) | Configurable (default: no expiration) |
| **How to Get** | Login via `/better-auth/sign-in/email` | Create via `/my/api-keys` (requires session) |
| **Revocation** | Sign out via `/better-auth/sign-out` | Delete via `/my/api-keys/:id` |
| **Rate Limiting** | Built-in (100 req/min per IP) | Configurable per key |
| **Usage Tracking** | Session expiry only | Last used timestamp tracked |
| **Storage** | PostgreSQL `session` table | PostgreSQL `api_keys` + Unkey service |
| **Format** | `Bearer <session_token>` | `Bearer re_<key>` |
| **Prefix** | No prefix | `re_` (reverse engineer) |
| **User Context** | Sets `authMethod: 'session'` | Sets `authMethod: 'api_key'` |

### When to Use Session Tokens
- ✅ Building a web or mobile application
- ✅ Need automatic token refresh
- ✅ User will interact with UI
- ✅ Short-lived access (expires in 7 days)

### When to Use API Keys
- ✅ Building CLI tools or SDKs
- ✅ Server-to-server communication
- ✅ Background jobs or automation
- ✅ Long-lived access (no expiration by default)
- ✅ Need per-key rate limiting
- ✅ Want to track usage per integration

---

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Client Application                               │
│  (Browser, Mobile App, CLI, Scripts, Postman, etc.)                     │
│                                                                          │
│  Option 1: Better Auth Session Token (web/mobile)                       │
│  Authorization: Bearer <session_token>                                   │
│                                                                          │
│  Option 2: API Key (CLI/scripts/server-to-server)                       │
│  Authorization: Bearer re_<api_key>                                      │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
                     │ HTTP Request with Bearer token
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Mastra Server (Port 4111)                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │         Authentication Middleware (middleware.ts)                 │  │
│  │                                                                   │  │
│  │  Step 1: Try API Key Auth (api-key-auth.ts)                      │  │
│  │  ├─ Extract Bearer token from Authorization header               │  │
│  │  ├─ If starts with "re_": verify with Unkey service              │  │
│  │  ├─ Look up user in local database (api_keys table)              │  │
│  │  └─ Set userId, authMethod='api_key' in context                  │  │
│  │                                                                   │  │
│  │  Step 2: If no API key, try Session Auth                         │  │
│  │  ├─ Call Better Auth: auth.api.getSession()                      │  │
│  │  ├─ Verify session token in PostgreSQL                           │  │
│  │  └─ Set userId, authMethod='session' in context                  │  │
│  │                                                                   │  │
│  │  Step 3: Pass to route handler with userId in context            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │         Route Handlers (routes.ts)                                │  │
│  │  • /better-auth/*  → Better Auth (login, register, etc.)         │  │
│  │  • /my/*           → Protected routes (requires auth)            │  │
│  │  • /my/api-keys    → API key management                          │  │
│  │  • /public/*       → Public routes (optional auth)               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└───────────────────┬──────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  External Services                                                       │
│  ┌──────────────────────┐         ┌──────────────────────────────────┐ │
│  │   Unkey Service      │         │   PostgreSQL Database            │ │
│  │  (API Key Mgmt)      │         │                                  │ │
│  │                      │         │  Tables:                         │ │
│  │  • Verify keys       │         │  • user      → User accounts     │ │
│  │  • Create keys       │         │  • session   → Active sessions   │ │
│  │  • Rate limiting     │         │  • api_keys  → API key metadata  │ │
│  │  • Usage tracking    │         │  • account   → OAuth links       │ │
│  └──────────────────────┘         │  • verification → Email tokens   │ │
│                                   │  • audit_logs → API key audit    │ │
│                                   └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Session Token Flow

1. **Registration**: User registers with email/password at `/better-auth/sign-up/email`
2. **Response**: Better Auth returns `{ user, token }` where token is the session token
3. **Storage**: Client stores token (localStorage, secure storage, etc.)
4. **Requests**: Client includes `Authorization: Bearer <session_token>` header
5. **Validation**: Middleware tries API key auth first, then Better Auth session
6. **Protected Routes**: Routes check `userId` in context set by middleware

### API Key Flow

1. **Create Key**: User (with session) calls `POST /my/api-keys` with key name
2. **Unkey Creates Key**: Server creates key in Unkey service (prefix: `re_`)
3. **Store Metadata**: Server stores key metadata in `api_keys` table
4. **Response**: API returns full key (shown once only): `{ key: "re_xxx...", keyId: "..." }`
5. **Usage**: Client includes `Authorization: Bearer re_xxx...` in requests
6. **Validation**: Middleware verifies with Unkey, looks up user, sets context
7. **Tracking**: Every use updates `lastUsedAt` timestamp in database

---

## Quick Start

### 1. Register a New User

```bash
curl -X POST http://localhost:4111/better-auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "John Doe"
  }'
```

**Response**:
```json
{
  "token": "abc123xyz789...",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2024-10-25T00:00:00.000Z"
  }
}
```

### 2. Login with Existing Account

```bash
curl -X POST http://localhost:4111/better-auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

**Response**:
```json
{
  "token": "abc123xyz789...",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### 3. Get Current Session

```bash
curl -X GET http://localhost:4111/better-auth/session \
  -H "Authorization: Bearer abc123xyz789..."
```

**Response**:
```json
{
  "session": {
    "id": "session_123",
    "userId": "user_123",
    "expiresAt": "2024-11-01T00:00:00.000Z",
    "token": "abc123xyz789..."
  },
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### 4. Access Protected Endpoints

```bash
curl -X GET http://localhost:4111/my/abilities \
  -H "Authorization: Bearer abc123xyz789..."
```

### 5. Sign Out

```bash
curl -X POST http://localhost:4111/better-auth/sign-out \
  -H "Authorization: Bearer abc123xyz789..."
```

---

## Better Auth Endpoints

All Better Auth endpoints are automatically available at `/better-auth/*`. Here are the most commonly used:

### Authentication

| Endpoint | Method | Description | Body |
|----------|--------|-------------|------|
| `/better-auth/sign-up/email` | POST | Register new user | `{ email, password, name }` |
| `/better-auth/sign-in/email` | POST | Login with credentials | `{ email, password }` |
| `/better-auth/sign-out` | POST | Sign out (invalidate token) | - |
| `/better-auth/session` | GET | Get current session | - |

### Password Management

| Endpoint | Method | Description | Body |
|----------|--------|-------------|------|
| `/better-auth/forget-password` | POST | Request password reset | `{ email }` |
| `/better-auth/reset-password` | POST | Reset password with token | `{ token, password }` |

### Email Verification

| Endpoint | Method | Description | Body |
|----------|--------|-------------|------|
| `/better-auth/send-verification-email` | POST | Resend verification email | `{ email }` |
| `/better-auth/verify-email` | POST | Verify email with token | `{ token }` |

**Note**: Email verification is currently **disabled** in development mode. Enable in production by:
1. Setting up Resend API key
2. Setting `requireEmailVerification: true` in `auth.ts`

---

## Frontend Integration

### Option 1: Using Better Auth Official Client (Recommended)

The Better Auth client library provides type-safe, easy-to-use methods for authentication.

#### Installation

```bash
npm install better-auth
# or
pnpm add better-auth
# or
yarn add better-auth
```

#### React Example

```typescript
import { createAuthClient } from "better-auth/client";

// Create the auth client
export const authClient = createAuthClient({
  baseURL: "http://localhost:4111", // Your API URL
  basePath: "/better-auth", // Match server basePath
});

// In your React component
import { authClient } from "./auth";
import { useState } from "react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const { data, error } = await authClient.signIn.email({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      // Token is automatically stored in localStorage by Better Auth client
      // You can also access it from data.token if needed
      console.log("Logged in:", data.user);

      // Redirect to dashboard or update UI
      window.location.href = "/dashboard";
    } catch (err) {
      setError("Login failed. Please try again.");
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button type="submit">Login</button>
    </form>
  );
}
```

#### Register Example

```typescript
async function handleRegister(email: string, password: string, name: string) {
  const { data, error } = await authClient.signUp.email({
    email,
    password,
    name,
  });

  if (error) {
    console.error("Registration failed:", error);
    return;
  }

  console.log("Registered:", data.user);
  // Token is automatically stored
}
```

#### Get Current Session

```typescript
async function getCurrentUser() {
  const { data, error } = await authClient.getSession();

  if (error || !data?.session) {
    console.log("Not authenticated");
    return null;
  }

  return data.user;
}
```

#### Sign Out

```typescript
async function handleSignOut() {
  await authClient.signOut();
  // Token is automatically cleared from localStorage
  window.location.href = "/login";
}
```

#### Protected API Calls with Auth Client

```typescript
// The Better Auth client automatically includes the token in requests
async function fetchUserAbilities() {
  const response = await fetch("http://localhost:4111/my/abilities", {
    headers: {
      Authorization: `Bearer ${authClient.session.token}`,
    },
  });

  return response.json();
}

// Or use a wrapper function
async function authenticatedFetch(url: string, options: RequestInit = {}) {
  const session = await authClient.getSession();

  if (!session.data?.session) {
    throw new Error("Not authenticated");
  }

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${session.data.session.token}`,
    },
  });
}
```

---

### Option 2: Direct HTTP Requests

If you prefer not to use the Better Auth client, you can make direct HTTP requests.

#### JavaScript/TypeScript Example

```typescript
// Register
async function register(email: string, password: string, name: string) {
  const response = await fetch("http://localhost:4111/better-auth/sign-up/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, name }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Registration failed");
  }

  // Store token
  localStorage.setItem("auth_token", data.token);

  return data;
}

// Login
async function login(email: string, password: string) {
  const response = await fetch("http://localhost:4111/better-auth/sign-in/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Login failed");
  }

  // Store token
  localStorage.setItem("auth_token", data.token);

  return data;
}

// Get current session
async function getSession() {
  const token = localStorage.getItem("auth_token");

  if (!token) {
    return null;
  }

  const response = await fetch("http://localhost:4111/better-auth/session", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    // Token invalid or expired
    localStorage.removeItem("auth_token");
    return null;
  }

  return response.json();
}

// Sign out
async function signOut() {
  const token = localStorage.getItem("auth_token");

  if (token) {
    await fetch("http://localhost:4111/better-auth/sign-out", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  localStorage.removeItem("auth_token");
}

// Make authenticated requests
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("auth_token");

  if (!token) {
    throw new Error("Not authenticated");
  }

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}
```

---

## Using the Official Client

### Installation

```bash
pnpm add better-auth
```

### Client Setup

```typescript
// src/lib/auth.ts
import { createAuthClient } from "better-auth/client";

export const auth = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4111",
  basePath: "/better-auth",
});
```

### React Hooks

Better Auth provides React hooks for easy integration:

```typescript
import { useSession } from "better-auth/react";

function MyComponent() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <div>Please log in</div>;
  }

  return <div>Welcome, {session.user.name}!</div>;
}
```

### Type Safety

Better Auth is fully typed. Define your types:

```typescript
// types/auth.ts
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: string;
  token: string;
}
```

---

## API Key Authentication

API keys provide long-lived, programmatic access to the API without requiring user interaction. They're perfect for CLI tools, scripts, and server-to-server communication.

### Overview

- **Powered by Unkey**: Enterprise-grade API key management
- **Prefix**: All keys start with `re_` (reverse engineer)
- **Format**: `Bearer re_xxxxxxxxxxxxx` in Authorization header
- **Management**: Create/list/revoke via `/my/api-keys` endpoints
- **Tracking**: Last used timestamp automatically updated
- **Rate Limiting**: Optional rate limits per key
- **Expiration**: Optional expiration dates
- **Audit Logs**: All operations logged for security

### Prerequisites

To use API key functionality, the server must have:

```bash
# Required environment variables
UNKEY_ROOT_KEY=unkey_xxx...  # Your Unkey root key
UNKEY_API_ID=api_xxx...      # Your Unkey API ID
```

Get these from [Unkey Dashboard](https://app.unkey.com).

### Quick Start

#### 1. Create an API Key

You need a **session token** to create an API key. First, log in:

```bash
# Login and get session token
SESSION_TOKEN=$(curl -s -X POST http://localhost:4111/better-auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"yourpassword"}' \
  | jq -r '.token')

# Create API key using session token
curl -X POST http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My CLI Tool",
    "expiresIn": 2592000000
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "API key created successfully",
  "key": "re_abc123xyz789...",
  "keyId": "key_123",
  "apiKeyId": "api_key_uuid"
}
```

**IMPORTANT**: Save the `key` value immediately - it's only shown once!

#### 2. Use the API Key

```bash
# Store the API key
API_KEY="re_abc123xyz789..."

# Make authenticated requests
curl -X GET http://localhost:4111/my/abilities \
  -H "Authorization: Bearer $API_KEY"
```

### API Key Management

#### Create API Key

Create a new API key with optional expiration and rate limiting.

**Endpoint**: `POST /my/api-keys`

**Headers**:
- `Authorization: Bearer <session_token>` (requires session auth)
- `Content-Type: application/json`

**Body**:
```json
{
  "name": "My Integration",           // Required: friendly name
  "expiresIn": 2592000000,            // Optional: milliseconds (30 days)
  "ratelimit": {                      // Optional: rate limit config
    "name": "default",
    "limit": 1000,
    "duration": 3600000,              // 1 hour in ms
    "autoApply": true
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "API key created successfully",
  "key": "re_xxxxxxxxxxxxx",          // Full key (shown once only!)
  "keyId": "key_123",                 // Unkey's internal ID
  "apiKeyId": "uuid"                  // Your database ID
}
```

**Example**:
```bash
curl -X POST http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production API Key",
    "expiresIn": 7776000000,
    "ratelimit": {
      "name": "production",
      "limit": 10000,
      "duration": 3600000
    }
  }'
```

#### List API Keys

Get all your API keys (non-revoked only).

**Endpoint**: `GET /my/api-keys`

**Headers**:
- `Authorization: Bearer <session_token or api_key>`

**Response**:
```json
{
  "success": true,
  "keys": [
    {
      "apiKeyId": "uuid",
      "userId": "user_123",
      "unkeyKeyId": "key_123",
      "keyPrefix": "re_abc123...",    // Only shows prefix
      "name": "My CLI Tool",
      "lastUsedAt": "2024-10-25T12:34:56.000Z",
      "createdAt": "2024-10-20T08:00:00.000Z",
      "expiresAt": null,
      "revokedAt": null
    }
  ]
}
```

**Example**:
```bash
# List with session token
curl -X GET http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer $SESSION_TOKEN"

# List with API key
curl -X GET http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer $API_KEY"
```

#### Revoke API Key

Permanently revoke an API key.

**Endpoint**: `DELETE /my/api-keys/:apiKeyId`

**Headers**:
- `Authorization: Bearer <session_token or api_key>`

**Response**:
```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

**Example**:
```bash
curl -X DELETE http://localhost:4111/my/api-keys/your-api-key-id \
  -H "Authorization: Bearer $SESSION_TOKEN"
```

### Using API Keys in Your Code

#### JavaScript/TypeScript

```typescript
// Store API key securely (environment variable)
const API_KEY = process.env.REVERSE_ENGINEER_API_KEY;
const API_URL = 'http://localhost:4111';

// Make authenticated request
async function getMyAbilities() {
  const response = await fetch(`${API_URL}/my/abilities`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Use in your application
getMyAbilities()
  .then(data => console.log('Abilities:', data.abilities))
  .catch(err => console.error('Error:', err));
```

#### Python

```python
import os
import requests

API_KEY = os.environ.get('REVERSE_ENGINEER_API_KEY')
API_URL = 'http://localhost:4111'

def get_my_abilities():
    response = requests.get(
        f'{API_URL}/my/abilities',
        headers={
            'Authorization': f'Bearer {API_KEY}'
        }
    )
    response.raise_for_status()
    return response.json()

# Use in your application
abilities = get_my_abilities()
print(f"Found {len(abilities['abilities'])} abilities")
```

#### cURL (Bash Scripts)

```bash
#!/bin/bash

# Load API key from environment
API_KEY="${REVERSE_ENGINEER_API_KEY}"
API_URL="http://localhost:4111"

# Function to make authenticated requests
api_get() {
  curl -s -X GET "${API_URL}${1}" \
    -H "Authorization: Bearer ${API_KEY}"
}

# Use the function
api_get "/my/abilities" | jq '.abilities[] | .abilityName'
```

### API Key Features

#### Rate Limiting

API keys can have custom rate limits:

```json
{
  "ratelimit": {
    "name": "production",      // Identifier for this rate limit
    "limit": 10000,            // Max requests
    "duration": 3600000,       // Time window (1 hour)
    "autoApply": true          // Apply automatically
  }
}
```

Rate limit information is passed to route handlers via context:
- `c.get('apiKeyRemaining')` - Remaining requests
- `c.get('apiKeyRatelimit')` - Rate limit details

#### Expiration

Set optional expiration when creating keys:

```bash
# Expires in 30 days
{
  "name": "Temporary Key",
  "expiresIn": 2592000000  // 30 days in milliseconds
}
```

#### Usage Tracking

Every API key request updates the `lastUsedAt` timestamp:

```sql
-- Check last usage
SELECT name, last_used_at
FROM api_keys
WHERE user_id = 'your_user_id'
ORDER BY last_used_at DESC;
```

#### Audit Logs

All API key operations are logged:

```sql
-- View audit logs
SELECT action, resource_type, metadata, created_at
FROM audit_logs
WHERE user_id = 'your_user_id'
  AND resource_type = 'api_key'
ORDER BY created_at DESC;
```

Logged actions:
- `create_api_key` - Key created
- `revoke_api_key` - Key revoked
- `update_api_key` - Key metadata updated

### Complete Workflow Example

Here's a complete example of the API key lifecycle:

```bash
#!/bin/bash
set -e

# 1. Register a new user
echo "Registering user..."
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:4111/better-auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev@example.com",
    "password": "SecurePass123!",
    "name": "Developer"
  }')

SESSION_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.token')
echo "Session token: ${SESSION_TOKEN:0:20}..."

# 2. Create an API key
echo -e "\nCreating API key..."
API_KEY_RESPONSE=$(curl -s -X POST http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CLI Tool",
    "expiresIn": 2592000000
  }')

API_KEY=$(echo $API_KEY_RESPONSE | jq -r '.key')
API_KEY_ID=$(echo $API_KEY_RESPONSE | jq -r '.apiKeyId')
echo "API key created: ${API_KEY:0:20}..."

# 3. Use the API key to access protected endpoints
echo -e "\nFetching abilities with API key..."
ABILITIES=$(curl -s -X GET http://localhost:4111/my/abilities \
  -H "Authorization: Bearer $API_KEY")

echo "Abilities: $(echo $ABILITIES | jq '.abilities | length') found"

# 4. List API keys
echo -e "\nListing all API keys..."
curl -s -X GET http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer $API_KEY" \
  | jq '.keys[] | {name, keyPrefix, lastUsedAt}'

# 5. Revoke the API key
echo -e "\nRevoking API key..."
curl -s -X DELETE "http://localhost:4111/my/api-keys/$API_KEY_ID" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  | jq '.'

# 6. Verify key is revoked
echo -e "\nTrying to use revoked key (should fail)..."
curl -s -X GET http://localhost:4111/my/abilities \
  -H "Authorization: Bearer $API_KEY" \
  | jq '.'

echo -e "\nWorkflow complete!"
```

### Security Best Practices for API Keys

#### 1. Storage

**DO**:
- ✅ Store keys in environment variables
- ✅ Use secret management tools (AWS Secrets Manager, HashiCorp Vault)
- ✅ Use `.env` files (add to `.gitignore`)
- ✅ Encrypt keys at rest if storing in database

**DON'T**:
- ❌ Hard-code keys in source code
- ❌ Commit keys to version control
- ❌ Log keys in application logs
- ❌ Expose keys in error messages
- ❌ Send keys via email or chat

#### 2. Rotation

- 🔄 Rotate keys periodically (every 90 days recommended)
- 🔄 Create new key before revoking old one (zero-downtime rotation)
- 🔄 Revoke keys immediately if compromised
- 🔄 Use expiration dates for temporary access

#### 3. Scope & Access

- 🔐 Create separate keys for each integration
- 🔐 Use descriptive names (`Production API`, `Staging CLI`, etc.)
- 🔐 Set rate limits appropriate to use case
- 🔐 Monitor `lastUsedAt` to identify unused keys
- 🔐 Revoke keys that haven't been used in 90+ days

#### 4. Monitoring

- 📊 Check audit logs regularly
- 📊 Monitor rate limit usage
- 📊 Alert on suspicious patterns (unusual times, IPs, etc.)
- 📊 Track which keys are used most frequently

#### 5. Environment Variables

```bash
# .env file (add to .gitignore)
REVERSE_ENGINEER_API_KEY=re_xxxxxxxxxxxxx
REVERSE_ENGINEER_API_URL=http://localhost:4111
```

```javascript
// Load from environment
require('dotenv').config();

const apiKey = process.env.REVERSE_ENGINEER_API_KEY;
if (!apiKey) {
  throw new Error('REVERSE_ENGINEER_API_KEY not set');
}
```

### Troubleshooting API Keys

#### Issue: "API key authentication is not configured on this server"

**Cause**: `UNKEY_ROOT_KEY` or `UNKEY_API_ID` environment variables not set

**Solution**:
```bash
# Add to .env
UNKEY_ROOT_KEY=your_unkey_root_key
UNKEY_API_ID=your_unkey_api_id

# Restart server
pnpm dev
```

#### Issue: "Invalid or expired API key"

**Causes**:
1. Key was revoked
2. Key expired
3. Key doesn't exist in Unkey
4. Wrong key format

**Solution**:
```bash
# Check if key is revoked
curl -X GET http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  | jq '.keys[] | select(.apiKeyId == "your_key_id")'

# Create a new key if needed
curl -X POST http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Key"}'
```

#### Issue: "API key not found or has been revoked"

**Cause**: Key verified by Unkey but not in local database

**Solution**: This shouldn't happen normally. If it does:
1. Check database for orphaned records
2. Revoke the key in Unkey dashboard
3. Create a new key via API

#### Issue: Rate limit exceeded

**Cause**: Too many requests within the rate limit window

**Solution**:
```bash
# Check rate limit info (if exposed)
# Wait for the duration to reset
# Or create a new key with higher rate limit

curl -X POST http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Rate Limit Key",
    "ratelimit": {
      "limit": 100000,
      "duration": 3600000
    }
  }'
```

#### Issue: "Insufficient Permissions" when creating keys

**Cause**: Unkey root key lacks `api.*.create_key` permission

**Solution**: Create a new root key in Unkey dashboard with proper permissions:
1. Go to https://app.unkey.com
2. Settings → Root Keys
3. Create key with `api.*.create_key` permission
4. Update `UNKEY_ROOT_KEY` environment variable

---

## Testing Authentication

### Using cURL

#### Testing Session Authentication

```bash
# Register
TOKEN=$(curl -s -X POST http://localhost:4111/better-auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}' \
  | jq -r '.token')

# Use token for authenticated request
curl -X GET http://localhost:4111/my/abilities \
  -H "Authorization: Bearer $TOKEN"
```

#### Testing API Key Authentication

```bash
# 1. Get session token
SESSION_TOKEN=$(curl -s -X POST http://localhost:4111/better-auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}' \
  | jq -r '.token')

# 2. Create API key
API_KEY=$(curl -s -X POST http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Key"}' \
  | jq -r '.key')

# 3. Use API key for authenticated request
curl -X GET http://localhost:4111/my/abilities \
  -H "Authorization: Bearer $API_KEY"
```

### Using the Test Suite

The project includes comprehensive integration tests:

```bash
# Run session auth tests
pnpm test tests/integration/auth.test.ts

# Run API key auth tests
pnpm test tests/integration/api-key-auth.test.ts

# Run all integration tests
pnpm test
```

---

## Security Best Practices

### 1. Token Storage

**Browser Applications**:
- ✅ Use `localStorage` for SPAs (if XSS protection is in place)
- ✅ Use `httpOnly` cookies for server-rendered apps (Better Auth supports both)
- ❌ Never expose tokens in URL parameters
- ❌ Never log tokens to console in production

**Mobile Applications**:
- ✅ Use secure storage (Keychain on iOS, Keystore on Android)
- ✅ Use Better Auth React Native client if available

### 2. Token Transmission

- ✅ Always use HTTPS in production
- ✅ Include token in `Authorization: Bearer <token>` header
- ❌ Never send tokens in URL query parameters

### 3. Token Lifetime

- Current: 7 days (configurable in `auth.ts`)
- Tokens are automatically refreshed by Better Auth
- Implement token refresh logic if needed

### 4. Password Requirements

Better Auth enforces:
- Minimum 8 characters
- Maximum 128 characters
- Additional requirements can be added via validation

### 5. Environment Variables

**Required** (Session Auth):
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
BETTER_AUTH_URL=http://localhost:4111
```

**Required** (API Key Auth):
```bash
UNKEY_ROOT_KEY=unkey_xxx...  # Your Unkey root key (needs api.*.create_key permission)
UNKEY_API_ID=api_xxx...      # Your Unkey API ID
```

**Optional**:
```bash
# For email verification (production)
RESEND_API_KEY=re_xxx
```

### 6. Rate Limiting

Better Auth includes built-in rate limiting:
- 100 requests per minute per IP
- Configurable in `auth.ts`

---

## Troubleshooting

### Issue: "401 Unauthorized" on authenticated requests

**Causes**:
1. Token expired (7 days)
2. Token invalid or malformed
3. User was deleted
4. Token not included in header

**Solution**:
```bash
# Check if token is valid
curl -X GET http://localhost:4111/better-auth/session \
  -H "Authorization: Bearer YOUR_TOKEN"

# If invalid, re-login
curl -X POST http://localhost:4111/better-auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

### Issue: "404 Not Found" for /better-auth endpoints

**Cause**: Better Auth routes not mounted correctly

**Solution**: Verify in `routes.ts` that Better Auth routes are exported:
```typescript
export const apiRoutes = [
  betterAuthGetRoute,
  betterAuthPostRoute,
  // ... other routes
];
```

### Issue: CORS errors in browser

**Cause**: CORS not configured for your frontend domain

**Solution**: Update CORS in `src/mastra/index.ts`:
```typescript
cors: {
  origin: ["http://localhost:3000", "https://yourdomain.com"],
  credentials: true,
}
```

### Issue: Duplicate email registration

**Error**: `{ "error": "Email already exists" }`

**Solution**: This is expected behavior. Use sign-in instead:
```bash
curl -X POST http://localhost:4111/better-auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"existing@example.com","password":"password"}'
```

### Issue: Password too weak

**Error**: `{ "error": "Password must be at least 8 characters" }`

**Solution**: Ensure password meets requirements:
- Minimum 8 characters
- Maximum 128 characters

### Debug Mode

Enable Better Auth debug logging:

```typescript
// In auth.ts
logger: {
  disabled: false,
  level: 'debug',
}
```

---

## Migration from v3.x

If you're migrating from the old custom `/auth/*` endpoints:

### Old Endpoints (v3.x)
```
POST /auth/register
POST /auth/login
GET  /auth/me
```

### New Endpoints (v4.x)
```
POST /better-auth/sign-up/email
POST /better-auth/sign-in/email
GET  /better-auth/session
```

### Response Format Changes

**Old** (v3.x):
```json
{
  "success": true,
  "token": "...",
  "user": { ... }
}
```

**New** (v4.x):
```json
{
  "token": "...",
  "user": { ... }
}
```

### Client Code Updates

```typescript
// OLD
const response = await fetch('/auth/login', ...);

// NEW
const response = await fetch('/better-auth/sign-in/email', ...);

// OR use Better Auth client
import { authClient } from 'better-auth/client';
const { data } = await authClient.signIn.email({ email, password });
```

---

## Additional Resources

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Better Auth GitHub](https://github.com/better-auth/better-auth)
- [API Reference](./API_COMPLETE_GUIDE.md)
- [Test Suite Guide](./TEST_SUITE_GUIDE.md)

---

**Last Updated**: October 25, 2025
**Version**: 4.1.0 - Added comprehensive API Key authentication documentation
