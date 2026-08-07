import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import { getSessionUser } from "@/backend/shared/http/auth";
import { PageSkeleton } from "@/frontend/shared/components/ChildUi";

export const metadata: Metadata = {
  title: "Beddy",
  description: "첫 로그인 AI 페르소나 생성",
};

const OnboardingFlow = nextDynamic(
  () =>
    import(
      "@/frontend/features/onboarding/components/OnboardingFlow"
    ).then((m) => m.OnboardingFlow),
  {
    loading: () => <PageSkeleton rows={1} />,
  }
);

export default async function OnboardingPage() {
  const user = await getSessionUser();

  return (
    <main className="flex min-h-screen items-center justify-center">
      <OnboardingFlow accountName={user?.name ?? ""} />
    </main>
  );
}
