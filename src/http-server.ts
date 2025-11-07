/**
 * HTTP Server for Payment-Protected MCP
 *
 * This module creates an HTTP server that hosts the MCP server
 * with x402 payment protection using Faremeter/Corbits.
 */

import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  createX402Middleware,
  conditionalPaymentMiddleware,
  PRICING_TIERS,
} from "./x402-middleware.js";
import { createServer as createMcpServer } from "./index.js";

interface ServerConfig {
  port: number;
  host: string;
  enablePayments: boolean;
  paymentTier?: keyof typeof PRICING_TIERS;
  allowedHosts?: string[];
}

/**
 * Session storage for MCP connections
 */
const sessions = new Map<string, StreamableHTTPServerTransport>();

/**
 * Creates the Express app with MCP and payment middleware
 */
export async function createHttpServer(config: ServerConfig) {
  const app = express();
  app.use(express.json());

  // CORS headers for MCP
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, mcp-session-id, x-payment-receipt"
    );
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Health check endpoint (always free)
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Payment configuration endpoint (always free)
  app.get("/payment-info", (req, res) => {
    if (!config.enablePayments) {
      res.json({ paymentsEnabled: false });
      return;
    }

    const tier = config.paymentTier || "BASIC";
    const tierConfig = PRICING_TIERS[tier];

    res.json({
      paymentsEnabled: true,
      tier,
      priceUSDC: tierConfig ? tierConfig.amount / 1_000_000 : 0,
      network: tierConfig?.network || "devnet",
      wallet: tierConfig?.payTo || process.env.X402_WALLET_ADDRESS,
    });
  });

  // Create payment middleware if enabled
  let paymentMiddleware: any = null;
  if (config.enablePayments) {
    const tier = config.paymentTier || "BASIC";
    const tierConfig = PRICING_TIERS[tier];

    if (tierConfig) {
      const resourceURL = `http://${config.host}:${config.port}/mcp`;
      paymentMiddleware = await createX402Middleware(tierConfig, resourceURL);
      console.log(`✅ Payment protection enabled: ${tier} tier ($${tierConfig.amount / 1_000_000} USDC per request)`);
    } else {
      console.log("⚠️  Payment tier not configured, running without payments");
    }
  } else {
    console.log("ℹ️  Payments disabled - running in free mode");
  }

  /**
   * Main MCP endpoint handler
   */
  const handleMcpRequest = async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport = sessionId ? sessions.get(sessionId) : undefined;

    // Create new session on initialize
    if (!transport && req.body?.method === "initialize") {
      try {
        // Create HTTP transport
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            console.log(`🔗 New MCP session: ${newSessionId}`);
            if (transport) {
              sessions.set(newSessionId, transport);
            }
          },
          enableDnsRebindingProtection: true,
          allowedHosts: config.allowedHosts || [
            "127.0.0.1",
            "localhost",
            `localhost:${config.port}`,
            `${config.host}:${config.port}`,
          ],
        });

        // Cleanup on close
        transport.onclose = () => {
          if (transport?.sessionId) {
            console.log(`🔌 Session closed: ${transport.sessionId}`);
            sessions.delete(transport.sessionId);
          }
        };

        // Get the MCP server configuration from environment
        const mcpConfig = {
          apiKey: process.env.UNBROWSE_API_KEY,
          sessionToken: process.env.UNBROWSE_SESSION_TOKEN,
          password: process.env.UNBROWSE_PASSWORD || process.env.UNBROWSE_CREDENTIAL_KEY,
          enableIndexTool: process.env.ENABLE_INDEX_TOOL === "true",
        };

        // Create the MCP server instance
        const mcpServer = await createMcpServer(mcpConfig);

        // Connect transport to server
        await mcpServer.connect(transport);

        console.log(`✅ MCP server initialized for session`);
      } catch (error) {
        console.error("❌ Failed to initialize MCP session:", error);
        res.status(500).json({
          error: "Failed to initialize MCP session",
          details: error instanceof Error ? error.message : String(error),
        });
        return;
      }
    } else if (!transport) {
      res.status(400).json({
        error: "Invalid session",
        message: "No session found. Please send an initialize request first.",
      });
      return;
    }

    // Handle the request through the transport
    try {
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("❌ Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Internal server error",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };

  // Apply payment middleware conditionally
  if (paymentMiddleware) {
    app.post(
      "/mcp",
      conditionalPaymentMiddleware(paymentMiddleware),
      handleMcpRequest
    );
  } else {
    app.post("/mcp", handleMcpRequest);
  }

  // Session management endpoints
  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const transport = sessionId ? sessions.get(sessionId) : undefined;

    if (!transport) {
      res.status(400).json({ error: "Invalid session" });
      return;
    }

    await transport.handleRequest(req, res);
  });

  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const transport = sessionId ? sessions.get(sessionId) : undefined;

    if (!transport) {
      res.status(400).json({ error: "Invalid session" });
      return;
    }

    await transport.handleRequest(req, res);
    sessions.delete(sessionId);
  });

  // List active sessions (for debugging)
  app.get("/sessions", (req, res) => {
    res.json({
      count: sessions.size,
      sessions: Array.from(sessions.keys()),
    });
  });

  return app;
}

/**
 * Starts the HTTP server
 */
export async function startServer(config: ServerConfig) {
  const app = await createHttpServer(config);

  return new Promise<void>((resolve) => {
    app.listen(config.port, config.host, () => {
      console.log(`\n🚀 Unbrowse MCP Server with x402 Payments`);
      console.log(`   └─ HTTP: http://${config.host}:${config.port}/mcp`);
      console.log(`   └─ Health: http://${config.host}:${config.port}/health`);
      console.log(`   └─ Payment Info: http://${config.host}:${config.port}/payment-info\n`);
      resolve();
    });
  });
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.env.HTTP_PORT || "3000", 10);
  const host = process.env.HTTP_HOST || "localhost";
  const enablePayments = process.env.ENABLE_X402_PAYMENTS === "true";
  const paymentTier = (process.env.X402_PRICING_TIER as keyof typeof PRICING_TIERS) || "BASIC";

  startServer({
    port,
    host,
    enablePayments,
    paymentTier,
  }).catch((error) => {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  });
}
