/**
 * X402 Payment Client for MCP
 *
 * This module provides an MCP tool that can call x402-protected APIs,
 * automatically handling payments when required (HTTP 402 responses).
 */

import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import { type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { withPaymentInterceptor } from "x402-axios";

/**
 * Configuration for x402 client
 */
export interface X402ClientConfig {
  privateKey: Hex;
  defaultBaseURL?: string;
}

/**
 * Result from calling an x402-protected API
 */
export interface X402CallResult {
  success: boolean;
  data?: any;
  statusCode: number;
  headers?: Record<string, string>;
  error?: string;
  paymentMade?: boolean;
  paymentAmount?: string;
  paymentAsset?: string;
}

/**
 * Creates an axios client with automatic x402 payment handling
 */
export function createX402Client(config: X402ClientConfig): AxiosInstance {
  // Create wallet account from private key
  const account = privateKeyToAccount(config.privateKey);

  // Create base axios instance
  const baseConfig: AxiosRequestConfig = {};
  if (config.defaultBaseURL) {
    baseConfig.baseURL = config.defaultBaseURL;
  }

  const axiosInstance = axios.create(baseConfig);

  // Add x402 payment interceptor
  const clientWithPayments = withPaymentInterceptor(axiosInstance, account);

  return clientWithPayments;
}

/**
 * Call an x402-protected API endpoint
 *
 * @param client - Axios client with payment interceptor
 * @param options - Request options
 * @returns Result with data or error
 */
export async function callX402API(
  client: AxiosInstance,
  options: {
    url: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    headers?: Record<string, string>;
    data?: any;
    params?: Record<string, any>;
  }
): Promise<X402CallResult> {
  try {
    const response = await client.request({
      url: options.url,
      method: options.method || "GET",
      headers: options.headers,
      data: options.data,
      params: options.params,
    });

    // Check if payment was made (x402-axios adds custom headers/metadata)
    const paymentMade = response.headers["x-payment-receipt"] !== undefined;

    return {
      success: true,
      data: response.data,
      statusCode: response.status,
      headers: response.headers as Record<string, string>,
      paymentMade,
    };
  } catch (error: any) {
    // Check if it's a 402 Payment Required error
    if (error.response?.status === 402) {
      return {
        success: false,
        statusCode: 402,
        error: "Payment required but could not be completed",
        data: error.response?.data,
      };
    }

    // Other errors
    return {
      success: false,
      statusCode: error.response?.status || 500,
      error: error.message || "Unknown error occurred",
      data: error.response?.data,
    };
  }
}

/**
 * Singleton instance for the x402 client (lazy-initialized)
 */
let globalX402Client: AxiosInstance | null = null;

/**
 * Get or create the global x402 client instance
 */
export function getX402Client(): AxiosInstance {
  if (!globalX402Client) {
    const privateKey = process.env.X402_PRIVATE_KEY as Hex | undefined;
    const defaultBaseURL = process.env.X402_DEFAULT_BASE_URL;

    if (!privateKey) {
      throw new Error(
        "X402_PRIVATE_KEY environment variable is required to use x402 payment client"
      );
    }

    globalX402Client = createX402Client({
      privateKey,
      defaultBaseURL,
    });
  }

  return globalX402Client;
}

/**
 * Reset the global client (useful for testing or reconfiguration)
 */
export function resetX402Client(): void {
  globalX402Client = null;
}
