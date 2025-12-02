/**
 * Unbrowse API Client
 *
 * Client for interacting with the Unbrowse API.
 * Handles fetching abilities and credentials from the API endpoints.
 *
 * Supports two authentication modes:
 * 1. API Key / Session Token - Traditional bearer token authentication
 * 2. x402 Payment - Pay-per-request using Solana USDC (no auth required)
 */

import {
  X402SolanaClient,
  createX402Client,
  parsePaymentRequirement,
  type X402Config,
  type PaymentRequirement,
} from "./x402-solana.js";

/**
 * Interface for indexed abilities from the API
 * Fields match the server response structure (snake_case)
 */
export interface IndexedAbility {
  // Primary identifier for execution
  ability_id: string; // Use this for execution - pass to /my/abilities/:abilityId/execute

  // Basic information
  ability_name: string;
  service_name: string;
  domain?: string; // The domain this ability is for (e.g., "api.github.com")
  description: string;

  // Schemas (returned in search results)
  input_schema?: any;
  output_schema?: any;

  // Credential requirements
  requires_dynamic_headers: boolean;
  dynamic_header_keys: string[];

  // Health tracking
  health_score?: string;

  // Legacy fields (for backward compatibility)
  user_ability_id?: string; // Deprecated

  // Full ability details (only available when fetching specific ability)
  request_method?: string;
  request_url?: string;
  dependency_order?: string[];
  static_headers?: Record<string, string>;
  wrapper_code?: string;
  generated_at?: string;

  // Optional fields that may be added by processing
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
  // x402 payment configuration (alternative to apiKey/sessionToken)
  x402?: {
    privateKey: string; // Base58 Solana private key
    rpcUrl?: string; // Optional custom RPC URL
  };
}

export const UNBROWSE_API_BASE_URL = process.env.UNBROWSE_API_BASE_URL ?? "https://index.unbrowse.ai";

/**
 * Transform camelCase API response to snake_case IndexedAbility
 * Handles both search results and full ability details
 */
function transformAbilityResponse(apiAbility: any): IndexedAbility {
  return {
    // Primary identifier for execution
    ability_id: apiAbility.abilityId,

    // Basic information
    ability_name: apiAbility.abilityName,
    service_name: apiAbility.serviceName,
    domain: apiAbility.domain,
    description: apiAbility.description,

    // Schemas (returned in search results)
    input_schema: apiAbility.inputSchema || apiAbility.metadata?.input_schema,
    output_schema: apiAbility.outputSchema || apiAbility.metadata?.output_schema,

    // Credential requirements
    requires_dynamic_headers: apiAbility.dynamicHeadersRequired || false,
    dynamic_header_keys: apiAbility.dynamicHeaderKeys || [],

    // Health tracking
    health_score: apiAbility.healthScore,

    // Legacy fields (for backward compatibility)
    user_ability_id: apiAbility.userAbilityId,

    // Full ability details (only when fetching specific ability)
    request_method: apiAbility.metadata?.request_method || apiAbility.requestMethod,
    request_url: apiAbility.metadata?.request_url || apiAbility.requestUrl,
    wrapper_code: apiAbility.metadata?.wrapper_code || apiAbility.wrapperCode,
    dependency_order: apiAbility.metadata?.dependency_order || apiAbility.dependencyOrder || [],
    static_headers: apiAbility.metadata?.static_headers || apiAbility.staticHeaders,
    generated_at: apiAbility.metadata?.generated_at || apiAbility.generatedAt || apiAbility.createdAt,

    // Dependencies
    dependencies: apiAbility.dependencies,
  };
}

/**
 * Unbrowse API Client
 */
export class UnbrowseApiClient {
  private readonly baseUrl: string;
  private readonly authToken: string;
  private readonly authType: 'api_key' | 'session_token';
  private timeout: number;

