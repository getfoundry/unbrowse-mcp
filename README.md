# Unbrowse MCP Server with X402 Payments

A Model Context Protocol (MCP) server for the Unbrowse API with optional x402 payment integration for monetizing your MCP tools.

## Features

### Core Unbrowse Features
- **Execute Abilities**: Run individual Unbrowse abilities by ID
- **Ability Chains**: Execute multiple abilities in sequence with output mapping
- **Semantic Search**: Find abilities using natural language queries
- **Credential Management**: Automatic credential injection and decryption
- **API Indexing**: Index new APIs from URLs or cURL commands (optional)

### X402 Payment Features (NEW!)

#### Host Paid MCP Servers (You Charge)
- **Monetize Your MCP Server**: Charge agents per-request for tool access
- **Flexible Pricing**: Multiple pricing tiers from $0.0001 to $0.10 per request
- **Automatic Payments**: Crypto payments handled automatically via Solana/USDC
- **No API Key Management**: Direct wallet-to-wallet payments
- **Protocol Methods Free**: Discovery and initialization remain free

#### Call Paid APIs (You Pay)
- **Access X402 APIs**: Call paid APIs with automatic payment handling
- **Autonomous Agents**: Your MCP server pays for API access automatically
- **Wallet Integration**: Uses viem + x402-axios for seamless payments
- **Cost Tracking**: Monitor payments made from your wallet
- **Testnet Support**: Test with Base Sepolia before production

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and set:

```bash
# Required: Unbrowse API key
UNBROWSE_API_KEY=re_xxxxxxxxxxxxx

# Optional: Host paid MCP server (you charge others)
ENABLE_X402_PAYMENTS=true
X402_WALLET_ADDRESS=your-solana-wallet-address
X402_PRICING_TIER=BASIC  # BASIC, STANDARD, PREMIUM, or ENTERPRISE

# Optional: Call paid APIs (you pay others)
X402_PRIVATE_KEY=0xyour-wallet-private-key
```

### 3. Run the Server

#### Standard MCP (stdio)
```bash
pnpm run dev
```

#### HTTP MCP with Payments
```bash
# Free mode
pnpm run http

# Paid mode
pnpm run http:paid
```

## Usage Modes

