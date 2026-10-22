import { requireAuthUser } from "@/backend/shared/http/auth";
import {
  listAlbum,
  uploadAlbumPhoto,
} from "@/backend/features/photo-album/photo-album.service";
import { assertChildConsented } from "@/backend/features/consent/consent.guard";
import { HttpError, withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/** List photo album items for the signed-in user. */
export async function GET() {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    return { photos: await listAlbum(user.id) };
  }, "사진첩을 불러오지 못했어요.", "[api/photos GET]");
}

/** Upload a photo (multipart or JSON base64). Optional questId links to adventure. */
export async function POST(request: Request) {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    await assertChildConsented(user.id);
    const contentType = request.headers.get("content-type") || "";

    let bytes: Buffer | null = null;
    let mime = "image/jpeg";
    let questId: string | undefined;
    let caption: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file") ?? form.get("photo");
      if (!(file instanceof File)) {
        throw new HttpError("사진 파일이 필요해요.", 400);
      }
      bytes = Buffer.from(await file.arrayBuffer());
      mime = file.type || "image/jpeg";
      const q = form.get("questId");
      if (typeof q === "string" && q.trim()) questId = q.trim();
      const c = form.get("caption");
      if (typeof c === "string" && c.trim()) caption = c.trim();
    } else {
      const body = (await request.json()) as {
        imageBase64?: string;
        contentType?: string;
        questId?: string;
        caption?: string;
      };
      const raw = body.imageBase64?.replace(/^data:[^;]+;base64,/, "") ?? "";
      if (!raw) throw new HttpError("사진 데이터가 필요해요.", 400);
      bytes = Buffer.from(raw, "base64");
      mime = body.contentType || "image/jpeg";
      questId = body.questId?.trim() || undefined;
      caption = body.caption?.trim() || undefined;
    }

    const photo = await uploadAlbumPhoto({
      userId: user.id,
      bytes: bytes!,
      contentType: mime,
      questId,
      caption,
    });

    return { photo };
  }, "사진을 올리지 못했어요.", "[api/photos POST]");
}
