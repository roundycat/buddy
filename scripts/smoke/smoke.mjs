#!/usr/bin/env node
/**
 * Deployment smoke test — the family flow end to end against a running Beddy.
 *
 *   BASE_URL=https://<service>.onrender.com node scripts/smoke/smoke.mjs
 *
 * It signs up a made-up under-14 child and a guardian (no stored password),
 * checks that nothing opens before the guardian consents, then chats, sends a
 * crisis message, and looks at what the guardian sees. Both accounts are
 * deleted at the end, so the service is left as it was.
 *
 * Exit code 1 when a check fails. Needs Node 18+ (fetch), nothing else.
 */
const BASE = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
const PASSWORD = `Smoke#${Math.random().toString(36).slice(2, 8)}9`;
const CHILD = { name: "스모크", email: `smoke-kid-${stamp}@beddy.test` };
const GUARDIAN = { name: "스모크 보호자", email: `smoke-parent-${stamp}@beddy.test` };
const CRISIS = "요즘 그냥 사라지고 싶어";
const FORGED_IP = "203.0.113.77";

let failures = 0;
let warnings = 0;
const ok = (label, detail = "") => console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
const bad = (label, detail = "") => {
  failures += 1;
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
};
const warn = (label, detail = "") => {
  warnings += 1;
  console.log(`  ! ${label}${detail ? ` — ${detail}` : ""}`);
};
const check = (cond, label, detail) => (cond ? ok(label, detail) : bad(label, detail));

/** A browser-like session: keeps the cookies the app sets. */
function session() {
  const jar = new Map();
  return async function call(path, { method = "GET", body, headers = {} } = {}) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      redirect: "manual",
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(jar.size ? { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(";");
      const at = pair.indexOf("=");
      const name = pair.slice(0, at).trim();
      const value = pair.slice(at + 1).trim();
      if (value) jar.set(name, value);
      else jar.delete(name);
    }
    return res;
  };
}

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 200) };
  }
}

