# Unbrowse MCP Enhancements

This document describes the enhancements made to implement dependency order tracking, domain-based filtering, and automatic credential expiration handling.

## Overview of Changes

The Unbrowse MCP server has been enhanced with three major features:

1. **Dependency Order Tracking** - Shows which abilities must be called in sequence
2. **Domain-Based Search** - Filter abilities by available cookie domains
3. **401+ Error Handling** - Automatically mark credentials as expired and suggest login abilities

## Files Created/Modified

### New Files

1. **`src/mock-endpoints-enhanced.ts`** - Enhanced API endpoint implementations
   - Added `dependencyOrder` to `IndexedAbility` interface
   - Added `expired` and `expiredAt` to `CredentialEntry` interface
   - Implemented `extractDomain()` to parse domains from credential keys
   - Implemented `markCredentialsExpired()` to handle 401+ responses
   - Implemented `findLoginAbilities()` to detect authentication endpoints
   - Implemented `formatAbilityDescription()` to show dependency order in descriptions
   - Enhanced `listAbilities()` with domain filtering and expired credential checking
   - Added `getAvailableDomains()` helper

2. **`src/wrapper-executor-enhanced.ts`** - Enhanced wrapper execution engine
   - Added `credentialsExpired` and `loginAbilities` to result interface
   - Enhanced `executeWrapper()` to detect 401+ status codes
   - On 401+: marks credentials expired, finds login abilities, returns suggestions
   - Enhanced `getWrapperMetadata()` to include dependency order and missing dependencies

3. **`ENHANCEMENTS.md`** - This documentation file

### Modified Files

1. **`src/index.ts`** - Updated MCP server
   - Imported enhanced modules instead of original
   - Updated `list_abilities` tool:
     - Added `filterByDomains` parameter
     - Shows `availableDomains` in response
     - Formats descriptions with dependency order info
   - Updated `execute_ability` tool:
     - Returns `credentialsExpired` flag
     - Returns `loginAbilities` array on 401+
     - Enhanced description to mention auto-expiration
   - Updated `get_ability_info` tool:
     - Shows formatted dependency order information
     - Displays missing dependencies

2. **`README.md`** - Updated documentation
   - Added new features to overview
   - Updated tool examples to show new fields
   - Added "Enhanced Features" section with detailed explanations
   - Updated example outputs to show dependency order and 401 handling

## Feature Details

### 1. Dependency Order Tracking

#### Data Model

Each ability in wrapper-storage includes:

```json
{
  "input": {
    "dependency_order": ["ability-id-1", "ability-id-2"]
  },
  "dependencies": {
    "resolved": [],
    "missing": [
      {
        "abilityId": "ability-id-1",
        "abilityName": "ability_name_1",
        "reference": "ability_name_1"
      }
    ],
    "unresolved": []
  }
}
```

#### Implementation

The `formatAbilityDescription()` function automatically appends dependency information to descriptions:

```typescript
"**Dependency Order:** This ability must be called AFTER: `dep-1` → `dep-2`
Call these abilities in sequence before executing this one.

**⚠️ Missing Dependencies:**
- dep-1 (dep_name_1) - Referenced as dep_name_1"
```

#### Usage Example

```javascript
// 1. Check dependencies
get_ability_info({ abilityId: "get-hedgemony-plus-news-archive" })
// Shows: dependencyOrder: ["get-hedgemony-plus"]

// 2. Execute in order
execute_ability({ abilityId: "get-hedgemony-plus" })
execute_ability({ abilityId: "get-hedgemony-plus-news-archive" })
```

### 2. Domain-Based Filtering

#### How It Works

1. Credential keys follow the format: `domain::header-name` (e.g., `www.hedgemony.fund::cookie`)
2. The `extractDomain()` function splits on `::` to get the domain part
3. When `filterByDomains: true`, abilities are filtered to only those requiring credentials from available domains
4. The response includes `availableDomains` array showing which domains have valid (non-expired) credentials

#### Implementation

```typescript
function extractDomain(credentialKey: string): string {
  return credentialKey.split('::')[0];
}

// Filter abilities by domain overlap
const userDomains = new Set(validCreds.map(extractDomain));
const abilityDomains = new Set(ability.dynamicHeaderKeys.map(extractDomain));
const matchesDomain = !filterByDomains || 
  Array.from(abilityDomains).some(domain => userDomains.has(domain));
```

