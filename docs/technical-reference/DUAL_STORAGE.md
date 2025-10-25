# Dual Storage Architecture

This system now supports **dual storage** for abilities, storing data in both:
1. **Infraxa Vector Database** (primary) - for semantic search
2. **PostgreSQL** (secondary) - for structured queries and data redundancy

## Architecture Overview

### Data Flow
```
Ability → VectorDBClient.storeAbility()
  ├─> Infraxa Vector DB (with embeddings)
  └─> PostgreSQL (with metadata)
```

### Why Dual Storage?

1. **Infraxa Vector DB**: Optimized for semantic similarity search using embeddings
2. **PostgreSQL**: Provides:
   - Structured queries (filter by service, dynamic headers, etc.)
   - Data redundancy and backup
   - Relational capabilities for future features
   - Standard SQL interface

## Setup

### 1. Install Dependencies

Already installed:
```bash
pnpm add drizzle-orm pg
pnpm add -D drizzle-kit @types/pg
```

### 2. Configure PostgreSQL

Add to your `.env` file:
```bash
DATABASE_URL=postgresql://username:password@localhost:5432/reverse_engineer
```

**Note**: PostgreSQL is optional. If `DATABASE_URL` is not set, the system will only use Infraxa.

### 3. Create Database

```bash
# Create the database
createdb reverse_engineer

# Or using psql
psql -U postgres -c "CREATE DATABASE reverse_engineer;"
```

### 4. Run Migrations

The system automatically creates tables on first use, but you can also use Drizzle Kit:

```bash
# Generate migration files
pnpm drizzle-kit generate

# Push schema to database
pnpm drizzle-kit push
```

## Database Schema

### Abilities Table

| Column | Type | Description |
|--------|------|-------------|
| `ability_id` | TEXT (PK) | Unique ability identifier |
| `vector_id` | INTEGER | Infraxa vector DB ID |
| `ability_name` | TEXT | Display name |
| `service_name` | TEXT | Service namespace |
| `description` | TEXT | Ability description |
| `embedding` | JSONB | 3072-dimension embedding vector |
| `dynamic_header_keys` | JSONB | Array of dynamic headers |
| `dynamic_headers_required` | BOOLEAN | Whether auth is needed |
| `metadata` | JSONB | Additional metadata |
| `created_at` | TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | Last update time |

### Indexes

- `idx_abilities_service_name`: Fast service filtering
- `idx_abilities_dynamic_headers`: Filter by auth requirements

## Usage

### Storing Abilities

The `VectorDBClient` automatically handles dual storage:

```typescript
import { getVectorDBClient } from './mastra/tools/vector-db-client.js';

const client = getVectorDBClient();

await client.storeAbility({
  ability_id: 'github-get-user',
  ability_name: 'Get GitHub User',
  service_name: 'github',
  description: 'Fetch user profile from GitHub',
  embedding: [...], // 3072 dimensions
  metadata: {
    dynamic_header_keys: ['api.github.com::authorization'],
    // ... other metadata
  },
});
```

### Querying PostgreSQL

```typescript
import { getDatabaseClient } from './db/client.js';
import { abilities } from './db/schema.js';
import { eq } from 'drizzle-orm';

const dbClient = getDatabaseClient();
await dbClient.connect();
const db = dbClient.getDb();

// Get all abilities for a service
const githubAbilities = await db
  .select()
  .from(abilities)
  .where(eq(abilities.service_name, 'github'));

// Get only public abilities (no auth required)
const publicAbilities = await db
  .select()
  .from(abilities)
  .where(eq(abilities.dynamic_headers_required, false));
```

## Error Handling

The system is designed to be resilient:

1. **PostgreSQL failures don't block Infraxa storage**
   - If PostgreSQL is down, abilities still store in Infraxa
   - Errors are logged but not thrown

2. **Optional PostgreSQL**
   - If `DATABASE_URL` is not configured, system runs normally
   - Only Infraxa storage is used

3. **Automatic retries and migrations**
   - Tables are created automatically on first use
   - Connection pooling with automatic reconnection

## Monitoring

The system provides detailed logging:

```
[VectorDB] Storing ability: Get GitHub User
[VectorDB] Generated vector ID: 123456789
[VectorDB] Successfully stored ability in Infraxa
[DB] Storing ability in PostgreSQL: github-get-user
[DB] Successfully stored ability in PostgreSQL
```

## Maintenance

### Backup PostgreSQL

```bash
# Backup
pg_dump reverse_engineer > backup.sql

# Restore
psql reverse_engineer < backup.sql
```

### View Data

```bash
# Connect to database
psql reverse_engineer

# View abilities
SELECT ability_id, ability_name, service_name, dynamic_headers_required
FROM abilities
ORDER BY created_at DESC;
```

### Sync from Infraxa to PostgreSQL

If you need to rebuild PostgreSQL from Infraxa:

```typescript
// Future feature: sync script
// Fetch all abilities from Infraxa and re-store them
```

## Future Enhancements

1. **pgvector Extension**
   - Store embeddings as native vector type instead of JSONB
   - Enable PostgreSQL-based semantic search as backup

2. **Sync Tools**
   - Bidirectional sync between Infraxa and PostgreSQL
   - Automatic conflict resolution

3. **Analytics**
   - Query PostgreSQL for usage statistics
   - Service-level metrics and dashboards

4. **Caching Layer**
   - Use PostgreSQL as cache for frequently accessed abilities
   - Reduce Infraxa API calls

## Files

- `src/db/schema.ts` - Drizzle schema definition
- `src/db/client.ts` - PostgreSQL client wrapper
- `src/mastra/tools/vector-db-client.ts` - Updated with dual storage
- `drizzle.config.ts` - Drizzle Kit configuration
