/**
 * Unbrowse MCP Server
 *
 * Provides access to indexed abilities from wrapper-storage and secure credential management.
 * Implements the private registry capabilities described in master.md:
 * - /list endpoint: Lists indexed tools/abilities filtered by user credentials
 * - /cookiejar endpoint: Manages encrypted credentials with SECRET-based decryption
 */
import { z } from "zod";
export declare const configSchema: z.ZodEffects<z.ZodObject<{
    apiKey: z.ZodOptional<z.ZodString>;
    sessionToken: z.ZodOptional<z.ZodString>;
    solanaPrivateKey: z.ZodOptional<z.ZodString>;
    solanaRpcUrl: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    debug: z.ZodDefault<z.ZodBoolean>;
    enableIndexTool: z.ZodDefault<z.ZodBoolean>;
    devMode: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    debug: boolean;
    enableIndexTool: boolean;
    devMode: boolean;
    sessionToken?: string | undefined;
    apiKey?: string | undefined;
    solanaPrivateKey?: string | undefined;
    solanaRpcUrl?: string | undefined;
    password?: string | undefined;
}, {
    sessionToken?: string | undefined;
    apiKey?: string | undefined;
    debug?: boolean | undefined;
    solanaPrivateKey?: string | undefined;
    solanaRpcUrl?: string | undefined;
    password?: string | undefined;
    enableIndexTool?: boolean | undefined;
    devMode?: boolean | undefined;
}>, {
    debug: boolean;
    enableIndexTool: boolean;
    devMode: boolean;
    sessionToken?: string | undefined;
    apiKey?: string | undefined;
    solanaPrivateKey?: string | undefined;
    solanaRpcUrl?: string | undefined;
    password?: string | undefined;
}, {
    sessionToken?: string | undefined;
    apiKey?: string | undefined;
    debug?: boolean | undefined;
    solanaPrivateKey?: string | undefined;
    solanaRpcUrl?: string | undefined;
    password?: string | undefined;
    enableIndexTool?: boolean | undefined;
    devMode?: boolean | undefined;
}>;
export default function createServer({ config, }: {
    config: z.infer<typeof configSchema>;
}): import("@modelcontextprotocol/sdk/server").Server<{
    method: string;
    params?: {
        [x: string]: unknown;
        _meta?: {
            [x: string]: unknown;
            progressToken?: string | number | undefined;
        } | undefined;
    } | undefined;
}, {
    method: string;
    params?: {
        [x: string]: unknown;
        _meta?: {
            [x: string]: unknown;
        } | undefined;
    } | undefined;
}, {
    [x: string]: unknown;
    _meta?: {
        [x: string]: unknown;
    } | undefined;
}>;
//# sourceMappingURL=index.d.ts.map