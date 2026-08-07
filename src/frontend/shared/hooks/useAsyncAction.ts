"use client";

import { useCallback, useState } from "react";

type AsyncFn<TArgs extends unknown[], TResult> = (
  ...args: TArgs
) => Promise<TResult>;

/**
 * Shared busy / error wrapper for client mutations.
 * Preserves existing UI — callers still render their own loading & error copy.
 */
export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: AsyncFn<TArgs, TResult>
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      setBusy(true);
      setError(null);
      try {
        return await action(...args);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "요청을 처리하지 못했어요.";
        setError(message);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [action]
  );

  return { run, busy, error, setError, clearError: () => setError(null) };
}
