"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  Pause,
  Play,
  Printer,
  Sparkles,
  Volume2,
} from "lucide-react";
import type {
  GrowthStorybookResponse,
  ParentLetterPage,
  StorybookPage,
} from "@/frontend/shared/types/growth-storybook";
import { SoftErrorState } from "@/frontend/shared/components/ChildUi";
import {
  ClosedBook,
  OpenBookFrame,
  PageSurface,
} from "./BookShell";
import {
  AvatarActor,
  StoryIllustration,
  WatercolorScene,
  useChildAvatar,
} from "./StorybookScene";
import { printBook } from "../lib/print-book";
import {
  composeStorybook,
  narrateStorybook,
  patchStorybookProgress,
} from "../lib/storybook-api";

interface GrowthStorybookViewProps {
  book: GrowthStorybookResponse;
}

type Slide =
  | { type: "cover" }
  | { type: "page"; page: StorybookPage }
  | { type: "wish" }
  | { type: "parent"; letter: ParentLetterPage }
  | { type: "empty" };

const FLIP_MS = 720;

function EndingTransformation() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 7 }, (_, index) => (
        <motion.span
          key={index}
          className="absolute text-xl"
          initial={{ left: `${8 + index * 13}%`, top: "78%", opacity: 0 }}
          animate={{
            left: "50%",
            top: "28%",
            rotate: index % 2 ? 35 : -30,
            opacity: [0, 0.8, 0],
            scale: [0.7, 1, 0.3],
          }}
          transition={{ duration: 2.2, delay: index * 0.13 }}
        >
          🍃
        </motion.span>
      ))}
    </div>
  );
}

