# Authentication Guide

Complete guide to Better Auth authentication in the Reverse Engineer API.

**Version**: 4.0.0
**Authentication Method**: Better Auth with Bearer Token Support
**Backend**: Better Auth 1.3.29 with Bearer Plugin
**Framework**: Mastra 0.21.1

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Better Auth Endpoints](#better-auth-endpoints)
5. [Frontend Integration](#frontend-integration)
6. [Using the Official Client](#using-the-official-client)
7. [Testing Authentication](#testing-authentication)
8. [Security Best Practices](#security-best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Reverse Engineer API uses **Better Auth** for authentication, providing a robust, production-ready auth system with minimal setup.

### Key Features

- ✅ **Better Auth native endpoints** - No custom wrappers, just Better Auth
- ✅ **Bearer token authentication** - Industry-standard RFC 6750
- ✅ **Session tokens** - Secure, cryptographically-signed tokens
- ✅ **Dual authentication** - Both Bearer tokens AND cookies supported
- ✅ **Email/password authentication** - Simple username/password flow
- ✅ **7-day token expiration** - Configurable token lifetime
- ✅ **PostgreSQL storage** - User data and sessions in database
- ✅ **Multi-tenant isolation** - Users only see their own data
- ✅ **Official client library** - Use `better-auth/client` for frontend

### What Changed in v4.0.0

**Removed**:
- ❌ Custom auth wrapper routes at `/auth/*`
- ❌ Custom response formats

**Added**:
- ✅ Better Auth native endpoints at `/better-auth/*`
- ✅ Standard Better Auth response formats
- ✅ Full compatibility with Better Auth client library

---

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Application                       │
│  (Browser, Mobile App, CLI, Postman, etc.)                      │
│                                                                  │
│  Option 1: Use Better Auth Client                               │
│  import { createAuthClient } from "better-auth/client"          │
│                                                                  │
│  Option 2: Direct HTTP Requests                                 │
│  Authorization: Bearer <session_token>                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ HTTP Request
                     │ POST /better-auth/sign-up/email
                     │ POST /better-auth/sign-in/email
                     │ GET  /better-auth/session
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Mastra Server (Port 4111)                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         Better Auth Handler (routes.ts)                     │ │
│  │  • GET    /better-auth/*  → betterAuthGetRoute             │ │
│  │  • POST   /better-auth/*  → betterAuthPostRoute            │ │
│  │  • PUT    /better-auth/*  → betterAuthPutRoute             │ │
│  │  • DELETE /better-auth/*  → betterAuthDeleteRoute          │ │
│  │  • PATCH  /better-auth/*  → betterAuthPatchRoute           │ │
│  └────────────────┬───────────────────────────────────────────┘ │
│                   │                                              │
│                   ▼                                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │     Better Auth Instance (auth.ts)                          │ │
│  │                                                              │ │
│  │  Configuration:                                              │ │
│  │  • basePath: '/better-auth'                                 │ │
│  │  • bearer() plugin enabled                                  │ │
│  │  • emailAndPassword enabled                                 │ │
│  │  • PostgreSQL via Drizzle adapter                           │ │
│  └────────────────┬───────────────────────────────────────────┘ │
│                   │                                              │
└───────────────────┼──────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                           │
│  Tables:                                                         │
│  • user         → User accounts (id, email, name, password)     │
│  • session      → Active sessions (token, userId, expiresAt)    │
│  • account      → Linked accounts (for OAuth)                   │
│  • verification → Email verification tokens                     │
└─────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

1. **Registration**: User registers with email/password at `/better-auth/sign-up/email`
2. **Response**: Better Auth returns `{ user, token }` where token is the session token
3. **Storage**: Client stores token (localStorage, secure storage, etc.)
4. **Requests**: Client includes `Authorization: Bearer <token>` header
5. **Validation**: Better Auth validates token on every request via `auth.api.getSession()`
6. **Protected Routes**: Routes check session and extract `userId` from authenticated user

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

## Testing Authentication

### Using cURL

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

### Using the Test Suite

The project includes comprehensive integration tests:

```bash
# Run auth tests
pnpm test tests/integration/auth.test.ts

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

**Required**:
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
BETTER_AUTH_URL=http://localhost:4111
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

**Last Updated**: October 25, 2024
**Version**: 4.0.0
