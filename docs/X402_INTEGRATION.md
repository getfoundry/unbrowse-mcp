# x402 Protocol Integration Guide

> **Status**: 🚧 In Development
> **Version**: 2.0.0
> **Last Updated**: 2025-10-25

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [What is x402?](#what-is-x402)
3. [Why x402 for Foundry?](#why-x402-for-foundry)
4. [Architecture Overview](#architecture-overview)
5. [Implementation Guide](#implementation-guide)
6. [MCP Server Integration](#mcp-server-integration)
7. [Migration from Token System](#migration-from-token-system)
8. [API Reference](#api-reference)
9. [Security & Best Practices](#security--best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Executive Summary

**x402** is Coinbase's HTTP-based payment protocol that enables instant **USDC stablecoin payments** directly over HTTP using the HTTP 402 "Payment Required" status code. This document outlines how Foundry integrates x402 to replace the internal token system with **real blockchain-based payments**.

### Key Benefits

✅ **Real Crypto Payments** - Actual USDC on Base network, not simulated tokens
✅ **Zero Protocol Fees** - Base network = near-zero gas fees
✅ **Instant Settlement** - Real-time payouts, no withdrawal delays
✅ **Payment = Authentication** - No sessions, API keys, or OAuth needed
✅ **AI Agent Native** - Autonomous agents can pay and access APIs
✅ **Micropayment Economics** - Support payments as low as $0.001
✅ **Transparent Revenue** - On-chain accounting, automatic splits

---

## What is x402?

### Overview

x402 is an **open payment protocol** that resurrects the HTTP 402 "Payment Required" status code, enabling seamless cryptocurrency payments within standard HTTP requests.

### Core Principle

> **"Payment IS Authentication"**
>
> If you can pay, you can access. No registration, no accounts, no complex OAuth flows.

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                     x402 Payment Flow                            │
└─────────────────────────────────────────────────────────────────┘

1. Client Request
   ↓
   GET /abilities/123/execute

2. Server Response: HTTP 402 Payment Required
   ↓
   {
     "error": "Payment Required",
     "payment": {
       "amount": "0.05",
       "currency": "USDC",
       "network": "base",
       "recipient": "0xABC123..."
     }
   }
   Headers: X-PAYMENT-REQUIRED: x402/1.0

3. Client Submits Payment
   ↓
   GET /abilities/123/execute
   Headers: X-PAYMENT: {signed_transaction_payload}

4. Coinbase Facilitator Verifies & Settles
   ↓
   On-chain USDC transfer verified

5. Server Delivers Resource
   ↓
   {
     "success": true,
     "result": {...},
     "payment_confirmed": "0.05 USDC"
   }
   Headers: X-PAYMENT-RESPONSE: {confirmation}
```

### Technical Specs

- **Protocol**: HTTP/HTTPS with custom headers
- **Currency**: USDC (or any stablecoin)
- **Network**: Base L2 (Ethereum Layer 2)
- **Settlement**: Instant on-chain verification
- **Fees**: Zero protocol fees, minimal gas (~$0.0001)
- **Standard**: Open standard, chain-agnostic

---

## Why x402 for Foundry?

### Problem with Internal Token System

Your current rewards system uses **simulated USD tokens** stored in PostgreSQL:

**Limitations:**
- ❌ Not real money - users can't spend it elsewhere
- ❌ Requires withdrawal system (complex, KYC issues)
- ❌ Session management overhead (cookies, API keys, auth)
- ❌ Can't be used by AI agents autonomously
- ❌ No on-chain transparency
- ❌ Platform risk (users must trust you)

### Solution with x402

**Benefits:**
- ✅ Real USDC that users own in their wallets
- ✅ Instant settlement - no withdrawals needed
- ✅ Payment = Authentication (eliminates auth complexity)
- ✅ AI agents can pay automatically
- ✅ Transparent on-chain accounting
- ✅ Trustless - users control their funds

### Perfect Fit for Foundry

| Foundry Feature | x402 Enhancement |
|-----------------|------------------|
| **Ability Execution** | Pay $0.001-$1 per API call via x402 |
| **Search Results** | Charge $0.008 per result with instant USDC payment |
| **Indexer Rewards** | Auto-distribute 50% to indexer's wallet in USDC |
| **Website Owner Revenue** | Send 30% directly to verified owner's wallet |
| **Platform Fees** | Collect 20% in USDC automatically |
| **AI Agent Access** | Agents pay for APIs autonomously without human intervention |

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                   Foundry x402 Architecture                      │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐
│   Client     │ (Browser, AI Agent, MCP Server)
│              │
│ - CDP Wallet │ (USDC on Base)
│ - x402 SDK   │ (@coinbase/x402)
└──────┬───────┘
       │
       │ HTTP Request with X-PAYMENT header
       │
       ↓
┌──────────────────────────────────────────────────────────────────┐
│                    Foundry API Server                             │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  x402 Middleware (Express/Hono)                            │  │
│  │  - Detects X-PAYMENT header                                │  │
│  │  - Calls Coinbase Facilitator                              │  │
│  │  - Verifies on-chain payment                               │  │
│  └────────────────┬───────────────────────────────────────────┘  │
│                   │                                               │
│                   ↓                                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Payment Routes                                            │  │
│  │  - /abilities/search (x402 protected)                      │  │
│  │  - /abilities/:id/execute (x402 protected)                 │  │
│  │  - /abilities/ingest (free, creates rewards)               │  │
│  └────────────────┬───────────────────────────────────────────┘  │
│                   │                                               │
│                   ↓                                               │
│  ┌──────────────────────────────────────────────���─────────────┐  │
│  │  Revenue Distribution Service                              │  │
│  │  - 50% → Indexer wallet (USDC)                             │  │
│  │  - 30% → Website owner wallet (USDC)                       │  │
│  │  - 20% → Platform wallet (USDC)                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
       │
       │ Verification & Settlement
       │
       ↓
┌──────────────────────────────────────────────────────────────────┐
│            Coinbase x402 Facilitator Service                      │
│  - Verifies payment signatures                                    │
│  - Settles USDC on Base network                                   │
│  - Returns confirmation                                           │
└───────────────────────────────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────────────────────────────┐
│                   Base Network (Layer 2)                          │
│  - USDC transfers settled on-chain                                │
│  - Transparent, immutable, auditable                              │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow

**Before (Internal Tokens):**
```
User → Login → Session Cookie → Check Balance → Charge Tokens → Update PostgreSQL
```

**After (x402):**
```
User → Send USDC → x402 Middleware → Verify On-Chain → Distribute Revenue → Deliver Resource
```

---

## Implementation Guide

### Prerequisites

1. **Coinbase Developer Platform Account**
   - Sign up at [developers.coinbase.com](https://developers.coinbase.com)
   - Create API credentials (API Key + Secret)

2. **CDP Wallet Setup**
   - Create a server-side wallet for receiving payments
   - Generate wallet address for platform fees

3. **Base Network Access**
   - USDC on Base network for testing
   - Faucet for testnet USDC

### Step 1: Install Dependencies

```bash
# Core x402 packages
pnpm add @coinbase/x402 @coinbase/cdp-sdk

# HTTP client with x402 support
pnpm add x402-axios x402-fetch

# For Express middleware (if using Express)
pnpm add x402-express

# For Hono middleware (recommended for Foundry)
pnpm add hono-x402  # (or implement custom middleware)
```

### Step 2: Environment Configuration

Add to your `.env` file:

```bash
# ============================================================================
# X402 PROTOCOL CONFIGURATION
# ============================================================================

# Coinbase Developer Platform
CDP_API_KEY_NAME=your_api_key_name
CDP_API_KEY_PRIVATE_KEY=your_private_key

# Platform Wallet (receives platform fees)
X402_PLATFORM_WALLET=0xYourPlatformWalletAddress
X402_PLATFORM_PRIVATE_KEY=0xYourPlatformPrivateKey

# x402 Facilitator
X402_FACILITATOR_URL=https://facilitator.x402.org
X402_NETWORK=base  # or base-sepolia for testnet

# Revenue Distribution (must sum to 100%)
X402_INDEXER_PERCENTAGE=50
X402_WEBSITE_OWNER_PERCENTAGE=30
X402_PLATFORM_PERCENTAGE=20

# Pricing (USDC amounts)
X402_SEARCH_COST_PER_RESULT=0.008
X402_EXECUTION_BASE_COST=0.05

# Features
X402_ENABLED=true
X402_TESTNET=false  # true for testing
```

### Step 3: Create x402 Service

Create `src/server/x402-service.ts`:

```typescript
import { Coinbase, Wallet } from '@coinbase/cdp-sdk';
import { type PaymentRequest, type PaymentResponse } from '@coinbase/x402';

/**
 * x402 Payment Service
 * Handles payment verification and revenue distribution
 */
export class X402Service {
  private coinbase: Coinbase;
  private platformWallet: Wallet;

  constructor() {
    this.coinbase = new Coinbase({
      apiKeyName: process.env.CDP_API_KEY_NAME!,
      privateKey: process.env.CDP_API_KEY_PRIVATE_KEY!,
    });

    // Initialize platform wallet
    this.platformWallet = Wallet.import({
      privateKey: process.env.X402_PLATFORM_PRIVATE_KEY!,
      networkId: process.env.X402_NETWORK || 'base',
    });
  }

  /**
   * Create a payment request for an API call
   */
  async createPaymentRequest(
    amount: number,
    description: string,
    metadata?: Record<string, any>
  ): Promise<PaymentRequest> {
    return {
      amount: amount.toString(),
      currency: 'USDC',
      network: process.env.X402_NETWORK || 'base',
      recipient: process.env.X402_PLATFORM_WALLET!,
      description,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        version: 'x402/1.0',
      },
    };
  }

  /**
   * Verify a payment from the X-PAYMENT header
   */
  async verifyPayment(paymentPayload: string): Promise<PaymentResponse> {
    const facilitatorUrl = process.env.X402_FACILITATOR_URL!;

    // Call Coinbase Facilitator to verify payment
    const response = await fetch(`${facilitatorUrl}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`,
      },
      body: JSON.stringify({ payment: paymentPayload }),
    });

    if (!response.ok) {
      throw new Error(`Payment verification failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  }

  /**
   * Distribute revenue to indexer, website owner, and platform
   */
  async distributeRevenue(
    totalAmount: number,
    indexerWallet: string,
    websiteOwnerWallet?: string,
    metadata?: Record<string, any>
  ): Promise<{
    indexerPaid: number;
    ownerPaid: number;
    platformPaid: number;
  }> {
    const indexerPct = parseFloat(process.env.X402_INDEXER_PERCENTAGE || '50');
    const ownerPct = parseFloat(process.env.X402_WEBSITE_OWNER_PERCENTAGE || '30');
    const platformPct = parseFloat(process.env.X402_PLATFORM_PERCENTAGE || '20');

    const indexerAmount = (totalAmount * indexerPct) / 100;
    const ownerAmount = (totalAmount * ownerPct) / 100;
    const platformAmount = (totalAmount * platformPct) / 100;

    // Send USDC to indexer
    await this.sendUSDC(indexerWallet, indexerAmount, {
      ...metadata,
      type: 'indexer_reward',
    });

    // Send USDC to website owner (if verified)
    let ownerPaid = 0;
    if (websiteOwnerWallet) {
      await this.sendUSDC(websiteOwnerWallet, ownerAmount, {
        ...metadata,
        type: 'website_owner_revenue',
      });
      ownerPaid = ownerAmount;
    } else {
      // If no website owner, platform keeps the extra
      await this.sendUSDC(
        process.env.X402_PLATFORM_WALLET!,
        ownerAmount,
        { ...metadata, type: 'unclaimed_owner_revenue' }
      );
    }

    // Platform fee already in our wallet (payment recipient)

    return {
      indexerPaid: indexerAmount,
      ownerPaid,
      platformPaid: platformAmount + (websiteOwnerWallet ? 0 : ownerAmount),
    };
  }

  /**
   * Send USDC to a wallet address
   */
  private async sendUSDC(
    recipientAddress: string,
    amount: number,
    metadata?: Record<string, any>
  ): Promise<string> {
    const transfer = await this.platformWallet.transfer({
      amount: amount.toString(),
      assetId: 'USDC',
      destination: recipientAddress,
      gasless: true, // Use gasless transactions for better UX
    });

    await transfer.wait();

    console.log(`[x402] Sent ${amount} USDC to ${recipientAddress}`, metadata);

    return transfer.getTransactionHash()!;
  }

  /**
   * Get auth token for Coinbase Facilitator
   */
  private async getAuthToken(): Promise<string> {
    // CDP SDK handles authentication automatically
    return this.coinbase.apiKey;
  }
}

// Singleton instance
export const x402Service = new X402Service();
```

### Step 4: Create x402 Middleware

Create `src/server/x402-middleware.ts`:

```typescript
import { type Context, type Next } from 'hono';
import { x402Service } from './x402-service';

/**
 * x402 Payment Middleware for Hono
 * Intercepts requests to check for payments
 */
export async function x402Middleware(c: Context, next: Next) {
  const paymentHeader = c.req.header('X-PAYMENT');

  // If no payment header, request payment
  if (!paymentHeader) {
    return requirePayment(c);
  }

  // Verify payment
  try {
    const paymentResponse = await x402Service.verifyPayment(paymentHeader);

    if (!paymentResponse.verified) {
      return c.json(
        { error: 'Payment verification failed', details: paymentResponse.error },
        402
      );
    }

    // Store payment info in context for route handlers
    c.set('payment', paymentResponse);
    c.set('paidAmount', parseFloat(paymentResponse.amount));

    // Add payment confirmation header
    c.header('X-PAYMENT-RESPONSE', JSON.stringify({
      status: 'confirmed',
      amount: paymentResponse.amount,
      transactionHash: paymentResponse.transactionHash,
    }));

    await next();
  } catch (error) {
    console.error('[x402] Payment verification error:', error);
    return c.json(
      { error: 'Payment processing failed', message: error.message },
      500
    );
  }
}

/**
 * Return HTTP 402 Payment Required with payment details
 */
function requirePayment(c: Context) {
  const path = c.req.path;
  const amount = calculatePaymentAmount(path, c);

  const paymentRequest = {
    error: 'Payment Required',
    payment: {
      amount: amount.toString(),
      currency: 'USDC',
      network: process.env.X402_NETWORK || 'base',
      recipient: process.env.X402_PLATFORM_WALLET!,
      description: getPaymentDescription(path),
    },
  };

  c.header('X-PAYMENT-REQUIRED', 'x402/1.0');
  c.header('X-PAYMENT-METHODS', 'stablecoin');

  return c.json(paymentRequest, 402);
}

/**
 * Calculate payment amount based on endpoint
 */
function calculatePaymentAmount(path: string, c: Context): number {
  if (path.includes('/search')) {
    const limit = parseInt(c.req.query('limit') || '10');
    return parseFloat(process.env.X402_SEARCH_COST_PER_RESULT || '0.008') * limit;
  }

  if (path.includes('/execute')) {
    return parseFloat(process.env.X402_EXECUTION_BASE_COST || '0.05');
  }

  return 0.01; // Default
}

/**
 * Get human-readable payment description
 */
function getPaymentDescription(path: string): string {
  if (path.includes('/search')) return 'Search Foundry abilities';
  if (path.includes('/execute')) return 'Execute API ability';
  return 'Foundry API access';
}
```

### Step 5: Update Routes

Update `src/server/routes.ts` to use x402:

```typescript
import { Hono } from 'hono';
import { x402Middleware } from './x402-middleware';
import { x402Service } from './x402-service';

const app = new Hono();

/**
 * Search Abilities (x402 Protected)
 * Payment required for search results
 */
app.get('/abilities/search', x402Middleware, async (c) => {
  const query = c.req.query('q');
  const limit = parseInt(c.req.query('limit') || '10');
  const paidAmount = c.get('paidAmount');

  // Perform search
  const results = await searchAbilities(query, limit);

  // Calculate expected cost
  const expectedCost = results.length * parseFloat(process.env.X402_SEARCH_COST_PER_RESULT || '0.008');

  if (paidAmount < expectedCost) {
    return c.json(
      { error: 'Insufficient payment', required: expectedCost, paid: paidAmount },
      402
    );
  }

  // Distribute revenue to indexers
  for (const result of results) {
    const ability = result.ability;
    const costPerResult = parseFloat(process.env.X402_SEARCH_COST_PER_RESULT || '0.008');

    await x402Service.distributeRevenue(
      costPerResult,
      ability.indexerWallet,
      ability.websiteOwnerWallet,
      {
        abilityId: ability.id,
        action: 'search',
        query,
      }
    );
  }

  return c.json({
    success: true,
    count: results.length,
    abilities: results,
    payment: {
      amount: paidAmount,
      distributed: true,
    },
  });
});

/**
 * Execute Ability (x402 Protected)
 * Payment required for execution
 */
app.post('/abilities/:id/execute', x402Middleware, async (c) => {
  const abilityId = c.req.param('id');
  const paidAmount = c.get('paidAmount');
  const body = await c.req.json();

  // Get ability details
  const ability = await getAbility(abilityId);

  if (!ability) {
    return c.json({ error: 'Ability not found' }, 404);
  }

  const executionCost = parseFloat(process.env.X402_EXECUTION_BASE_COST || '0.05');

  if (paidAmount < executionCost) {
    return c.json(
      { error: 'Insufficient payment', required: executionCost, paid: paidAmount },
      402
    );
  }

  // Execute the ability
  const result = await executeAbility(ability, body.parameters);

  // Distribute revenue
  await x402Service.distributeRevenue(
    executionCost,
    ability.indexerWallet,
    ability.websiteOwnerWallet,
    {
      abilityId: ability.id,
      action: 'execution',
    }
  );

  return c.json({
    success: true,
    result,
    payment: {
      amount: paidAmount,
      distributed: true,
    },
  });
});

/**
 * Ingest Ability (FREE - Creates Reward Potential)
 * No payment required, but indexer must provide wallet address
 */
app.post('/abilities/ingest', async (c) => {
  const body = await c.req.json();
  const { ability, indexerWallet } = body;

  if (!indexerWallet) {
    return c.json(
      { error: 'indexerWallet is required for x402 revenue distribution' },
      400
    );
  }

  // Validate wallet address
  if (!isValidEthereumAddress(indexerWallet)) {
    return c.json({ error: 'Invalid Ethereum wallet address' }, 400);
  }

  // Store ability with indexer wallet
  const created = await createAbility({
    ...ability,
    indexerWallet,
  });

  return c.json({
    success: true,
    ability: created,
    message: 'You will receive USDC rewards when users search/execute this ability',
  });
});

export default app;
```

---

## MCP Server Integration

### Overview

**MCP (Model Context Protocol)** is Anthropic's standard for connecting AI assistants (like Claude) to external tools and data sources. With **x402-mcp**, AI agents can autonomously pay for API access using USDC.

### Use Case: Claude Desktop with x402

```
User: "Claude, search Foundry for Stripe payment abilities"
       ↓
Claude (via MCP): Calls Foundry /abilities/search
       ↓
Foundry API: Returns HTTP 402 Payment Required (0.08 USDC for 10 results)
       ↓
Claude MCP Client: Automatically sends USDC payment from CDP wallet
       ↓
Foundry API: Verifies payment, returns results, distributes rewards
       ↓
Claude: "I found 10 Stripe payment abilities. Here they are..."
```

### Setting Up x402-mcp

#### Step 1: Install MCP Server Package

```bash
npm install -g @civic/x402-mcp
```

#### Step 2: Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "foundry-x402": {
      "command": "npx",
      "args": [
        "@civic/x402-mcp",
        "--endpoint", "https://api.foundry.com",
        "--wallet-key", "YOUR_CDP_WALLET_PRIVATE_KEY",
        "--network", "base",
        "--max-payment", "1.0"
      ],
      "env": {
        "CDP_API_KEY_NAME": "your_api_key_name",
        "CDP_API_KEY_PRIVATE_KEY": "your_private_key"
      }
    }
  }
}
```

#### Step 3: Define Paid Tools

In your Foundry MCP server implementation:

```typescript
import { createMCPServer } from '@civic/x402-mcp';

const server = createMCPServer({
  name: 'foundry-x402',
  version: '1.0.0',

  // Define paid tools
  paidTools: [
    {
      name: 'search_abilities',
      description: 'Search for API abilities in Foundry',
      price: '0.08', // USDC per call (10 results)
      pricePerUnit: '0.008', // USDC per result
      schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', default: 10 },
        },
        required: ['query'],
      },
      handler: async (args) => {
        // This will automatically trigger x402 payment flow
        const response = await fetch('https://api.foundry.com/abilities/search', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            // x402-mcp automatically adds X-PAYMENT header
          },
        });

        return response.json();
      },
    },

    {
      name: 'execute_ability',
      description: 'Execute an API ability',
      price: '0.05', // USDC per execution
      schema: {
        type: 'object',
        properties: {
          abilityId: { type: 'string' },
          parameters: { type: 'object' },
        },
        required: ['abilityId'],
      },
      handler: async (args) => {
        const response = await fetch(
          `https://api.foundry.com/abilities/${args.abilityId}/execute`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parameters: args.parameters }),
          }
        );

        return response.json();
      },
    },
  ],

  // Free tools (no payment required)
  tools: [
    {
      name: 'get_ability',
      description: 'Get details of a specific ability (free)',
      schema: {
        type: 'object',
        properties: {
          abilityId: { type: 'string' },
        },
        required: ['abilityId'],
      },
      handler: async (args) => {
        const response = await fetch(
          `https://api.foundry.com/abilities/${args.abilityId}`
        );
        return response.json();
      },
    },
  ],
});

