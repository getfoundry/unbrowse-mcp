# Credentials Management

All endpoints in this section require authentication via API key or session token.

Credentials are encrypted authentication data (headers, cookies, tokens) extracted from HAR files. They enable abilities to make authenticated requests to APIs on behalf of the user.

**Security:**
- All credentials are encrypted at rest using AES-256
- Credentials are encrypted with user-specific encryption keys
- Only the owning user can decrypt their credentials
- Credentials are never shared between users

## Stream Credentials

### POST /my/credentials/stream

Upload or update credentials for a domain. This endpoint upserts credentials (updates if exists, creates if new).

**Authentication:** Required (API Key or Session)

**Request Body:**
```json
{
  "domain": "api.example.com",
  "credentials": [
    {
      "type": "header",
      "key": "Authorization",
      "encryptedValue": "{\"ciphertext\":\"...\",\"iv\":\"...\"}",
      "metadata": {
        "source": "har_file",
        "extracted_at": "2025-10-27T03:00:00.000Z"
      }
    },
    {
      "type": "cookie",
      "key": "session",
      "encryptedValue": "{\"ciphertext\":\"...\",\"iv\":\"...\"}",
      "metadata": {}
    }
  ]
}
```

**Field Descriptions:**
- `domain` (required): Domain these credentials belong to
- `credentials` (required): Array of credential objects
  - `type` (required): Credential type (`header`, `cookie`, `query`, `body`)
  - `key` (required): Credential key/name
  - `encryptedValue` (required): Encrypted credential value (JSON string with `ciphertext` and `iv`)
  - `metadata` (optional): Additional metadata object

**Request:**
```bash
curl -X POST http://localhost:4111/my/credentials/stream \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "api.example.com",
    "credentials": [
      {
        "type": "header",
        "key": "Authorization",
        "encryptedValue": "{\"ciphertext\":\"abc123\",\"iv\":\"def456\"}"
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "count": 1,
  "credentials": [
    {
      "credentialId": "cred_123",
      "userId": "user_xyz",
      "domain": "api.example.com",
      "credentialType": "header",
      "credentialKey": "Authorization",
      "encryptedValue": "{\"ciphertext\":\"abc123\",\"iv\":\"def456\"}",
      "metadata": {},
      "createdAt": "2025-10-27T03:30:00.000Z",
      "updatedAt": "2025-10-27T03:30:00.000Z"
    }
  ]
}
```

**Validation:**
- `domain` must be a non-empty string
- `credentials` must be a non-empty array
- Each credential must have `type`, `key`, and `encryptedValue`

**HTTP Status Codes:**
- `200`: Success
- `400`: Invalid request format
- `401`: Authentication required
- `500`: Server error

**Notes:**
- Upserts: If a credential with the same domain+type+key exists, it's updated
- Encryption must be done client-side before calling this endpoint
- The API never sees plaintext credentials
- Used primarily during HAR file ingestion

---

## List Credentials

### GET /my/credentials

List all credentials for the authenticated user.

**Authentication:** Required (API Key or Session)

**Query Parameters:**
- `grouped` (optional): If `true`, group credentials by domain

**Request (Flat List):**
```bash
curl http://localhost:4111/my/credentials \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response (Flat List):**
```json
{
  "success": true,
  "count": 1339,
  "credentials": [
    {
      "credentialId": "8813c0c7-5eda-4577-9ee1-43b449a3deb2",
      "userId": "751beb69-eab9-4a52-a35c-e053587d8500",
      "domain": "accounts.google.com",
      "credentialType": "header",
      "credentialKey": "sec-ch-ua",
      "encryptedValue": "{\"ciphertext\":\"...\",\"iv\":\"...\"}",
      "metadata": {},
      "createdAt": "2025-10-26T12:14:09.861Z",
      "updatedAt": "2025-10-26T12:14:09.861Z"
    }
  ]
}
```

**Request (Grouped by Domain):**
```bash
curl 'http://localhost:4111/my/credentials?grouped=true' \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response (Grouped):**
```json
{
  "success": true,
  "grouped": true,
  "credentials": {
    "accounts.google.com": [
      {
        "credentialId": "8813c0c7-5eda-4577-9ee1-43b449a3deb2",
        "domain": "accounts.google.com",
        "credentialType": "header",
        "credentialKey": "sec-ch-ua",
        "encryptedValue": "{\"ciphertext\":\"...\",\"iv\":\"...\"}",
        "createdAt": "2025-10-26T12:14:09.861Z"
      }
    ],
    "api.example.com": [
      {
        "credentialId": "def456",
        "domain": "api.example.com",
        "credentialType": "cookie",
        "credentialKey": "session",
        "encryptedValue": "{\"ciphertext\":\"...\",\"iv\":\"...\"}",
        "createdAt": "2025-10-26T12:15:00.000Z"
      }
    ]
  }
}
```

