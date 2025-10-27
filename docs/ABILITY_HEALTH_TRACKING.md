# Ability Health Tracking System

## Overview

The Ability Health Tracking system monitors the reliability and success rate of API abilities based on their execution results. Abilities with poor health are deprioritized in search results, and those with critically low health are marked as defunct.

## Success Criteria

The system categorizes HTTP status codes as follows:

- **Success (200-399)**: Includes successful responses and redirects
- **Neutral (401, 403)**: Authentication/authorization failures - not counted against health as these are credential issues, not endpoint problems
- **Failure (400, 404, 405, 500+)**: Bad requests, not found, server errors - counted as failures

## Database Schema Changes

### user_abilities Table (Modified)

Added health tracking columns:

```sql
health_score              numeric(5,2) DEFAULT 100.00 NOT NULL  -- 0-100 score
total_executions          integer DEFAULT 0 NOT NULL
successful_executions     integer DEFAULT 0 NOT NULL
last_execution_at         timestamp
is_defunct                boolean DEFAULT false NOT NULL
```

Indexes:
- `idx_user_abilities_defunct` on `is_defunct`
- `idx_user_abilities_health_score` on `health_score`

### ability_usage Table (Modified)

Added status code tracking:

```sql
status_code              integer  -- HTTP status code from execution
```

### ability_health_history Table (New)

Tracks historical health snapshots for trending and analytics:

```sql
history_id                text PRIMARY KEY
user_ability_id           text NOT NULL (FK to user_abilities)
health_score              numeric(5,2) NOT NULL
total_executions          integer NOT NULL
successful_executions     integer NOT NULL
snapshot_at               timestamp DEFAULT now() NOT NULL
metadata                  jsonb DEFAULT '{}'
```

Indexes:
- `idx_ability_health_history_ability_id` on `user_ability_id`
- `idx_ability_health_history_snapshot_at` on `snapshot_at`

## Health Calculation

### Configuration

```typescript
const HEALTH_CONFIG = {
  MIN_EXECUTIONS_FOR_DEFUNCT: 20,    // Minimum executions before marking as defunct
  DEFUNCT_THRESHOLD: 20,              // Health score below this = defunct
  SNAPSHOT_INTERVAL: 10,              // Create history snapshot every N executions
};
```

### Algorithm

**Health Score Formula:**
```
health_score = (successful_executions / total_executions) * 100
```

Where:
- `total_executions` excludes neutral status codes (401, 403)
- `successful_executions` counts 200-399 responses
- New abilities start at 100 health score

**Defunct Marking:**
An ability is marked defunct when:
```
total_executions >= 20 AND health_score < 20
```

This prevents premature marking of new abilities while ensuring consistent failures result in defunct status.

## API Endpoints

### Get Ability Health

```
GET /my/abilities/:abilityId/health
```

Returns detailed health information including:
- Current health score
- Total/successful execution counts
- Success rate percentage
- Defunct status
- Historical health snapshots (last 20)

**Response:**
```json
{
  "success": true,
  "health": {
    "abilityId": "...",
    "abilityName": "...",
    "currentScore": 85.5,
    "isDefunct": false,
    "totalExecutions": 45,
    "successfulExecutions": 38,
    "successRate": "84.4%",
    "lastExecutionAt": "2025-10-27T15:30:00Z",
    "history": [
      {
        "healthScore": 85.5,
        "totalExecutions": 45,
        "successfulExecutions": 38,
        "snapshotAt": "2025-10-27T15:30:00Z"
      }
    ]
  }
}
```

### Get Defunct Abilities

```
GET /analytics/health/defunct
```

Lists all abilities marked as defunct for the authenticated user.

**Response:**
```json
{
  "success": true,
  "count": 3,
  "defunct": [
    {
      "userAbilityId": "...",
      "abilityId": "...",
      "abilityName": "Get User Profile",
      "serviceName": "old-api",
      "domain": "api.old-service.com",
      "healthScore": 15.0,
      "totalExecutions": 25,
      "successfulExecutions": 3,
      "successRate": "12.0%",
      "lastExecutionAt": "2025-10-27T10:00:00Z",
      "markedDefunctAt": "2025-10-27T10:00:00Z"
    }
  ]
}
```

### Get Low Health Abilities

```
GET /analytics/health/low?threshold=50
```

Returns abilities with health scores below the threshold (default: 50).

**Response:**
```json
{
  "success": true,
  "threshold": 50,
  "count": 5,
  "abilities": [
    {
      "userAbilityId": "...",
      "healthScore": 45.0,
      "successRate": "45.0%",
      ...
    }
  ]
}
```