server.listen(3000);
```

### MCP Client Example (TypeScript)

Create a custom MCP client that uses your Foundry API:

```typescript
import { createClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { privateKeyToAccount } from 'viem/accounts';
import { withPaymentInterceptor } from 'x402-axios';
import axios from 'axios';

// Initialize CDP wallet
const account = privateKeyToAccount(process.env.PRIVATE_KEY!);

// Create axios client with x402 payment interceptor
const client = withPaymentInterceptor(
  axios.create({ baseURL: 'https://api.foundry.com' }),
  account,
  {
    network: 'base',
    facilitatorUrl: 'https://facilitator.x402.org',
  }
);

// Use MCP client
const mcpClient = createClient({
  name: 'foundry-mcp-client',
  version: '1.0.0',
});

// Connect to MCP server
const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/mcp-server.js'],
});

await mcpClient.connect(transport);

// AI agent calls tool - payment happens automatically
const result = await mcpClient.callTool({
  name: 'search_abilities',
  arguments: {
    query: 'stripe payment',
    limit: 10,
  },
});

console.log('Search results:', result);
// x402-axios automatically:
// 1. Received HTTP 402 Payment Required
// 2. Signed USDC payment with CDP wallet
// 3. Sent X-PAYMENT header
// 4. Received results after payment confirmation
```

### MCP Server Security

**Spending Limits:**

```typescript
const server = createMCPServer({
  // ...
  paymentConfig: {
    maxPaymentPerCall: '1.0', // Max 1 USDC per tool call
    maxDailySpend: '10.0', // Max 10 USDC per day
    requireConfirmation: true, // Prompt user for payments > threshold
    confirmationThreshold: '0.1', // Ask user if payment > 0.10 USDC
  },
});
```

**Wallet Security:**

- Use **separate wallets** for MCP clients (not your main wallet)
- Fund with **limited amounts** (e.g., $10-100 USDC)
- Enable **spend alerts** via Coinbase CDP
- Monitor **transaction logs**

---

## Migration from Token System

### Migration Strategy

**Phase 1: Parallel Operation (Recommended)**
- Keep existing token system operational
- Add x402 as alternative payment method
- Let users choose: tokens or USDC
- Monitor adoption and performance

**Phase 2: Gradual Transition**
- Deprecate token purchases
- Convert existing balances to USDC vouchers
- Give users 90-day notice

**Phase 3: Full x402**
- Remove token system entirely
- All payments via x402
- Pure crypto-native economy

### Database Changes

**Keep These Tables:**
```sql
-- Still needed for tracking (audit trail)
token_transactions  -- Rename to payment_transactions
ability_rewards     -- Rename to ability_revenue
domain_ownership    -- Still needed
```

**Remove These Tables:**
```sql
-- No longer needed
user_token_balance  -- Replaced by CDP wallet balances
reward_config       -- Replaced by .env variables
```

**Add New Tables:**
```sql
-- Track x402 payments
CREATE TABLE x402_payments (
  payment_id UUID PRIMARY KEY,
  user_wallet VARCHAR(42) NOT NULL,  -- Ethereum address
  amount DECIMAL(20, 6) NOT NULL,    -- USDC amount
  transaction_hash VARCHAR(66),       -- On-chain tx hash
  ability_id UUID,
  action_type action_type NOT NULL,  -- search, execution
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Track revenue distributions
CREATE TABLE x402_distributions (
  distribution_id UUID PRIMARY KEY,
  payment_id UUID REFERENCES x402_payments(payment_id),
  recipient_wallet VARCHAR(42) NOT NULL,
  amount DECIMAL(20, 6) NOT NULL,
  recipient_type VARCHAR(20),  -- indexer, website_owner, platform
  transaction_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Code Migration

**Before (Token System):**
```typescript
// Check balance
const balance = await getUserBalance(userId);
if (balance < cost) {
  return c.json({ error: 'Insufficient balance' }, 402);
}

// Charge tokens
await chargeTokens(userId, cost);
await distributeRewards(abilityId, cost);
```

**After (x402):**
```typescript
// Payment happens in middleware (automatic)
// Revenue distribution in route handler
await x402Service.distributeRevenue(
  paidAmount,
  ability.indexerWallet,
  ability.websiteOwnerWallet
);
```

**Data Migration Script:**
```typescript
// migrate-to-x402.ts
import { db } from './db';
import { users, userTokenBalance } from './db/schema';

async function migrateToX402() {
  console.log('Starting x402 migration...');

  // 1. Export user balances
  const balances = await db.select().from(userTokenBalance);

  for (const balance of balances) {
    if (parseFloat(balance.balance) > 0) {
      // Create USDC voucher code for existing balance
      const voucherCode = await createUSDCVoucher(
        balance.userId,
        parseFloat(balance.balance)
      );

      console.log(`User ${balance.userId}: ${balance.balance} → Voucher: ${voucherCode}`);

      // Email user with voucher code
      await sendMigrationEmail(balance.userId, {
        oldBalance: balance.balance,
        voucherCode,
        instructions: 'Redeem this voucher for USDC in your CDP wallet',
      });
    }
  }

  console.log('Migration complete!');
}
```

---

## API Reference

### x402 Headers

**Request Headers:**
```
X-PAYMENT: <base64_encoded_payment_payload>
```

**Response Headers:**
```
X-PAYMENT-REQUIRED: x402/1.0
X-PAYMENT-METHODS: stablecoin
X-PAYMENT-RESPONSE: {"status":"confirmed","amount":"0.05","transactionHash":"0xABC..."}
```

### Payment Request Format

```typescript
interface PaymentRequest {
  error: "Payment Required";
  payment: {
    amount: string;        // USDC amount (e.g., "0.05")
    currency: string;      // "USDC"
    network: string;       // "base" or "base-sepolia"
    recipient: string;     // Ethereum address (0x...)
    description: string;   // Human-readable description
    metadata?: object;     // Optional metadata
  }
}
```

### Payment Payload Format

```typescript
interface PaymentPayload {
  from: string;           // Sender wallet address
  to: string;             // Recipient wallet address
  amount: string;         // USDC amount
  network: string;        // "base"
  token: string;          // "USDC"
  signature: string;      // EIP-712 signature
  nonce: number;          // Transaction nonce
  timestamp: number;      // Unix timestamp
}
```

### Response Format

**Success (200 OK):**
```json
{
  "success": true,
  "result": { ... },
  "payment": {
    "amount": "0.05",
    "distributed": true,
    "indexerPaid": "0.025",
    "ownerPaid": "0.015",
    "platformPaid": "0.01"
  }
}
```

**Payment Required (402):**
```json
{
  "error": "Payment Required",
  "payment": {
    "amount": "0.08",
    "currency": "USDC",
    "network": "base",
    "recipient": "0xABC123...",
    "description": "Search Foundry abilities"
  }
}
```

**Insufficient Payment (402):**
```json
{
  "error": "Insufficient payment",
  "required": "0.08",
  "paid": "0.05"
}
```

---

## Security & Best Practices

### Wallet Security

1. **Separate Wallets**
   - Use different wallets for: platform fees, testing, production
   - Never share private keys in code or env files
   - Use secret management (AWS Secrets Manager, Vault)

2. **Spending Limits**
   - Set max payment per call
   - Set daily spending limits
   - Require confirmation for large payments

3. **Transaction Monitoring**
   - Log all payments to database
   - Alert on suspicious patterns
   - Regular audit of on-chain transactions

### Payment Verification

```typescript
// Always verify payment before delivering resource
async function verifyPaymentSecurity(payment: PaymentResponse) {
  // 1. Check payment amount
  if (parseFloat(payment.amount) < requiredAmount) {
    throw new Error('Insufficient payment');
  }

  // 2. Check timestamp (prevent replay attacks)
  const age = Date.now() - payment.timestamp;
  if (age > 60000) { // 1 minute
    throw new Error('Payment expired');
  }

  // 3. Check signature
  if (!payment.verified) {
    throw new Error('Payment not verified');
  }

  // 4. Check nonce (prevent double-spend)
  const used = await isNonceUsed(payment.nonce);
  if (used) {
    throw new Error('Payment already processed');
  }

  // 5. Mark nonce as used
  await markNonceUsed(payment.nonce);

  return true;
}
```

### Rate Limiting

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 calls per minute
  analytics: true,
});

