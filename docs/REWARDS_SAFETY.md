# Rewards System Safety & Anti-Spam Measures

This document outlines the safety measures implemented in the rewards/tokenomics system to prevent abuse and ensure fair distribution.

---

## 1. Similarity-Based Duplicate Prevention

**Location**: `src/mastra/tools/vector-db-client.ts`

### How It Works
- Before indexing a new ability, the system performs semantic similarity checks against existing abilities
- Abilities with similarity > 0.7 to existing ones are rejected
- Prevents users from indexing slight variations of the same ability to farm rewards

### Configuration
```typescript
const similarityThreshold = 0.7; // Configurable threshold
```

### Benefits
- Maintains database quality
- Prevents spam indexing
- Ensures genuine value contribution

---

## 2. Balance Validation

**Location**: `src/server/token-service.ts`

### How It Works
- Before any charge (search or execution), the system checks user balance
- Returns HTTP 402 (Payment Required) if insufficient funds
- Prevents negative balances and overdrafts

### Implementation
```typescript
export async function checkBalance(userId: string, requiredAmount: number): Promise<boolean> {
  const balance = await getUserBalance(userId);
  const currentBalance = parseFloat(balance.balance);
  return currentBalance >= requiredAmount;
}
```

### Benefits
- No debt accrual
- Clean financial accounting
- User always knows their balance

---

## 3. Reward Caps & Expiration

**Location**: `src/server/rewards-config.ts`, `src/server/token-service.ts`

### How It Works
- Each ability has a maximum total payout cap (default: $100 USD)
- Rewards expire after configurable months (default: 6 months)
- Once either limit is reached, rewards stop accruing

### Configuration
```bash
# .env
REWARD_MAX_PAYOUT_PER_ABILITY=100  # Maximum USD per ability
REWARD_EXPIRATION_MONTHS=6         # Months until expiration
```

### Benefits
- Prevents single ability from monopolizing rewards
- Creates urgency for quality indexing
- Balances incentives across many contributors

---

## 4. Domain Ownership Verification

**Location**: `src/server/domain-verification-service.ts`

### How It Works
- Website owners must prove ownership via DNS TXT records
- Only verified owners receive website owner revenue share
- Prevents unauthorized monetization of third-party domains

### Verification Flow
1. User requests verification → receives unique token
2. User adds DNS TXT record: `unbrowse-verify=<token>`
3. System verifies DNS record via lookup
4. On success, all abilities for that domain grant revenue share

### Benefits
- Only legitimate owners profit from their APIs
- Prevents revenue theft
- Builds trust with API providers

---

## 5. Transaction Audit Trail

**Location**: `src/db/schema.ts` - `tokenTransactions` table

### How It Works
- Every token movement is recorded with:
  - User ID
  - Transaction type (purchase, reward, cost, refund)
  - Amount (positive or negative)
  - Balance snapshot after transaction
  - Related ability/charge ID
  - Metadata for context

### Benefits
- Complete financial transparency
- Audit capability for disputes
- Fraud detection via pattern analysis

---

## 6. Revenue Distribution Validation

**Location**: `src/server/rewards-config.ts`

### How It Works
- Revenue percentages must sum to 100%
- System auto-normalizes if percentages don't match
- Validates on startup

### Configuration
```bash
REWARD_INDEXER_PERCENTAGE=50        # Must sum
REWARD_WEBSITE_OWNER_PERCENTAGE=30  # to 100%
REWARD_PLATFORM_PERCENTAGE=20
```

### Benefits
- No lost revenue due to misconfiguration
- Transparent splits
- Predictable economics

---

## 7. Minimum/Maximum Purchase Limits

**Location**: `src/server/routes.ts` - `purchaseTokensRoute`

### How It Works
- Minimum purchase: $1.00 USD
- Maximum purchase: $10,000 USD per transaction
- Prevents micro-transactions spam and money laundering

### Implementation
```typescript
if (amount < 1) {
  return error("Minimum purchase amount is $1.00 USD");
}
if (amount > 10000) {
  return error("Maximum purchase amount is $10,000 USD per transaction");
}
```

### Benefits
- Reduces transaction processing overhead
- AML/KYC compliance
- Reasonable usage patterns

---

## 8. Authentication Requirements

**Location**: All protected routes

### How It Works
- All rewards-related endpoints require authentication
- Uses Better Auth session tokens or API keys
- No anonymous earning or spending

### Protected Endpoints
- `/abilities/search` - requires auth to charge
- `/my/tokens/*` - balance and purchase
- `/my/domains/*` - domain verification
- `/analytics/my/*` - earnings and spending

### Benefits
- Prevents bot abuse
- User accountability
- Proper attribution of rewards

---

## 9. Inactive Reward Auto-Deactivation

**Location**: `src/server/token-service.ts` - `distributeRewards()`

### How It Works
- On each reward distribution, system checks:
  - Is reward expired?
  - Has max payout been reached?
- If either condition is true, marks reward as `isActive = false`
- Stops future payouts automatically

### Implementation
```typescript
if (!isRewardEligible(rewardRecord.expiresAt, parseFloat(rewardRecord.totalRewardsPaid))) {
  await db.update(abilityRewards)
    .set({ isActive: false })
    .where(eq(abilityRewards.rewardId, rewardRecord.rewardId));
  return { indexerPaid: 0, websiteOwnerPaid: 0 };
}
```

### Benefits
- Automatic cleanup
- No manual monitoring needed
- Prevents accidental overpayment

---

## 10. Similarity-Based Pricing

**Location**: `src/server/routes.ts` - `abilitiesSearchRoute`

### How It Works
- Search costs scale with similarity score (0-1)
- More relevant results = higher cost
- Discourages broad, low-quality searches

### Pricing Formula
```typescript
cost = config.search.costPerSimilarity * similarityScore
// Example: $0.01 * 0.8 = $0.008 per result
```

### Benefits
- Aligns cost with value
- Encourages specific queries
- Fairer pricing model

---

## Future Enhancements

### Rate Limiting (TODO)
- Max searches per minute per user
- Max token purchases per hour
- Prevents API abuse and rapid-fire attacks

### Captcha for Purchases (TODO)
- Human verification for large purchases
- Prevents automated farming

### IP-Based Abuse Detection (TODO)
- Monitor for suspicious patterns
- Multiple accounts from same IP
- Velocity checks

### Ability Quality Scoring (TODO)
- Track success rates
- Downrank low-quality abilities
- Boost high-performing ones

---

## Monitoring & Alerts

### Key Metrics to Track
1. **Reward velocity** - USD paid per hour
2. **Duplicate submission rate** - % rejected for similarity
3. **Balance exhaustion rate** - Users hitting $0
4. **Ability concentration** - Top 10% earning what %
5. **Domain verification rate** - % of domains verified

### Alert Thresholds
- Reward velocity > $1000/hr → Investigate
- Duplicate rate > 50% → Tighten similarity threshold
- Single ability > 20% of total rewards → Review quality
- Failed DNS verifications > 30% → UI/UX issue

---

## Summary

The rewards system implements **10 core safety measures** to ensure:
- ✅ Fair distribution
- ✅ Spam prevention
- ✅ Financial integrity
- ✅ Abuse detection
- ✅ Transparent operations

All safety measures are **configurable** via environment variables and can be tuned based on real-world usage patterns.
