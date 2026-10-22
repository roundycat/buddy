"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Camera, Leaf, MessageCircle, Mail } from "lucide-react";
import { cn } from "@/frontend/shared/lib/utils";
import {
  TransientToast,
  useTransientToast,
} from "@/frontend/shared/hooks/useTransientToast";
import type {
  AdventureDayStory,
  AdventureQuestItem,
  AdventureQuestKind,
  AdventureQuestResponse,
} from "@/frontend/shared/types/adventure-quest";

interface AdventureQuestViewProps {
  initial: AdventureQuestResponse;
}

function kindLabel(kind: AdventureQuestKind): string {
  switch (kind) {
    case "photo":
      return "사진";
    case "garden":
      return "정원";
    case "chat":
      return "대화";
    case "post":
      return "편지";
    case "observe":
      return "기록";
    default:
      return "미션";
  }
}

/** Missions that lead back to people (nurse, family, friends) — mirrors the backend rule. */
const CONNECT_QUEST_RE =
  /(간호사|선생님|의사|엄마|아빠|가족|보호자|친구|옆\s?침대|동생|형|누나|언니|오빠|할머니|할아버지|어른|사람)/;

function questLabel(quest: { kind: AdventureQuestKind; title: string; hint?: string }): string {
  if (
    quest.kind === "observe" &&
    CONNECT_QUEST_RE.test(`${quest.title} ${quest.hint ?? ""}`) &&
    !quest.title.includes("베디")
  ) {
    return "사람과 나누기";
  }
  return kindLabel(quest.kind);
}

function actionLabel(kind: AdventureQuestKind): string {
  switch (kind) {
    case "photo":
      return "사진 올리기";
    case "garden":
      return "정원 가기";
    case "chat":
      return "베디에게 말하기";
    case "post":
      return "편지 쓰기";
    case "observe":
      return "기록하기";
    default:
      return "시작하기";
  }
}

const QUEST_XP_DISPLAY = 5;

function rewardLabel(points: number, xp = QUEST_XP_DISPLAY) {
  return `별조각 +${points} · 경험치 +${xp}`;
}

