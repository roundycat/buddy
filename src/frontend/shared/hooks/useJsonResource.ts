"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/frontend/shared/api/fetch-json";

/**
 * Load a JSON resource on mount (and when deps change).
 */
export function useJsonResource<T>(
  url: string | null,
  options?: {
    fallbackMessage?: string;
    /** Extra dependency keys that force a reload */
    deps?: unknown[];
  }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState<string | null>(null);
  const depsKey = JSON.stringify(options?.deps ?? []);

  const reload = useCallback(async () => {
    if (!url) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await fetchJson<T>(
        url,
        undefined,
        options?.fallbackMessage
      );
      setData(next);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : options?.fallbackMessage ?? "불러오지 못했어요."
      );
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depsKey captures options.deps
  }, [url, options?.fallbackMessage, depsKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, setData, loading, error, setError, reload };
}
