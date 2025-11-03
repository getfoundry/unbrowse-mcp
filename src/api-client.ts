/**
 * Unbrowse API Client
 *
 * Client for interacting with the Unbrowse API at http://localhost:4111
 * Handles fetching abilities and credentials from the real API endpoints.
 */

/**
 * Interface for indexed abilities from the API
 * Fields match the server response structure (snake_case)
 */
export interface IndexedAbility {
  user_ability_id?: string; // From /my/abilities endpoint (deprecated, use ability_id for execution)
  ability_id: string; // Use this for execution - the unique identifier for querying the database
  ability_name: string;
  service_name: string;
  domain?: string; // The domain this ability is for (e.g., "api.github.com")
  description: string;
  input_schema?: any; // Only available when fetching full ability details
  output_schema?: any;
  request_method?: string; // Only available when fetching full ability details
  request_url?: string; // Only available when fetching full ability details
  dependency_order: string[];
  requires_dynamic_headers: boolean;
  dynamic_header_keys: string[];
  static_headers?: Record<string, string>;
  wrapper_code?: string; // Only available when fetching full ability details
  generated_at?: string;
  // Additional fields from search results
  is_favorite?: boolean;
  is_published?: boolean;
  health_score?: string;
  vector_id?: number | null; // Infraxa vector ID (for internal use)
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
}

export const UNBROWSE_API_BASE_URL = "https://index.unbrowse.ai";
// export const UNBROWSE_API_BASE_URL = "http://localhost:4111";

/**
 * Transform camelCase API response to snake_case IndexedAbility
 * Handles both full ability details and search results
 */
function transformAbilityResponse(apiAbility: any): IndexedAbility {
  return {
    // Core identifiers
    user_ability_id: apiAbility.userAbilityId,
    ability_id: apiAbility.abilityId,

    // Basic info
    ability_name: apiAbility.abilityName,
    service_name: apiAbility.serviceName,
    domain: apiAbility.domain,
    description: apiAbility.description,

    // Schema and wrapper (only in full ability details)
    input_schema: apiAbility.metadata?.input_schema || apiAbility.inputSchema,
    output_schema: apiAbility.metadata?.output_schema || apiAbility.outputSchema,
    request_method: apiAbility.metadata?.request_method || apiAbility.requestMethod,
    request_url: apiAbility.metadata?.request_url || apiAbility.requestUrl,
    wrapper_code: apiAbility.metadata?.wrapper_code || apiAbility.wrapperCode,

    // Dependencies and headers
    dependency_order: apiAbility.metadata?.dependency_order || apiAbility.dependencyOrder || [],
    requires_dynamic_headers: apiAbility.dynamicHeadersRequired || false,
    dynamic_header_keys: apiAbility.dynamicHeaderKeys || [],
    static_headers: apiAbility.metadata?.static_headers || apiAbility.staticHeaders,

    // Timestamps and metadata
    generated_at: apiAbility.metadata?.generated_at || apiAbility.generatedAt || apiAbility.createdAt,

    // Search result fields
    is_favorite: apiAbility.isFavorite,
    is_published: apiAbility.isPublished,
    health_score: apiAbility.healthScore,
    vector_id: apiAbility.vectorId,

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
    this.timeout = config.timeout || 10000; // 10 second default timeout

    console.log(`[API Client] Initialized with auth type: ${this.authType}`);
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
   */
  async searchAbilities(query: string, limit: number = 6): Promise<{
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

    const url = `${this.baseUrl}/abilities/search?${params}`;
    const response = await this.fetchWithTimeout(url);
    console.log({response})

    if (!response.ok) {
      if (response.status === 402) {
        const data = await response.json();
        throw new Error(data.error || 'Insufficient tokens for search');
      }
      throw new Error(`Failed to search abilities: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    console.log({data})

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

    console.log(`[INFO] Executing ability at URL: ${url}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authToken}`,
    };

    // Add X-Credential-Key header if provided (required for abilities that need credentials)
    if (options.credentialKey) {
      headers['X-Credential-Key'] = options.credentialKey;
      console.log(`[INFO] X-Credential-Key header added: ${options.credentialKey.substring(0, 4)}...`);
    } else {
      console.log(`[WARN] No credentialKey provided in options`);
    }

    const requestBody = {
      params,
      transformCode: options.transformCode,
    };

    console.log(`[INFO] Request body:`, JSON.stringify(requestBody));
    console.log(`[INFO] Request headers:`, JSON.stringify(headers, null, 2));

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    console.log(`[INFO] Response status: ${response.status} ${response.statusText}`);
    console.log(`[INFO] Response headers:`, JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

    const responseText = await response.text();
    console.log(`[INFO] Response body (first 500 chars):`, responseText.substring(0, 500));

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
