# Quick Reference Card

## 🚀 Getting Started

```bash
# Setup Docsify
npm run docs:setup

# View docs locally
npm run docs:serve
# → http://localhost:3000

# Test MCP server
npm run docs:mcp
```

## 📚 File Structure

```
docs/
├── index.html              # Docsify config
├── _sidebar.md             # Navigation
├── _navbar.md              # Top nav
├── README.md               # Home page
├── SETUP.md                # Setup guide
├── DOCSIFY-MCP-GUIDE.md   # Full guide
└── *.md                    # API docs
```

## 🔌 MCP Configuration

**File:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "reverse-engineer-docs": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-servers/docs-server.js"]
    }
  }
}
```

## 🛠️ MCP Tools

| Tool | Description | Example |
|------|-------------|---------|
| `list_docs` | List all docs | "List available docs" |
| `read_doc` | Read specific doc | "Read tokens.md" |
| `search_docs` | Search all docs | "Search for 'auth'" |
| `get_endpoints` | Get endpoints by category | "Show ingestion endpoints" |
| `get_quick_start` | Get quick start guide | "Show quick start" |

## 📖 Documentation Files

| File | Description |
|------|-------------|
| `api-overview.md` | Base URL, auth, endpoint summary |
| `public-endpoints.md` | Public APIs (no auth) |
| `tokens.md` | Token balance & purchases |
| `domains.md` | Domain verification |
| `api-keys.md` | API key management |
| `abilities.md` | User abilities CRUD |
| `analytics.md` | Stats & earnings |
| `credentials.md` | Encrypted credentials |
| `ingestion.md` | HAR files & API ingestion |

## 🎯 Common Commands

```bash
# Documentation
npm run docs:setup    # Setup Docsify
npm run docs:serve    # Serve locally
npm run docs:mcp      # Run MCP server

# Development
npm run dev           # Start API server
npm run db:studio     # Open database UI

# Database
npm run db:generate   # Generate migrations
npm run db:push       # Push schema changes
```

## 🌐 Deployment

### GitHub Pages
```bash
git add docs/
git commit -m "Add docs"
git push origin main
# Enable in: Settings → Pages → main branch → /docs
```

### Quick Deploy URLs
- **GitHub**: `https://USER.github.io/REPO/`
- **Netlify**: Auto-detected
- **Vercel**: Auto-detected

## 🐛 Troubleshooting

### Docsify not loading?
```bash
npm run docs:setup    # Regenerate files
```

### MCP not working?
```bash
# 1. Use absolute path in config
# 2. Restart Claude Desktop
# 3. Check logs: ~/Library/Logs/Claude/
```

### Search not working?
- Clear browser cache
- Try incognito mode

## 📝 Quick Edits

### Add new doc
1. Create `docs/new-page.md`
2. Add to `docs/_sidebar.md`
3. Update `mcp-servers/docs-server.js` DOCS_STRUCTURE

### Change theme
Edit `docs/index.html`:
```html
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify@4/lib/themes/THEME.css">
```
Options: `vue`, `buble`, `dark`, `pure`

## 🔑 Test API Key

Used throughout docs:
```
re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5
```

## 📚 Full Guides

- [SETUP.md](SETUP.md) - Detailed setup instructions
- [DOCSIFY-MCP-GUIDE.md](DOCSIFY-MCP-GUIDE.md) - Complete integration guide
- [README.md](README.md) - Main documentation index

## 🎉 Quick Test

### Test Docsify
```bash
npm run docs:serve
open http://localhost:3000
```

### Test MCP with Claude
```
1. Configure Claude Desktop (see above)
2. Restart Claude Desktop
3. Ask: "List available documentation files"
4. Should see all docs listed!
```

---

**Need help?** Check [DOCSIFY-MCP-GUIDE.md](DOCSIFY-MCP-GUIDE.md) for detailed troubleshooting.
