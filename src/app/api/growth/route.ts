import { NextResponse } from "next/server";
import { getGrowthJournal } from "@/backend/features/growth-journal/growth-journal.service";
import { getSessionUser } from "@/backend/shared/http/auth";

export const dynamic = "force-dynamic";

/**
 * API Bridge: Emotion & growth journal
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    const data = await getGrowthJournal(user?.id);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[api/growth]", error);
    return NextResponse.json(
      { error: "감정·성장 기록을 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}
