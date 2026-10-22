import {
  sendMessage,
  listConversation,
  streamMessage,
} from "@/backend/features/conversation/conversation.service";
import {
  requireAuthUser,
  UnauthorizedError,
} from "@/backend/shared/http/auth";
import { HttpError, readJsonBody, withApiGuard } from "@/backend/shared/http/route";
import { allowRequest, CHILD_CHAT_LIMITS } from "@/backend/shared/http/rate-limit";
import { DomainError, domainStatus } from "@/backend/shared/http/domain-error";
import { assertChildConsented } from "@/backend/features/consent/consent.guard";

const SLOW_DOWN = "오늘 이야기를 정말 많이 나눴어! 조금 쉬었다가 다시 이야기하자.";

/**
 * API Bridge: Conversation
 * Persona-aware chat with server-side history + learning memory.
 * POST Accept: text/event-stream → SSE token stream.
 */

export async function GET() {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    return listConversation(user.id);
  }, "대화 기록을 불러올 수 없습니다.", "[api/conversation GET]");
}

export async function POST(request: Request) {
  const wantsStream =
    request.headers.get("accept")?.includes("text/event-stream") ||
    new URL(request.url).searchParams.get("stream") === "1";

  if (wantsStream) {
    return streamConversation(request);
  }

  return withApiGuard(async () => {
    const user = await requireAuthUser();
    // Under-14 children talk to the AI only after legal-guardian consent.
    await assertChildConsented(user.id);
    const body = await readJsonBody<{ message?: unknown; history?: unknown }>(
      request
    );
    const message = typeof body?.message === "string" ? body.message : "";

    if (!message.trim()) {
      throw new HttpError("메시지를 입력해 주세요.", 400);
    }
    if (!allowRequest(`chat:${user.id}`, CHILD_CHAT_LIMITS)) {
      throw new HttpError(SLOW_DOWN, 429);
    }

    return sendMessage({
      message,
      history: Array.isArray(body?.history) ? body.history : undefined,
      userId: user.id,
    });
  }, "대화를 이어갈 수 없습니다.", "[api/conversation POST]");
}

async function streamConversation(request: Request) {
  try {
    const user = await requireAuthUser();
    // Checked before the stream starts so the client gets a real 403.
    await assertChildConsented(user.id);
    const body = await readJsonBody<{ message?: unknown; history?: unknown }>(
      request
    );
    const message = typeof body?.message === "string" ? body.message : "";

    if (!message.trim()) {
      return new Response(JSON.stringify({ error: "메시지를 입력해 주세요." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!allowRequest(`chat:${user.id}`, CHILD_CHAT_LIMITS)) {
      return new Response(JSON.stringify({ error: SLOW_DOWN }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    let closed = false;
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: string): boolean => {
          if (closed) return false;
          try {
            controller.enqueue(encoder.encode(data));
            return true;
          } catch {
            closed = true;
            return false;
          }
        };
        const events = streamMessage({
          message,
          history: Array.isArray(body?.history) ? body.history : undefined,
          userId: user.id,
        });
        try {
          for await (const event of events) {
            // The child left: leaving the loop closes the generator, which still
            // saves the turn (the safety writes never waited for the stream).
            if (!send(`data: ${JSON.stringify(event)}\n\n`)) break;
          }
          send("data: [DONE]\n\n");
        } catch (error) {
          console.error("[api/conversation stream]", error);
          send(
            `data: ${JSON.stringify({
              type: "error",
              message: "대화를 이어갈 수 없습니다.",
            })}\n\n`
          );
        } finally {
          if (!closed) {
            closed = true;
            try {
              controller.close();
            } catch {
              /* already closed by the client */
            }
          }
        }
      },
      cancel() {
        closed = true;
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[api/conversation stream auth]", error);
    if (error instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (error instanceof HttpError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (error instanceof DomainError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: domainStatus(error),
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ error: "대화를 이어갈 수 없습니다." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
