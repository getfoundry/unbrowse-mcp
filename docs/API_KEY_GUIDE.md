# API Key Authentication Guide

Quick guide to using API keys for authenticating requests to the Reverse Engineer API.

## Overview

The API supports **two authentication methods**:
1. **Session Tokens** - For web/mobile apps (from Better Auth login)
2. **API Keys** - For scripts, CLI tools, and server-to-server communication

Both use the same `Authorization: Bearer <token>` header format.

---

## Quick Start

### Step 1: Register and Get a Session Token

First, create an account to get a session token:

```bash
curl -X POST http://localhost:4111/better-auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "YourSecurePassword123!",
    "name": "Your Name"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": "550e8400-...",
    "email": "your-email@example.com",
    "name": "Your Name"
  }
}
```

Save the `token` - you'll need it to create an API key.

### Step 2: Create an API Key

Use your session token to create an API key:

```bash
curl -X POST http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My CLI Tool",
    "expiresIn": 86400000
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "API key created successfully. Store the key securely - it won't be shown again.",
  "key": "re_REDACTED_KEY_2",
  "keyId": "key_51GRpLRuoWJ2vAPs",
  "apiKeyId": "e829a989-d65c-4d8b-aadd-9949bf9517a3"
}
```

**IMPORTANT:** Save the `key` value immediately! It won't be shown again.

---

## Using Your API Key

### Basic Request

Use your API key in the `Authorization` header:

```bash
curl -X GET http://localhost:4111/auth/me \
  -H "Authorization: Bearer re_REDACTED_KEY_2"
```

### With Python

```python
import requests

API_KEY = "re_REDACTED_KEY_2"
BASE_URL = "http://localhost:4111"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Get user info
response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
print(response.json())

# Upload HAR file
with open("recording.har", "rb") as f:
    files = {"file": f}
    response = requests.post(
        f"{BASE_URL}/ingest",
        headers={"Authorization": f"Bearer {API_KEY}"},
        files=files
    )
    print(response.json())
```

### With JavaScript/TypeScript

```typescript
const API_KEY = "re_REDACTED_KEY_2";
const BASE_URL = "http://localhost:4111";

// Get user info
const response = await fetch(`${BASE_URL}/auth/me`, {
  headers: {
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json"
  }
});

const data = await response.json();
console.log(data);

// Upload HAR file
const formData = new FormData();
formData.append("file", harFileBlob, "recording.har");

const uploadResponse = await fetch(`${BASE_URL}/ingest`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${API_KEY}`
  },
  body: formData
});

const result = await uploadResponse.json();
console.log(result);
```

---

## Managing API Keys

### List Your API Keys

```bash
curl -X GET http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer YOUR_API_KEY_OR_SESSION_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "keys": [
    {
      "apiKeyId": "e829a989-d65c-4d8b-aadd-9949bf9517a3",
      "name": "My CLI Tool",
      "prefix": "re_CPmkxQm",
      "createdAt": "2025-10-25T09:00:00.000Z",
      "lastUsedAt": "2025-10-25T09:30:00.000Z",
      "expiresAt": "2025-10-26T09:00:00.000Z"
    }
  ]
}
```

### Revoke an API Key

```bash
curl -X DELETE http://localhost:4111/my/api-keys/key_51GRpLRuoWJ2vAPs \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

---

## API Key Options

When creating an API key, you can specify:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Human-readable name for the key |
| `expiresIn` | number | No | Milliseconds until expiration (default: never expires) |

**Common expiration values:**
- 1 hour: `3600000`
- 1 day: `86400000`
- 7 days: `604800000`
- 30 days: `2592000000`
- 1 year: `31536000000`

**Example:**
```json
{
  "name": "Production Server",
  "expiresIn": 2592000000
}
```

---

## Security Best Practices

### ✅ DO

- **Store API keys securely** in environment variables or secret management systems
- **Use different API keys** for different applications/environments
- **Set expiration dates** for keys that don't need permanent access
- **Rotate keys regularly** for long-lived integrations
- **Revoke unused keys** immediately
- **Use HTTPS** in production (all examples use localhost for development)

### ❌ DON'T

- **Don't commit API keys** to version control (use `.env` files and `.gitignore`)
- **Don't share API keys** between applications
- **Don't log API keys** in your application code
- **Don't use API keys in client-side code** (use session tokens instead)

### Example `.env` File

```bash
# .env
REVERSE_ENGINEER_API_KEY=re_REDACTED_KEY_2
REVERSE_ENGINEER_API_URL=http://localhost:4111
```

Then load it in your code:

