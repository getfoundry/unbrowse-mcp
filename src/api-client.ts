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
  ability_id: string;
  ability_name: string;
  service_name: string;
  description: string;
  input_schema: any;
  output_schema?: any;
  request_method: string;
  request_url: string;
  dependency_order: string[];
  requires_dynamic_headers: boolean;
  dynamic_header_keys: string[];
  static_headers?: Record<string, string>;
  wrapper_code: string;
  generated_at: string;
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
  pon_score?: number;
  success_rate?: number;
}

/**
 * Configuration for the API client
 */
export interface ApiClientConfig {
  apiKey: string;
  timeout?: number;
}

export const UNBROWSE_API_BASE_URL = "https://agent.unbrowse.ai";

/**
 * Transform camelCase API response to snake_case IndexedAbility
 */
function transformAbilityResponse(apiAbility: any): IndexedAbility {
  return {
    ability_id: apiAbility.abilityId,
    ability_name: apiAbility.abilityName,
    service_name: apiAbility.serviceName,
    description: apiAbility.description,
    input_schema: apiAbility.metadata?.input_schema || apiAbility.inputSchema,
    output_schema: apiAbility.metadata?.output_schema || apiAbility.outputSchema,
    request_method: apiAbility.metadata?.request_method || apiAbility.requestMethod,
    request_url: apiAbility.metadata?.request_url || apiAbility.requestUrl,
    dependency_order: apiAbility.metadata?.dependency_order || apiAbility.dependencyOrder || [],
    requires_dynamic_headers: apiAbility.dynamicHeadersRequired || false,
    dynamic_header_keys: apiAbility.dynamicHeaderKeys || [],
    static_headers: apiAbility.metadata?.static_headers || apiAbility.staticHeaders,
    wrapper_code: apiAbility.metadata?.wrapper_code || apiAbility.wrapperCode || '',
    generated_at: apiAbility.metadata?.generated_at || apiAbility.generatedAt || apiAbility.createdAt,
    dependencies: apiAbility.dependencies,
    pon_score: apiAbility.ponScore,
    success_rate: apiAbility.successRate,
  };
}

/**
 * Unbrowse API Client
 */
export class UnbrowseApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private timeout: number;

  constructor(config: ApiClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = UNBROWSE_API_BASE_URL;
    this.timeout = config.timeout || 10000; // 10 second default timeout
  }

  /**
   * Makes a fetch request with timeout and authentication
   */
  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${this.apiKey}`,
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
   * Search abilities across both user's personal abilities AND the global published index
   * This searches both /my/abilities (personal) and /public/abilities (global) and merges results
   *
   * @param query - Search query string
   * @param options - Filter options for personal abilities
   * @param limit - Maximum number of results to return (default: 30)
   */
  async searchAbilities(query: string, options: {
    favorites?: boolean;
    published?: boolean;
  } = {}, limit: number = 30): Promise<{
    success: boolean;
    count: number;
    abilities: IndexedAbility[];
  }> {
    // Search both personal abilities and global published abilities in parallel
    const [personalResult, publicResult] = await Promise.allSettled([
      // Search personal abilities (client-side filtering)
      this.listAbilities(options).then(result => {
        const lowerQuery = query.toLowerCase();
        return result.abilities.filter(ability =>
          ability.ability_name?.toLowerCase().includes(lowerQuery) ||
          ability.description?.toLowerCase().includes(lowerQuery) ||
          ability.service_name?.toLowerCase().includes(lowerQuery)
        );
      }),
      // Search global published abilities (server-side vector search)
      this.searchPublicAbilities(query, limit)
        .then(result => result.abilities)
        .catch(() => [] as IndexedAbility[]), // Fallback to empty array if public search fails
    ]);

    // Combine results, deduplicating by ability_id (personal abilities take precedence)
    const personalAbilities = personalResult.status === 'fulfilled' ? personalResult.value : [];
    const publicAbilities = publicResult.status === 'fulfilled' ? publicResult.value : [];

    const abilityMap = new Map<string, IndexedAbility>();

    // Add public abilities first
    for (const ability of publicAbilities) {
      abilityMap.set(ability.ability_id, ability);
    }

    // Override with personal abilities (they take precedence)
    for (const ability of personalAbilities) {
      abilityMap.set(ability.ability_id, ability);
    }

    const mergedAbilities = Array.from(abilityMap.values()).slice(0, limit);

    return {
      success: true,
      count: mergedAbilities.length,
      abilities: mergedAbilities
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
}

/**
 * Create an API client instance
 * @param apiKey - Your Unbrowse API key
 */
export function createApiClient(apiKey: string): UnbrowseApiClient {
  return new UnbrowseApiClient({ apiKey });
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
