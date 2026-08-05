import { NextResponse } from "next/server";
import {
  UnauthorizedError,
  requireAuthUser,
  unauthorizedJson,
} from "@/backend/shared/http/auth";
import { sealGardenStorybook } from "@/backend/features/emotion-garden/emotion-garden.service";

/** Seal the garden into a storybook (discharge metaphor). */
export async function POST() {
  try {
    const user = await requireAuthUser();
    return NextResponse.json(await sealGardenStorybook(user.id));
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorizedJson(error);
    console.error("[api/garden/storybook]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "스토리북에 넣지 못했어요.",
      },
      { status: 400 }
    );
  }
}
