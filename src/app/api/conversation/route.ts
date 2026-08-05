import {
  sendMessage,
  listConversation,
  streamMessage,
} from "@/backend/features/conversation/conversation.service";
import { requireAuthUser } from "@/backend/shared/http/auth";
import { HttpError, readJsonBody, withApiGuard } from "@/backend/shared/http/route";

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
    const body = await readJsonBody<{ message?: unknown; history?: unknown }>(
      request
    );
    const message = typeof body?.message === "string" ? body.message : "";

    if (!message.trim()) {
      throw new HttpError("메시지를 입력해 주세요.", 400);
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

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of streamMessage({
            message,
            history: Array.isArray(body?.history) ? body.history : undefined,
            userId: user.id,
          })) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("[api/conversation stream]", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                message: "대화를 이어갈 수 없습니다.",
              })}\n\n`
            )
          );
          controller.close();
        }
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
    return new Response(
      JSON.stringify({ error: "대화를 이어갈 수 없습니다." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
