# User Abilities Management

All endpoints in this section require authentication via API key or session token.

Abilities are reverse-engineered API endpoint wrappers that users create from HAR files or API ingestion. Each user has their own private ability storage, isolated by user ID in the vector database.

## Get User Abilities

### GET /my/abilities

Get all abilities owned by the authenticated user.

**Authentication:** Required (API Key or Session)

**Query Parameters:**
- `favorites` (optional): If `true`, only return favorited abilities
- `published` (optional): If `true`, only return published abilities

**Request:**
```bash
curl http://localhost:4111/my/abilities \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Request (Favorites Only):**
```bash
curl 'http://localhost:4111/my/abilities?favorites=true' \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "count": 63,
  "abilities": [
    {
      "userAbilityId": "c7015864-6134-4733-912c-d147cfbcfd4c",
      "userId": "751beb69-eab9-4a52-a35c-e053587d8500",
      "abilityId": "cb889ba2-a095-40df-b5d0-306a6e6a8697",
      "vectorId": null,
      "abilityName": "get_version_info",
      "serviceName": "zeemart-buyer",
      "domain": "dev-buyer.zeemart.co",
      "description": "Fetches the version information including the application version...",
      "embedding": [...],
      "isFavorite": false,
      "isPublished": false,
      "createdAt": "2025-10-26T12:14:09.000Z",
      "updatedAt": "2025-10-26T12:14:09.000Z"
    }
  ]
}
```

**Ability Object Fields:**
- `userAbilityId`: Unique ID for user-ability relationship
- `userId`: Owner's user ID
- `abilityId`: Unique ID for the ability
- `vectorId`: ID in vector database (null if not indexed)
- `abilityName`: Name of the ability
- `serviceName`: Service/API name
- `domain`: Domain of the API
- `description`: Natural language description
- `embedding`: Vector embedding for semantic search
- `isFavorite`: Whether user has favorited this ability
- `isPublished`: Whether ability is published to marketplace
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

**HTTP Status Codes:**
- `200`: Success
- `401`: Authentication required
- `500`: Server error

**Notes:**
- Abilities are stored in user-scoped vector database tenant
- Each user has isolated ability storage
- Abilities can be private (default) or published

---

## Get Favorite Abilities

### GET /my/abilities/favorites

Get all abilities the user has marked as favorites. Useful for MCP servers to quickly access commonly used abilities.

**Authentication:** Required (API Key or Session)

**Request:**
```bash
curl http://localhost:4111/my/abilities/favorites \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "count": 0,
  "favorites": []
}
```

**Response with Data:**
```json
{
  "success": true,
  "count": 2,
  "favorites": [
    {
      "userAbilityId": "c7015864-6134-4733-912c-d147cfbcfd4c",
      "abilityId": "cb889ba2-a095-40df-b5d0-306a6e6a8697",
      "abilityName": "get_version_info",
      "serviceName": "zeemart-buyer",
      "domain": "dev-buyer.zeemart.co",
      "description": "Fetches the version information...",
      "isFavorite": true,
      "isPublished": false,
      "createdAt": "2025-10-26T12:14:09.000Z"
    }
  ]
}
```

**HTTP Status Codes:**
- `200`: Success
- `401`: Authentication required
- `500`: Server error

**Use Cases:**
- MCP servers can fetch favorites to provide quick access
- Users can organize frequently used abilities
- Faster than searching through all abilities

---

## Toggle Favorite Status

### POST /my/abilities/:abilityId/favorite

Add or remove an ability from favorites.

**Authentication:** Required (API Key or Session)

**Path Parameters:**
- `abilityId`: The UUID of the ability

**Request Body:**
```json
{
  "isFavorite": true
}
```

**Request (Add to Favorites):**
```bash
curl -X POST http://localhost:4111/my/abilities/cb889ba2-a095-40df-b5d0-306a6e6a8697/favorite \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5" \
  -H "Content-Type: application/json" \
  -d '{
    "isFavorite": true
  }'
```

**Request (Remove from Favorites):**
```bash
curl -X POST http://localhost:4111/my/abilities/cb889ba2-a095-40df-b5d0-306a6e6a8697/favorite \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5" \
  -H "Content-Type: application/json" \
  -d '{
    "isFavorite": false
  }'
```

**Response (Added):**
```json
{
  "success": true,
  "message": "Added to favorites"
}
```

**Response (Removed):**
```json
{
  "success": true,
  "message": "Removed from favorites"
}
```

**Response (Not Found):**
```json
{
  "success": false,
  "error": "Ability not found or does not belong to this user"
}
```

**Validation:**
- `isFavorite` must be a boolean
- Ability must exist and belong to the authenticated user

**HTTP Status Codes:**
- `200`: Success
- `400`: Invalid request body or ability not found
- `401`: Authentication required
- `500`: Server error

---

## Publish Ability

### POST /my/abilities/:abilityId/publish

Publish an ability to the shared marketplace, making it discoverable and usable by other users.

**Authentication:** Required (API Key or Session)

**Path Parameters:**
- `abilityId`: The UUID of the ability to publish

**Request:**
```bash
curl -X POST http://localhost:4111/my/abilities/cb889ba2-a095-40df-b5d0-306a6e6a8697/publish \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "message": "Ability published successfully"
}
```

**Response (Not Found):**
```json
{
  "success": false,
  "error": "Ability not found or does not belong to this user"
}
```

**Response (Already Published):**
```json
{
  "success": false,
  "error": "Ability is already published"
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Ability not found or already published
- `401`: Authentication required
- `500`: Server error

**Publishing Process:**
1. Ability is copied from user's private tenant to shared tenant
2. Ability becomes discoverable via `/public/abilities` search
3. Other users can find and execute the ability
4. Creator earns revenue when others use the ability

**Requirements for Publishing:**
- User must own the ability
- Ability must not already be published
- User should have domain verified (for revenue sharing)

**Revenue Model:**
- Creators earn tokens when others execute their published abilities
- Platform takes a small percentage fee
- Revenue tracked in analytics endpoints

---

## Delete Ability

### DELETE /my/abilities/:abilityId

Delete an ability from the user's private collection.

**Authentication:** Required (API Key or Session)

**Path Parameters:**
- `abilityId`: The UUID of the ability to delete

**Request:**
```bash
curl -X DELETE http://localhost:4111/my/abilities/cb889ba2-a095-40df-b5d0-306a6e6a8697 \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "message": "Ability deleted successfully"
}
```

**Response (Not Found):**
```json
{
  "success": false,
  "error": "Ability not found or does not belong to this user"
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Ability not found
- `401`: Authentication required
- `500`: Server error

**Important Notes:**
- This only deletes from user's private collection
- If the ability was published, it remains in the shared marketplace
- To unpublish an ability, contact support (feature coming soon)
- Deletion is permanent and cannot be undone
- This does NOT delete credentials associated with the domain

**⚠️ Warning:**
- Deleting an ability removes it from your private collection
- You won't be able to use this ability unless you re-ingest it
- If you have MCP servers or scripts using this ability, they will break
