"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Guardian enters the 6-char code shown on the child's waiting room.
 */
export function GuardianLinkForm({
  childNameHint,
}: {
  childNameHint?: string | null;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/guardian/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "연결에 실패했어요.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "연결에 실패했어요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-bedi-sage/25 bg-gradient-to-br from-bedi-sage/10 to-white px-5 py-6 shadow-softer">
      <h2 className="text-[15px] font-medium text-bedi-slate">
        아이와 연결하기
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-bedi-slate/55">
        아이 화면 설정(⚙) →{" "}
        <span className="text-bedi-slate/75">보호자와 연결하기</span>에서 받은
        코드를 입력해 주세요.
        {childNameHint ? ` (${childNameHint})` : null}
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-3">
        <label className="block">
          <span className="sr-only">초대 코드</span>
          <input
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
            }
            maxLength={8}
            autoComplete="one-time-code"
            inputMode="text"
            placeholder="예: K7M2PQ"
            aria-invalid={Boolean(error)}
            className="w-full rounded-2xl border border-bedi-slate/10 bg-white px-4 py-3 text-center font-display text-2xl tracking-[0.35em] text-bedi-slate outline-none placeholder:tracking-normal placeholder:text-bedi-slate/25 focus:border-bedi-sage/40"
          />
        </label>

        {error ? (
          <p className="text-center text-xs text-bedi-rose" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || code.length < 4}
          className="w-full rounded-2xl bg-bedi-slate px-4 py-3 text-sm font-medium text-white transition hover:bg-bedi-slate/90 disabled:opacity-40"
        >
          {pending ? "연결하는 중…" : "연결하기"}
        </button>
      </form>
    </section>
  );
}