```python
# Python
import os
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("REVERSE_ENGINEER_API_KEY")
```

```typescript
// TypeScript/Node.js
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.REVERSE_ENGINEER_API_KEY;
```

---

## Troubleshooting

### Error: "Invalid or expired API key"

**Cause:** The API key is invalid, revoked, or expired.

**Solution:**
1. Check that you're using the full key (starts with `re_`)
2. Verify the key hasn't been revoked
3. Check if the key has expired
4. Create a new API key if needed

### Error: "Authentication required"

**Cause:** Missing or malformed `Authorization` header.

**Solution:**
- Make sure you include `Authorization: Bearer <key>` header
- Check for typos in "Bearer" (capital B)
- Ensure there's a space between "Bearer" and the key

### Error: "API key authentication is not configured on this server"

**Cause:** The server is missing Unkey configuration.

**Solution:**
This is a server configuration issue. The administrator needs to set:
- `UNKEY_ROOT_KEY` environment variable
- `UNKEY_API_ID` environment variable

Contact your API administrator.

### API Key Not Working After Creation

**Cause:** Keys are verified through Unkey service, which may have sync delays.

**Solution:**
- Wait a few seconds and try again
- Check server logs for Unkey errors
- Verify the key was created successfully (check `/my/api-keys`)

---

## Endpoints That Support API Keys

API keys work on **all authenticated endpoints**, including:

- `GET /auth/me` - Get current user info
- `GET /my/abilities` - List your abilities
- `POST /my/abilities` - Create an ability
- `GET /my/credentials` - List your credentials
- `POST /my/credentials` - Create a credential
- `POST /ingest` - Upload HAR files
- `GET /my/api-keys` - List your API keys
- `POST /my/api-keys` - Create new API keys
- `DELETE /my/api-keys/:keyId` - Revoke an API key

---

## API Keys vs Session Tokens

| Feature | Session Tokens | API Keys |
|---------|---------------|----------|
| **Best For** | Web/mobile apps with UI | Scripts, CLI, automation |
| **Lifetime** | 7 days (auto-refresh) | Custom (default: no expiration) |
| **How to Get** | Login via `/better-auth/sign-in/email` | Create via `/my/api-keys` |
| **Revocation** | Sign out via `/better-auth/sign-out` | Delete via `/my/api-keys/:id` |
| **Prefix** | No prefix (JWT format) | `re_` prefix |
| **Header Format** | `Authorization: Bearer <jwt>` | `Authorization: Bearer re_<key>` |

**When to use Session Tokens:**
- Building a web or mobile application
- User will interact through a UI
- Need automatic token refresh

**When to use API Keys:**
- Building CLI tools or SDKs
- Server-to-server communication
- Background jobs or automation
- Long-lived access without user interaction

---

## Complete Example: Python CLI Tool

```python
#!/usr/bin/env python3
"""
Example CLI tool using API key authentication
"""

import os
import requests
from dotenv import load_dotenv

# Load API key from .env file
load_dotenv()
API_KEY = os.getenv("REVERSE_ENGINEER_API_KEY")
BASE_URL = os.getenv("REVERSE_ENGINEER_API_URL", "http://localhost:4111")

class ReverseEngineerClient:
    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

    def get_user_info(self):
        """Get current user information"""
        response = requests.get(
            f"{self.base_url}/auth/me",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def list_abilities(self):
        """List all abilities"""
        response = requests.get(
            f"{self.base_url}/my/abilities",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def upload_har(self, har_file_path: str):
        """Upload a HAR file"""
        with open(har_file_path, "rb") as f:
            files = {"file": (os.path.basename(har_file_path), f)}
            response = requests.post(
                f"{self.base_url}/ingest",
                headers={"Authorization": f"Bearer {self.api_key}"},
                files=files
            )
        response.raise_for_status()
        return response.json()

# Usage
if __name__ == "__main__":
    client = ReverseEngineerClient(API_KEY, BASE_URL)

    # Get user info
    user = client.get_user_info()
    print(f"Logged in as: {user['user']['email']}")

    # List abilities
    abilities = client.list_abilities()
    print(f"Found {len(abilities['abilities'])} abilities")

    # Upload HAR file
    # result = client.upload_har("path/to/recording.har")
    # print(f"Upload complete: {result}")
```

---

## Next Steps

- Read the full [Authentication Guide](./AUTHENTICATION.md) for session token details
- Check the [API Reference](./API_REFERENCE.md) for all available endpoints
- Review [Security Best Practices](./SECURITY.md) for production deployments

---

**Questions?** Check the [Troubleshooting](#troubleshooting) section or file an issue on GitHub.
