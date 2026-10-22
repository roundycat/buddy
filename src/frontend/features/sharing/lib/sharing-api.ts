/**
 * Child sharing client API — share choices and concern consent answers.
 */

import type {
  ShareCategory,
  ShareChoice,
  ShareChoices,
} from "@/backend/features/sharing/sharing.types";
import { fetchJson } from "@/frontend/shared/api/fetch-json";

export async function patchShareChoice(
  category: ShareCategory,
  choice: ShareChoice
): Promise<ShareChoices> {
  const data = await fetchJson<{ choices: ShareChoices }>(
    "/api/sharing",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choices: { [category]: choice } }),
    },
    "나누기 설정을 저장하지 못했어요."
  );
  return data.choices;
}

export interface ChildConcernRequest {
  id: string;
  summary: string;
  status: "pending" | "approved" | "declined";
  createdAt: string;
}

export async function fetchPendingConcern(): Promise<ChildConcernRequest | null> {
  const data = await fetchJson<{ request: ChildConcernRequest | null }>(
    "/api/sharing/concern",
    { cache: "no-store" },
    "질문을 불러오지 못했어요."
  );
  return data.request;
}

export async function answerConcern(
  requestId: string,
  approve: boolean
): Promise<ChildConcernRequest | null> {
  const data = await fetchJson<{ request: ChildConcernRequest | null }>(
    "/api/sharing/concern",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, approve }),
    },
    "대답을 저장하지 못했어요."
  );
  return data.request;
}
