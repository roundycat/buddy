/**
 * Confirm which crayon avatar candidate becomes the active persona image.
 */

import { fetchJson } from "@/frontend/shared/api/fetch-json";

export type AvatarSelectResult = {
  avatarUrl?: string;
  /** False for a bundled drawing — no "AI로 그렸어요" label then. */
  avatarAiMade?: boolean;
};

export async function selectAvatarChoice(
  choiceId: string
): Promise<AvatarSelectResult> {
  return fetchJson<AvatarSelectResult>(
    "/api/persona/avatar/select",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId: choiceId }),
    },
    "선택한 그림을 저장하지 못했어요."
  );
}
