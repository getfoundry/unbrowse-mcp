# Credentials Storage System Documentation

## Overview

The Reverse Engineer API includes a secure **client-encrypted credentials storage system** that acts as a password manager for storing cookies, headers, and authentication tokens required by reverse-engineered API abilities. This system allows users to store encrypted credentials that are automatically injected when executing abilities that require authentication.

## Table of Contents

- [Architecture](#architecture)
- [Security Model](#security-model)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Client-Side Encryption](#client-side-encryption)
- [Server-Side Decryption](#server-side-decryption)
- [Credential-Based Access Control](#credential-based-access-control)
- [Usage Examples](#usage-examples)
- [Integration with Abilities](#integration-with-abilities)

---

## Architecture

### Components

```
┌─────────────────┐     Encrypted      ┌─────────────────┐
│ Browser         │     Credentials    │ Server          │
│ Extension       │ ─────────────────> │ API             │
│                 │                    │                 │
│ - Encrypts      │                    │ - Stores        │
│ - Manages Keys  │                    │ - Filters       │
│ - Streams Data  │                    │ - Decrypts      │
└─────────────────┘                    └─────────────────┘
        │                                      │
        │                                      │
        v                                      v
┌─────────────────┐                    ┌─────────────────┐
│ User's          │                    │ PostgreSQL      │
│ Encryption Key  │                    │ Database        │
│ (Local Only)    │                    │ (Encrypted)     │
└─────────────────┘                    └─────────────────┘
```

### Flow

1. **Client-Side**: Browser extension encrypts credentials using AES-256-GCM
2. **Transport**: Encrypted credentials sent via HTTPS to server
3. **Storage**: Server stores encrypted values as-is (zero-knowledge)
4. **Retrieval**: Server returns encrypted credentials to authorized users
5. **Decryption**: Client or server decrypts using user's key when needed

---

## Security Model

### Zero-Knowledge Architecture

The server **never sees plaintext credentials** without explicit decryption:

- ✅ Credentials encrypted client-side before transmission
- ✅ Server stores encrypted values unchanged
- ✅ Encryption keys never leave the client
- ✅ Decryption only happens when executing abilities
- ✅ Authentication required for all credential operations

### Encryption Method

**Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Size**: 256 bits (derived from user's encryption key)
- **Key Derivation**: SHA-256 hash of user's encryption string
- **Authentication**: Built-in authentication tag (16 bytes)
- **IV**: Unique initialization vector per credential

### Access Control

- User-scoped storage (credentials tied to user ID)
- Session-based OR API key authentication required
- Cascade deletion when user account deleted
- Audit logging for credential access (ready to implement)

---

## Database Schema

### `user_credentials` Table

```sql
CREATE TABLE "user_credentials" (
  "credential_id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "domain" text NOT NULL,
  "credential_type" text NOT NULL,
  "credential_key" text NOT NULL,
  "encrypted_value" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `credential_id` | text | Unique identifier (UUID) |
| `user_id` | text | Foreign key to user table (cascade delete) |
| `domain` | text | Domain this credential applies to (e.g., "api.github.com") |
| `credential_type` | text | Type: "cookie", "header", "auth_token" |
| `credential_key` | text | Name of cookie/header (e.g., "Authorization", "session_id") |
| `encrypted_value` | text | Encrypted credential JSON: `{"ciphertext": "...", "iv": "..."}` |
| `metadata` | jsonb | Additional metadata (optional) |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last update timestamp |

### Indexes

```sql
-- User lookup
CREATE INDEX "idx_user_credentials_user_id" ON "user_credentials" ("user_id");

-- Domain filtering
CREATE INDEX "idx_user_credentials_domain" ON "user_credentials" ("domain");

-- Unique constraint (one credential per user+domain+type+key)
CREATE INDEX "idx_user_credentials_unique" ON "user_credentials"
  ("user_id", "domain", "credential_type", "credential_key");
```

### Constraints

- **Foreign Key**: `user_id` → `user.id` (CASCADE DELETE)
- **Unique**: (`user_id`, `domain`, `credential_type`, `credential_key`)

---

## API Endpoints

All endpoints require authentication (session cookie OR API key).

### 1. Stream/Upsert Credentials

**Endpoint**: `POST /my/credentials/stream`

Upload encrypted credentials for a domain. Automatically updates existing credentials or creates new ones.

**Request Body**:
```json
{
  "domain": "api.github.com",
  "credentials": [
    {
      "type": "header",
      "key": "Authorization",
      "encryptedValue": "{\"ciphertext\":\"...\",\"iv\":\"...\"}",
      "metadata": {
        "description": "GitHub API token"
      }
    },
    {
      "type": "cookie",
      "key": "session_id",
      "encryptedValue": "{\"ciphertext\":\"...\",\"iv\":\"...\"}"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "count": 2,
  "credentials": [
    {
      "credentialId": "cred_abc123",
      "userId": "user_xyz",
      "domain": "api.github.com",
      "credentialType": "header",
      "credentialKey": "Authorization",
      "encryptedValue": "{\"ciphertext\":\"...\",\"iv\":\"...\"}",
      "metadata": {},
      "createdAt": "2025-10-24T01:30:00.000Z",
      "updatedAt": "2025-10-24T01:30:00.000Z"
    }
  ]
}
```

### 2. List All Credentials

**Endpoint**: `GET /my/credentials?grouped=true`

List all credentials for the authenticated user.

**Query Parameters**:
- `grouped` (boolean, optional): Return credentials grouped by domain

**Response (Flat)**:
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
      ...
    }
  ]
}
```

**Response (Grouped)**:
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
        ...
      }
    ],
    "api.stripe.com": [
      {
        "credentialId": "cred_def456",
        "credentialType": "header",
        "credentialKey": "Authorization",
        ...
      }
    ]
  }
}
```

### 3. Get Credentials for Domain

**Endpoint**: `GET /my/credentials/:domain`

Get all credentials for a specific domain.

**Example**: `GET /my/credentials/api.github.com`

**Response**:
```json
{
  "success": true,
  "domain": "api.github.com",
  "count": 2,
  "credentials": [
    {
      "credentialId": "cred_abc123",
      "credentialType": "header",
      "credentialKey": "Authorization",
      "encryptedValue": "{\"ciphertext\":\"...\",\"iv\":\"...\"}",
      ...
    }
  ]
}
```

### 4. Delete Credentials for Domain

**Endpoint**: `DELETE /my/credentials/:domain`

Delete all credentials for a specific domain.

**Example**: `DELETE /my/credentials/api.github.com`

**Response**:
```json
{
  "success": true,
  "domain": "api.github.com",
  "deletedCount": 2
}
```

### 5. Delete Specific Credential

**Endpoint**: `DELETE /my/credentials/by-id/:credentialId`

Delete a specific credential by ID.

**Example**: `DELETE /my/credentials/by-id/cred_abc123`

**Response**:
```json
{
  "success": true,
  "credentialId": "cred_abc123"
}
```

---

## Client-Side Encryption

### Browser Extension Implementation

```javascript
// Example: Encrypt credentials before sending to server
import { encrypt } from './crypto';

// User's encryption key (stored locally, never sent to server)
const encryptionKey = 'user-chosen-passphrase';

// Credentials to encrypt
const credentials = [
  {
    type: 'header',
    key: 'Authorization',
    value: 'Bearer ghp_xxxxxxxxxxxx'  // Plaintext credential
  }
];

// Encrypt each credential
const encryptedCredentials = credentials.map(cred => ({
  type: cred.type,
  key: cred.key,
  encryptedValue: JSON.stringify(encrypt(cred.value, encryptionKey))
}));

// Send to server
await fetch('/my/credentials/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    domain: 'api.github.com',
    credentials: encryptedCredentials
  })
});
```

### Encryption Function

```javascript
/**
 * Encrypt data using AES-256-GCM
 * Returns { ciphertext: string, iv: string }
 */
function encrypt(plaintext, encryptionKey) {
  const crypto = window.crypto || window.msCrypto;

  // Derive key from encryption string using SHA-256
  const keyBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(encryptionKey)
  );

  const key = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  // Return base64-encoded ciphertext and IV
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv))
  };
}
```

---

## Server-Side Decryption

### Crypto Utilities

Located in [`src/utils/crypto.ts`](src/utils/crypto.ts).

### Decryption Function

```typescript
import { decryptData } from './utils/crypto';

