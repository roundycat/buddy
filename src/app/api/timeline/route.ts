import { NextResponse } from "next/server";
import { getTimeline } from "@/backend/features/timeline/timeline.service";
import { getSessionUser } from "@/backend/shared/http/auth";

export const dynamic = "force-dynamic";

/**
 * API Bridge: Timeline
 * Frontend calls this route — never imports backend services directly.
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    const data = await getTimeline(user?.id);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[api/timeline]", error);
    return NextResponse.json(
      { error: "타임라인 데이터를 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}