// Apply to x402 endpoints
app.use('/abilities/*', async (c, next) => {
  const wallet = c.req.header('X-PAYMENT-FROM') || 'anonymous';
  const { success } = await ratelimit.limit(wallet);

  if (!success) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  await next();
});
```

### Error Handling

```typescript
// Graceful degradation if x402 fails
app.get('/abilities/search', async (c) => {
  try {
    // Try x402 payment
    return await x402Middleware(c, searchHandler);
  } catch (error) {
    console.error('[x402] Payment failed:', error);

    // Fallback to token system (during migration)
    if (process.env.X402_FALLBACK_ENABLED === 'true') {
      return await tokenMiddleware(c, searchHandler);
    }

    return c.json(
      { error: 'Payment system unavailable', details: error.message },
      503
    );
  }
});
```

---

## Troubleshooting

### Common Issues

#### 1. Payment Verification Failed

**Error:**
```
Payment verification failed: Invalid signature
```

**Causes:**
- Wrong network (mainnet vs testnet)
- Incorrect wallet private key
- Expired payment timestamp

**Fix:**
```typescript
// Check network configuration
console.log('Network:', process.env.X402_NETWORK);
console.log('Facilitator:', process.env.X402_FACILITATOR_URL);

// Verify wallet address matches
const wallet = Wallet.import({ privateKey: process.env.X402_PLATFORM_PRIVATE_KEY! });
console.log('Expected recipient:', process.env.X402_PLATFORM_WALLET);
console.log('Actual wallet:', wallet.getDefaultAddress());
```

#### 2. Insufficient Gas

**Error:**
```
Transaction failed: insufficient funds for gas
```

**Fix:**
- Use gasless transactions via CDP:
```typescript
const transfer = await wallet.transfer({
  amount: '0.05',
  assetId: 'USDC',
  destination: recipientAddress,
  gasless: true, // Let Coinbase cover gas fees
});
```

#### 3. USDC Balance Too Low

**Error:**
```
Transfer failed: insufficient USDC balance
```

**Fix:**
```typescript
// Check platform wallet USDC balance
const balance = await wallet.getBalance('USDC');
console.log('Platform USDC balance:', balance);

