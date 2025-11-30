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

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import bs58 from "bs58";

// ============================================================================
// TYPES
// ============================================================================

export interface PaymentRequirement {
  type: "usdc";
  network: "solana";
  chain: "devnet" | "mainnet-beta";
  recipient: string;
  amount: string; // In smallest unit (USDC lamports)
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
  privateKey: string; // Base58 encoded Solana private key
  rpcUrl?: string; // Solana RPC URL (defaults based on chain from 402 response)
}

export interface X402PaymentResult {
  success: boolean;
  signature?: string;
  paymentHeader?: string;
  error?: string;
}

// ============================================================================
// X402 SOLANA CLIENT
// ============================================================================

export class X402SolanaClient {
  private readonly keypair: Keypair;
  private connection: Connection | null = null;
  private rpcUrl: string | null = null;

  constructor(config: X402Config) {
    // Decode base58 private key
    try {
      const secretKey = bs58.decode(config.privateKey);
      this.keypair = Keypair.fromSecretKey(secretKey);
      console.log(
        `[x402] Wallet initialized: ${this.keypair.publicKey.toBase58()}`
      );
    } catch (error) {
      throw new Error(
        `Invalid Solana private key: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    if (config.rpcUrl) {
      this.rpcUrl = config.rpcUrl;
      this.connection = new Connection(config.rpcUrl, "confirmed");
    }
  }

  /**
   * Get the wallet public key
   */
  getPublicKey(): string {
    return this.keypair.publicKey.toBase58();
  }

  /**
   * Get or create connection for a specific chain
   */
  private getConnection(chain: "devnet" | "mainnet-beta"): Connection {
    if (this.connection) {
      return this.connection;
    }

    const rpcUrl =
      chain === "devnet"
        ? "https://api.devnet.solana.com"
        : "https://api.mainnet-beta.solana.com";

    return new Connection(rpcUrl, "confirmed");
  }

  /**
   * Create a payment transaction based on 402 response requirements
   */
  async createPaymentTransaction(
    requirement: PaymentRequirement
  ): Promise<Transaction> {
    const connection = this.getConnection(requirement.chain);
    const mint = new PublicKey(requirement.mint);
    const payer = this.keypair.publicKey;

    // Get payer's token account
    const payerAta = await getAssociatedTokenAddress(mint, payer);

    // Build transaction
    const tx = new Transaction();

    // Add compute budget for faster processing
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: 100000 })
    );

    // Determine recipients - use splits if available, otherwise single recipient
    const transfers: Array<{ recipient: PublicKey; amount: bigint }> = [];

    if (requirement.splits && requirement.splits.length > 0) {
      // Multiple recipients (payment splits)
      for (const split of requirement.splits) {
        transfers.push({
          recipient: new PublicKey(split.recipient),
          amount: BigInt(split.amount),
        });
      }
    } else {
      // Single recipient
      transfers.push({
        recipient: new PublicKey(requirement.recipient),
        amount: BigInt(requirement.amount),
      });
    }

    // Add transfer instructions for each recipient
    for (const transfer of transfers) {
      const recipientAta = await getAssociatedTokenAddress(
        mint,
        transfer.recipient
      );

      // Check if recipient ATA exists, if not add create instruction
      try {
        await getAccount(connection, recipientAta);
      } catch {
        // ATA doesn't exist, add create instruction
        tx.add(
          createAssociatedTokenAccountInstruction(
            payer, // payer
            recipientAta, // ata
            transfer.recipient, // owner
            mint // mint
          )
        );
      }

      // Add transfer instruction
      tx.add(
        createTransferInstruction(
          payerAta, // source
          recipientAta, // destination
          payer, // owner
          transfer.amount // amount
        )
      );
    }

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = payer;

    // Sign transaction
    tx.sign(this.keypair);

    return tx;
  }

  /**
   * Create the X-Payment header value from a signed transaction
   */
  createPaymentHeader(tx: Transaction, signature?: string): string {
    const paymentData = {
      transaction: tx.serialize().toString("base64"),
      signature: signature,
    };

    return Buffer.from(JSON.stringify(paymentData)).toString("base64");
  }

  /**
   * Process a 402 response and create payment header
   */
  async processPaymentRequired(
    requirement: PaymentRequirement
  ): Promise<X402PaymentResult> {
    try {
      console.log(
        `[x402] Processing payment: ${requirement.amountFormatted} to ${requirement.recipient}`
      );

      if (requirement.splits) {
        console.log(`[x402] Payment splits:`);
        for (const split of requirement.splits) {
          console.log(
            `  - ${split.label}: ${split.percentage}% to ${split.recipient}`
          );
        }
      }

      // Create and sign transaction
      const tx = await this.createPaymentTransaction(requirement);

      // Create payment header
      const paymentHeader = this.createPaymentHeader(tx);

      console.log(`[x402] Payment transaction created and signed`);

      return {
        success: true,
        paymentHeader,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown payment error";
      console.error(`[x402] Payment failed: ${message}`);
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Check USDC balance for a given mint
   */
  async getUsdcBalance(
    chain: "devnet" | "mainnet-beta",
    mint: string
  ): Promise<bigint> {
    try {
      const connection = this.getConnection(chain);
      const mintPubkey = new PublicKey(mint);
      const ata = await getAssociatedTokenAddress(
        mintPubkey,
        this.keypair.publicKey
      );

      const account = await getAccount(connection, ata);
      return account.amount;
    } catch {
      return 0n;
    }
  }
}

/**
 * Create an x402 client from a private key
 */
export function createX402Client(config: X402Config): X402SolanaClient {
  return new X402SolanaClient(config);
}

/**
 * Parse payment requirement from 402 response body
 */
export function parsePaymentRequirement(
  responseBody: any
): PaymentRequirement | null {
  if (!responseBody?.payment) {
    return null;
  }

  const payment = responseBody.payment;

  if (payment.type !== "usdc" || payment.network !== "solana") {
    console.warn(
      `[x402] Unsupported payment type: ${payment.type}/${payment.network}`
    );
    return null;
  }

  return payment as PaymentRequirement;
}
