import { requireGuardianUser } from "@/backend/shared/http/auth";
import { HttpError, withApiGuard } from "@/backend/shared/http/route";
import {
  getLetterForGuardian,
  saveLetterForGuardian,
} from "@/backend/features/growth-storybook/storybook-parent-letter.service";

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiGuard(
    async () => {
      const guardian = await requireGuardianUser();
      return getLetterForGuardian(guardian.id);
    },
    "편지를 불러오지 못했어요.",
    "[api/parent/storybook-letter GET]"
  );
}

export async function POST(request: Request) {
  return withApiGuard(
    async () => {
      const guardian = await requireGuardianUser();
      const body = (await request.json().catch(() => null)) as {
        bodyHtml?: string;
        signature?: string;
        date?: string;
        dischargeDate?: string;
        handwriting?: boolean;
        photoBase64?: string;
        photoContentType?: string;
      } | null;
      if (!body) throw new HttpError("편지 내용을 읽지 못했어요.", 400);

      const letter = await saveLetterForGuardian({
        guardianUserId: guardian.id,
        bodyHtml: body.bodyHtml ?? "",
        signature: body.signature ?? "",
        date: body.date,
        dischargeDate: body.dischargeDate,
        handwriting: body.handwriting,
        photoBase64: body.photoBase64,
        photoContentType: body.photoContentType,
      });
      return { letter };
    },
    "편지를 저장하지 못했어요.",
    "[api/parent/storybook-letter POST]"
  );
}
