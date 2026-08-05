"use client";

import { FormEvent, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import type { ConversationMessageDto } from "@/frontend/shared/types/api";

const SUGGESTIONS = [
  { label: "피곤해요", send: "오늘 조금 피곤해요" },
  { label: "얘기하고 싶어요", send: "그냥 얘기하고 싶어요" },
  { label: "불안해요", send: "불안한 기분이 들어요" },
] as const;

interface CompanionInlineChatProps {
  companionName: string;
  prompt: string;
  messages: ConversationMessageDto[];
  pending: boolean;
  onSend: (text: string) => Promise<void> | Promise<boolean>;
  onOpenSheet: () => void;
}

/**
 * Bottom dock only — full conversation opens in the sheet
 * so the mobile keyboard does not shove the waiting-room layout.
 */
export function CompanionInlineChat({
  companionName,
  prompt,
  messages,
  pending,
  onSend,
  onOpenSheet,
}: CompanionInlineChatProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const conversation = messages.filter((m) => !m.id.startsWith("welcome-"));
  const lastAssistant = [...conversation]
    .reverse()
    .find((m) => m.role === "assistant");
  const shortPrompt =
    prompt.split(/[.?!。？！]/)[0]?.trim() ||
    "오늘 하루, 나랑 조금만 이야기해줄래?";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    onOpenSheet();
    await onSend(text);
  }

  async function sendSuggestion(text: string) {
    if (pending) return;
    onOpenSheet();
    await onSend(text);
  }

  return (
    <div
      className="w-full max-w-sm"
      style={{ animation: "chat-teaser-in 0.4s ease-out" }}
    >
      <div className="rounded-2xl border border-bedi-slate/10 bg-white/95 px-3 pb-3 pt-2.5 shadow-softer backdrop-blur-sm">
        <button
          type="button"
          onClick={onOpenSheet}
          className="flex w-full items-start gap-2 rounded-xl px-1 py-1 text-left transition-colors hover:bg-bedi-mist/40"
          aria-label="대화 열기"
        >
          <MessageCircle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bedi-sage"
            strokeWidth={1.75}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] tracking-wide text-bedi-sage">
              {companionName}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-bedi-slate/80">
              {pending
                ? "듣고 있어요…"
                : lastAssistant?.content || shortPrompt}
            </p>
          </div>
        </button>

        {conversation.length === 0 && !pending ? (
          <div className="mt-2 flex flex-wrap gap-1.5 px-0.5">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion.send}
                type="button"
                disabled={pending}
                onClick={() => void sendSuggestion(suggestion.send)}
                className="min-h-11 rounded-full bg-bedi-mist/60 px-3 text-[12px] text-bedi-slate/60 transition-colors hover:bg-bedi-mist hover:text-bedi-slate disabled:opacity-50"
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-2 flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onFocus={onOpenSheet}
            placeholder="한 마디 남겨 보세요…"
            disabled={pending}
            enterKeyHint="send"
            className="h-10 flex-1 rounded-full border border-bedi-slate/10 bg-white px-3.5 text-sm text-bedi-slate outline-none transition-colors placeholder:text-bedi-slate/35 focus:border-bedi-sage/50 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            aria-label="메시지 보내기"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bedi-slate text-white transition-colors hover:bg-bedi-slate/90 disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </form>
      </div>
    </div>
  );
}
