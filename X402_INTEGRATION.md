# X402 Payment Integration for Unbrowse MCP Server

This document explains how to monetize your Unbrowse MCP server using the x402 payment protocol with Faremeter/Corbits infrastructure.

## Overview

The x402 integration allows you to:
- **Monetize your MCP tools** - Charge agents per-request for accessing your abilities
- **No API key management** - Agents pay automatically using crypto wallets
- **Flexible pricing** - Choose from multiple pricing tiers or set custom amounts
- **Direct payments** - Payments go straight to your Solana wallet
- **Seamless UX** - Payment happens automatically, transparent to the agent

## How It Works

1. **Payment Middleware**: The server uses Faremeter middleware to protect MCP endpoints
2. **Protocol Methods Free**: MCP protocol methods (initialize, list tools) are free to allow discovery
3. **Tool Calls Paid**: Actual tool executions require payment
4. **Automatic Settlement**: Payments are verified and settled automatically through Corbits facilitator

```
Agent → MCP Request → Payment Check → Tool Execution → Response
                          ↓
                    [If unpaid: HTTP 402]
                    [If paid: Continue]
```

## Installation

### 1. Install Dependencies

Already installed in this project:

```bash
pnpm install express @faremeter/middleware @faremeter/info tsx
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required: Unbrowse authentication
UNBROWSE_API_KEY=re_xxxxxxxxxxxxx

# Required: Enable x402 payments
ENABLE_X402_PAYMENTS=true

# Required: Your Solana wallet address
X402_WALLET_ADDRESS=your-solana-wallet-address

# Optional: Network (defaults to devnet)
X402_NETWORK=devnet

# Optional: Pricing tier (defaults to BASIC)
X402_PRICING_TIER=BASIC

# Optional: HTTP server config
HTTP_PORT=3000
HTTP_HOST=localhost
```

### 3. Get a Solana Wallet

For testing on devnet:
1. Install Phantom wallet: https://phantom.app/
2. Create a new wallet
3. Switch to Devnet in settings
4. Copy your wallet address to `X402_WALLET_ADDRESS`

For production on mainnet:
1. Use a dedicated payment wallet
2. Set `X402_NETWORK=mainnet`
3. Ensure wallet has SOL for transaction fees

## Usage

### Running the Server

#### Free Mode (No Payments)
```bash
pnpm run http
```

#### Paid Mode (X402 Protected)
```bash
# Set in .env: ENABLE_X402_PAYMENTS=true
pnpm run http:paid
```

#### Development Mode (Auto-reload)
```bash
pnpm run http:dev
```

### Endpoints

| Endpoint | Method | Payment Required | Description |
|----------|--------|------------------|-------------|
| `/health` | GET | No | Health check |
| `/payment-info` | GET | No | Payment configuration |
| `/sessions` | GET | No | Active session list |
| `/mcp` | POST | Conditional* | MCP protocol endpoint |
| `/mcp` | GET | No | Session management |
| `/mcp` | DELETE | No | Close session |

\* Protocol methods (initialize, list tools) are free; tool calls require payment

## Pricing Tiers

Pre-configured pricing tiers in [src/x402-middleware.ts](src/x402-middleware.ts):

| Tier | Price (USDC) | Use Case |
|------|--------------|----------|
| BASIC | $0.0001 | Lightweight queries, simple lookups |
| STANDARD | $0.001 | Standard API operations |
| PREMIUM | $0.01 | Compute-intensive operations |
| ENTERPRISE | $0.10 | High-value data, AI-powered tools |

Set via `X402_PRICING_TIER` environment variable.

### Custom Pricing

Edit [src/x402-middleware.ts](src/x402-middleware.ts) to add custom tiers:

```typescript
export const PRICING_TIERS = {
  // ... existing tiers
  CUSTOM: createPaymentTier("custom", 0.005, "Custom pricing"),
};
```

## Architecture

### Key Files

- **[src/x402-middleware.ts](src/x402-middleware.ts)** - Payment middleware configuration
  - `createX402Middleware()` - Creates Faremeter middleware
  - `conditionalPaymentMiddleware()` - Bypasses payment for protocol methods
  - `PRICING_TIERS` - Predefined pricing configurations

- **[src/http-server.ts](src/http-server.ts)** - HTTP server with MCP + payments
  - `createHttpServer()` - Express app with payment middleware
  - `startServer()` - Server initialization
  - Session management for MCP over HTTP

- **[src/index.ts](src/index.ts)** - Original MCP server (unchanged)
  - Contains all the Unbrowse MCP tools
  - Works with both stdio and HTTP transports

### Payment Flow

```typescript
// 1. Payment middleware checks if method requires payment
if (BYPASS_PAYMENT_METHODS.includes(req.body?.method)) {
  // Protocol methods: free
  next();
} else {
  // Tool calls: require payment
  paymentMiddleware(req, res, next);
}

// 2. Faremeter middleware verifies payment
// - Checks X-Payment-Receipt header
// - Validates payment amount and asset
// - Returns 402 if payment missing/invalid

// 3. If payment valid, request proceeds to MCP handler
```

## Testing

### 1. Start the Server

```bash
# Terminal 1: Start paid server
ENABLE_X402_PAYMENTS=true \
X402_WALLET_ADDRESS=your-wallet-address \
UNBROWSE_API_KEY=your-api-key \
pnpm run http
```

