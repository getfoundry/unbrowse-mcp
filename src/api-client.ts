/**
 * Unbrowse API Client
 *
 * Client for interacting with the Unbrowse API at http://localhost:4111
 * Handles fetching abilities and credentials from the real API endpoints.
 */

/**
 * Interface for indexed abilities from the API
 */
export interface IndexedAbility {
  abilityId: string;
  abilityName: string;
  serviceName: string;
  description: string;
  inputSchema: any;
  outputSchema?: any;
  dynamicHeaderKeys: string[];
  requiresDynamicHeaders: boolean;
  ponScore?: number;
  successRate?: number;
  dependencyOrder: string[];
  dependencies?: {
    resolved?: any[];
    missing?: Array<{
      abilityId: string;
      abilityName: string;
      reference: string;
    }>;
    unresolved?: any[];
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Configuration for the API client
 */
export interface ApiClientConfig {
  baseUrl?: string;
  timeout?: number;
}

/**
 * Unbrowse API Client
 */
export class UnbrowseApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.UNBROWSE_API_URL || "http://localhost:4111";
    this.timeout = config.timeout || 10000; // 10 second default timeout
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
   * List all abilities from the API
   * GET /abilities
   */
  async listAbilities(options: {
    userCreds?: string[];
    filterByDomains?: boolean;
    forToolRegistration?: boolean;
    trustProvidedCreds?: boolean;
  } = {}): Promise<{
    success: boolean;
    count: number;
    abilities: IndexedAbility[];
    availableDomains?: string[];
    credentialHints?: string[];
  }> {
    const params = new URLSearchParams();

    if (options.userCreds && options.userCreds.length > 0) {
      params.append('userCreds', options.userCreds.join(','));
    }
    if (options.filterByDomains !== undefined) {
      params.append('filterByDomains', String(options.filterByDomains));
    }
    if (options.forToolRegistration !== undefined) {
      params.append('forToolRegistration', String(options.forToolRegistration));
    }
    if (options.trustProvidedCreds !== undefined) {
      params.append('trustProvidedCreds', String(options.trustProvidedCreds));
    }

    const url = `${this.baseUrl}/abilities${params.toString() ? `?${params}` : ''}`;
    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`Failed to list abilities: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Search abilities by query
   * GET /abilities/search
   */
  async searchAbilities(query: string, options: {
    userCreds?: string[];
    filterByDomains?: boolean;
    forToolRegistration?: boolean;
    trustProvidedCreds?: boolean;
  } = {}): Promise<{
    success: boolean;
    count: number;
    abilities: IndexedAbility[];
  }> {
    const params = new URLSearchParams({ q: query });

    if (options.userCreds && options.userCreds.length > 0) {
      params.append('userCreds', options.userCreds.join(','));
    }
    if (options.filterByDomains !== undefined) {
      params.append('filterByDomains', String(options.filterByDomains));
    }
    if (options.forToolRegistration !== undefined) {
      params.append('forToolRegistration', String(options.forToolRegistration));
    }
    if (options.trustProvidedCreds !== undefined) {
      params.append('trustProvidedCreds', String(options.trustProvidedCreds));
    }

    const url = `${this.baseUrl}/abilities/search?${params}`;
    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`Failed to search abilities: ${response.status} ${response.statusText}`);
    }

    return response.json();
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

    return response.json();
  }

  /**
   * Get ability metadata
   * GET /abilities/:abilityId/metadata
   */
  async getAbilityMetadata(abilityId: string): Promise<{
    success: boolean;
    metadata: any;
  }> {
    const url = `${this.baseUrl}/abilities/${encodeURIComponent(abilityId)}/metadata`;
    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Ability not found: ${abilityId}`);
      }
      throw new Error(`Failed to get ability metadata: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * List all credential services
   * GET /credentials
   */
  async listCredentialServices(): Promise<{
    success: boolean;
    services: string[];
  }> {
    const url = `${this.baseUrl}/credentials`;
    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`Failed to list credentials: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get credentials for a service
   * GET /credentials/:serviceName
   */
  async getCredentials(serviceName: string): Promise<{
    success: boolean;
    credentials: Record<string, string>;
    metadata?: any;
  }> {
    const url = `${this.baseUrl}/credentials/${encodeURIComponent(serviceName)}`;
    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, credentials: {} };
      }
      throw new Error(`Failed to get credentials: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get cookie jar for a service
   * GET /cookie-jar/:serviceName
   */
  async getCookieJar(serviceName: string): Promise<Record<string, string> | null> {
    const url = `${this.baseUrl}/cookie-jar/${encodeURIComponent(serviceName)}`;

    try {
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to get cookie jar: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.credentials || null;
    } catch (error: any) {
      console.error(`[ERROR] Failed to fetch cookie jar for ${serviceName}:`, error.message);
      return null;
    }
  }

  /**
   * Store credentials for a service
   * POST /credentials
   */
  async storeCredentials(
    serviceName: string,
    credentials: Record<string, string>,
    metadata?: {
      authType?: string;
      expiresAt?: string | null;
      refreshToken?: string | null;
    }
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const url = `${this.baseUrl}/credentials`;
    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serviceName,
        credentials,
        ...metadata,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to store credentials: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Invalidate credentials for a service
   * POST /credentials/:serviceName/expire
   */
  async expireCredentials(serviceName: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const url = `${this.baseUrl}/credentials/${encodeURIComponent(serviceName)}/expire`;
    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to expire credentials: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

/**
 * Default API client instance
 */
export const apiClient = new UnbrowseApiClient();

/**
 * Helper function to format ability description with dependencies
 */
export function formatAbilityDescription(ability: IndexedAbility): string {
  let desc = ability.description;

  // Add dependency order information
  if (ability.dependencyOrder && ability.dependencyOrder.length > 0) {
    desc += `\n\n**Dependency Order:** This ability must be called AFTER: ${ability.dependencyOrder.map((depId) => `\`${depId}\``).join(" → ")}`;
    desc += `\nCall these abilities in sequence before executing this one.`;
  }

  // Add missing dependency warnings
  if (
    ability.dependencies?.missing &&
    ability.dependencies.missing.length > 0
  ) {
    desc += `\n\n**⚠️ Missing Dependencies:**`;
    ability.dependencies.missing.forEach((dep) => {
      desc += `\n- ${dep.abilityId} (${dep.abilityName}) - Referenced as ${dep.reference}`;
    });
  }

  // Add credential requirements
  if (ability.requiresDynamicHeaders) {
    desc += `\n\n**Required Credentials:** ${ability.dynamicHeaderKeys.join(", ")}`;
  }

  return desc;
}
