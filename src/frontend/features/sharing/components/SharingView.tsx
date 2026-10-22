"use client";

import { useState, type ReactNode } from "react";
import {
  BookHeart,
  CalendarDays,
  Compass,
  Flower2,
  Images,
  LifeBuoy,
  Lock,
  MessageCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { SoftErrorState } from "@/frontend/shared/components/ChildUi";
import { patchShareChoice } from "@/frontend/features/sharing/lib/sharing-api";
import type {
  ShareCategory,
  ShareChoice,
  ShareChoices,
} from "@/backend/features/sharing/sharing.types";
import { cn } from "@/frontend/shared/lib/utils";

const ALWAYS: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: LifeBuoy,
    title: "안전에 관한 최소 알림",
    body: "마음이 많이 위험해 보일 때, ‘도움이 필요해요’라는 사실만 전해져. 무슨 이야기를 했는지는 전하지 않아.",
  },
  {
    icon: CalendarDays,
    title: "보호자가 넣은 병원 일정",
    body: "보호자가 직접 적어 준 일정이라, 보호자도 함께 볼 수 있어.",
  },
];

const NEVER: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: MessageCircle,
    title: "베디와 나눈 대화 원문",
    body: "너와 베디가 주고받은 말은 그대로 보여 주지 않아.",
  },
  {
    icon: BookHeart,
    title: "비밀 일기 원문",
    body: "일기에 쓴 글은 너만 볼 수 있어.",
  },
];

const CHOOSABLE: Array<{
  id: ShareCategory;
  icon: LucideIcon;
  title: string;
  body: string;
}> = [
  {
    id: "mood",
    icon: Flower2,
    title: "오늘의 마음",
    body: "감정 정원에 심은 꽃과 일주일 마음 흐름",
  },
  {
    id: "adventures",
    icon: Compass,
    title: "모험 기록",
    body: "오늘 해낸 작은 모험",
  },
  {
    id: "memoryHighlights",
    icon: Sparkles,
    title: "기억 하이라이트",
    body: "하루 이야기, 소원 개수 같은 짧은 요약",
  },
  {
    id: "media",
    icon: Images,
    title: "사진·그림",
    body: "사진첩 사진과 그림 일기 그림 (일기 글은 빼고)",
  },
];

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-bedi-slate/[0.08] bg-white/85 px-5 py-5 shadow-softer">
      <h2 className="text-[15px] font-semibold text-bedi-slate">{title}</h2>
      {hint ? (
        <p className="mt-1 text-xs leading-relaxed text-bedi-slate/45">{hint}</p>
      ) : null}
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function InfoRow({
  icon: Icon,
  title,
  body,
  locked,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  locked?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl",
          locked ? "bg-bedi-rose/10 text-bedi-rose" : "bg-bedi-sage/15 text-bedi-sage"
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" strokeWidth={1.6} />
        {locked ? (
          <Lock className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-white p-0.5 text-bedi-rose" />
        ) : null}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-bedi-slate">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-bedi-slate/50">{body}</p>
      </div>
    </div>
  );
}

/**
 * 보호자와 나누기 — the child decides which summaries guardians may see.
 */
export function SharingView({ initialChoices }: { initialChoices: ShareChoices }) {
  const [choices, setChoices] = useState<ShareChoices>(initialChoices);
  const [saving, setSaving] = useState<ShareCategory | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(category: ShareCategory) {
    if (saving) return;
    const previous = choices[category];
    const next: ShareChoice = previous === "share" ? "private" : "share";
    setChoices((c) => ({ ...c, [category]: next }));
    setSaving(category);
    setError(null);
    setSaved(null);
    try {
      const updated = await patchShareChoice(category, next);
      setChoices(updated);
      setSaved(next === "share" ? "보호자와 나눌게." : "나만 볼게.");
      window.setTimeout(() => setSaved(null), 2000);
    } catch (err) {
      setChoices((c) => ({ ...c, [category]: previous }));
      setError(
        err instanceof Error ? err.message : "지금은 바꾸지 못했어. 다시 해 볼까?"
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <Section
        title="내가 고를 수 있는 것"
        hint="켜 두면 보호자 화면에 짧은 요약으로 보여. 끄면 ‘아직 나누지 않았어요 🔒’라고만 보여."
      >
        {CHOOSABLE.map((item) => {
          const on = choices[item.id] === "share";
          const Icon = item.icon;
          return (
            <div key={item.id} className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-bedi-cream text-bedi-slate/60"
                aria-hidden
              >
                <Icon className="h-4 w-4" strokeWidth={1.6} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-bedi-slate">{item.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-bedi-slate/50">
                  {item.body}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${item.title} 보호자와 나누기`}
                disabled={saving !== null}
                onClick={() => void toggle(item.id)}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-2 rounded-full px-1.5 py-1.5 transition-colors disabled:opacity-60",
                  on ? "bg-bedi-sage/20" : "bg-bedi-slate/[0.07]"
                )}
              >
                <span
                  className={cn(
                    "relative inline-flex h-6 w-10 items-center rounded-full p-0.5 transition-colors",
                    on ? "bg-bedi-sage" : "bg-bedi-slate/20"
                  )}
                  aria-hidden
                >
                  <span
                    className={cn(
                      "block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                      on ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </span>
                <span className="pr-1.5 text-[11px] font-medium text-bedi-slate/70">
                  {on ? "나누기" : "나만 보기"}
                </span>
              </button>
            </div>
          );
        })}
        <p className="min-h-[1rem] text-right text-[11px] text-bedi-sage" aria-live="polite">
          {saved ?? ""}
        </p>
        {error ? <SoftErrorState message={error} /> : null}
      </Section>

      <Section title="보호자가 언제나 볼 수 있는 것">
        {ALWAYS.map((item) => (
          <InfoRow key={item.title} {...item} />
        ))}
      </Section>

      <Section
        title="보호자가 절대 볼 수 없는 것"
        hint="이건 아무도 바꿀 수 없어. 보호자도, 베디도."
      >
        {NEVER.map((item) => (
          <InfoRow key={item.title} {...item} locked />
        ))}
      </Section>

      <p className="px-2 text-center text-xs leading-relaxed text-bedi-slate/40">
        언제든 다시 바꿀 수 있어. 마음이 바뀌면 이 화면으로 돌아오면 돼.
      </p>
    </div>
  );
}