#### Usage Example

```javascript
// Get all abilities for my domains only
list_abilities({
  userCredentials: ["www.hedgemony.fund::cookie", "www.wom.fun::api-key"],
  filterByDomains: true
})

// Returns:
{
  "availableDomains": ["www.hedgemony.fund", "www.wom.fun"],
  "abilities": [/* only abilities for these domains */]
}
```

### 3. 401+ Error Handling & Credential Expiration

#### Flow

```
1. Execute ability with credentials
   ↓
2. API returns 401 Unauthorized
   ↓
3. Wrapper executor detects statusCode >= 401
   ↓
4. Mark all credentials for service as expired
   ↓
5. Search for login abilities for service
   ↓
6. Return error with login suggestions
```

#### Implementation

In `wrapper-executor-enhanced.ts`:

```typescript
if (statusCode >= 401 && statusCode < 500) {
  // Mark credentials as expired
  markCredentialsExpired(service_name);
  
  // Find login abilities
  const loginAbilities = await findLoginAbilities(service_name);
  
  return {
    success: false,
    statusCode,
    error: `Authentication failed (${statusCode}). Credentials marked as expired.`,
    credentialsExpired: true,
    loginAbilities: loginAbilities.map(a => ({
      id: a.abilityId,
      name: a.abilityName,
      description: a.description,
    })),
    executedAt,
  };
}
```

#### Login Ability Detection

The `findLoginAbilities()` function finds authentication endpoints by:

1. Matching service name
2. Filtering to abilities that don't require credentials (they're the first step)
3. Searching for keywords: "login", "auth", "signin", "authenticate"

```typescript
export async function findLoginAbilities(serviceName: string): Promise<IndexedAbility[]> {
  const allAbilities = await listAbilities([], false);
  
  return allAbilities.filter(ability => {
    const matchesService = ability.serviceName === serviceName;
    const noCredsRequired = !ability.requiresDynamicHeaders;
    const isAuthRelated = 
      ability.abilityName.toLowerCase().includes('login') ||
      ability.abilityName.toLowerCase().includes('auth') ||
      ability.abilityName.toLowerCase().includes('signin') ||
      ability.description.toLowerCase().includes('login') ||
      ability.description.toLowerCase().includes('authenticate');
    
    return matchesService && noCredsRequired && isAuthRelated;
  });
}
```

#### Usage Example

```javascript
// Attempt to use ability with expired credentials
execute_ability({ abilityId: "get-hedgemony-stats-simple" })

// Response:
{
  "success": false,
  "statusCode": 401,
  "credentialsExpired": true,
  "loginAbilities": [
    {
      "id": "hedgemony-login",
      "name": "hedgemony_fund_login",
      "description": "Login to Hedgemony Fund..."
    }
  ],
  "error": "Authentication failed (401). Credentials marked as expired. Please authenticate using one of these login abilities: hedgemony-login"
}

// Re-authenticate using suggested ability
execute_ability({ 
  abilityId: "hedgemony-login", 
  payload: { username: "user", password: "pass" } 
})

// Store new credentials
store_credentials({
  serviceName: "hedgemony-fund",
  credentialKey: "www.hedgemony.fund::cookie",
  credentialValue: "new-session-cookie-value"
})

// Retry original request
execute_ability({ abilityId: "get-hedgemony-stats-simple" })
```

## Technical Details

### Credential Expiration Tracking

The `CredentialEntry` interface was extended:

```typescript
interface CredentialEntry {
  key: string;
  encryptedValue: string;
  serviceName: string;
  createdAt: string;
  expired?: boolean;      // NEW: Marked true on 401+
  expiredAt?: string;     // NEW: Timestamp when marked expired
}
```

Expired credentials are:
- Excluded from credential retrieval in `getCookieJar()`
- Filtered out when checking user credentials in `listAbilities()`
- Can be replaced by storing new credentials with the same key

### Domain Extraction

Domains are extracted from credential keys using a simple split:

```typescript
function extractDomain(credentialKey: string): string {
  return credentialKey.split('::')[0];
}

// Examples:
extractDomain("www.hedgemony.fund::cookie")        // "www.hedgemony.fund"
extractDomain("api.example.com::authorization")    // "api.example.com"
```

### Dependency Order in Tool Descriptions

Tool descriptions are automatically enhanced with dependency information:

```typescript
export function formatAbilityDescription(ability: IndexedAbility): string {
  let desc = ability.description;
  
  if (ability.dependencyOrder && ability.dependencyOrder.length > 0) {
    desc += `\n\n**Dependency Order:** This ability must be called AFTER: ${
      ability.dependencyOrder.map(depId => `\`${depId}\``).join(' → ')
    }`;
    desc += `\nCall these abilities in sequence before executing this one.`;
  }
  
  if (ability.dependencies?.missing && ability.dependencies.missing.length > 0) {
    desc += `\n\n**⚠️ Missing Dependencies:**`;
    ability.dependencies.missing.forEach(dep => {
      desc += `\n- ${dep.abilityId} (${dep.abilityName}) - Referenced as ${dep.reference}`;
    });
  }
  
  if (ability.requiresDynamicHeaders) {
    desc += `\n\n**Required Credentials:** ${ability.dynamicHeaderKeys.join(', ')}`;
  }
  
  return desc;
}
```

## Benefits

### For Agents

1. **Smarter Execution** - Know which abilities to call in what order
2. **Better Error Recovery** - Automatic suggestions for re-authentication
3. **Scoped Discovery** - Find only abilities relevant to available credentials
4. **Clear Requirements** - See exactly what credentials and dependencies are needed

### For Users

1. **Automatic Credential Management** - No manual credential expiration tracking
2. **Guided Re-authentication** - System tells you which login ability to use
3. **Domain Organization** - Filter abilities by the services you have access to
4. **Transparent Dependencies** - Understand ability relationships before execution

### For Developers

1. **Rich Metadata** - Comprehensive information about each ability
2. **Dependency Validation** - Prevent execution of abilities with missing prerequisites
3. **Credential Lifecycle** - Track when credentials expire and need refresh
4. **Login Detection** - Automatically find authentication endpoints

## Migration Notes

### From Original to Enhanced

If you're using the original `mock-endpoints.ts` and `wrapper-executor.ts`, update imports in `src/index.ts`:

```typescript
// Before
import { listAbilities, getCookieJar, setCookieJar } from "./mock-endpoints.js";
import { executeWrapper, getWrapperMetadata } from "./wrapper-executor.js";

// After
import { 
  listAbilities, 
  getCookieJar, 
  setCookieJar,
  formatAbilityDescription,
  getAvailableDomains,
  findLoginAbilities,
  markCredentialsExpired
} from "./mock-endpoints-enhanced.js";
import { 
  executeWrapper, 
  getWrapperMetadata 
} from "./wrapper-executor-enhanced.js";
```

### API Changes

The tool interfaces remain backward compatible. New fields are optional:

- `list_abilities`: `filterByDomains` parameter is optional (defaults to `false`)
- `execute_ability`: New response fields only appear when relevant (`credentialsExpired`, `loginAbilities`)
- All abilities now include `dependencyOrder` and `missingDependencies` in responses

## Future Enhancements

Potential improvements for the future:

1. **Automatic Dependency Execution** - Option to auto-execute prerequisite abilities
2. **Credential Refresh Workflows** - Automatic re-authentication on 401 with stored credentials
3. **Dependency Graph Visualization** - Visual representation of ability relationships
4. **Smart Retry Logic** - Exponential backoff for transient auth failures
5. **Credential Expiry Prediction** - Proactive re-authentication before credentials expire
6. **Multi-Domain Authentication** - Handle cross-domain authentication flows
7. **Dependency Caching** - Cache results of dependency executions to avoid redundant calls

## Summary

These enhancements transform the Unbrowse MCP from a simple ability executor into an intelligent agent assistant that:

- **Understands relationships** between abilities via dependency order
- **Manages credential lifecycles** with automatic expiration detection
- **Guides authentication** by suggesting login abilities
- **Filters intelligently** based on available credential domains
- **Provides rich context** through enhanced tool descriptions

The system is now production-ready for complex multi-step workflows that require sequential ability execution and credential management.
