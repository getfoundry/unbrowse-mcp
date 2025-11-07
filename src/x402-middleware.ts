/**
 * X402 Payment Middleware Configuration
 *
 * This module configures payment middleware for MCP server endpoints,
 * allowing monetization of MCP tools through automatic per-request payments.
 */

import { express as faremeter } from "@faremeter/middleware";
import { solana } from "@faremeter/info";

export interface X402Config {
  facilitatorURL?: string;
  network: "devnet" | "mainnet-beta";
  asset: "USDC" | "SOL";
  amount: number; // Amount in smallest unit (e.g., lamports for SOL, base units for USDC)
  payTo: string; // Wallet address to receive payments
  description?: string;
}

/**
 * Creates x402 payment middleware for protecting MCP endpoints
 *
 * @param config - Payment configuration
 * @param resourceURL - The URL of the resource being protected
 * @returns Express middleware that handles payment verification
 */
export async function createX402Middleware(
  config: X402Config,
  resourceURL: string
) {
  const facilitatorURL = config.facilitatorURL || "https://facilitator.corbits.dev";

  const middleware = await faremeter.createMiddleware({
    facilitatorURL,
    accepts: [
      {
        ...solana.x402Exact({
          network: config.network,
          asset: config.asset,
          amount: config.amount,
          payTo: config.payTo,
        }),
        resource: resourceURL,
        description: config.description || "MCP server access",
      },
    ],
  });

  return middleware;
}

/**
 * List of MCP protocol methods that should bypass payment
 * These are essential for protocol negotiation and discovery
 */
export const BYPASS_PAYMENT_METHODS = [
  "initialize",
  "initialized",
  "notifications/initialized",
  "tools/list",
  "prompts/list",
  "resources/list",
  "ping",
];

/**
 * Middleware wrapper that bypasses payment for protocol methods
 * but enforces it for actual tool calls
 *
 * @param paymentMiddleware - The x402 payment middleware
 * @returns Express middleware that conditionally applies payment
 */
export function conditionalPaymentMiddleware(paymentMiddleware: any) {
  return (req: any, res: any, next: any) => {
    // Check if this is an MCP protocol method that should bypass payment
    const method = req.body?.method;

    if (method && BYPASS_PAYMENT_METHODS.includes(method)) {
      // Allow protocol methods without payment
      next();
    } else {
      // Require payment for tool calls and other operations
      paymentMiddleware(req, res, next);
    }
  };
}

/**
 * Creates a payment tier configuration
 * Useful for offering different pricing for different tool categories
 */
export function createPaymentTier(
  name: string,
  priceUSDC: number,
  description?: string
): X402Config {
  return {
    network: process.env.X402_NETWORK === "mainnet" ? "mainnet-beta" : "devnet",
    asset: "USDC",
    amount: priceUSDC * 1_000_000, // Convert to base units (USDC has 6 decimals)
    payTo: process.env.X402_WALLET_ADDRESS || "",
    description: description || `${name} tier access`,
  };
}

/**
 * Standard pricing tiers for MCP services
 */
export const PRICING_TIERS = {
  // Free tier - no payment required
  FREE: null,

  // $0.0001 per request - for lightweight queries
  BASIC: createPaymentTier("basic", 0.0001, "Basic MCP tool access"),

  // $0.001 per request - for standard operations
  STANDARD: createPaymentTier("standard", 0.001, "Standard MCP tool access"),

  // $0.01 per request - for compute-intensive operations
  PREMIUM: createPaymentTier("premium", 0.01, "Premium MCP tool access"),

  // $0.10 per request - for high-value data or AI-powered operations
  ENTERPRISE: createPaymentTier("enterprise", 0.10, "Enterprise MCP tool access"),
};
