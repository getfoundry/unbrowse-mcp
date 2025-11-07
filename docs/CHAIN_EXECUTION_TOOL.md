# Chain Execution MCP Tool

The `execute_ability_chain` tool allows Claude to execute multi-step workflows directly through the Unbrowse MCP server.

## Tool Overview

**Tool Name**: `execute_ability_chain`

**Purpose**: Execute multiple abilities in sequence (pipeline/chain), where the output of one ability becomes the input to the next. Successful chains automatically create reusable workflow abilities.

## Parameters

### `chain` (required)
JSON string defining the chain of abilities to execute in sequence.

**Structure:**
```json
[
  {
    "abilityId": "ability-1",
    "params": { /* parameters for first ability */ },
    "outputMapping": { "output.field": "input.field" }  // Optional
  },
  {
    "abilityId": "ability-2",
    "params": { /* base parameters */ }
  }
]
```

### `stop_on_error` (optional, default: true)
Boolean flag to stop chain execution if any step fails. Set to `false` to execute all steps and get partial results.

### `transform_code` (optional)
JavaScript code to transform the final output (applied to last successful step's result).

## Features

1. **Sequential Execution**: Abilities execute in order
2. **Output Passing**: Output of ability N is passed as input to ability N+1
3. **Field Mapping**: Use `outputMapping` to map specific fields using dot notation
4. **Auto-Workflow Creation**: Successful chains automatically create reusable workflow abilities
5. **Partial Results**: Get results for all executed steps, even on failure
6. **Error Handling**: Option to stop on first error or continue through failures

## Examples

### Example 1: Simple Twitter Workflow

```typescript
execute_ability_chain({
  chain: JSON.stringify([
    {
      abilityId: "twitter-search-tweets",
      params: { query: "AI agents", count: 5 },
      outputMapping: { "tweets.0.id": "tweetId" }
    },
    {
      abilityId: "twitter-get-tweet-details",
      params: {}
    }
  ])
})
```

**What happens:**
1. Searches for tweets about "AI agents"
2. Extracts the first tweet's ID
3. Fetches detailed information for that tweet
4. Returns the tweet details
5. **Auto-creates a workflow ability** for future use!

### Example 2: Multi-Step Data Pipeline

```typescript
execute_ability_chain({
  chain: JSON.stringify([
    {
      abilityId: "github-fetch-issues",
      params: { repo: "owner/repo", state: "open" },
      outputMapping: { "issues": "rawIssues" }
    },
    {
      abilityId: "analyze-sentiment",
      params: { field: "title" },
      outputMapping: { "sentiment.score": "avgSentiment" }
    },
    {
      abilityId: "generate-summary",
      params: { format: "markdown" }
    }
  ]),
  stop_on_error: true
})
```

### Example 3: Continue on Error

```typescript
execute_ability_chain({
  chain: JSON.stringify([
    {
      abilityId: "fetch-data-source-1",
      params: {}
    },
    {
      abilityId: "fetch-data-source-2",
      params: {}
    },
    {
      abilityId: "fetch-data-source-3",
      params: {}
    }
  ]),
  stop_on_error: false  // Execute all steps even if some fail
})
```

## Response Format

### Success Response

```
✅ Chain executed successfully!

📊 Results:
- Steps completed: 2/2
- Total execution time: 1234ms

🎉 Workflow ability auto-created!
- Workflow ID: workflow-1234567890-abc123def
- This chain is now reusable as a single ability
- Execute it with: execute_ability(ability_id="workflow-1234567890-abc123def")

📦 Final Output:
{
  "tweet": {
    "id": "123456789",
    "text": "...",
    "author": "..."
  }
}
```

### Error Response

```
Chain execution failed:

- Step twitter-get-details: Authentication required

Completed: 1/2 steps
Total time: 567ms
```

## Output Mapping

### No Mapping (Default)
Entire output is merged with next step's params:
```json
{
  "abilityId": "step-2",
  "params": {}
}
// Receives: { ...entireOutputFromStep1, ...params }
```

### Field Mapping
Map specific fields using dot notation:
```json
{
  "outputMapping": {
    "user.id": "userId",
    "user.profile.email": "email",
    "results.0.name": "firstName"
  }
}
```

**Supported patterns:**
- `"field"` - Top-level field
- `"nested.field"` - Nested object
- `"array.0.field"` - Array index access
- `"data.items.length"` - Array length

## Workflow Auto-Creation

When a chain executes successfully with 2+ steps:

1. **Workflow Ability Created**
   - ID: `workflow-{timestamp}-{random}`
   - Name: `Ability 1 → Ability 2 → Ability 3`
   - Searchable in ability index

2. **Workflow is Reusable**
   ```typescript
   // Execute the workflow like any ability
   execute_ability({
     ability_id: "workflow-1234567890-abc123def",
     params: JSON.stringify({ query: "GPT-4" })
   })
   ```

3. **Workflow is Discoverable**
   ```typescript
   // Search for workflows
   search_abilities({ query: "twitter sentiment analysis" })
   // Returns workflow abilities and individual abilities
   ```

## Use Cases

### 1. Social Media Analysis
```
Search Tweets → Analyze Sentiment → Generate Report
```

### 2. Data Enrichment
```
Get User Data → Fetch Demographics → Merge with CRM
```

### 3. Multi-Source Aggregation
```
Fetch RSS Feed → Filter Articles → Extract Metadata → Save
```

### 4. API Orchestration
```
Create Resource → Wait for Completion → Fetch Results → Send Notification
```

### 5. Complex Authentication
```
Start OAuth → Exchange Code → Get Token → Fetch Profile
```

## Error Handling

### Authentication Errors
If credentials expire during execution:
- Expired credentials are automatically deleted
- `loginAbilities` array provided in response
- Chain stops (unless `stop_on_error: false`)

### Execution Errors
- Each step's success/failure is tracked
- Partial results always returned
- Detailed error messages per step

### Validation Errors
Chain won't start if:
- Chain array is empty
- Chain exceeds 10 abilities
- Any step is missing `abilityId`
- Any ability doesn't exist or is defunct

## Debugging

Enable debug mode in your MCP config:

```json
{
  "mcpServers": {
    "unbrowse": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "UNBROWSE_API_KEY": "re_xxx",
        "UNBROWSE_PASSWORD": "your-password"
      },
      "settings": {
        "debug": true  // Enable detailed logging
      }
    }
  }
}
```

With debug enabled, you'll see:
- Step-by-step execution details
- Individual step timing
- Success/failure status per step

## Limitations

1. **Maximum 10 steps** per chain
2. **Credentials required** for abilities that need them
3. **No conditional logic** (all steps execute in sequence)
4. **No parallel execution** (steps run sequentially)
5. **Workflow immutability** (can't edit workflows after creation)

## Best Practices

### 1. Start Simple
Test individual abilities before chaining:
```typescript
// First, test each ability individually
execute_ability({ ability_id: "ability-1", params: "..." })
execute_ability({ ability_id: "ability-2", params: "..." })

// Then chain them
execute_ability_chain({ chain: "..." })
```

### 2. Use Descriptive Ability Names
Good ability names create good workflow names:
- ✅ "Search Tweets → Analyze Sentiment"
- ❌ "ability-123 → ability-456"

### 3. Map Fields Explicitly
Explicit mapping is clearer than auto-merge:
```json
{
  "outputMapping": {
    "data.id": "resourceId",
    "data.status": "currentStatus"
  }
}
```

### 4. Handle Errors Gracefully
Use `stop_on_error: false` for non-critical steps:
```typescript
execute_ability_chain({
  chain: JSON.stringify([...]),
  stop_on_error: false  // Get partial results even if some steps fail
})
```

### 5. Test with Small Data
Start with small datasets to verify the chain works:
```json
{
  "params": { "limit": 5 }  // Start small
}
```

## Integration with Other Tools

### Use with `search_abilities`
```typescript
// 1. Search for abilities
const abilities = await search_abilities({ query: "twitter" })

// 2. Build chain from search results
const chain = [
  { abilityId: abilities[0].ability_id, params: {} },
  { abilityId: abilities[1].ability_id, params: {} }
]

// 3. Execute chain
await execute_ability_chain({ chain: JSON.stringify(chain) })
```

### Use with `execute_ability`
```typescript
// 1. Create workflow via chain
const result = await execute_ability_chain({ chain: "..." })

// 2. Reuse workflow as ability
await execute_ability({
  ability_id: result.workflowAbilityId,
  params: "{}"
})
```

## Troubleshooting

### "Chain must be a non-empty array"
- Check that `chain` is a valid JSON array string
- Ensure at least one step is provided

### "Ability not found"
- Verify ability IDs are correct
- Use `search_abilities` to find valid IDs

### "Missing X-Credential-Key header"
- Ensure `password` is set in MCP config
- Check that credentials are stored for required abilities

### "Chain cannot exceed 10 abilities"
- Split long chains into multiple shorter chains
- Use intermediate workflows

### "Body has already been consumed"
- This is a server-side issue - retry the request
- Check server logs for details

## Advanced Usage

### Dynamic Chain Building

```typescript
// Build chain dynamically based on search results
const searchResults = await search_abilities({ query: "data processing" })

const chain = searchResults.slice(0, 3).map(ability => ({
  abilityId: ability.ability_id,
  params: {}
}))

await execute_ability_chain({ chain: JSON.stringify(chain) })
```

### Transform Final Output

```typescript
execute_ability_chain({
  chain: JSON.stringify([...]),
  transform_code: "(data) => ({ summary: data.text.slice(0, 100), count: data.items.length })"
})
```

### Nested Field Extraction

```json
{
  "outputMapping": {
    "response.data.users.0.profile.email": "userEmail",
    "response.meta.pagination.total": "totalCount"
  }
}
```

## Summary

The `execute_ability_chain` tool enables:
- ✅ Multi-step workflows in a single call
- ✅ Auto-creation of reusable workflow abilities
- ✅ Complex data pipelines without code
- ✅ Searchable and discoverable workflows
- ✅ Network effects (your chains help other users)

**Chain once, reuse forever!** 🚀
