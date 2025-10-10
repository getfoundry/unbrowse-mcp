# Deployment Issues and Solutions

## Current Issue: wrapper-storage Not Included in Build

### Problem
The Smithery build process bundles the TypeScript code into a single `.smithery/index.cjs` file, but **does not include** the `src/wrapper-storage` directory containing the JSON ability definitions. This causes the server to fail initialization with a 500 error.

### Error Message
```
HTTP POST → 500 Internal Server Error
{"jsonrpc":"2.0","error":{"code":-32603,"message":"Error initializing server."},"id":null}
```

### Root Cause
The code attempts to read JSON files from `src/wrapper-storage` at runtime using:
```typescript
const WRAPPER_STORAGE_PATH = join(process.cwd(), "src", "wrapper-storage");
const files = await readdir(WRAPPER_STORAGE_PATH);
```

However, in the bundled Docker environment:
- Only the bundled JavaScript file exists
- The `src/wrapper-storage` directory is not copied to the container
- File system operations fail during server initialization

### Current Workaround
Error handling has been added to prevent crashes:
- Server will start even if wrapper-storage is missing
- Logs clear error messages about missing directory
- Dynamic ability registration is skipped
- Static tools (list_abilities, get_credentials, execute_ability) still work

### Solutions

#### Option 1: Include wrapper-storage in Docker Build
Add the directory to the Docker image. This requires modifying the Smithery build process or Dockerfile.

#### Option 2: Bundle JSON Data into Code (Recommended)
Create a build step that imports all JSON files and bundles them as JavaScript objects:

```typescript
// src/wrapper-storage/index.ts
import ability1 from './hedgemony-fund_get-binance-klines_1760074439031.json';
import ability2 from './hedgemony-fund_get-binance-klines_1760075058075.json';
// ... import all JSON files

export const abilities = [ability1, ability2, /* ... */];
```

Then update `mock-endpoints-enhanced.ts`:
```typescript
import { abilities as WRAPPER_DATA } from './wrapper-storage/index.js';

export async function listAbilities(...) {
  // Use WRAPPER_DATA instead of reading files
  const abilities = WRAPPER_DATA.map(data => ({
    abilityId: data.input.ability_id,
    // ... transform data
  }));
}
```

#### Option 3: Load from External API
Fetch ability definitions from a remote API or database at runtime instead of reading local files.

### Testing Changes
To test locally:
```bash
npm run dev
```

To test the bundled version:
```bash
npx smithery build
node .smithery/index.cjs
```

### Recommended Next Steps
1. Implement Option 2 (bundle JSON data into code)
2. Add a build script to auto-generate the wrapper-storage index
3. Update CI/CD to regenerate the index when JSON files change
4. Remove file system dependencies from runtime code
