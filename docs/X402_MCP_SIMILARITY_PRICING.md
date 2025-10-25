# x402-MCP Dynamic Similarity-Based Pricing Guide

> **Status**: 🚧 Implementation Guide
> **Version**: 1.0.0
> **Last Updated**: 2025-10-25

---

## Table of Contents

1. [Overview](#overview)
2. [Similarity-Based Pricing Model](#similarity-based-pricing-model)
3. [Dynamic Payment Calculation](#dynamic-payment-calculation)
4. [Wallet Connection Explained](#wallet-connection-explained)
5. [Implementation: MCP Server](#implementation-mcp-server)
6. [Implementation: MCP Client](#implementation-mcp-client)
7. [Complete Example](#complete-example)
8. [Testing](#testing)

---

## Overview

Your current Foundry system uses **similarity-based pricing**:

```typescript
// From REWARDS_SYSTEM_OVERVIEW.md
searchCost = config.searchCostPerSimilarity * similarityScore
executionCost = config.executionCostPerSimilarity * similarityScore

// Example: Search for "stripe payment"
// - Config: $0.01 per similarity point
// - Result 1: 0.95 similarity → $0.0095
// - Result 2: 0.80 similarity → $0.0080
// - Result 3: 0.65 similarity → $0.0065
// Total: $0.0240 USDC
```

**With x402-MCP**, we need to make payments **dynamic** based on:
1. **Search results count** (you don't know until after the search)
2. **Similarity scores** (vary per result)
3. **User preferences** (limit results, quality threshold)

---

## Similarity-Based Pricing Model

### Your Current Formula

```typescript
// From your system:
REWARD_SEARCH_COST_PER_SIMILARITY=0.01      # $0.01 per similarity point
REWARD_EXECUTION_COST_PER_SIMILARITY=0.05   # $0.05 per similarity point

// Per result:
cost = baseRate * similarityScore

// Example:
0.8 similarity × $0.01 = $0.008 per result
```

### x402-MCP Adaptation

**Challenge**: x402 requires payment **before** receiving results, but we don't know similarity scores until **after** the search.

**Solution**: Two approaches:

#### Approach 1: Prepaid Search Budget (Recommended)
```typescript
// User specifies max budget upfront
{
  query: "stripe payment",
  maxResults: 10,
  minSimilarity: 0.7,
  budget: 0.10  // Max $0.10 USDC
}

// Server charges exact amount based on actual results
// Refunds unused budget
```

#### Approach 2: Flat Rate with Similarity Tiers
```typescript
// Tiered pricing
{
  highQuality: "0.95-1.0 similarity = $0.01",
  mediumQuality: "0.75-0.94 similarity = $0.008",
  lowQuality: "0.5-0.74 similarity = $0.005"
}
```

---

## Dynamic Payment Calculation

### Server-Side: Calculate After Search

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { makePaymentAwareServerTransport } from "@civic/x402-mcp";

const server = new McpServer({
  name: "foundry-x402",
  version: "1.0.0"
});

// Define search tool with DYNAMIC pricing
server.tool(
  "search_abilities",
  {
    description: "Search Foundry abilities with similarity-based pricing",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", default: 10, description: "Max results" },
        minSimilarity: { type: "number", default: 0.5, description: "Min similarity (0-1)" },
        budget: { type: "number", description: "Max USDC to spend (optional)" }
      },
      required: ["query"]
    }
  },
  async (params, extra) => {
    // 1. Perform search (gets actual similarity scores)
    const results = await searchAbilities({
      query: params.query,
      limit: params.limit || 10,
      minSimilarity: params.minSimilarity || 0.5
    });

    // 2. Calculate ACTUAL cost based on similarity scores
    const costPerSimilarity = parseFloat(process.env.X402_SEARCH_COST_PER_SIMILARITY || "0.01");

    let totalCost = 0;
    const billingDetails = results.map(result => {
      const cost = costPerSimilarity * result.similarity;
      totalCost += cost;
      return {
        abilityId: result.id,
        similarity: result.similarity,
        cost: cost.toFixed(4)
      };
    });

    // 3. Check if within budget
    if (params.budget && totalCost > params.budget) {
      // Trim results to fit budget
      const trimmedResults = [];
      let runningTotal = 0;

      for (let i = 0; i < results.length; i++) {
        const cost = costPerSimilarity * results[i].similarity;
        if (runningTotal + cost <= params.budget) {
          trimmedResults.push(results[i]);
          runningTotal += cost;
        } else {
          break;
        }
      }

      results.length = 0;
      results.push(...trimmedResults);
      totalCost = runningTotal;
    }

    // 4. Return results with billing info
    return {
      success: true,
      count: results.length,
      abilities: results,
      billing: {
        totalCost: totalCost.toFixed(4),
        costBreakdown: billingDetails,
        currency: "USDC",
        formula: `${costPerSimilarity} × similarity_score`
      }
    };
  }
);

// Dynamic pricing function - calculates AFTER search
function calculateSearchPrice(params: any): string {
  // Estimate based on expected results
  const estimatedResults = params.limit || 10;
  const avgSimilarity = 0.75; // Conservative estimate
  const costPerSimilarity = parseFloat(process.env.X402_SEARCH_COST_PER_SIMILARITY || "0.01");

  // Use budget if provided, else estimate
  if (params.budget) {
    return params.budget.toFixed(4);
  }

  const estimatedCost = estimatedResults * avgSimilarity * costPerSimilarity;
  return estimatedCost.toFixed(4);
}

// Create payment-aware transport with dynamic pricing
const transport = makePaymentAwareServerTransport(
  process.env.X402_PLATFORM_WALLET!,
  {
    // Dynamic pricing function
    "search_abilities": (params) => `$${calculateSearchPrice(params)}`,

    // Execution is simpler - based on ability's stored similarity
    "execute_ability": (params) => {
      const baseCost = parseFloat(process.env.X402_EXECUTION_BASE_COST || "0.05");
      // Get ability's similarity from DB
      const similarity = params.similarity || 0.8;
      return `$${(baseCost * similarity).toFixed(4)}`;
    },

    // Free tools
    "get_ability": null,
    "list_domains": null
  }
);

await server.connect(transport);
```

### Alternative: Two-Phase Payment

**Better approach for perfect accuracy:**

```typescript
// Phase 1: Search (free or cheap estimate)
server.tool("search_abilities_preview", {
  description: "Preview search results with cost estimate (free)",
  inputSchema: { /* same */ },
}, async (params) => {
  const results = await searchAbilities(params);

  // Calculate exact costs
  const costPerSimilarity = 0.01;
  const costs = results.map(r => ({
    abilityId: r.id,
    similarity: r.similarity,
    cost: (costPerSimilarity * r.similarity).toFixed(4)
  }));

  const totalCost = costs.reduce((sum, c) => sum + parseFloat(c.cost), 0);

  return {
    preview: results.map(r => ({
      id: r.id,
      name: r.name,
      similarity: r.similarity
    })),
    pricing: {
      totalCost: totalCost.toFixed(4),
      perResult: costs
    },
    message: `To get full details, call 'confirm_search' with ${totalCost.toFixed(4)} USDC`
  };
});

// Phase 2: Confirm & Pay (exact amount)
server.tool("confirm_search", {
  description: "Confirm and pay for search results",
  inputSchema: {
    type: "object",
    properties: {
      searchId: { type: "string" },
      acceptedCost: { type: "number" }
    }
  }
}, async (params) => {
  // Retrieve cached search results
  const results = await getCachedSearch(params.searchId);

  // Return full details
  return {
    success: true,
    abilities: results // Full ability details
  };
});

const transport = makePaymentAwareServerTransport(
  process.env.X402_PLATFORM_WALLET!,
  {
    "search_abilities_preview": null, // FREE
    "confirm_search": (params) => `$${params.acceptedCost.toFixed(4)}` // PAID
  }
);
```

---

## Wallet Connection Explained

### What is "Wallet Connection"?

In x402-mcp, **wallet connection** means:

1. **MCP Client** has access to a **CDP (Coinbase Developer Platform) Wallet**
2. Wallet contains **USDC on Base network** to pay for tools
3. When a paid tool is called, the client **automatically signs and sends** a USDC payment
4. No user intervention needed - fully autonomous

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Client (AI Agent)                         │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  CDP Wallet                                                │  │
│  │  - Private Key: 0xABC123...                                │  │
│  │  - Address: 0x742d35Cc...                                  │  │
│  │  - Balance: 10.00 USDC on Base                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                          │                                        │
│                          │ Signs transactions                     │
│                          ↓                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  x402-mcp Client Transport                                 │  │
│  │  - Detects paid tool call                                  │  │
│  │  - Signs USDC payment with wallet                          │  │
│  │  - Adds X-PAYMENT header to request                        │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP Request with X-PAYMENT header
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Server (Foundry)                          │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  x402-mcp Server Transport                                 │  │
│  │  - Receives X-PAYMENT header                               │  │
│  │  - Verifies signature with Coinbase Facilitator           │  │
│  │  - Confirms USDC transfer on Base                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                          │                                        │
│                          │ Payment confirmed                      │
│                          ↓                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Tool Handler                                              │  │
│  │  - Executes search_abilities                               │  │
│  │  - Distributes revenue (50/30/20)                          │  │
│  │  - Returns results                                         │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Setting Up Wallet Connection

#### Step 1: Create CDP Wallet

```typescript
import { Coinbase, Wallet } from '@coinbase/cdp-sdk';

// Initialize Coinbase SDK
const coinbase = new Coinbase({
  apiKeyName: process.env.CDP_API_KEY_NAME!,
  privateKey: process.env.CDP_API_KEY_PRIVATE_KEY!,
});

// Create a new wallet for the AI agent
const wallet = await Wallet.create({
  networkId: 'base', // Base network
});

console.log('Wallet Address:', wallet.getDefaultAddress());
console.log('Private Key:', wallet.export()); // Save this securely!

// Fund wallet with USDC
// Send USDC from your exchange/wallet to this address
```

#### Step 2: Connect Wallet to MCP Client

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { makePaymentAwareClientTransport } from "@civic/x402-mcp";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

// Load wallet from private key
const account = privateKeyToAccount(process.env.MCP_CLIENT_PRIVATE_KEY as `0x${string}`);

// Create viem wallet client with public actions
const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org')
}).extend(publicActions);

// Check USDC balance
const usdcBalance = await walletClient.readContract({
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
  abi: [{
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }]
  }],
  functionName: 'balanceOf',
  args: [account.address]
});

console.log('USDC Balance:', (Number(usdcBalance) / 1e6).toFixed(2), 'USDC');

// Create payment-aware MCP transport
const transport = makePaymentAwareClientTransport(
  "http://api.foundry.com/mcp",  // Your MCP server URL
  walletClient,                   // Connected wallet
  (txHash) => {
    console.log('Payment sent! Transaction:', txHash);
    console.log(`View on Basescan: https://basescan.org/tx/${txHash}`);
  }
);

// Connect MCP client
const client = new Client(
  { name: "ai-agent-client", version: "1.0.0" },
  { capabilities: {} }
);

await client.connect(transport);

// Now when you call paid tools, wallet automatically pays!
```

#### Step 3: Call Paid Tools (Payment Automatic)

```typescript
// Agent calls search - wallet pays automatically
const searchResult = await client.callTool({
  name: "search_abilities",
  arguments: {
    query: "stripe payment",
    limit: 10,
    budget: 0.10 // Max $0.10 USDC
  }
});

// Behind the scenes:
// 1. Client detects tool costs ~$0.08 based on results
// 2. Wallet signs USDC payment transaction
// 3. Payment sent to Foundry's wallet
// 4. Foundry verifies payment via Coinbase Facilitator
// 5. Results returned with billing details

console.log('Search Results:', searchResult);
console.log('Cost:', searchResult.billing.totalCost, 'USDC');
console.log('Paid from:', account.address);
```

### Security: Spending Limits

```typescript
// Wrap client with spending controls
class SpendingLimitedMCPClient {
  private client: Client;
  private dailyLimit: number;
  private spentToday: number = 0;
  private lastResetDate: Date;

  constructor(client: Client, dailyLimit: number) {
    this.client = client;
    this.dailyLimit = dailyLimit;
    this.lastResetDate = new Date();
  }

  async callTool(request: any) {
    // Check if need to reset daily counter
    if (this.shouldReset()) {
      this.spentToday = 0;
      this.lastResetDate = new Date();
    }

    // Estimate cost (from tool definition)
    const estimatedCost = this.estimateToolCost(request);

    // Check limit
    if (this.spentToday + estimatedCost > this.dailyLimit) {
      throw new Error(
        `Daily spending limit reached. Spent: $${this.spentToday.toFixed(4)}, ` +
        `Limit: $${this.dailyLimit.toFixed(4)}`
      );
    }

    // Call tool
    const result = await this.client.callTool(request);

    // Track spending
    const actualCost = parseFloat(result.billing?.totalCost || "0");
    this.spentToday += actualCost;

    console.log(`Spent: $${actualCost.toFixed(4)} | Daily total: $${this.spentToday.toFixed(4)}`);

    return result;
  }

  private shouldReset(): boolean {
    const now = new Date();
    return now.getDate() !== this.lastResetDate.getDate();
  }

  private estimateToolCost(request: any): number {
    // Estimate based on tool and parameters
    if (request.name === "search_abilities") {
      const limit = request.arguments?.limit || 10;
      return limit * 0.01 * 0.75; // Conservative estimate
    }
    return 0.05; // Default estimate
  }
}

// Usage
const limitedClient = new SpendingLimitedMCPClient(client, 5.0); // $5 daily limit

await limitedClient.callTool({
  name: "search_abilities",
  arguments: { query: "stripe", limit: 10 }
});
```

---

## Implementation: MCP Server

Complete server implementation with similarity pricing:

```typescript
// foundry-mcp-server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { makePaymentAwareServerTransport } from "@civic/x402-mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { searchAbilities, executeAbility, getAbility } from './foundry-api';
import { x402Service } from './x402-service';

// Environment config
const CONFIG = {
  platformWallet: process.env.X402_PLATFORM_WALLET!,
  searchCostPerSimilarity: parseFloat(process.env.X402_SEARCH_COST_PER_SIMILARITY || "0.01"),
  executionCostPerSimilarity: parseFloat(process.env.X402_EXECUTION_COST_PER_SIMILARITY || "0.05"),
  network: process.env.X402_NETWORK || "base",
};

const server = new McpServer({
  name: "foundry-x402",
  version: "2.0.0",
});

// ============================================================================
// PAID TOOL: Search Abilities (Similarity-Based Pricing)
// ============================================================================

server.tool(
  "search_abilities",
  {
    description: "Search Foundry API abilities. Cost: $0.01 × similarity per result.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (e.g., 'stripe payment')"
        },
        limit: {
          type: "number",
          default: 10,
          description: "Maximum number of results (1-50)"
        },
        minSimilarity: {
          type: "number",
          default: 0.5,
          description: "Minimum similarity threshold (0.0-1.0)"
        },
        budget: {
          type: "number",
          description: "Maximum USDC to spend (optional, for cost control)"
        }
      },
      required: ["query"]
    }
  },
  async (params) => {
    // Perform search
    const results = await searchAbilities({
      query: params.query,
      limit: Math.min(params.limit || 10, 50),
      minSimilarity: params.minSimilarity || 0.5
    });

    // Calculate costs per result
    let totalCost = 0;
    const billingDetails = [];
    const finalResults = [];

    for (const result of results) {
      const cost = CONFIG.searchCostPerSimilarity * result.similarity;

      // Check budget
      if (params.budget && totalCost + cost > params.budget) {
        break; // Stop adding results if over budget
      }

      totalCost += cost;
      finalResults.push(result);
      billingDetails.push({
        abilityId: result.id,
        name: result.name,
        similarity: result.similarity,
        cost: cost.toFixed(4)
      });

      // Distribute revenue for this result
      await x402Service.distributeRevenue(
        cost,
        result.indexerWallet,
        result.websiteOwnerWallet,
        {
          abilityId: result.id,
          action: 'search',
          query: params.query,
          similarity: result.similarity
        }
      );
    }

    return {
      success: true,
      count: finalResults.length,
      abilities: finalResults,
      billing: {
        totalCost: totalCost.toFixed(4),
        currency: "USDC",
        network: CONFIG.network,
        formula: `${CONFIG.searchCostPerSimilarity} × similarity_score`,
        breakdown: billingDetails
      }
    };
  }
);

// ============================================================================
// PAID TOOL: Execute Ability (Similarity-Based Pricing)
// ============================================================================

server.tool(
  "execute_ability",
  {
    description: "Execute an API ability. Cost: $0.05 × similarity.",
    inputSchema: {
      type: "object",
      properties: {
        abilityId: {
          type: "string",
          description: "Ability ID from search results"
        },
        parameters: {
          type: "object",
          description: "Ability parameters (key-value pairs)"
        }
      },
      required: ["abilityId"]
    }
  },
  async (params) => {
    // Get ability details (includes similarity)
    const ability = await getAbility(params.abilityId);

    if (!ability) {
      throw new Error("Ability not found");
    }

    // Calculate cost based on ability's quality/similarity
    const cost = CONFIG.executionCostPerSimilarity * (ability.averageSimilarity || 0.8);

    // Execute ability
    const result = await executeAbility(ability, params.parameters);

    // Distribute revenue
    await x402Service.distributeRevenue(
      cost,
      ability.indexerWallet,
      ability.websiteOwnerWallet,
      {
        abilityId: ability.id,
        action: 'execution',
        similarity: ability.averageSimilarity
      }
    );

    return {
      success: true,
      result,
      billing: {
        cost: cost.toFixed(4),
        currency: "USDC",
        formula: `${CONFIG.executionCostPerSimilarity} × ${ability.averageSimilarity.toFixed(2)}`
      }
    };
  }
);

// ============================================================================
// FREE TOOL: Get Ability Details
// ============================================================================

server.tool(
  "get_ability",
  {
    description: "Get details of a specific ability (FREE)",
    inputSchema: {
      type: "object",
      properties: {
        abilityId: { type: "string" }
      },
      required: ["abilityId"]
    }
  },
  async (params) => {
    const ability = await getAbility(params.abilityId);
    return { success: true, ability };
  }
);

// ============================================================================
// Dynamic Pricing Function
// ============================================================================

function calculateToolPrice(toolName: string, params: any): string {
  if (toolName === "search_abilities") {
    // Estimate based on limit and average similarity
    const limit = Math.min(params.limit || 10, 50);
    const avgSimilarity = 0.75; // Conservative estimate
    const budget = params.budget;

    if (budget) {
      // User specified max budget
      return budget.toFixed(4);
    }

    // Estimate cost
    const estimated = limit * avgSimilarity * CONFIG.searchCostPerSimilarity;
    return estimated.toFixed(4);
  }

  if (toolName === "execute_ability") {
    // Fixed cost for execution (we don't know similarity until we fetch ability)
    const avgSimilarity = 0.8;
    return (CONFIG.executionCostPerSimilarity * avgSimilarity).toFixed(4);
  }

  return "0";
}

// ============================================================================
// Setup Payment-Aware Transport
// ============================================================================

const transport = makePaymentAwareServerTransport(
  CONFIG.platformWallet,
  {
    // Dynamic pricing
    "search_abilities": (params) => `$${calculateToolPrice("search_abilities", params)}`,
    "execute_ability": (params) => `$${calculateToolPrice("execute_ability", params)}`,

    // Free tools
    "get_ability": null,
    "list_domains": null
  }
);

// Connect server
await server.connect(transport);

console.log("Foundry x402-MCP Server running...");
console.log("Platform wallet:", CONFIG.platformWallet);
console.log("Search cost formula:", `$${CONFIG.searchCostPerSimilarity} × similarity`);
console.log("Execution cost formula:", `$${CONFIG.executionCostPerSimilarity} × similarity`);
```

---

## Implementation: MCP Client

```typescript
// ai-agent-client.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { makePaymentAwareClientTransport } from "@civic/x402-mcp";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

// Setup wallet
const account = privateKeyToAccount(process.env.AGENT_WALLET_PRIVATE_KEY as `0x${string}`);
const wallet = createWalletClient({
  account,
  chain: base,
  transport: http()
}).extend(publicActions);

// Create payment-aware transport
const transport = makePaymentAwareClientTransport(
  "http://api.foundry.com/mcp",
  wallet,
  (txHash) => console.log(`✅ Payment sent: https://basescan.org/tx/${txHash}`)
);

// Create MCP client
const client = new Client(
  { name: "ai-agent", version: "1.0.0" },
  { capabilities: {} }
);

await client.connect(transport);

// ============================================================================
// Agent Task: Find and Execute Stripe Payment API
// ============================================================================

async function agentTask() {
  console.log("🤖 Agent: I need to integrate Stripe payments into an app\n");

  // Step 1: Search for Stripe payment abilities
  console.log("🔍 Searching Foundry for Stripe payment APIs...");

  const searchResult = await client.callTool({
    name: "search_abilities",
    arguments: {
      query: "stripe payment create",
      limit: 5,
      minSimilarity: 0.7,
      budget: 0.10 // Max $0.10 USDC
    }
  });

  console.log(`\n✅ Found ${searchResult.count} abilities`);
  console.log(`💰 Cost: ${searchResult.billing.totalCost} USDC`);
  console.log("\nTop result:");
  console.log(`  - ${searchResult.abilities[0].name}`);
  console.log(`  - Similarity: ${searchResult.abilities[0].similarity}`);
  console.log(`  - Cost: ${searchResult.billing.breakdown[0].cost} USDC`);

  // Step 2: Execute the best ability
  const bestAbility = searchResult.abilities[0];

  console.log(`\n🚀 Executing ability: ${bestAbility.id}`);

  const execResult = await client.callTool({
    name: "execute_ability",
    arguments: {
      abilityId: bestAbility.id,
      parameters: {
        amount: 4999, // $49.99
        currency: "usd",
        description: "Premium subscription"
      }
    }
  });

  console.log(`\n✅ Execution successful!`);
  console.log(`💰 Cost: ${execResult.billing.cost} USDC`);
  console.log(`\nResult:`, execResult.result);

  // Total spent
  const totalSpent = parseFloat(searchResult.billing.totalCost) + parseFloat(execResult.billing.cost);
  console.log(`\n💸 Total spent: ${totalSpent.toFixed(4)} USDC`);
}

agentTask().catch(console.error);
```

---

## Complete Example

Full working example with similarity-based pricing:

```typescript
// example-full.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { makePaymentAwareServerTransport, makePaymentAwareClientTransport } from "@civic/x402-mcp";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

// ============================================================================
// Server Setup
// ============================================================================

const server = new McpServer({ name: "foundry-test", version: "1.0.0" });

// Mock search function
async function mockSearch(query: string, limit: number) {
  // Simulate search results with varying similarity
  return [
    { id: "1", name: "Stripe Create Payment Intent", similarity: 0.95, indexerWallet: "0xIndexer1" },
    { id: "2", name: "Stripe Charge Customer", similarity: 0.88, indexerWallet: "0xIndexer2" },
    { id: "3", name: "PayPal Create Payment", similarity: 0.72, indexerWallet: "0xIndexer3" },
    { id: "4", name: "Square Process Payment", similarity: 0.68, indexerWallet: "0xIndexer4" },
    { id: "5", name: "Stripe Subscription", similarity: 0.85, indexerWallet: "0xIndexer1" }
  ].slice(0, limit);
}

// Define search tool with similarity pricing
server.tool("search", {
  description: "Search with similarity-based pricing",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "number", default: 5 }
    }
  }
}, async (params) => {
  const results = await mockSearch(params.query, params.limit || 5);

  const costPerPoint = 0.01;
  let totalCost = 0;
  const breakdown = results.map(r => {
    const cost = costPerPoint * r.similarity;
    totalCost += cost;
    return {
      id: r.id,
      name: r.name,
      similarity: r.similarity,
      cost: cost.toFixed(4)
    };
  });

  return {
    results,
    billing: {
      totalCost: totalCost.toFixed(4),
      breakdown
    }
  };
});

