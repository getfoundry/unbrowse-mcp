# Dual Storage Setup Guide

This guide will help you set up the dual storage system (Infraxa + PostgreSQL) for storing reverse-engineered API abilities.

## Quick Start

### Option 1: Infraxa Only (No PostgreSQL)

If you don't want to set up PostgreSQL, the system will work fine with just Infraxa:

```bash
# Just make sure these are in your .env
GOOGLE_GENERATIVE_AI_API_KEY=your-key
VECTOR_DB_API=https://dev-beta.infraxa.ai
VECTOR_DB_TENANT=reverse_engineer

# No DATABASE_URL needed
```

The system will automatically detect that PostgreSQL is not configured and skip it gracefully.

### Option 2: Full Dual Storage (Infraxa + PostgreSQL)

For the complete dual storage setup:

#### 1. Install PostgreSQL

**macOS:**
```bash
brew install postgresql@17
brew services start postgresql@17
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download from https://www.postgresql.org/download/windows/

#### 2. Create Database

```bash
# Create database
createdb reverse_engineer

# Or using psql
psql -U postgres -c "CREATE DATABASE reverse_engineer;"
```

#### 3. Configure Environment

Add to your `.env` file:

```bash
# Required
GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key
VECTOR_DB_API=https://dev-beta.infraxa.ai
VECTOR_DB_TENANT=reverse_engineer

# Optional - Add this for dual storage
DATABASE_URL=postgresql://username:password@localhost:5432/reverse_engineer
```

Replace:
- `username` with your PostgreSQL username (default: your system username)
- `password` with your PostgreSQL password (if any)
- `localhost:5432` with your PostgreSQL host and port

**Example for local development (no password):**
```bash
DATABASE_URL=postgresql://lekt9@localhost:5432/reverse_engineer
```

#### 4. Test the Setup

```bash
# Run the test script
node test-dual-storage.js
```

You should see:
```
=== Testing Dual Storage ===

PostgreSQL configured: true
DATABASE_URL: Set

--- Testing PostgreSQL Connection ---
✓ PostgreSQL connected and tables created

--- Creating Test Ability ---
Test ability ID: test-dual-storage-1234567890

--- Storing Ability ---
✓ Ability stored successfully
Vector ID: 123456789

--- Verifying PostgreSQL Storage ---
✓ Ability found in PostgreSQL
```

## What's Been Set Up

### New Files Created

1. **[src/db/schema.ts](src/db/schema.ts)** - Drizzle ORM schema for abilities table
2. **[src/db/client.ts](src/db/client.ts)** - PostgreSQL connection manager
3. **[drizzle.config.ts](drizzle.config.ts)** - Drizzle Kit configuration
4. **[test-dual-storage.js](test-dual-storage.js)** - Test script
5. **[DUAL_STORAGE.md](DUAL_STORAGE.md)** - Architecture documentation

### Modified Files

1. **[src/mastra/tools/vector-db-client.ts](src/mastra/tools/vector-db-client.ts:173-302)**
   - Added `storeInPostgres()` method
   - Modified `storeAbility()` to write to both databases

2. **[.env.example](.env.example:8-10)**
   - Added `DATABASE_URL` configuration

### Dependencies Added

```json
{
  "dependencies": {
    "drizzle-orm": "^0.44.6",
    "pg": "^8.16.3"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.5",
    "@types/pg": "^8.15.5"
  }
}
```

## How It Works

### Data Flow

```
API Request
    ↓
Generate Wrapper Tool
    ↓
Create Ability Vector
    ↓
VectorDBClient.storeAbility()
    ├─→ Infraxa Vector DB
    │   ✓ Stores embeddings (3072 dimensions)
    │   ✓ Enables semantic search
    │   ✓ Returns vector ID
    │
    └─→ PostgreSQL (if configured)
        ✓ Stores structured data
        ✓ Stores metadata
        ✓ Enables SQL queries
        ✓ Provides redundancy
