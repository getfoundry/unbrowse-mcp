# Legacy Code Cleanup - January 2025

## Overview

This document summarizes the legacy code cleanup performed to improve security, consistency, and maintainability of the abilities API.

## Changes Summary

### 🗑️ Files Removed

1. **`src/server/routes.ts.backup`** (2,543 lines, 82KB)
   - Removed old backup file
   - Version control handles backups properly

### 🔧 Code Removed/Deprecated

1. **`GET /abilities` endpoint** - REMOVED
   - **Location**: `src/server/routes/public.ts`
   - **Issue**: Allowed bulk extraction of all published abilities without credential filtering
   - **Migration**: Use `/public/abilities?q=<query>` or `/my/abilities`
   - **Status**: Commented out with migration instructions

2. **`getPublishedAbilities()` method** - REMOVED
   - **Location**: `src/server/ability-repository-user.ts:543`
   - **Issue**: Deprecated method with no credential filtering
   - **Used By**: Previously used by removed `/abilities` endpoint (now unused)
   - **Status**: Removed completely

3. **`AbilityRepositoryVector` usage** - MIGRATED
   - **Location**: All endpoints now use `AbilityRepositoryUser`
   - **Issue**: Direct vector DB access without credential filtering, inconsistent architecture
   - **Migration**: All endpoints migrated to use `AbilityRepositoryUser` with credential filtering
   - **Status**: No longer imported or used anywhere (file can be archived)

### ✅ Endpoints Updated

#### 1. `GET /abilities/:id` - Added Credential Filtering
**Before**:
- Used `AbilityRepositoryVector.getAbilityById()`
- No credential checking
- Returned any published ability

**After**:
- Uses `AbilityRepositoryUser.getPublishedAbilityById()`
- Includes credential filtering
- Only returns abilities user has access to
- Better error messages for unauthenticated users

**Changes**:
```typescript
// Old
const ability = await abilityRepository.getAbilityById(abilityId);

// New
const userId = await getUserId(c);
const ability = await userAbilityRepository.getPublishedAbilityById(abilityId, userId || undefined);
```

#### 2. `GET /abilities/search` - Added Credential Filtering
**Before**:
- Used `AbilityRepositoryVector.searchAbilities()`
- No credential filtering
- Charged tokens but returned abilities user might not be able to use

**After**:
- Uses `AbilityRepositoryUser.searchUserAbilities()`
- Includes credential filtering
- Only returns abilities user has credentials for
- More valuable search results

**Changes**:
```typescript
// Old
const results = await abilityRepository.searchAbilities(query, top_k, userId);

// New
const results = await userAbilityRepository.searchUserAbilities(userId, query);
const limitedResults = results.slice(0, top_k);
```

### 🆕 New Methods Added

1. **`getPublishedAbilityById(abilityId, userId?)`**
   - **Location**: `src/server/ability-repository-user.ts:555`
   - **Purpose**: Get single published ability with credential filtering
   - **Behavior**:
     - Returns ability if it doesn't require credentials (public access)
     - Returns ability if user has credentials for the domain
     - Returns null if user lacks required credentials
     - Always returns favorited abilities (even without credentials)

## Security Improvements

### Before Cleanup
- ❌ Bulk extraction of all published abilities via `/abilities`
- ❌ No credential filtering on ability details
- ❌ Paid search returned unusable abilities
- ❌ Inconsistent repository usage across endpoints

### After Cleanup
- ✅ All list/bulk endpoints removed or require search queries
- ✅ All endpoints use credential filtering
- ✅ Consistent use of `AbilityRepositoryUser` across all endpoints
- ✅ Users only see abilities they can actually use
- ✅ Better security through forced search (prevents scraping)

## API Endpoint Status

| Endpoint | Auth | Method | Status | Credential Filtering |
|----------|------|--------|--------|---------------------|
| `GET /health` | ❌ | Health check | ✅ Active | N/A |
| `GET /docs/openapi.json` | ❌ | API docs | ✅ Active | N/A |
| ~~`GET /abilities`~~ | ❌ | ~~List all~~ | ❌ **REMOVED** | ❌ None |
| `GET /abilities/:id` | ❌ Optional | Get single | ✅ **UPDATED** | ✅ Yes |
| `GET /public/abilities?q=` | ❌ Optional | Search global | ✅ **UPDATED** | ✅ Yes |
| `GET /abilities/search` | ✅ Required | Paid search | ✅ **UPDATED** | ✅ Yes |
| `GET /my/abilities` | ✅ Required | List personal | ✅ Active | ✅ Yes |
| `GET /my/abilities/favorites` | ✅ Required | List favorites | ✅ Active | ✅ Yes |

