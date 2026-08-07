import "server-only";
import { createMapStore } from "@/backend/shared/persist/map-store";
import { createBlobStore } from "@/backend/shared/persist/blob-store";
import type { ParentLetterPage } from "./growth-storybook.types";

export interface StoredStorybookParentLetter extends ParentLetterPage {
  childUserId: string;
  guardianUserId: string;
  updatedAt: string;
  hasPhoto?: boolean;
  photoContentType?: string;
  /** Set when the parent sends — letter is already on the child's book. */
  sentAt?: string;
}

const store = createMapStore<StoredStorybookParentLetter>(
  "storybook-parent-letters.json",
  { userIdKey: "childUserId" }
);

const photos = createBlobStore({
  prefix: "storybook-parent-letters",
  localSubdir: "storybook-parent-letters",
  feature: "storybook-parent-letter",
});

export async function getStorybookParentLetter(childUserId: string) {
  return (await store.get(childUserId)) ?? null;
}

export async function saveStorybookParentLetter(
  letter: StoredStorybookParentLetter
) {
  return store.set(letter.childUserId, letter);
}

export async function saveStorybookParentLetterPhoto(
  childUserId: string,
  bytes: Buffer,
  contentType: string
) {
  return photos.save(childUserId, "letter-photo", bytes, contentType);
}

export async function readStorybookParentLetterPhoto(childUserId: string) {
  const letter = await getStorybookParentLetter(childUserId);
  if (!letter?.hasPhoto) return null;
  const bytes = await photos.read(childUserId, "letter-photo");
  if (!bytes) return null;
  return {
    bytes,
    contentType: letter.photoContentType ?? "image/jpeg",
  };
}

export async function clearStorybookParentLetter(childUserId: string) {
  await photos.remove(childUserId, "letter-photo");
  await store.delete(childUserId);
}
