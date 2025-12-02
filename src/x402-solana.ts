/**
 * x402 Payment Protocol - Solana Smart Contract Implementation
 *
 * Handles HTTP 402 Payment Required responses by constructing and signing
 * transactions using the x402 payment smart contract on Solana.
 *
 * Protocol Flow:
 * 1. Client makes request to x402 endpoint
 * 2. Server responds with 402 + payment requirements (amount, wallet info)
 * 3. Client constructs verify_payment + settle_payment smart contract instructions
 * 4. Client signs transaction with private key
 * 5. Client retries request with X-Payment header containing base64 transaction
 * 6. Server verifies and submits transaction, then processes request
 *
 * Smart Contract Details:
 * - Program ID: 5g8XvMcpWEgHitW7abiYTr1u8sDasePLQnrebQyCLPvY
 * - 4-way split enforced on-chain: 2% (fixed), 3%, 30%, 65%
 * - Wallet 1 (2%) is hardcoded and validated by the contract
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import bs58 from "bs58";

// ============================================================================
// CONSTANTS
// ============================================================================

// x402 Payment Program on Solana
const X402_PROGRAM_ID = new PublicKey('5g8XvMcpWEgHitW7abiYTr1u8sDasePLQnrebQyCLPvY');

// Fixed wallet (2%) - hardcoded in smart contract, cannot be changed
const WALLET_1_FIXED = new PublicKey('8XLmbY1XRiPzeVNRDe9FZWHeCYKZAzvgc1c4EhyKsvEy');

// ============================================================================
// TYPES
// ============================================================================

export interface PaymentRequirement {
  type: "usdc";
  network: "solana";
  chain: "devnet" | "mainnet-beta";
  recipient: string; // Primary recipient (FDRY Treasury)
  amount: string; // Total amount in smallest unit (USDC lamports)
  amountFormatted: string;
  mint: string;
  description: string;
  splits?: PaymentSplit[];
  // Smart contract wallet configuration
  wallet2?: string; // 3% recipient
  wallet3?: string; // 30% recipient
  wallet4?: string; // 65% recipient
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
// SMART CONTRACT HELPERS
// ============================================================================

/**
 * Find the payment record PDA for a given payer and nonce
 */
function findPaymentRecordPDA(
  payer: PublicKey,
  nonce: bigint,
  programId: PublicKey = X402_PROGRAM_ID
): [PublicKey, number] {
  const nonceBuffer = Buffer.alloc(8);
  nonceBuffer.writeBigUInt64LE(nonce);

  return PublicKey.findProgramAddressSync(
    [Buffer.from('payment'), payer.toBuffer(), nonceBuffer],
    programId
  );
}

/**
 * Create verify_payment instruction
 * Instruction 0: Creates payment record PDA, verifies payer has sufficient balance
 */
function createVerifyPaymentInstruction(
  payer: PublicKey,
  paymentRecord: PublicKey,
  recipient: PublicKey,
  tokenMint: PublicKey,
  payerTokenAccount: PublicKey,
  amount: bigint,
  nonce: bigint,
  programId: PublicKey = X402_PROGRAM_ID
): TransactionInstruction {
  // Instruction data: opcode (1) + amount (8) + nonce (8) = 17 bytes
  const data = Buffer.alloc(17);
  data.writeUInt8(0, 0); // Opcode 0 = verify_payment
  data.writeBigUInt64LE(amount, 1);
  data.writeBigUInt64LE(nonce, 9);

  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: paymentRecord, isSigner: false, isWritable: true },
      { pubkey: recipient, isSigner: false, isWritable: false },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: payerTokenAccount, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });
}

/**
 * Create settle_payment instruction
 * Instruction 1: Executes 4-way split transfer
 * - Wallet 1 (2%) - FIXED, validated by contract
 * - Wallet 2 (3%) - Passed in
 * - Wallet 3 (30%) - Passed in
 * - Wallet 4 (65%) - Passed in
 */
