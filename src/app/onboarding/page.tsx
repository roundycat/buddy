import type { Metadata } from "next";
import { OnboardingFlow } from "@/frontend/features/onboarding/components/OnboardingFlow";
import { getSessionUser } from "@/backend/shared/http/auth";

export const metadata: Metadata = {
  title: "Beddy",
  description: "첫 로그인 AI 페르소나 생성",
};

export default async function OnboardingPage() {
  const user = await getSessionUser();

  return (
    <main className="flex min-h-screen items-center justify-center">
      <OnboardingFlow accountName={user?.name ?? ""} />
    </main>
  );
}
