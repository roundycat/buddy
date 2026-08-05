"use client";

import { useState } from "react";
import { ParentCard } from "@/frontend/features/parent/components/ParentUi";
import { cn } from "@/frontend/shared/lib/utils";
import type { ParentProfileResponse } from "@/frontend/features/parent/types";

type Notifications = ParentProfileResponse["notifications"];
type Privacy = Omit<ParentProfileResponse["privacy"], "hidePrivateChat">;

function SettingSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full p-1 transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
        checked ? "bg-slate-800" : "bg-bedi-slate/15",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out",
          checked ? "translate-x-[20px]" : "translate-x-0"
        )}
      />
    </button>
  );
}

function SettingRow({
  title,
  description,
  checked,
  onChange,
  locked,
  lockedNote,
  disabled,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange?: (next: boolean) => void;
  locked?: boolean;
  lockedNote?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium leading-snug text-slate-800">
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
            {description}
          </p>
        ) : null}
        {locked ? (
          <p className="mt-1.5 text-[11px] font-medium text-bedi-rose/80">
            {lockedNote ?? "항상 숨김 · 변경할 수 없어요"}
          </p>
        ) : (
          <p
            className={cn(
              "mt-1.5 text-[11px] font-medium tracking-wide",
              checked ? "text-slate-700" : "text-slate-800/35"
            )}
          >
            {checked ? "켜짐" : "꺼짐"}
          </p>
        )}
      </div>

      {locked ? (
        <span className="mt-0.5 inline-flex h-8 shrink-0 items-center rounded-full bg-bedi-rose/10 px-3 text-[11px] font-medium text-bedi-rose/80">
          고정
        </span>
      ) : (
        <div className="mt-0.5">
          <SettingSwitch
            label={title}
            checked={checked}
            disabled={disabled}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Persistable notification / privacy settings for guardians.
 */
export function ParentProfileSettings({
  initialNotifications,
  initialPrivacy,
}: {
  initialNotifications: Notifications;
  initialPrivacy: ParentProfileResponse["privacy"];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [privacy, setPrivacy] = useState<Privacy>({
    shareEmotionTrends: initialPrivacy.shareEmotionTrends,
    shareAdventures: initialPrivacy.shareAdventures,
    shareMemoryHighlights: initialPrivacy.shareMemoryHighlights,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function persist(next: {
    notifications?: Partial<Notifications>;
    privacy?: Partial<Privacy>;
  }) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/parent/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "설정을 저장하지 못했어요.");
      if (data.notifications) {
        setNotifications((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(data.notifications).filter(
              ([, v]) => typeof v === "boolean"
            )
          ),
        }));
      }
      if (data.privacy) {
        setPrivacy((prev) => ({
          ...prev,
          ...(typeof data.privacy.shareEmotionTrends === "boolean"
            ? { shareEmotionTrends: data.privacy.shareEmotionTrends }
            : {}),
          ...(typeof data.privacy.shareAdventures === "boolean"
            ? { shareAdventures: data.privacy.shareAdventures }
            : {}),
          ...(typeof data.privacy.shareMemoryHighlights === "boolean"
            ? { shareMemoryHighlights: data.privacy.shareMemoryHighlights }
            : {}),
        }));
      }
      setMessage("저장했어요");
      window.setTimeout(() => setMessage(null), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "설정을 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ParentCard>
        <div className="mb-1 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] tracking-[0.14em] text-slate-500">
              알림
            </p>
            <p className="mt-1 text-[12px] text-slate-400">
              홈에서 볼 요약·팁을 골라요
            </p>
          </div>
          {saving ? (
            <span className="text-[11px] text-slate-800/35">저장 중…</span>
          ) : message ? (
            <span className="text-[11px] text-slate-700">{message}</span>
          ) : null}
        </div>

        <div className="mt-3 divide-y divide-bedi-slate/[0.06]">
          <SettingRow
            title="하루 요약"
            description="아이의 오늘을 짧게 정리해 보여 줘요"
            checked={notifications.dailyDigest}
            disabled={saving}
            onChange={(dailyDigest) => {
              setNotifications((n) => ({ ...n, dailyDigest }));
              void persist({ notifications: { dailyDigest } });
            }}
          />
          <SettingRow
            title="돌봄 팁"
            description="오늘 마음에 맞춰 작은 돌봄 제안을 받아요"
            checked={notifications.careTips}
            disabled={saving}
            onChange={(careTips) => {
              setNotifications((n) => ({ ...n, careTips }));
              void persist({ notifications: { careTips } });
            }}
          />
        </div>
      </ParentCard>

      <ParentCard className="border-slate-200">
        <div className="mb-1">
          <p className="text-[11px] tracking-[0.14em] text-slate-500">
            프라이버시
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
            베디와의 대화·비밀 일기는 보호자에게 공개되지 않아요. 아래는 홈에
            보여줄 요약만 골라요.
          </p>
        </div>

        <div className="mt-3 divide-y divide-bedi-slate/[0.06]">
          <SettingRow
            title="감정 트렌드"
            description="최근 감정의 흐름을 부드럽게 보여 줘요"
            checked={privacy.shareEmotionTrends}
            disabled={saving}
            onChange={(shareEmotionTrends) => {
              setPrivacy((p) => ({ ...p, shareEmotionTrends }));
              void persist({ privacy: { shareEmotionTrends } });
            }}
          />
          <SettingRow
            title="모험 요약"
            description="오늘 한 작은 모험 목록을 공유해요"
            checked={privacy.shareAdventures}
            disabled={saving}
            onChange={(shareAdventures) => {
              setPrivacy((p) => ({ ...p, shareAdventures }));
              void persist({ privacy: { shareAdventures } });
            }}
          />
          <SettingRow
            title="기억 하이라이트"
            description="하루의 짧은 하이라이트만 모아 보여 줘요"
            checked={privacy.shareMemoryHighlights}
            disabled={saving}
            onChange={(shareMemoryHighlights) => {
              setPrivacy((p) => ({ ...p, shareMemoryHighlights }));
              void persist({ privacy: { shareMemoryHighlights } });
            }}
          />
          <SettingRow
            title="비공개 대화"
            description="아이와 베디의 대화 내용은 절대 열리지 않아요"
            checked={false}
            locked
          />
        </div>

        {error ? (
          <p className="mt-3 rounded-xl bg-bedi-rose/10 px-3 py-2 text-[12px] text-bedi-rose">
            {error}
          </p>
        ) : null}
      </ParentCard>
    </>
  );
}
