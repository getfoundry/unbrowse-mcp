# API Migration Guide

## Removed Endpoints

### `GET /abilities` - REMOVED

**Removal Date**: January 2025

**Reason**: Security - endpoint allowed bulk extraction of all published abilities without credential filtering.

#### Migration Path

If you were using `GET /abilities`, please migrate to one of these endpoints:

##### For Personal Abilities (user's own abilities)

```bash
# Old (removed)
GET /abilities

# New
GET /my/abilities
Authorization: Bearer <your-api-key>
```

**Response includes**:
- User's private abilities
- User's published abilities
- Credential-based filtering (only shows abilities user can execute)

##### For Global Search (published abilities from all users)

```bash
# Old (removed)
GET /abilities?limit=10&offset=0

# New
GET /public/abilities?q=<search-query>&top_k=10
```

**Key Differences**:
- Requires a search query parameter `q`
- Returns top-k results ranked by relevance
- Includes credential-based filtering:
  - **Without auth**: Only abilities that don't require credentials
  - **With auth**: Abilities user has credentials for + non-credential abilities

##### Example Migration

**Before**:
```bash
curl "https://agent.unbrowse.ai/abilities?limit=20"
```

**After (for personal abilities)**:
```bash
curl -H "Authorization: Bearer re_YOUR_API_KEY" \
  "https://agent.unbrowse.ai/my/abilities?limit=20"
```

**After (for global search)**:
```bash
# Search for GitHub-related abilities
curl "https://agent.unbrowse.ai/public/abilities?q=github&top_k=20"

# Or with authentication for personalized results
curl -H "Authorization: Bearer re_YOUR_API_KEY" \
  "https://agent.unbrowse.ai/public/abilities?q=github&top_k=20"
```

## Benefits of New Endpoints

### Security
- ✅ Prevents bulk extraction of all published abilities
- ✅ Credential-based filtering ensures users only see abilities they can use
- ✅ Search requirement prevents scraping/data harvesting

### User Experience
- ✅ Better relevance through semantic search
- ✅ Personalized results based on user's credentials
- ✅ Clear separation between personal and global abilities

### Performance
- ✅ Search-based retrieval is more efficient
- ✅ Reduced data transfer (only relevant results)
- ✅ Better caching opportunities

## Questions?

If you have questions about this migration, please:
1. Review the [API Reference](./docs/api-examples/abilities-api-reference.md)
2. Check the [Credential Filtering Guide](./docs/technical-reference/credential-filtering-implementation.md)
3. Open an issue on GitHub
