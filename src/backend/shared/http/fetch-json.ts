/**
 * Lightweight JSON fetch helper for external HTTP APIs (weather providers, etc.).
 * Distinct from route HttpError / frontend ApiRequestError.
 */
export class ExternalHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string
  ) {
    super(message);
    this.name = "ExternalHttpError";
  }
}

/** @deprecated Prefer ExternalHttpError — kept for any stale imports */
export const HttpError = ExternalHttpError;

export async function fetchExternalJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 30_000, ...requestInit } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...requestInit,
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new ExternalHttpError(
        `HTTP ${response.status} from ${url}`,
        response.status,
        text
      );
    }

    if (!text) return {} as T;
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** @deprecated Prefer fetchExternalJson */
export const fetchJson = fetchExternalJson;
