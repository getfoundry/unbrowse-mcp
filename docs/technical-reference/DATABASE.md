# Database Setup and Migrations

This document explains the database architecture and migration system for the Reverse Engineer application.

## Architecture

The application uses a **dual-storage approach**:

### 1. Infraxa Vector DB (Required)
- **Purpose**: Semantic search and similarity matching
- **Storage**: Ability embeddings (3072-dimensional vectors from Gemini)
- **Configuration**: Via `VECTOR_DB_API` and `VECTOR_DB_TENANT` environment variables

### 2. PostgreSQL (Optional)
- **Purpose**: Relational data storage and backup
- **ORM**: Drizzle ORM
- **Schema**: Defined in [src/db/schema.ts](src/db/schema.ts)
- **Configuration**: Via `DATABASE_URL` environment variable

## Database Schema

### `abilities` Table

Mirrors the vector database for backup and relational queries:

```typescript
{
  ability_id: string (PK)
  vector_id: number
  ability_name: string
  service_name: string
  description: string
  embedding: jsonb (array of numbers)
  dynamic_header_keys: string[]
  dynamic_headers_required: boolean
  metadata: Record<string, any>
  created_at: timestamp
  updated_at: timestamp
}
```

## Migration System

### Automatic Migrations (Docker)

When running with Docker, migrations are handled automatically by [docker-entrypoint.sh](docker-entrypoint.sh):

1. **Startup sequence**:
   ```
   Container starts
   ↓
   Check if DATABASE_URL is set
   ↓
   Wait for PostgreSQL to be ready
   ↓
   Generate migrations from schema (if needed)
   ↓
   Apply migrations
   ↓
   Start Mastra application
   ```

2. **Migration files**: Stored in `./drizzle/` directory
3. **Logs**: Available via `docker-compose logs reverse-engineer`

### Manual Migration Management

#### Generate Migration

After modifying [src/db/schema.ts](src/db/schema.ts):

```bash
# Generate migration files
npx drizzle-kit generate

# This creates SQL files in ./drizzle/ folder
```

#### Apply Migrations

```bash
# Apply all pending migrations
npx drizzle-kit migrate

# Or use Drizzle Studio for visual management
npx drizzle-kit studio
```

#### View Migration Status

```bash
# Connect to PostgreSQL
psql $DATABASE_URL

# Check applied migrations
SELECT * FROM drizzle_migrations;
```

## Schema Modifications

### Adding a New Column

1. **Edit schema** ([src/db/schema.ts](src/db/schema.ts)):
```typescript
export const abilities = pgTable('abilities', {
  // ... existing columns ...
  new_field: text('new_field').notNull(),
});
```

2. **Generate migration**:
```bash
npx drizzle-kit generate
```

3. **Review migration** in `./drizzle/*.sql`

4. **Apply migration**:
```bash
# Local development
npx drizzle-kit migrate

# Docker (automatic on restart)
docker-compose restart reverse-engineer
```

### Creating a New Table

1. **Add to schema**:
```typescript
export const newTable = pgTable('new_table', {
  id: text('id').primaryKey(),
  // ... columns ...
});
```

2. **Generate and apply** (same steps as above)

## Development Workflow

### Local Development

```bash
# 1. Start PostgreSQL (via Docker Compose)
docker-compose up -d postgres

# 2. Set DATABASE_URL in .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reverse_engineer

# 3. Generate and apply migrations
npx drizzle-kit generate
npx drizzle-kit migrate

# 4. Start development server
pnpm dev
```

### Production Deployment

Migrations run automatically when using Docker:

```bash
# Build and deploy
docker-compose up -d --build

# Migrations apply automatically during container startup
# Check logs
docker-compose logs reverse-engineer | grep migration
```

## Troubleshooting

### Migration Fails

**Problem**: Migration SQL has errors

```bash
# 1. Check migration file
cat drizzle/<timestamp>_*.sql

# 2. Fix schema issues in src/db/schema.ts

# 3. Delete bad migration
rm drizzle/<timestamp>_*.sql

# 4. Regenerate
npx drizzle-kit generate
```

### Database Out of Sync

**Problem**: Schema doesn't match database

```bash
# Option 1: Reset database (dev only!)
docker-compose down -v
docker-compose up -d

# Option 2: Generate new migration
npx drizzle-kit generate
npx drizzle-kit migrate
```

### Connection Issues

**Problem**: Can't connect to PostgreSQL

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Test connection
psql postgresql://postgres:postgres@localhost:5432/reverse_engineer
```

### Missing Migration Files

**Problem**: No migrations exist but schema is defined

```bash
# Generate initial migrations
npx drizzle-kit generate

# Verify files created
ls -la drizzle/
```

## Drizzle Studio

Use Drizzle Studio for visual database management:

```bash
# Start Drizzle Studio
npx drizzle-kit studio

# Opens browser at https://local.drizzle.studio
# View tables, run queries, edit data
```

## Backup and Restore

### Backup PostgreSQL

```bash
# Full database dump
docker exec reverse-engineer-db pg_dump -U postgres reverse_engineer > backup.sql

# Compressed backup
docker exec reverse-engineer-db pg_dump -U postgres reverse_engineer | gzip > backup.sql.gz
```

### Restore PostgreSQL

```bash
# From SQL dump
cat backup.sql | docker exec -i reverse-engineer-db psql -U postgres -d reverse_engineer

# From compressed
gunzip -c backup.sql.gz | docker exec -i reverse-engineer-db psql -U postgres -d reverse_engineer
```

## Environment Variables

```bash
# Required for PostgreSQL
DATABASE_URL=postgresql://username:password@host:5432/database

# Optional: For docker-entrypoint.sh to wait for DB
DB_HOST=postgres  # or IP address
```

## Migration Best Practices

1. **Always generate migrations** - Don't write SQL manually
2. **Review before applying** - Check generated SQL files
3. **Test locally first** - Apply migrations in dev before production
4. **Backup before migrating** - In production, always backup first
5. **Version control migrations** - Commit migration files to git
6. **Never edit applied migrations** - Create new ones instead

## Resources

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Drizzle Kit Migrations](https://orm.drizzle.team/kit-docs/overview)
- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)
