import { NextResponse } from "next/server";
import { requireChildUser } from "@/backend/shared/http/auth";
import { HttpError, withApiGuard } from "@/backend/shared/http/route";
import { synthesizeStorybookNarration } from "@/backend/features/growth-storybook/storybook-narration.service";
import { env } from "@/backend/shared/config/env";
import { assertChildConsented } from "@/backend/features/consent/consent.guard";

export async function POST(request: Request) {
  return withApiGuard(
    async () => {
      const user = await requireChildUser();
      await assertChildConsented(user);
      // Without Polly the device reads the story aloud (speechSynthesis fallback).
      if (env.ttsProvider !== "polly") {
        throw new HttpError("이 기기에서 바로 읽어 줄게요.", 503);
      }
      const body = (await request.json().catch(() => null)) as {
        text?: string;
      } | null;
      if (!body?.text?.trim()) {
        throw new HttpError("읽을 이야기가 없어요.", 400);
      }
      const audio = await synthesizeStorybookNarration(body.text);
      return new NextResponse(new Uint8Array(audio), {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "private, max-age=3600",
        },
      });
    },
    "Beddy가 지금은 읽어 주지 못했어요.",
    "[api/storybook/narrate POST]"
  );
}
