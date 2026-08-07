"use client";

import { useState } from "react";
import { Images, X } from "lucide-react";
import { ParentCard } from "@/frontend/features/parent/components/ParentUi";
import { useDialogDismiss } from "@/frontend/shared/hooks/useDialogDismiss";
import type { ParentMediaItem } from "@/frontend/shared/types/parent";

export function ChildMediaGalleryCard({ media }: { media: ParentMediaItem[] }) {
  const [active, setActive] = useState<ParentMediaItem | null>(null);
  useDialogDismiss(Boolean(active), () => setActive(null));

  return (
    <>
      <ParentCard className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-slate-800">
            아이 사진 · 그림
          </h3>
          <Images className="h-4 w-4 text-slate-300" strokeWidth={1.75} />
        </div>

        {media.length === 0 ? (
          <p className="text-sm text-slate-400">
            아직 올라온 사진이나 그림이 없어요
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {media.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item)}
                className="group relative aspect-square overflow-hidden rounded-xl border border-slate-100 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.caption}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/55 to-transparent px-1.5 pb-1.5 pt-5 text-left text-[10px] font-medium text-white">
                  {item.title}
                </span>
              </button>
            ))}
          </div>
        )}
      </ParentCard>

      {active ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-5"
          role="dialog"
          aria-modal="true"
          aria-label={active.caption}
          onClick={() => setActive(null)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.imageUrl}
              alt={active.caption}
              className="max-h-[70vh] w-full object-contain bg-slate-50"
            />
            <div className="flex items-start justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {active.title}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{active.caption}</p>
              </div>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setActive(null)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
