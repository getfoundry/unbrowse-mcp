#!/usr/bin/env node
/**
 * Unbrowse MCP Server CLI
 *
 * This is the command-line interface for running the Unbrowse MCP server.
 * It can be run via npx or after installing the package globally.
 *
 * Usage:
 *   npx unbrowse-mcp
 *   unbrowse-mcp (if installed globally)
 *
 * Environment variables:
 *   SOLANA_PRIVATE_KEY - Solana private key for x402 payment mode (recommended)
 *   UNBROWSE_API_KEY - Your Unbrowse API key (starts with re_)
 *   UNBROWSE_SESSION_TOKEN - Alternative: your session token
 *   UNBROWSE_PASSWORD - Password for credential decryption (optional)
 *   DEV_MODE - Enable developer mode for detailed API docs
 */

// Load the stdio transport server - this handles all MCP communication
try {
  require("../dist/stdio-server.cjs");
} catch (error) {
  console.error("[ERROR] Failed to start Unbrowse MCP server:", error);
  process.exit(1);
}
