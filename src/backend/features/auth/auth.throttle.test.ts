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
// As on Render (render.yaml): Cloudflare's CF-Connecting-IP is trusted.
process.env.TRUST_CF_CONNECTING_IP = "1";

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const PASSWORD = "Throttle#2026";
const agreements = { terms: true, privacy: true, sensitive: true, ageOrGuardian: true, marketing: false };

/** As on Render: Cloudflare sets CF-Connecting-IP; X-Forwarded-For starts with whatever the client sent. */
function post(url: string, body: unknown, ip = "203.0.113.7", forged = "198.18.0.1") {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": ip,
      "x-forwarded-for": `${forged}, ${ip}`,
    },
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
    // A different forged X-Forwarded-For each time changes nothing.
    for (let i = 0; i < 10; i++) {
      const res = await POST(
        post("/api/auth/login", { email: "throttle-guardian@x.test", password: "Wrong#2026x" }, "203.0.113.7", `198.18.0.${i + 2}`)
      );
      expect(res.status).toBe(401);
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
  it("allows twenty new accounts an hour from one address", async () => {
    const { POST } = await import("@/app/api/auth/signup/route");
    const make = (i: number, ip?: string) =>
      POST(
        post(
          "/api/auth/signup",
          { email: `mass-${i}@x.test`, password: PASSWORD, name: "보호자", role: "guardian", agreements },
          ip
        )
      );
    for (let i = 0; i < 20; i++) expect((await make(i, "198.51.100.9")).status).toBe(200);
    expect((await make(20, "198.51.100.9")).status).toBe(429);
    expect((await make(21, "198.51.100.10")).status).toBe(200);
  });
});

describe("client address", () => {
  it("prefers the edge header and otherwise reads X-Forwarded-For from the right", async () => {
    const { clientAddress } = await import("@/backend/shared/http/rate-limit");
    const req = (headers: Record<string, string>) => new Request("http://localhost/", { headers });
    expect(clientAddress(req({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe(
      "203.0.113.9"
    );
    expect(clientAddress(req({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientAddress(req({}))).toBe("unknown");
  });
  it("ignores CF-Connecting-IP where Cloudflare is not in front (AWS, local)", async () => {
    const { clientAddress } = await import("@/backend/shared/http/rate-limit");
    const req = (headers: Record<string, string>) => new Request("http://localhost/", { headers });
    process.env.TRUST_CF_CONNECTING_IP = "";
    try {
      // A client-made header must not reset its own limits.
      expect(clientAddress(req({ "cf-connecting-ip": "10.9.9.9", "x-forwarded-for": "203.0.113.9" }))).toBe(
        "203.0.113.9"
      );
    } finally {
      process.env.TRUST_CF_CONNECTING_IP = "1";
    }
  });
});

