# File: ./DOCSIFY-MCP-GUIDE.md

# Docsify + MCP Integration Guide

Complete guide for using the documentation with Docsify web interface and MCP (Model Context Protocol) for AI assistants.

## 🎯 Overview

This documentation system provides two ways to access API documentation:

1. **Docsify Web Interface** - Beautiful, searchable web docs
2. **MCP Server** - AI-native documentation access for Claude and other assistants

## 🚀 Quick Start

### For Web Docs (Docsify)

```bash
# 1. Setup Docsify files
npm run docs:setup

# 2. Serve locally
npm run docs:serve

# 3. Open browser
open http://localhost:3000
```

### For AI Assistants (MCP)

```bash
# 1. Test MCP server
npm run docs:mcp

# 2. Configure Claude Desktop (see below)
# 3. Restart Claude Desktop
# 4. Ask Claude to explore the docs!
```

## 📚 Docsify Features

### What You Get

✅ **Full-text search** across all documentation
✅ **Organized sidebar** navigation by category
✅ **Copy-paste ready** code examples
✅ **Pagination** with Previous/Next links
✅ **Syntax highlighting** for Bash, JSON, JavaScript
✅ **Mobile responsive** design
✅ **GitHub integration** links

### Directory Structure

```
docs/
├── index.html          # Docsify configuration
├── _sidebar.md         # Navigation menu
├── _navbar.md          # Top navigation
├── .nojekyll          # GitHub Pages compatibility
├── README.md          # Landing page
├── SETUP.md           # Setup guide
├── api-overview.md    # API overview
├── public-endpoints.md
├── tokens.md
├── domains.md
├── api-keys.md
├── abilities.md
├── analytics.md
├── credentials.md
└── ingestion.md
```

### Customization

Edit `docs/index.html` to customize:

```javascript
window.$docsify = {
  name: 'Your API Name',
  repo: 'https://github.com/youruser/repo',
  loadSidebar: true,
  loadNavbar: true,
  subMaxLevel: 3,
  auto2top: true,
  // ... more options
}
```

## 🤖 MCP Server Features

### What You Get

✅ **List all docs** - See available documentation files
✅ **Read specific docs** - Get content of any documentation file
✅ **Search docs** - Full-text search with context
✅ **Get endpoints** - Quick reference for API endpoints by category
✅ **Quick start** - Instant access to getting started guide

### Available Tools

#### 1. List Documentation Files

```
Claude, please list all available documentation files.
```

**Response:**
```
• api-overview.md: API Overview - Base URL, authentication, and endpoint summary
• tokens.md: Token Management - Balance, purchases, transactions
• abilities.md: User Abilities - CRUD operations and publishing
...
```

#### 2. Read Specific Documentation

```
Claude, read the tokens.md documentation.
```

**Response:** Full contents of the tokens.md file

#### 3. Search Documentation

```
Claude, search the docs for "authentication"
```

**Response:** All files containing "authentication" with line numbers and context

#### 4. Get API Endpoints

```
Claude, show me all the ingestion endpoints
```

**Response:**
```
INGESTION ENDPOINTS

• POST /ingest
• POST /ingest/api
• POST /ingest/urls
```

#### 5. Get Quick Start Guide

```
Claude, show me the quick start guide
```

**Response:** Complete quick start section from README

### Claude Desktop Configuration

**Location:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration:**
```json
{
  "mcpServers": {
    "reverse-engineer-docs": {
      "command": "node",
      "args": [
        "/Users/yourname/Projects/reverse-engineer/mcp-servers/docs-server.js"
      ]
    }
  }
}
```

**Important:**
- Use **absolute path** to the MCP server file
- Replace `/Users/yourname/Projects/` with your actual path
- Restart Claude Desktop after adding configuration

### Example Usage with Claude

**You:**
```
I need to create an API key. Can you show me how?
```

**Claude (using MCP):**
```
Let me read the API key documentation for you.

[Uses read_doc tool to fetch api-keys.md]

To create an API key, you need to make a POST request to /my/api-keys...

[Shows full documentation with curl examples]
```

**You:**
```
What endpoints are available for analytics?
```

**Claude (using MCP):**
```
[Uses get_endpoints tool with category="analytics"]

Here are all the analytics endpoints:
• GET /analytics/my/stats
• GET /analytics/my/earnings
• GET /analytics/my/spending
...
```

## 🔧 Development Workflow

### Adding New Documentation

1. **Create markdown file** in `docs/` folder:
```bash
touch docs/webhooks.md
```

2. **Add to sidebar** in `docs/_sidebar.md`:
```markdown
* **Webhooks**
  * [Webhook Setup](webhooks.md)
```

3. **Update MCP server** in `mcp-servers/docs-server.js`:
```javascript
const DOCS_STRUCTURE = {
  // ... existing files
  'webhooks.md': 'Webhooks - Event notifications and callbacks',
};
```

4. **Restart services**:
```bash
# Restart Docsify (Ctrl+C and re-run)
npm run docs:serve

# Restart MCP server (if using with Claude)
# Restart Claude Desktop
```

### Testing Documentation

**Web (Docsify):**
```bash
npm run docs:serve
# Test at http://localhost:3000
```

**MCP:**
```bash
# Test server startup
npm run docs:mcp

# Should see: "Reverse Engineer Docs MCP Server running on stdio"
# Ctrl+C to stop
```

**In Claude Desktop:**
- Ask: "List available documentation files"
- Should see your docs listed with the MCP tools

## 🚀 Deployment Options

### GitHub Pages

```bash
# 1. Push to GitHub
git add docs/
git commit -m "Add documentation"
git push origin main

# 2. Enable GitHub Pages
# Go to: Settings → Pages
# Source: Deploy from branch
# Branch: main
# Folder: /docs
# Save
```

Access at: `https://yourusername.github.io/reverse-engineer/`

### Netlify

```bash
# 1. Connect repo to Netlify
# 2. Build settings:
#    Base directory: docs
#    Build command: (leave empty)
#    Publish directory: .
# 3. Deploy
```

### Vercel

```bash
# 1. Import repo to Vercel
# 2. Build settings:
#    Framework: Other
#    Root Directory: docs
#    Build Command: (leave empty)
# 3. Deploy
```

### Docker (Optional)

Already configured in `docker-compose.yml`:

```bash
npm run docs:dev   # Start docs server
npm run docs:down  # Stop docs server
```

## 📊 Usage Analytics

Track documentation usage with Google Analytics:

```javascript
// In docs/index.html
window.$docsify = {
  ga: 'UA-XXXXX-Y', // Your GA tracking ID
}
```

```html
<!-- Add plugin -->
<script src="//cdn.jsdelivr.net/npm/docsify/lib/plugins/ga.min.js"></script>
```

## 🎨 Themes

Available Docsify themes:

```html
<!-- Vue (default) -->
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify@4/lib/themes/vue.css">

<!-- Buble -->
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify@4/lib/themes/buble.css">

<!-- Dark -->
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify@4/lib/themes/dark.css">

<!-- Pure -->
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify@4/lib/themes/pure.css">
```

## 🐛 Troubleshooting

### Docsify Issues

**Problem:** Page shows "Loading..." forever

**Solution:**
```bash
# Check if files exist
ls docs/index.html docs/_sidebar.md

# Re-run setup
npm run docs:setup
```

**Problem:** Search not working

**Solution:**
```bash
# Clear browser cache
# Or try incognito mode
# Check browser console for errors
```

### MCP Issues

**Problem:** Claude doesn't show MCP tools

