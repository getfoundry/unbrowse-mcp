# 🚀 Vector Database API - User Guide

## What is this?

A blazing-fast vector database API that lets you:
- Store and search embeddings (vectors)
- Build knowledge graphs
- Create isolated workspaces for different projects
- Scale to billions of vectors

**No setup required. Just use the API.**

**Want to jump right in?** Check out `user.py` for a complete working example with product recommendations!

---

## 🏁 Quick Start

### 1. Get Your API URL

```
https://dev-beta.infraxa.ai
```

### 2. Create Your First Workspace

```bash
curl -X POST "https://dev-beta.infraxa.ai/tenants" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "my_project",
    "max_vectors": 1000000
  }'
```

### 3. Create a Collection

```bash
curl -X POST "https://dev-beta.infraxa.ai/tenants/my_project/blobs" \
  -H "Content-Type: application/json" \
  -d '{
    "blob_id": "my_embeddings",
    "blob_type": "dense",
    "dimension": 384
  }'
```

### 4. Add Vectors

```bash
curl -X POST "https://dev-beta.infraxa.ai/tenants/my_project/blobs/my_embeddings/vectors" \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": [
      [0.1, 0.2, 0.3, ...],
      [0.4, 0.5, 0.6, ...]
    ]
  }'
```

### 5. Search

```bash
curl -X POST "https://dev-beta.infraxa.ai/tenants/my_project/blobs/my_embeddings/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": [0.1, 0.2, 0.3, ...],
    "k": 10
  }'
```

**Response:**
```json
{
  "ids": [1, 5, 3],
  "distances": [0.12, 0.18, 0.24],
  "attributes": [
    {"title": "Doc 1", "url": "..."},
    {"title": "Doc 5", "url": "..."},
    {"title": "Doc 3", "url": "..."}
  ],
  "count": 3
}
```

**Done!** You're now searching vectors with metadata.

---

## 📖 Core Concepts

### Workspace (Tenant)
Your isolated environment. Everything you create lives here.

### Collection (Blob)
A container for vectors. Like a table in a database.

### Vector
A list of numbers representing your data (embeddings).

---

## 🎯 Common Use Cases

### Use Case 1: Semantic Search

**What**: Search documents by meaning, not keywords.

```python
import requests

API = "https://dev-beta.infraxa.ai"

# 1. Create workspace
requests.post(f"{API}/tenants", json={
    "tenant_id": "my_docs"
})

# 2. Create collection
requests.post(f"{API}/tenants/my_docs/blobs", json={
    "blob_id": "documents",
    "blob_type": "dense",
    "dimension": 384
})

# 3. Add document embeddings
# (Get embeddings from OpenAI, Cohere, or sentence-transformers)
requests.post(f"{API}/tenants/my_docs/blobs/documents/vectors", json={
    "vectors": your_embeddings,
    "attributes": [
        {"text": "Document 1 content..."},
        {"text": "Document 2 content..."}
    ]
})

# 4. Search
response = requests.post(f"{API}/tenants/my_docs/blobs/documents/query", json={
    "query": query_embedding,
    "k": 5
})

results = response.json()
print(f"Found {results['count']} results")
```

---

### Use Case 2: Product Recommendations

**What**: Find similar products based on embeddings.

```python
# Create collection
requests.post(f"{API}/tenants/my_store/blobs", json={
    "blob_id": "products",
    "blob_type": "dense",
    "dimension": 512
})

# Add products
requests.post(f"{API}/tenants/my_store/blobs/products/vectors", json={
    "vectors": product_embeddings,
    "ids": [101, 102, 103],
    "attributes": [
        {"name": "iPhone 15", "price": 999},
        {"name": "Samsung S24", "price": 899},
        {"name": "Pixel 8", "price": 699}
    ]
})

# Find similar products
response = requests.post(f"{API}/tenants/my_store/blobs/products/query", json={
    "query": iphone_embedding,
    "k": 3
})

# Returns: Samsung S24, Pixel 8, ...
```

---

### Use Case 3: Knowledge Graph

**What**: Store relationships between entities (products, people, concepts).

```python
# Create knowledge graph collection
requests.post(f"{API}/tenants/my_app/blobs", json={
    "blob_id": "knowledge_graph",
    "blob_type": "kge",
    "dimension": 128
})

# Add entities (products)
requests.post(f"{API}/tenants/my_app/blobs/knowledge_graph/kge/entities", json={
    "entity_embeddings": entity_vectors,
    "entity_ids": [0, 1, 2],
    "entity_names": ["iPhone", "AirPods", "MacBook"]
})

# Add relations (how they're connected)
requests.post(f"{API}/tenants/my_app/blobs/knowledge_graph/kge/relations", json={
    "relation_embeddings": relation_vectors,
    "relation_ids": [0, 1],
    "relation_names": ["purchased_with", "similar_to"]
})

# Add connections (triples)
requests.post(f"{API}/tenants/my_app/blobs/knowledge_graph/kge/triples", json={
    "triples": [
        [0, 0, 1],  # iPhone purchased_with AirPods
        [0, 1, 2]   # iPhone similar_to MacBook
    ]
})

# Get all relationships for iPhone
response = requests.get(
    f"{API}/tenants/my_app/blobs/knowledge_graph/kge/entities/0/relations"
)
```

