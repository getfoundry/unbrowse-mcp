# Unbrowse MCP

[![npm version](https://badge.fury.io/js/unbrowse-mcp.svg)](https://www.npmjs.com/package/unbrowse-mcp)
[![smithery badge](https://smithery.ai/badge/@lekt9/unbrowse-mcp)](https://smithery.ai/server/@lekt9/unbrowse-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**The Internet-Use layer for AI Agents** - A Model Context Protocol (MCP) server that enables AI to interact with websites at the network level.

## Why Unbrowse?

Current AI browser automation is slow, unreliable, and expensive. Unbrowse provides:

- **50x faster** - Execute actions in <2 seconds vs 5-60 seconds
- **90%+ reliability** - Compared to 70-85% with browser automation
- **20-50x cost reduction** - $0.001-$0.006 per operation
- **Universal coverage** - Works with most websites, not just the ~1% with APIs

## Documentation

Full documentation is available at **[getfoundry.gitbook.io/unbrowse](https://getfoundry.gitbook.io/unbrowse/)**

## Quick Start

### Installation

```bash
# Run directly with npx
npx unbrowse-mcp

# Or install globally
npm install -g unbrowse-mcp
```

### Via Smithery

```bash
npx -y @smithery/cli install @lekt9/unbrowse-mcp
```

### Claude Desktop Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "unbrowse": {
      "command": "npx",
      "args": ["unbrowse-mcp"],
      "env": {
        "UNBROWSE_API_KEY": "re_your_api_key_here"
      }
    }
  }
}
```

## Authentication Options

Choose one of three authentication methods:

### Option 1: API Key (Recommended)

Get your API key from [unbrowse.ai](https://unbrowse.ai):

```bash
export UNBROWSE_API_KEY="re_xxxxxxxxxxxxx"
```

### Option 2: Session Token

Use a session token from browser cookies:

```bash
export UNBROWSE_SESSION_TOKEN="cm4xxxxxxxxxxxxx"
```

### Option 3: x402 Payment Mode (Pay-Per-Request)

Use a Solana wallet with USDC - no account required:

```bash
export SOLANA_PRIVATE_KEY="your_base58_encoded_private_key"
export SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"  # optional
```

**Pricing:** 0.1 cents per search, 0.5 cents per execution

## Available Tools

| Tool | Description |
|------|-------------|
| `search_abilities` | Search for indexed web abilities using natural language |
| `execute_abilities` | Execute multiple abilities in parallel |
| `search_abilities_parallel` | Run multiple searches simultaneously |
| `ingest_api_endpoint` | Index new API endpoints (optional) |
| `get_payment_history` | View x402 payment history (x402 mode only) |

## Environment Variables

```bash
# Authentication (choose ONE)
UNBROWSE_API_KEY=re_xxxxxxxxxxxxx
UNBROWSE_SESSION_TOKEN=cm4xxxxxxxxxxxxx
SOLANA_PRIVATE_KEY=your_base58_key

# Optional
UNBROWSE_PASSWORD=your_encryption_password  # For credential decryption
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
DEV_MODE=true  # Show API usage docs in search results
ENABLE_INDEX_TOOL=true  # Enable API indexing tool
SENTRY_DSN=your_sentry_dsn  # Error tracking (optional)
```

## Use Cases

- **Investment Analysis** - Aggregate financial data across platforms
- **Social Media Management** - Automate cross-platform posting
- **Customer Support** - Integrate with ticketing systems
- **E-commerce** - Monitor prices, manage inventory
- **Project Management** - Sync tasks across tools

See the [documentation](https://getfoundry.gitbook.io/unbrowse/) for detailed use cases.

## Development

```bash
# Clone the repository
git clone https://github.com/lekt9/unbrowse-mcp.git
cd unbrowse-mcp

# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](LICENSE)

## Links

- [Documentation](https://getfoundry.gitbook.io/unbrowse/)
- [NPM Package](https://www.npmjs.com/package/unbrowse-mcp)
- [Smithery](https://smithery.ai/server/@lekt9/unbrowse-mcp)
- [GitHub Issues](https://github.com/lekt9/unbrowse-mcp/issues)
