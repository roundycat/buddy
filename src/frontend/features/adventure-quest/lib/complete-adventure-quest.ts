/**
 * Mark an adventure quest activity complete (garden / chat / post).
 */
export async function completeAdventureQuest(
  questId: string,
  note?: string
): Promise<boolean> {
  try {
    const res = await fetch("/api/adventure/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questId,
        note,
        complete: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
