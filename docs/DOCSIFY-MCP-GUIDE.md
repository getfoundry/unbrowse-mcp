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
