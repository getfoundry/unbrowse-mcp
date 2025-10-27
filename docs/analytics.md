# Analytics

Analytics endpoints provide insights into ability usage, earnings, and spending.

## User Statistics

### GET /analytics/my/stats

Get overall ability usage statistics for the authenticated user.

**Authentication:** Required (API Key or Session)

**Request:**
```bash
curl http://localhost:4111/analytics/my/stats \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalAbilities": 68,
    "totalExecutions": 0,
    "successRate": 0,
    "avgExecutionTime": 0,
    "favoriteCount": 0,
    "publishedCount": 0,
    "topAbilities": []
  }
}
```

**Response Fields:**
- `totalAbilities`: Total number of abilities user owns
- `totalExecutions`: Total number of ability executions
- `successRate`: Percentage of successful executions (0-100)
- `avgExecutionTime`: Average execution time in milliseconds
- `favoriteCount`: Number of favorited abilities
- `publishedCount`: Number of published abilities
- `topAbilities`: Array of most-used abilities with stats

**Top Abilities Format:**
```json
{
  "topAbilities": [
    {
      "abilityId": "abc123",
      "abilityName": "get_user_profile",
      "executionCount": 150,
      "successRate": 98.5,
      "avgExecutionTime": 245
    }
  ]
}
```

**HTTP Status Codes:**
- `200`: Success
- `401`: Authentication required
- `500`: Server error

---

## Ability Details

### GET /analytics/my/abilities/:abilityId

Get detailed usage statistics for a specific ability.

**Authentication:** Required (API Key or Session)

**Path Parameters:**
- `abilityId`: UUID of the ability

**Request:**
```bash
curl http://localhost:4111/analytics/my/abilities/cb889ba2-a095-40df-b5d0-306a6e6a8697 \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "abilityId": "cb889ba2-a095-40df-b5d0-306a6e6a8697",
  "abilityName": "get_version_info",
  "serviceName": "zeemart-buyer",
  "executionCount": 0,
  "successRate": 0,
  "failureRate": 0,
  "avgExecutionTime": 0,
  "minExecutionTime": 0,
  "maxExecutionTime": 0,
  "recentExecutions": [],
  "errorDistribution": {}
}
```

**Response Fields:**
- `executionCount`: Total number of executions
- `successRate`: Percentage of successful executions
- `failureRate`: Percentage of failed executions
- `avgExecutionTime`: Average execution time (ms)
- `minExecutionTime`: Fastest execution time (ms)
- `maxExecutionTime`: Slowest execution time (ms)
- `recentExecutions`: Array of recent execution logs
- `errorDistribution`: Breakdown of error types

**HTTP Status Codes:**
- `200`: Success
- `400`: Ability not found
- `401`: Authentication required
- `500`: Server error

---

## User Earnings

### GET /analytics/my/earnings

Get earnings breakdown for the authenticated user (from published abilities).

**Authentication:** Required (API Key or Session)

**Request:**
```bash
curl http://localhost:4111/analytics/my/earnings \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "earnings": {
    "totalEarned": "0.00",
    "activeAbilities": 0,
    "expiredAbilities": 0,
    "revenueByAbility": []
  }
}
```

**Response with Earnings:**
```json
{
  "success": true,
  "earnings": {
    "totalEarned": "125.50",
    "activeAbilities": 5,
    "expiredAbilities": 2,
    "revenueByAbility": [
      {
        "abilityId": "abc123",
        "abilityName": "get_user_profile",
        "serviceName": "example-api",
        "totalEarned": "85.00",
        "executionCount": 1700,
        "avgRevenuePerExecution": "0.05"
      },
      {
        "abilityId": "def456",
        "abilityName": "list_products",
        "serviceName": "example-api",
        "totalEarned": "40.50",
        "executionCount": 810,
        "avgRevenuePerExecution": "0.05"
      }
    ]
  }
}
```

**Response Fields:**
- `totalEarned`: Total earnings from all published abilities (USD)
- `activeAbilities`: Number of published abilities still earning
- `expiredAbilities`: Number of abilities that stopped earning
- `revenueByAbility`: Breakdown per ability

**Revenue Model:**
- Users earn when others execute their published abilities
- Platform takes 10% fee
- Earnings are added to token balance automatically

