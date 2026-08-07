"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "@/frontend/shared/lib/utils";
import { useDialogDismiss } from "@/frontend/shared/hooks/useDialogDismiss";
import { WishLeaf } from "@/frontend/features/wish-tree/components/WishLeaf";
import type {
  WishHorizon,
  WishInspiration,
  WishKind,
  WishKindOption,
} from "@/frontend/shared/catalogs";

const HORIZONS: Array<{ id: WishHorizon; label: string }> = [
  { id: "after_discharge", label: "퇴원하면" },
  { id: "hospital", label: "병원에서도" },
  { id: "anytime", label: "언젠가" },
];

interface HangWishSheetProps {
  open: boolean;
  kinds: WishKindOption[];
  busy?: boolean;
  onClose: () => void;
  onReady: (draft: {
    text: string;
    kind: WishKind;
    horizon: WishHorizon;
  }) => void;
}

/**
 * The child writes the wish in their own words.
 * Beddy only offers a few starting lines for a blank page — never fills it in.
 */
export function HangWishSheet({
  open,
  kinds,
  busy,
  onClose,
  onReady,
}: HangWishSheetProps) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<WishKind | null>(null);
  const [horizon, setHorizon] = useState<WishHorizon>("after_discharge");
  const [inspiration, setInspiration] = useState<WishInspiration | null>(null);
  const [loadingIdeas, setLoadingIdeas] = useState(false);

  useDialogDismiss(open, onClose);

  useEffect(() => {
    if (!open) return;
    setText("");
    setKind(null);
    setHorizon("after_discharge");
  }, [open]);

  async function loadIdeas() {
    if (loadingIdeas) return;
    setLoadingIdeas(true);
    try {
      const res = await fetch("/api/wish/inspiration");
      if (!res.ok) return;
      setInspiration((await res.json()) as WishInspiration);
    } catch {
      /* a blank page is fine — the child can still write */
    } finally {
      setLoadingIdeas(false);
    }
  }

  const ready = text.trim().length >= 2;
  const previewKind: WishKind = kind ?? kinds[0]?.id ?? "make";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-bedi-slate/30 px-4 pb-4 pt-12 backdrop-blur-[2px] sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal
            aria-label="마음 적기"
            className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl bg-[#FBFAF7] px-5 pb-6 pt-6 shadow-soft"
            initial={{ y: 56, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ type: "spring", stiffness: 250, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <WishLeaf kind={previewKind} size="md" glow={1} sway />
              <div className="min-w-0">
                <h2 className="text-[17px] font-medium text-bedi-slate">
                  어떤 마음이 남았어요?
                </h2>
                <p className="mt-0.5 text-xs text-bedi-slate/45">
                  적으면 잎이 하나 돋아나요
                </p>
              </div>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              maxLength={80}
              placeholder="예: 친구랑 축구하고 싶어요"
              className="mt-4 w-full resize-none rounded-2xl border border-bedi-slate/10 bg-white px-4 py-3 text-[15px] text-bedi-slate outline-none placeholder:text-bedi-slate/30 focus:border-bedi-sage/40"
            />

            <div className="mt-4">
              <p className="text-[11px] text-bedi-slate/45">어떤 바람인가요?</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {kinds.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setKind(option.id)}
                    className={cn(
                      "min-h-11 rounded-full border px-4 text-xs transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/40",
                      kind === option.id
                        ? "border-bedi-sage/45 bg-bedi-sage/15 text-bedi-slate"
                        : "border-bedi-slate/10 text-bedi-slate/50 hover:border-bedi-slate/25"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-bedi-slate/35">
                {kind
                  ? kinds.find((k) => k.id === kind)?.hint
                  : "고르지 않으면 베디가 어울리는 잎을 골라 줄게요"}
              </p>
            </div>

            <div className="mt-4">
              <p className="text-[11px] text-bedi-slate/45">언제쯤이요?</p>
              <div className="mt-2 flex gap-1.5">
                {HORIZONS.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setHorizon(h.id)}
                    className={cn(
                      "min-h-11 flex-1 rounded-full border px-2 text-xs transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/40",
                      horizon === h.id
                        ? "border-bedi-sage/45 bg-bedi-sage/15 text-bedi-slate"
                        : "border-bedi-slate/10 text-bedi-slate/50 hover:border-bedi-slate/25"
                    )}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-white/85 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[11px] text-bedi-sage">
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                  뭘 적을지 모르겠다면
                </p>
                <button
                  type="button"
                  onClick={() => void loadIdeas()}
                  disabled={loadingIdeas}
                  className="text-[11px] text-bedi-slate/45 underline-offset-2 hover:text-bedi-slate/70 hover:underline disabled:opacity-50"
                >
                  {loadingIdeas
                    ? "생각 중…"
                    : inspiration
                      ? "다시 받기"
                      : "베디에게 물어보기"}
                </button>
              </div>

              {inspiration ? (
                <div className="mt-2.5 flex flex-col gap-1.5">
                  {inspiration.lines.map((line) => (
                    <button
                      key={line.text}
                      type="button"
                      onClick={() => {
                        setText(line.text);
                        setKind(line.kind);
                      }}
                      className="flex min-h-11 items-center gap-2 rounded-xl border border-bedi-slate/8 bg-[#FBFAF7] px-3 py-2.5 text-left text-sm text-bedi-slate/70 transition hover:border-bedi-sage/25 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/40"
                    >
                      <WishLeaf kind={line.kind} size="xs" />
                      <span className="min-w-0 flex-1">{line.text}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-xs leading-relaxed text-bedi-slate/40">
                  베디가 요즘 나눈 이야기를 떠올려서 몇 줄 건네줄게요.
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={!ready || busy}
              onClick={() =>
                onReady({ text: text.trim(), kind: previewKind, horizon })
              }
              className="mt-5 h-12 w-full rounded-2xl bg-bedi-slate text-sm font-medium text-white transition-all duration-150 hover:bg-bedi-slate/90 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/50 focus-visible:ring-offset-2"
            >
              잎 만들기
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 h-11 w-full rounded-2xl text-xs text-bedi-slate/45 transition-colors hover:text-bedi-slate/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/40"
            >
              닫기
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