  constructor(config: ApiClientConfig) {
    // Validate that at least one auth method is provided
    const authToken = config.apiKey || config.sessionToken;
    if (!authToken) {
      throw new Error("Either apiKey or sessionToken must be provided");
    }

    this.authToken = authToken;
    // Auto-detect auth type (API keys start with "re_", session tokens don't)
    this.authType = config.apiKey && config.apiKey.startsWith("re_") ? "api_key" : "session_token";
    this.baseUrl = UNBROWSE_API_BASE_URL;
    this.timeout = config.timeout || 300000; // 10 second default timeout

    console.error(`[API Client] Initialized with auth type: ${this.authType}`);
  }

  /**
   * Makes a fetch request with timeout and authentication
   */
  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${this.authToken}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * List all abilities for authenticated user
   * GET /my/abilities
   */
  async listAbilities(options: {
    favorites?: boolean;
    published?: boolean;
  } = {}): Promise<{
    success: boolean;
    count: number;
    abilities: IndexedAbility[];
  }> {
    const params = new URLSearchParams();

    if (options.favorites !== undefined) {
      params.append('favorites', String(options.favorites));
    }
    if (options.published !== undefined) {
      params.append('published', String(options.published));
    }

    const url = `${this.baseUrl}/my/abilities${params.toString() ? `?${params}` : ''}`;
    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`Failed to list abilities: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Transform camelCase API response to snake_case
    return {
      success: data.success,
      count: data.count,
      abilities: (data.abilities || []).map(transformAbilityResponse),
    };
  }

  /**
   * Search abilities using server-side Infraxa vector search
   * Uses the /abilities/search endpoint which queries both user's personal abilities
   * AND the global published index using hybrid KGE search with 10% boost for personal abilities.
   *
   * @param query - Search query string
   * @param limit - Maximum number of results to return (default: 6, max: 45)
   * @param domains - Optional domain whitelist for filtering results (e.g., ["api.github.com", "github.com"])
   */
  async searchAbilities(query: string, limit: number = 12, domains?: string[]): Promise<{
    success: boolean;
    count: number;
    query: string;
    abilities: IndexedAbility[];
    cost?: string;
  }> {
    const params = new URLSearchParams({
      q: query,
      top_k: String(Math.min(limit, 45)) // Server enforces max of 45
    });

    // Add domain whitelist if provided
    if (domains && domains.length > 0) {
      params.append('domains', domains.join(','));
    }

    const url = `${this.baseUrl}/abilities/search?${params}`;
    const response = await this.fetchWithTimeout(url);
    console.error({response})

    if (!response.ok) {
      if (response.status === 402) {
        const data = await response.json();
        throw new Error(data.error || 'Insufficient tokens for search');
      }
      throw new Error(`Failed to search abilities: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    console.error({data})

    // Transform camelCase API response to snake_case
    return {
      success: data.success,
      count: data.count,
      query: data.query,
      abilities: (data.results || []).map(transformAbilityResponse),
      cost: data.cost,
    };
  }