function NarratedText({
  text,
  activeSentence,
  dropCap = false,
}: {
  text: string;
  activeSentence: number;
  dropCap?: boolean;
}) {
  const sentences = useMemo(
    () => text.split(/(?<=[.!?。]|어요\.|지요\.)\s+|\n+/).filter(Boolean),
    [text]
  );
  return (
    <p
      className={`whitespace-pre-line text-[15.5px] leading-[1.95] text-[#4A4034]/85 ${
        dropCap
          ? "first-letter:float-left first-letter:mr-2 first-letter:font-display first-letter:text-[42px] first-letter:leading-[0.85] first-letter:text-bedi-sage"
          : ""
      }`}
    >
      {sentences.map((sentence, index) => (
        <span
          key={`${index}-${sentence.slice(0, 12)}`}
          className={
            activeSentence === index
              ? "rounded bg-amber-100/80 text-[#3B342A] transition-colors"
              : "transition-colors"
          }
        >
          {sentence}
          {index < sentences.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}

export function GrowthStorybookView({ book: initial }: GrowthStorybookViewProps) {
  const router = useRouter();
  const avatarUrl = useChildAvatar();
  const [book, setBook] = useState(initial);
  const [index, setIndex] = useState(initial.readingProgress.pageIndex || 0);
  const [flip, setFlip] = useState<{
    from: number;
    to: number;
    dir: 1 | -1;
  } | null>(null);
  const [bookOpen, setBookOpen] = useState(!initial.sealed);
  const [coverOpening, setCoverOpening] = useState(false);
  const [justSealed, setJustSealed] = useState(false);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [narrating, setNarrating] = useState(false);
  const [narrationBusy, setNarrationBusy] = useState(false);
  const [activeSentence, setActiveSentence] = useState(-1);
  const [letterOpened, setLetterOpened] = useState(false);
  const autoNarrateLetterRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const slides: Slide[] = useMemo(() => {
    const list: Slide[] = [{ type: "cover" }];
    if (book.opening) list.push({ type: "page", page: book.opening });
    for (const page of book.pages) list.push({ type: "page", page });
    if (book.wishClosing) list.push({ type: "wish" });
    if (book.epilogue) list.push({ type: "page", page: book.epilogue });
    if (book.parentLetter) list.push({ type: "parent", letter: book.parentLetter });
    if (book.goodbye) list.push({ type: "page", page: book.goodbye });
    if (list.length === 1) list.push({ type: "empty" });
    return list;
  }, [book]);

  const safeIndex = Math.min(index, slides.length - 1);
  const slide = slides[safeIndex]!;
  const canPrev = safeIndex > 0 && !flip;
  const canNext = safeIndex < slides.length - 1 && !flip;
  const letterLocked =
    slide.type === "parent" &&
    !letterOpened &&
    slide.letter.locked === true;
  const letterWaiting =
    slide.type === "parent" &&
    !letterOpened &&
    !letterLocked &&
    slide.letter.surprise !== false;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void patchStorybookProgress({
        pageIndex: safeIndex,
        completed: safeIndex === slides.length - 1 && book.sealed,
      }).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [safeIndex, slides.length, book.sealed]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (slide.type !== "parent" || !letterOpened) return;
    if (!autoNarrateLetterRef.current) return;
    autoNarrateLetterRef.current = false;
    const timer = window.setTimeout(() => {
      void narrate(true);
    }, 600);
    return () => window.clearTimeout(timer);
    // narrate reads the latest slide; only re-run when the letter opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letterOpened, slide.type]);

  function stopNarration() {
    audioRef.current?.pause();
    setNarrating(false);
    setActiveSentence(-1);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  /** Turn one leaf of paper. */
  function turn(next: number) {
    if (flip) return;
    const target = Math.max(0, Math.min(slides.length - 1, next));
    if (target === safeIndex) return;
    stopNarration();
    setFlip({ from: safeIndex, to: target, dir: target > safeIndex ? 1 : -1 });
  }

  function commitFlip() {
    setFlip((current) => {
      if (current) setIndex(current.to);
      return null;
    });
  }

  function openLetter() {
    if (slide.type !== "parent" || slide.letter.locked) return;
    setLetterOpened(true);
    autoNarrateLetterRef.current = true;
  }

  function narrationText() {
    if (slide.type === "page") return `${slide.page.title}. ${slide.page.body}`;
    if (slide.type === "wish" && book.wishClosing) {
      return `${book.wishClosing.title}. ${book.wishClosing.body}`;
    }
    if (slide.type === "parent") {
      const titleBit = slide.letter.title?.trim()
        ? `${slide.letter.title}. `
        : "";
      return (
        `엄마가 보낸 편지를, 천천히 읽어 줄게. ` +
        `${titleBit}` +
        `${slide.letter.body}. ` +
        `${slide.letter.signature}가, 너를 생각하며 보냈어.`
      );
    }
    return "";
  }

  async function narrate(force = false) {
    if (narrating && !force) {
      stopNarration();
      return;
    }
    if (narrating && force) stopNarration();
    const text = narrationText();
    if (!text) return;
    setNarrationBusy(true);
    try {
      const blob = await narrateStorybook(text);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.ontimeupdate = () => {
        if (!audio.duration) return;
        const count = Math.max(1, text.split(/[.!?]\s+|\n+/).length);
        setActiveSentence(
          Math.min(count - 1, Math.floor((audio.currentTime / audio.duration) * count))
        );
      };
      audio.onended = stopNarration;
      await audio.play();
      setNarrating(true);
      setActiveSentence(0);
    } catch {
      // Demo-safe fallback when Polly is unavailable in the current AWS account.
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "ko-KR";
        utterance.rate = 0.78;
        utterance.pitch = 0.92;
        const pickKoreanVoice = () => {
          const voices = window.speechSynthesis.getVoices();
          const ko = voices.filter((v) => v.lang.toLowerCase().startsWith("ko"));
          const preferred =
            ko.find((v) => /google|neural|premium|enhanced/i.test(v.name)) ||
            ko.find((v) => /female|여자|여성|yuna|sunhi|heami/i.test(v.name)) ||
            ko[0];
          if (preferred) utterance.voice = preferred;
        };
        pickKoreanVoice();
        // Chrome often loads voices async on first call.
        if (window.speechSynthesis.getVoices().length === 0) {
          window.speechSynthesis.onvoiceschanged = () => {
            pickKoreanVoice();
            window.speechSynthesis.onvoiceschanged = null;
          };
        }
        utterance.onend = stopNarration;
        window.speechSynthesis.speak(utterance);
        setNarrating(true);
        setActiveSentence(0);
      } else {
        setError("지금은 Beddy가 읽어 주지 못했어요.");
      }
    } finally {
      setNarrationBusy(false);
    }
  }

  async function compose() {
    if (composing) return;
    setComposing(true);
    setError(null);
    try {
      const composed = await composeStorybook();
      stopNarration();
      setBook(composed);
      setIndex(0);
      setFlip(null);
      setLetterOpened(false);
      setJustSealed(true);
      setBookOpen(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "이야기 책을 완성하지 못했어요."
      );
    } finally {
      setComposing(false);
    }
  }

  function openCover() {
    if (coverOpening) return;
    setCoverOpening(true);
    window.setTimeout(() => {
      setBookOpen(true);
      setCoverOpening(false);
      setJustSealed(false);
    }, 900);
  }

  function handlePrint() {
    if (!printBook(book)) {
      setError("팝업을 허용하면 책을 PDF로 저장할 수 있어요.");
    }
  }

  function folioFor(slideIndex: number) {
    if (slideIndex === 0) return undefined;
    return `${slideIndex}`;
  }

  function renderSlideBody(target: Slide, slideIndex: number): ReactNode {
    const actorSide = slideIndex % 2 === 0 ? "right" : "left";

    if (target.type === "cover") {
      return (
        <div className="relative flex min-h-[520px] flex-col items-center justify-center px-2 text-center">
          {book.sealed ? <EndingTransformation /> : null}
          <p className="text-[10px] font-semibold tracking-[0.28em] text-bedi-sage">
            {book.sealed ? "완성된 우리의 모험" : "오늘도 쓰이는 우리의 책"}
          </p>
          <h2 className="mt-4 max-w-sm font-display text-[26px] font-semibold leading-snug text-[#3F382C]">
            {book.cover?.title ?? book.title}
          </h2>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#4A4034]/55">
            {book.cover?.subtitle}
          </p>

          <div className="relative my-7 h-32 w-40">
            <AvatarActor url={avatarUrl} side="left" size={82} label="나" />
            {!avatarUrl ? (
              <div className="flex h-full w-full items-center justify-center text-5xl">📖</div>
            ) : null}
          </div>

          <div className="mb-5 flex items-center gap-2">
            <span className="h-px w-8 bg-bedi-sage/35" />
            <span className="text-[10px] text-bedi-sage/70">✦</span>
            <span className="h-px w-8 bg-bedi-sage/35" />
          </div>

          <p className="max-w-sm font-display text-[15px] italic leading-7 text-[#4A4034]/70">
            {book.cover?.dedication ?? book.companionNote}
          </p>
          <p className="mt-7 text-[11px] tabular-nums text-[#4A4034]/35">
            {book.pageCount > 0 ? `${book.pageCount}개의 이야기` : "첫 장을 기다리는 중"}
            {book.flowerCount ? ` · 꽃 ${book.flowerCount}` : ""}
            {book.wishCount ? ` · 잎 ${book.wishCount}` : ""}
          </p>
        </div>
      );
    }

    if (target.type === "page") {
      const page = target.page;
      return (
        <article className="min-h-[520px]">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-bedi-sage">
              {page.chapterNumber ? `CHAPTER ${page.chapterNumber}` : page.headline}
            </p>
            {page.date ? (
              <p className="text-[10px] tabular-nums text-[#4A4034]/35">{page.date}</p>
            ) : null}
          </div>
          <h2 className="mb-5 font-display text-[21px] font-semibold leading-snug text-[#3F382C]">
            {page.title}
          </h2>

          {page.drawingUrl || page.photoUrl ? (
            <div className="mb-6 grid gap-2 rounded-[20px] bg-[#FFFDF6] p-[6px] shadow-[0_10px_26px_-14px_rgba(84,68,48,0.5)] ring-1 ring-[#D9CDBB]/60 sm:grid-cols-2">
              {page.drawingUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={page.drawingUrl}
                  alt="직접 그린 그림"
                  className="aspect-[4/3] w-full rounded-[14px] bg-[#FBF8F1] object-contain"
                />
              ) : null}
              {page.photoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={page.photoUrl}
                  alt="직접 남긴 사진"
                  className="aspect-[4/3] w-full rounded-[14px] object-cover"
                />
              ) : null}
            </div>
          ) : (
            <div className="mb-6">
              <StoryIllustration
                page={page}
                sealed={book.sealed}
                actorSide={actorSide}
              />
            </div>
          )}

          <NarratedText
            text={page.body}
            activeSentence={activeSentence}
            dropCap
          />

          {page.memory ? (
            <div className="mt-6 rounded-2xl border border-[#DED2BB]/70 bg-[#FFFDF6]/80 px-4 py-3">
              <p className="text-[10px] font-semibold tracking-wide text-bedi-sage">
                이 페이지가 기억하는 것
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#4A4034]/60">
                {page.memory.emotionEmoji ? `${page.memory.emotionEmoji} ` : ""}
                {page.memory.label}
                {page.memory.detail ? ` · ${page.memory.detail}` : ""}
              </p>
            </div>
          ) : null}
        </article>
      );
    }

    if (target.type === "wish" && book.wishClosing) {
      return (
        <article className="min-h-[520px]">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-bedi-sage">
            마음 나무의 장
          </p>
          <h2 className="mt-2 mb-5 font-display text-[21px] font-semibold text-[#3F382C]">
            {book.wishClosing.title}
          </h2>
          <div className="mb-6 rounded-[20px] bg-[#FFFDF6] p-[6px] shadow-[0_10px_26px_-14px_rgba(84,68,48,0.5)] ring-1 ring-[#D9CDBB]/60">
            <WatercolorScene
              page={{
                id: "wish-art",
                pageNumber: 0,
                date: "",
                title: "",
                body: "",
                headline: "",
                missions: [],
                illustration: {
                  motif: "tree",
                  palette: "sage",
                  alt: "소원 잎으로 가득한 마법 나무",
                },
                animation: "leaves",
              }}
              avatarUrl={avatarUrl}
              actorSide={actorSide}
            />
          </div>
          <NarratedText text={book.wishClosing.body} activeSentence={activeSentence} />
          <ul className="mt-5 space-y-2">
            {book.wishClosing.wishes.map((wish) => (
              <li
                key={wish.text}
                className="rounded-xl bg-bedi-sage/10 px-3 py-2 text-sm text-[#4A4034]/70"
              >
                <span className="mr-1.5">{wish.emoji}</span>
                {wish.text}
              </li>
            ))}
          </ul>
        </article>
      );
    }

    if (target.type === "parent") {
      const letter = target.letter;
      const locked = letter.locked === true;
      const sealedSurprise = !letterOpened && (locked || letter.surprise !== false);

      if (sealedSurprise) {
        const unlockLabel = letter.dischargeDate
          ? (() => {
              const [y, m, d] = letter.dischargeDate.split("-").map(Number);
              if (!y || !m || !d) return letter.dischargeDate;
              return `${m}월 ${d}일`;
            })()
          : null;

        return (
          <article className="relative flex min-h-[520px] flex-col items-center justify-center overflow-hidden px-3 text-center">
            <motion.div
              className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(253,230,138,0.5),transparent_58%)]"
              animate={{ opacity: [0.4, 0.85, 0.4] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
            {[0, 1, 2, 3].map((i) => (
              <motion.span
                key={i}
                className="absolute text-lg text-amber-400/70"
                style={{ left: `${18 + i * 18}%`, top: `${22 + (i % 2) * 12}%` }}
                animate={{ y: [0, -10, 0], opacity: [0.35, 0.9, 0.35] }}
                transition={{ duration: 2.4 + i * 0.3, repeat: Infinity, delay: i * 0.2 }}
              >
                ✦
              </motion.span>
            ))}
            <motion.div
              initial={{ y: -130, rotate: -12, opacity: 0, scale: 0.7 }}
              animate={{ y: 0, rotate: 0, opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 90, damping: 14 }}
              className="relative"
            >
              <div className="flex h-28 w-36 flex-col items-center justify-center rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50 via-white to-amber-50 shadow-[0_18px_40px_-18px_rgba(190,100,120,0.55)]">
                <Mail className="h-10 w-10 text-rose-400" strokeWidth={1.4} />
                <span className="mt-2 text-[10px] font-semibold tracking-[0.2em] text-rose-400/80">
                  LETTER
                </span>
              </div>
            </motion.div>
            <p className="mt-8 text-[11px] font-semibold tracking-[0.22em] text-amber-700/60">
              날아온 편지
            </p>
            <h2 className="mt-3 max-w-xs font-display text-xl font-semibold text-[#3F382C]">
              {locked
                ? "편지가 이미 도착해 있어요"
                : "누군가 너를 위해 편지를 보냈어"}
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#4A4034]/55">
              {locked
                ? unlockLabel
                  ? `보호자가 보낸 편지예요. ${unlockLabel}이 되면 열어 볼 수 있어요.`
                  : "보호자가 보낸 편지예요. 퇴원 예정일이 되면 열어 볼 수 있어요."
                : "마지막 장에 도착한 서프라이즈예요. 봉투를 열어 볼까요?"}
            </p>
            {locked ? (
              <p className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-rose-200/80 bg-white/80 px-5 py-3 text-sm font-medium text-rose-400/90">
                <Mail className="h-4 w-4" aria-hidden />
                {unlockLabel ? `${unlockLabel}에 열림` : "아직 열 수 없어요"}
              </p>
            ) : (
              <button
                type="button"
                onClick={openLetter}
                className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-5 py-3 text-sm font-bold text-white shadow-sm"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                편지 열어 보기
              </button>
            )}
          </article>
        );
      }

      return (
        <article className="flex min-h-[520px] flex-col justify-center px-1 sm:px-3">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-amber-700/55">
            날아온 편지 · 보호자가 직접 쓴 마음
          </p>
          {letter.title?.trim() ? (
            <h2 className="mt-3 font-display text-[21px] font-semibold text-[#3F382C]">
              {letter.title}
            </h2>
          ) : null}
          {letter.photoUrl ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-amber-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={letter.photoUrl}
                alt="보호자가 편지와 함께 남긴 사진"
                className="max-h-56 w-full object-cover"
              />
            </div>
          ) : null}
          <div
            className={`mt-7 whitespace-pre-line text-[16px] leading-8 text-[#4A4034]/78 ${
              letter.handwriting ? "font-display italic" : ""
            }`}
          >
            {letter.body}
          </div>
          <div className="mt-9 text-right">
            <p className="font-display text-base text-[#4A4034]/70">{letter.signature}</p>
            <p className="mt-1 text-[11px] text-[#4A4034]/35">{letter.date}</p>
          </div>
        </article>
      );
    }

    return (
      <motion.div
        className="flex min-h-[520px] flex-col items-center justify-center text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.span
          className="text-4xl"
          aria-hidden
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        >
          🌱
        </motion.span>
        <p className="mt-4 text-[15px] font-medium text-[#4A4034]/70">
          첫 장이 자라기를 기다리고 있어요
        </p>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#4A4034]/45">
          대화하고, 마음 씨앗을 심고, 모험과 그림을 남기면 이 책에 한 장씩 생겨요.
        </p>
        <div className="mt-6 flex gap-2.5">
          <Link
            href="/adventure"
            className="press-soft inline-flex h-11 items-center rounded-full border border-[#D9CDBB]/70 bg-[#FFFCF3]/80 px-5 text-sm font-medium text-[#4A4034]/70"
          >
            모험 떠나기
          </Link>
          <Link
            href="/diary"
            className="press-soft inline-flex h-11 items-center rounded-full border border-[#D9CDBB]/70 bg-[#FFFCF3]/80 px-5 text-sm font-medium text-[#4A4034]/70"
          >
            그림 일기
          </Link>
        </div>
      </motion.div>
    );
  }

  function renderLeaf(slideIndex: number) {
    const target = slides[slideIndex];
    if (!target) return null;
    return (
      <PageSurface folio={folioFor(slideIndex)} ornament="✦">
        {renderSlideBody(target, slideIndex)}
      </PageSurface>
    );
  }

  const baseIndex = flip ? (flip.dir === 1 ? flip.to : flip.from) : safeIndex;
  const leafIndex = flip ? (flip.dir === 1 ? flip.from : flip.to) : null;

  if (!bookOpen) {
    return (
      <div className="space-y-4">
        <ClosedBook
          cover={book.cover}
          fallbackTitle={book.title}
          sealedAt={book.sealedAt}
          justSealed={justSealed}
          opening={coverOpening}
          onOpen={openCover}
        />
        {error ? <SoftErrorState message={error} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <OpenBookFrame>
        <div className="relative [perspective:2000px]">
          {renderLeaf(baseIndex)}

          <AnimatePresence>
            {flip && leafIndex !== null ? (
              <motion.div
                key={`leaf-${flip.from}-${flip.to}`}
                className="absolute inset-0 origin-left [transform-style:preserve-3d]"
                initial={{ rotateY: flip.dir === 1 ? 0 : -178 }}
                animate={{ rotateY: flip.dir === 1 ? -178 : 0 }}
                transition={{ duration: FLIP_MS / 1000, ease: [0.36, 0.02, 0.24, 1] }}
                onAnimationComplete={commitFlip}
              >
                {/* printed side */}
                <div className="absolute inset-0 overflow-hidden rounded-[18px] [backface-visibility:hidden]">
                  {renderLeaf(leafIndex)}
                  <motion.div
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(88,70,46,0.42)_0%,rgba(88,70,46,0)_30%)]"
                    initial={{ opacity: flip.dir === 1 ? 0.4 : 0.95 }}
                    animate={{ opacity: flip.dir === 1 ? [0.4, 0.95] : [0.95, 0.4] }}
                    transition={{ duration: FLIP_MS / 1000 }}
                  />
                </div>

                {/* blank back of the paper you see mid-turn */}
                <div className="absolute inset-0 overflow-hidden rounded-[18px] bg-[#FBF5E6] [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(#6B5B48_0.6px,transparent_0.6px)] [background-size:6px_6px]" />
                  <div className="absolute inset-0 bg-[linear-gradient(270deg,rgba(88,70,46,0.3)_0%,rgba(88,70,46,0)_32%)]" />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* tap zones, like turning a page with your thumb */}
          <button
            type="button"
            aria-label="이전 장"
            disabled={!canPrev}
            onClick={() => turn(safeIndex - 1)}
            className="absolute inset-y-0 left-0 z-20 w-[14%] cursor-w-resize disabled:cursor-default"
          />
          <button
            type="button"
            aria-label="다음 장"
            disabled={!canNext || letterWaiting}
            onClick={() => turn(safeIndex + 1)}
            className="absolute inset-y-0 right-0 z-20 w-[14%] cursor-e-resize disabled:cursor-default"
          />
        </div>
      </OpenBookFrame>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => turn(safeIndex - 1)}
          className="inline-flex h-11 items-center gap-1 rounded-xl border border-[#D9CDBB]/70 bg-[#FFFCF3]/80 px-3 text-sm text-[#4A4034]/70 disabled:opacity-25"
        >
          <ChevronLeft className="h-4 w-4" />
          이전
        </button>

        {slide.type === "page" ||
        slide.type === "wish" ||
        (slide.type === "parent" && !letterWaiting && !letterLocked) ? (
          <button
            type="button"
            disabled={narrationBusy}
            onClick={() => void narrate()}
            aria-label={narrating ? "낭독 멈추기" : "Beddy가 읽어 주기"}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-bedi-sage/12 px-4 text-xs font-medium text-[#4A4034]/65 disabled:opacity-50"
          >
            {narrationBusy ? (
              <Volume2 className="h-4 w-4 animate-pulse" />
            ) : narrating ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {narrationBusy ? "목소리 준비 중" : narrating ? "멈추기" : "읽어 줘"}
          </button>
        ) : (
          <p className="text-[11px] tabular-nums text-[#4A4034]/40">
            {safeIndex + 1} / {slides.length}
          </p>
        )}

        <button
          type="button"
          disabled={!canNext && !letterWaiting}
          onClick={() => (letterWaiting ? openLetter() : turn(safeIndex + 1))}
          className="inline-flex h-11 items-center gap-1 rounded-xl border border-[#D9CDBB]/70 bg-[#FFFCF3]/80 px-3 text-sm text-[#4A4034]/70 disabled:opacity-25"
        >
          {letterWaiting ? "열어 보기" : "다음"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-[#4A4034]/8">
        <motion.div
          className="h-full rounded-full bg-bedi-sage/65"
          animate={{ width: `${((safeIndex + 1) / slides.length) * 100}%` }}
        />
      </div>

      {error ? <SoftErrorState message={error} /> : null}

      {!book.sealed ? (
        <div className="rounded-2xl border border-bedi-sage/20 bg-bedi-sage/8 px-5 py-4">
          <p className="text-sm font-medium text-[#3F382C]">
            이 책은 지금도 함께 쓰는 중이에요
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#4A4034]/55">
            퇴원하는 날, 쌓인 기억 중 가장 의미 있는 장을 골라 진짜 그림책으로 제본해요.
            표지가 덮이고, 한 장씩 넘겨 읽을 수 있어요.
          </p>
          <button
            type="button"
            disabled={composing}
            onClick={() => void compose()}
            className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#3F382C] text-sm font-medium text-white disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {composing ? "기억을 모아 책을 엮는 중…" : "퇴원 · 우리의 그림책 만들기"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-xs leading-relaxed text-[#4A4034]/40">
            이 책은 우리가 함께 보낸 날을 그대로 간직하고 있어요.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                stopNarration();
                setBookOpen(false);
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#D9CDBB]/70 bg-[#FFFCF3]/80 px-4 text-xs font-medium text-[#4A4034]/65"
            >
              표지 덮기
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#D9CDBB]/70 bg-[#FFFCF3]/80 px-4 text-xs font-medium text-[#4A4034]/65"
            >
              <Printer className="h-4 w-4" strokeWidth={1.6} />
              인쇄 · PDF로 저장
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
