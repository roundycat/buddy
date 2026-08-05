"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/frontend/shared/lib/utils";
import type {
  WishHorizon,
  WishItem,
  WishTreeResponse,
} from "@/backend/features/wish-tree/wish-tree.types";

interface WishTreeViewProps {
  initial: WishTreeResponse;
}

const HORIZONS: Array<{ id: WishHorizon; label: string }> = [
  { id: "after_discharge", label: "퇴원하면" },
  { id: "hospital", label: "병원에서도" },
  { id: "anytime", label: "언젠가" },
];

function horizonLabel(horizon: WishHorizon): string {
  if (horizon === "hospital") return "병원에서도";
  if (horizon === "after_discharge") return "퇴원하면";
  return "언젠가";
}

export function WishTreeView({ initial }: WishTreeViewProps) {
  const router = useRouter();
  const [tree, setTree] = useState(initial);
  const [text, setText] = useState("");
  const [horizon, setHorizon] = useState<WishHorizon>("after_discharge");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTree(initial);
  }, [initial]);

  async function submit(nextText = text, nextHorizon = horizon) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/wish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nextText, horizon: nextHorizon }),
      });
      const data = (await res.json()) as WishTreeResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "소원을 걸지 못했어요.");
      setTree(data);
      setText("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "소원을 걸지 못했어요.");
    } finally {
      setPending(false);
    }
  }

  async function remove(wish: WishItem) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/wish", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wishId: wish.id }),
      });
      const data = (await res.json()) as WishTreeResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "소원을 내리지 못했어요.");
      setTree(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "소원을 내리지 못했어요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-bedi-slate/8 bg-white/85 px-5 py-4 shadow-softer">
        <p className="text-[11px] tracking-wide text-bedi-sage">{tree.title}</p>
        <p className="mt-2 text-sm leading-relaxed text-bedi-slate/70">
          {tree.companionNote}
        </p>
        <p className="mt-2 text-xs text-bedi-slate/40">
          치료가 아니라, 희망을 기억하는 나무예요.
        </p>
      </div>

      {/* Visual tree plot */}
      <div
        className="relative overflow-hidden rounded-3xl border border-emerald-200/40 px-4 pb-6 pt-8 shadow-softer"
        style={{
          background:
            "linear-gradient(180deg, #E7F2E4 0%, #F4F8F2 55%, #E8EFE4 100%)",
        }}
      >
        <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-white/50 text-3xl shadow-softer">
          🌳
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {tree.wishes.length === 0 ? (
            <p className="py-4 text-center text-xs text-bedi-slate/40">
              아직 걸린 소원이 없어요. 아래에서 걸어 보세요.
            </p>
          ) : (
            tree.wishes.map((wish, i) => (
              <button
                key={wish.id}
                type="button"
                onClick={() => void remove(wish)}
                title="눌러서 내리기"
                className="garden-flower-rise max-w-[46%] rounded-2xl border border-white/70 bg-white/90 px-3 py-2 text-left shadow-softer transition hover:border-bedi-rose/30"
                style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
              >
                <span className="mr-1">{wish.emoji}</span>
                <span className="text-xs leading-snug text-bedi-slate/75">
                  {wish.text}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-bedi-slate/8 bg-white/90 px-5 py-5 shadow-softer">
        <h2 className="text-[15px] font-medium text-bedi-slate">소원 걸기</h2>
        <p className="mt-1 text-xs text-bedi-slate/40">
          짧게 적어도 괜찮아요
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {HORIZONS.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setHorizon(h.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] transition-colors",
                horizon === h.id
                  ? "border-bedi-sage/40 bg-bedi-sage/15 text-bedi-slate"
                  : "border-bedi-slate/10 text-bedi-slate/45 hover:border-bedi-slate/20"
              )}
            >
              {h.label}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={80}
          placeholder="예: 친구랑 축구하고 싶어요"
          className="mt-3 w-full resize-none rounded-xl border border-bedi-slate/10 bg-[#FBFAF7] px-3 py-2.5 text-sm text-bedi-slate outline-none placeholder:text-bedi-slate/30 focus:border-bedi-sage/35"
        />

        <button
          type="button"
          disabled={pending || text.trim().length < 2}
          onClick={() => void submit()}
          className="mt-3 h-10 w-full rounded-xl bg-bedi-slate text-sm font-medium text-white transition-colors hover:bg-bedi-slate/90 disabled:opacity-40"
        >
          {pending ? "거는 중…" : "나무에 걸기"}
        </button>

        <div className="mt-4">
          <p className="text-[11px] text-bedi-slate/40">이렇게 시작해도 좋아요</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {tree.suggestions.map((s) => (
              <button
                key={s.text}
                type="button"
                disabled={pending}
                onClick={() => void submit(s.text, s.horizon)}
                className="rounded-xl border border-bedi-slate/8 bg-[#FBFAF7] px-3 py-2.5 text-left text-sm text-bedi-slate/70 transition hover:border-bedi-sage/25 hover:bg-white disabled:opacity-50"
              >
                <span className="mr-1.5">{s.emoji}</span>
                {s.text}
                <span className="ml-2 text-[10px] text-bedi-slate/30">
                  {horizonLabel(s.horizon)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-lg bg-bedi-rose/15 px-3 py-2 text-sm text-bedi-slate/80">
          {error}
        </p>
      ) : null}

      <p className="text-center text-xs text-bedi-slate/40">
        퇴원할 때{" "}
        <Link href="/storybook" className="text-bedi-sage hover:underline">
          성장 스토리북
        </Link>
        마지막 장에 모아요
      </p>
    </div>
  );
}