## Migration Guide

### For Developers Using the API

#### Removed Endpoint: `GET /abilities`

**Before**:
```bash
curl "https://agent.unbrowse.ai/abilities?limit=20&offset=0"
```

**After - For Personal Abilities**:
```bash
curl -H "Authorization: Bearer <api-key>" \
  "https://agent.unbrowse.ai/my/abilities?limit=20"
```

**After - For Global Search**:
```bash
curl "https://agent.unbrowse.ai/public/abilities?q=github&top_k=20"
```

#### Updated Endpoint: `GET /abilities/:id`

**Behavior Change**:
- Now returns 404 if user doesn't have required credentials
- Better error messages distinguish between "not found" and "no access"

**Example**:
```bash
# Unauthenticated - only works for abilities without credential requirements
curl "https://agent.unbrowse.ai/abilities/get-github-repo"

# Authenticated - works for abilities user has credentials for
curl -H "Authorization: Bearer <api-key>" \
  "https://agent.unbrowse.ai/abilities/get-github-repo"
```

### For Internal Development

#### Import Changes

**Before**:
```typescript
import { AbilityRepositoryVector } from "./ability-repository-vector.js";
const abilityRepository = new AbilityRepositoryVector();
```

**After**:
```typescript
import { AbilityRepositoryUser } from "./ability-repository-user.js";
const userAbilityRepository = new AbilityRepositoryUser();
```

#### Method Mapping

| Old Method | New Method | Notes |
|------------|------------|-------|
| `searchAbilities(query, top_k, userId)` | `searchUserAbilities(userId, query)` | Personal search with filtering |
| `searchPublishedAbilities(query, top_k)` | `searchPublishedAbilities(query, limit, userId?)` | Now has credential filtering |
| `getAbilityById(id)` | `getPublishedAbilityById(id, userId?)` | New method with filtering |
| `listPublishedAbilities(limit, offset)` | ❌ Removed | Use search instead |
| `getPublishedAbilities()` | ❌ Removed | Use search instead |

## Files That Can Be Archived

The following files are no longer actively used but kept for reference:

1. **`src/server/ability-repository-vector.ts`**
   - No longer imported or used anywhere
   - All functionality migrated to `AbilityRepositoryUser`
   - Can be moved to `/archive` or deleted if desired

## Benefits Achieved

### Security
- ✅ No more bulk data extraction
- ✅ Credential-based access control on all endpoints
- ✅ Users only see abilities they can use
- ✅ Forced search prevents scraping

### User Experience
- ✅ Better relevance (semantic search required)
- ✅ No confusion from seeing unusable abilities
- ✅ Clear error messages
- ✅ Personalized results based on credentials

### Code Quality
- ✅ Consistent repository usage
- ✅ Single source of truth (`AbilityRepositoryUser`)
- ✅ Better separation of concerns
- ✅ Reduced code duplication

### Performance
- ✅ Batch credential checking
- ✅ Early filtering reduces data transfer
- ✅ Better caching opportunities

## Testing Recommendations

After deployment, verify:

1. ✅ `GET /abilities` returns 404
2. ✅ `GET /abilities/:id` with auth returns abilities user has access to
3. ✅ `GET /abilities/:id` without auth returns 404 for credential-required abilities
4. ✅ `GET /public/abilities?q=test` filters based on credentials
5. ✅ `GET /abilities/search` (paid) only returns user's accessible abilities
6. ✅ All endpoints return proper error messages

## Rollback Plan

If issues arise:

1. **Partial Rollback**: Uncomment `/abilities` endpoint in `public.ts` and `routes.ts`
2. **Full Rollback**: Restore `AbilityRepositoryVector` imports and revert method calls
3. **Data**: No database changes required - purely code changes

## Related Documentation

- [Migration Guide](./MIGRATION-GUIDE.md)
- [Credential Filtering Implementation](./technical-reference/credential-filtering-implementation.md)
- [API Examples](./api-examples/abilities-api-reference.md)

## Completion Date

January 2025

## Contributors

- Automated cleanup and security enhancement
- All endpoints now use credential-based filtering
- Legacy code successfully removed/migrated
