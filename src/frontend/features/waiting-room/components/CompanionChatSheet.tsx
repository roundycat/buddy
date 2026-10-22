"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { HeartHandshake, Mic, Phone, Send, ShieldAlert, Siren, Square, Stethoscope, UserRound, Volume2, X } from "lucide-react";
import { useSpeechInput, useSpeechOutput } from "@/frontend/features/waiting-room/hooks/useSpeech";
import { cn } from "@/frontend/shared/lib/utils";
import type {
  ConversationCrisisDto,
  ConversationMessageDto,
} from "@/frontend/shared/types/api";
import { topic } from "@/shared/text/josa";
import { MAX_CHAT_MESSAGE_CHARS } from "@/shared/chat/limits";

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
  crisis?: ConversationCrisisDto | null;
  onDismissCrisis?: () => void;
}

function actionIcon(id: string) {
  switch (id) {
    case "notify_guardian":
      return UserRound;
    case "notify_nurse":
      return Stethoscope;
    case "counseling":
      return Phone;
    case "emergency":
      return Siren;
    case "social_worker":
      return HeartHandshake;
    case "police":
      return ShieldAlert;
    default:
      return Phone;
  }
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
  crisis,
  onDismissCrisis,
}: CompanionChatSheetProps) {
  const [input, setInput] = useState("");
  const voiceIn = useSpeechInput((text) => setInput(text.slice(0, MAX_CHAT_MESSAGE_CHARS)));
  const voiceOut = useSpeechOutput();
  const [actionNote, setActionNote] = useState<string | null>(null);
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
  }, [messages, pending, open, loaded, crisis, actionNote]);

  useEffect(() => {
    onSpeakingChange?.(pending);
  }, [pending, onSpeakingChange]);

  useEffect(() => {
    if (crisis) setActionNote(null);
  }, [crisis]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    void onSend(text);
  }

  function handleAction(action: ConversationCrisisDto["actions"][number]) {
    if (action.href) {
      window.location.href = action.href;
      return;
    }
    if (action.id === "notify_guardian") {
      setActionNote(
        "보호자에게는 이미 '도움이 필요하다'는 신호만 갔어요. 옆에 계시면 지금 마음이 힘들다고 직접 말해 주세요."
      );
      return;
    }
    if (action.id === "notify_nurse") {
      setActionNote(
        "병실·복도에 있는 간호사 선생님께 가서 “지금 기분이 많이 힘들어요. 도와주세요”라고 말해 주세요."
      );
      return;
    }
    setActionNote(action.hint);
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
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-bedi-slate">
              {companionName}
              <span className="rounded-full bg-bedi-sage/15 px-1.5 py-0.5 text-[10px] font-medium text-bedi-sage">
                AI 친구
              </span>
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
          <p className="rounded-xl bg-bedi-slate/[0.04] px-3 py-2 text-[11px] leading-relaxed text-bedi-slate/55">
            {topic(companionName)} 사람이 아닌 AI 친구예요. 아프거나 무섭거나 위험할 때는 꼭
            간호사 선생님이나 곁에 있는 어른에게 말해 줘요.
          </p>
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
                  {isAssistant && voiceOut.supported && message.content.trim() ? (
                    <button
                      type="button"
                      onClick={() => voiceOut.speak(message.id, message.content)}
                      className="mt-1.5 flex min-h-8 items-center gap-1 text-[11px] text-bedi-slate/45 hover:text-bedi-slate/70"
                      aria-label={voiceOut.speakingId === message.id ? "읽기 멈추기" : "소리로 듣기"}
                    >
                      <Volume2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {voiceOut.speakingId === message.id ? "멈추기" : "소리로 듣기"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}

          {crisis ? (
            <div
              className="rounded-2xl border border-rose-200/70 bg-rose-50/80 px-4 py-3"
              role="region"
              aria-label="도움 받기"
            >
              <p className="text-sm leading-relaxed text-bedi-slate">
                {crisis.empathyHint}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-bedi-slate/70">
                {crisis.guidance ??
                  "이런 마음은 혼자 견디지 않아도 괜찮아. 지금 엄마, 아빠, 보호자나 간호사 선생님께 이야기해 보자."}
              </p>
              {crisis.transparency ? (
                <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-bedi-slate/65">
                  {crisis.transparency}
                </p>
              ) : null}
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {crisis.actions.map((action) => {
                  const Icon = actionIcon(action.id);
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleAction(action)}
                      className="flex min-h-11 items-center gap-2 rounded-xl border border-bedi-slate/10 bg-white px-3 py-2.5 text-left text-xs font-medium text-bedi-slate transition-colors hover:border-bedi-sage/40"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-bedi-slate/50" />
                      <span>{action.label}</span>
                    </button>
                  );
                })}
              </div>
              {actionNote ? (
                <p className="mt-3 text-xs leading-relaxed text-bedi-slate/75">
                  {actionNote}
                </p>
              ) : null}
              {onDismissCrisis ? (
                <button
                  type="button"
                  onClick={onDismissCrisis}
                  className="mt-3 text-[11px] text-bedi-slate/45 underline-offset-2 hover:underline"
                >
                  도움 안내 접기
                </button>
              ) : null}
            </div>
          ) : null}

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
              maxLength={MAX_CHAT_MESSAGE_CHARS}
              placeholder="답장을 적어 보세요…"
              disabled={pending}
              enterKeyHint="send"
              className="h-11 flex-1 rounded-full border border-bedi-slate/10 bg-white px-4 text-sm text-bedi-slate outline-none transition-colors placeholder:text-bedi-slate/35 focus:border-bedi-sage/50 disabled:opacity-60"
            />
            {voiceIn.supported ? (
              <button
                type="button"
                onClick={() => (voiceIn.listening ? voiceIn.stop() : voiceIn.start())}
                disabled={pending}
                aria-label={voiceIn.listening ? "말하기 멈추기" : "말로 하기"}
                aria-pressed={voiceIn.listening}
                className={cn(
                  "inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors disabled:opacity-40",
                  voiceIn.listening
                    ? "border-rose-200 bg-rose-50 text-rose-500"
                    : "border-bedi-slate/10 bg-white text-bedi-slate/55 hover:text-bedi-slate"
                )}
              >
                {voiceIn.listening ? (
                  <Square className="h-3.5 w-3.5" strokeWidth={2} />
                ) : (
                  <Mic className="h-4 w-4" strokeWidth={1.75} />
                )}
              </button>
            ) : null}
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