**Solution:**
```bash
# 1. Verify config path is absolute
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json

# 2. Check file permissions
chmod +x mcp-servers/docs-server.js

# 3. Test server manually
npm run docs:mcp

# 4. Check Claude logs
tail -f ~/Library/Logs/Claude/mcp*.log

# 5. Restart Claude Desktop completely
```

**Problem:** MCP server crashes

**Solution:**
```bash
# Check Node.js version (requires 20.9.0+)
node --version

# Install dependencies
npm install

# Test with verbose logging
node mcp-servers/docs-server.js 2>&1 | tee mcp-debug.log
```

## 📝 Best Practices

### Documentation Writing

1. **Test all curl examples** - Use real API keys and capture actual responses
2. **Include error cases** - Document what can go wrong
3. **Add context** - Explain why and when to use each endpoint
4. **Link related docs** - Cross-reference related endpoints
5. **Keep examples realistic** - Use actual data shapes from the API

### MCP Server

1. **Keep DOCS_STRUCTURE updated** - Add all new files
2. **Test search functionality** - Ensure terms are findable
3. **Monitor performance** - Large docs may need pagination
4. **Version the API** - Update tools when APIs change

### Maintenance

1. **Update on API changes** - Keep docs in sync with code
2. **Test both interfaces** - Verify Docsify and MCP work
3. **Review search terms** - Ensure common queries work
4. **Check links** - Validate internal and external links

## 🤝 Contributing

When adding documentation:

1. Follow existing structure and format
2. Test with both Docsify and MCP
3. Update `_sidebar.md` navigation
4. Update `DOCS_STRUCTURE` in MCP server
5. Test search functionality
6. Verify all curl examples work

## 📚 Resources

- [Docsify Official Docs](https://docsify.js.org)
- [MCP Documentation](https://modelcontextprotocol.io)
- [Claude Desktop](https://claude.ai/download)
- [Markdown Guide](https://www.markdownguide.org)
- [GitHub Pages](https://pages.github.com)

## 🎉 Summary

You now have:

✅ **Beautiful web docs** with Docsify
✅ **AI-native docs** with MCP server
✅ **Full-text search** across all documentation
✅ **Easy deployment** to GitHub Pages, Netlify, or Vercel
✅ **Claude integration** for interactive docs exploration
✅ **Automated setup** with npm scripts

**Commands:**
```bash
npm run docs:setup   # Generate Docsify files
npm run docs:serve   # Serve web docs
npm run docs:mcp     # Run MCP server
```

Happy documenting! 📚✨

---

# File: ./QUICK-REFERENCE.md

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

---

# File: ./README.md

# Reverse Engineer API Documentation

Complete API documentation for the Unbrowse Reverse Engineer platform, generated from actual curl requests and real API responses.

## 📚 Documentation Index

### Getting Started
- [**API Overview**](./api-overview.md) - Base URL, authentication, and endpoint summary

### Public Endpoints (No Auth Required)
- [**Public Endpoints**](./public-endpoints.md)
  - Health check
  - Search published abilities
  - Get ability details
  - Popular abilities leaderboard
  - Top earning abilities
  - OpenAPI specification

### Protected Endpoints (Auth Required)

#### Account & Tokens
- [**Token Management**](./tokens.md)
  - Get token balance
  - Purchase tokens
  - Transaction history

#### Domain & API Key Management
- [**Domain Verification**](./domains.md)
  - Request verification
  - Verify ownership via DNS
  - List user domains
  - Delete verification

- [**API Key Management**](./api-keys.md)
  - Create API key
  - List API keys
  - Revoke API key

#### Ability Management
- [**User Abilities**](./abilities.md)
  - Get user abilities
  - Get favorites
  - Toggle favorite
  - Publish ability
  - Delete ability

#### Analytics & Insights
- [**Analytics**](./analytics.md)
  - User statistics
  - Ability details
  - Earnings breakdown
  - Spending analysis
  - Recent charges
  - Platform revenue (admin)

#### Security & Storage
- [**Credentials Management**](./credentials.md)
  - Stream/upload credentials
  - List credentials (flat or grouped)
  - Get credentials by domain
  - Delete by domain
  - Delete specific credential

#### Ingestion & Reverse Engineering
- [**Ingestion**](./ingestion.md)
  - HAR file ingestion
  - Quick API endpoint ingestion
  - Batch URL ingestion

## 🔑 Authentication

All requests to protected endpoints must include authentication via:

**API Key (Recommended for programmatic access):**
```bash
curl http://localhost:4111/my/abilities \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Session Token (Browser-based):**
- Managed automatically by BetterAuth
- Cookie-based session management

## 🌐 Base URL

Development:
```
http://localhost:4111
```

Production: (TBD)

## 📊 Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "count": 10
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

## 🚀 Quick Start

### 1. Get an API Key
```bash
# Create an API key (requires session auth initially)
curl -X POST http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer <session-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "My First Key"}'
```

Save the returned API key - it's only shown once!

### 2. Check Your Balance
```bash
curl http://localhost:4111/my/tokens/balance \
  -H "Authorization: Bearer re_YourApiKey"
```

### 3. List Your Abilities
```bash
curl http://localhost:4111/my/abilities \
  -H "Authorization: Bearer re_YourApiKey"
```

### 4. Ingest an API
```bash
# Option A: HAR file
curl -X POST http://localhost:4111/ingest \
  -H "Authorization: Bearer re_YourApiKey" \
  -F "file=@recording.har"

# Option B: Quick single endpoint
curl -X POST http://localhost:4111/ingest/api \
  -H "Authorization: Bearer <session-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "https://api.example.com/users",
    "service_name": "Example API"
  }'
```

## 💡 Common Use Cases

### Reverse Engineer an API from Browser Traffic
1. Record HAR file in Chrome DevTools (Network tab → Export HAR)
2. Upload HAR: `POST /ingest`
3. Wait for processing (check logs)
4. List abilities: `GET /my/abilities`
5. Search abilities: `GET /public/abilities?q=search query`

### Publish an Ability to Marketplace
1. Find ability ID: `GET /my/abilities`
2. Publish: `POST /my/abilities/:id/publish`
3. Check earnings: `GET /analytics/my/earnings`

### Monitor Usage & Costs
1. View stats: `GET /analytics/my/stats`
2. Check spending: `GET /analytics/my/spending`
3. Recent charges: `GET /analytics/my/recent-charges`

### Manage Credentials
1. List all: `GET /my/credentials?grouped=true`
2. View by domain: `GET /my/credentials/api.example.com`
3. Delete domain: `DELETE /my/credentials/api.example.com`

## 🔒 Security Best Practices

### API Keys
- Store API keys securely (password manager, secrets manager)
- Rotate keys every 90 days
- Use separate keys per environment (dev, staging, prod)
- Revoke immediately if compromised
- Never commit keys to version control

### Credentials
- All credentials are AES-256 encrypted at rest
- Encryption happens client-side
- API never sees plaintext credentials
- Each user has isolated credential storage
- Credentials never shared between users

### Domain Verification
- Proves ownership via DNS TXT records
- Required for earning revenue from published abilities
- Only one user can verify each domain
- Verification is permanent (contact support to change)

## 📈 Rate Limits

Current limits:
- **4M tokens/minute** (LLM processing)
- **480 requests/minute** (API calls)

Rate limit headers (TBD):
```
X-RateLimit-Limit: 480
X-RateLimit-Remaining: 450
X-RateLimit-Reset: 1635724800
```

## 🐛 Error Handling

### Common HTTP Status Codes
- `200` - Success
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (auth required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

### Error Response Examples

Authentication required:
```json
{
  "success": false,
  "error": "Authentication required"
}
```

Invalid input:
```json
{
  "success": false,
  "error": "Invalid amount. Must be a positive number representing USD value."
}
```

Rate limit exceeded:
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later."
}
```

## 🧪 Testing with Provided API Key

Throughout this documentation, we use this test API key:
```
re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5
```

**⚠️ This is a real API key for testing purposes. Do not use in production!**

## 📝 OpenAPI Specification

Get the full OpenAPI 3.1.0 spec:
```bash
curl http://localhost:4111/docs/openapi.json
```

Use with:
- Swagger UI
- Postman
- Insomnia
- OpenAPI generators

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/anthropics/claude-code/issues)
- **Documentation**: This repository
- **API Status**: Check `/health` endpoint

## 📜 Changelog

### 2025-10-27 - Initial Documentation
- Complete API documentation from real curl requests
- All endpoints tested with actual API key
- Response examples from live API
- Comprehensive error handling documented

## 📄 License

[Add your license here]

---

**Generated**: October 27, 2025
**API Version**: 1.0.0
**Documentation Version**: 1.0.0

---

# File: ./SETUP.md

# Documentation Setup Guide

This guide explains how to set up and use the documentation system with Docsify and MCP.

## 📚 Quick Setup

### 1. Install Docsify CLI (Optional but Recommended)

```bash
npm install -g docsify-cli
```

### 2. Setup Docsify Files

Run the automated setup script:

```bash
npm run docs:setup
```

This creates:
- `index.html` - Docsify HTML page
- `_sidebar.md` - Navigation sidebar
- `_navbar.md` - Top navigation bar
- `.nojekyll` - GitHub Pages compatibility

### 3. Serve Documentation Locally

```bash
npm run docs:serve
```

Then open http://localhost:3000 in your browser.

## 🔌 MCP Server Setup

The MCP (Model Context Protocol) server allows AI assistants like Claude to traverse and search the documentation.

### Installation

1. **Ensure MCP SDK is installed:**

```bash
npm install @modelcontextprotocol/sdk
```

2. **Test the MCP server:**

```bash
npm run docs:mcp
```

### Configure Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "reverse-engineer-docs": {
      "command": "node",
      "args": [
        "/absolute/path/to/reverse-engineer/mcp-servers/docs-server.js"
      ]
    }
  }
}
```

Replace `/absolute/path/to` with your actual project path.

### Restart Claude Desktop

After updating the config, restart Claude Desktop. The MCP server will now be available!

## 🛠️ Available Tools (MCP)

When using Claude Desktop with the MCP server, you'll have access to these tools:

### 1. `list_docs`
List all available documentation files with descriptions.

**Example:**
```
Please list the available documentation files.
```

### 2. `read_doc`
Read the contents of a specific documentation file.

**Parameters:**
- `filename` - Name of the file (e.g., "api-overview.md")

**Example:**
```
Read the tokens.md documentation.
```

### 3. `search_docs`
Search for a term across all documentation files.

**Parameters:**
- `query` - Search term or phrase
- `case_sensitive` - Optional boolean (default: false)

**Example:**
```
Search the docs for "authentication"
```

### 4. `get_endpoints`
Get a quick reference list of all API endpoints.

**Parameters:**
- `category` - Optional filter: "all", "public", "tokens", "abilities", etc.

**Example:**
```
Show me all the ingestion endpoints
```

### 5. `get_quick_start`
Get the quick start guide for using the API.

**Example:**
```
Show me the quick start guide
```

## 📖 Using Docsify

### Features

- **Search**: Full-text search across all docs
- **Sidebar**: Organized navigation
- **Copy Code**: Click to copy code blocks
- **Pagination**: Previous/Next navigation
- **Syntax Highlighting**: Bash, JSON, JavaScript

### Customization

Edit `docs/index.html` to customize:
- Theme colors
- Plugins
- Search options
- Sidebar behavior

### Sidebar Structure

Edit `docs/_sidebar.md` to change navigation:

```markdown
* [Home](/)
* **Section Name**
  * [Page 1](page1.md)
  * [Page 2](page2.md)
