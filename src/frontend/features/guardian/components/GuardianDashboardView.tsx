import { cn } from "@/frontend/shared/lib/utils";
import type {
  GuardianConditionLevel,
  GuardianDashboardData,
  GuardianNeedRecommendation,
} from "@/frontend/features/guardian/types";
import { GuardianUnlinkControl } from "@/frontend/features/guardian/components/GuardianUnlinkControl";

const levelLabel: Record<GuardianConditionLevel, string> = {
  low: "낮음",
  medium: "보통",
  high: "괜찮음",
};

const levelTone: Record<GuardianConditionLevel, string> = {
  low: "bg-bedi-rose/20 text-bedi-slate/70",
  medium: "bg-amber-100/80 text-bedi-slate/70",
  high: "bg-bedi-sage/20 text-bedi-slate/70",
};

const priorityLabel: Record<GuardianNeedRecommendation["priority"], string> = {
  now: "지금",
  today: "오늘",
  soft: "여유롭게",
};

interface GuardianDashboardViewProps {
  data: GuardianDashboardData;
}

/**
 * Guardian dashboard UI — condition snapshot + RAG need recommendations (mock).
 */
export function GuardianDashboardView({ data }: GuardianDashboardViewProps) {
  return (
    <div className="space-y-6">
      <p className="text-center text-[11px] tabular-nums text-bedi-slate/35">
        입원 {data.dayCount}일째 · {data.updatedLabel}
      </p>

      {/* Condition — hydrated from linked child account */}
      <section className="rounded-2xl border border-bedi-slate/8 bg-white/90 px-5 py-5 shadow-softer">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-medium text-bedi-slate">컨디션</h2>
          <span className="text-[10px] text-bedi-slate/35">
            비진단 · {data.ragStatus === "live" ? "아이 기록 연동" : "미리보기"}
          </span>
        </div>
        <p className="mt-2 text-sm font-medium text-bedi-slate">
          {data.condition.overallLabel}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-bedi-slate/60">
          {data.condition.overallHint}
        </p>

        <ul className="mt-4 grid grid-cols-2 gap-2.5">
          {data.condition.signals.map((signal) => (
            <li
              key={signal.id}
              className="rounded-2xl border border-bedi-slate/8 bg-[#FBFAF7] px-3.5 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg leading-none">{signal.emoji}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px]",
                    levelTone[signal.level]
                  )}
                >
                  {levelLabel[signal.level]}
                </span>
              </div>
              <p className="mt-2 text-xs font-medium text-bedi-slate">
                {signal.label}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-bedi-slate/45">
                {signal.hint}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* RAG recommendations */}
      <section className="rounded-2xl border border-bedi-sage/25 bg-gradient-to-br from-bedi-sage/10 to-white px-5 py-5 shadow-softer">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-medium text-bedi-slate">
              아이에게 지금 필요한 것
            </h2>
            <p className="mt-1 text-xs text-bedi-slate/45">
              하루 기록·기분·소원을 바탕으로 한 추천
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-bedi-sage/25 bg-white/80 px-2.5 py-1 text-[10px] tracking-wide text-bedi-sage">
            {data.ragStatus === "live" ? "아이 기록 연동" : "RAG 미리보기"}
          </span>
        </div>

        <ul className="mt-4 space-y-3">
          {data.recommendations.map((rec) => (
            <li
              key={rec.id}
              className="rounded-2xl border border-bedi-slate/8 bg-white/90 px-4 py-4 shadow-softer"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-medium text-bedi-slate">
                  {rec.title}
                </h3>
                <span className="shrink-0 text-[10px] text-bedi-slate/35">
                  {priorityLabel[rec.priority]}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-bedi-slate/65">
                {rec.reason}
              </p>
              <p className="mt-2 rounded-xl bg-bedi-sage/10 px-3 py-2 text-xs leading-relaxed text-bedi-slate/70">
                이렇게 해보면 좋아요 · {rec.actionHint}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {rec.sources.map((source) => (
                  <span
                    key={`${rec.id}-${source}`}
                    className="rounded-full bg-[#FBFAF7] px-2 py-0.5 text-[10px] text-bedi-slate/40"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-bedi-slate/35">
          대화 메모리·정원·소원·모험 신호가 바뀌면 이 화면도 함께 바뀌어요
          <br />
          Bedrock RAG 유사 사례 추천은 다음 단계에서 붙일 수 있어요
        </p>
      </section>

      <section className="rounded-2xl border border-bedi-slate/8 bg-white/80 px-5 py-4 shadow-softer">
        <p className="text-xs tracking-wide text-bedi-slate/35">오늘 연동된 기록</p>
        <ul className="mt-3 space-y-1.5 text-xs text-bedi-slate/55">
          <li>
            감정 정원 ·{" "}
            {data.sourceSummary.hasTodayMood
              ? "오늘 꽃이 피어 있어요"
              : "아직 오늘 꽃이 없어요"}
          </li>
          <li>대화 · {data.sourceSummary.chatTurns}턴</li>
          <li>소원 · {data.sourceSummary.wishCount}개</li>
          {data.sourceSummary.emotionalThemes.length > 0 ? (
            <li>
              대화 테마 · {data.sourceSummary.emotionalThemes.slice(0, 3).join(", ")}
            </li>
          ) : null}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-bedi-slate/30">
          정원·모험·스토리북 화면은 아이 계정에서만 열려요
        </p>
      </section>

      <GuardianUnlinkControl />
    </div>
  );
}
