import { createMapStore } from "@/backend/shared/persist/map-store";
import type {
  GrowthStorybookResponse,
  StorybookCover,
  StorybookPage,
  WishClosingPage,
  ParentLetterPage,
} from "./growth-storybook.types";

export interface SealedDischargeTale {
  /** Missing means the legacy flower-slide book. */
  engineVersion?: number;
  userId: string;
  sealedAt: string;
  cover: StorybookCover;
  opening: StorybookPage;
  pages: StorybookPage[];
  wishClosing: WishClosingPage | null;
  parentLetter?: ParentLetterPage | null;
  epilogue: StorybookPage;
  goodbye?: StorybookPage | null;
  flowerCount: number;
  wishCount: number;
}

export const STORYBOOK_ENGINE_VERSION = 2;

const store = createMapStore<SealedDischargeTale>("discharge-tales.json", {
  userIdKey: "userId",
});

interface StorybookProgress {
  userId: string;
  pageIndex: number;
  completed: boolean;
  updatedAt: string;
}

const progressStore = createMapStore<StorybookProgress>(
  "storybook-progress.json",
  { userIdKey: "userId" }
);

export async function getSealedDischargeTale(userId: string) {
  return (await store.get(userId)) ?? null;
}

export async function saveSealedDischargeTale(tale: SealedDischargeTale) {
  return store.set(tale.userId, tale);
}

export async function clearDischargeTale(userId: string) {
  await store.delete(userId);
  await progressStore.delete(userId);
}

export async function getStorybookProgress(userId: string) {
  return (await progressStore.get(userId)) ?? null;
}

export async function saveStorybookProgress(input: {
  userId: string;
  pageIndex: number;
  completed: boolean;
}) {
  return progressStore.set(input.userId, {
    ...input,
    pageIndex: Math.max(0, Math.floor(input.pageIndex)),
    updatedAt: new Date().toISOString(),
  });
}

export function taleToResponse(
  tale: SealedDischargeTale
): GrowthStorybookResponse {
  const pageCount =
    1 + // opening counted in pages visually but we track total
    tale.pages.length +
    (tale.wishClosing ? 1 : 0) +
    (tale.parentLetter ? 1 : 0) +
    1 + // ending / epilogue
    (tale.goodbye ? 1 : 0);

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
    parentLetter: tale.parentLetter ?? null,
    epilogue: tale.epilogue,
    goodbye: tale.goodbye ?? null,
    readingProgress: {
      pageIndex: 0,
      completed: false,
    },
  };
}
