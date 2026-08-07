"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal, Sparkles } from "lucide-react";
import { ParentShell } from "@/frontend/features/parent/components/ParentShell";
import { EmptyState, ErrorState } from "@/frontend/features/parent/components/ParentUi";
import { cn } from "@/frontend/shared/lib/utils";
import type {
  ParentReportAnswer,
  ParentReportResponse,
} from "@/frontend/features/parent/types";

type ChatMessage =
  | { id: string; role: "assistant"; text: string; sources?: string[] }
  | { id: string; role: "user"; text: string };

function uid() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function ParentReportView({
  initial,
}: {
  initial: ParentReportResponse;
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState(
    () => initial.suggestedQuestions
  );
  const [askedQuestions, setAskedQuestions] = useState<string[]>(() =>
    initial.answer?.question ? [initial.answer.question] : []
  );
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const welcome: ChatMessage = {
      id: "welcome",
      role: "assistant",
      text: initial.childName
        ? `안녕하세요. ${initial.childName}의 하루를 요약해 드릴게요.\n기억·감정·모험만 보고 답하고, 대화 원문과 비밀 일기는 절대 보지 않아요.`
        : "안녕하세요. 아이의 하루를 요약해 드릴게요.",
    };
    if (!initial.answer) return [welcome];
    return [
      welcome,
      { id: uid(), role: "user", text: initial.answer.question },
      {
        id: uid(),
        role: "assistant",
        text: initial.answer.answer,
        sources: initial.answer.sources,
      },
    ];
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending, suggestions]);

  if (!initial.linked) {
    return (
      <ParentShell>
        <EmptyState
          title="연결된 아이가 없어요"
          description="아이와 연결한 뒤 AI 리포트를 볼 수 있어요."
        />
      </ParentShell>
    );
  }

  async function ask(nextQuestion: string) {
    const q = nextQuestion.trim();
    if (!q || pending) return;

    setDraft("");
    setError(null);
    setPending(true);
    setAskedQuestions((prev) => [...prev, q]);
    setMessages((prev) => [...prev, { id: uid(), role: "user", text: q }]);

    try {
      const res = await fetch("/api/parent/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = (await res.json()) as ParentReportResponse & {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "답변을 만들지 못했어요.");

      const answer: ParentReportAnswer | null = data.answer;
      if (Array.isArray(data.suggestedQuestions) && data.suggestedQuestions.length) {
        setSuggestions(data.suggestedQuestions);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          text: answer?.answer ?? "지금은 답변을 만들지 못했어요.",
          sources: answer?.sources,
        },
      ]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "답변을 만들지 못했어요.";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          text: `죄송해요. ${msg}`,
        },
      ]);
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  const lastIsAssistant =
    messages.length > 0 && messages[messages.length - 1]?.role === "assistant";
  const showSuggestions = !pending && lastIsAssistant;

  const visibleSuggestions = suggestions
    .filter((q) => !askedQuestions.includes(q))
    .slice(0, 4);
  const chips =
    visibleSuggestions.length > 0
      ? visibleSuggestions
      : suggestions.slice(0, 4);

  return (
    <ParentShell childName={initial.childName} moodEmoji="✨" hideContext>
      <div className="flex min-h-[calc(100vh-8rem)] flex-col">
        <div className="mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <Sparkles className="h-4 w-4" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-800">
                AI 리포트
              </h1>
              <p className="text-[12px] text-slate-400">
                요약만 · 원문 비공개
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pb-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[88%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed",
                  m.role === "user"
                    ? "rounded-br-md bg-slate-800 text-white"
                    : "rounded-bl-md border border-slate-200 bg-white/95 text-slate-700 shadow-sm"
                )}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.role === "assistant" && m.sources && m.sources.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {m.sources.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {pending ? (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white/95 px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-800/50" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-800/50 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-800/50 [animation-delay:300ms]" />
                  <span className="ml-1 text-[12px] text-slate-400">
                    정리하는 중…
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {showSuggestions && chips.length > 0 ? (
            <div className="pt-2">
              <p className="mb-2 text-[11px] tracking-wide text-slate-800/35">
                {askedQuestions.length === 0
                  ? "이런 질문을 해볼 수 있어요"
                  : "이어서 물어볼 수 있어요"}
              </p>
              <div className="flex flex-col gap-2">
                {chips.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={pending}
                    onClick={() => void ask(q)}
                    className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-left text-[13px] leading-snug text-slate-800/70 transition-colors hover:bg-slate-100 disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? <ErrorState message={error} /> : null}

          <div ref={bottomRef} />
        </div>

        <form
          className="sticky bottom-0 -mx-5 border-t border-slate-200 bg-gradient-to-t from-white via-white to-white px-5 pb-2 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(draft);
          }}
        >
          <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={1}
              placeholder="아이에게 대해 물어보세요"
              className="max-h-28 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[14px] text-slate-800 outline-none placeholder:text-slate-800/35"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask(draft);
                }
              }}
            />
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              aria-label="보내기"
              className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white disabled:opacity-40"
            >
              <SendHorizontal className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-800/30">
            Enter로 전송 · Shift+Enter 줄바꿈
          </p>
        </form>
      </div>
    </ParentShell>
  );
}