```

### Resilience

- **PostgreSQL failures don't block Infraxa**
  - If PostgreSQL is down, abilities still store in Infraxa
  - Errors are logged but processing continues

- **PostgreSQL is optional**
  - System detects if `DATABASE_URL` is not set
  - Gracefully skips PostgreSQL storage
  - No errors thrown

- **Automatic migrations**
  - Tables created automatically on first use
  - No manual migration needed

## Database Schema

The `abilities` table in PostgreSQL stores:

```sql
CREATE TABLE abilities (
  ability_id TEXT PRIMARY KEY,
  vector_id INTEGER NOT NULL,
  ability_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  description TEXT NOT NULL,
  embedding JSONB NOT NULL,              -- 3072-dimension array
  dynamic_header_keys JSONB DEFAULT '[]',
  dynamic_headers_required BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_abilities_service_name ON abilities(service_name);
CREATE INDEX idx_abilities_dynamic_headers ON abilities(dynamic_headers_required);
```

## Querying PostgreSQL

### Using Drizzle ORM

```typescript
import { getDatabaseClient } from './src/db/client.js';
import { abilities } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

const dbClient = getDatabaseClient();
await dbClient.connect();
const db = dbClient.getDb();

// Get all abilities
const all = await db.select().from(abilities);

// Filter by service
const github = await db.select().from(abilities)
  .where(eq(abilities.service_name, 'github'));

// Get only public abilities
const publicOnly = await db.select().from(abilities)
  .where(eq(abilities.dynamic_headers_required, false));
```

### Using Raw SQL

```bash
# Connect to database
psql reverse_engineer

# View all abilities
SELECT ability_id, ability_name, service_name, dynamic_headers_required
FROM abilities
ORDER BY created_at DESC;

# Count by service
SELECT service_name, COUNT(*) as count
FROM abilities
GROUP BY service_name;

# Find abilities with authentication
SELECT ability_id, ability_name
FROM abilities
WHERE dynamic_headers_required = true;
```

## Drizzle Kit Commands

```bash
# Generate migration files
pnpm drizzle-kit generate

# Push schema changes to database
pnpm drizzle-kit push

# Open Drizzle Studio (database GUI)
pnpm drizzle-kit studio
```

## Monitoring Logs

Watch for these log messages:

```
[VectorDB] Storing ability: {name}
[VectorDB] Generated vector ID: {id}
[VectorDB] Successfully stored ability in Infraxa
[DB] PostgreSQL configured: true/false
[DB] Storing ability in PostgreSQL: {id}
[DB] Successfully stored ability in PostgreSQL
```

## Troubleshooting

### PostgreSQL Connection Issues

**Error: "ECONNREFUSED"**
```bash
# Check if PostgreSQL is running
pg_isready

# Start PostgreSQL (macOS)
brew services start postgresql@17

# Start PostgreSQL (Linux)
sudo systemctl start postgresql
```

**Error: "role does not exist"**
```bash
# Create user
createuser -s your-username
```

**Error: "database does not exist"**
```bash
# Create database
createdb reverse_engineer
```

### Build Errors

**Error: Cannot find module**
```bash
# Reinstall dependencies
pnpm install
```

**Error: TypeScript errors**
```bash
# Check build
pnpm run build
```

### Test Script Fails

```bash
# Make sure environment is set
cat .env

# Check if DATABASE_URL is set
echo $DATABASE_URL

# Run with explicit env
DATABASE_URL=postgresql://localhost/reverse_engineer node test-dual-storage.js
```

## Next Steps

1. **Test with Real Data**
   - Run HAR ingestion with PostgreSQL enabled
   - Verify abilities are stored in both databases

2. **Query Performance**
   - Create additional indexes as needed
   - Monitor query performance

3. **Backups**
   - Set up automated PostgreSQL backups
   - Document recovery procedures

4. **Monitoring**
   - Add metrics for dual storage success rate
   - Track PostgreSQL vs Infraxa latency

## Resources

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [DUAL_STORAGE.md](DUAL_STORAGE.md) - Architecture details
- [src/db/schema.ts](src/db/schema.ts) - Database schema
