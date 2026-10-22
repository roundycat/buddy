"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ErrorState,
  ParentCard,
} from "@/frontend/features/parent/components/ParentUi";
import { withdrawGuardianConsent } from "@/frontend/features/consent/lib/consent-api";
import type { GuardianConsentView } from "@/backend/features/consent/consent.types";
import { formatKoreanMonthDay } from "@/frontend/shared/lib/date";

/**
 * Guardian profile: legal-guardian consent status + 동의 철회.
 */
export function GuardianConsentCard({
  consent,
}: {
  consent: GuardianConsentView;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!consent.linked) return null;

  async function withdraw() {
    if (pending) return;
    const ok = window.confirm(
      "보호자 동의를 철회할까요?\n아이의 대화·기록 기능이 다시 잠기고, 보호자 화면에도 아이 정보가 보이지 않아요. 다시 동의하면 이어서 쓸 수 있어요."
    );
    if (!ok) return;
    setPending(true);
    setError(null);
    try {
      await withdrawGuardianConsent();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "동의를 철회하지 못했어요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <ParentCard>
      <p className="text-[11px] tracking-wide text-slate-400">보호자 동의</p>

      {!consent.required ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          만 14세 이상이거나 이전에 가입한 계정이라, 보호자 동의가 따로 필요하지
          않아요.
        </p>
      ) : consent.status === "pending" ? (
        <>
          <p className="mt-2 text-base font-medium text-slate-800">
            동의가 필요해요
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            {consent.childName ?? "아이"}는 만 14세 미만이라 보호자(법정대리인)
            동의가 있어야 Beddy를 쓸 수 있어요.
          </p>
          <Link
            href="/guardian"
            className="mt-3 inline-flex min-h-11 items-center rounded-full bg-slate-800 px-4 text-xs font-medium text-white"
          >
            동의하러 가기
          </Link>
        </>
      ) : consent.mine ? (
        <>
          <p className="mt-2 text-base font-medium text-slate-800">동의 완료</p>
          <dl className="mt-2 space-y-1 text-sm text-slate-500">
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-slate-400">관계</dt>
              <dd>{consent.mine.relationshipLabel}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-slate-400">이름</dt>
              <dd>{consent.mine.guardianName}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-slate-400">동의일</dt>
              <dd>
                {formatKoreanMonthDay(consent.mine.consentedAt)} · 버전{" "}
                {consent.mine.consentVersion}
              </dd>
            </div>
          </dl>
          {error ? (
            <div className="mt-3">
              <ErrorState message={error} />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void withdraw()}
            disabled={pending}
            className="mt-3 min-h-11 rounded-full border border-rose-200 px-4 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-50"
          >
            {pending ? "철회하는 중…" : "동의 철회"}
          </button>
        </>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          다른 보호자가 동의를 마쳤어요. 동의 철회는 동의한 보호자 계정에서 할
          수 있어요.
        </p>
      )}
    </ParentCard>
  );
}