### 1. Claude Desktop (stdio)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "unbrowse": {
      "command": "pnpm",
      "args": ["--silent", "-C", "/path/to/unbrowse-x402", "dev"],
      "env": {
        "UNBROWSE_API_KEY": "your-api-key"
      }
    }
  }
}
```

### 2. HTTP Server with Payments

Perfect for:
- Agent frameworks that connect via HTTP
- Monetizing your MCP tools
- Multi-client deployments
- Production environments

```bash
# Start HTTP server with payments
ENABLE_X402_PAYMENTS=true \
X402_WALLET_ADDRESS=your-wallet \
X402_PRICING_TIER=STANDARD \
pnpm run http
```

Server endpoints:
- `POST /mcp` - MCP protocol endpoint (paid tool calls)
- `GET /health` - Health check (free)
- `GET /payment-info` - Payment configuration (free)
- `GET /sessions` - Active sessions (free)

## Available Tools

### 1. `execute_ability`

Execute a single Unbrowse ability by ID.

```typescript
{
  ability_id: "ability_xxx",
  parameters: { /* JSON parameters */ },
  transform_code?: "function transform(data) { return data.items; }"
}
```

### 2. `execute_ability_chain`

Execute multiple abilities in sequence with output mapping.

```typescript
{
  abilities: [
    {
      ability_id: "ability_xxx",
      parameters: { query: "{{input}}" },
      output_mapping: { results: "$.items" }
    },
    {
      ability_id: "ability_yyy",
      parameters: { id: "{{step_0.results[0].id}}" }
    }
  ],
  initial_input: { input: "search term" }
}
```

### 3. `search_abilities`

Search for abilities using semantic search.

```typescript
{
  query: "github api",
  limit: 10  // optional, default 10
}
```

### 4. `call_x402_api` (optional - NEW!)

Call an x402-protected API with automatic payment handling (requires `X402_PRIVATE_KEY`).

```typescript
{
  url: "http://localhost:4021/weather",
  method: "GET",  // GET, POST, PUT, DELETE, PATCH
  headers?: { "X-Custom-Header": "value" },
  data?: { /* request body */ },
  params?: { "query": "value" }
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* API response */ },
  "statusCode": 200,
  "paymentMade": true,
  "message": "Payment was made to access this API"
}
```

### 5. `ingest_api_endpoint` (optional)

Index a new API endpoint (requires `ENABLE_INDEX_TOOL=true`).

```typescript
{
  url: "https://api.example.com/endpoint",
  method?: "GET",
  headers?: { "Authorization": "Bearer token" }
}
```

## Pricing Tiers

Set via `X402_PRICING_TIER` environment variable:

| Tier | Price | Use Case |
|------|-------|----------|
| **BASIC** | $0.0001 | Lightweight queries, simple lookups |
| **STANDARD** | $0.001 | Standard API operations |
| **PREMIUM** | $0.01 | Compute-intensive operations |
| **ENTERPRISE** | $0.10 | High-value data, AI-powered tools |

## Documentation

### X402 Payment Guides

- **[X402_INTEGRATION.md](X402_INTEGRATION.md)** - Host paid MCP servers (you charge)
  - Set up payment-protected MCP endpoints
  - Configure pricing tiers
  - Accept payments in your wallet
  - Production deployment guide

- **[X402_CLIENT_GUIDE.md](X402_CLIENT_GUIDE.md)** - Call paid APIs (you pay)
  - Use the `call_x402_api` tool
  - Configure wallet for payments
  - Access x402-protected APIs
  - Cost management and monitoring

### General Documentation

- **[.env.example](.env.example)** - All environment variables explained

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Client                           │
│              (Claude Desktop, Agent, etc.)              │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   Transport Layer      │
         │  ┌──────────────────┐  │
         │  │ stdio (default)  │  │
         │  └──────────────────┘  │
         │  ┌──────────────────┐  │
         │  │ HTTP + x402      │  │
         │  │ (optional)       │  │
         │  └──────────────────┘  │
         └────────┬───────────────┘
                  │
                  ▼
         ┌────────────────────────┐
         │   X402 Middleware      │
         │  (if ENABLE_X402=true) │
         │                        │
         │  • Protocol: Free      │
         │  • Tool calls: Paid    │
         └────────┬───────────────┘
                  │
                  ▼
         ┌────────────────────────┐
         │    MCP Server          │
         │  (src/index.ts)        │
         │                        │
         │  • 5 registered tools  │
         │  • Credential mgmt     │
         │  • Session handling    │
         └────────┬───────────────┘
                  │
                  ▼
         ┌────────────────────────┐
         │   Unbrowse API         │
         │  (index.unbrowse.ai)   │
         └────────────────────────┘
```

## Development

### Project Structure

```
unbrowse-x402/
├── src/
│   ├── index.ts                    # Main MCP server
│   ├── http-server.ts              # HTTP server with payments
│   ├── x402-middleware.ts          # Payment middleware
│   ├── api-client.ts               # Unbrowse API client
│   ├── crypto-utils.ts             # Credential encryption
│   └── wrapper-executor-enhanced.ts # Ability executor
├── .env.example                    # Environment template
├── package.json                    # Dependencies & scripts
├── smithery.yaml                   # MCP server config
├── Dockerfile                      # Docker configuration
├── README.md                       # This file
└── X402_INTEGRATION.md            # Payment integration guide
```

### Testing

#### 1. Test Free Mode

```bash
pnpm run http
```

```bash
curl http://localhost:3000/health
# Should return: {"status":"ok"}
```

#### 2. Test Paid Mode

```bash
ENABLE_X402_PAYMENTS=true \
X402_WALLET_ADDRESS=your-wallet \
pnpm run http
```

```bash
# Check payment config
curl http://localhost:3000/payment-info

# Try tool call (should return 402)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/call","params":{"name":"search_abilities"}}'
```

### Building for Production

```bash
# Build with Smithery
pnpm run build

# Run compiled version
node .smithery/index.cjs
```

### Docker Deployment

```bash
# Build
docker build -t unbrowse-mcp .

# Run with payments
docker run -p 3000:3000 \
  -e ENABLE_X402_PAYMENTS=true \
  -e X402_WALLET_ADDRESS=your-wallet \
  -e UNBROWSE_API_KEY=your-key \
  unbrowse-mcp
```

