import { getLlmProvider } from "@/backend/shared/llm";

/**
 * Child-facing schedule copy via LLM — gentle, non-clinical.
 */
export async function composeChildScheduleCopy(input: {
  type: "exam" | "treatment";
  title: string;
  note?: string;
}): Promise<{ what: string; why: string; notify: string } | null> {
  const title = input.title.trim();
  const note = input.note?.trim();

  try {
    const llm = getLlmProvider();
    const kind = input.type === "treatment" ? "치료" : "검사";
    const result = await llm.chat({
      messages: [
        {
          role: "system",
          content: `당신은 병원 아이 돌봄 앱 Beddy의 아동용 안내 작가입니다.
보호자가 입력한 ${kind} 이름을 바탕으로, 어린이에게 무섭지 않게 설명해 주세요.

규칙:
- 의료 진단·처방·수치 해석 금지
- 아프다고 협박하지 말 것
- 쉬운 한국어, 존댓말 아닌 부드러운 반말/해요체 혼용 가능하되 따뜻하게
- 원문 대화·비밀 금지
- JSON만 반환: {"what":"이게 뭔지 1~2문장","why":"왜 하는지 2~3문장","notify":"알림용 짧은 한 줄"}`,
        },
        {
          role: "user",
          content: JSON.stringify({
            kind,
            title,
            parentNote: note || null,
          }),
        },
      ],
      temperature: 0.45,
      maxTokens: 320,
    });

    const parsed = extractJson(result.content);
    if (!parsed?.what || !parsed?.why) return null;
    return {
      what: String(parsed.what).trim().slice(0, 180),
      why: String(parsed.why).trim().slice(0, 280),
      notify: String(parsed.notify || parsed.what)
        .trim()
        .slice(0, 80),
    };
  } catch (error) {
    console.warn("[hospital-day] LLM schedule copy skipped", error);
    return null;
  }
}

function extractJson(raw: string): {
  what?: string;
  why?: string;
  notify?: string;
} | null {
  const text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? text).trim();
  try {
    return JSON.parse(body) as {
      what?: string;
      why?: string;
      notify?: string;
    };
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1)) as {
          what?: string;
          why?: string;
          notify?: string;
        };
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Prefer LLM when parent entered a real title/note rather than placeholder noise. */
export function shouldEnrichScheduleWithLlm(title: string, note?: string): boolean {
  const t = title.trim();
  const n = note?.trim() ?? "";
  if (n.length >= 4) return true;
  if (t.length < 2) return false;
  if (/^(.)\1{2,}$/.test(t)) return false;
  if (/^[ㄱ-ㅎㅏ-ㅣ\s]+$/.test(t) && t.replace(/\s/g, "").length <= 3) return false;
  if (/^[a-zA-Z]{1,2}$/.test(t)) return false;
  return true;
}
