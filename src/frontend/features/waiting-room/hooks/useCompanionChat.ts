"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ConversationCrisisDto,
  ConversationMessageDto,
} from "@/frontend/shared/types/api";

function welcomeMessages(
  greeting: string,
  companionMessage: string
): ConversationMessageDto[] {
  return [
    {
      id: "welcome-1",
      role: "assistant",
      content: greeting,
      createdAt: new Date().toISOString(),
    },
    {
      id: "welcome-2",
      role: "assistant",
      content: companionMessage,
      createdAt: new Date().toISOString(),
    },
  ];
}

export function useCompanionChat(
  greeting: string,
  companionMessage: string,
  enabled = true
) {
  const [messages, setMessages] = useState<ConversationMessageDto[]>(() =>
    welcomeMessages(greeting, companionMessage)
  );
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [crisis, setCrisis] = useState<ConversationCrisisDto | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const controller = new AbortController();

    async function loadHistory() {
      try {
        const res = await fetch("/api/conversation", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          messages?: ConversationMessageDto[];
        };
        if (cancelled) return;

        if (data.messages && data.messages.length > 0) {
          setMessages([
            ...welcomeMessages(greeting, companionMessage),
            ...data.messages,
          ]);
        } else {
          setMessages(welcomeMessages(greeting, companionMessage));
        }
      } catch {
        if (!cancelled) {
          setMessages(welcomeMessages(greeting, companionMessage));
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, greeting, companionMessage]);

  const dismissCrisis = useCallback(() => setCrisis(null), []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pendingRef.current) return false;

    const userMessage: ConversationMessageDto = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    const streamId = `msg-stream-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: streamId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      },
    ]);
    pendingRef.current = true;
    setPending(true);

    try {
      const res = await fetch("/api/conversation?stream=1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) throw new Error("대화 실패");

      // Non-stream JSON fallback
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/event-stream")) {
        const data = (await res.json()) as {
          reply: ConversationMessageDto;
          crisis?: ConversationCrisisDto;
        };
        setMessages((prev) =>
          prev.map((m) => (m.id === streamId ? data.reply : m))
        );
        if (data.crisis) setCrisis(data.crisis);
        return true;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("스트림 없음");

      const decoder = new TextDecoder();
      let buffer = "";
      let assembled = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part
            .split("\n")
            .find((l) => l.startsWith("data:"));
          if (!line) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;

          try {
            const event = JSON.parse(payload) as {
              type?: string;
              text?: string;
              reply?: ConversationMessageDto;
              message?: string;
              level?: string;
              empathyHint?: string;
              guidance?: string;
              transparency?: string;
              actions?: ConversationCrisisDto["actions"];
            };

            if (event.type === "crisis" && event.empathyHint && event.actions) {
              setCrisis({
                level: event.level ?? "elevated",
                empathyHint: event.empathyHint,
                guidance: event.guidance,
                transparency: event.transparency,
                actions: event.actions,
              });
            } else if (event.type === "token" && event.text) {
              assembled += event.text;
              const snapshot = assembled;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamId ? { ...m, content: snapshot } : m
                )
              );
            } else if (event.type === "done" && event.reply) {
              setMessages((prev) =>
                prev.map((m) => (m.id === streamId ? event.reply! : m))
              );
            } else if (event.type === "error") {
              throw new Error(event.message ?? "대화 실패");
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }

      if (!assembled.trim()) {
        throw new Error("빈 응답");
      }
      return true;
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamId
            ? {
                ...m,
                content: "잠시 연결이 불안정해. 조금 뒤에 다시 말해 줘.",
              }
            : m
        )
      );
      return false;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, []);

  return { messages, pending, loaded, send, crisis, dismissCrisis };
}
