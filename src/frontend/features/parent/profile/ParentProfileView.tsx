import { ParentShell } from "@/frontend/features/parent/components/ParentShell";
import { ParentCard } from "@/frontend/features/parent/components/ParentUi";
import { ParentProfileSettings } from "@/frontend/features/parent/components/ParentProfileSettings";
import { ParentLogoutButton } from "@/frontend/features/parent/components/ParentLogoutButton";
import { GuardianUnlinkControl } from "@/frontend/features/guardian/components/GuardianUnlinkControl";
import { GuardianConsentCard } from "@/frontend/features/consent/components/GuardianConsentCard";
import type { ParentProfileResponse } from "@/frontend/features/parent/types";

export function ParentProfileView({ data }: { data: ParentProfileResponse }) {
  return (
    <ParentShell
      childName={data.childName}
      hospitalDay={data.hospitalDay}
      moodEmoji="👤"
      hideContext
    >
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-slate-800">프로필</h1>
        <p className="mt-2 text-sm text-slate-400">
          보호자 정보와 프라이버시 설정
        </p>
      </div>

      <div className="space-y-4">
        <ParentCard>
          <p className="text-[11px] tracking-wide text-slate-400">
            보호자
          </p>
          <p className="mt-2 text-base font-medium text-slate-800">
            {data.guardianName}
          </p>
          <p className="mt-1 text-sm text-slate-800/50">{data.guardianEmail}</p>
        </ParentCard>

        <ParentCard>
          <p className="text-[11px] tracking-wide text-slate-400">아이</p>
          {data.linked && data.childName ? (
            <>
              <p className="mt-2 text-base font-medium text-slate-800">
                {data.childName}
              </p>
              <p className="mt-1 text-sm text-slate-800/50">
                입원 {data.hospitalDay}일째
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-400">아직 연결되지 않았어요</p>
          )}
        </ParentCard>

        <GuardianConsentCard consent={data.consent} />

        <ParentProfileSettings
          initialNotifications={data.notifications}
          initialPrivacy={data.privacy}
          childSharing={data.childSharing}
        />

        {data.linked ? <GuardianUnlinkControl /> : null}

        <ParentLogoutButton />
      </div>
    </ParentShell>
  );
}
