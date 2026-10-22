import "server-only";
import { getConversationHistory } from "@/backend/features/conversation/conversation.store";
import { listWishes } from "@/backend/features/wish-tree/wish-tree.store";
import { listDiaryEntriesForUser } from "@/backend/features/picture-diary/picture-diary.store";
import { listPhotosForUser } from "@/backend/features/photo-album/photo-album.store";
import { listAdventurePacksForUser } from "@/backend/features/adventure-quest/adventure-quest.store";
import { getPersonaForUser } from "@/backend/features/persona/persona.store";
import { freeTextChoices } from "@/shared/onboarding/profile-options";

/**
 * The child's own words — the reference the guardian-text leak guard checks
 * against. Read-only; never forwarded anywhere.
 *
 * Chat lines plus everything else the child wrote: wishes, picture-diary text,
 * photo captions, adventure notes, and what they typed under "기타" in the
 * onboarding survey (chip labels are the app's words and are left out).
 *
 * `exclude` drops names that are not third parties from the guardian's point
 * of view (the child's own name, the companion's name) so they are not
 * mistaken for a friend's name.
 */
const MAX_LINE = 300;

export async function recentChildWording(
  childUserId: string,
  options?: { limit?: number; exclude?: Array<string | null | undefined> }
): Promise<string[]> {
  const limit = options?.limit ?? 40;
  const exclude = (options?.exclude ?? [])
    .map((n) => (n ?? "").trim())
    .filter((n) => n.length >= 2);

  const [history, wishes, diary, photos, packs, persona] = await Promise.all([
    getConversationHistory(childUserId),
    listWishes(childUserId).catch(() => []),
    listDiaryEntriesForUser(childUserId).catch(() => []),
    listPhotosForUser(childUserId).catch(() => []),
    listAdventurePacksForUser(childUserId).catch(() => []),
    getPersonaForUser(childUserId).catch(() => null),
  ]);

  const chat = history
    .filter((m) => m.role === "user" && m.content.trim())
    .slice(-limit)
    .map((m) => m.content);
  const typed = [
    ...wishes.slice(-20).map((w) => w.text),
    ...diary.slice(0, 20).map((d) => d.text ?? ""),
    ...photos.slice(-20).map((p) => p.caption ?? ""),
    ...packs
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7)
      .flatMap((p) => p.quests.map((q) => q.progress?.note ?? "")),
    ...(persona?.self
      ? [
          persona.self.disposition,
          persona.self.strengthsWeaknesses,
          persona.self.stressRelief,
          persona.self.hobbies,
          persona.self.favoriteHobby,
          persona.self.mainActivity,
          persona.self.favoriteFood,
        ].flatMap((v) => freeTextChoices(v))
      : []),
  ];

  return [...chat, ...typed]
    .map((text) => text.trim().slice(0, MAX_LINE))
    .filter(Boolean)
    .map((text) => exclude.reduce((t, name) => t.split(name).join(" "), text));
}
