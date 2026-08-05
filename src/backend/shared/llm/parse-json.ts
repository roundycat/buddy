/**
 * Extract a JSON object from LLM text (raw or fenced ```json).
 */
export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1]?.trim() ?? text.trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("응답에서 JSON 객체를 찾지 못했어요.");
  }
  return JSON.parse(raw.slice(start, end + 1));
}
