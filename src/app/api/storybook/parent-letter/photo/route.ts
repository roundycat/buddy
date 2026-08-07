import { NextResponse } from "next/server";
import { requireAuthUser } from "@/backend/shared/http/auth";
import { resolveLinkedChildUserId } from "@/backend/features/guardian-link/guardian-link.service";
import {
  getStorybookParentLetter,
  readStorybookParentLetterPhoto,
} from "@/backend/features/growth-storybook/storybook-parent-letter.store";
import { isParentLetterUnlocked } from "@/backend/features/growth-storybook/storybook-parent-letter.service";
import { HttpError, withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiGuard(
    async () => {
      const user = await requireAuthUser();
      const childUserId =
        user.role === "guardian"
          ? await resolveLinkedChildUserId(user.id)
          : user.id;
      if (!childUserId) throw new HttpError("아이와 연결해 주세요.", 404);

      const letter = await getStorybookParentLetter(childUserId);
      if (!letter?.hasPhoto) {
        throw new HttpError("편지 사진을 찾을 수 없어요.", 404);
      }

      // Children only get the photo after discharge unlock; guardians always can.
      if (
        user.role !== "guardian" &&
        !isParentLetterUnlocked(letter.dischargeDate)
      ) {
        throw new HttpError(
          "아직 편지를 열 수 있는 날이 아니에요. 퇴원 예정일을 기다려 주세요.",
          403
        );
      }

      const photo = await readStorybookParentLetterPhoto(childUserId);
      if (!photo) throw new HttpError("편지 사진을 찾을 수 없어요.", 404);
      return new NextResponse(new Uint8Array(photo.bytes), {
        headers: {
          "Content-Type": photo.contentType,
          "Cache-Control": "private, max-age=300",
        },
      });
    },
    "편지 사진을 불러오지 못했어요.",
    "[api/storybook/parent-letter/photo GET]"
  );
}