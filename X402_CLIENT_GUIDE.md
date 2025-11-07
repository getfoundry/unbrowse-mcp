# Using X402 to Call Paid APIs from Your MCP Server

This guide explains how to configure your Unbrowse MCP server to call x402-protected APIs, automatically handling payments when required.

## Overview

With the `call_x402_api` tool, your MCP server can access paid APIs that use the x402 payment protocol. When the API requires payment (returns HTTP 402), the tool automatically:

1. Detects the payment requirement
2. Uses your configured wallet to make the payment
3. Retries the request with payment proof
4. Returns the data to you

This is the **client-side** implementation - your MCP server pays to access external paid APIs.

## Use Cases

- Access paid data APIs (weather, financial data, AI services)
- Call premium API endpoints that require per-request payment
- Integrate with x402-enabled services without manual payment handling
- Build agents that can autonomously pay for API access

## Prerequisites

### 1. A Wallet with Funds

You need an Ethereum-compatible wallet with:
- **Private key** (starts with `0x`)
- **USDC on Base Sepolia** (for testing) or **Base Mainnet** (for production)
- **ETH for gas fees** (small amount needed for transactions)

### 2. Get Test Funds (Devnet)

For testing on Base Sepolia:

1. **Get Sepolia ETH**: https://sepoliafaucet.com/
2. **Bridge to Base Sepolia**: https://bridge.base.org/
3. **Get Sepolia USDC**: Use Aave or Uniswap testnet faucets

###3. Find an X402-Protected API

Examples:
- **Weather API** (from x402 examples): `http://localhost:4021/weather`
- **Your own x402 server**: Any server implementing the x402 protocol
- **Third-party x402 APIs**: Check https://corbits.dev for available APIs

## Setup

### 1. Install Dependencies

Dependencies should already be installed, but if not:

```bash
pnpm add axios viem x402-axios
```

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# Required: Your wallet's private key
X402_PRIVATE_KEY=0xyour-private-key-here

# Optional: Default base URL for API calls
X402_DEFAULT_BASE_URL=http://localhost:4021
```

**IMPORTANT**:
- Never commit your private key to git
- Add `.env` to `.gitignore`
- Use a dedicated wallet for automated payments
- Start with testnet (Sepolia) before mainnet

### 3. Restart Your MCP Server

```bash
pnpm run dev
```

You should see:
```
[INFO] X402 payment client enabled
```

## Using the Tool

### Basic Usage

The `call_x402_api` tool is now available in your MCP server. Claude (or any MCP client) can use it like this:

```typescript
{
  "tool": "call_x402_api",
  "arguments": {
    "url": "http://localhost:4021/weather",
    "method": "GET"
  }
}
```

### Tool Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Full URL of the x402-protected API |
| `method` | enum | No | HTTP method: GET, POST, PUT, DELETE, PATCH (default: GET) |
| `headers` | object | No | Additional HTTP headers |
| `data` | any | No | Request body (for POST/PUT/PATCH) |
| `params` | object | No | URL query parameters |

### Examples

#### Example 1: Simple GET Request

```json
{
  "url": "http://localhost:4021/weather",
  "method": "GET"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "temperature": 72,
    "condition": "sunny"
  },
  "statusCode": 200,
  "paymentMade": true,
  "message": "Payment was made to access this API"
}
```

#### Example 2: POST with Data

```json
{
  "url": "https://api.example.com/data",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "data": {
    "query": "anthropic"
  }
}
```

#### Example 3: GET with Query Parameters

```json
{
  "url": "https://api.example.com/search",
  "method": "GET",
  "params": {
    "q": "ai tools",
    "limit": "10"
  }
}
```

#### Example 4: With Custom Headers

```json
{
  "url": "https://api.example.com/protected",
  "method": "GET",
  "headers": {
    "X-API-Version": "v2",
    "Accept": "application/json"
  }
}
```

## Testing with Sample Weather API

The x402 repository includes a sample weather API for testing. Here's how to set it up:

### 1. Clone x402 Repository

```bash
git clone https://github.com/coinbase/x402.git
cd x402/examples/typescript/servers/express
```

### 2. Install and Configure

```bash
pnpm install

# Create .env
echo "PRIVATE_KEY=0xyour-private-key" > .env
echo "PORT=4021" >> .env
```

### 3. Start the Server

```bash
pnpm dev
```

### 4. Test from Your MCP Server

In Claude Desktop or your MCP client:

```
Can you call the weather API at http://localhost:4021/weather?
```

Claude will use the `call_x402_api` tool, automatically handle payment, and return the weather data.

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { /* API response data */ },
  "statusCode": 200,
  "paymentMade": true,  // or false if API was free
  "message": "Payment was made to access this API"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error description",
  "statusCode": 402,  // or other error code
  "data": { /* error details if available */ }
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `X402_PRIVATE_KEY environment variable is required` | Private key not set | Add `X402_PRIVATE_KEY` to `.env` |
| `Payment required but could not be completed` | Insufficient funds or network issue | Check wallet balance and network connection |
| `Failed to call x402 API` | Generic error | Check API URL and parameters |

## How It Works

### Payment Flow

```
1. MCP Client calls tool
         ↓
2. Tool makes request to API
         ↓
3. API returns 402 Payment Required
   with payment details
         ↓
4. x402-axios interceptor:
   - Creates payment transaction
   - Signs with your private key
   - Submits to blockchain
   - Waits for confirmation
         ↓
5. Retry request with payment receipt
         ↓
6. API verifies payment
         ↓
7. API returns data
         ↓
