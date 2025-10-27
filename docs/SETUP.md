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
