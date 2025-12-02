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
 *   UNBROWSE_API_KEY - Your Unbrowse API key (starts with re_)
 *   UNBROWSE_SESSION_TOKEN - Alternative: your session token
 *   UNBROWSE_PASSWORD - Password for credential decryption (optional)
 *   SOLANA_PRIVATE_KEY - Solana private key for x402 payment mode (optional)
 *   DEV_MODE - Enable developer mode for detailed API docs
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import createServer, { configSchema } from "./index.js";
async function main() {
    // Parse configuration from environment variables
    const config = {
        apiKey: process.env.UNBROWSE_API_KEY,
        sessionToken: process.env.UNBROWSE_SESSION_TOKEN,
        solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY || process.env.UNBROWSE_SOLANA_KEY,
        solanaRpcUrl: process.env.SOLANA_RPC_URL,
        password: process.env.UNBROWSE_PASSWORD || process.env.UNBROWSE_CREDENTIAL_KEY,
        debug: process.env.DEBUG === 'true' || process.env.UNBROWSE_DEBUG === 'true',
        enableIndexTool: process.env.ENABLE_INDEX_TOOL === 'true',
        devMode: process.env.DEV_MODE === 'true' || process.env.UNBROWSE_DEV_MODE === 'true',
    };
    // Validate configuration
    const validationResult = configSchema.safeParse(config);
    if (!validationResult.success) {
        console.error("Configuration error:", validationResult.error.message);
        console.error("\nRequired environment variables:");
        console.error("  UNBROWSE_API_KEY - Your Unbrowse API key (starts with re_)");
        console.error("  OR UNBROWSE_SESSION_TOKEN - Your session token");
        console.error("  OR SOLANA_PRIVATE_KEY - Solana private key for x402 mode");
        console.error("\nOptional environment variables:");
        console.error("  UNBROWSE_PASSWORD - Password for credential decryption");
        console.error("  DEV_MODE - Set to 'true' to enable developer mode");
        console.error("  ENABLE_INDEX_TOOL - Set to 'true' to enable the ingest_api_endpoint tool");
        console.error("  DEBUG - Set to 'true' for debug logging");
        process.exit(1);
    }
    try {
        // Create the MCP server
        const server = createServer({ config: validationResult.data });
        // Create stdio transport
        const transport = new StdioServerTransport();
        // Connect and run
        await server.connect(transport);
        console.error("[INFO] Unbrowse MCP server started successfully");
        console.error("[INFO] Listening for MCP requests via stdio...");
    }
    catch (error) {
        console.error("[ERROR] Failed to start Unbrowse MCP server:", error);
        process.exit(1);
    }
}
main().catch((error) => {
    console.error("[FATAL] Unhandled error:", error);
    process.exit(1);
});