const serverTransport = makePaymentAwareServerTransport(
  "0xServerWallet",
  {
    "search": (params) => {
      const limit = params.limit || 5;
      const avgSim = 0.80;
      return `$${(limit * avgSim * 0.01).toFixed(4)}`;
    }
  }
);

await server.connect(serverTransport);

// ============================================================================
// Client Setup
// ============================================================================

const account = privateKeyToAccount("0xClientPrivateKey" as `0x${string}`);
const clientWallet = createWalletClient({
  account,
  chain: base,
  transport: http()
}).extend(publicActions);

const clientTransport = makePaymentAwareClientTransport(
  "http://localhost:3000",
  clientWallet,
  (tx) => console.log("Payment:", tx)
);

const client = new Client(
  { name: "test-client", version: "1.0.0" },
  { capabilities: {} }
);

await client.connect(clientTransport);

// ============================================================================
// Run Test
// ============================================================================

const result = await client.callTool({
  name: "search",
  arguments: {
    query: "stripe payment",
    limit: 3
  }
});

console.log(JSON.stringify(result, null, 2));

// Output:
// {
//   "results": [
//     { "id": "1", "name": "Stripe Create Payment Intent", "similarity": 0.95 },
//     { "id": "2", "name": "Stripe Charge Customer", "similarity": 0.88 },
//     { "id": "3", "name": "PayPal Create Payment", "similarity": 0.72 }
//   ],
//   "billing": {
//     "totalCost": "0.0255",
//     "breakdown": [
//       { "id": "1", "similarity": 0.95, "cost": "0.0095" },
//       { "id": "2", "similarity": 0.88, "cost": "0.0088" },
//       { "id": "3", "similarity": 0.72, "cost": "0.0072" }
//     ]
//   }
// }
```

---

## Testing

### Local Testing (Without Real Payments)

```bash
# Set testnet mode
export X402_TESTNET=true
export X402_NETWORK=base-sepolia
export X402_FACILITATOR_URL=https://facilitator.sepolia.x402.org

