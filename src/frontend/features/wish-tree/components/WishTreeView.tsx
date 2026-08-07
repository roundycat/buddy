"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { cn } from "@/frontend/shared/lib/utils";
import { fetchJson } from "@/frontend/shared/api/fetch-json";
import { useTransientToast } from "@/frontend/shared/hooks/useTransientToast";
import { useSoftMotion } from "@/frontend/shared/lib/motion";
import { SoftErrorState } from "@/frontend/shared/components/ChildUi";
import { WishLeaf } from "@/frontend/features/wish-tree/components/WishLeaf";
import { WishTreeCanvas } from "@/frontend/features/wish-tree/components/WishTreeCanvas";
import { HangWishSheet } from "@/frontend/features/wish-tree/components/HangWishSheet";
import { LeafMemoryCard } from "@/frontend/features/wish-tree/components/LeafMemoryCard";
import type {
  LeafMemoryCard as LeafMemoryCardData,
  WishHorizon,
  WishKind,
  WishLeafView,
  WishTreeResponse,
} from "@/frontend/shared/catalogs";

interface WishTreeViewProps {
  initial: WishTreeResponse;
}

interface LeafDraft {
  text: string;
  kind: WishKind;
  horizon: WishHorizon;
}

/** framer-motion's PanInfo point can lag behind the pointer, so prefer the event. */
function clientPointOf(
  event: MouseEvent | TouchEvent | PointerEvent,
  info: PanInfo
): { x: number; y: number } {
  if ("clientX" in event && typeof event.clientX === "number") {
    return { x: event.clientX, y: event.clientY };
  }
  const touch = "changedTouches" in event ? event.changedTouches[0] : null;
  if (touch) return { x: touch.clientX, y: touch.clientY };
  return info.point;
}

