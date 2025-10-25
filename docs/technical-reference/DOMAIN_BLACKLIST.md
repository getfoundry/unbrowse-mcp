# Domain Blacklist & API Key Access Control

## Overview

The domain blacklist feature allows you to restrict access to abilities from specific domains, requiring API key authentication to view them. This is useful for:

- **Private/Internal APIs**: Hide internal company APIs from public searches
- **Paid/Premium APIs**: Restrict access to premium endpoints
- **Compliance**: Control which users can see sensitive endpoints
- **Multi-tenancy**: Different API keys can access different domain sets

## How It Works

1. **Blacklist Configuration**: Define domains that require authentication
2. **API Keys**: Configure keys with access to specific domains or all domains
3. **Automatic Filtering**: Search/list operations automatically filter based on API key
4. **Database-Level**: Filtering happens at the repository level for security

## Configuration

### Environment Variables

#### 1. Blacklist Domains

```bash
# .env or docker-compose.yml
BLACKLISTED_DOMAINS=internal.company.com,api.private.com,premium.service.io
```

**Format**: Comma-separated list of domain names

**Example**:
```bash
BLACKLISTED_DOMAINS=api.stripe.com,api.internal.company.com
```

#### 2. API Keys

```bash
# .env or docker-compose.yml
API_KEYS=key1:domain1.com,domain2.com;key2:*;key3:domain3.com
```

**Format**: `key:domains;key:domains;...`

**Examples**:

```bash
# Full access to all domains (wildcard)
API_KEYS=admin-key-123:*

# Access to specific domains only
API_KEYS=stripe-key:api.stripe.com,webhooks.stripe.com

# Multiple keys with different permissions
API_KEYS=admin-key:*;stripe-key:api.stripe.com;internal-key:api.internal.company.com

# Empty domain list also means full access
API_KEYS=admin-key:
```

### Docker Compose Example

```yaml
version: '3.8'

services:
  app:
    build: .
    environment:
      # Blacklist internal and premium domains
      BLACKLISTED_DOMAINS: "api.internal.company.com,api.premium.service.io"

      # Configure API keys
      # - admin-key: full access to everything
      # - internal-key: access to internal domain only
      # - premium-key: access to premium domain only
      API_KEYS: "admin-key:*;internal-key:api.internal.company.com;premium-key:api.premium.service.io"
```

## Usage

### Without API Key (Public Access)

Blacklisted domains are automatically filtered out:

```bash
# Returns only public domains
curl http://localhost:4111/abilities

# Search returns only public results
curl "http://localhost:4111/abilities/search?q=user"
```

**Result**: Abilities from blacklisted domains are excluded.

### With API Key (Authenticated Access)

Include API key in request headers:

#### Option 1: Bearer Token

```bash
curl http://localhost:4111/abilities \
  -H "Authorization: Bearer your-api-key-123"
```

#### Option 2: X-API-Key Header

```bash
curl http://localhost:4111/abilities \
  -H "X-API-Key: your-api-key-123"
```

**Result**: Abilities from authorized domains are included.

### API Key Permissions

| API Key | Configured Domains | Can Access |
|---------|-------------------|------------|
| `admin-key:*` | Wildcard | All domains (including blacklisted) |
| `admin-key:` | Empty list | All domains (including blacklisted) |
| `stripe-key:api.stripe.com` | Single domain | Only `api.stripe.com` |
| `multi-key:api.stripe.com,api.github.com` | Multiple domains | Only listed domains |
| Invalid/missing key | N/A | Only non-blacklisted domains |

## Examples

### Example 1: Internal Company APIs

**Scenario**: Hide internal APIs from public searches, allow authenticated access.

**.env**:
```bash
BLACKLISTED_DOMAINS=api.internal.company.com
API_KEYS=internal-team-key:api.internal.company.com;admin-key:*
```

**Public search** (no API key):
```bash
curl "http://localhost:4111/abilities/search?q=user"
# Returns: Only public APIs
```

**Internal team search** (with API key):
```bash
curl "http://localhost:4111/abilities/search?q=user" \
  -H "X-API-Key: internal-team-key"
# Returns: Public APIs + internal.company.com APIs
```

**Admin search** (wildcard key):
```bash
curl "http://localhost:4111/abilities/search?q=user" \
  -H "X-API-Key: admin-key"
# Returns: All APIs (public + all blacklisted)
```

---

### Example 2: Multi-Tenant SaaS

**Scenario**: Different customers access different API domains.

**.env**:
```bash
BLACKLISTED_DOMAINS=customer-a.api.com,customer-b.api.com,customer-c.api.com
API_KEYS=customer-a-key:customer-a.api.com;customer-b-key:customer-b.api.com;customer-c-key:customer-c.api.com
```

**Customer A**:
```bash
curl http://localhost:4111/abilities \
  -H "X-API-Key: customer-a-key"
# Returns: Public APIs + customer-a.api.com only
```

**Customer B**:
```bash
curl http://localhost:4111/abilities \
  -H "X-API-Key: customer-b-key"
# Returns: Public APIs + customer-b.api.com only
```

---

### Example 3: Freemium Model

**Scenario**: Free tier sees public APIs, paid tier sees premium endpoints.

**.env**:
```bash
BLACKLISTED_DOMAINS=api.premium.service.io
API_KEYS=premium-subscriber-key:api.premium.service.io
```

**Free tier** (no key):
```bash
curl http://localhost:4111/abilities
# Returns: Only public APIs
```

**Premium tier** (with key):
```bash
curl http://localhost:4111/abilities \
  -H "X-API-Key: premium-subscriber-key"
# Returns: Public APIs + premium.service.io
```

---

## Security Considerations

### ✅ Best Practices

