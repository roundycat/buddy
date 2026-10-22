#!/usr/bin/env node
/**
 * Records the raw clips for the contest demo video from a running Beddy,
 * in a phone-size window (390×844), following docs/contest/demo-video-script.md.
 *
 *   BASE_URL=https://<service>.onrender.com node scripts/demo/record-demo.mjs
 *
 * No stored password is needed: it signs up a fresh under-14 child and a
 * guardian (names are made up), links them with the child's invite code and
 * gives the guardian consent on screen, exactly as a family would.
 *
 * Clips (MP4, 780×1688) land in OUT_DIR (default demo-out/):
 *   01-child.mp4      sign up (under 14), friend survey, "보호자 동의가 필요해요",
 *                      then — after the guardian's consent — the friend arrives
 *   02-guardian-consent.mp4  guardian signs up, links with the code, consents
 *   03-chat.mp4       three chats; the crisis message is blurred on screen
 *   04-adventure.mp4  today's adventures (one person-connection mission)
 *   05-guardian.mp4   alert card (no chat text) → question → answer
 * plus markers.json (where each scene starts, for cutting) and
 * accounts.json (the made-up e-mails, so the clips can be re-shot).
 *
 * Needs ffmpeg, and once: npm install --no-save playwright@1.56.0 && npx playwright install chromium
 * Then:       node scripts/demo/compose.mjs demo-out
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const id of ["playwright", "/opt/npm-tools/node_modules/playwright"]) {
    try {
      return require(id);
    } catch {
      /* try the next one */
    }
  }
  console.error("playwright is not installed: npm install --no-save playwright@1.56.0 && npx playwright install chromium");
  process.exit(1);
}
const { chromium } = loadPlaywright();

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const OUT = path.resolve(process.env.OUT_DIR || "demo-out");
const SLOW = Number(process.env.TYPE_DELAY_MS || 85);
const CHILD_NAME = process.env.DEMO_CHILD_NAME || "지민";
const FRIEND_NAME = process.env.DEMO_FRIEND_NAME || "포근이";
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 12);
const PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || `Demo#${stamp.slice(-6)}a`;
const ACCOUNTS = {
  child: process.env.DEMO_CHILD_EMAIL || `demo-kid-${stamp}@beddy.test`,
  guardian: process.env.DEMO_GUARDIAN_EMAIL || `demo-parent-${stamp}@beddy.test`,
};

const CHATS = [
  "오늘 주사 맞아서 무서웠어",
  "어제 축구에서 자살골 넣었어ㅋㅋ",
];
/** Shown blurred: the video may be public on the voting page. */
const CRISIS = "요즘 그냥 사라지고 싶어";
const GUARDIAN_QUESTION = "요즘 아이 기분은 어때요?";

const VIEWPORT = { width: 390, height: 844 };
const VIDEO = { width: 780, height: 1688 };

fs.mkdirSync(OUT, { recursive: true });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Seconds into each clip where a scene starts — compose.sh cuts the waits out with these. */
const markers = [];
function mark(clip, label, startedAt) {
  markers.push({ clip, label, at: Number(((Date.now() - startedAt) / 1000).toFixed(1)) });
}

async function newContext(browser) {
  return browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  });
}

/**
 * Sharp phone-size video: Chromium's screencast at device pixels (780×1688),
 * saved frame by frame and encoded to a constant 30 fps MP4 with ffmpeg.
 * (Playwright's own recorder draws a 2x page at 1x.)
 */
const recordings = new Map();