export function AdventureQuestView({ initial }: AdventureQuestViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusQuestId = searchParams.get("quest");
  const [data, setData] = useState(initial);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toast, setToast } = useTransientToast(3600);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [story, setStory] = useState<AdventureDayStory | null>(
    initial.dayStory
  );
  const [storyFresh, setStoryFresh] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setData(initial);
    setStory(initial.dayStory);
  }, [initial]);

  useEffect(() => {
    if (!focusQuestId) return;
    const el = document.getElementById(`quest-${focusQuestId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusQuestId]);

  function applyAdventure(next: AdventureQuestResponse) {
    setData(next);
    if (next.dayStory) setStory(next.dayStory);
  }

  async function claim(quest: AdventureQuestItem) {
    if (claimingId || quest.status === "done" || !quest.readyToClaim) return;
    setClaimingId(quest.id);
    setToast(null);

    try {
      const res = await fetch("/api/wallet/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId: quest.id }),
      });
      const json = (await res.json()) as {
        error?: string;
        awarded?: number;
        xpAwarded?: number;
        alreadyClaimed?: boolean;
        dayStory?: AdventureDayStory | null;
        storyJustCreated?: boolean;
      };

      if (!res.ok) {
        throw new Error(json.error ?? "보상을 받지 못했어요.");
      }

      const nextQuests = data.quests.map((q) =>
        q.id === quest.id
          ? { ...q, status: "done" as const, readyToClaim: false }
          : q
      );
      const completedCount = nextQuests.filter((q) => q.status === "done").length;

      setData((prev) => ({
        ...prev,
        quests: nextQuests,
        completedCount,
        allComplete: completedCount === nextQuests.length,
        dayStory: json.dayStory ?? prev.dayStory,
      }));

      if (json.dayStory) {
        setStory(json.dayStory);
        if (json.storyJustCreated) setStoryFresh(true);
      }

      const stars = json.awarded ?? quest.points;
      const xp = json.xpAwarded ?? QUEST_XP_DISPLAY;

      if (json.alreadyClaimed) {
        setToast("이미 받은 보상이에요.");
      } else if (json.storyJustCreated) {
        setToast(
          `미션이 이야기가 되었어요! ${rewardLabel(stars, xp)}`
        );
      } else {
        setToast(`${rewardLabel(stars, xp)} 받았어요!`);
      }

      window.dispatchEvent(new Event("bedi:wallet"));
      router.refresh();
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "보상을 받지 못했어요."
      );
    } finally {
      setClaimingId(null);
    }
  }

  async function uploadPhoto(quest: AdventureQuestItem, file: File) {
    setBusyId(quest.id);
    setToast(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("questId", quest.id);
      const res = await fetch("/api/photos", { method: "POST", body: form });
      const json = (await res.json()) as {
        error?: string;
        photo?: { id: string; url: string };
      };
      if (!res.ok) throw new Error(json.error ?? "사진을 올리지 못했어요.");

      setData((prev) => ({
        ...prev,
        quests: prev.quests.map((q) =>
          q.id === quest.id
            ? {
                ...q,
                progress: {
                  ...q.progress,
                  photoId: json.photo?.id,
                  completedAt: new Date().toISOString(),
                },
                readyToClaim: true,
              }
            : q
        ),
      }));
      setToast("사진첩에 저장했어요. 별조각을 받아 보세요!");
      router.refresh();
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "사진을 올리지 못했어요."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function saveNote(quest: AdventureQuestItem) {
    const note = (notes[quest.id] ?? "").trim();
    if (!note) {
      setToast("한 줄만 적어 주세요.");
      return;
    }
    setBusyId(quest.id);
    setToast(null);
    try {
      const res = await fetch("/api/adventure/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId: quest.id, note, complete: true }),
      });
      const json = (await res.json()) as {
        error?: string;
        adventure?: AdventureQuestResponse;
      };
      if (!res.ok) throw new Error(json.error ?? "기록을 남기지 못했어요.");
      if (json.adventure) applyAdventure(json.adventure);
      setToast("기록을 남겼어요. 별조각을 받아 보세요!");
      router.refresh();
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "기록을 남기지 못했어요."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="feature-enter space-y-5">
      <div className="rounded-2xl border border-bedi-slate/8 bg-white/85 px-5 py-5 shadow-softer">
        <p className="text-[11px] tracking-wide text-bedi-sage">
          {data.dateLabel}
        </p>
        <h2 className="mt-2 text-lg font-semibold leading-snug text-bedi-slate">
          {data.headline}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-bedi-slate/65">
          {data.companionNote}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {data.factors.map((factor) => (
            <span
              key={`${factor.emoji}-${factor.label}`}
              className="inline-flex items-center gap-1 rounded-full border border-bedi-slate/8 bg-[#FBFAF7] px-2.5 py-1 text-[10px] text-bedi-slate/55"
            >
              <span aria-hidden>{factor.emoji}</span>
              {factor.label}
            </span>
          ))}
        </div>

        <p className="mt-3 text-[11px] tabular-nums text-bedi-slate/40">
          미션 {data.completedCount}/{data.quests.length}
          {data.allComplete
            ? " · 오늘 이야기 완성"
            : " · 앱에서 미션을 마친 뒤 별조각·경험치를 받아요"}
        </p>

        <p className="mt-2 text-xs text-bedi-slate/40">
          올린 사진은{" "}
          <Link
            href="/memory"
            className="text-bedi-sage underline-offset-2 hover:underline"
          >
            기억 · 사진첩
          </Link>
          에서 볼 수 있어요.
        </p>

        {!data.context.mood.id ? (
          <p className="mt-2 text-xs text-bedi-slate/40">
            기분을 고르면 모험이 더 잘 맞춰져요.{" "}
            <Link
              href="/garden"
              className="text-bedi-sage underline-offset-2 hover:underline"
            >
              감정 정원
            </Link>
          </p>
        ) : null}
      </div>

      {toast ? (
        <TransientToast
          message={toast}
          className="rounded-xl bg-bedi-sage/15 px-3 py-2 text-center text-sm text-bedi-slate/75"
        />
      ) : null}

      <div>
        <p className="mb-3 text-xs tracking-wide text-bedi-slate/40">
          오늘의 모험 · 3가지
        </p>
        <ul className="space-y-3">
          {data.quests.map((quest, index) => {
            const done = quest.status === "done";
            const focused = focusQuestId === quest.id;
            return (
              <li
                id={`quest-${quest.id}`}
                key={quest.id}
                className={cn(
                  "rounded-2xl border border-bedi-slate/8 bg-white/90 px-5 py-4 shadow-softer transition-opacity",
                  done && "opacity-65",
                  focused && "ring-2 ring-bedi-sage/35"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bedi-sage/10 text-lg">
                    {quest.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[10px] tracking-wide text-bedi-slate/35">
                        모험 {index + 1} · {questLabel(quest)}
                      </p>
                      <span className="text-[10px] text-bedi-slate/35">
                        {done
                          ? "완료"
                          : quest.readyToClaim
                            ? "보상 가능"
                            : "도전"}
                      </span>
                    </div>
                    <h3 className="mt-0.5 text-[15px] font-medium leading-snug text-bedi-slate">
                      {quest.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-bedi-slate/60">
                      {quest.hint}
                    </p>

                    {quest.progress.photoId ? (
                      <div className="mt-3 overflow-hidden rounded-xl border border-bedi-slate/8 bg-[#FBFAF7]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/photos/${quest.progress.photoId}`}
                          alt="미션 사진"
                          className="h-36 w-full object-cover"
                        />
                      </div>
                    ) : null}

                    {quest.progress.note ? (
                      <p className="mt-2 rounded-xl bg-bedi-sage/10 px-3 py-2 text-xs leading-relaxed text-bedi-slate/70">
                        {quest.progress.note}
                      </p>
                    ) : null}

                    {!done && quest.kind === "observe" ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={notes[quest.id] ?? ""}
                          onChange={(e) =>
                            setNotes((prev) => ({
                              ...prev,
                              [quest.id]: e.target.value,
                            }))
                          }
                          rows={2}
                          placeholder="한 줄로 남겨 보세요"
                          className="w-full resize-none rounded-xl border border-bedi-slate/10 bg-white px-3 py-2 text-sm text-bedi-slate outline-none focus:border-bedi-sage/40"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busyId === quest.id}
                            onClick={() => void saveNote(quest)}
                            className="press-soft min-h-11 rounded-lg border border-bedi-slate/10 px-3.5 text-xs text-bedi-slate/70 hover:bg-bedi-slate/5 disabled:opacity-50"
                          >
                            기록 저장
                          </button>
                          <button
                            type="button"
                            disabled={busyId === quest.id}
                            onClick={() =>
                              fileRefs.current[quest.id]?.click()
                            }
                            className="press-soft inline-flex min-h-11 items-center gap-1 rounded-lg border border-bedi-slate/10 px-3.5 text-xs text-bedi-slate/70 hover:bg-bedi-slate/5 disabled:opacity-50"
                          >
                            <Camera className="h-3.5 w-3.5" strokeWidth={1.75} />
                            사진도 올리기
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {!done && quest.kind === "photo" ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          disabled={busyId === quest.id}
                          onClick={() => fileRefs.current[quest.id]?.click()}
                          className="press-soft inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-bedi-sage/25 bg-bedi-sage/10 px-3.5 text-xs font-medium text-bedi-sage hover:bg-bedi-sage/15 disabled:opacity-50"
                        >
                          <Camera className="h-3.5 w-3.5" strokeWidth={1.75} />
                          {busyId === quest.id
                            ? "올리는 중…"
                            : actionLabel("photo")}
                        </button>
                      </div>
                    ) : null}

                    {!done &&
                    (quest.kind === "garden" ||
                      quest.kind === "chat" ||
                      quest.kind === "post") ? (
                      <div className="mt-3">
                        <Link
                          href={quest.actionHref}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-bedi-sage/25 bg-bedi-sage/10 px-3 py-1.5 text-xs font-medium text-bedi-sage hover:bg-bedi-sage/15"
                        >
                          {quest.kind === "garden" ? (
                            <Leaf className="h-3.5 w-3.5" strokeWidth={1.75} />
                          ) : quest.kind === "chat" ? (
                            <MessageCircle
                              className="h-3.5 w-3.5"
                              strokeWidth={1.75}
                            />
                          ) : (
                            <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
                          )}
                          {actionLabel(quest.kind)}
                        </Link>
                      </div>
                    ) : null}

                    <input
                      ref={(el) => {
                        fileRefs.current[quest.id] = el;
                      }}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void uploadPhoto(quest, file);
                      }}
                    />

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-[11px] text-bedi-sage">
                        {done
                          ? `${rewardLabel(quest.points)} 받음`
                          : rewardLabel(quest.points)}
                      </p>
                      {!done ? (
                        <button
                          type="button"
                          disabled={
                            claimingId === quest.id || !quest.readyToClaim
                          }
                          onClick={() => void claim(quest)}
                          className="press-soft min-h-11 shrink-0 rounded-lg bg-bedi-slate px-3.5 text-xs font-medium text-white hover:bg-bedi-slate/90 disabled:opacity-40"
                        >
                          {claimingId === quest.id
                            ? "받는 중…"
                            : quest.readyToClaim
                              ? "보상 받기"
                              : "미션 먼저 하기"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {story ? (
        <section
          className={cn(
            "rounded-2xl border border-bedi-sage/30 bg-gradient-to-br from-bedi-sage/15 to-white px-5 py-5 shadow-softer",
            storyFresh && "garden-bloom"
          )}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-bedi-sage" strokeWidth={1.5} />
            <p className="text-[11px] tracking-wide text-bedi-sage">
              오늘의 이야기
            </p>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-bedi-slate/80">
            {story.narrative}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
            <Link
              href="/memory"
              className="rounded-full border border-bedi-slate/10 bg-white/80 px-3 py-1.5 text-bedi-slate/60 transition-colors hover:border-bedi-sage/30 hover:text-bedi-slate"
            >
              Memory Timeline에 저장됨
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