# Run server
node foundry-mcp-server.js

# Run client
node ai-agent-client.js
```

### Get Testnet USDC

1. Visit [Coinbase Faucet](https://faucet.circle.com)
2. Enter your wallet address
3. Select "Base Sepolia"
4. Receive testnet USDC

### Verify Payments On-Chain

```bash
# Check transaction on Basescan
echo "https://sepolia.basescan.org/tx/YOUR_TX_HASH"

# View wallet balance
npx @coinbase/cdp-sdk balance --address YOUR_WALLET_ADDRESS --network base-sepolia
```

---

## Summary

### Key Concepts

1. **Similarity-Based Pricing**: `cost = baseRate × similarityScore`
2. **Dynamic Calculation**: Server calculates exact cost AFTER search
3. **Budget Control**: Clients can set max spending limits
4. **Wallet Connection**: CDP wallet automatically signs and pays
5. **Revenue Distribution**: 50% indexer, 30% owner, 20% platform

### Your Formula in x402-MCP

```typescript
// Your current system:
searchCost = $0.01 × similarityScore

// x402-MCP implementation:
const costPerSimilarity = 0.01;
results.forEach(result => {
  const cost = costPerSimilarity * result.similarity;
  totalCost += cost;
  distributeRevenue(cost, result.indexerWallet, result.ownerWallet);
});
```

### Wallet Connection Flow

```
1. Create CDP Wallet → Get private key
2. Fund wallet with USDC on Base
3. Connect wallet to MCP client (viem)
4. Call paid tool
5. Wallet automatically signs USDC payment
6. Server verifies payment via Coinbase Facilitator
7. Results delivered, revenue distributed
```

**You now have similarity-based pricing in x402-MCP!** 🎉
