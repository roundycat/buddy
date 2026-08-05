/**
 * Memory Post — letters to/from self, companion, and hospital days.
 */

export type MemoryLetterKind = "to_self" | "from_friend" | "to_future" | "kept";

export interface MemoryLetter {
  id: string;
  kind: MemoryLetterKind;
  title: string;
  body: string;
  stampedAt: string;
  unread?: boolean;
}

export interface MemoryPostResponse {
  title: string;
  companionNote: string;
  letters: MemoryLetter[];
}