### 2. Test Protocol Methods (Free)

```bash
# Should work without payment
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0"}
    }
  }'
```

### 3. Test Tool Call (Requires Payment)

```bash
# Should return 402 Payment Required
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: your-session-id" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "search_abilities",
      "arguments": {"query": "github"}
    }
  }'
```

Expected response:
```json
{
  "error": {
    "code": 402,
    "message": "Payment required",
    "data": {
      "accepts": [{
        "asset": "USDC",
        "amount": 100,
        "payTo": "your-wallet-address"
      }]
    }
  }
}
```

### 4. Check Payment Info

```bash
curl http://localhost:3000/payment-info
```

Response:
```json
{
  "paymentsEnabled": true,
  "tier": "BASIC",
  "priceUSDC": 0.0001,
  "network": "devnet",
  "wallet": "your-wallet-address"
}
```

## Client Integration

### Using with Claude Desktop

Add to Claude Desktop's MCP config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "unbrowse-paid": {
      "url": "http://localhost:3000/mcp",
      "transport": {
        "type": "http"
      },
      "payment": {
        "enabled": true,
        "wallet": "your-client-wallet-address"
      }
    }
  }
}
```

### Using with Agent Frameworks

Example with custom MCP client:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { HTTPClientTransport } from "@modelcontextprotocol/sdk/client/http.js";

const transport = new HTTPClientTransport({
  url: "http://localhost:3000/mcp",
  headers: {
    "X-Payment-Receipt": "solana:tx:base58-signature"
  }
});

const client = new Client({
  name: "my-agent",
  version: "1.0.0"
}, {
  capabilities: {}
});

await client.connect(transport);
```

## Production Deployment

### Environment Configuration

```bash
# Production settings
X402_NETWORK=mainnet
X402_PRICING_TIER=STANDARD
HTTP_HOST=0.0.0.0
HTTP_PORT=3000

# Security
UNBROWSE_API_KEY=your-production-api-key
X402_WALLET_ADDRESS=your-production-wallet
```

### Docker Deployment

The existing Dockerfile works with HTTP server:

```bash
# Build
docker build -t unbrowse-mcp-x402 .

# Run
docker run -p 3000:3000 \
  -e ENABLE_X402_PAYMENTS=true \
  -e X402_WALLET_ADDRESS=your-wallet \
  -e UNBROWSE_API_KEY=your-key \
  unbrowse-mcp-x402
```

### Monitoring

The server includes Sentry integration for error tracking (already configured in [src/index.ts](src/index.ts)).

Add logging for payment events:

```typescript
// In src/http-server.ts
paymentMiddleware.on("payment_received", (payment) => {
  console.log(`💰 Payment received: ${payment.amount} ${payment.asset}`);
});
```

## Troubleshooting

### "Payment required" on protocol methods

**Problem**: Getting 402 on `initialize` or `tools/list`

**Solution**: Check that `BYPASS_PAYMENT_METHODS` includes the method in [src/x402-middleware.ts](src/x402-middleware.ts:19)

### "Invalid session" error

**Problem**: Tool calls fail with session error

**Solution**: Ensure you're sending the `mcp-session-id` header returned from `initialize`

### Payments not reaching wallet

**Problem**: Payment verified but wallet not receiving funds

**Solution**:
1. Check `X402_WALLET_ADDRESS` is correct
2. Verify network matches (devnet vs mainnet)
3. Check Corbits facilitator logs

### CORS errors in browser

**Problem**: Browser clients can't connect

**Solution**: CORS is already configured in [src/http-server.ts](src/http-server.ts:35). If issues persist, add your origin to `allowedHosts`.

## Advanced Configuration

### Custom Payment Validation

Add custom validation logic in [src/http-server.ts](src/http-server.ts):

```typescript
app.post("/mcp",
  conditionalPaymentMiddleware(paymentMiddleware),
  async (req, res, next) => {
    // Custom validation
    const paymentReceipt = req.headers["x-payment-receipt"];
    if (paymentReceipt) {
      // Verify payment details
      const isValid = await verifyPayment(paymentReceipt);
      if (!isValid) {
        return res.status(402).json({ error: "Invalid payment" });
      }
    }
    next();
  },
  handleMcpRequest
);
```

### Per-Tool Pricing

Implement different prices for different tools:

```typescript
const TOOL_PRICING = {
  "execute_ability": 0.001,
  "search_abilities": 0.0001,
  "execute_ability_chain": 0.01,
};

function getToolPrice(toolName: string): number {
  return TOOL_PRICING[toolName] || 0.001; // default
}
```

### Rate Limiting

Add rate limiting per wallet:

```bash
pnpm add express-rate-limit
```

```typescript
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each wallet to 100 requests per window
  keyGenerator: (req) => req.headers["x-payment-wallet"] as string
});

app.use("/mcp", limiter);
```

## Resources

- **Faremeter Documentation**: https://docs.faremeter.com
- **Corbits Platform**: https://corbits.dev
- **MCP Protocol**: https://modelcontextprotocol.io
- **Unbrowse Dashboard**: https://agent.unbrowse.ai/dashboard

## Support

For x402/payment issues:
- Corbits Support: https://tally.so/r/mVgyRa
- Faremeter GitHub: https://github.com/faremeter

For Unbrowse MCP issues:
- GitHub Issues: (add your repo URL)
- Documentation: (add your docs URL)

## License

(Add your license here)
