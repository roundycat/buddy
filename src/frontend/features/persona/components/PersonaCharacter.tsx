"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AiMadeBadge } from "@/frontend/shared/components/AiMadeBadge";

const TAP_LINES = [
  "오늘은 어때?",
  "나랑 잠깐 있을래?",
  "오늘 기분은 좀 어때?",
  "심심하면 말해 줘.",
  "여기 있어도 괜찮아.",
] as const;

const LONG_PRESS_MS = 450;

type CareType = "cheer" | "hug" | "stay";

type HeartBurst = { id: number; x: number; y: number };

export type PersonaAnnounce = {
  text: string;
  linkHref?: string;
  linkLabel?: string;
  /** Keep visible until replaced (quest hints). */
  sticky?: boolean;
};

export type PersonaStage = "idle" | "farewell" | "away" | "arrive";

/**
 * Waiting-room secret-friend character.
 * Short tap = pet + speech. Long press = hug + hearts.
 */
export function PersonaCharacter({
  name,
  avatarUrl,
  avatarAiMade = true,
  speaking = false,
  moodLine,
  replyLine,
  replyKey = 0,
  announce = null,
  stage = "idle",
  onPet,
  onHug,
}: {
  name: string;
  avatarUrl?: string | null;
  /** False for a bundled drawing: then no "AI로 그렸어요" label. */
  avatarAiMade?: boolean;
  speaking?: boolean;
  /** Today's mood in the friend's voice — "나 오늘은 포근해." */
  moodLine?: string | null;
  replyLine?: string | null;
  replyKey?: number;
  announce?: PersonaAnnounce | null;
  /** Friend swap sequence for avatar redraw */
  stage?: PersonaStage;
  onPet?: () => void;
  onHug?: () => void;
}) {
  const [lineIndex, setLineIndex] = useState(-1);
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [bubbleLink, setBubbleLink] = useState<{
    href: string;
    label: string;
  } | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [bubbleSticky, setBubbleSticky] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [motion, setMotion] = useState<"idle" | "pet" | "hug">("idle");
  const [hearts, setHearts] = useState<HeartBurst[]>([]);
  const longPressTimer = useRef<number | null>(null);
  const didLongPress = useRef(false);
  const heartId = useRef(0);
  const stickyAnnounce = useRef<PersonaAnnounce | null>(null);
  const locked = stage === "farewell" || stage === "away" || stage === "arrive";

  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    if (stage === "farewell") {
      setBubbleText("다음에 우리 또 만나!");
      setBubbleLink(null);
      setBubbleSticky(true);
      setBubbleVisible(true);
      return;
    }
    if (stage === "arrive") {
      setBubbleText("안녕! 나랑 같이 있을래?");
      setBubbleLink(null);
      setBubbleSticky(false);
      setBubbleVisible(true);
      return;
    }
    if (stage === "away") {
      setBubbleVisible(false);
      setBubbleSticky(false);
    }
  }, [stage]);

  useEffect(() => {
    if (!announce?.text) {
      stickyAnnounce.current = null;
      return;
    }
    if (locked && stage !== "arrive") return;
    stickyAnnounce.current = announce.sticky ? announce : null;
    setBubbleText(announce.text);
    setBubbleLink(
      announce.linkHref && announce.linkLabel
        ? { href: announce.linkHref, label: announce.linkLabel }
        : null
    );
    setBubbleSticky(Boolean(announce.sticky));
    setBubbleVisible(true);
  }, [announce, locked, stage]);

  useEffect(() => {
    if (!replyLine || locked) return;
    setBubbleText(replyLine);
    setBubbleLink(null);
    setBubbleSticky(false);
    setBubbleVisible(true);
  }, [replyLine, replyKey, locked]);

  useEffect(() => {
    if (!bubbleVisible || bubbleSticky || stage === "farewell") return;
    const t = window.setTimeout(() => {
      if (stickyAnnounce.current) {
        const a = stickyAnnounce.current;
        setBubbleText(a.text);
        setBubbleLink(
          a.linkHref && a.linkLabel
            ? { href: a.linkHref, label: a.linkLabel }
            : null
        );
        setBubbleSticky(true);
        setBubbleVisible(true);
        return;
      }
      setBubbleVisible(false);
    }, 3200);
    return () => window.clearTimeout(t);
  }, [bubbleVisible, bubbleText, bubbleSticky, lineIndex, stage]);

  useEffect(() => {
    if (motion === "idle") return;
    const t = window.setTimeout(
      () => setMotion("idle"),
      motion === "hug" ? 720 : 540
    );
    return () => window.clearTimeout(t);
  }, [motion]);

  function showFallbackLine() {
    setLineIndex((i) => {
      const next = (i + 1) % TAP_LINES.length;
      const moodBit = moodLine || null;
      setBubbleText(moodBit && next % 2 === 0 ? moodBit : TAP_LINES[next]!);
      return next;
    });
    setBubbleLink(null);
    setBubbleSticky(false);
    setBubbleVisible(true);
  }

  function spawnHearts() {
    const burst: HeartBurst[] = Array.from({ length: 4 }, () => {
      heartId.current += 1;
      return {
        id: heartId.current,
        x: 28 + Math.random() * 44,
        y: 18 + Math.random() * 30,
      };
    });
    setHearts(burst);
    window.setTimeout(() => setHearts([]), 950);
  }

  function clearLongPressTimer() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handlePointerDown() {
    if (locked) return;
    didLongPress.current = false;
    clearLongPressTimer();
    longPressTimer.current = window.setTimeout(() => {
      didLongPress.current = true;
      setMotion("hug");
      spawnHearts();
      setBubbleText("꼭 안아 줘서 든든해.");
      setBubbleLink(null);
      setBubbleSticky(false);
      setBubbleVisible(true);
      onHug?.();
    }, LONG_PRESS_MS);
  }

  function handlePointerUp() {
    if (locked) return;
    clearLongPressTimer();
    if (didLongPress.current) return;
    setMotion("pet");
    showFallbackLine();
    onPet?.();
  }

  function handlePointerCancel() {
    clearLongPressTimer();
  }

  const useGenerated = Boolean(avatarUrl) && !imgFailed;
  const initial = (name?.trim()?.[0] || "?").toUpperCase();

  const bodyClass =
    stage === "farewell"
      ? "persona-farewell"
      : stage === "away"
        ? "persona-away"
        : stage === "arrive"
          ? "persona-friend-run-in"
          : motion === "pet"
            ? "persona-pet"
            : motion === "hug"
              ? "persona-hug"
              : speaking || bubbleVisible
                ? "persona-speaking"
                : "persona-pebble";

  return (
    <div
      className={
        stage === "away"
          ? "relative flex flex-col items-center pointer-events-none"
          : "relative flex flex-col items-center"
      }
    >
      {/* Fixed slot so bubble show/hide does not shift the character */}
      <div className="relative z-20 h-[5.75rem] w-full max-w-[min(240px,70vw)] shrink-0">
        {bubbleVisible && bubbleText && stage !== "away" ? (
          <div
            key={`${bubbleText}-${bubbleLink?.href ?? ""}-${stage}`}
            className="absolute bottom-1 left-1/2 w-max max-w-full -translate-x-1/2"
            role="status"
          >
            <div className="speech-bubble px-3.5 py-2.5">
              <p className="text-center text-[13px] font-medium leading-snug text-bedi-slate">
                {bubbleText}
              </p>
              {bubbleLink ? (
                <p className="mt-1.5 text-center">
                  <Link
                    href={bubbleLink.href}
                    className="text-[12px] font-medium text-bedi-sage underline-offset-2 hover:underline"
                  >
                    {bubbleLink.label}
                  </Link>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerCancel}
        onPointerCancel={handlePointerCancel}
        disabled={locked}
        className="group relative flex touch-manipulation flex-col items-center select-none disabled:cursor-default"
        aria-label={
          locked
            ? `${name}`
            : `${name} 쓰다듬기. 길게 누르면 안아주기`
        }
      >
        <div className="relative flex flex-col items-center">
          <div className={bodyClass}>
            <div className="relative flex h-44 w-44 items-center justify-center md:h-52 md:w-52">
              {hearts.map((h) => (
                <span
                  key={h.id}
                  className="persona-heart absolute text-sm text-bedi-rose"
                  style={{ left: `${h.x}%`, top: `${h.y}%` }}
                  aria-hidden
                >
                  ♥
                </span>
              ))}
              {useGenerated && avatarAiMade ? <AiMadeBadge className="-bottom-1 right-0" /> : null}
              {useGenerated ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl!}
                  alt={`${name} 캐릭터`}
                  className="h-full w-full object-contain drop-shadow-md"
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-bedi-sage/20 text-2xl font-semibold text-bedi-slate/55">
                    {initial}
                  </span>
                  <span className="text-center text-[11px] leading-snug text-bedi-slate/40">
                    아직 그림이 없어요
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

export type { CareType as PersonaCareType };