export function WishTreeView({ initial }: WishTreeViewProps) {
  const router = useRouter();
  const canopyRef = useRef<HTMLDivElement>(null);

  const [tree, setTree] = useState(initial);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<LeafDraft | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast: flash, setToast: setFlash } = useTransientToast(3600);
  const [memory, setMemory] = useState<LeafMemoryCardData | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const { stagger, item } = useSoftMotion();

  useEffect(() => {
    setTree(initial);
  }, [initial]);

  function isOverCanopy(point: { x: number; y: number }): boolean {
    const rect = canopyRef.current?.getBoundingClientRect();
    if (!rect) return false;
    // Generous target: children aim roughly, not precisely.
    const pad = 28;
    return (
      point.x >= rect.left - pad &&
      point.x <= rect.right + pad &&
      point.y >= rect.top - pad &&
      point.y <= rect.bottom + pad
    );
  }

  async function hang(leaf: LeafDraft) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await fetchJson<WishTreeResponse>(
        "/api/wish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(leaf),
        },
        "잎을 걸지 못했어요."
      );

      const grew = data.tree.stage !== tree.tree.stage;
      setTree(data);
      setDraft(null);
      setFlash(
        grew
          ? `나무가 자랐어요 · ${data.tree.stageLabel}`
          : "잎이 나무에 걸렸어요"
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "잎을 걸지 못했어요.");
    } finally {
      setBusy(false);
      setDropActive(false);
    }
  }

  async function openMemory(leaf: WishLeafView) {
    setMemoryLoading(true);
    setMemory(null);
    try {
      const data = await fetchJson<LeafMemoryCardData>(
        `/api/wish/leaf/${leaf.id}`,
        undefined,
        "기억을 불러오지 못했어요."
      );
      setMemory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "기억을 불러오지 못했어요.");
    } finally {
      setMemoryLoading(false);
    }
  }

  async function removeLeaf(leafId: string) {
    setMemory(null);
    setBusy(true);
    setError(null);
    try {
      const data = await fetchJson<WishTreeResponse>(
        "/api/wish",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wishId: leafId }),
        },
        "잎을 내리지 못했어요."
      );
      setTree(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "잎을 내리지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  const { tree: meta } = tree;

  return (
    <motion.div className="space-y-5" {...stagger}>
      <motion.div
        className="rounded-2xl border border-bedi-slate/8 bg-white/85 px-5 py-4 shadow-softer"
        {...item}
      >
        <p className="text-[11px] tracking-wide text-bedi-sage">
          {meta.stageLabel}
          {meta.leafCount > 0 ? ` · 잎 ${meta.leafCount}장` : ""}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-bedi-slate/70">
          {tree.companionNote}
        </p>
        {meta.nextStageIn !== null && meta.leafCount > 0 ? (
          <p className="mt-2 text-xs text-bedi-slate/35">
            잎 {meta.nextStageIn}장이 더 걸리면 나무가 한 뼘 자라요
          </p>
        ) : null}
      </motion.div>

      <motion.div {...item}>
        <WishTreeCanvas
          stage={meta.stage}
          season={meta.season}
          sky={tree.sky}
          leaves={tree.leaves}
          canopyRef={canopyRef}
          dropActive={dropActive}
          onSelectLeaf={(leaf) => void openMemory(leaf)}
        />
      </motion.div>

      <AnimatePresence mode="wait">
        {draft ? (
          <motion.div
            key="draft"
            className="rounded-2xl border border-bedi-sage/25 bg-bedi-sage/8 px-5 py-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <p className="text-center text-xs text-bedi-slate/55">
              잎을 나무 위로 끌어올려 주세요
            </p>
            <div className="mt-3 flex justify-center">
              <motion.div
                drag
                dragSnapToOrigin
                dragElastic={0.18}
                whileDrag={{ scale: 1.18, zIndex: 40 }}
                onDrag={(event, info) =>
                  setDropActive(isOverCanopy(clientPointOf(event, info)))
                }
                onDragEnd={(event, info) => {
                  const over = isOverCanopy(clientPointOf(event, info));
                  setDropActive(false);
                  if (over) void hang(draft);
                }}
                className="cursor-grab touch-none active:cursor-grabbing"
              >
                <WishLeaf kind={draft.kind} size="lg" glow={1} sway />
              </motion.div>
            </div>
            <p className="mt-2 text-center text-sm text-bedi-slate/70">
              {draft.text}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="press-soft h-11 flex-1 rounded-2xl border border-bedi-slate/12 text-xs text-bedi-slate/50"
              >
                다시 적기
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void hang(draft)}
                className="press-soft h-11 flex-1 rounded-2xl bg-bedi-slate text-sm font-medium text-white disabled:opacity-40"
              >
                {busy ? "거는 중…" : "바로 걸기"}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="open"
            type="button"
            onClick={() => setSheetOpen(true)}
            className="h-14 w-full rounded-2xl bg-bedi-slate text-sm font-medium text-white transition-colors hover:bg-bedi-slate/90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            whileTap={{ scale: 0.98 }}
          >
            마음 적고 잎 만들기
          </motion.button>
        )}
      </AnimatePresence>

      {flash ? (
        <p className="rounded-2xl bg-bedi-sage/12 px-4 py-2.5 text-center text-xs text-bedi-slate/75">
          {flash}
        </p>
      ) : null}

      {error ? <SoftErrorState message={error} /> : null}

      {tree.leaves.length === 0 ? (
        <motion.section
          className="rounded-2xl border border-bedi-slate/8 bg-white/90 px-5 py-4 shadow-softer"
          {...item}
        >
          <p className="text-[15px] font-medium text-bedi-slate">
            아직 가지가 비어 있어요
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-bedi-slate/50">
            마음을 한 줄 적으면 잎이 하나 돋아나요. 이렇게 시작해도 좋아요.
          </p>
          <div className="mt-3.5 flex flex-col gap-1.5">
            {tree.suggestions.map((s) => (
              <button
                key={s.text}
                type="button"
                disabled={busy}
                onClick={() =>
                  setDraft({
                    text: s.text,
                    kind: "make",
                    horizon: s.horizon,
                  })
                }
                className={cn(
                  "press-soft min-h-11 rounded-xl border border-bedi-slate/8 bg-[#FBFAF7] px-3 py-3 text-left text-sm text-bedi-slate/70",
                  "hover:border-bedi-sage/25 hover:bg-white disabled:opacity-50"
                )}
              >
                <span className="mr-1.5">{s.emoji}</span>
                {s.text}
              </button>
            ))}
          </div>
        </motion.section>
      ) : null}

      <HangWishSheet
        open={sheetOpen}
        kinds={tree.kinds}
        busy={busy}
        onClose={() => setSheetOpen(false)}
        onReady={(next) => {
          setSheetOpen(false);
          setDraft(next);
        }}
      />

      <LeafMemoryCard
        card={memory}
        loading={memoryLoading}
        onClose={() => setMemory(null)}
        onRemove={(leafId) => void removeLeaf(leafId)}
      />
    </motion.div>
  );
}