**HTTP Status Codes:**
- `200`: Success
- `401`: Authentication required
- `500`: Server error

---

## User Spending

### GET /analytics/my/spending

Get spending breakdown for the authenticated user (from executing abilities).

**Authentication:** Required (API Key or Session)

**Request:**
```bash
curl http://localhost:4111/analytics/my/spending \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "spending": {
    "totalSpent": "0.00",
    "searchCosts": "0.00",
    "executionCosts": "0.00",
    "topAbilitiesUsed": []
  }
}
```

**Response with Spending:**
```json
{
  "success": true,
  "spending": {
    "totalSpent": "45.75",
    "searchCosts": "5.25",
    "executionCosts": "40.50",
    "topAbilitiesUsed": [
      {
        "abilityId": "xyz789",
        "abilityName": "send_email",
        "serviceName": "mail-api",
        "totalSpent": "25.00",
        "executionCount": 500,
        "avgCostPerExecution": "0.05"
      },
      {
        "abilityId": "uvw456",
        "abilityName": "create_user",
        "serviceName": "auth-api",
        "totalSpent": "15.50",
        "executionCount": 310,
        "avgCostPerExecution": "0.05"
      }
    ]
  }
}
```

**Response Fields:**
- `totalSpent`: Total amount spent (USD)
- `searchCosts`: Cost of semantic searches
- `executionCosts`: Cost of ability executions
- `topAbilitiesUsed`: Most expensive abilities

**Pricing:**
- Search: ~$0.01 per semantic search
- Execution: Varies by ability (typically $0.01-$0.10)
- Own abilities: Free to execute

**HTTP Status Codes:**
- `200`: Success
- `401`: Authentication required
- `500`: Server error

---

## Recent Charges

### GET /analytics/my/recent-charges

Get recent charges for ability executions and searches.

**Authentication:** Required (API Key or Session)

**Query Parameters:**
- `limit` (optional): Number of charges to return (max: 100, default: 20)

**Request:**
```bash
curl 'http://localhost:4111/analytics/my/recent-charges?limit=10' \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "count": 0,
  "charges": []
}
```

**Response with Charges:**
```json
{
  "success": true,
  "count": 2,
  "charges": [
    {
      "chargeId": "charge_abc123",
      "userId": "user_xyz",
      "type": "execution",
      "abilityId": "ability_123",
      "abilityName": "send_email",
      "amount": "0.05",
      "status": "completed",
      "createdAt": "2025-10-27T03:30:00.000Z",
      "metadata": {
        "executionTime": 245,
        "success": true
      }
    },
    {
      "chargeId": "charge_def456",
      "userId": "user_xyz",
      "type": "search",
      "amount": "0.01",
      "status": "completed",
      "createdAt": "2025-10-27T03:25:00.000Z",
      "metadata": {
        "query": "send email",
        "resultsCount": 5
      }
    }
  ]
}
```

**Charge Types:**
- `execution`: Ability execution charge
- `search`: Semantic search charge
- `subscription`: Monthly subscription fee (future)

**HTTP Status Codes:**
- `200`: Success
- `401`: Authentication required
- `500`: Server error

---

## Platform Revenue (Admin)

### GET /analytics/platform/revenue

Get platform-wide revenue statistics. **Admin access required** (TODO: implement admin auth).

**Authentication:** Required (API Key or Session) + Admin Role

**Request:**
```bash
curl http://localhost:4111/analytics/platform/revenue \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "revenue": {
    "totalRevenue": "10500.00",
    "totalFees": "1050.00",
    "totalPayouts": "9450.00",
    "activeUsers": 145,
    "totalAbilities": 1250,
    "totalExecutions": 25000,
    "avgRevenuePerUser": "72.41",
    "revenueByMonth": [
      {
        "month": "2025-10",
        "revenue": "2500.00",
        "fees": "250.00",
        "payouts": "2250.00"
      }
    ]
  }
}
```

**HTTP Status Codes:**
- `200`: Success
- `401`: Authentication required
- `403`: Admin access required (TODO)
- `500`: Server error

**Notes:**
- Currently accessible to all authenticated users (admin auth not implemented)
- Will be restricted to admin users in future release