```

## 🚀 Deployment

### GitHub Pages

1. Push `docs/` folder to your GitHub repo
2. Go to Settings → Pages
3. Select "Deploy from branch"
4. Choose `main` branch and `/docs` folder
5. Save

Your docs will be available at: `https://yourusername.github.io/repo-name/`

### Netlify

1. Connect your GitHub repo to Netlify
2. Set build settings:
   - **Base directory**: `docs`
   - **Build command**: (leave empty)
   - **Publish directory**: `.` (current directory)
3. Deploy

### Vercel

1. Import your GitHub repo to Vercel
2. Set build settings:
   - **Framework Preset**: Other
   - **Root Directory**: `docs`
   - **Build Command**: (leave empty)
   - **Output Directory**: (leave empty)
3. Deploy

## 🔧 Troubleshooting

### Docsify not loading

1. Check that `index.html` exists in `docs/` folder
2. Ensure you're serving from the correct directory
3. Check browser console for errors

### MCP server not appearing in Claude

1. Verify the absolute path in `claude_desktop_config.json`
2. Ensure the file has execute permissions: `chmod +x mcp-servers/docs-server.js`
3. Check Claude Desktop logs: `~/Library/Logs/Claude/` (macOS)
4. Restart Claude Desktop completely

### Search not working

1. Ensure Docsify search plugin is loaded in `index.html`
2. Clear browser cache
3. Check that all markdown files are in the `docs/` directory

## 📝 Adding New Documentation

1. Create a new `.md` file in `docs/`
2. Add it to `_sidebar.md` for navigation
3. Update `DOCS_STRUCTURE` in `mcp-servers/docs-server.js`
4. Restart MCP server if running

## 🎨 Customizing Themes

Docsify themes:
- `vue.css` (default)
- `buble.css`
- `dark.css`
- `pure.css`

Change in `docs/index.html`:
```html
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify@4/lib/themes/dark.css">
```

## 📊 Analytics (Optional)

Add Google Analytics to `docs/index.html`:

```javascript
window.$docsify = {
  // ... other config
  ga: 'UA-XXXXX-Y',
}
```

```html
<script src="//cdn.jsdelivr.net/npm/docsify/lib/plugins/ga.min.js"></script>
```

## 🤝 Contributing

When adding API documentation:

1. Test endpoints with real curl requests
2. Capture actual response shapes
3. Document all parameters and error cases
4. Include examples with the test API key
5. Update `_sidebar.md` navigation
6. Update MCP server `DOCS_STRUCTURE`

## 📚 Resources

