import { createMapStore } from "@/backend/shared/persist/map-store";
import type {
  GrowthStorybookResponse,
  StorybookCover,
  StorybookPage,
  WishClosingPage,
} from "./growth-storybook.types";

export interface SealedDischargeTale {
  userId: string;
  sealedAt: string;
  cover: StorybookCover;
  opening: StorybookPage;
  pages: StorybookPage[];
  wishClosing: WishClosingPage | null;
  epilogue: StorybookPage;
  flowerCount: number;
  wishCount: number;
}

const store = createMapStore<SealedDischargeTale>("discharge-tales.json", {
  userIdKey: "userId",
});

export async function getSealedDischargeTale(userId: string) {
  return (await store.get(userId)) ?? null;
}

export async function saveSealedDischargeTale(tale: SealedDischargeTale) {
  return store.set(tale.userId, tale);
}

export async function clearDischargeTale(userId: string) {
  await store.delete(userId);
}

export function taleToResponse(
  tale: SealedDischargeTale
): GrowthStorybookResponse {
  const pageCount =
    1 + // opening counted in pages visually but we track total
    tale.pages.length +
    (tale.wishClosing ? 1 : 0) +
    1; // epilogue

  return {
    title: tale.cover.title,
    companionNote: tale.cover.dedication,
    sealed: true,
    sealedAt: tale.sealedAt,
    pageCount,
    flowerCount: tale.flowerCount,
    wishCount: tale.wishCount,
    cover: tale.cover,
    opening: tale.opening,
    pages: tale.pages,
    wishClosing: tale.wishClosing,
    epilogue: tale.epilogue,
  };
}
