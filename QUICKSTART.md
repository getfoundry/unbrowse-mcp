# Unbrowse MCP - Quick Start Guide

## 🎯 Key Feature: Private Registry-Based Tool Registration

**Tools are dynamically registered from the private registry endpoint based on your credentials!**

This means:
- ✅ Only abilities you have access to are registered as tools
- ✅ Each accessible API endpoint becomes its own named tool (e.g., `get_hedgemony_stats_simple`)
- ✅ Credential filtering happens automatically based on `userCredentials` config
- ✅ Domain-based filtering shows only relevant tools
- ✅ Full type safety with proper input schemas
- ✅ No generic `execute_ability` wrapper needed

**How it works:**
1. On startup, MCP calls the `/list` endpoint (private registry)
2. Passes your `userCredentials` from config
3. Registry filters abilities you can access
4. Each ability becomes a separate tool
5. Only public abilities + your authenticated abilities are registered

**Example:**
- **No credentials set:** Only ~4 public tools (binance, tradingview, supabase)
- **With hedgemony-fund credentials:** +10 hedgemony tools registered
- **With all credentials:** All 17 tools available!

## How to Use This MCP

### Option 1: Deploy to Smithery (Easiest)

1. **Deploy on Smithery:**
   - Push your code to GitHub
   - Go to [smithery.ai](https://smithery.ai)
   - Connect your repository
   - Set the `SECRET` environment variable (e.g., `my-super-secret-key-123`)
   - Deploy!

2. **Add to Claude Desktop:**
   
   Once deployed, Smithery will give you a connection URL. Add it to your Claude Desktop config:

   **On macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   **On Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

   ```json
   {
     "mcpServers": {
       "unbrowse": {
         "url": "https://your-smithery-url.smithery.ai",
         "env": {
           "SECRET": "my-super-secret-key-123",
           "userCredentials": "www.hedgemony.fund::cookie,www.wom.fun::api-key",
           "filterByDomains": "true"
         }
       }
     }
   }
   ```

   **Note:** Start with empty `userCredentials` to see public tools only. Add credentials later to unlock more tools!

3. **Restart Claude Desktop**

### Option 2: Run Locally

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set your SECRET:**
   ```bash
   export SECRET="my-super-secret-key-123"
   ```

3. **Run the dev server:**
   ```bash
   pnpm dev
   ```

4. **Add to Claude Desktop config:**
   
   ```json
   {
     "mcpServers": {
       "unbrowse": {
         "command": "pnpm",
         "args": ["dev"],
         "cwd": "/full/path/to/unbrowse-mcp/unbrowse",
         "env": {
           "SECRET": "my-super-secret-key-123",
           "userCredentials": "",
           "filterByDomains": "true"
         }
       }
     }
   }
   ```

   **Tip:** Leave `userCredentials` empty initially to start with public tools only!

5. **Restart Claude Desktop**

## Understanding Tool Registration

### What Tools Are Available?

**It depends on your credentials!** The MCP uses a **private registry** that filters tools based on what you have access to.

**Public Tools (No credentials needed):**
- `get_binance_klines` - Binance candlestick data
- `get_tradingview_s3_conversions` - TradingView data
- `get_supabase_tokens` - Token listings
- `get_supabase_featured_spots` - Featured tokens
- ~4 tools total

**Protected Tools (Require credentials):**
- `get_hedgemony_stats_simple` - Requires `www.hedgemony.fund::cookie`
- `get_hedgemony_trades_simple` - Requires `www.hedgemony.fund::cookie`
- `get_hedgemony_plus` - Requires `www.hedgemony.fund::cookie`
- ~10 more hedgemony tools

**How to unlock more tools:**

1. **Store credentials** using `store_credentials` tool
2. **Add to config** - Update `userCredentials` in Claude Desktop config
3. **Restart MCP** - Restart Claude Desktop to re-register tools

**Example workflow:**
```json
// Start with no credentials in config
"userCredentials": ""
// Only public tools available

// Store hedgemony credentials
store_credentials({
  serviceName: "hedgemony-fund",
  credentialKey: "www.hedgemony.fund::cookie",
  credentialValue: "your-cookie-here"
})

// Update config
"userCredentials": "www.hedgemony.fund::cookie"

// Restart Claude Desktop
// Now 10+ hedgemony tools are registered!
```

## Using the MCP Tools

### 1. List Available Abilities

Start by seeing what abilities are indexed:

```
list all abilities
```

Or in Claude, just ask:
> "What abilities do you have access to?"

**Response will show:**
- Ability IDs and names
- Services (hedgemony-fund, wom-fun)
- Required credentials
- Dependency order
- PoN scores

### 2. Get Detailed Info About an Ability

```
get info about ability "get-hedgemony-stats-simple"
```

**Shows:**
- Input schema (what parameters it accepts)
- Required credentials
- Dependency order (which abilities to call first)
- Static/dynamic header counts

### 3. Store Credentials (if needed)

For abilities that require authentication:

```
store credentials for hedgemony-fund:
- key: "www.hedgemony.fund::cookie"
- value: "session=abc123; token=xyz789"
```

**The credentials are:**
- Encrypted with AES-256-GCM
- Stored with your SECRET key
- Automatically injected during execution

### 4. Execute an Ability

**Each ability is automatically registered as its own tool!** Just call it by name:

```
get_hedgemony_stats_simple with tier: "plus"
```

Or in Claude, just ask naturally:
> "Get the hedgemony stats for the plus tier"

**What happens:**
1. Tool is already registered on MCP startup
2. Loads wrapper code from storage
3. Decrypts your credentials
4. Creates fetch override to inject headers
5. Makes REAL API call
6. Returns actual response

**If you get a 401 error:**
- Credentials are automatically marked as expired
- You'll get suggestions for login abilities
- Re-authenticate and try again

### 5. Handle Dependencies

Some abilities require others to be called first:

```
# Check dependencies
get info about "get-hedgemony-plus-news-archive"
# Shows: dependencyOrder: ["get-hedgemony-plus"]

# Execute in order
execute "get-hedgemony-plus"
execute "get-hedgemony-plus-news-archive"
```

## Example Workflows

### Workflow 1: Explore Available APIs

```
You: What APIs can you access?

Claude: Let me check the available abilities...
[Calls list_abilities]

Claude: I have access to 17 abilities across 2 services:

**hedgemony-fund:**
- get-hedgemony-stats-simple (Get trading statistics)
- get-hedgemony-trades-simple (Get recent trades)
- get-binance-klines (Get Binance candlestick data)
...

**wom-fun:**
- get-supabase-tokens (Get token listings)
- get-onrender-analytics (Get token analytics)
...
```

### Workflow 2: Execute a Public API

```
You: Get Binance klines for BTCUSDT

Claude: I'll use the get_binance_klines tool...
[Calls get_binance_klines tool directly]

Claude: Here's the candlestick data for BTCUSDT:
[Shows real API response]
```

### Workflow 3: Authenticate and Access Protected Data

```
You: I want to get my Hedgemony trading stats

Claude: That requires authentication. Do you have credentials?

You: Yes, here's my cookie: [paste cookie]

Claude: I'll store that securely...
[Calls store_credentials tool]

Claude: Great! Now getting your stats...
[Calls get_hedgemony_stats_simple tool directly]

Claude: Your trading statistics:
- Total PnL: $46.71
- Win Rate: 75%
- Active Trades: 5
...
```

### Workflow 4: Handle Expired Credentials

```
Claude: [Tries to execute protected ability]
[Gets 401 error]

Claude: Your credentials have expired. You need to re-authenticate using the "hedgemony-login" ability. Would you like me to help with that?

[Auto-suggests login ability]
```

### Workflow 5: Domain-Based Search

```
You: Show me only abilities for domains I have credentials for

Claude: [Calls list_abilities with filterByDomains: true]

Claude: Based on your credentials, you can access:
- Available domains: www.hedgemony.fund, www.wom.fun
- 12 abilities match these domains
...
```

## Understanding the Abilities

### Ability Structure

Each ability in `wrapper-storage/` is a JSON file containing:

```json
{
  "input": {
    "ability_id": "get-hedgemony-stats-simple",
    "ability_name": "get_hedgemony_stats_simple",
    "service_name": "hedgemony-fund",
    "description": "Get simple statistics...",
    "wrapper_code": "export async function wrapper(payload, options) {...}",
    "static_headers": [...],
    "dynamic_header_keys": ["www.hedgemony.fund::cookie"],
    "dependency_order": [],
    "input_schema": {...}
  },
  "execution": {
    "statusCode": 200,
    "responseBody": {...}
  }
}
```

### Key Concepts

**Static Headers:**
- Pre-defined in wrapper code
- E.g., user-agent, accept, content-type
- Auto-injected every time

**Dynamic Headers:**
- Require credentials from cookiejar
- E.g., cookies, authorization tokens
- Decrypted and injected from your stored credentials

**Dependency Order:**
- Some abilities need others to run first
- E.g., news-archive requires plus page to be loaded first
- System shows you the order

**PoN Score (Proof of Novelty):**
- Shows how unique/novel this ability is (0.05-0.35)
- Higher score = more unique/valuable

## Available Abilities

### Hedgemony Fund (Trading Platform)

- `get-binance-klines` - Binance candlestick data ✅ Public
- `get-hedgemony-stats-simple` - Trading statistics 🔒 Requires auth
- `get-hedgemony-stats-total` - Total statistics 🔒 Requires auth
- `get-hedgemony-trades-simple` - Recent trades 🔒 Requires auth
- `get-hedgemony-signals-recent` - Recent signals 🔒 Requires auth
- `get-hedgemony-plus` - Plus tier page 🔒 Requires auth
- `get-hedgemony-plus-news-archive` - News archive 🔒 Requires auth + dependency
- `get-hedgemony-subscribe` - Subscription page 🔒 Requires auth
- `get-tradingview-s3-conversions` - TradingView data ✅ Public
- `get-tradingview-widget-sheriff` - TradingView widget ✅ Public

### WOM Fun (Token Platform)

- `get-onrender-wom-tokens-bome-analytics` - BOME token analytics ✅ Public
- `get-supabase-featured-spots` - Featured token spots ✅ Public
- `get-supabase-hyperevm-tokens` - HyperEVM tokens ✅ Public
- `get-supabase-tokens` - All tokens ✅ Public

## Troubleshooting

### "Could not resolve wrapper-storage"

The path uses `process.cwd()` which should point to your project root. If this fails, check:
- You're running from the project directory
- `src/wrapper-storage/` exists and has JSON files

### "SECRET environment variable is required"

Set the SECRET before running:
```bash
export SECRET="your-secret-key"
pnpm dev
```

Or in Claude Desktop config:
```json
{
  "env": {
    "SECRET": "your-secret-key"
  }
}
```

### "Credentials expired"

When you get a 401 error:
1. MCP automatically marks credentials as expired
2. Find the login ability (suggested in response)
3. Execute login ability to get new credentials
4. Store new credentials
5. Retry original request

### "Missing dependencies"

If an ability shows missing dependencies:
1. Check `dependencyOrder` field
2. Execute prerequisite abilities first
3. Then execute the target ability

## Security Notes

- ✅ Credentials are encrypted with AES-256-GCM
- ✅ SECRET key is required for all encryption/decryption
- ✅ Credentials stored in-memory (not persisted to disk in this stub)
- ⚠️ Wrapper code makes REAL API calls to actual services
- ⚠️ Store your SECRET securely (environment variable, not in code)

## Next Steps

1. **Explore abilities** - Use `list_abilities` to see what's available
2. **Try public endpoints** - Execute abilities that don't need credentials
3. **Add credentials** - Store auth for protected endpoints
4. **Build workflows** - Chain abilities together based on dependency order
5. **Handle errors** - Use automatic login suggestions when credentials expire

## Support

For issues or questions:
- Check the main README.md
- Review ENHANCEMENTS.md for feature details
- See master.md for technical architecture
