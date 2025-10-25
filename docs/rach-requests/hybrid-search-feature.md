# Feature Request: Hybrid Search for Abilities

## Status
🔴 **Not Started**

## Priority
🔥 **High** - Improves search quality and user experience significantly

## Overview
Implement hybrid search combining **KGE-based semantic search** with **traditional text matching** for ability searches.

## Problem Statement

Currently, the ability search uses **only KGE semantic search** with embeddings and cosine similarity:
- **Good**: Finds semantically similar abilities even with different wording
- **Bad**: May miss exact keyword matches (e.g., searching "stripe" might not rank abilities with "stripe" in the name highest)
- **Bad**: Pure semantic search can return unexpected results for very specific queries

**Example Issues**:
```bash
# Query: "stripe payment"
# Current: Returns abilities semantically similar, but might rank "payment gateway" higher than exact "Stripe API"
# Desired: Boost exact matches for "stripe" in ability name/service
```

## Proposed Solution

Implement **hybrid search** with configurable weighting:

### Algorithm

```typescript
// Pseudocode
function hybridSearch(query: string, abilities: Ability[], weights = { semantic: 0.7, text: 0.3 }) {
  // 1. Semantic Search (KGE-based, using embeddings)
  const semanticScores = calculateCosineSimilarity(query, abilities);

  // 2. Text Matching (keyword-based)
  const textScores = calculateTextMatchScore(query, abilities);

  // 3. Combine scores with weights
  const finalScores = abilities.map((ability, i) => {
    return (semanticScores[i] * weights.semantic) + (textScores[i] * weights.text);
  });

  // 4. Sort by final score
  return sortByScore(finalScores);
}
```

### Text Matching Strategies

**Option 1: Simple Keyword Matching (Quick Win)**
```typescript
function calculateTextMatchScore(query: string, ability: Ability): number {
  const queryLower = query.toLowerCase();
  let score = 0;

  // Exact match in ability name (highest weight)
  if (ability.abilityName.toLowerCase().includes(queryLower)) {
    score += 1.0;
  }

  // Match in service name
  if (ability.serviceName.toLowerCase().includes(queryLower)) {
    score += 0.8;
  }

  // Match in domain
  if (ability.domain?.toLowerCase().includes(queryLower)) {
    score += 0.6;
  }

  // Match in description
  if (ability.description.toLowerCase().includes(queryLower)) {
    score += 0.4;
  }

  // Normalize to 0-1 range
  return Math.min(score / 2.8, 1.0);
}
```

**Option 2: TF-IDF Scoring (Better Quality)**
- Use Term Frequency-Inverse Document Frequency for keyword scoring
- Requires pre-computing IDF scores across all abilities
- Better handles common vs rare terms

**Option 3: PostgreSQL Full-Text Search (Best Performance)**
```sql
-- Use PostgreSQL's built-in full-text search
SELECT *, ts_rank(search_vector, plainto_tsquery('english', $query)) as text_score
FROM user_abilities
WHERE search_vector @@ plainto_tsquery('english', $query);
```
- Add `tsvector` column to `user_abilities` table
- Create GIN index for performance
- Use `ts_rank()` for scoring

## Implementation Plan

### Phase 1: Quick Win (Simple Keyword Matching)
- [ ] Implement `calculateTextMatchScore()` function
- [ ] Add hybrid scoring to `searchPublishedAbilities()`
- [ ] Add hybrid scoring to `searchUserAbilities()`
- [ ] Add configurable weights (default: 70% semantic, 30% text)
- [ ] Test with real queries

**Estimated Time**: 2-3 hours

### Phase 2: Database Optimization (PostgreSQL Full-Text)
- [ ] Add `search_vector` tsvector column to `user_abilities` table
- [ ] Create migration to populate search vectors
- [ ] Create GIN index on `search_vector`
- [ ] Update `createUserAbility()` to generate search vector
- [ ] Implement hybrid search using `ts_rank()`
- [ ] Benchmark performance improvement

**Estimated Time**: 4-6 hours

### Phase 3: Tuning & Analysis
- [ ] Collect query logs and analyze search quality
- [ ] A/B test different weight configurations
- [ ] Add analytics for search result click-through rates
- [ ] Fine-tune weights based on user behavior

**Estimated Time**: Ongoing

## Technical Details

### Files to Modify

1. **`src/server/ability-repository-user.ts`**
   - `searchPublishedAbilities()` - Add hybrid scoring (lines 347-395)
   - `searchUserAbilities()` - Add hybrid scoring (lines 132-208)

2. **`src/db/schema.ts`** (Phase 2)
   - Add `searchVector` column to `userAbilities` table

3. **Database Migration** (Phase 2)
   - Create migration to add tsvector column and GIN index

### Configuration

Add to environment or config:
```typescript
interface SearchConfig {
  hybrid: {
    enabled: boolean;
    weights: {
      semantic: number; // 0.0 - 1.0
      text: number;     // 0.0 - 1.0 (must sum to 1.0 with semantic)
    };
    textMatching: {
      abilityNameWeight: number;
      serviceNameWeight: number;
      domainWeight: number;
      descriptionWeight: number;
    };
  };
}
```

## Success Metrics

- **Search Relevance**: Manual evaluation of top 10 results for common queries
- **User Satisfaction**: Track click-through rate on search results
- **Performance**: Query latency < 200ms for 95th percentile
- **Coverage**: % of searches returning relevant results in top 5

## Edge Cases

1. **Empty query**: Return error (already handled by API validation)
2. **No embeddings**: Abilities without embeddings excluded from semantic search
3. **Short queries** (1-2 chars): May prefer text matching over semantic
4. **Multi-word queries**: Consider phrase matching vs individual terms

## References

- Current KGE semantic search: `ability-repository-user.ts:147-175`
- Old vector search (removed): `ability-repository-vector.ts:66-167`
- PostgreSQL Full-Text Search: https://www.postgresql.org/docs/current/textsearch.html
- Hybrid Search Best Practices: https://www.pinecone.io/learn/hybrid-search-intro/

## Related Issues

- Security fix for public abilities search (✅ Completed)
- Legacy routes removal (✅ Completed)
- KGE semantic search migration (✅ Completed)

## Notes

- Current implementation calculates cosine similarity **in-memory** (not using vector DB)
- For large datasets (>10k abilities), consider moving similarity calculation to database or vector DB
- The old `queryWithDependencies()` method included dependency graph traversal - confirm if this is still needed for user abilities
