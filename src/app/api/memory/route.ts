import { NextResponse } from "next/server";
import { getMemoryTimeline } from "@/backend/features/memory-timeline/memory-timeline.service";
import { getSessionUser } from "@/backend/shared/http/auth";

/**
 * API Bridge: AI Memory Timeline
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    const data = await getMemoryTimeline(user?.id);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[api/memory]", error);
    return NextResponse.json(
      { error: "기억 타임라인을 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}
