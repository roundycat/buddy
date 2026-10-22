import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Password guessing and mass signups are slowed down; real logins are not. */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "beddy-throttle-"));
process.env.BEDDY_DATA_DIR = dir;
process.env.PERSISTENCE = "json";
process.env.AUTH_PROVIDER = "json";
process.env.LLM_PROVIDER = "mock";
process.env.BEDDY_METRICS = "0";
process.env.AUTH_SESSION_SECRET = "throttle-secret-throttle-secret-throttle";

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const PASSWORD = "Throttle#2026";
const agreements = { terms: true, privacy: true, sensitive: true, ageOrGuardian: true, marketing: false };

function post(url: string, body: unknown, ip = "203.0.113.7") {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `${ip}, 10.0.0.1` },
    body: JSON.stringify(body),
  });
}

describe("login throttling", () => {
  it("counts only wrong passwords per e-mail and lets the right one through until then", async () => {
    const { signup } = await import("./auth.service");
    await signup({
      email: "throttle-guardian@x.test",
      password: PASSWORD,
      name: "보호자",
      role: "guardian",
      agreements,
    } as never);
    const { POST } = await import("@/app/api/auth/login/route");

    // Successful logins never use up the allowance.
    for (let i = 0; i < 12; i++) {
      expect((await POST(post("/api/auth/login", { email: "throttle-guardian@x.test", password: PASSWORD }))).status).toBe(200);
    }
    for (let i = 0; i < 10; i++) {
      expect((await POST(post("/api/auth/login", { email: "throttle-guardian@x.test", password: "Wrong#2026x" }))).status).toBe(401);
    }
    const blocked = await POST(post("/api/auth/login", { email: "THROTTLE-guardian@x.test", password: PASSWORD }));
    expect(blocked.status).toBe(429);
    // Someone else sharing the account from another address is not locked out.
    const elsewhere = await POST(
      post("/api/auth/login", { email: "throttle-guardian@x.test", password: PASSWORD }, "192.0.2.44")
    );
    expect(elsewhere.status).toBe(200);
  });
});

describe("signup throttling", () => {
  it("allows ten new accounts an hour from one address", async () => {
    const { POST } = await import("@/app/api/auth/signup/route");
    const make = (i: number, ip?: string) =>
      POST(
        post(
          "/api/auth/signup",
          { email: `mass-${i}@x.test`, password: PASSWORD, name: "보호자", role: "guardian", agreements },
          ip
        )
      );
    for (let i = 0; i < 10; i++) expect((await make(i, "198.51.100.9")).status).toBe(200);
    expect((await make(10, "198.51.100.9")).status).toBe(429);
    expect((await make(11, "198.51.100.10")).status).toBe(200);
  });
});