// Alert if low
if (parseFloat(balance) < 100) {
  await sendAlert('Platform wallet USDC low: ' + balance);
}
```

#### 4. Facilitator Timeout

**Error:**
```
Facilitator request timed out
```

**Fix:**
```typescript
// Increase timeout
const response = await fetch(facilitatorUrl, {
  signal: AbortSignal.timeout(30000), // 30 seconds
});

// Retry logic
async function verifyWithRetry(payment: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await x402Service.verifyPayment(payment);
    } catch (error) {
      if (i === retries - 1) throw error;
      await sleep(1000 * (i + 1)); // Exponential backoff
    }
  }
}
```

### Testing

**Testnet Setup:**
```bash
# Use Base Sepolia testnet
X402_NETWORK=base-sepolia
X402_FACILITATOR_URL=https://facilitator.sepolia.x402.org
X402_TESTNET=true

# Get testnet USDC from faucet
# Visit: https://faucet.circle.com
```

**Test Script:**
```typescript
// test-x402.ts
import { x402Service } from './src/server/x402-service';

async function testX402() {
  console.log('Testing x402 integration...\n');

  // 1. Create payment request
  const paymentReq = await x402Service.createPaymentRequest(
    0.05,
    'Test payment'
  );
  console.log('✅ Payment request created:', paymentReq);

  // 2. Simulate payment (testnet)
  const testPayload = await createTestPayment(paymentReq);

  // 3. Verify payment
  const verified = await x402Service.verifyPayment(testPayload);
  console.log('✅ Payment verified:', verified);

  // 4. Test revenue distribution
  const distribution = await x402Service.distributeRevenue(
    0.05,
    '0xIndexerWallet...',
    '0xOwnerWallet...'
  );
  console.log('✅ Revenue distributed:', distribution);

  console.log('\n✅ All tests passed!');
}

testX402().catch(console.error);
```

---

## Conclusion

x402 integration transforms Foundry from a **simulated token economy** into a **real crypto-native marketplace** where:

- ✅ Users pay with **real USDC** they control
- ✅ Indexers earn **instant payouts** to their wallets
- ✅ Website owners receive **automatic revenue share**
- ✅ AI agents can **autonomously pay** for API access
- ✅ All transactions are **transparent and on-chain**

**Total Implementation**: ~1,500 lines of code across 5 files

**Ready to deploy and scale with x402!** 🚀

---

## Additional Resources

- **x402 Protocol**: https://x402.org
- **GitHub**: https://github.com/coinbase/x402
- **Coinbase CDP**: https://developers.coinbase.com
- **MCP Integration**: https://www.npmjs.com/package/@civic/x402-mcp
- **Base Network**: https://base.org
- **USDC Documentation**: https://www.circle.com/en/usdc

---

**Version**: 2.0.0
**Last Updated**: 2025-10-25
**Maintainer**: Foundry Team