---

## 📚 API Reference

### Workspaces

#### Create Workspace
```http
POST /tenants
Content-Type: application/json

{
  "tenant_id": "my_project",
  "max_vectors": 1000000
}
```

#### List Workspaces
```http
GET /tenants
```

#### Delete Workspace
```http
DELETE /tenants/my_project?confirm=true
```

---

### Collections

#### Create Collection
```http
POST /tenants/my_project/blobs
Content-Type: application/json

{
  "blob_id": "my_collection",
  "blob_type": "dense",
  "dimension": 384
}
```

**Collection Types:**
- `dense`: Standard vectors (semantic search, RAG)
- `kge`: Knowledge graphs (entities + relations)

#### List Collections
```http
GET /tenants/my_project/blobs
```

#### Delete Collection
```http
DELETE /tenants/my_project/blobs/my_collection?confirm=true
```

---

### Vectors

#### Add Vectors
```http
POST /tenants/my_project/blobs/my_collection/vectors
Content-Type: application/json

{
  "vectors": [[0.1, 0.2, ...], [0.3, 0.4, ...]],
  "ids": [1, 2],
  "attributes": [
    {"name": "Item 1"},
    {"name": "Item 2"}
  ]
}
```

#### Search Vectors
```http
POST /tenants/my_project/blobs/my_collection/query
Content-Type: application/json

{
  "query": [0.1, 0.2, 0.3, ...],
  "k": 10
}
```

**Response:**
```json
{
  "ids": [1, 5, 12, 23, ...],
  "distances": [0.0, 0.12, 0.15, ...],
  "count": 10
}
```

---

### Knowledge Graphs

#### Add Entities
```http
POST /tenants/my_project/blobs/my_kg/kge/entities
Content-Type: application/json

{
  "entity_embeddings": [[0.1, ...], [0.2, ...]],
  "entity_ids": [0, 1],
  "entity_names": ["Product A", "Product B"]
}
```

#### Add Relations
```http
POST /tenants/my_project/blobs/my_kg/kge/relations
Content-Type: application/json

{
  "relation_embeddings": [[0.5, ...]],
  "relation_ids": [0],
  "relation_names": ["purchased_with"]
}
```

#### Add Connections
```http
POST /tenants/my_project/blobs/my_kg/kge/triples
Content-Type: application/json

{
  "triples": [[0, 0, 1]]
}
```

**Triple Format:** `[head_entity_id, relation_id, tail_entity_id]`

#### Get Entity Relationships
```http
GET /tenants/my_project/blobs/my_kg/kge/entities/0/relations
```

---

## 💡 Tips & Best Practices

### Getting Embeddings

**Don't have embeddings?** Use these services:

```python
# OpenAI
from openai import OpenAI
client = OpenAI()
response = client.embeddings.create(
    input="Your text here",
    model="text-embedding-3-small"
)
embedding = response.data[0].embedding

# Sentence Transformers (local)
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('all-MiniLM-L6-v2')
embedding = model.encode("Your text here")

# Cohere
import cohere
co = cohere.Client('your-api-key')
response = co.embed(texts=["Your text here"])
embedding = response.embeddings[0]
```

### Choosing Dimensions

- **384**: Fast, good for most use cases (all-MiniLM-L6-v2)
- **768**: Better quality (BERT, RoBERTa)
- **1536**: Best quality (OpenAI text-embedding-3-small)
- **3072**: Highest quality (OpenAI text-embedding-3-large)

### Batch Operations

Insert in batches for better performance:

```python
# Good: Batch insert
requests.post(f"{API}/tenants/my_project/blobs/docs/vectors", json={
    "vectors": batch_of_1000_vectors
})

# Bad: One at a time
for vector in vectors:
    requests.post(...)  # Slow!
```

### Metadata

Add metadata to make results useful:

```python
requests.post(f"{API}/tenants/my_project/blobs/docs/vectors", json={
    "vectors": embeddings,
    "attributes": [
        {
            "title": "Document 1",
            "url": "https://...",
            "author": "John",
            "date": "2024-01-01"
        }
    ]
})
```

---

## 🕸️ Knowledge Graph Embeddings (KGE)

**Use Case**: Search for entities and automatically get connected entities via relationships.

**Example**: Search for "Python Programming" ability → also get prerequisite abilities like "Basic Programming", "Variables", etc.

### Setup

