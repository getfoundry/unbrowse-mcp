#!/usr/bin/env node
/**
 * Unbrowse MCP Server - STDIO Transport
 *
 * This is the stdio transport entry point for Claude Desktop and other
 * MCP clients that use standard input/output for communication.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import createServer, { configSchema } from "./index.js";

// CRITICAL: Redirect console.log to stderr BEFORE anything else
// MCP protocol uses stdout for JSON-RPC, so ALL logging must go to stderr
const originalLog = console.log;
console.log = (...args) => console.error(...args);

async function main() {
  // Read config from environment variables
  const config = {
    solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY || process.env.UNBROWSE_SOLANA_KEY,
    solanaRpcUrl: process.env.SOLANA_RPC_URL,
    apiKey: process.env.UNBROWSE_API_KEY,
    sessionToken: process.env.UNBROWSE_SESSION_TOKEN,
    password: process.env.UNBROWSE_PASSWORD || process.env.UNBROWSE_CREDENTIAL_KEY,
    debug: process.env.DEBUG === 'true',
    enableIndexTool: process.env.ENABLE_INDEX_TOOL === 'true',
    devMode: process.env.DEV_MODE === 'true' || process.env.UNBROWSE_DEV_MODE === 'true',
  };

  // Validate config
  if (!config.apiKey && !config.sessionToken && !config.solanaPrivateKey) {
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

  console.error("[INFO] Starting Unbrowse MCP server with STDIO transport...");

  try {
    // Create the MCP server
    const server = createServer({ config });

    // Create stdio transport
    const transport = new StdioServerTransport();

    // Connect the server to the transport
    await server.connect(transport);

    console.error("[INFO] Unbrowse MCP server connected via STDIO transport");
    console.error("[INFO] Ready to receive requests");
  } catch (error: any) {
    console.error("[ERROR] Failed to start server:", error.message || error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[FATAL] Unhandled error:", error);
  process.exit(1);
});
