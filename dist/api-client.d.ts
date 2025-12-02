/**
 * Unbrowse API Client
 *
 * Client for interacting with the Unbrowse API at http://localhost:4111
 * Handles fetching abilities and credentials from the real API endpoints.
 *
 * Supports two authentication modes:
 * 1. API Key / Session Token - Traditional bearer token authentication
 * 2. x402 Payment - Pay-per-request using Solana USDC (no auth required)
 */
/**
 * Interface for indexed abilities from the API
 * Fields match the server response structure (snake_case)
 */
export interface IndexedAbility {
    ability_id: string;
    ability_name: string;
    service_name: string;
    domain?: string;
    description: string;
    input_schema?: any;
    output_schema?: any;
    requires_dynamic_headers: boolean;
    dynamic_header_keys: string[];
    health_score?: string;
    user_ability_id?: string;
    request_method?: string;
    request_url?: string;
    dependency_order?: string[];
    static_headers?: Record<string, string>;
    wrapper_code?: string;
    generated_at?: string;
    dependencies?: {
        resolved?: any[];
        missing?: Array<{
            ability_id: string;
            ability_name: string;
            reference: string;
        }>;
        unresolved?: any[];
    };
}
/**
 * Configuration for the API client
 */
export interface ApiClientConfig {
    apiKey?: string;
    sessionToken?: string;
    timeout?: number;
    x402?: {
        privateKey: string;
        rpcUrl?: string;
    };
}
export declare const UNBROWSE_API_BASE_URL: string;
/**
 * Unbrowse API Client
 */