```python
import requests
API = "https://dev-beta.infraxa.ai"

# 1. Create KGE blob
requests.post(f"{API}/tenants/my_project/blobs", json={
    "blob_id": "abilities",
    "blob_type": "kge",  # Knowledge Graph type
    "dimension": 384
})

# 2. Insert abilities (entities) with FULL metadata
requests.post(f"{API}/tenants/my_project/blobs/abilities/kge/entities", json={
    "entity_embeddings": [
        [0.1, 0.2, ...],  # Python Programming
        [0.2, 0.3, ...],  # Basic Programming
        [0.3, 0.4, ...]   # Variables
    ],
    "entity_ids": [1, 2, 3],
    "entity_names": ["Python Programming", "Basic Programming", "Variables"],
    "entity_attributes": [
        {
            "ability_id": "python-programming",
            "difficulty": "intermediate",
            "duration_hours": 40,
            "description": "Learn Python programming from scratch"
        },
        {
            "ability_id": "basic-programming",
            "difficulty": "beginner",
            "duration_hours": 20,
            "description": "Fundamental programming concepts"
        },
        {
            "ability_id": "variables",
            "difficulty": "beginner",
            "duration_hours": 5,
            "description": "Understanding variables and data types"
        }
    ]
})

# 3. Insert relationships (edges)
requests.post(f"{API}/tenants/my_project/blobs/abilities/kge/relations", json={
    "relation_embeddings": [[0.5, 0.6, ...]],
    "relation_ids": [100],
    "relation_names": ["prerequisite_of"]
})

# 4. Insert triples (connections)
requests.post(f"{API}/tenants/my_project/blobs/abilities/kge/triples", json={
    "triples": [
        [1, 100, 2],  # Python requires Basic Programming
        [1, 100, 3],  # Python requires Variables
        [2, 100, 3]   # Basic Programming requires Variables
    ]
})
```

### Query with Graph Traversal

```python
# Search for Python Programming
response = requests.post(
    f"{API}/tenants/my_project/blobs/abilities/kge/query",
    json={
        "query": [0.1, 0.2, ...],  # embedding for "Python Programming"
        "k": 5
    }
)

results = response.json()
# Returns:
# {
#   "entities": [
#     {
#       "id": 1,
#       "distance": 0.0,
#       "attributes": {
#         "entity_id": 1,
#         "type": "entity",
#         "name": "Python Programming",
#         "ability_id": "python-programming",
#         "difficulty": "intermediate",
#         "duration_hours": 40,
#         "description": "Learn Python programming from scratch"
#       }
#     }
#   ],
#   "neighbors": [
#     {"id": 2, "type": "neighbor"},  # Basic Programming (prerequisite)
#     {"id": 3, "type": "neighbor"}   # Variables (prerequisite)
#   ],
#   "neighbor_count": 2
# }
```

**Key Benefits:**
- ✅ Search returns matched entities + connected entities
- ✅ **Full metadata stored and retrieved** - no external database needed!
- ✅ Perfect for dependency graphs (abilities, prerequisites, etc.)
- ✅ Automatic graph traversal - no manual joins needed
- ✅ Store any custom attributes (JSON objects)

### Complete Example

See `user.py` for a complete working example with:
- Product catalog with prerequisites
- Real Gemini embeddings
- Automatic product recommendations via graph traversal

```bash
# Get your Gemini API key from https://aistudio.google.com/apikey
# Update GEMINI_API_KEY in user.py
python user.py
```

---

## ⚡ Performance

**Typical Response Times:**

| Operation | Latency |
|-----------|---------|
| Create workspace | < 1s |
| Create collection | < 1s |
| Insert vectors | < 3s |
| Search | < 0.1s |

Fast, scalable, serverless vector database.

---

## 🐍 Python SDK Example

```python
import requests
import numpy as np

class VectorDB:
    def __init__(self, api_url, tenant_id):
        self.api = api_url
        self.tenant = tenant_id
    
    def create_collection(self, name, dimension):
        """Create a new collection."""
        return requests.post(f"{self.api}/tenants/{self.tenant}/blobs", json={
            "blob_id": name,
            "blob_type": "dense",
            "dimension": dimension
        })
    
    def add(self, collection, vectors, metadata=None):
        """Add vectors to collection."""
        return requests.post(
            f"{self.api}/tenants/{self.tenant}/blobs/{collection}/vectors",
            json={
                "vectors": vectors,
                "attributes": metadata
            }
        )
    
    def search(self, collection, query, k=10):
        """Search for similar vectors."""
        response = requests.post(
            f"{self.api}/tenants/{self.tenant}/blobs/{collection}/query",
            json={"query": query, "k": k}
        )
        return response.json()

# Usage
db = VectorDB("https://dev-beta.infraxa.ai", "my_project")
db.create_collection("docs", 384)
db.add("docs", embeddings, metadata)
results = db.search("docs", query_embedding, k=5)
```



## 🆘 Support

### Common Errors

**400 Bad Request**
- Check your JSON format
- Verify vector dimensions match collection
- Ensure workspace/collection exists

**404 Not Found**
- Workspace or collection doesn't exist
- Check spelling of IDs

**500 Internal Server Error**
- Contact support
- Check API status

### Need Help?

- Check the interactive docs: `https://dev-beta.infraxa.ai/docs`
- Contact support: support@infraxa.ai
- Check status: `https://dev-beta.infraxa.ai/health`

---

## 🎉 You're Ready!

Start building:
1. Create a workspace
2. Create a collection
3. Add vectors
4. Search!

**That's it.** No complex setup, no infrastructure to manage.

Happy building! 🚀
