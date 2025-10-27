# Domain Verification

All endpoints in this section require authentication via API key or session token.

Domain verification allows users to prove ownership of domains, which enables them to:
- Publish abilities for their verified domains
- Earn revenue from ability executions
- Control access to their API endpoints

## Request Domain Verification

### POST /my/domains/verify

Request verification for a domain. Returns a TXT record that must be added to DNS.

**Authentication:** Required (API Key or Session)

**Request Body:**
```json
{
  "domain": "api.example.com"
}
```

**Request:**
```bash
curl -X POST http://localhost:4111/my/domains/verify \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "api.example.com"
  }'
```

**Response (Success):**
```json
{
  "success": true,
  "domain": "api.example.com",
  "verificationToken": "unbrowse-verify=abc123def456",
  "dnsRecord": {
    "type": "TXT",
    "host": "_unbrowse-verification",
    "value": "abc123def456"
  },
  "instructions": "Add a TXT record to your DNS with the following:\nHost: _unbrowse-verification.api.example.com\nValue: abc123def456\n\nThen call POST /my/domains/api.example.com/verify to complete verification.",
  "status": "pending"
}
```

**Response (Domain Already Verified):**
```json
{
  "success": false,
  "error": "Domain api.example.com is already verified for this user"
}
```

**Response (Domain Verified by Another User):**
```json
{
  "success": false,
  "error": "Domain api.example.com is already verified by another user"
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Invalid domain or domain already verified
- `401`: Authentication required
- `500`: Server error

**Validation:**
- Domain must be a valid string (e.g., 'api.example.com')
- Domain cannot already be verified
- Only one user can verify each domain

---

## Verify Domain Ownership

### POST /my/domains/:domain/verify

Verify domain ownership by checking for the TXT record in DNS.

**Authentication:** Required (API Key or Session)

**Path Parameters:**
- `domain`: The domain to verify (e.g., 'api.example.com')

**Request:**
```bash
curl -X POST http://localhost:4111/my/domains/api.example.com/verify \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response (Success):**
```json
{
  "success": true,
  "domain": "api.example.com",
  "verified": true,
  "verifiedAt": "2025-10-27T03:40:00.000Z",
  "message": "Domain successfully verified!"
}
```

**Response (TXT Record Not Found):**
```json
{
  "success": false,
  "error": "DNS verification failed. TXT record not found at _unbrowse-verification.api.example.com",
  "expectedValue": "abc123def456",
  "foundRecords": []
}
```

**Response (Domain Not Requested):**
```json
{
  "success": false,
  "error": "Domain verification not found. Please request verification first using POST /my/domains/verify"
}
```

**HTTP Status Codes:**
- `200`: Success (domain verified)
- `400`: Verification failed (DNS record not found or incorrect)
- `401`: Authentication required
- `500`: Server error

**Verification Process:**
1. Request verification: `POST /my/domains/verify`
2. Add TXT record to your DNS:
   - Host: `_unbrowse-verification.{your-domain}`
   - Value: `{verification-token}`
3. Wait for DNS propagation (can take up to 48 hours)
4. Verify ownership: `POST /my/domains/{your-domain}/verify`

---

## Get User Domains

### GET /my/domains

Get all domains (verified and pending) for the authenticated user.

**Authentication:** Required (API Key or Session)

**Request:**
```bash
curl http://localhost:4111/my/domains \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "count": 0,
  "domains": []
}
```

**Example with Data:**
```json
{
  "success": true,
  "count": 2,
  "domains": [
    {
      "domainId": "domain_123",
      "userId": "user_xyz",
      "domain": "api.example.com",
      "status": "verified",
      "verificationToken": "abc123def456",
      "verifiedAt": "2025-10-27T03:40:00.000Z",
      "createdAt": "2025-10-27T03:30:00.000Z",
      "updatedAt": "2025-10-27T03:40:00.000Z"
    },
    {
      "domainId": "domain_456",
      "userId": "user_xyz",
      "domain": "staging.example.com",
      "status": "pending",
      "verificationToken": "def456ghi789",
      "verifiedAt": null,
      "createdAt": "2025-10-27T04:00:00.000Z",
      "updatedAt": "2025-10-27T04:00:00.000Z"
    }
  ]
}
```

**Domain Status:**
- `pending`: Verification requested but not completed
- `verified`: Domain ownership verified

**HTTP Status Codes:**
- `200`: Success
- `401`: Authentication required
- `500`: Server error

---

## Delete Domain Verification

### DELETE /my/domains/:domain

Delete a domain verification. Only works for unverified domains (status: pending).

**Authentication:** Required (API Key or Session)

**Path Parameters:**
- `domain`: The domain to delete (e.g., 'api.example.com')

**Request:**
```bash
curl -X DELETE http://localhost:4111/my/domains/api.example.com \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Domain verification deleted successfully",
  "domain": "api.example.com"
}
```

**Response (Already Verified):**
```json
{
  "success": false,
  "error": "Cannot delete verified domain. Please contact support if you need to remove a verified domain."
}
```

**Response (Not Found):**
```json
{
  "success": false,
  "error": "Domain verification not found"
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Cannot delete (domain already verified or not found)
- `401`: Authentication required
- `500`: Server error

**Notes:**
- Only pending (unverified) domains can be deleted
- Verified domains require support contact to remove
- Useful for cleaning up failed verification attempts