**HTTP Status Codes:**
- `200`: Success
- `401`: Authentication required
- `500`: Server error

**Use Cases:**
- Audit what credentials are stored
- Check which domains have credentials
- Clean up old/unused credentials

---

## Get Credentials by Domain

### GET /my/credentials/:domain

Get all credentials for a specific domain.

**Authentication:** Required (API Key or Session)

**Path Parameters:**
- `domain`: Domain to get credentials for (e.g., 'api.example.com')

**Request:**
```bash
curl http://localhost:4111/my/credentials/accounts.google.com \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "domain": "accounts.google.com",
  "count": 10,
  "credentials": [
    {
      "credentialId": "8813c0c7-5eda-4577-9ee1-43b449a3deb2",
      "domain": "accounts.google.com",
      "credentialType": "header",
      "credentialKey": "sec-ch-ua",
      "encryptedValue": "{\"ciphertext\":\"...\",\"iv\":\"...\"}",
      "metadata": {},
      "createdAt": "2025-10-26T12:14:09.861Z",
      "updatedAt": "2025-10-26T12:14:09.861Z"
    }
  ]
}
```

**HTTP Status Codes:**
- `200`: Success (empty array if no credentials for domain)
- `400`: Domain parameter missing
- `401`: Authentication required
- `500`: Server error

**Notes:**
- Returns empty array if no credentials exist for the domain
- Domain matching is exact (not subdomain-aware)

---

## Delete Credentials by Domain

### DELETE /my/credentials/:domain

Delete all credentials for a specific domain.

**Authentication:** Required (API Key or Session)

**Path Parameters:**
- `domain`: Domain to delete credentials for

**Request:**
```bash
curl -X DELETE http://localhost:4111/my/credentials/accounts.google.com \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "domain": "accounts.google.com",
  "deletedCount": 10
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Domain parameter missing
- `401`: Authentication required
- `500`: Server error

**⚠️ Warning:**
- This deletes ALL credentials for the domain
- Abilities using these credentials will fail
- Deletion is permanent and cannot be undone
- Consider exporting/backing up credentials before deletion

**Use Cases:**
- Clean up credentials after revoking access
- Remove credentials for deprecated APIs
- Security: Revoke all access to a compromised account

---

## Delete Specific Credential

### DELETE /my/credentials/by-id/:credentialId

Delete a single credential by its ID.

**Authentication:** Required (API Key or Session)

**Path Parameters:**
- `credentialId`: UUID of the credential to delete

**Request:**
```bash
curl -X DELETE http://localhost:4111/my/credentials/by-id/8813c0c7-5eda-4577-9ee1-43b449a3deb2 \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "credentialId": "8813c0c7-5eda-4577-9ee1-43b449a3deb2"
}
```

**Response (Not Found):**
```json
{
  "success": false,
  "error": "Credential not found"
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Credential ID parameter missing
- `404`: Credential not found or doesn't belong to user
- `401`: Authentication required
- `500`: Server error

**Use Cases:**
- Remove specific outdated credentials (e.g., expired tokens)
- Fine-grained credential management
- Clean up duplicates

---

## Credential Encryption

Credentials must be encrypted client-side before being sent to the API. The API stores encrypted credentials and never has access to plaintext.

**Encryption Format:**
```json
{
  "ciphertext": "base64-encoded-encrypted-data",
  "iv": "base64-encoded-initialization-vector"
}
```

**Encryption Algorithm:**
- Algorithm: AES-256-GCM
- Key derivation: User-specific encryption key (derived from user ID + secret)
- IV: Random 16-byte initialization vector per encryption

**Example (Node.js):**
```javascript
const crypto = require('crypto');

function encryptCredential(plaintext, encryptionKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');

  return JSON.stringify({
    ciphertext,
    iv: iv.toString('base64')
  });
}
```

**Best Practices:**
- Encrypt credentials in the browser/client before transmission
- Never log or display plaintext credentials
- Rotate encryption keys regularly
- Use secure random IVs for each encryption
- Clear plaintext credentials from memory after encryption
