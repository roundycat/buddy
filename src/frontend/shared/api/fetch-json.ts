"use client";

/**
 * Typed JSON fetch for Bedi API routes.
 * Success payloads are returned as-is; failures throw Error with `{ error }` message.
 */

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

type ErrorBody = { error?: string };

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  fallbackMessage = "요청을 처리하지 못했어요."
): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => ({}))) as T & ErrorBody;

  if (!response.ok) {
    throw new ApiRequestError(
      typeof data.error === "string" && data.error
        ? data.error
        : fallbackMessage,
      response.status
    );
  }

  return data;
}
