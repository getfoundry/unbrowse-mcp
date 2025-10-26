# Credential-Based Filtering Implementation

## Overview

This document describes the credential-based filtering system implemented for the `/public/abilities` endpoint to ensure users only see abilities they can actually use.

## Problem Statement

The `/public/abilities` endpoint was returning all published abilities without considering whether the user had the necessary credentials (API keys, tokens, etc.) to actually use them. This created a poor user experience where users would see abilities they couldn't execute.

## Solution

Implemented credential-based filtering that:
1. **No Authentication**: Only returns abilities that don't require credentials (`dynamicHeadersRequired = false`)
2. **With Authentication**: Returns abilities the user has credentials for OR abilities that don't require credentials

## Implementation Details

### Files Modified

1. **[src/server/routes/public.ts](../../src/server/routes/public.ts)**
   - Updated imports to include `AbilityRepositoryUser` and `getUserId`
   - Fixed `/abilities` endpoint to use `userAbilityRepository.getPublishedAbilities()` (no credential filtering for backward compatibility)
   - Modified `/public/abilities` endpoint to use credential filtering via `searchPublishedAbilities()`
   - Added comments explaining the filtering behavior

2. **[src/server/ability-repository-user.ts](../../src/server/ability-repository-user.ts)**
   - Updated `searchPublishedAbilities()` method to include credential filtering
   - Added logic to filter based on userId presence
   - Integrated with `hasCredentialsForDomains()` service

### Filtering Logic

```typescript
// Case 1: No userId (unauthenticated)
if (!userId) {
  return abilities.filter(a => !a.dynamicHeadersRequired);
}

// Case 2: userId provided (authenticated)
return abilities.filter(ability => {
  // Always include favorited abilities
  if (ability.isFavorite) return true;

  // Always include abilities without credential requirements
  if (!ability.dynamicHeadersRequired) return true;

  // Include only if user has credentials for this domain
  return credentialMap.get(ability.domain) === true;
});
```

### Credential Checking Flow

1. **Extract Domains**: Get unique domains from abilities requiring credentials
2. **Batch Check**: Use `hasCredentialsForDomains()` to check all domains in one query
3. **Filter**: Apply filtering rules based on credential availability

## Benefits

### User Experience
- Users only see abilities they can actually execute
- Reduces confusion and failed execution attempts
- Clearer expectations about what's available

### Security
- Prevents leaking information about abilities user can't access
- Aligns with principle of least privilege
- Maintains the existing security boundary

### Performance
- Batch credential checking minimizes database queries
- Credential map caching reduces redundant lookups
- Early filtering reduces data transfer

## API Behavior

### ~~GET `/abilities`~~ (REMOVED)

**This endpoint has been removed** due to security concerns:
- Allowed bulk extraction of all published abilities without credential filtering
- No search query requirement enabled data scraping
- Redundant with `/my/abilities` and `/public/abilities`

**Migration Path**:
- For personal abilities → Use `GET /my/abilities` (authenticated, with credential filtering)
- For global search → Use `GET /public/abilities?q=<query>` (with credential filtering)

### GET `/public/abilities` (With Credential Filtering)

This endpoint includes intelligent credential filtering:

#### Unauthenticated Requests

```bash
curl "https://agent.unbrowse.ai/public/abilities?q=github"
```

**Returns**: Only abilities that don't require authentication (e.g., public GitHub APIs)

#### Authenticated Requests

```bash
curl -H "Authorization: Bearer <api-key>" \
  "https://agent.unbrowse.ai/public/abilities?q=github"
```

**Returns**:
- Abilities user has GitHub credentials for
- Abilities that don't require credentials
- User's favorited abilities (regardless of credential status)

## Consistency with Other Endpoints

This implementation mirrors the filtering logic used in:
- `/my/abilities` - User's personal abilities with credential filtering
- `searchUserAbilities()` - Search user's abilities with credential filtering

All endpoints now use the same credential-based filtering approach for consistency.

## Edge Cases Handled

1. **Favorited Abilities**: Always included even without credentials (allows users to keep track of abilities they want to use later)
2. **Null/Undefined Domains**: Safely handled by credential checking service
3. **Empty Credential Sets**: Returns only non-credential-required abilities
4. **Mixed Results**: Properly combines global and personal ability searches

## Testing

### Test Case 1: Unauthenticated Search
```bash
# Should only return abilities without credential requirements
curl "https://agent.unbrowse.ai/public/abilities?q=test"
```

### Test Case 2: Authenticated Search (with credentials)
```bash
# Should return abilities for domains user has credentials for
curl -H "Authorization: Bearer <api-key>" \
  "https://agent.unbrowse.ai/public/abilities?q=test"
```

### Test Case 3: Authenticated Search (no credentials)
```bash
# Should return only non-credential-required abilities
curl -H "Authorization: Bearer <new-user-api-key>" \
  "https://agent.unbrowse.ai/public/abilities?q=test"
```

## Future Enhancements

1. **Cache Credential Maps**: Cache user credential domain lists to reduce DB queries
2. **Credential Suggestions**: Return suggestions for which credentials user needs
3. **Partial Match Filtering**: Show abilities where user has some but not all required credentials
4. **Domain Grouping**: Group results by domain and show credential status

## Related Documentation

- [Dynamic Headers Guide](./DYNAMIC_HEADERS_GUIDE.md)
- [Credential Service](../../src/server/credential-service.ts)
- [API Examples](../api-examples/abilities-api-reference.md)

## Migration Notes

### Deployment
1. Deploy updated `ability-repository-user.ts` and `routes/public.ts`
2. No database migrations required
3. Backward compatible - existing clients continue to work

### Breaking Changes
None - this is a filtering enhancement that only affects response content, not the API contract.

### Rollback Plan
If issues arise, revert to previous `AbilityRepositoryVector.searchPublishedAbilities()` call by reverting changes to `routes/public.ts`.
