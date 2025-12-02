/**
 * x402 Payment Protocol - Solana USDC Implementation
 *
 * Handles HTTP 402 Payment Required responses by constructing and signing
 * USDC transfer transactions on Solana. This enables pay-per-request API access
 * without traditional API key authentication.
 *
 * Protocol Flow:
 * 1. Client makes request to x402 endpoint
 * 2. Server responds with 402 + payment requirements (recipient, amount, mint)
 * 3. Client constructs USDC transfer transaction(s)
 * 4. Client signs transaction with private key
 * 5. Client retries request with X-Payment header containing base64 transaction
 * 6. Server verifies and submits transaction, then processes request
 */
import { Transaction } from "@solana/web3.js";
export interface PaymentRequirement {
    type: "usdc";
    network: "solana";
    chain: "devnet" | "mainnet-beta";
    recipient: string;
    amount: string;
    amountFormatted: string;
    mint: string;
    description: string;
    splits?: PaymentSplit[];
}
export interface PaymentSplit {
    recipient: string;
    amount: string;
    percentage: number;
    label: string;
}
export interface X402Config {
    privateKey: string;
    rpcUrl?: string;
}
export interface X402PaymentResult {
    success: boolean;
    signature?: string;
    paymentHeader?: string;
    error?: string;
}
export declare class X402SolanaClient {
    private readonly keypair;
    private connection;
    private rpcUrl;
    constructor(config: X402Config);
    /**
     * Get the wallet public key
     */
    getPublicKey(): string;
    /**
     * Get or create connection for a specific chain
     */
    private getConnection;
    /**
     * Create a payment transaction based on 402 response requirements
     */
    createPaymentTransaction(requirement: PaymentRequirement): Promise<Transaction>;
    /**
     * Create the X-Payment header value from a signed transaction
     */
    createPaymentHeader(tx: Transaction, signature?: string): string;
    /**
     * Process a 402 response and create payment header
     */
    processPaymentRequired(requirement: PaymentRequirement): Promise<X402PaymentResult>;
    /**
     * Check USDC balance for a given mint
     */
    getUsdcBalance(chain: "devnet" | "mainnet-beta", mint: string): Promise<bigint>;
}
/**
 * Create an x402 client from a private key
 */
export declare function createX402Client(config: X402Config): X402SolanaClient;
/**
 * Parse payment requirement from 402 response body
 */
export declare function parsePaymentRequirement(responseBody: any): PaymentRequirement | null;
//# sourceMappingURL=x402-solana.d.ts.map