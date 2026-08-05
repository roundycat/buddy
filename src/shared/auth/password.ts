/**
 * Shared password rules for signup (client + server).
 * Korean consumer-app standard: 8–20 chars, letter + number + special.
 */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 20;

const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export type PasswordCheck = {
  id: "length" | "letter" | "number" | "special";
  label: string;
  ok: boolean;
};

export function getPasswordChecks(password: string): PasswordCheck[] {
  return [
    {
      id: "length",
      label: `${PASSWORD_MIN}자 이상 ${PASSWORD_MAX}자 이하`,
      ok: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX,
    },
    {
      id: "letter",
      label: "영문 포함",
      ok: /[A-Za-z]/.test(password),
    },
    {
      id: "number",
      label: "숫자 포함",
      ok: /[0-9]/.test(password),
    },
    {
      id: "special",
      label: "특수문자 포함 (!@#$%^&* 등)",
      ok: SPECIAL_RE.test(password),
    },
  ];
}

export function isPasswordValid(password: string): boolean {
  return getPasswordChecks(password).every((c) => c.ok);
}

export function passwordValidationMessage(password: string): string | null {
  if (!password) return "비밀번호를 입력해 주세요.";
  const failed = getPasswordChecks(password).filter((c) => !c.ok);
  if (failed.length === 0) return null;
  return `비밀번호는 ${failed.map((c) => c.label).join(", ")} 조건이 필요해요.`;
}
