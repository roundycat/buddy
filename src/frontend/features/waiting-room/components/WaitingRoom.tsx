"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/frontend/shared/lib/utils";
import { PersonaCharacter } from "@/frontend/features/persona/components/PersonaCharacter";
import type { PersonaStage } from "@/frontend/features/persona/components/PersonaCharacter";
import { CompanionChatSheet } from "@/frontend/features/waiting-room/components/CompanionChatSheet";
import { CompanionInlineChat } from "@/frontend/features/waiting-room/components/CompanionInlineChat";
import { WaitingRoomCategories } from "@/frontend/features/waiting-room/components/WaitingRoomCategories";
import { ScheduleNotifySheet } from "@/frontend/features/waiting-room/components/ScheduleNotifySheet";
import { useCompanionChat } from "@/frontend/features/waiting-room/hooks/useCompanionChat";
import { TopBrandBar } from "@/frontend/shared/components/TopBrandBar";
import { ScheduleDeliveryEffect } from "@/frontend/features/hospital-day/components/ScheduleDeliveryEffect";
import { WaitingRoomWeather } from "@/frontend/features/waiting-room/components/WaitingRoomWeather";
import { completeAdventureQuest } from "@/frontend/features/adventure-quest/lib/complete-adventure-quest";
import { CompanionBondPanel } from "@/frontend/features/companion-bond/components/CompanionBondPanel";
import {
  postCompanionBond,
  type CareType,
  type CompanionBondView,
} from "@/frontend/features/companion-bond/lib/companion-bond-api";
import { fetchAvatarChoices } from "@/frontend/features/persona/lib/fetch-avatar-choices";
import { selectAvatarChoice } from "@/frontend/features/persona/lib/select-avatar";
import { ConcernConsentCard } from "@/frontend/features/sharing/components/ConcernConsentCard";

export interface WaitingRoomScheduleItem {
  id: string;
  title: string;
  time?: string;
  type?: string;
  notifyText?: string;
  explanation?: string;
  whatText?: string;
  whyText?: string;
  imageUrl?: string | null;
  imageStatus?: string | null;
  done?: boolean;
}

export interface WaitingRoomProps {
  companionName: string;
  companionRole: string;
  greeting: string;
  companionMessage: string;
  prompt?: string;
  dayCount?: number;
  avatarUrl?: string | null;
  /** False when the portrait is a bundled drawing (no "AI로 그렸어요" label). */
  avatarAiMade?: boolean;
  /** Parent-shared schedules for today (teaser + notify sheet) */
  scheduleTeaser?: WaitingRoomScheduleItem[];
  /** Parent schedules first seen this session */
  scheduleDeliveries?: Array<{
    id: string;
    title: string;
    time?: string;
    type?: string;
    notifyText?: string;
  }>;
}

