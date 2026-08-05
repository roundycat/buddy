"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookMarked } from "lucide-react";
import { cn } from "@/frontend/shared/lib/utils";
import { GrowingFlower } from "@/frontend/features/emotion-garden/components/GrowingFlower";
import { completeAdventureQuest } from "@/frontend/features/adventure-quest/lib/complete-adventure-quest";
import type {
  EmotionGardenResponse,
  GardenFlower,
  MoodId,
} from "@/backend/features/emotion-garden/emotion-garden.types";

interface EmotionGardenViewProps {
  initial: EmotionGardenResponse;
}

const moodAccent: Record<MoodId, string> = {
  happy: "from-amber-100/80 to-bedi-sage/20",
  sad: "from-sky-100/80 to-indigo-100/40",
  sleepy: "from-violet-100/70 to-bedi-slate/10",
  angry: "from-orange-100/70 to-bedi-rose/20",
  love: "from-bedi-rose/30 to-pink-100/50",
};

export function EmotionGardenView({ initial }: EmotionGardenViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const questId = searchParams.get("quest");
  const [garden, setGarden] = useState(initial);
  const [pendingMood, setPendingMood] = useState<MoodId | null>(null);
  const [justBloomed, setJustBloomed] = useState<GardenFlower | null>(null);
  const [growingId, setGrowingId] = useState<string | null>(null);
  const [sealing, setSealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questHint, setQuestHint] = useState<string | null>(
    questId ? "모험 미션: 오늘의 기분을 심으면 별조각을 받을 수 있어요." : null
  );

  useEffect(() => {
    setGarden(initial);
  }, [initial]);

  useEffect(() => {
    if (!growingId) return;
    const t = window.setTimeout(() => setGrowingId(null), 2200);
    return () => window.clearTimeout(t);
  }, [growingId]);

  async function plant(mood: MoodId) {
    if (!garden.canPlantToday || pendingMood) return;
    setPendingMood(mood);
    setError(null);
    setJustBloomed(null);

    const moodMeta = garden.moods.find((m) => m.id === mood);

    try {
      const res = await fetch("/api/garden/plant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood }),
      });
      const data = (await res.json()) as EmotionGardenResponse & {
        bloomed?: GardenFlower;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "꽃을 피우지 못했어요.");

      setGarden(data);
      if (data.bloomed) {
        setJustBloomed(data.bloomed);
        setGrowingId(data.bloomed.id);
      } else if (moodMeta) {
        setGrowingId(`temp-${mood}`);
      }
      if (questId) {
        const ok = await completeAdventureQuest(questId, `정원 · ${mood}`);
        if (ok) {
          setQuestHint("미션 완료! 모험으로 돌아가 별조각을 받아 보세요.");
        }
      }
      window.dispatchEvent(new Event("bedi:wallet"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "꽃을 피우지 못했어요.");
    } finally {
      setPendingMood(null);
    }
  }

  async function sealStorybook() {
    if (sealing || garden.storybook.sealed) return;
    setSealing(true);
    setError(null);
    try {
      const res = await fetch("/api/garden/storybook", { method: "POST" });
      const data = (await res.json()) as EmotionGardenResponse & {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "스토리북에 넣지 못했어요.");
      setGarden(data);
      setJustBloomed(null);
      setGrowingId(null);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "스토리북에 넣지 못했어요."
      );
    } finally {
      setSealing(false);
    }
  }

  const emptySlots = Math.max(0, garden.plotSlots - garden.flowers.length);
  const plantingMood = pendingMood
    ? garden.moods.find((m) => m.id === pendingMood)
    : null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-bedi-slate/8 bg-white/80 px-5 py-4 shadow-softer">
        <p className="text-[11px] tracking-wide text-bedi-sage">
          {garden.title}
        </p>
        <p className="mt-1 text-xs text-bedi-slate/40">
          입원 {garden.dayCount}일째 · 꽃 {garden.flowers.length}송이
        </p>
        <p className="mt-2 text-sm leading-relaxed text-bedi-slate/75">
          {garden.companionNote}
        </p>
        {questHint ? (
          <p className="mt-3 rounded-xl bg-bedi-sage/10 px-3 py-2 text-xs leading-relaxed text-bedi-slate/70">
            {questHint}{" "}
            {questId ? (
              <Link
                href="/adventure"
                className="font-medium text-bedi-sage underline-offset-2 hover:underline"
              >
                모험으로
              </Link>
            ) : null}
          </p>
        ) : null}
      </div>

      <section className="rounded-2xl border border-bedi-slate/8 bg-white/90 px-5 py-5 shadow-softer">
        <h2 className="text-[15px] font-medium text-bedi-slate">오늘 기분</h2>
        <p className="mt-1 text-xs text-bedi-slate/40">
          {garden.canPlantToday
            ? "하나를 고르면 꽃이 천천히 자라나요"
            : garden.todayMood
              ? "오늘은 이미 꽃이 피었어요"
              : "스토리북에 넣은 정원이에요"}
        </p>

        <div className="mt-4 flex justify-between gap-1.5">
          {garden.moods.map((mood) => {
            const selected = garden.todayMood === mood.id;
            const loading = pendingMood === mood.id;
            return (
              <button
                key={mood.id}
                type="button"
                disabled={!garden.canPlantToday || !!pendingMood}
                onClick={() => void plant(mood.id)}
                aria-label={mood.label}
                title={mood.label}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 transition-all duration-300",
                  selected
                    ? "border-bedi-sage/40 bg-bedi-sage/15 scale-[1.03]"
                    : garden.canPlantToday
                      ? "border-bedi-slate/10 bg-[#FBFAF7] hover:-translate-y-0.5 hover:border-bedi-sage/25 hover:bg-white"
                      : "border-bedi-slate/8 bg-bedi-slate/[0.03] opacity-50",
                  loading && "animate-pulse"
                )}
              >
                <span className="text-2xl leading-none">{mood.emoji}</span>
                <span className="text-[9px] tracking-wide text-bedi-slate/40">
                  {mood.label}
                </span>
              </button>
            );
          })}
        </div>

        {(justBloomed || plantingMood) && (
          <div
            key={justBloomed?.id ?? plantingMood?.id}
            className={cn(
              "garden-grow-stage mt-4 rounded-2xl border border-bedi-sage/25 bg-gradient-to-br px-4 py-4",
              moodAccent[(justBloomed?.mood ?? plantingMood!.id) as MoodId]
            )}
          >
            <p className="text-center text-[11px] tracking-wide text-bedi-sage">
              {justBloomed ? "꽃이 피어나는 중" : "흙을 고르는 중…"}
            </p>
            <div className="mt-3 flex justify-center py-2">
              <GrowingFlower
                key={`hero-${justBloomed?.id ?? plantingMood!.id}`}
                emoji={justBloomed?.emoji ?? plantingMood!.emoji}
                mood={(justBloomed?.mood ?? plantingMood!.id) as MoodId}
                animateGrow
                size="lg"
              />
            </div>
            {justBloomed ? (
              <>
                <p className="mt-1 text-center text-sm font-medium text-bedi-slate">
                  {justBloomed.name}
                </p>
                <p className="mt-1 text-center text-xs leading-relaxed text-bedi-slate/60">
                  {justBloomed.note}
                </p>
                <p className="mt-2 text-center text-[11px] text-bedi-sage">
                  별조각 +5
                </p>
              </>
            ) : null}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-medium text-bedi-slate">나의 정원</h2>
            <p className="mt-1 text-xs text-bedi-slate/40">
              꽃이 자라면 살짝 흔들려요
            </p>
          </div>
          <p className="text-[11px] tabular-nums text-bedi-slate/35">
            {garden.flowers.length}/{garden.plotSlots}
          </p>
        </div>

        <div
          className="relative overflow-hidden rounded-3xl border border-bedi-sage/20 px-4 pb-5 pt-8 shadow-softer"
          style={{
            background:
              "linear-gradient(180deg, #E8F0E4 0%, #F3F6F0 42%, #E7EFE3 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-16 opacity-40"
            style={{
              background:
                "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.9), transparent 70%)",
            }}
          />

          <div className="relative grid grid-cols-4 gap-x-2 gap-y-5 sm:grid-cols-5">
            {garden.flowers.map((flower, index) => {
              const isNew = growingId === flower.id;
              return (
                <GrowingFlower
                  key={flower.id}
                  emoji={flower.emoji}
                  mood={flower.mood}
                  label={`${flower.dayIndex}일`}
                  animateGrow={isNew}
                  sway={!isNew}
                  size="sm"
                  title={`${flower.name} · ${flower.dayIndex}일째`}
                  style={
                    isNew
                      ? undefined
                      : { animationDelay: `${Math.min(index, 8) * 60}ms` }
                  }
                  className={!isNew ? "garden-flower-rise" : undefined}
                />
              );
            })}

            {plantingMood && !justBloomed ? (
              <GrowingFlower
                key="planting"
                emoji={plantingMood.emoji}
                mood={plantingMood.id}
                label="심는 중"
                animateGrow
                size="sm"
              />
            ) : null}

            {Array.from({
              length: Math.max(
                0,
                emptySlots - (plantingMood && !justBloomed ? 1 : 0)
              ),
            }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex flex-col items-center justify-end opacity-30"
                aria-hidden
              >
                <span className="mb-1 h-6 w-px rounded-full bg-bedi-slate/15" />
                <span className="h-1.5 w-5 rounded-full bg-bedi-slate/10" />
              </div>
            ))}
          </div>
        </div>

        {garden.flowers.length > 0 ? (
          <ul className="mt-4 space-y-2.5">
            {garden.flowers.map((flower) => (
              <li
                key={`row-${flower.id}`}
                className={cn(
                  "rounded-2xl border border-bedi-slate/8 bg-gradient-to-r px-4 py-3 shadow-softer",
                  moodAccent[flower.mood],
                  growingId === flower.id && "garden-bloom"
                )}
              >
                <div className="flex items-center gap-3">
                  <GrowingFlower
                    emoji={flower.emoji}
                    mood={flower.mood}
                    animateGrow={growingId === flower.id}
                    sway={growingId !== flower.id}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-bedi-slate">
                        {flower.name}
                      </p>
                      <p className="shrink-0 text-[10px] tabular-nums text-bedi-slate/40">
                        {flower.dayIndex}일째 · {flower.plantedOn.slice(5)}
                      </p>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-bedi-slate/60">
                      {flower.note}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-2xl border border-bedi-slate/8 bg-white/90 px-5 py-5 shadow-softer">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bedi-sage/15 text-bedi-sage">
            <BookMarked className="h-4 w-4" strokeWidth={1.5} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-medium text-bedi-slate">
              {garden.storybook.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-bedi-slate/65">
              {garden.storybook.summary}
            </p>
            {garden.storybook.sealed ? (
              <p className="mt-3 text-[11px] text-bedi-sage">
                스토리북에 넣었어요 · 꽃 {garden.storybook.flowerCount}송이
              </p>
            ) : (
              <button
                type="button"
                disabled={sealing || garden.flowers.length === 0}
                onClick={() => void sealStorybook()}
                className="mt-4 h-10 w-full rounded-xl bg-bedi-slate text-sm font-medium text-white transition-colors hover:bg-bedi-slate/90 disabled:opacity-40"
              >
                {sealing
                  ? "넣는 중…"
                  : garden.flowers.length === 0
                    ? "꽃이 피면 넣을 수 있어요"
                    : "퇴원 · 정원을 스토리북에 넣기"}
              </button>
            )}
            <Link
              href="/storybook"
              className="mt-3 block text-center text-xs text-bedi-sage underline-offset-2 hover:underline"
            >
              AI 성장 스토리북 펼치기
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-lg bg-bedi-rose/15 px-3 py-2 text-sm text-bedi-slate/80">
          {error}
        </p>
      ) : null}
    </div>
  );
}
