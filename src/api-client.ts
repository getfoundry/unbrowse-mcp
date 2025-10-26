/**
 * Unbrowse API Client
 *
 * Client for interacting with the Unbrowse API at http://localhost:4111
 * Handles fetching abilities and credentials from the real API endpoints.
 */

/**
 * Simple BM25 implementation for ranking search results
 * Based on the Robertson/Zaragoza BM25 algorithm
 */
class BM25 {
  private docs: string[][];
  private k1: number;
  private b: number;
  private avgdl: number;
  private idf: Map<string, number>;

  constructor(docs: string[][], k1: number = 1.5, b: number = 0.75) {
    this.docs = docs;
    this.k1 = k1;
    this.b = b;

    // Calculate average document length
    const totalLength = docs.reduce((sum, doc) => sum + doc.length, 0);
    this.avgdl = totalLength / docs.length;

    // Calculate IDF for each term
    this.idf = new Map();
    const docCount = docs.length;
    const termDocCount = new Map<string, number>();

    // Count documents containing each term
    for (const doc of docs) {
      const uniqueTerms = new Set(doc);
      for (const term of uniqueTerms) {
        termDocCount.set(term, (termDocCount.get(term) || 0) + 1);
      }
    }

    // Calculate IDF: log((N - df + 0.5) / (df + 0.5))
    for (const [term, df] of termDocCount.entries()) {
      const idf = Math.log((docCount - df + 0.5) / (df + 0.5));
      this.idf.set(term, idf);
    }
  }

  score(query: string[], docIndex: number): number {
    const doc = this.docs[docIndex];
    const docLength = doc.length;

    // Count term frequencies in document
    const termFreq = new Map<string, number>();
    for (const term of doc) {
      termFreq.set(term, (termFreq.get(term) || 0) + 1);
    }

    let score = 0;
    for (const term of query) {
      const idf = this.idf.get(term) || 0;
      const tf = termFreq.get(term) || 0;

      // BM25 score formula
      const numerator = tf * (this.k1 + 1);
      const denominator = tf + this.k1 * (1 - this.b + this.b * (docLength / this.avgdl));

      score += idf * (numerator / denominator);
    }

    return score;
  }
}

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
}

/**
 * Configuration for the API client
 */
export interface ApiClientConfig {
  apiKey: string;
  timeout?: number;
}

export const UNBROWSE_API_BASE_URL = "http://localhost:4111";

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
      // Get all personal abilities (no client-side filtering)
      this.listAbilities(options).then(result => result.abilities),
      // Search global published abilities (server-side vector search)
      this.searchPublicAbilities(query, limit * 3).then(result => result.abilities),
    ]);

    // Extract results from Promise.allSettled with error logging
    const personalAbilities = personalResult.status === 'fulfilled'
      ? personalResult.value
      : (() => {
          console.warn('[WARN] Personal abilities search failed:', personalResult.reason?.message || personalResult.reason);
          return [] as IndexedAbility[];
        })();

    const publicAbilities = publicResult.status === 'fulfilled'
      ? publicResult.value
      : (() => {
          console.warn('[WARN] Public abilities search failed:', publicResult.reason?.message || publicResult.reason);
          return [] as IndexedAbility[];
        })();

    // Combine and rank abilities using BM25 with 10% boost for personal abilities
    interface ScoredAbility {
      ability: IndexedAbility;
      score: number;
      isPersonal: boolean;
    }

    const scoredAbilities: ScoredAbility[] = [];
    const seenIds = new Set<string>();

    // Tokenize query for BM25
    const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);

    // Score personal abilities with BM25 + 10% boost
    if (personalAbilities.length > 0) {
      const personalDocs = personalAbilities.map(a => {
        const text = `${a.ability_name || ''} ${a.description || ''} ${a.service_name || ''}`.toLowerCase();
        return text.split(/\s+/).filter(t => t.length > 0);
      });
      const personalBM25 = new BM25(personalDocs);

      for (let i = 0; i < personalAbilities.length; i++) {
        const ability = personalAbilities[i];
        seenIds.add(ability.ability_id);

        const bm25Score = personalBM25.score(queryTokens, i);
        const personalBoost = 0.1; // 10% boost for personal abilities

        scoredAbilities.push({
          ability,
          score: bm25Score + personalBoost,
          isPersonal: true,
        });
      }
    }

    // Score public abilities with BM25 (no boost)
    if (publicAbilities.length > 0) {
      const publicDocs = publicAbilities.map(a => {
        const text = `${a.ability_name || ''} ${a.description || ''} ${a.service_name || ''}`.toLowerCase();
        return text.split(/\s+/).filter(t => t.length > 0);
      });
      const publicBM25 = new BM25(publicDocs);

      for (let i = 0; i < publicAbilities.length; i++) {
        const ability = publicAbilities[i];

        // Skip if already added as personal ability
        if (seenIds.has(ability.ability_id)) {
          continue;
        }
        seenIds.add(ability.ability_id);

        const bm25Score = publicBM25.score(queryTokens, i);

        scoredAbilities.push({
          ability,
          score: bm25Score,
          isPersonal: false,
        });
      }
    }

    // Sort by score (highest first) and take top results
    scoredAbilities.sort((a, b) => b.score - a.score);
    const mergedAbilities = scoredAbilities.slice(0, limit).map(sa => sa.ability);

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
