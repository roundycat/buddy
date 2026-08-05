"use client";

import { useState } from "react";
import { cn } from "@/frontend/shared/lib/utils";

export interface MoodOption {
  id: string;
  label: string;
}

const DEFAULT_MOODS: MoodOption[] = [
  { id: "steady", label: "차분함" },
  { id: "tired", label: "지침" },
  { id: "anxious", label: "불안" },
  { id: "hopeful", label: "희망" },
  { id: "low", label: "가라앉음" },
  { id: "okay", label: "괜찮음" },
];

export interface MoodCheckInProps {
  moods?: MoodOption[];
  onSelect?: (moodId: string) => void;
}

export function MoodCheckIn({ moods = DEFAULT_MOODS, onSelect }: MoodCheckInProps) {
  const [selected, setSelected] = useState<string | null>(null);

  function handleSelect(id: string) {
    setSelected(id);
    onSelect?.(id);
  }

  return (
    <section className="rounded-2xl bg-bedi-card p-8 shadow-soft">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-bedi-slate">기분 체크인</h2>
        <p className="mt-1 text-sm text-bedi-slate/50">
          지금 기분은 어떤가요? 맞는 것을 고르면 됩니다. 정답은 없어요.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {moods.map((mood) => {
          const isActive = selected === mood.id;
          return (
            <button
              key={mood.id}
              type="button"
              onClick={() => handleSelect(mood.id)}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-200",
                isActive
                  ? "border-bedi-rose/50 bg-bedi-rose/15 text-bedi-slate"
                  : "border-bedi-slate/10 bg-bedi-background text-bedi-slate/70 hover:border-bedi-slate/20 hover:bg-white"
              )}
            >
              {mood.label}
            </button>
          );
        })}
      </div>

      {selected && (
        <p className="mt-5 text-sm text-bedi-slate/50">
          기록했어요. 체크인은 당신만의 것으로 남겨둡니다.
        </p>
      )}
    </section>
  );
}
