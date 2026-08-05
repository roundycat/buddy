"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  LegalDocumentModal,
  type LegalDocId,
} from "@/frontend/features/auth/components/LegalDocumentModal";
import {
  getPasswordChecks,
  isPasswordValid,
  passwordValidationMessage,
} from "@/shared/auth/password";

type AuthMode = "login" | "signup";
type AccountRole = "child" | "guardian";

/**
 * Email/password login + signup with standard terms & password rules.
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  const initialMode =
    searchParams.get("mode") === "signup" ? "signup" : "login";

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [role, setRole] = useState<AccountRole>("child");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [agreeAll, setAgreeAll] = useState(false);
  const [agreeAgeOrGuardian, setAgreeAgeOrGuardian] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocId | null>(null);

  const passwordChecks = useMemo(
    () => getPasswordChecks(password),
    [password]
  );

  function resetAgreements() {
    setAgreeAll(false);
    setAgreeAgeOrGuardian(false);
    setAgreeTerms(false);
    setAgreePrivacy(false);
    setAgreeMarketing(false);
  }

  function switchMode(next: AuthMode) {
    setMode(next);
    setError(null);
    if (next === "signup") {
      setName("");
      setEmail("");
      setPassword("");
      setPasswordConfirm("");
      setRole("child");
      resetAgreements();
    } else {
      setEmail("");
      setPassword("");
      setPasswordConfirm("");
      resetAgreements();
    }
  }

  function syncAgreeAll(next: {
    age: boolean;
    terms: boolean;
    privacy: boolean;
    marketing: boolean;
  }) {
    setAgreeAgeOrGuardian(next.age);
    setAgreeTerms(next.terms);
    setAgreePrivacy(next.privacy);
    setAgreeMarketing(next.marketing);
    setAgreeAll(next.age && next.terms && next.privacy && next.marketing);
  }

  function toggleAgreeAll(checked: boolean) {
    setAgreeAll(checked);
    setAgreeAgeOrGuardian(checked);
    setAgreeTerms(checked);
    setAgreePrivacy(checked);
    setAgreeMarketing(checked);
  }

  function requiredConsentsOk() {
    return agreeAgeOrGuardian && agreeTerms && agreePrivacy;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      if (mode === "signup") {
        if (!requiredConsentsOk()) {
          throw new Error("필수 약관에 모두 동의해 주세요.");
        }
        if (!isPasswordValid(password)) {
          throw new Error(
            passwordValidationMessage(password) ??
              "비밀번호 형식을 확인해 주세요."
          );
        }
        if (password !== passwordConfirm) {
          throw new Error("비밀번호 확인이 일치하지 않습니다.");
        }
      }

      const endpoint =
        mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body =
        mode === "signup"
          ? {
              name,
              email,
              password,
              role,
              agreements: {
                ageOrGuardian: agreeAgeOrGuardian,
                terms: agreeTerms,
                privacy: agreePrivacy,
                marketing: agreeMarketing,
              },
            }
          : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as {
        error?: string;
        needsOnboarding?: boolean;
        isGuardian?: boolean;
      };
      if (!res.ok) {
        throw new Error(
          data?.error ??
            (mode === "signup"
              ? "회원가입에 실패했습니다."
              : "로그인에 실패했습니다.")
        );
      }

      if (data.isGuardian) {
        window.location.assign("/guardian");
        return;
      }
      window.location.assign(data.needsOnboarding ? "/onboarding" : "/");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === "signup"
            ? "회원가입에 실패했습니다."
            : "로그인에 실패했습니다."
      );
    } finally {
      setPending(false);
    }
  }

  const ageLabel =
    role === "child"
      ? "(필수) 보호자(법정대리인) 동의를 받았어요"
      : "(필수) 만 14세 이상입니다";

  return (
    <div className="waiting-room-enter mx-auto flex w-full max-w-sm flex-col items-center px-5 py-16 text-center">
      <p className="font-display text-4xl font-semibold tracking-tight text-bedi-slate">
        Beddy
      </p>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-bedi-slate/50">
        오늘은 아플지라도, 오늘은 사라지지 않습니다.
        <br />
        병원에서 보낸 오늘도, 반짝이는 기억이 됩니다.
      </p>

      <div className="mt-10 flex w-full rounded-xl border border-bedi-slate/10 bg-white/60 p-1">
        <button
          type="button"
          onClick={() => switchMode("login")}
          className={`h-9 flex-1 rounded-lg text-sm font-medium transition-colors ${
            mode === "login"
              ? "bg-bedi-slate text-white"
              : "text-bedi-slate/50 hover:text-bedi-slate/75"
          }`}
        >
          로그인
        </button>
        <button
          type="button"
          onClick={() => switchMode("signup")}
          className={`h-9 flex-1 rounded-lg text-sm font-medium transition-colors ${
            mode === "signup"
              ? "bg-bedi-slate text-white"
              : "text-bedi-slate/50 hover:text-bedi-slate/75"
          }`}
        >
          회원가입
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 w-full space-y-3 text-left">
        {mode === "signup" && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-bedi-slate/45">
                이름
              </span>
              <input
                type="text"
                autoComplete="nickname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={20}
                placeholder="예: 지민"
                className="h-11 w-full rounded-xl border border-bedi-slate/10 bg-white/70 px-3 text-sm text-bedi-slate outline-none ring-bedi-slate/20 focus:ring-2"
              />
            </label>

            <div>
              <span className="mb-1.5 block text-[11px] font-medium text-bedi-slate/45">
                계정 종류
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRole("child");
                    setAgreeAgeOrGuardian(false);
                    setAgreeAll(false);
                  }}
                  className={`h-10 rounded-xl border text-sm transition-colors ${
                    role === "child"
                      ? "border-bedi-sage/50 bg-bedi-sage/15 text-bedi-slate"
                      : "border-bedi-slate/10 bg-white/70 text-bedi-slate/60"
                  }`}
                >
                  아이
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRole("guardian");
                    setAgreeAgeOrGuardian(false);
                    setAgreeAll(false);
                  }}
                  className={`h-10 rounded-xl border text-sm transition-colors ${
                    role === "guardian"
                      ? "border-bedi-sage/50 bg-bedi-sage/15 text-bedi-slate"
                      : "border-bedi-slate/10 bg-white/70 text-bedi-slate/60"
                  }`}
                >
                  보호자
                </button>
              </div>
            </div>
          </>
        )}

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-bedi-slate/45">
            이메일
          </span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 w-full rounded-xl border border-bedi-slate/10 bg-white/70 px-3 text-sm text-bedi-slate outline-none ring-bedi-slate/20 focus:ring-2"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-bedi-slate/45">
            비밀번호
          </span>
          <input
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "signup" ? 8 : undefined}
            maxLength={mode === "signup" ? 20 : undefined}
            className="h-11 w-full rounded-xl border border-bedi-slate/10 bg-white/70 px-3 text-sm text-bedi-slate outline-none ring-bedi-slate/20 focus:ring-2"
          />
          {mode === "signup" && (
            <ul className="mt-2 space-y-1">
              {passwordChecks.map((check) => (
                <li
                  key={check.id}
                  className={`flex items-center gap-1.5 text-[11px] ${
                    check.ok ? "text-bedi-sage" : "text-bedi-slate/35"
                  }`}
                >
                  <span aria-hidden>{check.ok ? "✓" : "○"}</span>
                  {check.label}
                </li>
              ))}
            </ul>
          )}
        </label>

        {mode === "signup" && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-bedi-slate/45">
                비밀번호 확인
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                minLength={8}
                maxLength={20}
                className="h-11 w-full rounded-xl border border-bedi-slate/10 bg-white/70 px-3 text-sm text-bedi-slate outline-none ring-bedi-slate/20 focus:ring-2"
              />
              {passwordConfirm.length > 0 && (
                <span
                  className={`mt-1 block text-[11px] ${
                    password === passwordConfirm
                      ? "text-bedi-sage"
                      : "text-bedi-rose"
                  }`}
                >
                  {password === passwordConfirm
                    ? "비밀번호가 일치합니다"
                    : "비밀번호가 일치하지 않습니다"}
                </span>
              )}
            </label>

            <fieldset className="rounded-2xl border border-bedi-slate/10 bg-white/70 px-3 py-3">
              <legend className="px-1 text-[11px] font-medium text-bedi-slate/45">
                약관 동의
              </legend>

              <label className="flex cursor-pointer items-start gap-2 border-b border-bedi-slate/8 pb-2.5">
                <input
                  type="checkbox"
                  checked={agreeAll}
                  onChange={(e) => toggleAgreeAll(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-bedi-slate/25 text-bedi-slate"
                />
                <span className="text-sm font-medium text-bedi-slate">
                  전체 동의
                </span>
              </label>

              <div className="mt-2.5 space-y-2.5">
                <ConsentRow
                  checked={agreeAgeOrGuardian}
                  onChange={(checked) =>
                    syncAgreeAll({
                      age: checked,
                      terms: agreeTerms,
                      privacy: agreePrivacy,
                      marketing: agreeMarketing,
                    })
                  }
                  label={ageLabel}
                />
                <ConsentRow
                  checked={agreeTerms}
                  onChange={(checked) =>
                    syncAgreeAll({
                      age: agreeAgeOrGuardian,
                      terms: checked,
                      privacy: agreePrivacy,
                      marketing: agreeMarketing,
                    })
                  }
                  label="(필수) 서비스 이용약관 동의"
                  onOpenDoc={() => setLegalDoc("terms")}
                />
                <ConsentRow
                  checked={agreePrivacy}
                  onChange={(checked) =>
                    syncAgreeAll({
                      age: agreeAgeOrGuardian,
                      terms: agreeTerms,
                      privacy: checked,
                      marketing: agreeMarketing,
                    })
                  }
                  label="(필수) 개인정보 수집·이용 동의"
                  onOpenDoc={() => setLegalDoc("privacy-collection")}
                />
                <ConsentRow
                  checked={agreeMarketing}
                  onChange={(checked) =>
                    syncAgreeAll({
                      age: agreeAgeOrGuardian,
                      terms: agreeTerms,
                      privacy: agreePrivacy,
                      marketing: checked,
                    })
                  }
                  label="(선택) 마케팅 정보 수신 동의"
                />
              </div>

              <button
                type="button"
                onClick={() => setLegalDoc("privacy-policy")}
                className="mt-3 text-[11px] text-bedi-slate/40 underline-offset-2 hover:text-bedi-slate/60 hover:underline"
              >
                개인정보 처리방침 보기
              </button>
            </fieldset>
          </>
        )}

        <button
          type="submit"
          disabled={
            pending ||
            (mode === "signup" &&
              (!requiredConsentsOk() ||
                !isPasswordValid(password) ||
                password !== passwordConfirm))
          }
          className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-bedi-slate text-sm font-medium text-white transition-colors hover:bg-bedi-slate/90 disabled:opacity-50"
        >
          {pending
            ? mode === "signup"
              ? "가입하는 중…"
              : "들어가는 중…"
            : mode === "signup"
              ? "회원가입"
              : "로그인"}
        </button>
      </form>

      {error && (
        <p className="mt-6 w-full rounded-lg bg-bedi-rose/15 px-3 py-2 text-sm text-bedi-slate/80">
          {error}
        </p>
      )}

      <LegalDocumentModal docId={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}

function ConsentRow({
  checked,
  onChange,
  label,
  onOpenDoc,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  onOpenDoc?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-bedi-slate/25 text-bedi-slate"
        />
        <span className="text-[12px] leading-snug text-bedi-slate/70">
          {label}
        </span>
      </label>
      {onOpenDoc && (
        <button
          type="button"
          onClick={onOpenDoc}
          className="shrink-0 text-[11px] text-bedi-slate/40 underline-offset-2 hover:underline"
        >
          보기
        </button>
      )}
    </div>
  );
}
