/**
 * Auth cookie names — safe for Edge middleware (no Node Buffer).
 */
export const AUTH_COOKIE_NAME = "bedi_session";
/** Edge-readable role gate: "child" | "guardian" */
export const AUTH_ROLE_COOKIE = "bedi_role";
/** 7 days in seconds */
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export type AuthRoleCookieValue = "child" | "guardian";
