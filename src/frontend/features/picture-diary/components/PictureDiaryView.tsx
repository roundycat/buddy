"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import type { DiaryEntryView } from "@/frontend/shared/types/picture-diary";
import {
  SoftEmptyState,
  SoftErrorState,
} from "@/frontend/shared/components/ChildUi";
import {
  DrawingCanvas,
  type DrawingCanvasHandle,
} from "./DrawingCanvas";

function formatDay(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  if (!month || !day) return dateKey;
  return `${Number(month)}월 ${Number(day)}일`;
}

interface PictureDiaryViewProps {
  companionNote: string;
  entries: DiaryEntryView[];
}

export function PictureDiaryView({
  companionNote,
  entries: initialEntries,
}: PictureDiaryViewProps) {
  const canvasRef = useRef<DrawingCanvasHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState(initialEntries);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<{ dataUrl: string; type: string } | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pickPhoto(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPhoto({ dataUrl: reader.result, type: file.type || "image/jpeg" });
      }
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    if (busy) return;
    const drawing = canvasRef.current?.exportPng() ?? null;
    const note = text.trim();

    if (!drawing && !photo && !note) {
      setError("그림을 그리거나 사진을 붙이거나, 한 줄만 써도 괜찮아요.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: note || undefined,
          drawingBase64: drawing ?? undefined,
          photoBase64: photo?.dataUrl,
          photoContentType: photo?.type,
        }),
      });
      const data = (await res.json()) as {
        entry?: DiaryEntryView;
        error?: string;
      };
      if (!res.ok || !data.entry) {
        throw new Error(data.error ?? "일기를 저장하지 못했어요.");
      }

      setEntries((prev) => [data.entry!, ...prev]);
      setText("");
      setPhoto(null);
      canvasRef.current?.clear();
      if (fileRef.current) fileRef.current.value = "";
      setNotice("오늘 일기를 잘 담아 뒀어요.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "일기를 저장하지 못했어요."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="feature-enter space-y-5">
      <div className="rounded-2xl border border-bedi-slate/8 bg-white/80 px-5 py-4 shadow-softer">
        <p className="text-[11px] tracking-wide text-bedi-sage">오늘의 한 장</p>
        <p className="mt-2 text-sm leading-relaxed text-bedi-slate/75">
          {companionNote}
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-bedi-slate/8 bg-white/90 px-4 py-4 shadow-softer">
        <DrawingCanvas ref={canvasRef} />

        {photo ? (
          <div className="relative overflow-hidden rounded-2xl border border-bedi-slate/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.dataUrl}
              alt="붙인 사진"
              className="max-h-56 w-full object-cover"
            />
            <button
              type="button"
              onClick={() => {
                setPhoto(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              aria-label="사진 떼기"
              className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-bedi-slate/60 shadow-softer transition-transform duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/40"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        ) : null}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) pickPhoto(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-bedi-slate/12 bg-white text-sm font-medium text-bedi-slate/70"
        >
          <ImagePlus className="h-4 w-4" strokeWidth={1.75} />
          {photo ? "다른 사진 고르기" : "사진 붙이기"}
        </button>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          placeholder="오늘 어떤 하루였어? 한 줄만 써도 괜찮아."
          className="w-full resize-none rounded-xl border border-bedi-slate/10 bg-[#FBFAF7] px-3 py-2.5 text-sm text-bedi-slate outline-none focus:border-bedi-sage/40"
        />

        {error ? <SoftErrorState message={error} /> : null}
        {notice ? (
          <p
            role="status"
            className="rounded-2xl bg-bedi-sage/12 px-4 py-2.5 text-sm leading-relaxed text-bedi-slate/75"
          >
            {notice}
          </p>
        ) : null}

        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="h-12 w-full rounded-xl bg-bedi-slate text-sm font-medium text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/40 focus-visible:ring-offset-2"
        >
          {busy ? "담는 중…" : "일기 담기"}
        </button>
      </div>

      {entries.length > 0 ? (
        <section className="space-y-3">
          <p className="px-1 text-[11px] tracking-wide text-bedi-slate/40">
            지난 일기
          </p>
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="overflow-hidden rounded-2xl border border-bedi-slate/8 bg-white/90 shadow-softer"
              >
                {entry.drawingUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={entry.drawingUrl}
                    alt={`${formatDay(entry.dateKey)} 그림`}
                    className="w-full bg-[#FBF8F1] object-contain"
                  />
                ) : null}
                {entry.photoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={entry.photoUrl}
                    alt={`${formatDay(entry.dateKey)} 사진`}
                    className="max-h-64 w-full object-cover"
                  />
                ) : null}
                <div className="px-5 py-4">
                  <p className="text-[10px] tracking-wide text-bedi-slate/35">
                    {formatDay(entry.dateKey)}
                  </p>
                  {entry.text ? (
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-bedi-slate/70">
                      {entry.text}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <SoftEmptyState
          icon="🖍️"
          title="아직 빈 공책이에요"
          description="그림 한 장이든 한 줄이든, 첫 장을 남기면 여기에 차곡차곡 쌓여요."
        />
      )}
    </div>
  );
}
