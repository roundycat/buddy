"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type {
  MemoryLetter,
  MemoryLetterKind,
} from "@/backend/features/memory-post/memory-post.types";
import { completeAdventureQuest } from "@/frontend/features/adventure-quest/lib/complete-adventure-quest";

const kindHint: Record<MemoryLetterKind, string> = {
  to_self: "나에게",
  from_friend: "Beddy로부터",
  to_future: "미래의 나에게",
  kept: "보관함",
};

function formatStamp(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

interface MemoryPostViewProps {
  title: string;
  companionNote: string;
  letters: MemoryLetter[];
}

export function MemoryPostView({
  title,
  companionNote,
  letters: initialLetters,
}: MemoryPostViewProps) {
  const searchParams = useSearchParams();
  const questId = searchParams.get("quest");
  const [letters, setLetters] = useState(initialLetters);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(
    questId
      ? "모험 미션: 미래의 나에게 한 줄을 남기면 미션이 완료돼요."
      : null
  );

  async function submitLetter() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const letter: MemoryLetter = {
        id: `mp-local-${Date.now()}`,
        kind: "to_future",
        title: "미래의 나에게",
        body,
        stampedAt: new Date().toISOString().slice(0, 10),
        unread: false,
      };
      setLetters((prev) => [letter, ...prev]);
      setDraft("");

      if (questId) {
        const ok = await completeAdventureQuest(questId, body.slice(0, 120));
        if (ok) {
          setHint("미션 완료! 모험으로 돌아가 별조각을 받아 보세요.");
        }
      } else {
        setHint("편지를 우체국에 맡겼어요.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-bedi-slate/8 bg-white/80 px-5 py-4 shadow-softer">
        <p className="text-[11px] tracking-wide text-bedi-sage">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-bedi-slate/75">
          {companionNote}
        </p>
        {hint ? (
          <p className="mt-3 rounded-xl bg-bedi-sage/10 px-3 py-2 text-xs leading-relaxed text-bedi-slate/70">
            {hint}{" "}
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

      <div className="rounded-2xl border border-bedi-slate/8 bg-white/90 px-5 py-4 shadow-softer">
        <p className="text-[11px] tracking-wide text-bedi-slate/40">
          새 편지 쓰기
        </p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="미래의 나에게, 또는 오늘 남기고 싶은 한 줄"
          className="mt-2 w-full resize-none rounded-xl border border-bedi-slate/10 bg-[#FBFAF7] px-3 py-2.5 text-sm text-bedi-slate outline-none focus:border-bedi-sage/40"
        />
        <button
          type="button"
          disabled={busy || !draft.trim()}
          onClick={() => void submitLetter()}
          className="mt-3 h-10 w-full rounded-xl bg-bedi-slate text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "맡기는 중…" : "우체국에 맡기기"}
        </button>
      </div>

      <ul className="space-y-3">
        {letters.map((letter: MemoryLetter) => (
          <li
            key={letter.id}
            className="rounded-2xl border border-bedi-slate/8 bg-white/90 px-5 py-4 shadow-softer"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[10px] tracking-wide text-bedi-slate/35">
                {kindHint[letter.kind]} · {formatStamp(letter.stampedAt)}
              </p>
              {letter.unread ? (
                <span className="text-[10px] text-bedi-rose">새 편지</span>
              ) : null}
            </div>
            <h2 className="mt-1 text-[15px] font-medium text-bedi-slate">
              {letter.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-bedi-slate/65">
              {letter.body}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
