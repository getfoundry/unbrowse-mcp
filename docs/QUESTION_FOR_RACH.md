# Question for Rach: x402 Payment Distribution Architecture

## Context from Meeting Notes

Based on your meeting notes, I understand:
- ✅ You're building x402 Gateway API (potential 50k daily fees)
- ✅ Settlement backend for x402 protocol
- ✅ Site owners claim their index and get paid via x402
- ✅ Indexers set their wallet in UI, get fees directly
- ✅ Turnkey integration for web2 users (auto-convert to USDC)
- ✅ Coinbase referral code farming for conversions

## My Current Understanding

```
Payment Flow (What I Think You're Building):

User/AI Agent
  ↓ (pays with USDC via x402)
Your x402 Gateway API
  ↓ (settlement backend)
  ├─ 40% → Indexer wallet (direct)
  ├─ 40% → Platform wallet (Foundry)
  └─ 20% → Original site wallet (???)
```

## Questions to Clarify

### 1. **Original Website Payment Distribution**

You mentioned: "Site owners get perpetual rewards" and "I want to reward the original site"

**Question**: For the **original website** (e.g., Stripe, GitHub API):
- **Option A**: Do we hold their USDC in escrow until they claim it?
  - If yes, how long do we hold before considering it "abandoned"?
  - Do we create a "claim portal" where site owners verify domain ownership and withdraw?

- **Option B**: Do we require site owners to **pre-register** their wallet address?
  - If yes, where do they register? (Our UI? Your gateway API?)
  - What happens if they never register? (Platform keeps the 20%?)

- **Option C**: Do we skip website owner payments entirely until they claim?
  - Platform takes 60% (40% platform + 20% unclaimed owner share)
  - When owner claims, we backfill historical payments?

### 2. **Settlement Backend Architecture**

You're building the settlement backend for x402.

**Question**: Where does the **3-way split** logic happen?
- **Option A**: In your x402 Gateway API
  - You receive payment from user
  - You execute 3 transfers: indexer, platform, website owner
  - We just tell you the 3 wallet addresses?

- **Option B**: In Foundry's backend (my side)
  - Your gateway sends full payment to Platform wallet
  - Foundry backend distributes to indexer/owner
  - You just handle x402 protocol compliance?

- **Option C**: Hybrid approach
  - Your gateway handles indexer payment (40% direct)
  - Sends 60% to Foundry
  - Foundry distributes 20% to site owner, keeps 40%

### 3. **Indexer Wallet Registration**

You said: "Indexer sets their wallet in their UI so fees go to them"

**Question**:
- Is this **our UI** (Foundry dashboard) or **your UI** (x402 gateway dashboard)?
- When indexer creates an ability, they must provide wallet address?
- Do we store `indexerWalletAddress` in our database or yours?

### 4. **Turnkey Integration for Web2 Users**

You mentioned auto-convert to USDC and claim instructions.

**Question**:
- Who manages the Turnkey wallets? (You or us?)
- If indexer doesn't have wallet, do we:
  - **Option A**: Auto-create Turnkey wallet for them (they claim later)?
  - **Option B**: Hold their earnings in escrow until they provide wallet?
  - **Option C**: Convert their earnings to fiat and hold as credits?

### 5. **MCP Client Payment Flow**

Current confusion: Do MCP clients need x402 support?

**Clarification Needed**:
- **Scenario A**: MCP client has x402 support (like Claude Desktop with wallet)
  - Client pays directly via x402 to your gateway
  - Your gateway settles and splits payment
  - Foundry MCP server is just a dumb endpoint

- **Scenario B**: MCP client has NO x402 support (just API key)
  - Client calls Foundry MCP server (free to call)
  - Foundry tracks usage internally (credits system)
  - Foundry periodically settles with your x402 gateway
  - Your gateway distributes USDC to indexers/owners

**Which scenario are we building?**

### 6. **Integration Points**

**Question**: What APIs/webhooks do we need between our systems?

From Foundry → Your Gateway:
- `POST /x402/settle` - Trigger settlement for accumulated charges?
- `GET /x402/balance/:wallet` - Check indexer's pending balance?

From Your Gateway → Foundry:
- `POST /webhooks/x402-payment` - Notify us of successful payment?
- `POST /webhooks/x402-settlement` - Notify us settlement completed?

---

## Proposed Architecture (Please Confirm/Correct)

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Client (Claude Desktop)                   │
│  - Has API key for auth                                          │
│  - NO x402 wallet needed                                         │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            │ HTTP + API Key (FREE to call)
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Foundry MCP Server (Our Side)                 │
│  - Authenticates API key                                         │
│  - Checks user balance (credits)                                 │
│  - Executes tool (search/execute)                                │
│  - Deducts from credit balance                                   │
│  - Records charge in database                                    │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            │ Periodic Settlement
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              Your x402 Gateway API (Settlement Backend)          │
│  - Receives settlement request from Foundry                      │
│  - Transfers USDC:                                               │
│    • 40% → Indexer wallet (direct)                               │
│    • 40% → Platform wallet (Foundry)                             │
│    • 20% → Website owner wallet (if claimed, else escrow)        │
│  - Returns confirmation                                          │
└─────────────────────────────────────────────────────────────────┘
```

**Is this correct?**

---

## Key Decisions Needed

1. **Website Owner Payment**: Escrow vs Pre-registration vs Skip-until-claimed?
2. **Split Logic Location**: Your gateway vs Our backend vs Hybrid?
3. **Indexer Wallet Storage**: Our DB vs Your DB?
4. **Turnkey Ownership**: You manage vs We manage?
5. **MCP Client Model**: x402-capable vs API-key-only?
6. **Settlement Trigger**: Real-time per transaction vs Periodic batch?

---

## What I Need From You

Please confirm/correct the proposed architecture and answer the 6 questions above so I can:
1. Design the correct database schema
2. Build the right API endpoints for integration
3. Implement the MCP server correctly
4. Document the system properly

---

**TL;DR**:
- Do we hold website owner USDC until they claim, or require pre-registration?
- Does your x402 gateway handle the 3-way split, or do we?
- Are MCP clients expected to have x402 wallets, or just API keys with server-side settlement?