1. **Use Strong API Keys**: Generate cryptographically secure random keys
   ```bash
   # Generate a secure key
   openssl rand -hex 32
   ```

2. **Store Keys Securely**: Use environment variables, never commit to git
   ```bash
   # .gitignore
   .env
   .env.local
   ```

3. **Rotate Keys Regularly**: Change API keys periodically

4. **Principle of Least Privilege**: Grant minimum necessary domain access
   ```bash
   # Good: Specific domains
   API_KEYS=user-key:api.stripe.com

   # Avoid: Wildcard unless necessary
   API_KEYS=user-key:*
   ```

5. **Monitor Usage**: Log API key usage for audit trails

### ⚠️ Important Notes

- **Not a Replacement for Authentication**: This is domain filtering, not user authentication
- **Client-Side Only**: Browser-based apps expose API keys (use backend proxy instead)
- **Rate Limiting**: Consider adding rate limits per API key
- **HTTPS Only**: Always use HTTPS in production to protect keys in transit

---

## Implementation Details

### Architecture

```
Request with API Key
         ↓
    Extract API Key (middleware.ts)
         ↓
    Get Filtered Domains (config.ts)
         ↓
    Apply to Search Options (routes.ts)
         ↓
    Filter Results (ability-repository-vector.ts)
         ↓
    Return Filtered Abilities
```

### Files

- **`src/server/config.ts`**: Domain blacklist and API key configuration
- **`src/server/middleware.ts`**: API key extraction from headers
- **`src/server/routes.ts`**: Apply filtering to routes
- **`src/server/ability-repository-vector.ts`**: Database-level filtering
- **`src/server/types.ts`**: Type definitions for options

### Filtering Logic

```typescript
// Pseudocode
if (no API key) {
  excludeDomains = ALL_BLACKLISTED_DOMAINS;
} else if (API key is invalid) {
  excludeDomains = ALL_BLACKLISTED_DOMAINS;
} else if (API key has wildcard access) {
  excludeDomains = []; // Show everything
} else {
  excludeDomains = BLACKLISTED_DOMAINS - ALLOWED_DOMAINS;
}
```

---

## Testing

### Test Blacklist Configuration

```bash
# 1. Set blacklist
export BLACKLISTED_DOMAINS=api.test.com
export API_KEYS=test-key:api.test.com

# 2. Start server
pnpm dev

# 3. Test without API key (should filter)
curl http://localhost:4111/abilities

# 4. Test with API key (should include)
curl http://localhost:4111/abilities \
  -H "X-API-Key: test-key"
```

### Verify in Logs

Look for filtering messages:
```
[Config] Blacklisted domains: [ 'api.test.com' ]
[Config] API keys configured: 1
[AbilityRepository] Filtering out blacklisted domain: get_users domain: api.test.com
```

---

## Troubleshooting

### Issue: Blacklisted domains still showing

**Check**:
1. Environment variables are set correctly
2. Server was restarted after config change
3. Domain names match exactly (case-sensitive)
4. Check logs for `[Config]` messages

### Issue: API key not working

**Check**:
1. Header format is correct (`Authorization: Bearer <key>` or `X-API-Key: <key>`)
2. API key is configured in `API_KEYS` environment variable
3. Domain is listed in the key's allowed domains
4. No typos in key or domain names

### Issue: See too many/few results

**Check**:
1. `filterByDomains` parameter (filters dynamic headers)
2. `domains` parameter (whitelist specific domains)
3. `excludeDomains` is correctly applied
4. API key permissions match expectations

---

## FAQ

**Q: Can I blacklist multiple domains?**
A: Yes, use comma-separated list: `BLACKLISTED_DOMAINS=domain1.com,domain2.com,domain3.com`

**Q: Can one API key access multiple domains?**
A: Yes, use comma-separated list: `API_KEYS=mykey:domain1.com,domain2.com`

**Q: Can I have multiple API keys?**
A: Yes, use semicolon to separate: `API_KEYS=key1:domain1.com;key2:domain2.com`

**Q: What's the difference between `*` and empty domain list?**
A: Both grant full access. `*` is explicit wildcard, empty list is implicit wildcard.

**Q: Can I blacklist subdomains?**
A: Yes, but exact match only. `api.company.com` won't match `staging.api.company.com`.

**Q: How do I create an admin key?**
A: Use wildcard: `API_KEYS=admin-key:*`

**Q: Does this work with HAR ingestion?**
A: Yes, domains are extracted automatically during ingestion and stored with abilities.

**Q: Is this enforced in Vector DB?**
A: No, filtering happens in the application layer after retrieval from Vector DB.

---

## Migration Guide

### Adding Blacklist to Existing Setup

1. **Identify sensitive domains**:
   ```bash
   # List all unique domains
   curl http://localhost:4111/abilities | jq -r '.abilities[].domain' | sort -u
   ```

2. **Configure blacklist**:
   ```bash
   # docker-compose.yml
   environment:
     BLACKLISTED_DOMAINS: "api.internal.company.com,api.staging.company.com"
   ```

3. **Generate API keys**:
   ```bash
   # Generate secure keys
   echo "admin-key:$(openssl rand -hex 32)"
   echo "internal-key:$(openssl rand -hex 32)"
   ```

4. **Update configuration**:
   ```bash
   API_KEYS: "admin-abc123:*;internal-def456:api.internal.company.com"
   ```

5. **Restart and test**:
   ```bash
   docker-compose restart
   curl http://localhost:4111/abilities # Should filter
   curl http://localhost:4111/abilities -H "X-API-Key: admin-abc123" # Should show all
   ```

---

## See Also

- [API_INGESTION.md](API_INGESTION.md) - How domains are extracted and stored
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment guide
- [USER_GUIDE.md](USER_GUIDE.md) - Vector DB usage examples