### Reset Ability Health

```
POST /my/abilities/:abilityId/health/reset
```

Resets an ability's health to default values (100 score, 0 executions). Useful for testing or after fixing endpoint issues.

**Response:**
```json
{
  "success": true,
  "message": "Health reset for ability: Get User Profile",
  "resetTo": {
    "healthScore": 100,
    "totalExecutions": 0,
    "successfulExecutions": 0,
    "isDefunct": false
  }
}
```

## Execution Integration

### Health Updates

After each ability execution:

1. **Status Code Check**:
   - If 401/403: Skip health update (neutral)
   - Otherwise: Proceed with update

2. **Counter Updates**:
   - Increment `total_executions`
   - If success (200-399): Increment `successful_executions`

3. **Score Calculation**:
   - Recalculate health score
   - Check defunct threshold

4. **History Snapshot**:
   - Every 10th execution: Create history snapshot

5. **Response Enhancement**:
   - Include health metadata in execution response

### Execution Response Format

```json
{
  "success": true,
  "result": {
    "statusCode": 200,
    "body": {...},
    "executedAt": "2025-10-27T15:30:00Z",
    "executionTimeMs": 250
  },
  "health": {
    "score": 92.5,
    "totalExecutions": 40,
    "successRate": "92.5%"
  }
}
```

### Defunct Ability Execution

Attempting to execute a defunct ability returns:

```json
{
  "success": false,
  "error": "This ability has been marked as defunct due to repeated failures. Please search for an alternative.",
  "defunct": true,
  "healthScore": 15.0,
  "totalExecutions": 25,
  "successRate": "12.0%"
}
```

**HTTP Status:** 410 Gone

## Search Integration

### Defunct Filtering

All search methods automatically filter out defunct abilities:

- `searchUserAbilities()`
- `searchPublishedAbilities()`
- `getUserAbilities()`

### Health-Based Ranking

Search results are re-sorted by health score after vector similarity ranking:

```typescript
// After credential filtering
const healthSortedAbilities = filteredAbilities.sort((a, b) => {
  const healthA = parseFloat(a.healthScore as string);
  const healthB = parseFloat(b.healthScore as string);
  return healthB - healthA; // Higher scores first
});
```

This ensures:
1. Vector similarity determines initial relevance
2. Health score re-ranks similar abilities
3. Healthier abilities appear first among equally relevant results

## Service Functions

### Core Functions

#### `updateAbilityHealth(userAbilityId, statusCode, executionTime?)`

Updates health after execution. Returns new health state.

#### `calculateHealthScore(successfulExecutions, totalExecutions)`

Calculates 0-100 health score from counters.

#### `isSuccessStatus(statusCode)` / `isNeutralStatus(statusCode)`

Status code classification helpers.

#### `getAbilityHealthHistory(userAbilityId, limit?)`

Retrieves historical health snapshots.

#### `getUserDefunctAbilities(userId)`

Gets all defunct abilities for a user.

#### `getAbilitiesWithLowHealth(userId, threshold?)`

Finds abilities below health threshold.

#### `resetAbilityHealth(userAbilityId)`

Resets health to defaults.

### Health Multiplier (Future Enhancement)

Function available for applying health-based score adjustments:

```typescript
function applyHealthMultiplier(baseScore: number, healthScore: number): number {
  const multiplier = healthScore / 100; // 0.00 to 1.00
  return baseScore * multiplier;
}
```

Currently, we use simple sorting. This function can be integrated later for more nuanced ranking that combines vector similarity with health.

## Migration

To apply the schema changes:

```bash
pnpm db:migrate
```

Or to push directly to the database:

```bash
pnpm db:push
```

**Migration File:** `drizzle/0006_parallel_the_twelve.sql`

The migration:
1. Creates `ability_health_history` table
2. Adds health columns to `user_abilities`
3. Adds `status_code` to `ability_usage`
4. Creates indexes for performance

**⚠️ Important:** All existing abilities will start with:
- `health_score = 100.00`
- `total_executions = 0`
- `successful_executions = 0`
- `is_defunct = false`

## Monitoring and Analytics

### Key Metrics

1. **Defunct Rate**: Percentage of abilities marked defunct
2. **Average Health Score**: Across all abilities
3. **Low Health Count**: Abilities below 50 score
4. **Execution Success Rate**: Overall platform success rate

### Dashboard Queries

**Get platform-wide health metrics:**
```sql
SELECT
  COUNT(*) as total_abilities,
  COUNT(*) FILTER (WHERE is_defunct) as defunct_count,
  AVG(health_score) as avg_health_score,
  COUNT(*) FILTER (WHERE health_score < 50 AND NOT is_defunct) as low_health_count
FROM user_abilities
WHERE is_published = true;
```

