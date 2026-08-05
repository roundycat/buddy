import type { LlmChatRequest, LlmChatResult, LlmProvider } from "../types";

function pickCallName(system: string): string {
  const m =
    system.match(/호칭:\s*"([^"]+)"/) ||
    system.match(/대화 상대는\s*"([^"]+)"/);
  return m?.[1]?.trim() || "너";
}

function pickSheetLine(system: string, key: string): string | undefined {
  const re = new RegExp(`${key}[^\\n]*:\\s*(.+)`);
  const m = system.match(re);
  return m?.[1]?.trim();
}

/**
 * Offline replies that speak AS the companion persona from the character sheet.
 */
export class MockLlmProvider implements LlmProvider {
  readonly name = "mock";

  async chat(request: LlmChatRequest): Promise<LlmChatResult> {
    const system =
      request.messages.find((m) => m.role === "system")?.content ?? "";
    const lastUser = [...request.messages]
      .reverse()
      .find((m) => m.role === "user");
    const text = (lastUser?.content ?? "").trim();
    const lower = text.toLowerCase();

    const callName = pickCallName(system);
    const hobby =
      pickSheetLine(system, "취미·관심사") ||
      pickSheetLine(system, "취미");
    const disposition = pickSheetLine(system, "성격/성향");
    const mbti = pickSheetLine(system, "MBTI");
    const stress = pickSheetLine(system, "힘들 때");
    const motivate = system.includes("응원형");
    const chatty = system.includes("수다형");
    const playful = system.includes("놀이형");
    const quiet = system.includes("조용한 동반");
    const hasPersona = system.includes("Beddy") || system.includes("캐릭터 설계서");

    // Schedule child-copy JSON (hospital-day LLM enrich)
    if (system.includes("아동용 안내 작가") || system.includes('"what"')) {
      let title = "일정";
      let kind = "검사";
      try {
        const payload = JSON.parse(text) as {
          title?: string;
          kind?: string;
          parentNote?: string | null;
        };
        title = payload.title?.trim() || title;
        kind = payload.kind?.trim() || kind;
      } catch {
        /* keep defaults */
      }
      const isTreatment = kind.includes("치료");
      const scheduleContent = JSON.stringify({
        what: isTreatment
          ? `“${title}”은(는) 몸을 조금 더 편하게 도와주는 시간이에요.`
          : `“${title}”은(는) 지금 몸이 어떤지 살펴보는 시간이에요.`,
        why: isTreatment
          ? `오늘은 “${title}”을(를) 도와주는 시간이에요. 아프게 하려는 게 아니라, 몸이 조금 더 편해지도록 돕기 위함이에요. 긴장되면 베디에게 말해도 괜찮아요.`
          : `오늘은 “${title}”을(를) 살펴보는 시간이에요. 아프게 하려는 게 아니라, 지금 몸을 알아보기 위함이에요. 긴장되면 베디에게 말해도 괜찮아요.`,
        notify: `보호자가 “${title}”을(를) 알려 줬어요`,
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      return {
        content: scheduleContent,
        provider: this.name,
        model: "mock-rules",
      };
    }

    let content = `${callName}, 말해 줘서 고마워. 지금 그 마음 그냥 여기 둬도 돼. 내가 같이 있을게.`;

    if (!text) {
      content = quiet
        ? `${callName}, 말 안 해도 괜찮아. 여기 있을게.`
        : chatty || playful
          ? `${callName}, 뭐 하고 있었어? 나랑 잠깐 얘기할래?`
          : `${callName}, 괜찮아. 말하고 싶을 때 천천히 꺼내 줘.`;
    } else if (/불안|걱정|무섭|초조/.test(lower)) {
      content = motivate
        ? `${callName}, 불안한 거 느껴져. 숨 하나만 천천히 쉬어볼까. 그것만으로도 이미 잘하고 있어.`
        : `${callName}, 불안한 거 느껴져. 이 자리에서 숨 하나만 천천히. 나는 여기 있을게.`;
      if (stress) {
        content += ` 나도 힘들 땐 ${stress.split("—")[0]?.trim() || stress} 쪽을 떠올려.`;
      }
    } else if (/피곤|지침|졸|힘들/.test(lower)) {
      content = `${callName}, 많이 지쳤구나. 오늘 버틴 것만으로도 충분해. 무리하지 말자.`;
    } else if (/외로|혼자|심심/.test(lower)) {
      if (chatty) {
        content = `${callName}, 심심했구나. 나랑 아무 얘기나 하자. 오늘 뭐가 제일 기억나?`;
      } else if (playful) {
        content = `${callName}, 심심하면 짧게 퀴즈 하나 할까? 아니면 그냥 잡담도 좋아.`;
      } else {
        content = `${callName}, 혼자가 아니야. 대기실에 있는 동안 내가 옆에 있을게.`;
        if (hobby) {
          content += ` 기운 나면 ${hobby.split("·")[0]?.trim()} 이야기도 하자.`;
        }
      }
    } else if (/취미|관심|좋아하|웹툰|게임|음악|그림/.test(lower)) {
      content = hobby
        ? `${callName}, 나도 ${hobby.split("·")[0]?.trim()} 진짜 좋아해. 어떤 부분이 제일 끌려?`
        : `${callName}, 그 이야기 더 듣고 싶어. 조금만 더 말해 줄래?`;
    } else if (/mbti|성격|성향/.test(lower) && (mbti || disposition)) {
      content = `${callName}, 나는 ${[mbti?.split("—")[0]?.trim(), disposition]
        .filter(Boolean)
        .join(", ")} 쪽으로 말해. 지금 네 말은 잘 들려.`;
    } else if (/좋아|괜찮|감사|고마/.test(lower)) {
      content = `${callName}, 그 말 들으니 든든하네. 좋은 기분 조금만 더 머물러도 괜찮아.`;
    } else if (/안녕|하이|헬로|처음/.test(lower)) {
      content = hasPersona
        ? `${callName}, 다시 만나서 반가워.${disposition ? ` 나는 ${disposition.split(",")[0]} 쪽에 가깝게 말할게.` : ""} 오늘 기분은 어때?`
        : `${callName}, 안녕. 오늘도 와 줘서 고마워.`;
    } else if (hasPersona) {
      if (motivate) {
        content = `${callName}, 잘 들었어. 그 마음 그대로도 괜찮아. 원하면 아주 작은 다음 한 걸음만 같이 생각해 볼까.`;
      } else if (chatty) {
        content = `${callName}, 오 그거 재밌네. 조금 더 들려줄래? 나도 이어서 이야기하고 싶어.`;
      } else if (playful) {
        content = `${callName}, 알겠어. 잠깐 분위기 바꿔 볼까, 아니면 이 얘기 더 할까?`;
      } else if (quiet) {
        content = `${callName}, 응. 여기 있을게. 더 말하고 싶으면 말해 줘.`;
      } else {
        content = `${callName}, 잘 들었어. 그 마음 그대로도 괜찮아. 더 말하고 싶을 때만 이어서 말해 줘.`;
      }
      if (hobby && text.length > 6 && !quiet) {
        content += ` 참고로 나는 ${hobby.split("·")[0]?.trim()}도 좋아해.`;
      }
    }

    content = content.replace(/\s+/g, " ").trim();
    await new Promise((resolve) => setTimeout(resolve, 350));

    return {
      content,
      provider: this.name,
      model: "mock-rules",
    };
  }

  async *chatStream(request: LlmChatRequest): AsyncIterable<string> {
    const result = await this.chat(request);
    const words = result.content.split(/(?<=\s)/);
    for (const word of words) {
      yield word;
      await new Promise((r) => setTimeout(r, 18));
    }
  }
}
