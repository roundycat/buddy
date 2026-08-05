"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { cn } from "@/frontend/shared/lib/utils";
import type { ConversationMessageDto } from "@/frontend/shared/types/api";

const SUGGESTIONS = [
  "오늘 조금 피곤해요",
  "그냥 얘기하고 싶어요",
  "불안한 기분이 들어요",
  "옆에 있어 줄래요?",
];

export interface CompanionChatSheetProps {
  open: boolean;
  onClose: () => void;
  companionName: string;
  messages: ConversationMessageDto[];
  pending: boolean;
  loaded: boolean;
  onSend: (text: string) => Promise<void> | Promise<boolean>;
  onSpeakingChange?: (speaking: boolean) => void;
}

export function CompanionChatSheet({
  open,
  onClose,
  companionName,
  messages,
  pending,
  loaded,
  onSend,
  onSpeakingChange,
}: CompanionChatSheetProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, pending, open, loaded]);

  useEffect(() => {
    onSpeakingChange?.(pending);
  }, [pending, onSpeakingChange]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    void onSend(text);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`${companionName}와 대화`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-bedi-slate/20 backdrop-blur-[2px]"
        aria-label="대화 닫기"
        onClick={onClose}
      />

      <div className="chat-sheet relative z-10 flex max-h-[min(78dvh,640px)] w-full max-w-lg flex-col rounded-t-3xl bg-[#FBFAF7] shadow-soft sm:max-h-[85vh] sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-bedi-slate/8 px-5 py-3">
          <div>
            <p className="text-xs tracking-[0.14em] text-bedi-slate/40">
              페르소나 대화
            </p>
            <p className="mt-0.5 text-sm font-medium text-bedi-slate">
              {companionName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-bedi-slate/40 hover:bg-bedi-slate/5 hover:text-bedi-slate"
            aria-label="닫기"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
          {messages.map((message) => {
            const isAssistant = message.role === "assistant";
            const isStreamingEmpty =
              isAssistant && pending && !message.content.trim();
            if (isStreamingEmpty) return null;

            return (
              <div
                key={message.id}
                className={cn("flex", isAssistant ? "justify-start" : "justify-end")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    isAssistant
                      ? "rounded-tl-md border border-bedi-slate/8 bg-white text-bedi-slate"
                      : "rounded-tr-md bg-bedi-slate text-white"
                  )}
                >
                  {message.content}
                </div>
              </div>
            );
          })}

          {pending && (
            <div className="flex justify-start" aria-live="polite">
              <div className="rounded-2xl rounded-tl-md border border-bedi-slate/8 bg-white px-4 py-3">
                <span className="inline-flex gap-1" aria-label="입력 중">
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-bedi-sage" />
                  <span className="typing-dot typing-dot-2 h-1.5 w-1.5 rounded-full bg-bedi-sage" />
                  <span className="typing-dot typing-dot-3 h-1.5 w-1.5 rounded-full bg-bedi-sage" />
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 space-y-2.5 border-t border-bedi-slate/8 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {messages.filter((m) => !m.id.startsWith("welcome-")).length === 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={pending}
                  onClick={() => void onSend(suggestion)}
                  className="min-h-11 rounded-full border border-bedi-slate/10 bg-white px-3 py-2 text-xs text-bedi-slate/60 transition-colors hover:border-bedi-sage/40 hover:text-bedi-slate disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="답장을 적어 보세요…"
              disabled={pending}
              enterKeyHint="send"
              className="h-11 flex-1 rounded-full border border-bedi-slate/10 bg-white px-4 text-sm text-bedi-slate outline-none transition-colors placeholder:text-bedi-slate/35 focus:border-bedi-sage/50 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              aria-label="메시지 보내기"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-bedi-slate text-white transition-colors hover:bg-bedi-slate/90 disabled:opacity-40"
            >
              <Send className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