export declare class UnbrowseApiClient {
    private readonly baseUrl;
    private readonly authToken;
    private readonly authType;
    private timeout;
    constructor(config: ApiClientConfig);
    /**
     * Makes a fetch request with timeout and authentication
     */
    private fetchWithTimeout;
    /**
     * List all abilities for authenticated user
     * GET /my/abilities
     */
    listAbilities(options?: {
        favorites?: boolean;
        published?: boolean;
    }): Promise<{
        success: boolean;
        count: number;
        abilities: IndexedAbility[];
    }>;
    /**
     * Search abilities using server-side Infraxa vector search
     * Uses the /abilities/search endpoint which queries both user's personal abilities
     * AND the global published index using hybrid KGE search with 10% boost for personal abilities.
     *
     * @param query - Search query string
     * @param limit - Maximum number of results to return (default: 6, max: 45)
     * @param domains - Optional domain whitelist for filtering results (e.g., ["api.github.com", "github.com"])
     */
    searchAbilities(query: string, limit?: number, domains?: string[]): Promise<{
        success: boolean;
        count: number;
        query: string;
        abilities: IndexedAbility[];
        cost?: string;
    }>;
    /**
     * Search public published abilities
     * GET /public/abilities?q=<query>
     */
    searchPublicAbilities(query: string, limit?: number): Promise<{
        success: boolean;
        count: number;
        query: string;
        abilities: IndexedAbility[];
    }>;
    /**
     * Get a specific ability by ID
     * GET /abilities/:abilityId
     */
    getAbility(abilityId: string): Promise<{
        success: boolean;
        ability: IndexedAbility;
        wrapper: any;
    }>;
    /**
     * Get ability wrapper code
     * GET /abilities/:abilityId/wrapper
     */
    getAbilityWrapper(abilityId: string): Promise<{
        success: boolean;
        wrapper: any;
    }>;
    /**
     * List all credentials (grouped by domain)
     * GET /my/credentials?grouped=true
     */
    listCredentials(grouped?: boolean): Promise<{
        success: boolean;
        count?: number;
        grouped?: boolean;
        credentials: any;
    }>;
    /**
     * Get credentials for a specific domain
     * GET /my/credentials/:domain
     */
    getCredentialsForDomain(domain: string): Promise<{
        success: boolean;
        domain: string;
        count: number;
        credentials: Array<{
            credentialId: string;
            credentialType: string;
            credentialKey: string;
            encryptedValue: string;
            createdAt: string;
        }>;
    }>;
    /**
     * Get encrypted credentials for a domain (alias for compatibility)
     * GET /my/credentials/:domain
     */
    getCookieJar(domain: string): Promise<Record<string, string> | null>;
    /**
     * Store encrypted credentials for a domain
     * POST /my/credentials/stream
     */
    storeCredentials(domain: string, credentials: Array<{
        type: string;
        key: string;
        encryptedValue: string;
    }>): Promise<{
        success: boolean;
        count: number;
        credentials: any[];
    }>;
    /**
     * Delete all credentials for a domain
     * DELETE /my/credentials/:domain
     */
    deleteCredentialsForDomain(domain: string): Promise<{
        success: boolean;
        domain: string;
        deletedCount: number;
    }>;
    /**
     * Delete a specific credential by ID
     * DELETE /my/credentials/by-id/:credentialId
     */
    deleteCredentialById(credentialId: string): Promise<{
        success: boolean;
        credentialId: string;
    }>;
    /**
     * Invalidate credentials for a domain (alias for deleteCredentialsForDomain)
     */
    expireCredentials(domain: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Execute an ability on the server
     * POST /my/abilities/:abilityId/execute
     *
     * @param abilityId - The abilityId to execute
     * @param params - Parameters object to pass to the ability
     * @param options - Optional configuration including transformCode and credentialKey
     */
    executeAbility(abilityId: string, params: Record<string, any>, options?: {
        transformCode?: string;
        credentialKey?: string;
    }): Promise<{
        success: boolean;
        result?: {
            statusCode: number;
            abilityName: string;
            domain: string;
            body: any;
            headers: Record<string, string>;
            executedAt: string;
            executionTimeMs?: number;
        };
        health?: {
            score: number;
            totalExecutions: number;
            successRate: string;
        };
        error?: string;
        credentialsExpired?: boolean;
        defunct?: boolean;
        loginAbilities?: Array<{
            id: string;
            name: string;
            description: string;
        }>;
        healthScore?: number;
        totalExecutions?: number;
        successRate?: string;
    }>;
}
/**
 * Create an API client instance
 * @param authToken - Your Unbrowse API key or session token
 */
export declare function createApiClient(authToken: string): UnbrowseApiClient;
/**
 * Payment record for tracking x402 payments
 */
export interface PaymentRecord {
    id: string;
    timestamp: number;
    type: 'search' | 'execute';
    abilityId?: string;
    abilityName?: string;
    amount: string;
    amountFormatted: string;
    amountCents: number;
    signature?: string;
    verified: boolean;
    success: boolean;
    error?: string;
}
/**
 * Payment tracking summary
 */
export interface PaymentSummary {
    totalPayments: number;
    totalSpentCents: number;
    totalSpentFormatted: string;
    searchCount: number;
    searchSpentCents: number;
    executeCount: number;
    executeSpentCents: number;
    recentPayments: PaymentRecord[];
}
/**
 * x402 Payment-based API Client
 *
 * Uses Solana USDC payments instead of API key authentication.
 * Automatically handles 402 Payment Required responses by constructing
 * and signing USDC transfer transactions.
 *
 * Includes payment tracking to monitor spending.
 */
export declare class UnbrowseX402Client {
    private readonly baseUrl;
    private readonly x402Client;
    private timeout;
    private paymentHistory;
    constructor(config: {
        privateKey: string;
        rpcUrl?: string;
        timeout?: number;
    });
    /**
     * Get the wallet public key
     */
    getWalletAddress(): string;
    /**
     * Makes a fetch request with timeout
     */
    private fetchWithTimeout;
    /**
     * Makes a request with x402 payment handling
     * If server responds with 402, constructs payment and retries
     */
    private fetchWithPayment;
    /**
     * Search abilities using x402 paid endpoint
     * GET /x402/abilities?q=<query>
     *
     * Cost: 0.1 cents per search in USDC on Solana
     */
    searchAbilities(query: string, limit?: number): Promise<{
        success: boolean;
        count: number;
        query: string;
        abilities: IndexedAbility[];
        payment?: {
            verified: boolean;
            signature?: string;
            type: string;
        };
    }>;
    /**
     * Execute an ability using x402 paid endpoint
     * POST /x402/abilities/:abilityId/execute
     *
     * Cost: 0.5 cents per execution in USDC on Solana
     * Payment is split: 20% platform, 80% ability owner
     */
    executeAbility(abilityId: string, params: Record<string, any>, options?: {
        transformCode?: string;
    }): Promise<{
        success: boolean;
        result?: {
            statusCode: number;
            abilityName: string;
            domain: string;
            body: any;
            headers: Record<string, string>;
            executedAt: string;
            executionTimeMs?: number;
        };
        health?: {
            score: number;
            totalExecutions: number;
            successRate: string;
        };
        error?: string;
        payment?: {
            verified: boolean;
            signature?: string;
            type: string;
        };
    }>;
    /**
     * Get ability details by ID (public endpoint, no payment required)
     * GET /abilities/:abilityId
     */
    getAbility(abilityId: string): Promise<{
        success: boolean;
        ability: IndexedAbility;
        wrapper: any;
    }>;
    /**
     * Check USDC balance for current wallet
     */
    getBalance(chain?: 'devnet' | 'mainnet-beta'): Promise<{
        balance: string;
        balanceFormatted: string;
    }>;
    /**
     * Record a payment for tracking
     */
    private recordPayment;
    /**
     * Get payment history
     * @param limit - Maximum number of records to return (default: 50)
     * @param type - Filter by payment type ('search' or 'execute')
     */
    getPaymentHistory(limit?: number, type?: 'search' | 'execute'): PaymentRecord[];
    /**
     * Get payment summary statistics
     */
    getPaymentSummary(): PaymentSummary;
    /**
     * Clear payment history
     */
    clearPaymentHistory(): void;
}
/**
 * Create an x402 payment-based API client
 * @param privateKey - Base58 encoded Solana private key
 * @param rpcUrl - Optional custom RPC URL
 */
export declare function createX402ApiClient(privateKey: string, rpcUrl?: string): UnbrowseX402Client;
/**
 * Helper function to format ability description with dependencies
 */
export declare function formatAbilityDescription(ability: IndexedAbility): string;
//# sourceMappingURL=api-client.d.ts.map