**Top failing abilities:**
```sql
SELECT
  ability_name,
  service_name,
  domain,
  health_score,
  total_executions,
  successful_executions,
  ROUND((successful_executions::numeric / NULLIF(total_executions, 0) * 100), 1) as success_rate
FROM user_abilities
WHERE total_executions >= 10
  AND NOT is_defunct
ORDER BY health_score ASC
LIMIT 20;
```

## Best Practices

### For Users

1. **Monitor Health**: Check `/analytics/health/low` regularly
2. **Reset After Fixes**: Use health reset after fixing credential or API issues
3. **Search Alternatives**: When an ability is defunct, search for alternatives
4. **Favorite Important Abilities**: Favorited abilities remain accessible even with low health

### For Developers

1. **Health Snapshots**: Every 10 executions creates a snapshot for analytics
2. **Neutral Errors**: 401/403 don't affect health - credential issues are user problems
3. **Defunct Threshold**: Requires 20+ executions to prevent false positives
4. **Performance**: Indexes on `is_defunct` and `health_score` optimize queries

## Future Enhancements

### Planned Features

1. **Exponential Decay**: Weight recent executions more heavily
   ```typescript
   // In calculateHealthScore()
   // Apply exponential decay: older failures matter less
   const recentWindow = Math.min(totalExecutions, RECENT_WINDOW);
   const decayFactor = DECAY_FACTOR;
   ```

2. **Auto-Recovery**: Automatically remove defunct status after sustained success
   ```typescript
   // If 10 consecutive successes after defunct
   if (isDefunct && recentSuccessStreak >= 10) {
     markAsActive(abilityId);
   }
   ```

3. **Health Alerts**: Notify users when abilities drop below thresholds
   - Email/webhook when health < 30
   - Dashboard notifications for low health

4. **Trending Analysis**: Track health trends over time
   - Declining health rate
   - Time to defunct prediction

5. **Vector DB Sync**: Periodically sync health scores to vector DB attributes
   - Background job to update Infraxa attributes
   - Enable health-based filtering at vector search time

## Troubleshooting

### Common Issues

**Q: Why is my ability marked defunct?**

A: Check the health details (`/my/abilities/:id/health`). An ability becomes defunct when:
- It has been executed at least 20 times
- Health score is below 20 (< 20% success rate)

**Q: Can I recover a defunct ability?**

A: Yes, two options:
1. Fix the underlying issue, then reset health: `POST /my/abilities/:id/health/reset`
2. If the endpoint is permanently broken, search for and use an alternative ability

**Q: Why don't 401 errors affect health?**

A: 401 (Unauthorized) and 403 (Forbidden) indicate credential problems, not endpoint problems. These are user issues, not API failures.

**Q: How often are health snapshots created?**

A: Every 10 executions. You can check the full history at `/my/abilities/:id/health`.

## Architecture Decisions

### Why Filter Defunct Instead of Delete?

- **Audit Trail**: Maintains execution history
- **Recovery**: Allows health reset if endpoint is fixed
- **Analytics**: Useful for understanding why abilities fail

### Why 20 Execution Minimum?

Prevents premature defunct marking:
- New abilities need time to prove reliability
- Temporary API issues shouldn't permanently mark abilities
- 20 executions provides statistical significance

### Why Neutral Status for Auth Errors?

Authentication failures (401, 403) are:
- User credential issues, not endpoint problems
- Shouldn't penalize the ability's health
- User can fix by updating credentials

## Files Modified/Created

### New Files
- `src/server/ability-health-service.ts` - Core health tracking logic
- `src/server/routes/health.ts` - Health monitoring API endpoints
- `drizzle/0006_parallel_the_twelve.sql` - Database migration
- `docs/ABILITY_HEALTH_TRACKING.md` - This documentation

### Modified Files
- `src/db/schema.ts` - Added health fields and history table
- `src/server/routes/execution.ts` - Integrated health updates
- `src/server/ability-repository-user.ts` - Health-based filtering and ranking
- `src/server/routes.ts` - Registered health routes

## Summary

The Ability Health Tracking system provides:

✅ Automatic health monitoring based on execution success rates
✅ Intelligent classification of errors (neutral vs. failure)
✅ Defunct marking for consistently failing abilities
✅ Health-based search ranking
✅ Comprehensive monitoring and analytics APIs
✅ Historical health tracking
✅ User control via health reset

This ensures users are presented with reliable abilities and provides visibility into API endpoint health across the platform.