/** Sends one chat message on the streaming route and collects the events. */
async function chat(call, message) {
  const res = await call("/api/conversation?stream=1", {
    method: "POST",
    body: { message },
    headers: { accept: "text/event-stream" },
  });
  if (!res.ok) return { status: res.status, events: [], text: "" };
  const raw = await res.text();
  const events = raw
    .split("\n\n")
    .map((chunk) => chunk.replace(/^data: /, "").trim())
    .filter((d) => d && d !== "[DONE]")
    .map((d) => {
      try {
        return JSON.parse(d);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const text = events.filter((e) => e.type === "token").map((e) => e.text).join("");
  return { status: res.status, events, text };
}

async function main() {
  console.log(`Smoke test → ${BASE}`);
  const anon = session();
  const child = session();
  const guardian = session();

  // 1. Up, and rate limits keyed on the real client address
  console.log("서버");
  const health = await anon("/api/health?client=1");
  const healthBody = await json(health);
  check(health.ok && healthBody.ok === true, "health", `${health.status}`);
  const forged = await json(await anon("/api/health?client=1", { headers: { "x-forwarded-for": FORGED_IP } }));
  const trusted = forged.client && forged.client !== FORGED_IP && forged.client === healthBody.client;
  if (/^http:\/\/(127\.0\.0\.1|localhost)/.test(BASE)) {
    // No proxy in front locally, so the header can't be told apart from one.
    if (!trusted) warn("위조한 X-Forwarded-For 확인은 배포 주소에서만 의미가 있음");
  } else {
    check(trusted, "속도 제한이 위조한 X-Forwarded-For를 믿지 않음", trusted ? "실제 주소 기준" : "위조한 주소를 그대로 씀");
  }
  const page = await anon("/login");
  const h = page.headers;
  check(h.get("x-frame-options") === "DENY" && h.get("x-content-type-options") === "nosniff", "보안 헤더");
  if (BASE.startsWith("https://") && !h.get("strict-transport-security")) warn("HSTS 헤더가 없음");

  // 2. Sign up a child (under 14) and a guardian
  console.log("가입과 동의");
  const agreements = { terms: true, privacy: true, sensitive: false, ageOrGuardian: true, marketing: false };
  let r = await child("/api/auth/signup", {
    method: "POST",
    body: { ...CHILD, password: PASSWORD, role: "child", childAgeBand: "under14", agreements },
  });
  check(r.ok, "아이 가입(만 14세 미만)", `${r.status}`);
  r = await guardian("/api/auth/signup", {
    method: "POST",
    body: { ...GUARDIAN, password: PASSWORD, role: "guardian", agreements },
  });
  check(r.ok, "보호자 가입", `${r.status}`);

  const pending = await json(await child("/api/consent"));
  check(pending.status === "pending", "동의 전 상태는 대기", String(pending.status));
  r = await child("/api/conversation?stream=1", { method: "POST", body: { message: "안녕" }, headers: { accept: "text/event-stream" } });
  check(r.status === 403, "동의 전에는 대화가 잠김", `${r.status}`);
  await r.body?.cancel().catch(() => undefined);

  const invite = await json(await child("/api/guardian/invite"));
  check(typeof invite.code === "string" && invite.code.length === 6, "초대 코드");
  r = await guardian("/api/guardian/link", { method: "POST", body: { code: invite.code } });
  check(r.ok, "보호자 연결", `${r.status}`);
  r = await guardian("/api/guardian/consent", {
    method: "POST",
    body: {
      relationship: "mother",
      guardianName: "김보호",
      items: { privacyCollection: true, sensitiveData: true, aiFeatures: true },
    },
  });
  check(r.ok, "법정대리인 동의", `${r.status}`);
  const granted = await json(await child("/api/consent"));
  check(granted.status === "granted", "동의 뒤 잠금 해제", String(granted.status));

  // 3. The friend, then chats
  console.log("대화");
  r = await child("/api/persona/generate", {
    method: "POST",
    body: {
      mode: "mirror",
      self: { nickname: CHILD.name },
      character: { nickname: "포근이" },
      energy: "medium",
      interaction: "listen",
    },
  });
  check(r.ok, "친구 만들기", `${r.status}`);

  const calm = await chat(child, "오늘 주사 맞아서 무서웠어");
  const done = calm.events.find((e) => e.type === "done");
  check(calm.status === 200 && calm.text.trim().length > 0, "답장이 흘러나옴", `${calm.text.length}자`);
  check(!calm.events.some((e) => e.type === "crisis"), "평범한 말에는 도움 패널 없음");
  const provider = done?.reply?.meta?.provider;
  if (provider === "anthropic") ok("Claude가 답함", done.reply.meta.model ?? "");
  else warn("Claude가 아닌 대체 답변", `provider=${provider ?? "?"} — API 키나 하루 상한을 확인하세요`);

  const joke = await chat(child, "어제 축구에서 자살골 넣었어ㅋㅋ");
  check(!joke.events.some((e) => e.type === "crisis"), "장난은 장난으로(자살골)");

  const crisis = await chat(child, CRISIS);
  const panel = crisis.events.find((e) => e.type === "crisis");
  check(panel && (panel.level === "elevated" || panel.level === "urgent"), "위기 문장에 도움 패널", panel?.level ?? "없음");
  check(
    panel?.actions?.some((a) => a.id === "notify_nurse") && panel?.actions?.some((a) => a.href === "tel:109"),
    "도움 버튼(간호사·109)"
  );

  // 4. What the guardian sees
  console.log("보호자 화면");
  // The alert is written as the reply starts; give a slow disk a moment.
  let alert = null;
  for (let i = 0; i < 5 && !alert; i += 1) {
    alert = (await json(await guardian("/api/parent/safety-alert"))).alert;
    if (!alert) await new Promise((res) => setTimeout(res, 1000));
  }
  check(alert && (alert.level === "elevated" || alert.level === "urgent"), "보호자 안전 알림", alert?.level ?? "없음");
  check(alert && !JSON.stringify(alert).includes("사라지고"), "알림에 아이 말 원문 없음");
  const report = await json(
    await guardian("/api/parent/report", { method: "POST", body: { question: "요즘 아이 기분은 어때요?" } })
  );
  // { linked, childName, suggestedQuestions, answer: { question, answer, sources } }
  const answer = typeof report.answer?.answer === "string" ? report.answer.answer : "";
  check(answer.length > 0, "보호자 질문에 답함", `${answer.length}자 · 출처 ${(report.answer?.sources ?? []).join(", ")}`);
  check(!answer.includes("사라지고") && !answer.includes("주사 맞아서"), "답에 아이 말 원문 없음");

  // 5. Leave nothing behind
  console.log("정리");
  r = await child("/api/auth/delete-account", { method: "POST" });
  check(r.ok, "아이 계정 삭제", `${r.status}`);
  r = await guardian("/api/auth/delete-account", { method: "POST" });
  check(r.ok, "보호자 계정 삭제", `${r.status}`);

  console.log(
    failures
      ? `\n✗ ${failures}개 실패${warnings ? `, 확인할 것 ${warnings}개` : ""}`
      : `\n✓ 모두 통과${warnings ? ` (확인할 것 ${warnings}개)` : ""}`
  );
  process.exitCode = failures ? 1 : 0;
}

main().catch((error) => {
  console.error("smoke test stopped:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
