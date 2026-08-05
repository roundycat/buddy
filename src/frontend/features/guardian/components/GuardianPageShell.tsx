import type { ReactNode } from "react";
import { GuardianBrandBar } from "@/frontend/features/guardian/components/GuardianBrandBar";

interface GuardianPageShellProps {
  childName?: string;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

/** Guardian-only page chrome — no child TopBrandBar / wallet / home link */
export function GuardianPageShell({
  childName,
  eyebrow,
  title,
  description,
  children,
}: GuardianPageShellProps) {
  return (
    <div className="paper-room mx-auto max-w-lg px-5 pb-10 pt-2">
      <GuardianBrandBar childName={childName} />

      <div className="mt-8 mb-6 text-center">
        {eyebrow ? (
          <p className="text-xs tracking-[0.14em] text-bedi-slate/40">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-bedi-slate">
          {title}
        </h1>
        {description ? (
          <div className="mt-2 text-sm text-bedi-slate/45">{description}</div>
        ) : null}
      </div>

      {children}
    </div>
  );
}