## Environment Variables

### Required

- `UNBROWSE_API_KEY` - Your Unbrowse API key from https://agent.unbrowse.ai/dashboard
  - OR `UNBROWSE_SESSION_TOKEN` - Browser session token alternative

### Optional

- `UNBROWSE_PASSWORD` - Password to decrypt stored credentials
- `PROXY_URL` - HTTP proxy (format: `http://user:pass@host:port`)
- `ENABLE_INDEX_TOOL` - Enable API indexing tool (default: `false`)

### X402 Payment (Optional)

#### For Hosting Paid MCP Servers (You Charge)

- `ENABLE_X402_PAYMENTS` - Enable payment protection (default: `false`)
- `X402_WALLET_ADDRESS` - Your Solana wallet address to receive payments
- `X402_NETWORK` - Network: `devnet` or `mainnet` (default: `devnet`)
- `X402_PRICING_TIER` - Pricing tier: `BASIC`, `STANDARD`, `PREMIUM`, `ENTERPRISE`
- `HTTP_PORT` - HTTP server port (default: `3000`)
- `HTTP_HOST` - HTTP server host (default: `localhost`)

#### For Calling Paid APIs (You Pay)

- `X402_PRIVATE_KEY` - Your wallet's private key for making payments (starts with `0x`)
- `X402_DEFAULT_BASE_URL` - Optional default base URL for API calls

## Examples

### Example 1: Execute Single Ability

```json
{
  "method": "tools/call",
  "params": {
    "name": "execute_ability",
    "arguments": {
      "ability_id": "ability_cm123456",
      "parameters": {
        "query": "anthropic"
      }
    }
  }
}
```

### Example 2: Chain Multiple Abilities

```json
{
  "method": "tools/call",
  "params": {
    "name": "execute_ability_chain",
    "arguments": {
      "abilities": [
        {
          "ability_id": "ability_search",
          "parameters": { "q": "{{input}}" },
          "output_mapping": { "results": "$.items" }
        },
        {
          "ability_id": "ability_details",
          "parameters": { "id": "{{step_0.results[0].id}}" }
        }
      ],
      "initial_input": { "input": "AI tools" }
    }
  }
}
```

### Example 3: Transform Output

```json
{
  "method": "tools/call",
  "params": {
    "name": "execute_ability",
    "arguments": {
      "ability_id": "ability_cm123456",
      "parameters": { "query": "test" },
      "transform_code": "function transform(data) { return data.items.map(i => i.name); }"
    }
  }
}
```

## Troubleshooting

### Authentication Issues

**Error**: "Authentication required"

**Solution**: Set either `UNBROWSE_API_KEY` or `UNBROWSE_SESSION_TOKEN` in `.env`

### Payment Issues

**Error**: "Payment required" on all requests

**Solution**: Protocol methods should be free. Check that `BYPASS_PAYMENT_METHODS` in [src/x402-middleware.ts](src/x402-middleware.ts) includes the method you're calling.

### Credential Issues

**Error**: "Credential expired" or "Missing credentials"

**Solution**:
1. Set `UNBROWSE_PASSWORD` to decrypt stored credentials
2. Or provide credentials via environment variables (see [.env.example](.env.example))

### Session Issues

**Error**: "Invalid session"

**Solution**: HTTP mode requires session initialization. Send an `initialize` request first.

## Resources

- **Unbrowse Dashboard**: https://agent.unbrowse.ai/dashboard
- **MCP Protocol**: https://modelcontextprotocol.io
- **Faremeter/Corbits**: https://corbits.dev
- **X402 Integration Guide**: [X402_INTEGRATION.md](X402_INTEGRATION.md)

## Support

For issues related to:
- **Unbrowse API**: Contact Unbrowse support
- **X402 Payments**: https://tally.so/r/mVgyRa
- **MCP Protocol**: https://github.com/modelcontextprotocol

## License

(Add your license here)

## Contributing

(Add contribution guidelines here)

---

**Built with:**
- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) - MCP protocol implementation
- [@faremeter/middleware](https://www.npmjs.com/package/@faremeter/middleware) - X402 payment middleware
- [Express](https://expressjs.com) - HTTP server
- [Zod](https://zod.dev) - Schema validation
- [Undici](https://undici.nodejs.org) - HTTP client with proxy support
