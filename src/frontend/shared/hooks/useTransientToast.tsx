"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Short-lived status toast for demo-friendly feedback.
 */
export function useTransientToast(durationMs = 3200) {
  const [toast, setToastState] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToastState(null);
  }, []);

  const setToast = useCallback(
    (message: string | null) => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setToastState(message);
      if (message) {
        timerRef.current = window.setTimeout(() => {
          setToastState(null);
          timerRef.current = null;
        }, durationMs);
      }
    },
    [durationMs]
  );

  useEffect(() => () => clear(), [clear]);

  return { toast, setToast, clearToast: clear };
}

export function TransientToast({
  message,
  className,
}: {
  message: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p
      role="status"
      aria-live="polite"
      className={
        className ??
        "rounded-xl border border-bedi-sage/25 bg-bedi-sage/10 px-3 py-2 text-center text-sm text-bedi-slate/75"
      }
    >
      {message}
    </p>
  );
}
