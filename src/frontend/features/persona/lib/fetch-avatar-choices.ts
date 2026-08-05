/**
 * Shared avatar choice fetch — two parallel slots under CloudFront timeout.
 */

export type AvatarChoice = { id: string; url: string };

export type AvatarDrawProgress = {
  done: number;
  total: number;
  /** Fixed slot positions (0 / 1) so cards don't jump as each finishes */
  slots: Array<AvatarChoice | null>;
  choices: AvatarChoice[];
};

export async function fetchAvatarChoices(
  stamp = Date.now(),
  onProgress?: (progress: AvatarDrawProgress) => void
): Promise<{ choices: AvatarChoice[]; error?: string }> {
  const total = 2;
  const slots: Array<AvatarChoice | null> = [null, null];
  const errors: string[] = [];
  let settled = 0;

  function emit() {
    const choices = slots.filter((c): c is AvatarChoice =>
      Boolean(c?.id && c?.url)
    );
    onProgress?.({
      done: settled,
      total,
      slots: [...slots],
      choices,
    });
  }

  onProgress?.({ done: 0, total, slots: [null, null], choices: [] });

  async function runSlot(slot: number) {
    try {
      const res = await fetch("/api/persona/avatar/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot, stamp }),
      });
      const data = (await res.json()) as {
        error?: string;
        avatarChoices?: AvatarChoice[];
      };
      if (!res.ok) {
        errors.push(data?.error ?? "그림을 그리지 못했어요.");
        return;
      }
      const chunk = Array.isArray(data?.avatarChoices) ? data.avatarChoices : [];
      const first = chunk.find((c) => c?.id && c?.url);
      if (first) slots[slot] = first;
    } catch {
      errors.push("그림을 그리지 못했어요.");
    } finally {
      settled += 1;
      emit();
    }
  }

  await Promise.all([runSlot(0), runSlot(1)]);

  const choices = slots.filter((c): c is AvatarChoice =>
    Boolean(c?.id && c?.url)
  );

  if (choices.length === 0) {
    return {
      choices: [],
      error: errors[0] ?? "그림을 그리지 못했어요. 다시 시도해 주세요.",
    };
  }

  return { choices };
}
