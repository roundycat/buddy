"use client";

import { useEffect, useState } from "react";
import { HeartHandshake } from "lucide-react";
import {
  answerConcern,
  fetchPendingConcern,
  type ChildConcernRequest,
} from "@/frontend/features/sharing/lib/sharing-api";
import { cn } from "@/frontend/shared/lib/utils";

/**
 * Before a guardian hears "요즘 마음이 힘들어 보여요", Beddy asks the child.
 * Renders nothing unless a question is waiting.
 */
export function ConcernConsentCard({ className }: { className?: string }) {
  const [request, setRequest] = useState<ChildConcernRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPendingConcern()
      .then((next) => {
        if (alive) setRequest(next);
      })
      .catch(() => {
        /* quiet — the card simply does not appear */
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!reply) return;
    const timer = window.setTimeout(() => {
      setRequest(null);
      setReply(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [reply]);

  if (!request) return null;

  async function answer(approve: boolean) {
    if (!request || busy) return;
    setBusy(true);
    setError(null);
    try {
      await answerConcern(request.id, approve);
      setReply(
        approve
          ? "알겠어. 보호자에게 살짝 알려 둘게. 무슨 이야기를 했는지는 비밀로 지킬게."
          : "알겠어, 말하지 않을게. 마음이 바뀌면 언제든 말해 줘."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "지금은 대답을 저장하지 못했어.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={cn(
        "relative z-10 mx-auto w-full max-w-sm rounded-3xl border border-bedi-sage/25 bg-white/95 px-4 py-4 text-left shadow-soft",
        className
      )}
      aria-live="polite"
    >
      {reply ? (
        <p className="text-sm leading-relaxed text-bedi-slate/75">{reply}</p>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bedi-sage/15 text-bedi-sage"
              aria-hidden
            >
              <HeartHandshake className="h-4 w-4" strokeWidth={1.6} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] tracking-wide text-bedi-slate/40">
                베디가 조심스럽게 물어볼게
              </p>
              <p className="mt-1 text-[15px] font-medium leading-snug text-bedi-slate">
                요즘 마음이 힘들다는 것만 보호자에게 알려도 될까?
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-bedi-slate/50">
                무슨 이야기를 했는지는 알려 주지 않아. 보호자에게는 “
                {request.summary}”라고만 전해져.
              </p>
            </div>
          </div>
          {error ? (
            <p className="mt-2 text-xs text-bedi-rose" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer(true)}
              className="min-h-11 rounded-xl bg-bedi-slate text-sm font-medium text-white disabled:opacity-50"
            >
              알려도 돼
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer(false)}
              className="min-h-11 rounded-xl border border-bedi-slate/15 bg-white text-sm font-medium text-bedi-slate/75 disabled:opacity-50"
            >
              아직은 싫어
            </button>
          </div>
        </>
      )}
    </section>
  );
}
