/**
 * Storybook client API — reading progress, discharge composition, Polly narration.
 */

import type { GrowthStorybookResponse } from "@/frontend/shared/types/growth-storybook";
import { fetchJson } from "@/frontend/shared/api/fetch-json";

export async function patchStorybookProgress(input: {
  pageIndex: number;
  completed: boolean;
}): Promise<void> {
  await fetchJson<unknown>("/api/storybook/progress", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function composeStorybook(): Promise<GrowthStorybookResponse> {
  const fallback = "이야기 책을 완성하지 못했어요.";
  const data = await fetchJson<{ book?: GrowthStorybookResponse }>(
    "/api/storybook/compose",
    { method: "POST" },
    fallback
  );
  if (!data.book) throw new Error(fallback);
  return data.book;
}

/** Polly audio for one page; throws when the voice is unavailable. */
export async function narrateStorybook(text: string): Promise<Blob> {
  const response = await fetch("/api/storybook/narrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error("polly unavailable");
  return response.blob();
}
