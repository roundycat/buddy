"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, FileText, UserRound } from "lucide-react";
import { cn } from "@/frontend/shared/lib/utils";

const links: Array<{
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
}> = [
  { href: "/guardian", label: "홈", icon: Home, exact: true },
  { href: "/guardian/timeline", label: "기록", icon: CalendarDays },
  { href: "/guardian/report", label: "리포트", icon: FileText },
  { href: "/guardian/profile", label: "설정", icon: UserRound },
];

/**
 * Adult bottom nav — icon + label, quiet active state.
 */
export function ParentBottomNav() {
  const pathname = usePathname();

  if (!pathname.startsWith("/guardian")) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 md:max-w-2xl">
        {links.map((link) => {
          const isActive = link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex min-h-12 min-w-[4.25rem] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 transition-colors",
                isActive
                  ? "text-slate-800"
                  : "text-slate-400 hover:text-slate-600"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className="h-5 w-5"
                strokeWidth={isActive ? 2.1 : 1.6}
              />
              <span
                className={cn(
                  "text-[11px] leading-none",
                  isActive ? "font-semibold" : "font-medium"
                )}
              >
                {link.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