- [Docsify Documentation](https://docsify.js.org)
- [MCP Documentation](https://modelcontextprotocol.io)
- [Markdown Guide](https://www.markdownguide.org)
- [GitHub Pages](https://pages.github.com)

---

# File: ./_navbar.md

<!-- _navbar.md -->

* [GitHub](https://github.com/yourusername/reverse-engineer)
* [API Status](http://localhost:4111/health)
* [OpenAPI Spec](http://localhost:4111/docs/openapi.json)

---

# File: ./_sidebar.md

<!-- _sidebar.md -->

* [🏠 Home](/)

* **Getting Started**
  * [📖 API Overview](api-overview.md)
  * [🔑 Authentication](api-overview.md#authentication)
  * [🚀 Quick Start](README.md#quick-start)

* **Public Endpoints**
  * [🌐 Public APIs](public-endpoints.md)

* **Account & Tokens**
  * [💰 Tokens & Balance](tokens.md)
  * [🔐 API Keys](api-keys.md)
  * [🌍 Domain Verification](domains.md)

* **Ability Management**
  * [⚡ User Abilities](abilities.md)
  * [📊 Analytics](analytics.md)

* **Security & Storage**
  * [🔒 Credentials](credentials.md)

* **Ingestion & AI**
  * [📥 Ingestion](ingestion.md)
  * [HAR Files](ingestion.md#har-file-ingestion)
  * [Quick API](ingestion.md#quick-api-endpoint-ingestion)
  * [Batch URLs](ingestion.md#batch-url-ingestion)

* **Reference**
  * [📋 OpenAPI Spec](public-endpoints.md#openapi-specification)
  * [❌ Error Handling](README.md#error-handling)
  * [⚡ Rate Limits](README.md#rate-limits)

---

# File: ./abilities.md

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

---

# File: ./analytics.md

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

---

# File: ./api-keys.md

# API Key Management

All endpoints in this section require authentication via API key or session token.

API keys allow programmatic access to the API without requiring browser sessions. They can be used for:
- CI/CD pipelines
- Scripts and automation
- Third-party integrations
- MCP (Model Context Protocol) servers

## Create API Key

### POST /my/api-keys

Create a new API key for the authenticated user.

**Authentication:** Required (API Key or Session)

**Request Body:**
```json
{
  "name": "Production Server",
  "expiresAt": "2026-10-27T00:00:00.000Z",
  "ratelimit": {
    "limit": 1000,
    "duration": 3600000
  }
}
```

**Field Descriptions:**
- `name` (required): Human-readable name for the API key
- `expiresAt` (optional): Expiration date (ISO 8601 format). Default: 1 year from creation
- `ratelimit` (optional): Custom rate limit configuration
  - `limit`: Number of requests allowed
  - `duration`: Time window in milliseconds

**Request:**
```bash
curl -X POST http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My API Key",
    "expiresAt": "2026-10-27T00:00:00.000Z"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "API key created successfully. Store the key securely - it won't be shown again.",
  "key": "re_NewApiKey123abc456def789ghi",
  "keyId": "key_abc123",
  "apiKeyId": "18154cf0-e7d1-497b-b417-f41b8a63786a"
}
```

**Response Fields:**
- `key`: **Full API key (only shown once!)** - Store this securely
- `keyId`: Short identifier for the key
- `apiKeyId`: UUID for the API key record

**⚠️ Important Security Notes:**
- The full API key is **only returned once** during creation
- Store it securely (password manager, secrets manager, etc.)
- If lost, you must revoke and create a new key
- Never commit API keys to version control

**Validation:**
- `name` is required and must be a string
- `expiresAt` must be a valid ISO 8601 date string (if provided)
- `ratelimit` must have both `limit` and `duration` if provided

**HTTP Status Codes:**
- `200`: Success
- `400`: Invalid request body (missing name or invalid format)
- `401`: Authentication required
- `500`: Server error

---

## List API Keys

### GET /my/api-keys

List all API keys for the authenticated user.

**Authentication:** Required (API Key or Session)

**Request:**
```bash
curl http://localhost:4111/my/api-keys \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "keys": [
    {
      "apiKeyId": "18154cf0-e7d1-497b-b417-f41b8a63786a",
      "name": "asdf",
      "keyPrefix": "re_B1K9vr8t...",
      "createdAt": "2025-10-27T03:24:29.093Z",
      "expiresAt": "2026-10-27T03:24:27.352Z",
      "lastUsedAt": "2025-10-27T03:40:03.013Z",
      "revokedAt": null
    },
    {
      "apiKeyId": "988a313e-751e-4d4a-ad11-436eae567423",
      "name": "meow",
      "keyPrefix": "re_AgRc8FxE...",
      "createdAt": "2025-10-26T12:43:05.106Z",
      "expiresAt": "2026-10-26T12:43:03.263Z",
      "lastUsedAt": "2025-10-26T15:06:03.620Z",
      "revokedAt": null
    }
  ]
}
```

**Response Fields (per key):**
- `apiKeyId`: UUID for the key
- `name`: Human-readable name
- `keyPrefix`: First few characters of the key (for identification)
- `createdAt`: When the key was created
- `expiresAt`: When the key expires (null if no expiration)
- `lastUsedAt`: Last time the key was used (null if never used)
- `revokedAt`: When the key was revoked (null if active)

**Key Status:**
- Active: `revokedAt` is null and `expiresAt` is in the future (or null)
- Revoked: `revokedAt` is not null
- Expired: `expiresAt` is in the past

**HTTP Status Codes:**
- `200`: Success
- `401`: Authentication required
- `500`: Server error

**Notes:**
- Full API keys are never returned after creation
- Only the prefix (first 12 characters) is shown for identification
- Revoked keys remain in the list for audit purposes

---

## Revoke API Key

### DELETE /my/api-keys/:apiKeyId

Revoke (deactivate) an API key. Revoked keys cannot be un-revoked.

**Authentication:** Required (API Key or Session)

**Path Parameters:**
- `apiKeyId`: The UUID of the API key to revoke

**Request:**
```bash
curl -X DELETE http://localhost:4111/my/api-keys/18154cf0-e7d1-497b-b417-f41b8a63786a \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response (Success):**
```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

**Response (Not Found):**
```json
{
  "success": false,
  "error": "API key not found or does not belong to this user"
}
```

**Response (Already Revoked):**
```json
{
  "success": false,
  "error": "API key is already revoked"
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Key not found or already revoked
- `401`: Authentication required
- `500`: Server error

**Notes:**
- Revocation is immediate - the key cannot be used after this call returns
- Revoked keys cannot be reactivated
- The key record remains in the database for audit purposes
- If you revoke the key you're currently using, subsequent requests will fail

**Best Practices:**
- Rotate API keys regularly (every 90 days recommended)
- Revoke keys immediately if compromised
- Use separate keys for different environments (dev, staging, prod)
- Monitor `lastUsedAt` to detect unused or stale keys

---

# File: ./api-overview.md

# API Overview

## Base URL
```
http://localhost:4111
```

## Authentication
All protected endpoints require authentication via one of:
- **API Key**: Pass in `Authorization: Bearer <api_key>` header
- **Session Token**: BetterAuth session cookie

## API Endpoints Summary

### Public Endpoints (No Auth Required)
- `GET /health` - Health check
- `GET /public/abilities` - Search published abilities (requires API key but no session)
- `GET /abilities/:id` - Get ability details
- `GET /analytics/public/popular` - Get popular abilities
- `GET /analytics/public/top-earning` - Get top earning abilities
- `GET /docs/openapi.json` - OpenAPI specification

### Token/Balance Management (Protected)
- `GET /my/tokens/balance` - Get user's token balance
- `POST /my/tokens/purchase` - Purchase tokens
- `GET /my/tokens/transactions` - Get transaction history

### Domain Verification (Protected)
- `POST /my/domains/verify` - Request domain verification
- `POST /my/domains/:domain/verify` - Verify domain ownership
- `GET /my/domains` - Get user's domains
- `DELETE /my/domains/:domain` - Delete domain verification

### API Key Management (Protected)
- `POST /my/api-keys` - Create new API key
- `GET /my/api-keys` - List user's API keys
- `DELETE /my/api-keys/:apiKeyId` - Revoke API key

### User Abilities Management (Protected)
- `GET /my/abilities` - Get user's abilities
- `GET /my/abilities/favorites` - Get favorite abilities
- `POST /my/abilities/:abilityId/favorite` - Toggle favorite status
- `POST /my/abilities/:abilityId/publish` - Publish ability
- `DELETE /my/abilities/:abilityId` - Delete ability

### Analytics (Protected)
- `GET /analytics/my/stats` - Get user's ability usage stats
- `GET /analytics/my/abilities/:abilityId` - Get detailed ability stats
- `GET /analytics/my/earnings` - Get user's earnings as indexer
- `GET /analytics/my/spending` - Get user's spending breakdown
- `GET /analytics/my/recent-charges` - Get recent charges
- `GET /analytics/platform/revenue` - Get platform revenue (admin)

### Credentials Management (Protected)
- `POST /my/credentials/stream` - Stream/upsert credentials
- `GET /my/credentials` - List all credentials
- `GET /my/credentials/:domain` - Get credentials by domain
- `DELETE /my/credentials/:domain` - Delete all credentials for domain
- `DELETE /my/credentials/by-id/:credentialId` - Delete specific credential

### Ingestion (Protected)
- `POST /ingest` - Ingest HAR file
- `POST /ingest/api` - Quick ingest single API endpoint
- `POST /ingest/urls` - Batch URL ingestion

## Common Response Format

Success:
```json
{
  "success": true,
  "data": { ... },
  "count": 10
}
```

Error:
```json
{
  "success": false,
  "error": "Error message"
}
```

## Rate Limits
- Max tokens per minute: 4M
- Max requests per minute: 480

## Next Steps
See individual endpoint documentation for detailed request/response examples.

---

# File: ./credentials.md

# Credentials Management

All endpoints in this section require authentication via API key or session token.

Credentials are encrypted authentication data (headers, cookies, tokens) extracted from HAR files. They enable abilities to make authenticated requests to APIs on behalf of the user.

**Security:**
- All credentials are encrypted at rest using AES-256
- Credentials are encrypted with user-specific encryption keys
- Only the owning user can decrypt their credentials
- Credentials are never shared between users

## Stream Credentials

### POST /my/credentials/stream

Upload or update credentials for a domain. This endpoint upserts credentials (updates if exists, creates if new).

**Authentication:** Required (API Key or Session)

**Request Body:**
```json
{
  "domain": "api.example.com",
  "credentials": [
    {
      "type": "header",
      "key": "Authorization",
      "encryptedValue": "{\"ciphertext\":\"...\",\"iv\":\"...\"}",
      "metadata": {
        "source": "har_file",
        "extracted_at": "2025-10-27T03:00:00.000Z"
      }
    },
    {
      "type": "cookie",
      "key": "session",
      "encryptedValue": "{\"ciphertext\":\"...\",\"iv\":\"...\"}",
      "metadata": {}
    }
  ]
}
```

**Field Descriptions:**
- `domain` (required): Domain these credentials belong to
- `credentials` (required): Array of credential objects
  - `type` (required): Credential type (`header`, `cookie`, `query`, `body`)
  - `key` (required): Credential key/name
  - `encryptedValue` (required): Encrypted credential value (JSON string with `ciphertext` and `iv`)
  - `metadata` (optional): Additional metadata object

**Request:**
```bash
curl -X POST http://localhost:4111/my/credentials/stream \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "api.example.com",
    "credentials": [
      {
        "type": "header",
        "key": "Authorization",
        "encryptedValue": "{\"ciphertext\":\"abc123\",\"iv\":\"def456\"}"
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "count": 1,
  "credentials": [
    {
      "credentialId": "cred_123",
      "userId": "user_xyz",
      "domain": "api.example.com",
      "credentialType": "header",
      "credentialKey": "Authorization",
      "encryptedValue": "{\"ciphertext\":\"abc123\",\"iv\":\"def456\"}",
      "metadata": {},
      "createdAt": "2025-10-27T03:30:00.000Z",
      "updatedAt": "2025-10-27T03:30:00.000Z"
    }
  ]
}
```

**Validation:**
- `domain` must be a non-empty string
- `credentials` must be a non-empty array
- Each credential must have `type`, `key`, and `encryptedValue`

**HTTP Status Codes:**
- `200`: Success
- `400`: Invalid request format
- `401`: Authentication required
- `500`: Server error

**Notes:**
- Upserts: If a credential with the same domain+type+key exists, it's updated
- Encryption must be done client-side before calling this endpoint
- The API never sees plaintext credentials
- Used primarily during HAR file ingestion

---

## List Credentials

### GET /my/credentials

List all credentials for the authenticated user.

**Authentication:** Required (API Key or Session)

**Query Parameters:**
- `grouped` (optional): If `true`, group credentials by domain

**Request (Flat List):**
```bash
curl http://localhost:4111/my/credentials \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response (Flat List):**
```json
{
  "success": true,
  "count": 1339,
  "credentials": [
    {
      "credentialId": "8813c0c7-5eda-4577-9ee1-43b449a3deb2",
      "userId": "751beb69-eab9-4a52-a35c-e053587d8500",
      "domain": "accounts.google.com",
      "credentialType": "header",
      "credentialKey": "sec-ch-ua",
      "encryptedValue": "{\"ciphertext\":\"...\",\"iv\":\"...\"}",
      "metadata": {},
      "createdAt": "2025-10-26T12:14:09.861Z",
      "updatedAt": "2025-10-26T12:14:09.861Z"
    }
  ]
}
```

**Request (Grouped by Domain):**
```bash
curl 'http://localhost:4111/my/credentials?grouped=true' \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response (Grouped):**
```json
{
  "success": true,
  "grouped": true,
  "credentials": {
    "accounts.google.com": [
      {
        "credentialId": "8813c0c7-5eda-4577-9ee1-43b449a3deb2",
        "domain": "accounts.google.com",
        "credentialType": "header",
        "credentialKey": "sec-ch-ua",
        "encryptedValue": "{\"ciphertext\":\"...\",\"iv\":\"...\"}",
        "createdAt": "2025-10-26T12:14:09.861Z"
      }
    ],
    "api.example.com": [
      {
        "credentialId": "def456",
        "domain": "api.example.com",
        "credentialType": "cookie",
        "credentialKey": "session",
        "encryptedValue": "{\"ciphertext\":\"...\",\"iv\":\"...\"}",
        "createdAt": "2025-10-26T12:15:00.000Z"
      }
    ]
  }
}
```

**HTTP Status Codes:**
- `200`: Success
- `401`: Authentication required
- `500`: Server error

**Use Cases:**
- Audit what credentials are stored
- Check which domains have credentials
- Clean up old/unused credentials

---

## Get Credentials by Domain

### GET /my/credentials/:domain

Get all credentials for a specific domain.

**Authentication:** Required (API Key or Session)

**Path Parameters:**
- `domain`: Domain to get credentials for (e.g., 'api.example.com')

**Request:**
```bash
curl http://localhost:4111/my/credentials/accounts.google.com \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "domain": "accounts.google.com",
  "count": 10,
  "credentials": [
    {
      "credentialId": "8813c0c7-5eda-4577-9ee1-43b449a3deb2",
      "domain": "accounts.google.com",
      "credentialType": "header",
      "credentialKey": "sec-ch-ua",
      "encryptedValue": "{\"ciphertext\":\"...\",\"iv\":\"...\"}",
      "metadata": {},
      "createdAt": "2025-10-26T12:14:09.861Z",
      "updatedAt": "2025-10-26T12:14:09.861Z"
    }
  ]
}
```

**HTTP Status Codes:**
- `200`: Success (empty array if no credentials for domain)
- `400`: Domain parameter missing
- `401`: Authentication required
- `500`: Server error

**Notes:**
- Returns empty array if no credentials exist for the domain
- Domain matching is exact (not subdomain-aware)

---

## Delete Credentials by Domain

### DELETE /my/credentials/:domain

Delete all credentials for a specific domain.

**Authentication:** Required (API Key or Session)

**Path Parameters:**
- `domain`: Domain to delete credentials for

**Request:**
```bash
curl -X DELETE http://localhost:4111/my/credentials/accounts.google.com \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "domain": "accounts.google.com",
  "deletedCount": 10
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Domain parameter missing
- `401`: Authentication required
- `500`: Server error

**⚠️ Warning:**
- This deletes ALL credentials for the domain
- Abilities using these credentials will fail
- Deletion is permanent and cannot be undone
- Consider exporting/backing up credentials before deletion

**Use Cases:**
- Clean up credentials after revoking access
- Remove credentials for deprecated APIs
- Security: Revoke all access to a compromised account

---

## Delete Specific Credential

### DELETE /my/credentials/by-id/:credentialId

Delete a single credential by its ID.

**Authentication:** Required (API Key or Session)

**Path Parameters:**
- `credentialId`: UUID of the credential to delete

**Request:**
```bash
curl -X DELETE http://localhost:4111/my/credentials/by-id/8813c0c7-5eda-4577-9ee1-43b449a3deb2 \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "credentialId": "8813c0c7-5eda-4577-9ee1-43b449a3deb2"
}
```

**Response (Not Found):**
```json
{
  "success": false,
  "error": "Credential not found"
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Credential ID parameter missing
- `404`: Credential not found or doesn't belong to user
- `401`: Authentication required
- `500`: Server error

**Use Cases:**
- Remove specific outdated credentials (e.g., expired tokens)
- Fine-grained credential management
- Clean up duplicates

---

## Credential Encryption

Credentials must be encrypted client-side before being sent to the API. The API stores encrypted credentials and never has access to plaintext.

**Encryption Format:**
```json
{
  "ciphertext": "base64-encoded-encrypted-data",
  "iv": "base64-encoded-initialization-vector"
}
```

**Encryption Algorithm:**
- Algorithm: AES-256-GCM
- Key derivation: User-specific encryption key (derived from user ID + secret)
- IV: Random 16-byte initialization vector per encryption

**Example (Node.js):**
```javascript
const crypto = require('crypto');

function encryptCredential(plaintext, encryptionKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');

  return JSON.stringify({
    ciphertext,
    iv: iv.toString('base64')
  });
}
```

**Best Practices:**
- Encrypt credentials in the browser/client before transmission
- Never log or display plaintext credentials
- Rotate encryption keys regularly
- Use secure random IVs for each encryption
- Clear plaintext credentials from memory after encryption

---

# File: ./domains.md

# Domain Verification

All endpoints in this section require authentication via API key or session token.

Domain verification allows users to prove ownership of domains, which enables them to:
- Publish abilities for their verified domains
- Earn revenue from ability executions
- Control access to their API endpoints

## Request Domain Verification

### POST /my/domains/verify

Request verification for a domain. Returns a TXT record that must be added to DNS.

**Authentication:** Required (API Key or Session)

**Request Body:**
```json
{
  "domain": "api.example.com"
}
```

**Request:**
```bash
curl -X POST http://localhost:4111/my/domains/verify \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "api.example.com"
  }'
```

**Response (Success):**
```json
{
  "success": true,
  "domain": "api.example.com",
  "verificationToken": "unbrowse-verify=abc123def456",
  "dnsRecord": {
    "type": "TXT",
    "host": "_unbrowse-verification",
    "value": "abc123def456"
  },
  "instructions": "Add a TXT record to your DNS with the following:\nHost: _unbrowse-verification.api.example.com\nValue: abc123def456\n\nThen call POST /my/domains/api.example.com/verify to complete verification.",
  "status": "pending"
}
```

**Response (Domain Already Verified):**
```json
{
  "success": false,
  "error": "Domain api.example.com is already verified for this user"
}
```

**Response (Domain Verified by Another User):**
```json
{
  "success": false,
  "error": "Domain api.example.com is already verified by another user"
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Invalid domain or domain already verified
- `401`: Authentication required
- `500`: Server error

**Validation:**
- Domain must be a valid string (e.g., 'api.example.com')
- Domain cannot already be verified
- Only one user can verify each domain

---

## Verify Domain Ownership

### POST /my/domains/:domain/verify

Verify domain ownership by checking for the TXT record in DNS.

**Authentication:** Required (API Key or Session)

**Path Parameters:**
- `domain`: The domain to verify (e.g., 'api.example.com')

**Request:**
```bash
curl -X POST http://localhost:4111/my/domains/api.example.com/verify \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response (Success):**
```json
{
  "success": true,
  "domain": "api.example.com",
  "verified": true,
  "verifiedAt": "2025-10-27T03:40:00.000Z",
  "message": "Domain successfully verified!"
}
```

**Response (TXT Record Not Found):**
```json
{
  "success": false,
  "error": "DNS verification failed. TXT record not found at _unbrowse-verification.api.example.com",
  "expectedValue": "abc123def456",
  "foundRecords": []
}
```

**Response (Domain Not Requested):**
```json
{
  "success": false,
  "error": "Domain verification not found. Please request verification first using POST /my/domains/verify"
}
```

**HTTP Status Codes:**
- `200`: Success (domain verified)
- `400`: Verification failed (DNS record not found or incorrect)
- `401`: Authentication required
- `500`: Server error

**Verification Process:**
1. Request verification: `POST /my/domains/verify`
2. Add TXT record to your DNS:
   - Host: `_unbrowse-verification.{your-domain}`
   - Value: `{verification-token}`
3. Wait for DNS propagation (can take up to 48 hours)
4. Verify ownership: `POST /my/domains/{your-domain}/verify`

---

## Get User Domains

### GET /my/domains

Get all domains (verified and pending) for the authenticated user.

**Authentication:** Required (API Key or Session)

**Request:**
```bash
curl http://localhost:4111/my/domains \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "count": 0,
  "domains": []
}
```

**Example with Data:**
```json
{
  "success": true,
  "count": 2,
  "domains": [
    {
      "domainId": "domain_123",
      "userId": "user_xyz",
      "domain": "api.example.com",
      "status": "verified",
      "verificationToken": "abc123def456",
      "verifiedAt": "2025-10-27T03:40:00.000Z",
      "createdAt": "2025-10-27T03:30:00.000Z",
      "updatedAt": "2025-10-27T03:40:00.000Z"
    },
    {
      "domainId": "domain_456",
      "userId": "user_xyz",
      "domain": "staging.example.com",
      "status": "pending",
      "verificationToken": "def456ghi789",
      "verifiedAt": null,
      "createdAt": "2025-10-27T04:00:00.000Z",
      "updatedAt": "2025-10-27T04:00:00.000Z"
    }
  ]
}
```

**Domain Status:**
- `pending`: Verification requested but not completed
- `verified`: Domain ownership verified

**HTTP Status Codes:**
- `200`: Success
- `401`: Authentication required
- `500`: Server error

---

## Delete Domain Verification

### DELETE /my/domains/:domain

Delete a domain verification. Only works for unverified domains (status: pending).

**Authentication:** Required (API Key or Session)

**Path Parameters:**
- `domain`: The domain to delete (e.g., 'api.example.com')

**Request:**
```bash
curl -X DELETE http://localhost:4111/my/domains/api.example.com \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Domain verification deleted successfully",
  "domain": "api.example.com"
}
```

**Response (Already Verified):**
```json
{
  "success": false,
  "error": "Cannot delete verified domain. Please contact support if you need to remove a verified domain."
}
```

**Response (Not Found):**
```json
{
  "success": false,
  "error": "Domain verification not found"
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Cannot delete (domain already verified or not found)
- `401`: Authentication required
- `500`: Server error

**Notes:**
- Only pending (unverified) domains can be deleted
- Verified domains require support contact to remove
- Useful for cleaning up failed verification attempts

---

# File: ./ingestion.md

# Ingestion Endpoints

All endpoints in this section require authentication via API key or session token.

Ingestion endpoints allow you to reverse-engineer APIs from:
- **HAR files**: Browser network recordings containing full API request/response data
- **Single API endpoints**: Quick ingestion from URLs or curl commands
- **Batch URLs**: Multiple endpoints ingested in one request

## HAR File Ingestion

### POST /ingest

Ingest a HAR (HTTP Archive) file to automatically reverse-engineer and create wrappers for all API endpoints found.

**Authentication:** Required (API Key or Session)

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `file`: HAR file (.har or .json)

**Request:**
```bash
curl -X POST http://localhost:4111/ingest \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5" \
  -F "file=@recording.har"
```

**Response:**
```json
{
  "success": true,
  "message": "HAR file accepted for processing. Large files will be chunked and processed in parallel.",
  "data": {
    "ingestion_id": "uuid-abc123",
    "session_id": "session-1761536238683-uuid-def456",
    "har_file": {
      "filename": "recording.har",
      "local_path": "/path/to/har-uploads/har-1761536238683-uuid.har",
      "file_size": 2458624,
      "total_entries": 145
    },
    "deduplication": {
      "exact_hash": "7a8b9c0d1e2f3456...",
      "max_similarity_to_existing": "12.5%",
      "threshold": "95%",
      "status": "unique"
    },
    "storage": {
      "vector_db": "Abilities will be indexed in Infraxa vector DB for semantic search",
      "backup_dir": "data/",
      "note": "Use GET /abilities/search with natural language queries to find abilities once processing is complete"
    },
    "processing": {
      "mode": "chunked_queued",
      "max_tokens_per_chunk": 100000,
      "group_by_domain": true,
      "continuation_passes": 3,
      "rate_limits": {
        "max_tokens_per_minute": "4M",
        "max_requests_per_minute": 480
      },
      "status": "Processing in background. Check server logs for progress.",
      "note": "Large HAR files are automatically split into chunks and queued for sequential processing to respect xAI rate limits"
    }
  }
}
```

**Duplicate Detection:**

Exact duplicate:
```json
{
  "success": false,
  "error": "This HAR file has already been ingested (exact duplicate)",
  "data": {
    "existing_ingestion_id": "uuid-old",
    "existing_session_id": "session-old",
    "ingested_at": "2025-10-26T12:00:00.000Z"
  }
}
```

Similar HAR (95% similarity threshold):
```json
{
  "success": false,
  "error": "This HAR file is too similar to a previously ingested file (97.8% similarity)",
  "data": {
    "similarity_percentage": "97.8",
    "similar_to_file": "previous-recording.har",
    "similar_to_ingestion_id": "uuid-old",
    "ingested_at": "2025-10-26T12:00:00.000Z",
    "threshold": "95%"
  }
}
```

**Validation:**
- File must have `.har` extension or `application/json` mime type
- File size limits apply (check server configuration)
- HAR must be valid JSON with proper structure

**HTTP Status Codes:**
- `200`: Success (processing started)
- `400`: Invalid file type or format
- `401`: Authentication required
- `409`: Duplicate file detected
- `500`: Server error

**Processing Flow:**

1. **Upload**: File is uploaded and saved locally
2. **Deduplication**:
   - Exact hash check (SHA-256)
   - MinHash similarity check (95% threshold)
3. **Chunking**: Large HAR files are split into chunks by domain
4. **Queuing**: Chunks are queued for sequential processing
5. **Wrapper Generation**:
   - Agent loads HAR chunk
   - Analyzes endpoints
   - Generates input/output schemas
   - Creates executable wrappers
   - Stores in user's private vector DB
6. **Credential Extraction**: Headers, cookies, and auth tokens are encrypted and stored

**Configuration (from `har-config.ts`):**
- `maxTokensPerChunk`: 100,000 tokens per chunk
- `groupByDomain`: true (chunks organized by domain)
- `continuationPasses`: 3 (max iterations per chunk)

**Background Processing:**
- Processing is asynchronous (non-blocking)
- Check server logs for real-time progress
- Abilities appear in `/my/abilities` as they're created
- Processing can take 1-30 minutes depending on HAR size

**Best Practices:**
- Record HAR files during normal API usage (not just one request)
- Include authentication flows in the recording
- Filter out unnecessary requests (ads, trackers, analytics)
- Use Chrome DevTools or browser extensions to export HAR
- Keep HAR files under 100MB for best performance

---

## Quick API Endpoint Ingestion

### POST /ingest/api

Quickly ingest a single API endpoint from a URL or curl command.

**Authentication:** Required (Session Token - API Key not supported for this endpoint)

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "input": "https://api.example.com/users/123",
  "service_name": "Example API",
  "ability_name": "get_user",
  "description": "Get user by ID"
}
```

**Curl Command Input:**
```json
{
  "input": "curl 'https://api.example.com/users' -H 'Authorization: Bearer token123'",
  "service_name": "Example API",
  "ability_name": "list_users",
  "description": "List all users"
}
```

**Field Descriptions:**
- `input` (required): URL or curl command
- `service_name` (required): Name of the service/API
- `ability_name` (optional): Custom name for the ability
- `description` (optional): Description of what the endpoint does

**Request:**
```bash
curl -X POST http://localhost:4111/ingest/api \
  -H "Authorization: Bearer <session-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "https://api.example.com/users/123",
    "service_name": "Example API"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "API endpoint ingested successfully",
  "ability_id": "uuid-abc123",
  "ability_name": "get_user",
  "service_name": "Example API",
  "endpoint": "https://api.example.com/users/123",
  "input_schema": {
    "type": "object",
    "properties": {
      "userId": {
        "type": "string",
        "description": "User ID to fetch"
      }
    }
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "name": { "type": "string" },
      "email": { "type": "string" }
    }
  }
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Invalid input or missing required fields
- `401`: Authentication required (session only)
- `500`: Server error

**Notes:**
- Session token required (BetterAuth) - API keys not supported
- Makes actual request to the endpoint to infer schema
- Stores ability in user's private collection
- Credentials from curl command are encrypted and stored

**Input Formats:**

URL with query params:
```
https://api.example.com/users?role=admin&limit=10
```

Curl command:
```
curl 'https://api.example.com/users' \
  -H 'Authorization: Bearer token123' \
  -H 'Content-Type: application/json' \
  -d '{"name":"John"}'
```

**Limitations:**
- Only works for GET and simple POST requests
- Complex authentication flows require HAR ingestion
- No support for multi-step API calls

---

## Batch URL Ingestion

### POST /ingest/urls

Ingest multiple URLs/curl commands in one request. The agent analyzes all URLs and creates wrappers.

**Authentication:** Required (Session Token - API Key not supported for this endpoint)

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "text": "Here are the API endpoints:\n\ncurl 'https://api.example.com/users' -H 'Authorization: Bearer token'\ncurl 'https://api.example.com/posts' -H 'Authorization: Bearer token'\n\nhttps://api.example.com/comments?postId=123",
  "service_name": "Example API"
}
```

**Field Descriptions:**
- `text` (required): Text containing URLs and/or curl commands (can include prose)
- `service_name` (required): Name of the service/API

**Request:**
```bash
curl -X POST http://localhost:4111/ingest/urls \
  -H "Authorization: Bearer <session-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "API Endpoints:\n\ncurl https://api.example.com/users\nhttps://api.example.com/posts",
    "service_name": "Example API"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "URL ingestion completed successfully.",
  "data": {
    "session_id": "url-ingestion-1761536238683-uuid",
    "service_name": "Example API",
    "text_length": 152,
    "tool_calls_count": 3,
    "abilities_ingested": 2,
    "abilities": [
      {
        "ability_id": "uuid-abc123",
        "ability_name": "list_users",
        "success": true
      },
      {
        "ability_id": "uuid-def456",
        "ability_name": "list_posts",
        "success": true
      }
    ],
    "storage": {
      "vector_db": "Abilities indexed in Infraxa vector DB for semantic search",
      "backup_dir": "generated/",
      "note": "Use GET /abilities/search with natural language queries to find abilities"
    },
    "status": "Processing complete"
  }
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Invalid input or missing required fields
- `401`: Authentication required (session only)
- `500`: Server error

**Processing:**
- The agent extracts all URLs and curl commands from the text
- Each endpoint is analyzed and wrapped
- Processing is synchronous (blocks until complete)
- Can take 30 seconds to 5 minutes depending on number of URLs

**Input Format:**
- Free-form text with URLs and curl commands
- Agent is intelligent enough to extract endpoints from prose
- Supports mixed content (documentation, comments, etc.)

**Example Text:**
```
These are the API endpoints for the user service:

1. List users:
curl 'https://api.example.com/users' \
  -H 'Authorization: Bearer token123'

2. Get user by ID:
GET https://api.example.com/users/{id}

3. Create user:
curl -X POST 'https://api.example.com/users' \
  -H 'Content-Type: application/json' \
  -d '{"name":"John","email":"john@example.com"}'
```

**Best Practices:**
- Include authentication headers in curl commands
- Provide meaningful service names
- Group related endpoints together
- Include example responses in curl commands for better schema inference
- Keep batches under 20 URLs for best performance

---

## Comparison: When to Use Each Endpoint

| Feature | HAR Ingestion | Quick API | Batch URLs |
|---------|--------------|-----------|------------|
| **Best For** | Full API discovery | Single endpoint | Multiple endpoints |
| **Authentication** | API Key or Session | Session only | Session only |
| **Speed** | Slow (1-30 min) | Fast (5-30 sec) | Medium (30 sec - 5 min) |
| **Credentials** | Auto-extracted | From curl | From curl |
| **Complexity** | High | Low | Medium |
| **Schema Quality** | Excellent | Good | Good |
| **Use Case** | Complete API reverse engineering | Quick wrapper creation | Documenting API endpoints |

**Recommendations:**
- **HAR**: Use for comprehensive API discovery and complex authentication flows
- **Quick API**: Use for quick prototyping and simple endpoints
- **Batch URLs**: Use when you have API documentation or a list of endpoints

## Error Handling

All ingestion endpoints may return errors for:

**Invalid Authentication:**
```json
{
  "success": false,
  "error": "Authentication required. Provide either a BetterAuth session token or Unkey API key in Authorization header."
}
```

**Invalid File:**
```json
{
  "success": false,
  "error": "Invalid file type. Please upload a HAR file (.har or .json)"
}
```

**Processing Failure:**
```json
{
  "success": false,
  "error": "Failed to process HAR file. Please check the file format and try again."
}
```

**Rate Limiting:**
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later."
}
```

---

# File: ./public-endpoints.md

# Public Endpoints

## Health Check

### GET /health

Check if the API server is running.

**Authentication:** None required

**Request:**
```bash
curl http://localhost:4111/health
```

**Response:**
```json
{
  "ok": true,
  "service": "unbrowse-agent-api",
  "timestamp": 1761536238683
}
```

---

## Search Published Abilities

### GET /public/abilities

Search for published abilities using semantic search. Requires API key authentication but filters based on user's available credentials.

**Authentication:** API Key required

**Query Parameters:**
- `q` (required): Search query string
- `top_k` (optional): Number of results to return (default: 10)

**Request:**
```bash
curl 'http://localhost:4111/public/abilities?q=test&top_k=5' \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response:**
```json
{
  "success": true,
  "query": "test",
  "count": 0,
  "results": []
}
```

**Notes:**
- Results are filtered based on:
  - User's available credentials
  - Only returns abilities user can actually execute
  - Abilities requiring no auth are always included

---

## Get Ability Details

### GET /abilities/:id

Get details for a specific published ability by ID.

**Authentication:** Optional (better results with auth)

**Path Parameters:**
- `id`: Ability ID (UUID)

**Request:**
```bash
curl http://localhost:4111/abilities/cb889ba2-a095-40df-b5d0-306a6e6a8697 \
  -H "Authorization: Bearer re_B1K9vr8t1j5abxjjkwXdieQ9QvCV1LbgfMndAtFUqLD5"
```

**Response (Success):**
```json
{
  "success": true,
  "ability": {
    "abilityId": "cb889ba2-a095-40df-b5d0-306a6e6a8697",
    "abilityName": "get_version_info",
    "serviceName": "zeemart-buyer",
    "domain": "dev-buyer.zeemart.co",
    "description": "Fetches the version information...",
    "embedding": [...],
    "createdAt": "2025-10-26T12:14:09.861Z",
    "updatedAt": "2025-10-26T12:14:09.861Z"
  }
}
```

**Response (Not Found):**
```json
{
  "success": false,
  "error": "Ability not found, not published, or you don't have the required credentials to access it"
}
```

**HTTP Status Codes:**
- `200`: Success
- `404`: Ability not found or not accessible
- `401`: Authentication required for this ability

---

## Get Popular Abilities

### GET /analytics/public/popular

Get leaderboard of most popular published abilities.

**Authentication:** None required

**Query Parameters:**
- `limit` (optional): Number of results (1-100, default: 10)

**Request:**
```bash
curl 'http://localhost:4111/analytics/public/popular?limit=20'
```

**Response:**
```json
{
  "success": true,
  "count": 0,
  "abilities": []
}
```

**Response Fields:**
Each ability in the array contains:
- `abilityId`: Unique identifier
- `abilityName`: Name of the ability
- `serviceName`: Service it belongs to
- `executionCount`: Number of times executed
- `successRate`: Percentage of successful executions
- `avgExecutionTime`: Average execution time in ms

---

## Get Top Earning Abilities

### GET /analytics/public/top-earning

Get leaderboard of highest earning published abilities.

**Authentication:** None required

**Query Parameters:**
- `limit` (optional): Number of results (1-50, default: 10)

**Request:**
```bash
curl 'http://localhost:4111/analytics/public/top-earning?limit=15'
```

**Response:**
```json
{
  "success": true,
  "count": 0,
  "abilities": []
}
```

**Response Fields:**
Each ability in the array contains:
- `abilityId`: Unique identifier
- `abilityName`: Name of the ability
- `serviceName`: Service it belongs to
- `totalEarned`: Total amount earned (in USD)
- `executionCount`: Number of times executed
- `creatorId`: User ID of ability creator

---

## OpenAPI Specification

### GET /docs/openapi.json

Get the OpenAPI 3.1.0 specification for this API.

**Authentication:** None required

**Request:**
```bash
curl http://localhost:4111/docs/openapi.json
```

**Response:**
```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Reverse Engineer API",
    "version": "1.0.0",
    "description": "# Reverse Engineer API\n\nMulti-tenant API reverse engineering and ability management platform..."
  },
  "paths": { ... },
  "components": { ... }
}
```

**Notes:**
- Full OpenAPI specification with all endpoints documented
- Includes request/response schemas
- Can be used with Swagger UI or other OpenAPI tools

---

# File: ./tokens.md

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

---