// Encrypted credential from database
const encryptedValue = '{"ciphertext":"...", "iv":"..."}';

// User's encryption key (obtained from user input or stored securely)
const encryptionKey = 'user-chosen-passphrase';

// Decrypt
const plaintext = decryptData(encryptedValue, encryptionKey);
console.log(plaintext); // "Bearer ghp_xxxxxxxxxxxx"
```

### Decrypting All Credentials

```typescript
import { decryptCredentials } from './utils/crypto';

// Credentials object from database
const credentials = {
  'Authorization': '{"ciphertext":"...", "iv":"..."}',
  'X-API-Key': '{"ciphertext":"...", "iv":"..."}'
};

// Decrypt all
const decrypted = decryptCredentials(credentials, encryptionKey);
console.log(decrypted);
// {
//   'Authorization': 'Bearer ghp_xxxxxxxxxxxx',
//   'X-API-Key': 'sk_live_xxxxxxxxxxxx'
// }
```

---

## Credential-Based Access Control

### Filtering Logic

When listing or searching abilities, the system filters based on credential availability:

**Abilities are shown if**:
1. ✅ **Favorited** - User explicitly marked them (always accessible)
2. ✅ **No credentials required** - `dynamicHeadersRequired: false`
3. ✅ **Has credentials** - User has stored credentials for the ability's domain

**Hidden otherwise**:
- ❌ Ability requires credentials (`dynamicHeadersRequired: true`)
- ❌ User hasn't favorited it
- ❌ User hasn't stored credentials for its domain

### Benefits

- **User Experience**: Only see abilities you can actually execute
- **Credential Discovery**: Encourages storing credentials for authenticated APIs
- **Favorites System**: Incentivizes marking important abilities
- **Clean Separation**: Public vs. private API abilities

### Implementation

Located in [`src/server/ability-repository-user.ts`](src/server/ability-repository-user.ts).

**Methods with filtering**:
- `getUserAbilities(userId, options)` - List user's abilities
- `searchUserAbilities(userId, query)` - Search user's abilities

**Example Flow**:
```typescript
// 1. Fetch all abilities for user
const allAbilities = await db.query(...);

