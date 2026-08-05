import type { Metadata } from "next";
import { Suspense } from "react";
import { StartSplash } from "@/frontend/features/auth/components/StartSplash";

export const metadata: Metadata = {
  title: "Beddy",
  description: "퇴원까지 함께하는 AI Beddy",
};

export default function StartPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[100dvh] items-center justify-center">
          <p className="font-display text-4xl font-semibold text-bedi-slate">
            Beddy
          </p>
        </main>
      }
    >
      <StartSplash />
    </Suspense>
  );
}
