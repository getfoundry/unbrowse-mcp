# Token & Balance Management

All endpoints in this section require authentication via API key or session token.

## Get Token Balance

### GET /my/tokens/balance

Get the current user's token balance and lifetime statistics.

**Authentication:** Required (API Key or Session)

**Request:**
```bash
curl http://localhost:4111/my/tokens/balance \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "balance": {
    "current": "0.00",
    "lifetimeEarned": "0.00",
    "lifetimeSpent": "0.00",
    "lifetimePurchased": "0.00"
  }
}
```

**Response Fields:**
- `current`: Current token balance (USD)
- `lifetimeEarned`: Total earned from publishing abilities (USD)
- `lifetimeSpent`: Total spent on ability executions (USD)
- `lifetimePurchased`: Total purchased (USD)

**HTTP Status Codes:**
- `200`: Success
- `401`: Authentication required
- `500`: Server error

---

## Purchase Tokens

### POST /my/tokens/purchase

Purchase tokens to use for ability executions.

**Authentication:** Required (API Key or Session)

**Request Body:**
```json
{
  "amount": 10.00,
  "paymentMethod": "stripe",
  "paymentDetails": {
    "cardToken": "tok_visa"
  }
}
```

**Request:**
```bash
curl -X POST http://localhost:4111/my/tokens/purchase \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10.00,
    "paymentMethod": "stripe",
    "paymentDetails": {}
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Tokens purchased successfully",
  "purchase": {
    "amount": "10.00",
    "newBalance": "10.00",
    "transactionId": "txn_abc123"
  }
}
```

**Validation Rules:**
- `amount` must be a positive number
- Minimum purchase: $1.00 USD
- Maximum purchase: $10,000 USD per transaction

**Error Responses:**

Invalid amount:
```json
{
  "success": false,
  "error": "Invalid amount. Must be a positive number representing USD value."
}
```

Below minimum:
```json
{
  "success": false,
  "error": "Minimum purchase amount is $1.00 USD"
}
```

Above maximum:
```json
{
  "success": false,
  "error": "Maximum purchase amount is $10,000 USD per transaction"
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Invalid request body
- `401`: Authentication required
- `500`: Server error

**Notes:**
- Currently uses simulated payment processing
- In production, integrates with Stripe/SOL wallet
- Transaction is recorded in transaction history

---

## Get Transaction History

### GET /my/tokens/transactions

Get the user's transaction history (purchases, earnings, spending).

**Authentication:** Required (API Key or Session)

**Query Parameters:**
- `limit` (optional): Number of transactions to return (max: 100, default: 50)

**Request:**
```bash
curl 'http://localhost:4111/my/tokens/transactions?limit=20' \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "count": 0,
  "transactions": []
}
```

**Transaction Object Fields:**
- `transactionId`: Unique identifier
- `userId`: User ID
- `type`: Transaction type (`purchase`, `earning`, `charge`)
- `amount`: Amount in USD
- `balance`: Balance after transaction
- `description`: Transaction description
- `metadata`: Additional transaction data
- `createdAt`: Timestamp

**Example with Data:**
```json
{
  "success": true,
  "count": 2,
  "transactions": [
    {
      "transactionId": "txn_abc123",
      "userId": "user_xyz",
      "type": "purchase",
      "amount": "10.00",
      "balance": "10.00",
      "description": "Token purchase via stripe",
      "metadata": {
        "paymentMethod": "stripe",
        "paymentDetails": {}
      },
      "createdAt": "2025-10-27T03:00:00.000Z"
    },
    {
      "transactionId": "txn_def456",
      "userId": "user_xyz",
      "type": "charge",
      "amount": "-0.50",
      "balance": "9.50",
      "description": "Execution of ability: get_user_profile",
      "metadata": {
        "abilityId": "ability_123",
        "abilityName": "get_user_profile"
      },
      "createdAt": "2025-10-27T04:00:00.000Z"
    }
  ]
}
```

**HTTP Status Codes:**
- `200`: Success
- `401`: Authentication required
- `500`: Server error

**Notes:**
- Transactions are ordered by created date (newest first)
- Includes all transaction types: purchases, earnings from published abilities, and charges for executions
