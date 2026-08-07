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
    <div className="paper-room mx-auto max-w-lg px-5 pb-8 pt-2 md:max-w-2xl md:px-8">
      <TopBrandBar balance={balance} />

      <div className="mb-6 mt-8 text-center md:mb-8 md:mt-10">
        {eyebrow ? (
          <p className="text-xs tracking-[0.14em] text-bedi-slate/40">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-bedi-slate md:text-2xl">
          {title}
        </h1>
        {description ? (
          <div className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-bedi-slate/45">
            {description}
          </div>
        ) : null}
      </div>

      {children}
    </div>
  );
}
