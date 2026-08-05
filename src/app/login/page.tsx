import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/frontend/features/auth/components/LoginForm";

export const metadata: Metadata = {
  title: "로그인 — Beddy",
  description: "Beddy 대기실로 들어가기",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Suspense
        fallback={
          <p className="font-display text-2xl font-semibold text-bedi-slate">
            Beddy
          </p>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
