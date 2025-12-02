/**
 * Enhanced Wrapper Execution Engine for Unbrowse MCP
 *
 * Enhancements:
 * - 401+ error detection and credential expiration
 * - Automatic login ability suggestions
 * - Dependency order validation
 */
import type { UnbrowseApiClient } from "./api-client.js";
/**
 * Interface for wrapper execution result
 */
export interface WrapperExecutionResult {
    success: boolean;
    statusCode?: number;
    responseBody?: any;
    responseHeaders?: Record<string, string>;
    error?: string;
    credentialsExpired?: boolean;
    loginAbilities?: Array<{
        id: string;
        name: string;
        description: string;
    }>;
    executedAt: string;
}
interface WrapperData {
    input: {
        session_id?: string;
        service_name: string;
        ability_id: string;
        ability_name: string;
        description?: string;
        wrapper_code: string;
        static_headers: Array<{
            key: string;
            value_code: string;
        }>;
        dynamic_header_keys: string[];
        input_schema: any;
        dependency_order?: string[];
        http_method?: string;
        url?: string;
        test_inputs?: any;
    };
    dependencies?: {
        missing?: Array<{
            ability_id: string;
            ability_name: string;
            reference: string;
        }>;
    };
    schemas?: {
        input?: any;
        output?: any;
    };
    createdAt?: string;
    updatedAt?: string;
}
/**
 * Executes a wrapper with credential injection and 401+ error handling
 */
export declare function executeWrapper(abilityId: string, payload: Record<string, any>, options?: Record<string, any>, injectedCredentials?: Record<string, string>, providedWrapperData?: WrapperData, secret?: string, apiClient?: UnbrowseApiClient | null): Promise<WrapperExecutionResult>;
/**
 * Lists available wrappers
 */
export declare function listAvailableWrappers(apiClient: UnbrowseApiClient): Promise<string[]>;
/**
 * Gets wrapper metadata including dependency order
 */
export declare function getWrapperMetadata(abilityId: string, apiClient: UnbrowseApiClient): Promise<{
    serviceName: string;
    abilityName: string;
    description: string;
    inputSchema: any;
    staticHeaders: number;
    dynamicHeaderKeys: string[];
    requiresCreds: boolean;
    dependencyOrder: string[];
    dependencies?: {
        missing?: Array<{
            ability_id: string;
            ability_name: string;
            reference: string;
        }>;
    };
} | null>;
export {};
//# sourceMappingURL=wrapper-executor-enhanced.d.ts.map