  /**
   * Search public published abilities
   * GET /public/abilities?q=<query>
   */
  async searchPublicAbilities(query: string, limit: number = 30): Promise<{
    success: boolean;
    count: number;
    query: string;
    abilities: IndexedAbility[];
  }> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    const url = `${this.baseUrl}/public/abilities?${params}`;
    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`Failed to search public abilities: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Transform camelCase API response to snake_case
    return {
      success: data.success,
      count: data.count,
      query: data.query,
      abilities: (data.abilities || []).map(transformAbilityResponse),
    };
  }

  /**
   * Get a specific ability by ID
   * GET /abilities/:abilityId
   */
  async getAbility(abilityId: string): Promise<{
    success: boolean;
    ability: IndexedAbility;
    wrapper: any;
  }> {
    const url = `${this.baseUrl}/abilities/${encodeURIComponent(abilityId)}`;
    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Ability not found: ${abilityId}`);
      }
      throw new Error(`Failed to get ability: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Transform camelCase API response to snake_case
    return {
      success: data.success,
      ability: transformAbilityResponse(data.ability),
      wrapper: data.wrapper,
    };
  }

  /**
   * Get ability wrapper code
   * GET /abilities/:abilityId/wrapper
   */
  async getAbilityWrapper(abilityId: string): Promise<{
    success: boolean;
    wrapper: any;
  }> {
    const url = `${this.baseUrl}/abilities/${encodeURIComponent(abilityId)}/wrapper`;
    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Ability not found: ${abilityId}`);
      }
      throw new Error(`Failed to get ability wrapper: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * List all credentials (grouped by domain)
   * GET /my/credentials?grouped=true
   */
  async listCredentials(grouped: boolean = true): Promise<{
    success: boolean;
    count?: number;
    grouped?: boolean;
    credentials: any;
  }> {
    const params = grouped ? '?grouped=true' : '';
    const url = `${this.baseUrl}/my/credentials${params}`;
    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`Failed to list credentials: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get credentials for a specific domain
   * GET /my/credentials/:domain
   */
  async getCredentialsForDomain(domain: string): Promise<{
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
  }> {
    const url = `${this.baseUrl}/my/credentials/${encodeURIComponent(domain)}`;
    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, domain, count: 0, credentials: [] };
      }
      throw new Error(`Failed to get credentials: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get encrypted credentials for a domain (alias for compatibility)
   * GET /my/credentials/:domain
   */
  async getCookieJar(domain: string): Promise<Record<string, string> | null> {
    try {
      const result = await this.getCredentialsForDomain(domain);

      if (!result.success || result.credentials.length === 0) {
        return null;
      }

      // Convert array format to legacy cookie jar format
      const cookieJar: Record<string, string> = {};
      for (const cred of result.credentials) {
        cookieJar[cred.credentialKey] = cred.encryptedValue;
      }

      return cookieJar;
    } catch (error: any) {
      console.error(`[ERROR] Failed to fetch credentials for ${domain}:`, error.message);
      return null;
    }
  }

  /**
   * Store encrypted credentials for a domain
   * POST /my/credentials/stream
   */
  async storeCredentials(
    domain: string,
    credentials: Array<{
      type: string;
      key: string;
      encryptedValue: string;
    }>
  ): Promise<{
    success: boolean;
    count: number;
    credentials: any[];
  }> {
    const url = `${this.baseUrl}/my/credentials/stream`;
    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domain,
        credentials,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to store credentials: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete all credentials for a domain
   * DELETE /my/credentials/:domain
   */
  async deleteCredentialsForDomain(domain: string): Promise<{
    success: boolean;
    domain: string;
    deletedCount: number;
  }> {
    const url = `${this.baseUrl}/my/credentials/${encodeURIComponent(domain)}`;
    const response = await this.fetchWithTimeout(url, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete credentials: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete a specific credential by ID
   * DELETE /my/credentials/by-id/:credentialId
   */
  async deleteCredentialById(credentialId: string): Promise<{
    success: boolean;
    credentialId: string;
  }> {
    const url = `${this.baseUrl}/my/credentials/by-id/${encodeURIComponent(credentialId)}`;
    const response = await this.fetchWithTimeout(url, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete credential: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Invalidate credentials for a domain (alias for deleteCredentialsForDomain)
   */
  async expireCredentials(domain: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const result = await this.deleteCredentialsForDomain(domain);
    return {
      success: result.success,
      message: `Deleted ${result.deletedCount} credentials for ${domain}`
    };
  }

  /**
   * Execute an ability on the server
   * POST /my/abilities/:abilityId/execute
   *
   * @param abilityId - The abilityId to execute
   * @param params - Parameters object to pass to the ability
   * @param options - Optional configuration including transformCode and credentialKey
   */
  async executeAbility(
    abilityId: string,
    params: Record<string, any>,
    options: {
      transformCode?: string;
      credentialKey?: string;
    } = {}
  ): Promise<{
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
  }> {
    const url = `${this.baseUrl}/my/abilities/${encodeURIComponent(abilityId)}/execute`;

    console.error(`[INFO] Executing ability at URL: ${url}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authToken}`,
    };

    // Add X-Credential-Key header if provided (required for abilities that need credentials)
    if (options.credentialKey) {
      headers['X-Credential-Key'] = options.credentialKey;
      console.error(`[INFO] X-Credential-Key header added: ${options.credentialKey.substring(0, 4)}...`);
    } else {
      console.error(`[WARN] No credentialKey provided in options`);
    }

    const requestBody = {
      params,
      transformCode: options.transformCode,
    };

    console.error(`[INFO] Request body:`, JSON.stringify(requestBody));
    console.error(`[INFO] Request headers:`, JSON.stringify(headers, null, 2));

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    console.error(`[INFO] Response status: ${response.status} ${response.statusText}`);
    console.error(`[INFO] Response headers:`, JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

    const responseText = await response.text();
    console.error(`[INFO] Response body (first 500 chars):`, responseText.substring(0, 500));

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`[ERROR] Failed to parse response as JSON:`, parseError);
      console.error(`[ERROR] Response text:`, responseText);
      throw new Error(`Server returned non-JSON response: ${responseText.substring(0, 200)}`);
    }

    if (!response.ok) {
      // Handle error responses with additional context
      throw new Error(
        data.error || `Failed to execute ability: ${response.status} ${response.statusText}`
      );
    }

    return data;
  }
}

/**
 * Create an API client instance
 * @param authToken - Your Unbrowse API key or session token
 */
export function createApiClient(authToken: string): UnbrowseApiClient {
  // Auto-detect whether this is an API key or session token
  const isApiKey = authToken.startsWith("re_");
  return new UnbrowseApiClient(
    isApiKey ? { apiKey: authToken } : { sessionToken: authToken }
  );
}

// ============================================================================
// x402 PAYMENT-BASED API CLIENT
// ============================================================================

/**
 * Payment record for tracking x402 payments
 */
export interface PaymentRecord {
  id: string;
  timestamp: number;
  type: 'search' | 'execute';
  abilityId?: string;
  abilityName?: string;
  amount: string; // In USDC lamports
  amountFormatted: string; // Human readable (e.g., "0.001 USDC")
  amountCents: number; // In cents (e.g., 0.1 or 0.5)
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
export class UnbrowseX402Client {
  private readonly baseUrl: string;
  private readonly x402Client: X402SolanaClient;
  private timeout: number;
  private paymentHistory: PaymentRecord[] = [];

  constructor(config: {
    privateKey: string; // Base58 Solana private key
    rpcUrl?: string;
    timeout?: number;
  }) {
    this.x402Client = createX402Client({
      privateKey: config.privateKey,
      rpcUrl: config.rpcUrl,
    });
    this.baseUrl = UNBROWSE_API_BASE_URL;
    this.timeout = config.timeout || 300000;

    console.error(`[x402 Client] Initialized with wallet: ${this.x402Client.getPublicKey()}`);
  }

  /**
   * Get the wallet public key
   */
  getWalletAddress(): string {
    return this.x402Client.getPublicKey();
  }

  /**
   * Makes a fetch request with timeout
   */
  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Makes a request with x402 payment handling
   * If server responds with 402, constructs payment and retries
   */
  private async fetchWithPayment(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    // First attempt without payment
    const response = await this.fetchWithTimeout(url, options);

    // If not 402, return as-is
    if (response.status !== 402) {
      return response;
    }

    // Handle 402 Payment Required
    console.error(`[x402] Received 402 Payment Required for ${url}`);

    const responseBody = await response.json();
    const requirement = parsePaymentRequirement(responseBody);

    if (!requirement) {
      throw new Error('Server returned 402 but payment requirement could not be parsed');
    }

    console.error(`[x402] Payment required: ${requirement.amountFormatted}`);
    console.error(`[x402] Chain: ${requirement.chain}, Mint: ${requirement.mint}`);

    // Check balance before attempting payment
    try {
      const balance = await this.x402Client.getUsdcBalance(requirement.chain, requirement.mint);
      const requiredAmount = BigInt(requirement.amount);
      console.error(`[x402] Wallet USDC balance: ${balance} lamports (required: ${requiredAmount})`);
      if (balance < requiredAmount) {
        throw new Error(`Insufficient USDC balance. Have: ${balance}, need: ${requiredAmount}. Please fund your wallet: ${this.x402Client.getPublicKey()}`);
      }
    } catch (balanceError: any) {
      if (balanceError.message?.includes('Insufficient')) {
        throw balanceError;
      }
      console.error(`[x402] Could not check balance: ${balanceError.message}`);
    }

    // Process payment
    const paymentResult = await this.x402Client.processPaymentRequired(requirement);

    if (!paymentResult.success) {
      throw new Error(`Payment failed: ${paymentResult.error}`);
    }

    console.error(`[x402] Payment transaction created, retrying request with X-Payment header`);

    // Retry with payment header
    const retryResponse = await this.fetchWithTimeout(url, {
      ...options,
      headers: {
        ...options.headers,
        'X-Payment': paymentResult.paymentHeader!,
      },
    });

    // Log if payment was rejected
    if (!retryResponse.ok) {
      const errorClone = retryResponse.clone();
      try {
        const errorData = await errorClone.json();
        console.error(`[x402] Payment rejected by server:`, JSON.stringify(errorData, null, 2));
      } catch {
        console.error(`[x402] Payment rejected with status: ${retryResponse.status} ${retryResponse.statusText}`);
      }
    }

    return retryResponse;
  }

  /**
   * Search abilities using x402 paid endpoint
   * GET /x402/abilities?q=<query>
   *
   * Cost: 0.1 cents per search in USDC on Solana
   */
  async searchAbilities(query: string, limit: number = 12): Promise<{
    success: boolean;
    count: number;
    query: string;
    abilities: IndexedAbility[];
    payment?: {
      verified: boolean;
      signature?: string;
      type: string;
    };
  }> {
    const params = new URLSearchParams({
      q: query,
      top_k: String(Math.min(limit, 45))
    });

    const url = `${this.baseUrl}/x402/abilities?${params}`;
    console.error(`[x402] Searching abilities: "${query}"`);

    try {
      const response = await this.fetchWithPayment(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = errorData.error || `Search failed: ${response.status} ${response.statusText}`;

        // Record failed payment attempt
        this.recordPayment({
          type: 'search',
          amount: '1000', // 0.1 cents = 1000 USDC lamports
          amountFormatted: '0.001 USDC',
          amountCents: 0.1,
          verified: false,
          success: false,
          error,
        });

        throw new Error(error);
      }

      const data = await response.json();

      // Record successful payment
      if (data.payment) {
        this.recordPayment({
          type: 'search',
          amount: '1000', // 0.1 cents = 1000 USDC lamports
          amountFormatted: '0.001 USDC',
          amountCents: 0.1,
          signature: data.payment.signature,
          verified: data.payment.verified,
          success: true,
        });
      }

      return {
        success: data.success,
        count: data.count,
        query: data.query,
        abilities: (data.results || []).map(transformAbilityResponse),
        payment: data.payment,
      };
    } catch (error: any) {
      // Record failed payment if not already recorded
      if (!error.message?.includes('Search failed')) {
        this.recordPayment({
          type: 'search',
          amount: '1000',
          amountFormatted: '0.001 USDC',
          amountCents: 0.1,
          verified: false,
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  }

  /**
   * Execute an ability using x402 paid endpoint
   * POST /x402/abilities/:abilityId/execute
   *
   * Cost: 0.5 cents per execution in USDC on Solana
   * Payment is split: 20% platform, 80% ability owner
   */
  async executeAbility(
    abilityId: string,
    params: Record<string, any>,
    options: {
      transformCode?: string;
    } = {}
  ): Promise<{
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
  }> {
    const url = `${this.baseUrl}/x402/abilities/${encodeURIComponent(abilityId)}/execute`;

    console.error(`[x402] Executing ability: ${abilityId}`);

    const requestBody = {
      params,
      transformCode: options.transformCode,
    };

    try {
      const response = await this.fetchWithPayment(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        // Record failed payment
        this.recordPayment({
          type: 'execute',
          abilityId,
          amount: '5000', // 0.5 cents = 5000 USDC lamports
          amountFormatted: '0.005 USDC',
          amountCents: 0.5,
          verified: false,
          success: false,
          error: `Server returned non-JSON response`,
        });
        throw new Error(`Server returned non-JSON response: ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        const error = data.error || `Failed to execute ability: ${response.status} ${response.statusText}`;

        // Record failed payment
        this.recordPayment({
          type: 'execute',
          abilityId,
          abilityName: data.result?.abilityName,
          amount: '5000',
          amountFormatted: '0.005 USDC',
          amountCents: 0.5,
          verified: false,
          success: false,
          error,
        });

        throw new Error(error);
      }

      // Record successful payment
      if (data.payment) {
        this.recordPayment({
          type: 'execute',
          abilityId,
          abilityName: data.result?.abilityName,
          amount: '5000', // 0.5 cents = 5000 USDC lamports
          amountFormatted: '0.005 USDC',
          amountCents: 0.5,
          signature: data.payment.signature,
          verified: data.payment.verified,
          success: true,
        });
      }

      return data;
    } catch (error: any) {
      // Record failed payment if not already recorded
      if (!error.message?.includes('Failed to execute') && !error.message?.includes('non-JSON')) {
        this.recordPayment({
          type: 'execute',
          abilityId,
          amount: '5000',
          amountFormatted: '0.005 USDC',
          amountCents: 0.5,
          verified: false,
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  }

  /**
   * Get ability details by ID (public endpoint, no payment required)
   * GET /abilities/:abilityId
   */
  async getAbility(abilityId: string): Promise<{
    success: boolean;
    ability: IndexedAbility;
    wrapper: any;
  }> {
    const url = `${this.baseUrl}/abilities/${encodeURIComponent(abilityId)}`;
    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Ability not found: ${abilityId}`);
      }
      throw new Error(`Failed to get ability: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: data.success,
      ability: transformAbilityResponse(data.ability),
      wrapper: data.wrapper,
    };
  }

  /**
   * Check USDC balance for current wallet
   */
  async getBalance(chain: 'devnet' | 'mainnet-beta' = 'devnet'): Promise<{
    balance: string;
    balanceFormatted: string;
  }> {
    // Get USDC mint from the first 402 response or use default
    const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
    const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

    const mint = chain === 'devnet' ? USDC_MINT_DEVNET : USDC_MINT_MAINNET;
    const balance = await this.x402Client.getUsdcBalance(chain, mint);

    // Format: USDC has 6 decimals
    const formatted = (Number(balance) / 1_000_000).toFixed(6);

    return {
      balance: balance.toString(),
      balanceFormatted: `${formatted} USDC`,
    };
  }

  // ============================================================================
  // PAYMENT TRACKING
  // ============================================================================

  /**
   * Record a payment for tracking
   */
  private recordPayment(record: Omit<PaymentRecord, 'id' | 'timestamp'>): PaymentRecord {
    const fullRecord: PaymentRecord = {
      ...record,
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
    };

    this.paymentHistory.push(fullRecord);

    // Keep only last 1000 payments in memory
    if (this.paymentHistory.length > 1000) {
      this.paymentHistory = this.paymentHistory.slice(-1000);
    }

    console.error(`[x402] Payment recorded: ${record.type} - ${record.amountFormatted} - ${record.verified ? 'verified' : 'pending'}`);

    return fullRecord;
  }

  /**
   * Get payment history
   * @param limit - Maximum number of records to return (default: 50)
   * @param type - Filter by payment type ('search' or 'execute')
   */
  getPaymentHistory(limit: number = 50, type?: 'search' | 'execute'): PaymentRecord[] {
    let records = [...this.paymentHistory].reverse(); // Most recent first

    if (type) {
      records = records.filter(r => r.type === type);
    }

    return records.slice(0, limit);
  }

  /**
   * Get payment summary statistics
   */
  getPaymentSummary(): PaymentSummary {
    const successfulPayments = this.paymentHistory.filter(p => p.success);

    const searchPayments = successfulPayments.filter(p => p.type === 'search');
    const executePayments = successfulPayments.filter(p => p.type === 'execute');

    const searchSpentCents = searchPayments.reduce((sum, p) => sum + p.amountCents, 0);
    const executeSpentCents = executePayments.reduce((sum, p) => sum + p.amountCents, 0);
    const totalSpentCents = searchSpentCents + executeSpentCents;

    return {
      totalPayments: successfulPayments.length,
      totalSpentCents,
      totalSpentFormatted: `$${(totalSpentCents / 100).toFixed(4)} (${totalSpentCents.toFixed(2)} cents)`,
      searchCount: searchPayments.length,
      searchSpentCents,
      executeCount: executePayments.length,
      executeSpentCents,
      recentPayments: this.getPaymentHistory(10),
    };
  }

  /**
   * Clear payment history
   */
  clearPaymentHistory(): void {
    this.paymentHistory = [];
    console.error('[x402] Payment history cleared');
  }
}

/**
 * Create an x402 payment-based API client
 * @param privateKey - Base58 encoded Solana private key
 * @param rpcUrl - Optional custom RPC URL
 */
export function createX402ApiClient(privateKey: string, rpcUrl?: string): UnbrowseX402Client {
  return new UnbrowseX402Client({ privateKey, rpcUrl });
}

/**
 * Helper function to format ability description with dependencies
 */
export function formatAbilityDescription(ability: IndexedAbility): string {
  let desc = ability.description;

  // Add dependency order information
  if (ability.dependency_order && ability.dependency_order.length > 0) {
    desc += `\n\n**Dependency Order:** This ability must be called AFTER: ${ability.dependency_order.map((depId: string) => `\`${depId}\``).join(" → ")}`;
    desc += `\nCall these abilities in sequence before executing this one.`;
  }

  // Add input schema examples
  if (ability.input_schema?.properties) {
    const examples: string[] = [];
    for (const [key, prop] of Object.entries(ability.input_schema.properties as Record<string, any>)) {
      if (prop.example !== undefined) {
        examples.push(`- \`${key}\`: ${JSON.stringify(prop.example)}`);
      }
    }

    if (examples.length > 0) {
      desc += `\n\n**Input Examples:**\n${examples.join('\n')}`;
      desc += `\n\n**Tip:** If you need an arbitrary value to execute this ability (especially for IDs or numbers), use the examples provided above.`;
    }
  }

  // Add missing dependency warnings
  if (
    ability.dependencies?.missing &&
    ability.dependencies.missing.length > 0
  ) {
    desc += `\n\n**⚠️ Missing Dependencies:**`;
    ability.dependencies.missing.forEach((dep) => {
      desc += `\n- ${dep.ability_id} (${dep.ability_name}) - Referenced as ${dep.reference}`;
    });
  }

  // Add credential requirements
  if (ability.requires_dynamic_headers) {
    desc += `\n\n**Required Credentials:** ${ability.dynamic_header_keys.join(", ")}`;
  }

  return desc;
}
