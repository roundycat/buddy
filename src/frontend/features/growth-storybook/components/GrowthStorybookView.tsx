"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/frontend/shared/lib/utils";
import type {
  GrowthStorybookResponse,
  StorybookPage,
} from "@/backend/features/growth-storybook/growth-storybook.types";

interface GrowthStorybookViewProps {
  book: GrowthStorybookResponse;
}

type Slide =
  | { type: "cover" }
  | { type: "page"; page: StorybookPage }
  | { type: "wish" }
  | { type: "empty" };

export function GrowthStorybookView({ book: initial }: GrowthStorybookViewProps) {
  const router = useRouter();
  const [book, setBook] = useState(initial);
  const [index, setIndex] = useState(0);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slides: Slide[] = useMemo(() => {
    const list: Slide[] = [{ type: "cover" }];
    if (book.opening) list.push({ type: "page", page: book.opening });
    for (const page of book.pages) list.push({ type: "page", page });
    if (book.wishClosing) list.push({ type: "wish" });
    if (book.epilogue) list.push({ type: "page", page: book.epilogue });
    if (list.length === 1 && book.pages.length === 0 && !book.wishClosing) {
      list.push({ type: "empty" });
    }
    return list;
  }, [book]);

  const slide = slides[Math.min(index, slides.length - 1)]!;
  const canPrev = index > 0;
  const canNext = index < slides.length - 1;

  async function compose() {
    if (composing) return;
    setComposing(true);
    setError(null);
    try {
      const res = await fetch("/api/storybook/compose", { method: "POST" });
      const json = (await res.json()) as {
        book?: GrowthStorybookResponse;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "이야기 책을 완성하지 못했어요.");
      if (json.book) {
        setBook(json.book);
        setIndex(0);
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "이야기 책을 완성하지 못했어요."
      );
    } finally {
      setComposing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "relative min-h-[420px] overflow-hidden rounded-[28px] border border-bedi-slate/8 bg-white/95 px-6 py-7 shadow-softer",
          "bg-[radial-gradient(ellipse_at_top,#F3F7F4_0%,transparent_55%)]"
        )}
      >
        {slide.type === "cover" ? (
          <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon-512.png"
              alt=""
              width={72}
              height={72}
              className="h-18 w-18 rounded-[20px] object-cover"
            />
            <p className="mt-5 text-[11px] tracking-wide text-bedi-sage">
              {book.sealed ? "완성된 이야기" : "우리의 이야기 책"}
            </p>
            <h2 className="mt-2 max-w-xs text-xl font-semibold leading-snug text-bedi-slate">
              {book.cover?.title ?? book.title}
            </h2>
            <p className="mt-2 text-sm text-bedi-slate/50">
              {book.cover?.subtitle ?? "병원 숲을 지나, 내일의 문으로"}
            </p>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-bedi-slate/65">
              {book.cover?.dedication ?? book.companionNote}
            </p>
            <p className="mt-6 text-[11px] tabular-nums text-bedi-slate/40">
              {book.pageCount > 0 ? `${book.pageCount}장` : "아직 장이 쌓이는 중"}
              {book.flowerCount > 0 ? ` · 꽃 ${book.flowerCount}` : ""}
              {book.wishCount > 0 ? ` · 소원 ${book.wishCount}` : ""}
            </p>
          </div>
        ) : null}

        {slide.type === "page" ? (
          <article className="min-h-[360px]">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[10px] tracking-wide text-bedi-sage">
                {slide.page.headline ||
                  (slide.page.kind === "opening"
                    ? "프롤로그"
                    : slide.page.kind === "epilogue"
                      ? "에필로그"
                      : "이야기")}
              </p>
              {slide.page.date ? (
                <p className="text-[10px] tabular-nums text-bedi-slate/35">
                  {slide.page.date}
                </p>
              ) : null}
            </div>
            <h2 className="mt-2 text-lg font-semibold leading-snug text-bedi-slate">
              {slide.page.title}
            </h2>
            {slide.page.photoUrl ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-bedi-slate/8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slide.page.photoUrl}
                  alt=""
                  className="h-40 w-full object-cover"
                />
              </div>
            ) : null}
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-bedi-slate/75">
              {slide.page.body}
            </p>
            {slide.page.missions.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {slide.page.missions.map((m) => (
                  <span
                    key={`${slide.page.id}-${m.title}`}
                    className="inline-flex items-center gap-1 rounded-full bg-[#FBFAF7] px-2.5 py-1 text-[10px] text-bedi-slate/50"
                  >
                    <span aria-hidden>{m.emoji}</span>
                    {m.title}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        ) : null}

        {slide.type === "wish" && book.wishClosing ? (
          <article className="min-h-[360px]">
            <p className="text-[10px] tracking-wide text-bedi-sage">
              {book.wishClosing.headline}
            </p>
            <h2 className="mt-2 text-lg font-semibold text-bedi-slate">
              {book.wishClosing.title}
            </h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-bedi-slate/80">
              {book.wishClosing.body}
            </p>
            <ul className="mt-4 space-y-2">
              {book.wishClosing.wishes.map((w) => (
                <li
                  key={w.text}
                  className="rounded-xl bg-bedi-sage/10 px-3 py-2 text-sm text-bedi-slate/70"
                >
                  <span className="mr-1.5">{w.emoji}</span>
                  {w.text}
                </li>
              ))}
            </ul>
          </article>
        ) : null}

        {slide.type === "empty" ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
            <p className="text-sm text-bedi-slate/50">아직 장이 없어요.</p>
            <p className="mt-2 text-xs text-bedi-slate/40">
              모험을 마치거나 소원을 걸면 이야기가 쌓여요.
            </p>
            <div className="mt-4 flex gap-4 text-sm">
              <Link href="/adventure" className="text-bedi-sage hover:underline">
                모험
              </Link>
              <Link href="/wish" className="text-bedi-sage hover:underline">
                소원 나무
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="inline-flex h-11 items-center gap-1 rounded-xl border border-bedi-slate/10 px-3 text-sm text-bedi-slate/70 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
          이전
        </button>
        <p className="text-[11px] tabular-nums text-bedi-slate/40">
          {index + 1} / {slides.length}
        </p>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))}
          className="inline-flex h-11 items-center gap-1 rounded-xl border border-bedi-slate/10 px-3 text-sm text-bedi-slate/70 disabled:opacity-30"
        >
          다음
          <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {!book.sealed ? (
        <div className="rounded-2xl border border-bedi-sage/25 bg-bedi-sage/10 px-5 py-4">
          <p className="text-sm font-medium text-bedi-slate">
            희망찬 내일로 이어지는 책으로 완성할까요?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-bedi-slate/55">
            모험·정원·소원을 모아 프롤로그와 에필로그가 있는 동화로 묶어 드려요.
          </p>
          {error ? (
            <p className="mt-2 text-xs text-bedi-rose/80">{error}</p>
          ) : null}
          <button
            type="button"
            disabled={composing}
            onClick={() => void compose()}
            className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-bedi-slate text-sm font-medium text-white disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            {composing ? "책을 쓰는 중…" : "이야기 책 완성하기"}
          </button>
        </div>
      ) : (
        <p className="text-center text-xs text-bedi-slate/40">
          완성된 이야기는{" "}
          <Link href="/memory" className="text-bedi-sage hover:underline">
            기억
          </Link>
          에도 남아 있어요
        </p>
      )}
    </div>
  );
}