// 2. Extract domains needing credential check
const domainsToCheck = allAbilities
  .filter(a => a.dynamicHeadersRequired && !a.isFavorite)
  .map(a => a.domain);

// 3. Batch check credentials
const credentialMap = await hasCredentialsForDomains(userId, domainsToCheck);

// 4. Filter abilities
return allAbilities.filter(ability => {
  if (ability.isFavorite) return true;
  if (!ability.dynamicHeadersRequired) return true;
  return credentialMap.get(ability.domain) === true;
});
```

---

## Usage Examples

### Example 1: Store GitHub API Credentials

```bash
# Client encrypts credentials
curl -X POST http://localhost:4111/my/credentials/stream \
  -H "Authorization: Bearer re_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "api.github.com",
    "credentials": [
      {
        "type": "header",
        "key": "Authorization",
        "encryptedValue": "{\"ciphertext\":\"base64...\",\"iv\":\"base64...\"}"
      }
    ]
  }'
```

### Example 2: List All Credentials Grouped by Domain

```bash
curl -X GET "http://localhost:4111/my/credentials?grouped=true" \
  -H "Authorization: Bearer re_your_api_key"
```

### Example 3: Delete Expired Credentials

```bash
curl -X DELETE http://localhost:4111/my/credentials/old-api.example.com \
  -H "Authorization: Bearer re_your_api_key"
```

### Example 4: Search Abilities (with credential filtering)

```bash
# Only returns abilities that:
# - Don't require credentials, OR
# - Are favorited, OR
# - Have stored credentials for their domain
curl -X GET http://localhost:4111/my/abilities \
  -H "Authorization: Bearer re_your_api_key"
```

---

## Integration with Abilities

### Ability Format

Abilities that require credentials are marked with:

```json
{
  "ability_id": "get-github-user",
  "service_name": "github",
  "domain": "api.github.com",
  "requires_dynamic_headers": true,
  "dynamic_header_keys": ["authorization"],
  ...
}
```

See [ABILITY_FORMAT.md](./ABILITY_FORMAT.md) for complete ability structure.

### Execution Flow

1. **Search/List**: User searches for abilities
   - System checks if user has credentials for `api.github.com`
   - If yes, ability appears in results
   - If no (and not favorited), ability is hidden

2. **Favorite**: User favorites the ability
   - Ability now always appears in searches
   - Can be executed without stored credentials (user provides manually)

3. **Execute**: User executes the ability
   - System fetches credentials for `api.github.com`
   - Decrypts credentials using user's key
   - Injects credentials into HTTP request
   - Executes API call

### Credential Injection

```javascript
// When executing an ability wrapper
export async function wrapper(payload, options) {
  // Static headers (always present)
  const staticHeaders = options.staticHeaders || {};

  // Dynamic headers (from stored credentials, decrypted)
  const dynamicHeaders = options.dynamicHeaders || {};

  // Merge headers
  const headers = { ...staticHeaders, ...dynamicHeaders };

  // Execute API call
  const response = await fetch(url, { method: 'GET', headers });
  return response;
}
```

---

## Security Considerations

### Best Practices

1. **Encryption Keys**
   - Never transmit encryption keys to the server
   - Store keys securely in browser local storage
   - Use strong, unique keys per user

2. **Credential Rotation**
   - Regularly update stored credentials
   - Delete expired credentials
   - Re-encrypt after key changes

3. **Access Control**
   - Always require authentication
   - Implement rate limiting on credential endpoints
   - Add audit logging for credential access

4. **Transport Security**
   - Always use HTTPS in production
   - Validate SSL certificates
   - Use secure session cookies

### Threat Model

**Protected Against**:
- ✅ Server breach (credentials encrypted)
- ✅ Network interception (HTTPS + encrypted payloads)
- ✅ Unauthorized access (authentication required)
- ✅ Database leaks (encrypted at rest)

**Vulnerable To**:
- ⚠️ Client-side key theft (if encryption key compromised)
- ⚠️ User's browser extension compromise
- ⚠️ Phishing attacks for encryption keys

**Mitigation**:
- Use strong encryption keys
- Implement 2FA for sensitive operations
- Add encryption key rotation
- Monitor for suspicious access patterns

---

## Related Documentation

- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - Complete API reference
- [ABILITY_FORMAT.md](./ABILITY_FORMAT.md) - Ability structure and format
- [DATABASE.md](./DATABASE.md) - Database schema details
- [AUTHENTICATION.md](./AUTHENTICATION.md) - Authentication methods

---

## Changelog

### 2025-10-24
- Initial implementation of client-encrypted credentials storage
- Added 5 API endpoints for credential management
- Implemented credential-based access control for ability filtering
- Added crypto utilities for AES-256-GCM decryption
- Database migration: `0004_furry_molecule_man.sql`
