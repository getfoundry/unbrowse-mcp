# Search Endpoints Guide

This guide explains how the search endpoints work and when to use each one.

## Overview

There are two search endpoints with different purposes:

1. **`/public/abilities`** - Searches **published** abilities (global + personal KGE blobs)
2. **`/abilities/search`** - Searches **your** abilities (charges tokens)

Both endpoints require API key authentication and include credential-based filtering.

### Implementation Details: Promise.allSettled for Resilient Search

The MCP client uses **`Promise.allSettled`** to search both personal and public abilities in parallel, ensuring maximum reliability:

```typescript
const [personalResult, publicResult] = await Promise.allSettled([
  this.listAbilities(options).then(result => result.abilities),
  this.searchPublicAbilities(query, limit * 3).then(result => result.abilities),
]);

// Extract results with graceful error handling
const personalAbilities = personalResult.status === 'fulfilled'
  ? personalResult.value
  : (() => {
      console.warn('[WARN] Personal abilities search failed:', personalResult.reason);
      return [] as IndexedAbility[];
    })();

const publicAbilities = publicResult.status === 'fulfilled'
  ? publicResult.value
  : (() => {
      console.warn('[WARN] Public abilities search failed:', publicResult.reason);
      return [] as IndexedAbility[];
    })();
```

**Why `Promise.allSettled`?**

| Benefit | Description |
|---------|-------------|
| **Resilience** | If one search fails (e.g., API timeout, network error), the other still succeeds |
| **Performance** | Both searches run in parallel, reducing total search time by ~50% |
| **Graceful Degradation** | Failed searches return empty arrays with logged warnings instead of crashing |
| **No Cascading Failures** | Unlike `Promise.all`, one rejection doesn't fail the entire search operation |

**Comparison: `Promise.all` vs `Promise.allSettled`**

```typescript
// ❌ Promise.all - ONE failure kills the entire search
const [personal, public] = await Promise.all([
  getPersonalAbilities(),  // If this fails...
  getPublicAbilities(),     // ...this result is lost too!
]);

// ✅ Promise.allSettled - Each search is independent
const [personalResult, publicResult] = await Promise.allSettled([
  getPersonalAbilities(),  // If this fails, we still get public results
  getPublicAbilities(),    // If this fails, we still get personal results
]);
```

---

## 1. Public Abilities Search

**Endpoint:** `GET /public/abilities`

**Purpose:** Search across published abilities from the global marketplace AND your personal abilities.

### How It Works

When authenticated, this endpoint searches **BOTH**:
- **Global KGE blob** (`abilities_kge`) - Contains all published abilities from all users
- **Personal KGE blob** (`abilities_kge_user_{userId}`) - Contains your personal abilities (published + private)

Your personal abilities get a **10% relevance boost** in the ranking.

### Authentication

**Required:** API key via `Authorization: Bearer {api_key}`

### Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | - | Search query text |
| `top_k` | number | No | 10 | Maximum number of results to return |

### Credential Filtering (Always Active)

**All search results are automatically filtered** based on your stored credentials. You will **ONLY** see abilities that:

