"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { fetchJson } from "@/frontend/shared/api/fetch-json";
import { subject, withRo } from "@/shared/text/josa";
import { useTransientToast } from "@/frontend/shared/hooks/useTransientToast";
import { useSoftMotion } from "@/frontend/shared/lib/motion";
import { SoftErrorState } from "@/frontend/shared/components/ChildUi";
import { GardenMap } from "@/frontend/features/emotion-garden/components/GardenMap";
import { WeekGarden } from "@/frontend/features/emotion-garden/components/WeekGarden";
import { DailyPlantingModal } from "@/frontend/features/emotion-garden/components/DailyPlantingModal";
import { MemoryFlowerCard } from "@/frontend/features/emotion-garden/components/MemoryFlowerCard";
import { completeAdventureQuest } from "@/frontend/features/adventure-quest/lib/complete-adventure-quest";
import type {
  EmotionGardenResponse,
  FlowerMemoryCard as FlowerMemoryCardData,
  GardenPlantView,
  MoodId,
  SkyPhase,
} from "@/frontend/shared/catalogs";

interface EmotionGardenViewProps {
  initial: EmotionGardenResponse;
}

function phaseForHour(hour: number): SkyPhase {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

export function EmotionGardenView({ initial }: EmotionGardenViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const questId = searchParams.get("quest");

  const { stagger, item } = useSoftMotion();

  const [garden, setGarden] = useState(initial);
  const [plantingOpen, setPlantingOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [growingId, setGrowingId] = useState<string | null>(null);
  const [wateringId, setWateringId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [memory, setMemory] = useState<FlowerMemoryCardData | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const { toast: flash, setToast: setFlash } = useTransientToast(2800);
  const [error, setError] = useState<string | null>(null);
  const [questHint, setQuestHint] = useState<string | null>(
    questId
      ? "모험 미션: 오늘의 감정 씨앗을 심으면 미션이 완료돼요."
      : null
  );
  const [livePhase, setLivePhase] = useState<SkyPhase | null>(null);

  useEffect(() => {
    setGarden(initial);
  }, [initial]);

  useEffect(() => {
    setLivePhase(phaseForHour(new Date().getHours()));
  }, []);

  useEffect(() => {
    if (!growingId) return;
    const t = window.setTimeout(() => setGrowingId(null), 2200);
    return () => window.clearTimeout(t);
  }, [growingId]);

  useEffect(() => {
    if (!wateringId) return;
    const t = window.setTimeout(() => setWateringId(null), 950);
    return () => window.clearTimeout(t);
  }, [wateringId]);

  const applyGarden = useCallback((next: EmotionGardenResponse) => {
    setGarden(next);
  }, []);

  async function plantSeed(mood: MoodId) {
    if (!garden.canPlantToday || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await fetchJson<
        EmotionGardenResponse & { planted?: GardenPlantView }
      >(
        "/api/garden/plant",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mood }),
        },
        "씨앗을 심지 못했어요."
      );

      applyGarden(data);
      setPlantingOpen(false);
      if (data.planted) {
        setGrowingId(data.planted.id);
        setFlash(`${data.planted.flowerName} 씨앗을 심었어요.`);
      }

      if (questId) {
        const ok = await completeAdventureQuest(questId, `정원 · ${mood}`);
        if (ok) {
          setQuestHint("미션 완료! 모험으로 돌아가 보세요.");
        }
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "씨앗을 심지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function water(plant: GardenPlantView) {
    if (!plant.canWater || busy) return;
    setBusy(true);
    setError(null);
    setWateringId(plant.id);
    try {
      const data = await fetchJson<
        EmotionGardenResponse & { watered?: GardenPlantView }
      >(
        "/api/garden/water",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plantId: plant.id }),
        },
        "물을 주지 못했어요."
      );

      const before = plant.stage;
      applyGarden(data);
      if (data.watered && data.watered.stage !== before) {
        setGrowingId(data.watered.id);
        setFlash(
          data.watered.stage === "bloom"
            ? `${subject(data.watered.flowerName)} 활짝 피었어요.`
            : `${withRo(data.watered.stageLabel)} 자랐어요.`
        );
      } else {
        setFlash("마음이 촉촉해졌어요.");
      }
      router.refresh();
    } catch (err) {
      setWateringId(null);
      setError(err instanceof Error ? err.message : "물을 주지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function openMemory(plant: GardenPlantView) {
    setSelectedId(plant.id);
    setMemoryLoading(true);
    setMemory(null);
    try {
      const data = await fetchJson<FlowerMemoryCardData>(
        `/api/garden/flower/${plant.id}`,
        undefined,
        "기억을 불러오지 못했어요."
      );
      setMemory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "기억을 불러오지 못했어요.");
      setSelectedId(null);
    } finally {
      setMemoryLoading(false);
    }
  }

  function onSelectPlant(plant: GardenPlantView) {
    if (plant.canWater) {
      void water(plant);
      return;
    }
    void openMemory(plant);
  }

  const phase = livePhase ?? garden.sky.phase;
  const todayPlant =
    garden.flowers.find((f) => f.plantedOn === garden.todayDate) ?? null;

  return (
    <motion.div className="space-y-6" {...stagger}>
      <motion.div
        className="rounded-2xl border border-bedi-slate/8 bg-white/80 px-5 py-4 shadow-softer"
        {...item}
      >
        <p className="text-[11px] tracking-wide text-bedi-sage">{garden.title}</p>
        <p className="mt-1 text-xs text-bedi-slate/40">
          입원 {garden.dayCount}일째
          {todayPlant
            ? ` · 오늘 ${todayPlant.flowerName}`
            : garden.canPlantToday
              ? " · 오늘 씨앗을 심을 수 있어요"
              : ""}
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
      </motion.div>

      <motion.section {...item}>
        <div className="mb-3">
          <h2 className="text-[15px] font-medium text-bedi-slate">오늘의 씨앗</h2>
          <p className="mt-1 text-xs text-bedi-slate/40">
            흙에 심고, 물을 주며 조금씩 자라요
          </p>
        </div>

        <GardenMap
          garden={garden}
          phase={phase}
          growingId={growingId}
          wateringId={wateringId}
          busy={busy}
          onSelectPlant={onSelectPlant}
          onOpenPlanting={() => setPlantingOpen(true)}
          onWater={(plant) => void water(plant)}
          onOpenMemory={(plant) => void openMemory(plant)}
        />

        {flash ? (
          <p className="garden-grow-stage mt-3 rounded-xl bg-bedi-sage/12 px-3 py-2 text-center text-xs text-bedi-slate/75">
            {flash}
          </p>
        ) : null}
      </motion.section>

      <motion.div {...item}>
        <WeekGarden
          todayDate={garden.todayDate}
          flowers={garden.flowers}
          onOpenMemory={(plant) => void openMemory(plant)}
        />
      </motion.div>

      {error ? <SoftErrorState message={error} /> : null}

      <DailyPlantingModal
        open={plantingOpen}
        moods={garden.moods}
        suggestion={garden.suggestion}
        busy={busy}
        onClose={() => setPlantingOpen(false)}
        onPlant={(mood) => void plantSeed(mood)}
      />

      <MemoryFlowerCard
        card={memory}
        loading={memoryLoading}
        onClose={() => {
          setMemory(null);
          setSelectedId(null);
        }}
      />
    </motion.div>
  );
}
