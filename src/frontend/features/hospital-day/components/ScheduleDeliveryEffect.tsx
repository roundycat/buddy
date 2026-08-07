"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/frontend/shared/lib/utils";

export interface ScheduleDeliveryItem {
  id: string;
  title: string;
  time?: string;
  type?: string;
  notifyText?: string;
}

/**
 * Soft arrival toast when parent schedule first reaches the child.
 */
export function ScheduleDeliveryEffect({
  deliveries,
  onOpenNotifications,
}: {
  deliveries: ScheduleDeliveryItem[];
  onOpenNotifications?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ScheduleDeliveryItem[]>([]);

  useEffect(() => {
    if (deliveries.length === 0) return;
    setItems(deliveries);
    setOpen(true);
    const t = window.setTimeout(() => setOpen(false), 5200);
    return () => window.clearTimeout(t);
  }, [deliveries]);

  if (!open || items.length === 0) return null;

  const first = items[0]!;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))]"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl",
          "border border-bedi-softBlue/30 bg-white/95 p-4 shadow-soft backdrop-blur-md",
          "transition-all duration-500"
        )}
        style={{ animation: "bedi-delivery-in 0.45s ease-out" }}
      >
        <div className="flex items-start gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bedi-mist text-bedi-softBlueDeep">
            <Sparkles className="h-5 w-5 animate-pulse" strokeWidth={2} />
            <span className="absolute inset-0 animate-ping rounded-full bg-bedi-softBlue/20" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-wide text-bedi-softBlueDeep">
              보호자에게서 도착했어요
            </p>
            <p className="mt-1 text-sm font-medium leading-snug text-bedi-slate">
              {first.notifyText?.trim() ||
                `${first.time ? `${first.time} · ` : ""}${first.title}`}
            </p>
            {items.length > 1 ? (
              <p className="mt-1 text-[12px] text-bedi-slate/45">
                외 {items.length - 1}개 일정도 함께 도착했어요
              </p>
            ) : (
              <p className="mt-1 text-[12px] text-bedi-slate/45">
                {first.notifyText?.trim()
                  ? first.time
                    ? `${first.time} · ${first.title}`
                    : first.title
                  : "“오늘”에서 자세히 볼 수 있어요"}
              </p>
            )}
          </div>
          <button
            type="button"
            className="pointer-events-auto text-[11px] text-bedi-slate/40"
            onClick={() => setOpen(false)}
          >
            닫기
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            if (onOpenNotifications) {
              onOpenNotifications();
            } else {
              window.location.href = "/?notifications=1";
            }
          }}
          className="mt-3 flex h-10 items-center justify-center rounded-xl bg-bedi-softBlueDeep text-sm font-medium text-white"
        >
          알림에서 확인하기
        </button>
      </div>
    </div>
  );
}