1. **Don't require credentials** (`dynamicHeadersRequired = false`) - Always shown
2. **You have ALL required headers for** - Only shown if you have stored every header in `dynamicHeaderKeys`
3. **You favorited** - Always shown (even if you're missing credentials)

**You will NEVER see** abilities requiring credentials you don't have (unless favorited). This prevents execution errors when you try to use an ability.

### Example Request

```bash
curl -H "Authorization: Bearer re_YOUR_API_KEY" \
  "http://localhost:4111/public/abilities?q=twitter%20messages&top_k=5"
```

### Example Response

```json
{
  "success": true,
  "query": "twitter messages",
  "count": 3,
  "results": [
    {
      "userAbilityId": "abc123",
      "abilityName": "get_dm_conversations",
      "serviceName": "twitter",
      "domain": "x.com",
      "description": "Fetch Twitter DM conversation list",
      "dynamicHeadersRequired": true,
      "dynamicHeaderKeys": ["x.com::x-csrf-token", "x.com::authorization"],
      "isPublished": true,
      "isFavorite": false
    }
  ]
}
```

### Use Cases

- **Discovery:** Browse all published abilities from the marketplace
- **Personal Search:** Find your own abilities alongside public ones
- **Weighted Results:** Your personal abilities rank higher due to 10% boost

---

## 2. User Abilities Search (Token Charging)

**Endpoint:** `GET /abilities/search`

**Purpose:** Search only **your** abilities (both private and published). Charges tokens per search.

### How It Works

Searches **ONLY** your personal KGE blob:
- **Personal KGE blob** (`abilities_kge_user_{userId}`) - Your private + published abilities
- **Global KGE blob** - Also searched with 10% boost for personal results

### Authentication

**Required:** API key via `Authorization: Bearer {api_key}`

### Token Charging

This endpoint **charges tokens** based on:
- Query length
- Configured cost per search (see rewards config)

You must have sufficient token balance or the search will fail with HTTP 402.

### Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | - | Search query text |
| `top_k` | number | No | 10 | Maximum number of results to return |

### Credential Filtering (Always Active)

**Same filtering as public search** - automatically filters results to show only:
- Abilities that don't require credentials
- Abilities you have ALL required credentials for
- Favorited abilities (always shown regardless of credentials)

### Example Request

```bash
curl -H "Authorization: Bearer re_YOUR_API_KEY" \
  "http://localhost:4111/abilities/search?q=send%20tweet&top_k=10"
```

### Example Response

```json
{
  "success": true,
  "query": "send tweet",
  "count": 2,
  "cost": "0.000050",
  "results": [
    {
      "userAbilityId": "def456",
      "abilityName": "post_tweet",
      "serviceName": "twitter",
      "domain": "x.com",
      "description": "Post a new tweet",
      "dynamicHeadersRequired": true,
      "dynamicHeaderKeys": ["x.com::x-csrf-token"],
      "isPublished": false,
      "isFavorite": true
    }
  ]
}
```

### Error Response (Insufficient Tokens)

```json
{
  "success": false,
  "error": "Insufficient tokens. Please purchase tokens to continue.",
  "balance_required": "0.000050"
}
```

### Use Cases

- **Personal Library:** Search only your own abilities
- **Private Abilities:** Includes abilities you haven't published
- **Token Economy:** Part of the rewards/token system

---

## Comparison Table

| Feature | `/public/abilities` | `/abilities/search` |
|---------|-------------------|-------------------|
| **Authentication** | Required (API key) | Required (API key) |
| **Token Charging** | No | Yes |
| **Global Blob Search** | ✅ Yes | ✅ Yes |
| **Personal Blob Search** | ✅ Yes (if authenticated) | ✅ Yes |
| **Published Abilities Only** | Yes | No (includes private) |
| **Personal Boost** | 10% | 10% |
| **Credential Filtering** | ✅ All required headers | ✅ All required headers |
| **Favorited Always Shown** | ✅ Yes | ✅ Yes |
| **Uses Promise.allSettled** | ✅ Yes (client-side) | ✅ Yes (client-side) |

---

## Error Handling & Resilience

### Promise.allSettled Error Handling

The client implementation handles search failures gracefully:

**Scenario 1: Personal Search Fails**
```typescript
// Personal API is down, but public search succeeds
const results = await searchAbilities("twitter");
// Returns: Only public abilities (personal = [])
// Logs: [WARN] Personal abilities search failed: Request timeout
```

**Scenario 2: Public Search Fails**
```typescript
// Public API is down, but personal search succeeds
const results = await searchAbilities("twitter");
// Returns: Only personal abilities (public = [])
// Logs: [WARN] Public abilities search failed: Network error
```

**Scenario 3: Both Searches Fail**
```typescript
// Both APIs are down
const results = await searchAbilities("twitter");
// Returns: Empty results (count: 0)
// Logs: [WARN] Personal abilities search failed: ...
//       [WARN] Public abilities search failed: ...
```

**Scenario 4: Both Searches Succeed (Normal)**
```typescript
// Both APIs respond successfully
const results = await searchAbilities("twitter");
// Returns: Merged and ranked results from both sources
// Personal abilities get 10% score boost
```

### Retry Strategy

Currently, there is **NO automatic retry** - searches fail fast and log warnings. To add retries:

```typescript
async function searchWithRetry(query: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await searchAbilities(query);

    if (result.count > 0) {
      return result; // Success
    }

    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw new Error('All search attempts failed');
}
```

---

## KGE Blob Structure

### Global KGE Blob
- **Name:** `abilities_kge`
- **Contains:** All published abilities from all users
- **Updated:** When abilities are published

### Personal KGE Blob
- **Name:** `abilities_kge_user_{userId}`
- **Contains:** User's private + published abilities
- **Updated:** When user ingests/creates abilities

---

## Credential-Based Filtering Details

**IMPORTANT:** Both endpoints **always apply credential filtering** - this is not optional. You cannot disable it.

### Why Filtering is Always Active

Filtering prevents this error at execution time:
```json
{
  "success": false,
  "error": "Credentials not available for ability. Missing headers: x.com::x-csrf-token"
}
```

By filtering search results, you only see abilities you can actually execute.

### Filtering Rules

An ability is shown **ONLY IF** one of these conditions is true:

1. **Favorited** - You marked it as favorite (overrides credential requirements), OR
2. **No credentials required** - `dynamicHeadersRequired = false`, OR
3. **Has ALL required headers** - You have stored credentials for **every** header in `dynamicHeaderKeys`

**If none of these are true, the ability is hidden from search results.**

### Header Checking

Dynamic headers are in format: `"domain::header"`

Example: If an ability requires:
```json
{
  "dynamicHeaderKeys": [
    "x.com::x-csrf-token",
    "x.com::authorization"
  ]
}
```

The user must have BOTH:
- `x.com::x-csrf-token` stored
- `x.com::authorization` stored

Having just `x.com::cookie` is **not sufficient** - all required headers must match.

---

## Troubleshooting

### Getting 0 Results

If searches return 0 results:

1. **Check KGE Blobs are Populated**
   - Global blob may be empty if no abilities published
   - Personal blob populated during ingestion

2. **Check Credential Filtering**
   - Abilities requiring credentials you don't have are filtered out
   - Favorite some abilities to always see them

3. **Check Embeddings**
   - Query embedding may not match stored ability embeddings
   - Try broader search terms

4. **Check Logs for Promise.allSettled Warnings**
   ```bash
   [WARN] Personal abilities search failed: Request timeout after 10000ms
   [WARN] Public abilities search failed: Network error
   ```
   - If both searches fail, you'll get 0 results
   - Check API server status and network connectivity

### Authentication Errors

Both endpoints require valid API keys:

```json
{
  "success": false,
  "error": "API key not found or has been revoked"
}
```

**Solution:** Check your API key is valid and not revoked.

### Token Balance Errors (Search endpoint only)

```json
{
  "success": false,
  "error": "Insufficient tokens. Please purchase tokens to continue.",
  "balance_required": "0.000050"
}
```

**Solution:** Purchase tokens or use `/public/abilities` instead (no token charge).

### Timeout Errors

```bash
[WARN] Personal abilities search failed: Request timeout after 10000ms
```

**Solution:**
- Check API server is running
- Increase timeout in client config:
  ```typescript
  const client = new UnbrowseApiClient({
    apiKey: 'your_key',
    timeout: 30000 // 30 seconds
  });
  ```

---

## Best Practices

### When to Use Public Search

- Discovering new abilities from the marketplace
- Finding both your abilities and others' published ones
- No token cost - good for frequent searches
- Want personalized ranking (10% boost for your abilities)

### When to Use User Search

- Searching only your personal library
- Need to find private (unpublished) abilities
- Part of a token-based workflow
- Willing to pay per search for focused results

### Optimizing Search Results

1. **Publish Abilities** - Publish your best abilities to the global blob for discovery
2. **Favorite Important Abilities** - They'll always show even without credentials
3. **Store Credentials** - Ensure you have all required dynamic headers stored
4. **Use Specific Queries** - More specific queries yield better matches
5. **Monitor Search Logs** - Watch for `Promise.allSettled` warnings to catch API issues early

### Performance Tips

1. **Parallel Searches are Fast** - Thanks to `Promise.allSettled`, both searches run concurrently
2. **Limit Results** - Use smaller `limit` values for faster responses
3. **Cache Results** - Store search results locally to avoid repeated API calls
4. **Batch Searches** - If searching for multiple terms, use a single broader query

---

## Related Documentation

- [Credential-Based Filtering Implementation](./technical-reference/credential-filtering-implementation.md)
- [Dynamic Headers Guide](./technical-reference/DYNAMIC_HEADERS_GUIDE.md)
- [Rewards System](./REWARDS_SYSTEM_OVERVIEW.md)
- [API Complete Guide](./API_COMPLETE_GUIDE.md)
- [Promise.allSettled MDN Reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)