export function WaitingRoom({
  companionName,
  companionRole: _companionRole,
  greeting,
  companionMessage,
  prompt,
  dayCount = 12,
  avatarUrl: initialAvatarUrl,
  avatarAiMade: initialAvatarAiMade = true,
  scheduleTeaser = [],
  scheduleDeliveries = [],
}: WaitingRoomProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const questId = searchParams.get("quest");
  const wantsRedraw = searchParams.get("redrawAvatar") === "1";
  const [chatOpen, setChatOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [avatarAiMade, setAvatarAiMade] = useState(initialAvatarAiMade);
  const [choices, setChoices] = useState<Array<{ id: string; url: string }>>(
    []
  );
  const [drawSlots, setDrawSlots] = useState<
    Array<{ id: string; url: string } | null>
  >([null, null]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [savingPick, setSavingPick] = useState(false);
  const [drawDone, setDrawDone] = useState(0);
  const [drawTotal, setDrawTotal] = useState(2);
  const [drawPct, setDrawPct] = useState(0);
  const [friendStage, setFriendStage] = useState<PersonaStage>("idle");
  const [pickError, setPickError] = useState<string | null>(null);
  const [questHint, setQuestHint] = useState<string | null>(null);
  const [questDone, setQuestDone] = useState(false);
  const [bond, setBond] = useState<CompanionBondView | null>(null);
  const [bondBusy, setBondBusy] = useState(false);
  const [bondReply, setBondReply] = useState<string | null>(null);
  const [bondReplyKey, setBondReplyKey] = useState(0);
  const visitedRef = useRef(false);
  const { messages, pending, loaded, send, crisis, dismissCrisis } =
    useCompanionChat(greeting, companionMessage);

  useEffect(() => {
    if (crisis) setChatOpen(true);
  }, [crisis]);

  const applyBond = useCallback((next: CompanionBondView | null) => {
    if (!next) return;
    setBond(next);
    if (next.replyLine) {
      setBondReply(next.replyLine);
      setBondReplyKey((k) => k + 1);
    }
  }, []);

  useEffect(() => {
    if (!questId) {
      setQuestHint(null);
      setQuestDone(false);
      return;
    }
    try {
      if (sessionStorage.getItem(`bedi-quest-done:${questId}`) === "1") {
        setQuestDone(true);
        setQuestHint(null);
        return;
      }
    } catch {
      /* ignore */
    }
    setQuestDone(false);
    setQuestHint("모험 미션이야. 나랑 한마디만 나눠도 완료돼!");
  }, [questId]);

  useEffect(() => {
    if (searchParams.get("notifications") === "1") {
      setScheduleOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (visitedRef.current) return;
    visitedRef.current = true;
    void (async () => {
      const next = await postCompanionBond("visit");
      applyBond(next);
    })();
  }, [applyBond]);

  async function runBondAction(
    action: "pet" | "care" | "chat" | "quest",
    careType?: CareType,
    questBonusId?: string
  ) {
    setBondBusy(true);
    try {
      const next = await postCompanionBond(action, careType, questBonusId);
      applyBond(next);
    } finally {
      setBondBusy(false);
    }
  }

  async function sendWithQuest(text: string) {
    const ok = await send(text);
    if (ok) {
      void runBondAction("chat");
    }
    if (questId && !questDone) {
      const questOk = await completeAdventureQuest(questId, text.slice(0, 80));
      if (questOk) {
        setQuestDone(true);
        try {
          sessionStorage.setItem(`bedi-quest-done:${questId}`, "1");
        } catch {
          /* ignore */
        }
        setQuestHint("미션 완료! 사이가 더 가까워졌어.");
        await runBondAction("quest", undefined, questId);
        window.setTimeout(() => setQuestHint(null), 3500);
      } else if (ok) {
        setQuestHint("대화는 됐어. 미션 체크만 잠시 안 됐어 — 모험에서 확인해 줘.");
        window.setTimeout(() => {
          setQuestHint("모험 미션이야. 나랑 한마디만 나눠도 완료돼!");
        }, 4000);
      }
    }
  }

  const displayPrompt =
    prompt ??
    "오늘 하루, 나랑 조금만 이야기해줄래? 무리하지 않아도 괜찮아.";

  function closeNotifications() {
    setScheduleOpen(false);
    if (searchParams.get("notifications") !== "1") return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("notifications");
    const query = next.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  }

  const questAnnounce = useMemo(
    () =>
      questHint
        ? {
            text: questHint,
            linkHref: "/adventure",
            linkLabel: questDone ? "모험으로 돌아가기" : "모험으로",
            sticky: !questDone,
          }
        : null,
    [questHint, questDone]
  );

  const needsAvatar = !avatarUrl;
  const picking = choices.length > 0 && !drawing;
  const drawingRef = useRef(false);
  const swapTimers = useRef<number[]>([]);
  const drawStartedAt = useRef(0);

  function clearSwapTimers() {
    for (const id of swapTimers.current) window.clearTimeout(id);
    swapTimers.current = [];
  }

  useEffect(() => {
    if (!drawing) {
      if (choices.length > 0) setDrawPct(100);
      return;
    }
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - drawStartedAt.current;
      // Soft crawl toward ~88% while waiting; snap with real slot completions
      const soft = Math.min(88, (1 - Math.exp(-elapsed / 40000)) * 88);
      const hard = drawTotal > 0 ? (drawDone / drawTotal) * 100 : 0;
      const next = Math.max(hard, Math.min(96, soft + hard * 0.12));
      setDrawPct(next);
    }, 250);
    return () => window.clearInterval(tick);
  }, [drawing, drawDone, drawTotal, choices.length]);

  const fetchAvatarChoicesOnly = useCallback(async () => {
    setChoices([]);
    setDrawSlots([null, null]);
    setPickedId(null);
    setDrawDone(0);
    setDrawTotal(2);
    setDrawPct(4);
    drawStartedAt.current = Date.now();

    const { choices: next, error } = await fetchAvatarChoices(
      Date.now(),
      (progress) => {
        setDrawDone(progress.done);
        setDrawTotal(progress.total);
        setDrawSlots(progress.slots);
        setChoices(progress.choices);
        setPickedId((prev) => {
          if (prev && progress.choices.some((c) => c.id === prev)) return prev;
          return progress.choices[0]?.id ?? null;
        });
      }
    );
    if (next.length === 0) {
      throw new Error(error ?? "그림을 그리지 못했어요. 다시 시도해 주세요.");
    }
    setChoices(next);
    setDrawSlots((prev) => {
      if (prev.some(Boolean)) return prev;
      return [next[0] ?? null, next[1] ?? null];
    });
    setPickedId(next[0]!.id);
    setDrawDone(2);
    setDrawTotal(2);
    setDrawPct(100);
    window.setTimeout(() => {
      document
        .getElementById("avatar-redraw-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }, []);

  const redrawAvatars = useCallback(
    async (opts?: { skipFarewell?: boolean }) => {
      if (drawingRef.current) return;
      drawingRef.current = true;
      setPickError(null);
      clearSwapTimers();

      const playFarewell = Boolean(avatarUrl) && !opts?.skipFarewell;

      try {
        if (playFarewell) {
          setFriendStage("farewell");
          await new Promise<void>((resolve) => {
            const t = window.setTimeout(resolve, 1650);
            swapTimers.current.push(t);
          });
          setFriendStage("away");
        } else {
          setFriendStage("away");
        }

        setDrawing(true);
        setChoices([]);
        setDrawSlots([null, null]);
        setPickedId(null);
        setDrawDone(0);
        setDrawPct(4);
        window.setTimeout(() => {
          document
            .getElementById("avatar-redraw-panel")
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 50);

        await fetchAvatarChoicesOnly();
      } catch (err) {
        setPickError(
          err instanceof Error ? err.message : "그림을 다시 그리지 못했어요."
        );
        setFriendStage("idle");
        setChoices([]);
        setDrawSlots([null, null]);
      } finally {
        drawingRef.current = false;
        setDrawing(false);
      }
    },
    [avatarUrl, fetchAvatarChoicesOnly]
  );

  useEffect(() => {
    function onRedraw() {
      void redrawAvatars();
    }
    window.addEventListener("bedi:redraw-avatar", onRedraw);
    return () => {
      window.removeEventListener("bedi:redraw-avatar", onRedraw);
      clearSwapTimers();
    };
  }, [redrawAvatars]);

  useEffect(() => {
    if (!wantsRedraw) return;
    void redrawAvatars();
    router.replace("/", { scroll: false });
  }, [wantsRedraw, redrawAvatars, router]);

  async function confirmPick() {
    if (!pickedId || savingPick) return;
    setSavingPick(true);
    setPickError(null);
    try {
      const data = await selectAvatarChoice(pickedId);
      setAvatarUrl(data.avatarUrl ?? `/api/persona/avatar?v=${Date.now()}`);
      setAvatarAiMade(data.avatarAiMade !== false);
      setChoices([]);
      setDrawSlots([null, null]);
      setPickedId(null);
      setDrawPct(0);
      setFriendStage("arrive");
      const t = window.setTimeout(() => setFriendStage("idle"), 1400);
      swapTimers.current.push(t);
    } catch (err) {
      setPickError(
        err instanceof Error ? err.message : "선택한 그림을 저장하지 못했어요."
      );
    } finally {
      setSavingPick(false);
    }
  }

  return (
    <section className="paper-room relative mx-auto flex min-h-[100dvh] max-w-lg flex-col px-5 pb-0 pt-2 md:max-w-2xl md:px-8">
      <ScheduleDeliveryEffect
        deliveries={scheduleDeliveries}
        onOpenNotifications={() => setScheduleOpen(true)}
      />
      <TopBrandBar
        showBack={false}
        notificationCount={scheduleTeaser.length}
        onOpenNotifications={() => setScheduleOpen(true)}
      />

      <div className="relative mt-5 shrink-0 text-center">
        <p className="text-sm text-bedi-slate/70">
          나 <span className="text-bedi-rose">·</span> {companionName}
        </p>
        <p className="mt-1 text-xs text-bedi-slate/40">
          함께한 지{" "}
          <span className="tabular-nums text-bedi-slate/60">{dayCount}</span>일째
          {bond?.visitStreak && bond.visitStreak > 1
            ? ` · ${bond.visitStreak}일 연속`
            : ""}
        </p>
        <WaitingRoomWeather />
      </div>

      {/* "May I tell your guardian you're having a hard time?" — only when asked */}
      <ConcernConsentCard className="mt-3" />

      <div className="waiting-room-enter relative z-0 flex min-h-0 flex-1 flex-col items-center justify-end gap-1 pb-2 pt-3">
        <WaitingRoomCategories scheduleCount={scheduleTeaser.length} />

        <PersonaCharacter
          name={companionName}
          avatarUrl={avatarUrl}
          avatarAiMade={avatarAiMade}
          speaking={speaking || pending || chatOpen}
          moodLine={bond?.moodLine}
          replyLine={bondReply}
          replyKey={bondReplyKey}
          announce={friendStage === "idle" ? questAnnounce : null}
          stage={friendStage}
          onPet={() => void runBondAction("pet")}
          onHug={() => void runBondAction("care", "hug")}
        />

        {!picking &&
          !drawing &&
          !chatOpen &&
          friendStage === "idle" &&
          !needsAvatar && (
            <CompanionBondPanel
              bond={bond}
              busy={bondBusy}
              onCare={(type) => void runBondAction("care", type)}
            />
          )}
      </div>

      {/* Bottom dock — chat or avatar redraw (same slot) */}
      {picking ||
      drawing ||
      friendStage === "farewell" ||
      (needsAvatar && friendStage === "idle") ? (
        <div
          className="relative z-20 mt-auto w-full shrink-0 px-0 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1"
          style={{ animation: "chat-teaser-in 0.4s ease-out" }}
        >
          <div
            id="avatar-redraw-panel"
            className="mx-auto w-full max-w-sm space-y-3 rounded-t-3xl border border-bedi-slate/10 border-b-0 bg-[#FBFAF7]/95 px-4 pb-3 pt-4 shadow-soft backdrop-blur-sm sm:rounded-3xl sm:border-b"
          >
            {friendStage === "farewell" && !drawing && !picking ? (
              <div className="py-2 text-center" role="status" aria-live="polite">
                <p className="text-sm font-medium text-bedi-slate">
                  친구가 잠시 인사하고 있어요…
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-bedi-slate/45">
                  곧 새로운 친구 그림을 그려 볼게요.
                </p>
              </div>
            ) : null}

            {needsAvatar && !picking && !drawing && friendStage === "idle" ? (
              <div className="flex flex-col items-center gap-2 py-1">
                <p className="text-center text-xs text-bedi-slate/45">
                  크레파스 그림이 아직 없어요. 두 장 그려서 골라 볼까요?
                </p>
                <button
                  type="button"
                  onClick={() => void redrawAvatars()}
                  disabled={drawing}
                  className="h-11 w-full rounded-xl bg-bedi-slate text-sm font-medium text-white disabled:opacity-50"
                >
                  그림 그리기
                </button>
              </div>
            ) : null}

            {drawing || picking ? (
              <>
                <div className="text-center">
                  <p className="text-sm font-medium text-bedi-slate">
                    {drawing
                      ? "다른 친구 그림을 그리는 중…"
                      : "어떤 그림이 더 마음에 들어요?"}
                  </p>
                  <p className="mt-1 text-[11px] text-bedi-slate/40">
                    {drawing
                      ? `크레파스 ${drawDone}/${drawTotal}장 · 이름·기록은 그대로 둬요`
                      : "정보는 그대로 두고, 그림만 바꿀 수 있어요."}
                  </p>
                </div>

                {drawing ? (
                  <div className="space-y-1.5" role="status" aria-live="polite">
                    <div className="flex items-center justify-between text-[11px] text-bedi-slate/45">
                      <span>
                        {drawDone === 0
                          ? "스케치하는 중…"
                          : drawDone < drawTotal
                            ? "한 장 나왔어요. 한 장 더…"
                            : "거의 다 됐어요!"}
                      </span>
                      <span className="tabular-nums font-medium text-bedi-slate/60">
                        {Math.round(drawPct)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-bedi-slate/10">
                      <div
                        className="h-full rounded-full bg-bedi-sage/80 transition-[width] duration-500 ease-out"
                        style={{ width: `${Math.max(4, drawPct)}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  {(drawSlots.some(Boolean) || drawing
                    ? drawSlots
                    : [choices[0] ?? null, choices[1] ?? null]
                  ).map((choice, index) => {
                    if (choice) {
                      const selected = !drawing && pickedId === choice.id;
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          disabled={drawing || savingPick}
                          onClick={() => setPickedId(choice.id)}
                          className={cn(
                            "flex flex-col items-center rounded-2xl border bg-white p-2 transition-all",
                            selected
                              ? "border-bedi-sage ring-2 ring-bedi-sage/35"
                              : "border-bedi-slate/10",
                            drawing && "cursor-default"
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={choice.url}
                            alt={`후보 ${index + 1}`}
                            className="aspect-square w-full object-contain"
                            loading="lazy"
                            decoding="async"
                          />
                        </button>
                      );
                    }
                    return (
                      <div
                        key={`slot-${index}`}
                        className="flex aspect-square flex-col items-center justify-center rounded-2xl border border-dashed border-bedi-slate/15 bg-white/70 p-2"
                        aria-hidden
                      >
                        <div className="h-10 w-10 animate-pulse rounded-full bg-bedi-sage/20" />
                        <p className="mt-2 text-[10px] text-bedi-slate/35">
                          그리는 중…
                        </p>
                      </div>
                    );
                  })}
                </div>

                {!drawing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void confirmPick()}
                      disabled={!pickedId || savingPick}
                      className="h-11 w-full rounded-xl bg-bedi-slate text-sm font-medium text-white disabled:opacity-50"
                    >
                      {savingPick ? "저장하는 중…" : "이 그림으로 하기"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChoices([]);
                        setDrawSlots([null, null]);
                        setPickedId(null);
                        setPickError(null);
                        void redrawAvatars({ skipFarewell: true });
                      }}
                      disabled={savingPick}
                      className="h-11 w-full rounded-xl border border-bedi-slate/15 bg-white text-sm font-medium text-bedi-slate disabled:opacity-50"
                    >
                      다시 그리기
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChoices([]);
                        setDrawSlots([null, null]);
                        setPickedId(null);
                        setPickError(null);
                        setDrawPct(0);
                        setFriendStage("idle");
                      }}
                      disabled={savingPick}
                      className="h-10 w-full text-xs text-bedi-slate/45 hover:text-bedi-slate/70 disabled:opacity-50"
                    >
                      취소
                    </button>
                  </>
                ) : null}
              </>
            ) : null}

            {pickError ? (
              <p className="text-center text-xs text-bedi-rose">{pickError}</p>
            ) : null}
          </div>
        </div>
      ) : !chatOpen ? (
        <div className="relative z-20 mt-auto flex justify-center px-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          <CompanionInlineChat
            companionName={companionName}
            prompt={displayPrompt}
            messages={messages}
            pending={pending}
            onSend={sendWithQuest}
            onOpenSheet={() => setChatOpen(true)}
          />
        </div>
      ) : null}

      <CompanionChatSheet
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        companionName={companionName}
        messages={messages}
        pending={pending}
        loaded={loaded}
        onSend={sendWithQuest}
        onSpeakingChange={setSpeaking}
        crisis={crisis}
        onDismissCrisis={dismissCrisis}
      />

      <ScheduleNotifySheet
        open={scheduleOpen}
        onClose={closeNotifications}
        items={scheduleTeaser}
      />
    </section>
  );
}
