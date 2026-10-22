import "server-only";
import { getConversationHistory } from "@/backend/features/conversation/conversation.store";

/**
 * The child's own recent chat lines — input for the guardian-text leak guard.
 * Read-only; never forwarded anywhere.
 *
 * `exclude` drops names that are not third parties from the guardian's point
 * of view (the child's own name, the companion's name) so they are not
 * mistaken for a friend's name.
 */
export async function recentChildWording(
  childUserId: string,
  options?: { limit?: number; exclude?: Array<string | null | undefined> }
): Promise<string[]> {
  const limit = options?.limit ?? 40;
  const exclude = (options?.exclude ?? [])
    .map((n) => (n ?? "").trim())
    .filter((n) => n.length >= 2);

  const history = await getConversationHistory(childUserId);
  return history
    .filter((m) => m.role === "user" && m.content.trim())
    .slice(-limit)
    .map((m) =>
      exclude.reduce((text, name) => text.split(name).join(" "), m.content)
    );
}
