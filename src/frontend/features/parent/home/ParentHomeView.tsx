import { ParentShell } from "@/frontend/features/parent/components/ParentShell";
import {
  EmptyState,
  ParentSectionLabel,
} from "@/frontend/features/parent/components/ParentUi";
import { TodaysMessageCard } from "@/frontend/features/parent/components/TodaysMessageCard";
import { TodaysEmpathyGuideCard } from "@/frontend/features/parent/components/TodaysEmpathyGuideCard";
import {
  EmotionOverviewCard,
  EmotionTrendHiddenCard,
} from "@/frontend/features/parent/components/EmotionOverviewCard";
import { AdventureListCard } from "@/frontend/features/parent/components/AdventureListCard";
import { MemoryHighlightsCard } from "@/frontend/features/parent/components/MemoryHighlightsCard";
import { ChildMediaGalleryCard } from "@/frontend/features/parent/components/ChildMediaGalleryCard";
import {
  CareSuggestionCard,
  DailySummaryCard,
} from "@/frontend/features/parent/components/SummaryCareCards";
import { GuardianLinkForm } from "@/frontend/features/guardian/components/GuardianLinkForm";
import { ParentSchedulePanel } from "@/frontend/features/parent/components/ParentSchedulePanel";
import { StorybookLetterCard } from "@/frontend/features/parent/components/StorybookLetterCard";
import { SafetyAlertCard } from "@/frontend/features/parent/components/SafetyAlertCard";
import { SharingLockedCard } from "@/frontend/features/parent/components/SharingLockedCard";
import { ConcernNoticeCard } from "@/frontend/features/parent/components/ConcernNoticeCard";
import { GuardianConsentForm } from "@/frontend/features/consent/components/GuardianConsentForm";
import type {
  ParentHomeDashboard,
  ParentShareVisibility,
} from "@/frontend/features/parent/types";

export function ParentHomeView({ data }: { data: ParentHomeDashboard }) {
  // Under 14: legal-guardian consent comes before anything else.
  if (data.consentGate) {
    return (
      <ParentShell>
        <div className="flex flex-col gap-5">
          {data.safetyAlert ? (
            <section>
              <ParentSectionLabel>안전 알림</ParentSectionLabel>
              <SafetyAlertCard alert={data.safetyAlert} />
            </section>
          ) : null}
          <GuardianConsentForm
            childName={data.consentGate.childName}
            consentVersion={data.consentGate.consentVersion}
          />
          <p className="pb-1 text-center text-[11px] leading-relaxed text-slate-400">
            {data.companionNote}
          </p>
        </div>
      </ParentShell>
    );
  }

  if (!data.linked || !data.child) {
    return (
      <ParentShell>
        <EmptyState
          title="아이와 연결해 주세요"
          description={data.companionNote}
        />
        <div className="mt-6">
          <GuardianLinkForm />
        </div>
      </ParentShell>
    );
  }

  const child = data.child;
  const visibility = (
    category: keyof NonNullable<ParentHomeDashboard["sharing"]>
  ): ParentShareVisibility => data.sharing?.[category] ?? "shown";
  const moodVis = visibility("mood");
  const adventuresVis = visibility("adventures");
  const highlightsVis = visibility("memoryHighlights");
  const mediaVis = visibility("media");

  return (
    <ParentShell
      childName={child.childName}
      hospitalDay={child.hospitalDay}
      hideContext
    >
      <header className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight text-slate-800">
          {child.childName}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          입원 {child.hospitalDay}일째
          {child.moodLabel ? ` · ${child.moodLabel}` : ""}
        </p>
      </header>

      <div className="flex flex-col gap-5">
        {data.safetyAlert ? (
          <section>
            <ParentSectionLabel>안전 알림</ParentSectionLabel>
            <SafetyAlertCard alert={data.safetyAlert} />
          </section>
        ) : null}

        {data.concernNotices?.length ? (
          <section>
            <ParentSectionLabel>아이가 나눠 준 마음</ParentSectionLabel>
            <ConcernNoticeCard notices={data.concernNotices} />
          </section>
        ) : null}

        {data.empathyGuide ? (
          <section>
            <ParentSectionLabel>오늘의 공감 가이드</ParentSectionLabel>
            <TodaysEmpathyGuideCard guide={data.empathyGuide} />
          </section>
        ) : null}

        {data.todayMessage ? (
          <section>
            <ParentSectionLabel>하루 요약</ParentSectionLabel>
            <TodaysMessageCard message={data.todayMessage} />
          </section>
        ) : null}

        <section>
          <ParentSectionLabel>병원 일정</ParentSectionLabel>
          <ParentSchedulePanel />
        </section>

        <section className="space-y-3">
          <ParentSectionLabel>아이 상태</ParentSectionLabel>
          {moodVis === "child_private" ? (
            <SharingLockedCard
              title="감정 흐름"
              visibility="child_private"
              toggleLabel="감정 트렌드"
            />
          ) : data.emotion ? (
            <EmotionOverviewCard emotion={data.emotion} />
          ) : (
            <EmotionTrendHiddenCard />
          )}
          {adventuresVis === "shown" ? (
            <AdventureListCard adventures={data.adventures} />
          ) : (
            <SharingLockedCard
              title="오늘의 활동"
              visibility={adventuresVis}
              toggleLabel="모험 요약"
            />
          )}
        </section>

        {(data.dailySummary || data.careSuggestions.length > 0) && (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ParentSectionLabel className="sm:col-span-2">
              참고
            </ParentSectionLabel>
            {data.dailySummary ? (
              <DailySummaryCard summary={data.dailySummary} />
            ) : null}
            {data.careSuggestions.length > 0 ? (
              <CareSuggestionCard suggestions={data.careSuggestions} />
            ) : null}
          </section>
        )}

        <section>
          <ParentSectionLabel>아이 사진 · 그림</ParentSectionLabel>
          {mediaVis === "shown" ? (
            <ChildMediaGalleryCard media={data.media ?? []} />
          ) : (
            <SharingLockedCard
              title="아이 사진 · 그림"
              visibility={mediaVis}
              toggleLabel="기억 · 사진 · 그림"
            />
          )}
        </section>

        <section>
          <ParentSectionLabel>최근 기억</ParentSectionLabel>
          {highlightsVis === "shown" ? (
            <MemoryHighlightsCard memories={data.memories} />
          ) : (
            <SharingLockedCard
              title="최근 기억"
              visibility={highlightsVis}
              toggleLabel="기억 · 사진 · 그림"
            />
          )}
        </section>

        <section>
          <StorybookLetterCard />
        </section>

        <p className="pb-1 text-center text-[11px] leading-relaxed text-slate-400">
          {data.companionNote}
        </p>
      </div>
    </ParentShell>
  );
}
