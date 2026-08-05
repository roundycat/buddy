import type { ReactNode } from "react";
import { TopBrandBar } from "@/frontend/shared/components/TopBrandBar";

interface FeaturePageShellProps {
  balance?: number;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

/**
 * Shared storybook-style page chrome for feature routes.
 * Keeps TopBrandBar + title block consistent across the app.
 */
export function FeaturePageShell({
  balance,
  eyebrow,
  title,
  description,
  children,
}: FeaturePageShellProps) {
  return (
    <div className="paper-room mx-auto max-w-lg px-5 pb-8 pt-2">
      <TopBrandBar balance={balance} />

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
