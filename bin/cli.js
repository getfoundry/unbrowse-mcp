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

// Validate that at least one auth method is provided before starting
const apiKey = process.env.UNBROWSE_API_KEY;
const sessionToken = process.env.UNBROWSE_SESSION_TOKEN;
const solanaPrivateKey = process.env.SOLANA_PRIVATE_KEY || process.env.UNBROWSE_SOLANA_KEY;

if (!apiKey && !sessionToken && !solanaPrivateKey) {
  console.error("Configuration error: Authentication required");
  console.error("\nRequired environment variables (one of):");
  console.error("  SOLANA_PRIVATE_KEY - Solana private key for x402 mode (recommended)");
  console.error("  UNBROWSE_API_KEY - Your Unbrowse API key (starts with re_)");
  console.error("  UNBROWSE_SESSION_TOKEN - Your session token");
  console.error("\nOptional environment variables:");
  console.error("  UNBROWSE_PASSWORD - Password for credential decryption");
  console.error("  DEV_MODE - Set to 'true' to enable developer mode");
  console.error("  ENABLE_INDEX_TOOL - Set to 'true' to enable the ingest_api_endpoint tool");
  process.exit(1);
}

// Load the Smithery-bundled server - this auto-starts the MCP server
try {
  require("../.smithery/index.cjs");
} catch (error) {
  console.error("[ERROR] Failed to start Unbrowse MCP server:", error);
  process.exit(1);
}
