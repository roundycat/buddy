"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import {
  ErrorState,
  ParentCard,
} from "@/frontend/features/parent/components/ParentUi";
import { submitGuardianConsent } from "@/frontend/features/consent/lib/consent-api";
import {
  GUARDIAN_CONSENT_ITEMS,
  GUARDIAN_CONSENT_PRIVACY_NOTE,
  GUARDIAN_CONSENT_WITHDRAW_NOTE,
  RELATIONSHIP_OPTIONS,
  type GuardianConsentItemId,
} from "@/frontend/features/consent/lib/consent-copy";
import type { GuardianRelationship } from "@/backend/features/consent/consent.types";
import { cn } from "@/frontend/shared/lib/utils";
import { topic } from "@/shared/text/josa";

/**
 * Legal-guardian consent for an under-14 child (개인정보 보호법 제22조의2).
 * Shown on the guardian home before anything else.
 */
export function GuardianConsentForm({
  childName,
  consentVersion,
}: {
  childName: string;
  consentVersion: string;
}) {
  const router = useRouter();
  const [relationship, setRelationship] = useState<GuardianRelationship | null>(
    null
  );
  const [guardianName, setGuardianName] = useState("");
  const [items, setItems] = useState<Record<GuardianConsentItemId, boolean>>({
    privacyCollection: false,
    sensitiveData: false,
    aiFeatures: false,
  });
  const [openDetail, setOpenDetail] = useState<GuardianConsentItemId | null>(
    null
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allItems = Object.values(items).every(Boolean);
  const ready = Boolean(relationship) && guardianName.trim().length > 0 && allItems;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready || !relationship || pending) return;
    setPending(true);
    setError(null);
    try {
      await submitGuardianConsent({
        relationship,
        guardianName: guardianName.trim(),
        items,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "동의를 저장하지 못했어요.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-labelledby="guardian-consent-title">
      <ParentCard>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2
              id="guardian-consent-title"
              className="text-[15px] font-semibold text-slate-800"
            >
              보호자(법정대리인) 동의가 필요해요
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              {topic(childName)} 만 14세 미만이라, 법정대리인의 동의가 있어야
              Beddy를 이용할 수 있어요. 동의하기 전까지 아이의 대화·기록 기능은
              잠겨 있어요.
            </p>
          </div>
        </div>
      </ParentCard>

      <ParentCard className="space-y-4">
        <fieldset>
          <legend className="text-[13px] font-medium text-slate-700">
            아이와의 관계
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {RELATIONSHIP_OPTIONS.map((option) => {
              const active = relationship === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRelationship(option.id)}
                  className={cn(
                    "min-h-11 rounded-lg border px-3 text-sm transition-colors",
                    active
                      ? "border-slate-700 bg-slate-800 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
            친권자 또는 후견인처럼 법정대리인인 분만 동의할 수 있어요.
          </p>
        </fieldset>

        <label className="block">
          <span className="text-[13px] font-medium text-slate-700">
            보호자 이름
          </span>
          <input
            value={guardianName}
            onChange={(e) => setGuardianName(e.target.value)}
            maxLength={20}
            autoComplete="name"
            placeholder="예: 김보호"
            className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
          />
        </label>
      </ParentCard>

      <ParentCard>
        <p className="text-[13px] font-medium text-slate-700">동의 항목</p>
        <ul className="mt-3 space-y-3">
          {GUARDIAN_CONSENT_ITEMS.map((item) => {
            const open = openDetail === item.id;
            return (
              <li
                key={item.id}
                className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={items[item.id]}
                      onChange={(e) =>
                        setItems((prev) => ({
                          ...prev,
                          [item.id]: e.target.checked,
                        }))
                      }
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
                    />
                    <span>
                      <span className="block text-sm font-medium leading-snug text-slate-800">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-[12px] leading-relaxed text-slate-500">
                        {item.summary}
                      </span>
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setOpenDetail(open ? null : item.id)}
                    aria-expanded={open}
                    className="shrink-0 text-[11px] text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
                  >
                    {open ? "접기" : "자세히"}
                  </button>
                </div>
                {open ? (
                  <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 pl-6">
                    {item.details.map((line) => (
                      <li
                        key={line}
                        className="list-disc text-[12px] leading-relaxed text-slate-500"
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>

        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] leading-relaxed text-slate-600">
          {GUARDIAN_CONSENT_PRIVACY_NOTE}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          {GUARDIAN_CONSENT_WITHDRAW_NOTE} · 동의서 버전 {consentVersion}
        </p>
      </ParentCard>

      {error ? <ErrorState message={error} /> : null}

      <button
        type="submit"
        disabled={!ready || pending}
        className="h-12 w-full rounded-xl bg-slate-800 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
      >
        {pending ? "저장하는 중…" : "동의하고 시작하기"}
      </button>
    </form>
  );
}
