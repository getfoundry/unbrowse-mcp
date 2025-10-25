# HAR File Chunking & Parallel Processing

## Overview

Large HAR files are now automatically chunked and processed in parallel to avoid exceeding the 500k token limit per agent session.

## How It Works

1. **Token Estimation**: Each HAR entry is analyzed to estimate its token count (~1 token per 4 characters)
2. **Smart Chunking**: Entries are grouped into chunks that stay under the token limit
3. **Domain Grouping**: Related requests from the same domain are kept together for better context
4. **Noise Filtering**: Automatically filters out ads, trackers, static assets, and analytics
5. **Parallel Processing**: Multiple chunks are processed concurrently for faster ingestion

## Configuration

Configure via environment variables:

```bash
# Maximum tokens per chunk (default: 400,000)
HAR_MAX_TOKENS_PER_CHUNK=400000

# Group entries by domain (default: true)
HAR_GROUP_BY_DOMAIN=true

# Number of continuation passes per chunk (default: 3)
HAR_CONTINUATION_PASSES=3

# Enable parallel processing (default: true)
HAR_PARALLEL_PROCESSING=true
```

Or programmatically in [src/server/har-config.ts](src/server/har-config.ts).

## Chunking Strategy

### Filtered Out (Noise)
- Google Analytics, Tag Manager
- Facebook trackers
- Doubleclick, ads
- Static assets (images, CSS, fonts)
- Analytics/tracking/pixel endpoints

### Kept & Grouped
- API endpoints
- GraphQL queries
- Data endpoints
- Authentication flows
- Related requests by domain

## Token Limits

- **Per Chunk**: 400k tokens (configurable)
- **Safety Buffer**: 100k tokens reserved for system prompts
- **Total Capacity**: 500k tokens per agent session

## Processing Flow

```
Upload HAR
    ↓
Chunk HAR (filter noise, group by domain)
    ↓
Write chunk files to disk
    ↓
Queue chunks for processing
    ↓
Process chunks sequentially with rate limiting
    ↓
   C1 → delay → C2 → delay → C3
    ↓           ↓           ↓
  Store abilities in vector DB
```

**Rate Limiting:**
- Chunks are processed sequentially (not in parallel)
- Automatic delays between chunks based on token usage
- Respects xAI limits: 4M tokens/min, 480 requests/min
- Conservative calculation: ~66,666 tokens/second max
- Minimum 125ms delay between requests

## Benefits

1. **No Token Limit Errors**: Stay well under 500k tokens per session
2. **Rate Limit Compliance**: Automatic delays prevent hitting xAI rate limits
3. **Better Organization**: Domain grouping maintains context
4. **Cleaner Results**: Noise filtering focuses on useful endpoints
5. **Scalable**: Handles HAR files of any size
6. **Queue Management**: Global queue handles multiple HAR uploads gracefully

## Example

```bash
# Upload a large HAR file
curl -X POST http://localhost:4111/ingest \
  -F "file=@large-capture.har"

# Response includes chunking info
{
  "success": true,
  "message": "HAR file accepted for processing. Large files will be chunked and processed in parallel.",
  "data": {
    "session_id": "session-1234-...",
    "processing": {
      "mode": "chunked_queued",
      "max_tokens_per_chunk": 400000,
      "group_by_domain": true,
      "continuation_passes": 3,
      "rate_limits": {
        "max_tokens_per_minute": "4M",
        "max_requests_per_minute": 480
      },
      "status": "Processing in background. Check server logs for progress."
    }
  }
}
```

## Log Output

```
[Background] Starting HAR processing for session: session-1234-...
[Background] HAR Config: { maxTokensPerChunk: 400000, groupByDomain: true, ... }
[Background] Chunking HAR file...
[HAR-Chunker] Total entries: 5000, Relevant: 1200
[HAR-Chunker] Total estimated tokens: 850,000
[HAR-Chunker] Created 3 chunks from 1200 entries
  Chunk 1: 400 entries, ~350,000 tokens, 5 domains
  Chunk 2: 450 entries, ~300,000 tokens, 3 domains
  Chunk 3: 350 entries, ~200,000 tokens, 4 domains
[Background] Wrote 3 chunk files
[ChunkQueue] Queued: session-1234-chunk-0 (~350,000 tokens) - Queue size: 1
[ChunkQueue] Queued: session-1234-chunk-1 (~300,000 tokens) - Queue size: 2
[ChunkQueue] Queued: session-1234-chunk-2 (~200,000 tokens) - Queue size: 3
[Background] All 3 chunks queued for processing
[ChunkQueue] Processing: session-1234-chunk-0 (waited 0ms)
[Background] Processing chunk 1/3 (400 entries, ~350,000 tokens)
[Background] Chunk 1 complete. Tool calls: 45
[ChunkQueue] Completed: session-1234-chunk-0
[ChunkQueue] Rate limit delay: 5250ms (remaining: 2 chunks)
[ChunkQueue] Processing: session-1234-chunk-1 (waited 5250ms)
[Background] Processing chunk 2/3 (450 entries, ~300,000 tokens)
[Background] Chunk 2 complete. Tool calls: 52
[ChunkQueue] Completed: session-1234-chunk-1
[ChunkQueue] Rate limit delay: 4500ms (remaining: 1 chunks)
[ChunkQueue] Processing: session-1234-chunk-2 (waited 9750ms)
[Background] Processing chunk 3/3 (350 entries, ~200,000 tokens)
[Background] Chunk 3 complete. Tool calls: 38
[ChunkQueue] Completed: session-1234-chunk-2
[ChunkQueue] Queue empty
```

## Files

- [src/mastra/tools/har-chunker.ts](src/mastra/tools/har-chunker.ts) - Chunking logic
- [src/server/har-config.ts](src/server/har-config.ts) - Configuration
- [src/server/rate-limiter.ts](src/server/rate-limiter.ts) - Queue and rate limiting
- [src/server/routes.ts](src/server/routes.ts) - Ingestion endpoint with chunking

## Future Improvements

- [ ] Adaptive chunk sizing based on actual token usage
- [ ] Resume failed chunks without reprocessing
- [ ] Chunk-level progress tracking API
- [ ] Smart dependency detection across chunks
