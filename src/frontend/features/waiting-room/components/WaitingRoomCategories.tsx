"use client";

import Link from "next/link";
import {
  BookHeart,
  CalendarDays,
  Compass,
  Flower2,
  HeartHandshake,
  Mail,
  Palette,
  TreeDeciduous,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/frontend/shared/lib/utils";

interface CategoryItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  badge?: number;
  accent?: boolean;
}

/** Left rail — child-led daily grow / play */
const leftCategories: CategoryItem[] = [
  {
    href: "/adventure",
    label: "오늘의 작은 모험 (Today's Adventure)",
    short: "모험",
    icon: Compass,
  },
  {
    href: "/garden",
    label: "감정 정원 (Emotion Garden)",
    short: "정원",
    icon: Flower2,
  },
  {
    href: "/wish",
    label: "마음 나무 (Wish Tree)",
    short: "소원",
    icon: TreeDeciduous,
  },
  {
    href: "/diary",
    label: "그림일기 — 그림·사진으로 남기기",
    short: "일기",
    icon: Palette,
  },
];

function CategoryRail({
  items,
  side,
  ariaLabel,
}: {
  items: CategoryItem[];
  side: "left" | "right";
  ariaLabel: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={
        side === "left"
          ? "absolute left-0 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-2.5"
          : "absolute right-0 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-2.5"
      }
    >
      {items.map((item) => {
        const Icon = item.icon;
        const inner = (
          <>
            <span
              className={cn(
                "relative flex h-11 w-11 items-center justify-center rounded-2xl border bg-white/90 shadow-softer transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-soft",
                item.accent
                  ? "border-bedi-softBlue/40 text-bedi-softBlueDeep"
                  : "border-bedi-slate/10 text-bedi-slate/55 group-hover:border-bedi-sage/25 group-hover:text-bedi-sage"
              )}
            >
              <Icon className="h-[15px] w-[15px]" strokeWidth={1.5} />
              {item.badge && item.badge > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-bedi-softBlueDeep px-1 text-[9px] font-bold text-white">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              ) : null}
            </span>
            <span
              className={cn(
                "text-[11px] tracking-wide transition-colors",
                item.accent
                  ? "text-bedi-softBlueDeep/80"
                  : "text-bedi-slate/55 group-hover:text-bedi-slate/75"
              )}
            >
              {item.short}
            </span>
          </>
        );

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            title={item.label}
            className="group flex flex-col items-center gap-0.5"
          >
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Waiting-room category rails — activities left, memory + main destinations right.
 * Replaces the child bottom nav (오늘 / 기억 / 성장).
 */
export function WaitingRoomCategories({
  scheduleCount = 0,
}: {
  /** Today's pending schedules — highlights the rail entry. */
  scheduleCount?: number;
}) {
  const rightCategories: CategoryItem[] = [
    {
      href: "/hospital",
      label: "병원 일정",
      short: "일정",
      icon: CalendarDays,
      badge: scheduleCount > 0 ? scheduleCount : undefined,
      accent: scheduleCount > 0,
    },
    {
      href: "/memory",
      label: "기억",
      short: "기억",
      icon: BookHeart,
    },
    {
      href: "/growth",
      label: "성장",
      short: "성장",
      icon: HeartHandshake,
    },
    {
      href: "/post",
      label: "기억 우체국 (Memory Post)",
      short: "우체국",
      icon: Mail,
    },
  ];

  return (
    <>
      <CategoryRail
        items={leftCategories}
        side="left"
        ariaLabel="오늘의 활동"
      />
      <CategoryRail
        items={rightCategories}
        side="right"
        ariaLabel="기억과 안내"
      />
    </>
  );
}
