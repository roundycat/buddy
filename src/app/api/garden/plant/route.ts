import { NextResponse } from "next/server";
import {
  UnauthorizedError,
  requireAuthUser,
  unauthorizedJson,
} from "@/backend/shared/http/auth";
import { plantTodayMood } from "@/backend/features/emotion-garden/emotion-garden.service";
import type { MoodId } from "@/backend/features/emotion-garden/emotion-garden.types";

const MOODS: MoodId[] = ["happy", "sad", "sleepy", "angry", "love"];

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = (await request.json()) as { mood?: string };
    const mood = body.mood as MoodId;
    if (!MOODS.includes(mood)) {
      return NextResponse.json(
        { error: "오늘 기분을 선택해 주세요." },
        { status: 400 }
      );
    }

    return NextResponse.json(await plantTodayMood(user.id, mood));
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorizedJson(error);
    console.error("[api/garden/plant]", error);
    const message =
      error instanceof Error ? error.message : "꽃을 피우지 못했어요.";
    const isClient =
      /이미|선택|스토리북|심을 수/.test(message);
    return NextResponse.json(
      { error: message },
      { status: isClient ? 400 : 500 }
    );
  }
}
