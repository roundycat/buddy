import type { AuthUser, SessionPayload } from "./auth.types";
import { AUTH_COOKIE_MAX_AGE } from "./auth.constants";

/**
 * Edge-safe session token helpers (Web Crypto only — usable from middleware).
 */

const SESSION_TTL_SECONDS = AUTH_COOKIE_MAX_AGE;
let missingSecretWarned = false;
let weakSecretWarned = false;

/** Known insecure defaults that must never ship in production. */
const WEAK_SECRETS = new Set([
  "bedi-dev-secret-change-me",
  "bedi-prod-change-me",
  "change-me",
  "secret",
  "password",
]);

function getSecret() {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();

  if (process.env.NODE_ENV === "production") {
    if (!secret) {
      throw new Error("AUTH_SESSION_SECRET must be set in production.");
    }
    if (WEAK_SECRETS.has(secret) || secret.length < 16) {
      throw new Error(
        "AUTH_SESSION_SECRET is too weak for production (avoid defaults; use ≥16 random chars)."
      );
    }
    if (secret.length < 32 && !weakSecretWarned) {
      weakSecretWarned = true;
      console.error(
        "[auth.session] AUTH_SESSION_SECRET should be ≥32 characters."
      );
    }
    return secret;
  }

  if (secret) return secret;

  if (!missingSecretWarned) {
    missingSecretWarned = true;
    console.warn(
      "[auth.session] AUTH_SESSION_SECRET is missing. Falling back to dev secret."
    );
  }
  return "bedi-dev-secret-change-me";
}

/**
 * Constant-time string compare (Edge-safe; no Node `crypto` dependency).
 * Length mismatch still returns false after a fixed dummy pass to reduce leaks.
 */
function timingSafeEqualString(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length === bBytes.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function utf8ToBase64Url(input: string): string {
  return toBase64Url(new TextEncoder().encode(input));
}

function base64UrlToUtf8(input: string): string {
  return new TextDecoder().decode(fromBase64Url(input));
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function sign(payload: string) {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(),
    new TextEncoder().encode(payload)
  );
  return toBase64Url(new Uint8Array(signature));
}

export async function createSessionToken(user: AuthUser): Promise<string> {
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role ?? "child",
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = utf8ToBase64Url(JSON.stringify(payload));
  const signature = await sign(body);
  return `${body}.${signature}`;
}

export async function verifySessionToken(
  token: string
): Promise<AuthUser | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = await sign(body);
  if (!timingSafeEqualString(expected, signature)) return null;

  try {
    const payload = JSON.parse(base64UrlToUtf8(body)) as SessionPayload;
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role ?? "child",
    };
  } catch {
    return null;
  }
}
