"use client";

import { useEffect, useState } from "react";
import { Stethoscope, Syringe, X } from "lucide-react";
import { cn } from "@/frontend/shared/lib/utils";

export interface ScheduleNotifyItem {
  id: string;
  title: string;
  time?: string;
  type?: "exam" | "treatment" | string;
  explanation?: string;
  /** LLM: 이게 뭐예요? */
  whatText?: string;
  /** LLM: 왜 할까요? */
  whyText?: string;
  imageUrl?: string | null;
  imageStatus?: "pending" | "ready" | "failed" | string | null;
  done?: boolean;
}

function typeMeta(type?: string) {
  if (type === "treatment") {
    return {
      label: "치료 시간",
      Icon: Syringe,
      whyTitle: "왜 할까요?",
      fallbackWhy:
        "몸을 조금 더 편하게 도와주려는 시간이에요. 아프게 하려는 게 아니에요.",
    };
  }
  return {
    label: "검사 시간",
    Icon: Stethoscope,
    whyTitle: "왜 할까요?",
    fallbackWhy:
      "지금 몸이 어떤지 알아보기 위한 시간이에요. 긴장되면 베디에게 말해도 괜찮아요.",
  };
}

export function ScheduleItemImage({
  itemId,
  itemTitle,
  initialUrl,
  initialStatus,
}: {
  itemId: string;
  itemTitle: string;
  initialUrl?: string | null;
  initialStatus?: string | null;
}) {
  const [status, setStatus] = useState(initialStatus ?? "pending");
  const [url, setUrl] = useState(initialUrl ?? null);
  const [failedLoad, setFailedLoad] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function ensure() {
      try {
        const res = await fetch(
          `/api/hospital-day/image/${encodeURIComponent(itemId)}`,
          { method: "POST" }
        );
        const data = (await res.json()) as {
          imageStatus?: string;
          imageUrl?: string | null;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setStatus("failed");
          return;
        }
        setStatus(data.imageStatus ?? "failed");
        setUrl(data.imageUrl ?? null);
        setFailedLoad(false);
      } catch {
        if (!cancelled) setStatus("failed");
      }
    }

    // Always ask the server — prompt version bumps regenerate old single-scene art.
    if (initialStatus === "ready" && initialUrl) {
      setStatus("ready");
      setUrl(initialUrl);
    } else {
      setStatus(initialStatus ?? "pending");
    }
    void ensure();
    return () => {
      cancelled = true;
    };
  }, [itemId, initialStatus, initialUrl]);

  if (status === "ready" && url && !failedLoad) {
    return (
      <div className="mt-3 overflow-hidden rounded-xl bg-[#F7F3EA]">
        <p className="px-3 pt-2.5 text-[11px] tracking-wide text-bedi-slate/40">
          그림으로 알아보는 일정
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={`${itemTitle} 4컷 만화`}
          className="aspect-square w-full object-contain p-2"
          onError={() => setFailedLoad(true)}
        />
      </div>
    );
  }

  if (status === "failed" || failedLoad) {
    return (
      <div className="mt-3 flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-bedi-slate/15 bg-bedi-mist/30 px-4 text-center">
        <p className="text-[12px] leading-relaxed text-bedi-slate/45">
          만화는 잠시 쉬고 있어요.
          <br />
          글만 천천히 읽어도 괜찮아요.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 flex aspect-square flex-col items-center justify-center gap-2 rounded-xl bg-[#F7F3EA]">
      <span className="inline-flex gap-1">
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-bedi-softBlueDeep/50" />
        <span className="typing-dot typing-dot-2 h-1.5 w-1.5 rounded-full bg-bedi-softBlueDeep/50" />
        <span className="typing-dot typing-dot-3 h-1.5 w-1.5 rounded-full bg-bedi-softBlueDeep/50" />
      </span>
      <p className="text-[11px] text-bedi-slate/40">4컷 만화를 그리는 중…</p>
    </div>
  );
}

/**
 * Child-facing sheet: what the schedule is + why (gentle, non-clinical).
 */
export function ScheduleNotifySheet({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: ScheduleNotifyItem[];
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-bedi-slate/25 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col",
          "rounded-t-3xl border border-bedi-softBlue/20 bg-bedi-cream shadow-soft sm:rounded-3xl"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="병원 일정 알림"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <div>
            <p className="text-[11px] tracking-wide text-bedi-softBlueDeep/70">
              알림
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-bedi-slate">
              보호자가 알려 준 일정
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-bedi-slate/45"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-6 pt-2">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-bedi-slate/45">
              지금은 알려 준 일정이 없어요
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => {
                const meta = typeMeta(item.type);
                const Icon = meta.Icon;
                return (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-bedi-softBlue/20 bg-white/95 p-4 shadow-softer"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-bedi-mist text-bedi-softBlueDeep">
                        <Icon className="h-5 w-5" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-bedi-slate/40">
                          {meta.label}
                          {item.time ? ` · ${item.time}` : ""}
                          {item.done ? " · 끝났어요" : ""}
                        </p>
                        <p className="mt-0.5 text-[15px] font-semibold text-bedi-slate">
                          {item.title}
                        </p>
                      </div>
                    </div>

                    <ScheduleItemImage
                      itemId={item.id}
                      itemTitle={item.title}
                      initialUrl={item.imageUrl}
                      initialStatus={item.imageStatus}
                    />

                    <div className="mt-3 rounded-xl bg-bedi-mist/60 px-3.5 py-3">
                      <p className="text-[11px] font-semibold tracking-wide text-bedi-softBlueDeep">
                        이게 뭐예요?
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-bedi-slate/70">
                        {item.whatText?.trim() ||
                          (item.type === "treatment"
                            ? `“${item.title.replace(/^치료 시간 ·\s*/, "")}”을(를) 도와주는 시간이에요.`
                            : `“${item.title.replace(/^검사 시간 ·\s*/, "")}”을(를) 살펴보는 시간이에요.`)}
                      </p>
                    </div>

                    <div className="mt-2 rounded-xl bg-bedi-cream px-3.5 py-3">
                      <p className="text-[11px] font-semibold tracking-wide text-bedi-slate/50">
                        {meta.whyTitle}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-bedi-slate/70">
                        {item.whyText?.trim() ||
                          item.explanation?.trim() ||
                          meta.fallbackWhy}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <a
            href="/hospital"
            className="mt-4 flex h-11 items-center justify-center rounded-xl bg-bedi-softBlueDeep text-sm font-medium text-white"
          >
            일정 전체 보기
          </a>
          <p className="mt-2 text-center text-[11px] text-bedi-slate/35">
            무섭지 않아요. 천천히 알아가면 돼요.
          </p>
        </div>
      </div>
    </div>
  );
}
