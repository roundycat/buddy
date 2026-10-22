"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  ChevronDown,
  Feather,
  ImagePlus,
  Italic,
  Sparkles,
} from "lucide-react";
import { fetchJson } from "@/frontend/shared/api/fetch-json";
import { useAsyncAction } from "@/frontend/shared/hooks/useAsyncAction";
import { useJsonResource } from "@/frontend/shared/hooks/useJsonResource";
import { ErrorState } from "@/frontend/features/parent/components/ParentUi";
import { cn } from "@/frontend/shared/lib/utils";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

type LetterPayload = {
  letter?: {
    bodyHtml?: string;
    body?: string;
    signature?: string;
    dischargeDate?: string;
    handwriting?: boolean;
    photoUrl?: string;
  } | null;
};

export function StorybookLetterCard() {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [signature, setSignature] = useState("");
  const [dischargeDate, setDischargeDate] = useState("");
  const [handwriting, setHandwriting] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{
    dataUrl: string;
    contentType: string;
  } | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);

  const { data: letterResponse } = useJsonResource<LetterPayload>(
    "/api/parent/storybook-letter",
    { fallbackMessage: "편지를 불러오지 못했어요." }
  );

  useEffect(() => {
    const letter = letterResponse?.letter;
    if (!letter) return;
    if (editorRef.current) {
      editorRef.current.innerHTML =
        letter.bodyHtml || letter.body?.replace(/\n/g, "<br>") || "";
    }
    setSignature(letter.signature ?? "");
    setDischargeDate(letter.dischargeDate ?? "");
    setHandwriting(letter.handwriting !== false);
    setExistingPhotoUrl(letter.photoUrl ?? null);
  }, [letterResponse]);

  function format(command: "bold" | "italic") {
    editorRef.current?.focus();
    document.execCommand(command);
  }

  const saveLetter = useCallback(async () => {
    const bodyHtml = editorRef.current?.innerHTML ?? "";
    if (!editorRef.current?.innerText.trim()) {
      setNotice("아이에게 전할 말을 먼저 적어 주세요.");
      return;
    }
    if (!dischargeDate) {
      setNotice("퇴원 예정일을 정해야 편지를 보낼 수 있어요.");
      return;
    }
    if (!signature.trim()) {
      setNotice("편지를 쓴 사람의 이름을 적어 주세요.");
      return;
    }
    setNotice(null);
    await fetchJson(
      "/api/parent/storybook-letter",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bodyHtml,
          signature,
          date: todayKey(),
          dischargeDate,
          handwriting,
          photoBase64: photo?.dataUrl,
          photoContentType: photo?.contentType,
        }),
      },
      "편지를 전송하지 못했어요."
    );
    setNotice(
      `편지가 아이에게 바로 전송됐어요. ${dischargeDate}부터 아이가 열어 볼 수 있어요.`
    );
    if (photo) {
      setExistingPhotoUrl(`/api/storybook/parent-letter/photo?v=${Date.now()}`);
      setPhoto(null);
    }
  }, [signature, dischargeDate, handwriting, photo]);

  const { run: save, busy, error } = useAsyncAction(saveLetter);

  return (
    <div className="overflow-hidden rounded-2xl border border-rose-100 bg-[#FFFDF8] shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-start gap-3 bg-rose-50/50 px-4 py-3 text-left transition-colors hover:bg-rose-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-300/50",
          open && "border-b border-rose-100/80"
        )}
      >
        <Feather
          className="mt-0.5 h-4 w-4 shrink-0 text-rose-600/70"
          strokeWidth={1.5}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-700">
            퇴원날 서프라이즈 편지
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {open
              ? "퇴원 예정일을 정하고 편지를 보내 주세요. AI가 쓰지 않아요. 전송 즉시 아이에게 도착하고, 예정일이 되어야 열어 볼 수 있어요."
              : "탭해서 편지를 쓰고 아이에게 보내 보세요."}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
            open && "rotate-180"
          )}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>

      <div className={cn("space-y-3 p-4", !open && "hidden")}>
          <label className="block text-xs font-semibold text-slate-600">
            퇴원 예정일
            <input
              type="date"
              value={dischargeDate}
              onChange={(event) => setDischargeDate(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-rose-300"
            />
          </label>
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-rose-600/75">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            전송하면 바로 아이의 이야기책에 봉투가 도착합니다. 내용은 퇴원
            예정일부터 열립니다.
          </p>

          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => format("bold")}
              aria-label="굵게"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/40"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => format("italic")}
              aria-label="기울임"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/40"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
          </div>

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            data-placeholder="사랑하는 우리 아이에게…"
            className="min-h-32 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-7 text-slate-700 outline-none empty:before:text-slate-300 empty:before:content-[attr(data-placeholder)] focus:border-rose-300"
          />

          <input
            value={signature}
            onChange={(event) => setSignature(event.target.value)}
            placeholder="쓴 사람 · 예: 엄마와 아빠"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-rose-300"
          />

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === "string") {
                  setPhoto({
                    dataUrl: reader.result,
                    contentType: file.type || "image/jpeg",
                  });
                }
              };
              reader.readAsDataURL(file);
            }}
          />

          {photo?.dataUrl || existingPhotoUrl ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo?.dataUrl || existingPhotoUrl || ""}
                alt="편지에 넣을 사진"
                className="max-h-44 w-full object-cover"
              />
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-600"
          >
            <ImagePlus className="h-4 w-4" strokeWidth={1.6} />
            {photo || existingPhotoUrl
              ? "다른 사진 고르기"
              : "편지에 사진 넣기"}
          </button>

          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={handwriting}
              onChange={(event) => setHandwriting(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            손편지 느낌의 글씨로 보여 주기
          </label>

          {error ? <ErrorState message={error} /> : null}
          {!error && notice ? (
            <p className="text-xs leading-relaxed text-slate-500">{notice}</p>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="h-11 w-full rounded-xl bg-rose-500 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "전송하는 중…" : "아이에게 전송하기"}
          </button>
        </div>
    </div>
  );
}