function createSettlePaymentInstruction(
  payer: PublicKey,
  paymentRecord: PublicKey,
  payerTokenAccount: PublicKey,
  wallet1TokenAccount: PublicKey,
  wallet2TokenAccount: PublicKey,
  wallet3TokenAccount: PublicKey,
  wallet4TokenAccount: PublicKey,
  nonce: bigint,
  programId: PublicKey = X402_PROGRAM_ID
): TransactionInstruction {
  // Instruction data: opcode (1) + nonce (8) = 9 bytes
  const data = Buffer.alloc(9);
  data.writeUInt8(1, 0); // Opcode 1 = settle_payment
  data.writeBigUInt64LE(nonce, 1);

  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: paymentRecord, isSigner: false, isWritable: true },
      { pubkey: payerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: wallet1TokenAccount, isSigner: false, isWritable: true },
      { pubkey: wallet2TokenAccount, isSigner: false, isWritable: true },
      { pubkey: wallet3TokenAccount, isSigner: false, isWritable: true },
      { pubkey: wallet4TokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });
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
      console.error(
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
   * Create a payment transaction using the x402 smart contract
   */
  async createPaymentTransaction(
    requirement: PaymentRequirement
  ): Promise<Transaction> {
    const connection = this.getConnection(requirement.chain);
    const mint = new PublicKey(requirement.mint);
    const payer = this.keypair.publicKey;
    const amount = BigInt(requirement.amount);

    // Generate unique nonce for this payment
    const nonce = BigInt(Date.now());

    // Get payer's token account
    const payerAta = await getAssociatedTokenAddress(mint, payer);

    // Determine wallet addresses for 4-way split
    // Default all wallets to primary recipient (FDRY Treasury) if not specified
    const primaryRecipient = new PublicKey(requirement.recipient);
    const wallet2 = requirement.wallet2 ? new PublicKey(requirement.wallet2) : primaryRecipient;
    const wallet3 = requirement.wallet3 ? new PublicKey(requirement.wallet3) : primaryRecipient;
    const wallet4 = requirement.wallet4 ? new PublicKey(requirement.wallet4) : primaryRecipient;

    // Get token accounts for all wallets
    const wallet1TokenAccount = await getAssociatedTokenAddress(mint, WALLET_1_FIXED);
    const wallet2TokenAccount = await getAssociatedTokenAddress(mint, wallet2);
    const wallet3TokenAccount = await getAssociatedTokenAddress(mint, wallet3);
    const wallet4TokenAccount = await getAssociatedTokenAddress(mint, wallet4);

    // Find payment record PDA
    const [paymentRecordPDA] = findPaymentRecordPDA(payer, nonce);

    console.error(`[x402] Creating smart contract payment:`);
    console.error(`[x402]   - Program: ${X402_PROGRAM_ID.toBase58()}`);
    console.error(`[x402]   - Payer: ${payer.toBase58()}`);
    console.error(`[x402]   - Amount: ${amount}`);
    console.error(`[x402]   - Nonce: ${nonce}`);
    console.error(`[x402]   - Payment Record PDA: ${paymentRecordPDA.toBase58()}`);
    console.error(`[x402]   - Mint: ${mint.toBase58()}`);
    console.error(`[x402]   - Wallet 1 (2% fixed): ${WALLET_1_FIXED.toBase58()}`);
    console.error(`[x402]   - Wallet 2 (3%): ${wallet2.toBase58()}`);
    console.error(`[x402]   - Wallet 3 (30%): ${wallet3.toBase58()}`);
    console.error(`[x402]   - Wallet 4 (65%): ${wallet4.toBase58()}`);

    // Build transaction
    const tx = new Transaction();

    // Add compute budget for faster processing
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 })
    );

    // Create token accounts if they don't exist
    const tokenAccountsToCreate: Array<{ ata: PublicKey; owner: PublicKey; name: string }> = [
      { ata: wallet1TokenAccount, owner: WALLET_1_FIXED, name: 'Wallet 1' },
      { ata: wallet2TokenAccount, owner: wallet2, name: 'Wallet 2' },
      { ata: wallet3TokenAccount, owner: wallet3, name: 'Wallet 3' },
      { ata: wallet4TokenAccount, owner: wallet4, name: 'Wallet 4' },
    ];

    for (const { ata, owner, name } of tokenAccountsToCreate) {
      try {
        await getAccount(connection, ata);
        console.error(`[x402]   - ${name} ATA exists`);
      } catch {
        console.error(`[x402]   - Creating ${name} ATA...`);
        tx.add(
          createAssociatedTokenAccountInstruction(
            payer,
            ata,
            owner,
            mint
          )
        );
      }
    }

    // Add verify_payment instruction
    const verifyIx = createVerifyPaymentInstruction(
      payer,
      paymentRecordPDA,
      wallet4, // Primary recipient for verification
      mint,
      payerAta,
      amount,
      nonce
    );
    tx.add(verifyIx);

    // Add settle_payment instruction
    const settleIx = createSettlePaymentInstruction(
      payer,
      paymentRecordPDA,
      payerAta,
      wallet1TokenAccount,
      wallet2TokenAccount,
      wallet3TokenAccount,
      wallet4TokenAccount,
      nonce
    );
    tx.add(settleIx);

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
      console.error(
        `[x402] Processing payment: ${requirement.amountFormatted} to ${requirement.recipient}`
      );

      if (requirement.splits) {
        console.error(`[x402] Payment splits:`);
        for (const split of requirement.splits) {
          console.error(
            `  - ${split.label}: ${split.percentage}% to ${split.recipient}`
          );
        }
      }

      // Create and sign transaction
      const tx = await this.createPaymentTransaction(requirement);

      // Create payment header
      const paymentHeader = this.createPaymentHeader(tx);

      console.error(`[x402] Payment transaction created and signed (smart contract)`);

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
