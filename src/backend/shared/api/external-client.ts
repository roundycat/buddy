/**
 * External API connection stubs for future AWS / hospital integrations.
 * Keep secrets in env — never import this from frontend.
 */

import { env } from "@/backend/shared/config/env";
import { fetchJson } from "@/backend/shared/http/fetch-json";

export interface ExternalApiConfig {
  baseUrl: string;
  apiKey?: string;
}

/**
 * Generic authenticated JSON client for third-party REST APIs.
 * Example future uses: hospital EMR bridge, notification service, analytics.
 */
export function createApiClient(config: ExternalApiConfig) {
  const headers = (extra?: HeadersInit): HeadersInit => ({
    "Content-Type": "application/json",
    ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    ...extra,
  });

  return {
    get<T>(path: string) {
      return fetchJson<T>(`${config.baseUrl}${path}`, {
        method: "GET",
        headers: headers(),
      });
    },
    post<T>(path: string, body: unknown) {
      return fetchJson<T>(`${config.baseUrl}${path}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      });
    },
  };
}

/**
 * Placeholder for a future DynamoDB / AppSync data API endpoint.
 * Point DATA_API_BASE_URL at API Gateway when migrating off Next route handlers.
 */
export function getDataApiClient() {
  const baseUrl = process.env.DATA_API_BASE_URL?.trim();
  if (!baseUrl) return null;

  return createApiClient({
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey: process.env.DATA_API_KEY,
  });
}

export function getAppPublicUrl() {
  return env.appUrl;
}