async function startRecording(page, name) {
  const dir = path.join(OUT, `${name}.frames`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const rec = { name, dir, cdp, frames: [], startedAt: Date.now() };
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    const file = path.join(dir, `f${String(rec.frames.length).padStart(6, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    rec.frames.push({ file, t: metadata.timestamp ?? Date.now() / 1000 });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 92,
    maxWidth: VIDEO.width,
    maxHeight: VIDEO.height,
    everyNthFrame: 1,
  });
  recordings.set(page, rec);
  return rec;
}

async function stopRecording(page) {
  const rec = recordings.get(page);
  if (!rec) return;
  recordings.delete(page);
  await rec.cdp.send("Page.stopScreencast").catch(() => undefined);
  await pause(300);
  if (!rec.frames.length) return;
  // Each frame lasts until the next one; the last one for a second.
  const end = Date.now() / 1000;
  const lines = rec.frames.map((f, i) => {
    const next = rec.frames[i + 1]?.t ?? Math.min(f.t + 1, end);
    return `file '${path.basename(f.file)}'\nduration ${Math.max(0.001, next - f.t).toFixed(3)}`;
  });
  // The clip starts when the recording did, so markers line up with it.
  const lead = rec.frames[0].t - rec.startedAt / 1000;
  if (lead > 0.01) lines.unshift(`file '${path.basename(rec.frames[0].file)}'\nduration ${lead.toFixed(3)}`);
  lines.push(`file '${path.basename(rec.frames.at(-1).file)}'`);
  const list = path.join(rec.dir, "frames.txt");
  fs.writeFileSync(list, lines.join("\n") + "\n");
  const target = path.join(OUT, `${rec.name}.mp4`);
  const { spawnSync } = await import("node:child_process");
  const run = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list,
     "-vf", "fps=30,scale=780:1688:force_original_aspect_ratio=decrease,pad=780:1688:(ow-iw)/2:(oh-ih)/2:color=white,format=yuv420p",
     "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-movflags", "+faststart", target],
    { stdio: "inherit" }
  );
  if (run.status !== 0) throw new Error(`ffmpeg failed for ${rec.name}`);
  if (!process.env.KEEP_FRAMES) fs.rmSync(rec.dir, { recursive: true, force: true });
  console.log(`  ✓ ${path.relative(process.cwd(), target)} (${rec.frames.length} frames)`);
}

/** Stop the recording of a page and close it. */
async function finish(page) {
  await stopRecording(page);
  await page.close();
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) }).catch(() => undefined);
}

async function typeSlowly(locator, text) {
  await locator.click();
  // Some fields come prefilled (the onboarding name is the account name).
  await locator.fill("");
  await locator.pressSequentially(text, { delay: SLOW });
}

async function clickText(page, text, opts = {}) {
  await page.getByText(text, { exact: opts.exact ?? true }).first().click();
  await pause(opts.after ?? 350);
}

/** The blur goes on before the text exists, so no frame shows it in the clear. */
async function installBlur(page, secret) {
  await page.addStyleTag({ content: ".demo-blur{filter:blur(7px)!important}" });
  await page.evaluate((text) => {
    const mark = (node) => {
      const el = node.nodeType === 3 ? node.parentElement : node;
      if (el && (el.textContent || "").includes(text)) el.classList.add("demo-blur");
    };
    const walk = (root) => {
      const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = it.nextNode(); n; n = it.nextNode()) if ((n.nodeValue || "").includes(text)) mark(n);
    };
    walk(document.body);
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") mark(r.target);
        r.addedNodes.forEach((n) => (n.nodeType === 3 ? mark(n) : walk(n)));
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  }, secret);
}

/** Wait until the chat input is enabled again and the reply has stopped growing. */
async function waitForReply(page) {
  const input = page.getByPlaceholder("답장을 적어 보세요…");
  await page.waitForTimeout(800);
  await input.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => !document.querySelector('input[placeholder="답장을 적어 보세요…"]')?.hasAttribute("disabled"),
    undefined,
    { timeout: 60_000 }
  );
  await pause(1800);
}

async function signup(page, { name, email, role, under14 }) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await pause(800);
  await page.getByRole("button", { name: "회원가입" }).first().click();
  await pause(500);
  await typeSlowly(page.getByPlaceholder("예: 지민"), name);
  if (role === "guardian") await clickText(page, "보호자");
  if (under14) await clickText(page, "만 14세 미만이에요");
  await page.locator("input[type=email]").fill(email);
  const pw = page.locator("input[type=password]");
  await pw.nth(0).fill(PASSWORD);
  await pw.nth(1).fill(PASSWORD);
  await pause(400);
  for (const box of await page.locator("input[type=checkbox]").all()) {
    await box.evaluate((el) => {
      if (!el.checked) el.click();
    });
    await pause(120);
  }
  await pause(500);
  await page.getByRole("button", { name: "회원가입" }).last().click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  await pause(1200);
}

async function next(page, label = "다음") {
  await page.getByRole("button", { name: label, exact: true }).click();
  await pause(900);
}

/** Survey steps 0–7 (the friend is generated after the guardian's consent). */
async function friendSurvey(page) {
  await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
  await pause(800);
  await typeSlowly(page.getByPlaceholder("예: 지민"), CHILD_NAME);
  await next(page);
  for (const chip of ["🤔 생각이 많아요", "💛 마음이 따뜻해요", "👂 이야기를 잘 들어줘요", "😵 걱정을 오래 해요"]) {
    await clickText(page, chip, { after: 300 });
  }
  await next(page);
  for (const chip of ["🎧 음악 듣기", "🎨 그림", "🖍️ 그림 그리기", "🏥 치료 받기", "🍓 과일"]) {
    await clickText(page, chip, { after: 300 });
  }
  await next(page);
  await clickText(page, "나와 똑같이 만들기", { after: 500 });
  await next(page);
  await typeSlowly(page.getByPlaceholder("예: 별이, 코코, 민수"), FRIEND_NAME);
  await next(page);
  await next(page);
  await clickText(page, "보통", { after: 400 });
  await page.getByText("그냥 들어줘", { exact: false }).first().click();
  await pause(500);
  await next(page, "요약 보기");
  await pause(1200);
  await page.mouse.wheel(0, 500);
  await pause(1200);
  await next(page, "친구 불러오기");
}

async function main() {
  console.log(`Recording from ${BASE} → ${OUT}`);
  const browser = await chromium.launch();
  const childCtx = await newContext(browser);
  const guardianCtx = await newContext(browser);
  try {
    // 1. Child: sign up (under 14) and fill in the friend survey → consent screen.
    //    The same page stays open: once the guardian consents it carries on by itself.
    const child = await childCtx.newPage();
    const t0 = (await startRecording(child, "01-child")).startedAt;
    await signup(child, { name: CHILD_NAME, email: ACCOUNTS.child, role: "child", under14: true });
    mark("01-child", "survey", t0);
    await friendSurvey(child);
    await child.getByText("보호자 동의가 필요해요").waitFor({ timeout: 30_000 });
    mark("01-child", "consent-wait", t0);
    await pause(3500);
    await shot(child, "01-child-consent-wait");
    // The invite code as the child sees it (6 letters/digits under "보호자 초대 코드").
    const code = await child.evaluate(() => {
      const it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = it.nextNode(); n; n = it.nextNode()) {
        const t = (n.nodeValue || "").replace(/\s/g, "");
        if (/^[A-Z0-9]{6}$/.test(t)) return t;
      }
      return null;
    });
    if (!code) throw new Error("no invite code on the consent screen");

    // 2. Guardian: sign up, link with the code, give legal-guardian consent.
    let page = await guardianCtx.newPage();
    const g0 = (await startRecording(page, "02-guardian-consent")).startedAt;
    await signup(page, { name: "지민 보호자", email: ACCOUNTS.guardian, role: "guardian" });
    await page.goto(`${BASE}/guardian`, { waitUntil: "networkidle" });
    await pause(1000);
    mark("02-guardian-consent", "link", g0);
    await typeSlowly(page.getByPlaceholder("예: K7M2PQ"), code);
    await page.getByRole("button", { name: "연결하기" }).click();
    await page.getByText("아이와의 관계").waitFor({ timeout: 30_000 });
    mark("02-guardian-consent", "consent-form", g0);
    await pause(1500);
    await clickText(page, "모");
    await typeSlowly(page.getByPlaceholder("예: 김보호"), "김보호");
    for (const box of await page.locator("form input[type=checkbox]").all()) {
      await box.evaluate((el) => {
        if (!el.checked) el.click();
      });
      await pause(250);
    }
    await page.mouse.wheel(0, 600);
    await pause(800);
    await page.getByRole("button", { name: "동의하고 시작하기" }).click();
    mark("02-guardian-consent", "consented", g0);
    await pause(3000);
    await shot(page, "02-guardian-after-consent");
    await finish(page);

    // 3. Child: consent arrives → the friend is drawn → pick one → home.
    await child.bringToFront();
    mark("01-child", "consent-granted", t0);
    const check = child.getByRole("button", { name: "보호자가 동의했는지 확인하기" });
    if (await check.isVisible().catch(() => false)) await check.click().catch(() => undefined);
    await child.getByText("어떤 모습이 더 마음에 들어요?").waitFor({ timeout: 120_000 });
    mark("01-child", "avatar-pick", t0);
    await pause(1500);
    await child.locator("section button").first().click();
    await pause(1200);
    await child.getByRole("button", { name: "이 친구와 만나기" }).click();
    await child.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
    mark("01-child", "home", t0);
    await pause(4000);
    await shot(child, "03-child-home");
    await finish(child);

    // 4. Chats: comfort, a joke that v1 alarmed on, and a blurred crisis message.
    page = await childCtx.newPage();
    const c0 = (await startRecording(page, "03-chat")).startedAt;
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await pause(1500);
    await page.getByRole("button", { name: "대화 열기" }).click();
    await pause(1200);
    await installBlur(page, CRISIS);
    const input = page.getByPlaceholder("답장을 적어 보세요…");
    for (const [i, text] of CHATS.entries()) {
      mark("03-chat", `message-${i + 1}`, c0);
      await typeSlowly(input, text);
      await pause(400);
      await input.press("Enter");
      await waitForReply(page);
    }
    await page.addStyleTag({ content: 'input[placeholder="답장을 적어 보세요…"]{filter:blur(7px)}' });
    mark("03-chat", "crisis", c0);
    await typeSlowly(input, CRISIS);
    await pause(400);
    await input.press("Enter");
    await waitForReply(page);
    mark("03-chat", "panel", c0);
    await pause(4000);
    await page.mouse.wheel(0, 400);
    await pause(2500);
    await shot(page, "03-chat-crisis");
    await finish(page);

    // 5. Today's adventures.
    page = await childCtx.newPage();
    await startRecording(page, "04-adventure");
    await page.goto(`${BASE}/adventure`, { waitUntil: "networkidle" });
    await pause(4000);
    await page.mouse.wheel(0, 500);
    await pause(3000);
    await page.mouse.wheel(0, 500);
    await pause(3000);
    await shot(page, "04-adventure");
    await finish(page);

    // 6. Guardian: alert card without chat text → ask → summary-based answer.
    page = await guardianCtx.newPage();
    const h0 = (await startRecording(page, "05-guardian")).startedAt;
    await page.goto(`${BASE}/guardian`, { waitUntil: "networkidle" });
    mark("05-guardian", "home", h0);
    await pause(5000);
    await shot(page, "05-guardian-home");
    await page.mouse.wheel(0, 600);
    await pause(2500);
    await page.goto(`${BASE}/guardian/report`, { waitUntil: "networkidle" });
    await pause(1500);
    mark("05-guardian", "ask", h0);
    const ask = page.locator("form textarea").first();
    await typeSlowly(ask, GUARDIAN_QUESTION);
    await ask.press("Enter");
    // "정리하는 중…" shows while the answer is being written.
    await page.getByText("정리하는 중…").waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
    await page.getByText("정리하는 중…").waitFor({ state: "hidden", timeout: 90_000 });
    mark("05-guardian", "answer", h0);
    await pause(9000);
    await shot(page, "05-guardian-answer");
    await finish(page);
  } catch (error) {
    console.error("recording stopped:", error instanceof Error ? error.message : error);
    for (const ctx of [childCtx, guardianCtx]) {
      for (const p of ctx.pages()) {
        await shot(p, `error-${Date.now()}`);
        await stopRecording(p).catch(() => undefined);
      }
    }
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(path.join(OUT, "markers.json"), JSON.stringify(markers, null, 2));
    fs.writeFileSync(
      path.join(OUT, "accounts.json"),
      JSON.stringify({ base: BASE, ...ACCOUNTS, note: "made-up demo accounts; password printed once below" }, null, 2)
    );
    await childCtx.close();
    await guardianCtx.close();
    await browser.close();
    console.log(`accounts: ${ACCOUNTS.child} / ${ACCOUNTS.guardian}  password: ${PASSWORD}`);
  }
}

await main();