8. Tool returns to MCP client
```

### Under the Hood

The implementation uses:
- **viem**: Ethereum wallet operations
- **x402-axios**: Automatic payment handling
- **axios**: HTTP client with interceptors

See [src/x402-client.ts](src/x402-client.ts) for implementation details.

## Cost Management

### Monitoring Payments

Payments are made from your wallet automatically. To monitor:

1. **Check wallet balance**: Use a block explorer (e.g., BaseScan)
2. **View transaction history**: Each payment creates an on-chain transaction
3. **Add logging** (optional):

```typescript
// In src/x402-client.ts, add:
console.log(`💰 Payment made: ${paymentAmount} ${paymentAsset}`);
```

### Setting Spending Limits

To prevent runaway costs:

1. **Use a dedicated wallet** with limited funds
2. **Monitor per-request costs** before enabling in production
3. **Implement rate limiting** in your agent logic
4. **Set alerts** on wallet balance

### Testnet vs Mainnet

| Network | Use Case | Cost | Risk |
|---------|----------|------|------|
| **Base Sepolia** | Development, testing | Free (testnet USDC) | None |
| **Base Mainnet** | Production | Real USDC | Real money |

Always test on Sepolia first!

## Integration Patterns

### Pattern 1: Direct Tool Calls

User explicitly requests API access:

```
User: "Get the weather from the paid API"
Claude: [Uses call_x402_api tool]
```

### Pattern 2: Autonomous Agent

Agent decides when to pay for data:

```javascript
// Agent logic
if (needsPremiumData) {
  result = await call_x402_api({
    url: "https://premium-api.com/data",
    method: "GET"
  });
}
```

### Pattern 3: Fallback to Paid API

Try free API first, fall back to paid:

```javascript
let data;
try {
  data = await freAPI.getData();
} catch {
  // Free API failed, use paid
  data = await call_x402_api({
    url: "https://paid-api.com/data"
  });
}
```

## Security Best Practices

### Private Key Security

1. **Never hardcode** private keys in code
2. **Use environment variables** only
3. **Rotate keys periodically**
4. **Use separate keys** for dev/prod

### Wallet Management

1. **Dedicated payment wallet**: Don't use your main wallet
2. **Limited funds**: Only keep what you need
3. **Monitor transactions**: Set up alerts
4. **Hardware wallet** for mainnet (optional)

### API Validation

1. **Verify API URLs**: Only call trusted endpoints
2. **Validate responses**: Check data before using
3. **Set timeouts**: Prevent hanging requests
4. **Rate limit**: Prevent spam/abuse

## Troubleshooting

### Tool Not Available

**Problem**: `call_x402_api` tool doesn't appear

**Solutions**:
1. Check `X402_PRIVATE_KEY` is set in `.env`
2. Restart MCP server
3. Look for `[INFO] X402 payment client enabled` in logs

### Payment Fails

**Problem**: Request returns 402 error

**Solutions**:
1. Check wallet has sufficient USDC
2. Check wallet has ETH for gas
3. Verify you're on correct network (Sepolia vs Mainnet)
4. Check API is actually x402-enabled

### Network Issues

**Problem**: Requests timeout or fail

**Solutions**:
1. Check API URL is correct and accessible
2. Verify network connectivity
3. Check if API server is running
4. Try with curl first to isolate issue

### Import Errors

**Problem**: `Cannot find module 'x402-axios'`

**Solutions**:
1. Run `pnpm install`
2. Check `package.json` includes all dependencies
3. Delete `node_modules` and reinstall

## Advanced Usage

### Custom Payment Client

Create a custom client with specific configuration:

```typescript
import { createX402Client } from "./x402-client.js";

const client = createX402Client({
  privateKey: "0x...",
  defaultBaseURL: "https://my-api.com"
});
```

### Multiple Wallets

Use different wallets for different APIs:

```typescript
// In .env
X402_PRIVATE_KEY_API_A=0x...
X402_PRIVATE_KEY_API_B=0x...
```

### Caching Responses

Reduce costs by caching API responses:

```typescript
const cache = new Map();

async function cachedCall(url: string) {
  if (cache.has(url)) {
    return cache.get(url);
  }

  const result = await call_x402_api({ url });
  cache.set(url, result);
  return result;
}
```

## Resources

- **X402 Protocol**: https://github.com/coinbase/x402
- **x402-axios**: https://www.npmjs.com/package/x402-axios
- **Viem Documentation**: https://viem.sh
- **Base Network**: https://base.org
- **Corbits Platform**: https://corbits.dev

## Example: Complete Integration

Here's a complete example of using the tool in an agent:

```typescript
// In your agent code
async function analyzeWeather() {
  // 1. Call paid weather API
  const weatherResult = await mcpServer.callTool("call_x402_api", {
    url: "http://localhost:4021/weather",
    method: "GET"
  });

  if (!weatherResult.success) {
    console.error("Failed to get weather:", weatherResult.error);
    return;
  }

  // 2. Use the data
  const weather = weatherResult.data;
  console.log(`Temperature: ${weather.temperature}°F`);
  console.log(`Condition: ${weather.condition}`);

  // 3. Check if payment was made
  if (weatherResult.paymentMade) {
    console.log("💰 Payment was required and completed");
  }

  return weather;
}
```

## Next Steps

1. **Test on devnet**: Start with Base Sepolia and test USDC
2. **Monitor costs**: Track payments for a week
3. **Optimize**: Cache responses, batch requests
4. **Production**: Move to mainnet when ready

---

**Questions or Issues?**

- Check [X402_INTEGRATION.md](X402_INTEGRATION.md) for server-side hosting
- See [README.md](README.md) for general MCP server documentation
- File issues at: (add your repo URL)
