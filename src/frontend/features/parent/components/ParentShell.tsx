import type { ReactNode } from "react";
import { ParentBottomNav } from "@/frontend/features/parent/components/ParentBottomNav";
import { ParentLogoutButton } from "@/frontend/features/parent/components/ParentLogoutButton";

/**
 * Adult guardian shell — clean, familiar healthcare-app chrome.
 */
export function ParentShell({
  children,
  childName,
  hospitalDay,
  hideContext = false,
}: {
  children: ReactNode;
  childName?: string | null;
  moodEmoji?: string;
  hospitalDay?: number | null;
  /** When true, skip the mobile name/day block (home provides its own). */
  hideContext?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[#F3F5F7]">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-5 md:max-w-2xl md:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon-192.png?v=4"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 rounded-lg object-cover"
            />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[15px] font-semibold tracking-tight text-slate-800">
                Beddy
              </p>
              <p className="text-[11px] text-slate-400">보호자</p>
            </div>
          </div>
          <ParentLogoutButton variant="header" />
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-lg flex-col px-5 pb-28 pt-5 md:max-w-2xl md:px-8">
        {!hideContext && childName ? (
          <div className="mb-5">
            <h2 className="text-lg font-semibold tracking-tight text-slate-800">
              {childName}
            </h2>
            {hospitalDay != null ? (
              <p className="mt-0.5 text-sm text-slate-500">
                입원 {hospitalDay}일째
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-slate-400">보호자 공간</p>
            )}
          </div>
        ) : null}
        {children}
      </div>
      <ParentBottomNav />
    </div>
  );
}
