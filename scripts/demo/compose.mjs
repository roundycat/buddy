#!/usr/bin/env node
/**
 * Builds the contest videos from the clips recorded by record-demo.mjs.
 *
 *   node scripts/demo/compose.mjs demo-out              → demo-out/beddy-demo.mp4
 *        the submission video: 1920×1080, 2–5 minutes, phone screen beside a caption
 *   node scripts/demo/compose.mjs demo-out --cut vote   → demo-out/beddy-vote.mp4
 *        the voting-page short: 1080×1920, about a minute, caption above the phone
 *
 * Full-screen cards carry the opening numbers, how the safety layer works,
 * the measurements and the ending. Scenes and captions live in scenes.mjs.
 *
 * Needs ffmpeg/ffprobe and Playwright (it draws the cards and captions from HTML).
 * The sound track is silent; add licence-free music in an editor if wanted.
 */
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { GUARD_EXAMPLES, MAIN, MEASUREMENTS, PIPELINE, VOTE } from "./scenes.mjs";

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const id of ["playwright", "/opt/npm-tools/node_modules/playwright"]) {
    try {
      return require(id);
    } catch {
      /* next */
    }
  }
  console.error("playwright is not installed: npm install --no-save playwright@1.56.0 && npx playwright install chromium");
  process.exit(1);
}

const args = process.argv.slice(2);
const cutAt = args.indexOf("--cut");
const CUT = cutAt >= 0 ? args[cutAt + 1] : "main";
const DIR = path.resolve(args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--cut") || "demo-out");
if (!["main", "vote"].includes(CUT)) {
  console.error(`unknown cut "${CUT}" — use --cut main or --cut vote`);
  process.exit(1);
}

/**
 * Canvas and phone-screen position for each cut. The clips are 780×1688, so the
 * screen keeps that ratio (0.462).
 */
const LAYOUT = {
  main: { W: 1920, H: 1080, screen: { x: 300, y: 51, w: 452, h: 978 }, out: "beddy-demo.mp4", min: 120, max: 300 },
  vote: { W: 1080, H: 1920, screen: { x: 250, y: 520, w: 580, h: 1255 }, out: "beddy-vote.mp4", min: 40, max: 62 },
}[CUT];
const { W, H } = LAYOUT;
const SCREEN = LAYOUT.screen;
const VERTICAL = CUT === "vote";
const OUT = path.join(DIR, process.env.DEMO_OUTPUT || LAYOUT.out);
const WORK = path.join(DIR, `.compose-${CUT}`);
const FPS = 30;
const FADE = 0.35;

const FONT = `"Pretendard", "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", "Malgun Gothic", sans-serif`;
const C = {
  slate: "#334155",
  ink: "#1F2937",
  muted: "#64748B",
  sage: "#94A37E",
  sageDeep: "#6F7F5A",
  rose: "#B4787A",
  roseSoft: "#F6E9E7",
  sageSoft: "#EEF2E6",
  cream: "#F7F3EA",
  creamDeep: "#EDE6D9",
};

function run(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${cmdArgs.join(" ").slice(0, 300)}`);
}

function duration(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], {
    encoding: "utf8",
  });
  return Number(r.stdout.trim());
}

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

const page = (body, bg = "transparent") => `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;background:${bg};font-family:${FONT};color:${C.ink};-webkit-font-smoothing:antialiased;word-break:keep-all}
</style></head><body>${body}</body></html>`;

const backdrop = `linear-gradient(${VERTICAL ? 170 : 135}deg, ${C.cream} 0%, #F3EEE3 55%, ${C.creamDeep} 100%)`;

function backgroundHtml() {
  return page(
    `<div style="position:absolute;inset:0;background:${backdrop}"></div>
     <div style="position:absolute;left:${SCREEN.x - 22}px;top:${SCREEN.y - 22}px;width:${SCREEN.w + 44}px;height:${SCREEN.h + 44}px;border-radius:64px;box-shadow:0 30px 80px rgba(51,65,85,.28),0 8px 24px rgba(51,65,85,.18)"></div>`,
    "transparent"
  );
}

function bezelHtml() {
  // A ring around the screen; the inner corners round the video's corners.
  return page(
    `<div style="position:absolute;left:${SCREEN.x - 22}px;top:${SCREEN.y - 22}px;width:${SCREEN.w + 44}px;height:${SCREEN.h + 44}px;border-radius:64px;border:22px solid ${C.ink}"></div>
     <div style="position:absolute;left:${SCREEN.x}px;top:${SCREEN.y}px;width:${SCREEN.w}px;height:${SCREEN.h}px;border-radius:42px;box-shadow:0 0 0 30px ${C.ink}"></div>`
  );
}

function captionHtml(scene, index, total) {
  const counter = `BEDDY 2.0 · ${String(index).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  if (VERTICAL) {
    return page(
      `<div style="position:absolute;left:70px;right:70px;top:70px;height:${SCREEN.y - 110}px;display:flex;flex-direction:column;justify-content:center;text-align:center">
         <div style="font-size:26px;letter-spacing:.14em;color:${C.sageDeep};font-weight:600">BEDDY 2.0</div>
         <div style="margin-top:20px;font-size:66px;line-height:1.22;font-weight:800;color:${C.ink}">${esc(scene.title)}</div>
         ${scene.body ? `<div style="margin-top:22px;font-size:36px;line-height:1.45;color:${C.slate}">${esc(scene.body)}</div>` : ""}
       </div>
       ${scene.note ? `<div style="position:absolute;left:0;right:0;top:${SCREEN.y + SCREEN.h + 46}px;text-align:center;font-size:26px;color:${C.muted}">${esc(scene.note)}</div>` : ""}`
    );
  }
  return page(
    `<div style="position:absolute;left:880px;top:0;width:900px;height:${H}px;display:flex;flex-direction:column;justify-content:center">
       <div style="font-size:24px;letter-spacing:.12em;color:${C.sageDeep};font-weight:600">${counter}</div>
       <div style="margin-top:22px;font-size:60px;line-height:1.25;font-weight:700;color:${C.ink}">${esc(scene.title)}</div>
       <div style="margin-top:30px;font-size:34px;line-height:1.6;color:${C.slate}">${esc(scene.body)}</div>
       ${scene.note ? `<div style="margin-top:28px;font-size:24px;color:${C.muted}">${esc(scene.note)}</div>` : ""}
     </div>`
  );
}

/** Size for the cut: [main, vote]. */
const px = (main, vote) => `${VERTICAL ? vote : main}px`;

function pipelineHtml(scene) {
  const arrow = VERTICAL
    ? `<div style="font-size:44px;line-height:1;color:${C.sage};margin:10px 0">↓</div>`
    : `<div style="font-size:52px;color:${C.sage};margin:0 14px;align-self:center">→</div>`;
  const boxes = PIPELINE.map(
    (step, i) => `<div style="background:rgba(255,255,255,.82);border-radius:26px;box-shadow:0 16px 40px rgba(51,65,85,.10);padding:${px(28, 26)} ${px(24, 34)};${VERTICAL ? "width:860px" : "width:292px;min-height:330px"};text-align:${VERTICAL ? "left" : "center"}">
        <div style="font-size:${px(22, 24)};font-weight:700;letter-spacing:.08em;color:${C.sageDeep}">${String(i + 1).padStart(2, "0")}</div>
        <div style="margin-top:10px;font-size:${px(36, 40)};font-weight:800;color:${C.ink}">${esc(step.title)}</div>
        <div style="margin-top:14px;font-size:${px(25, 28)};line-height:1.5;color:${C.slate}">${esc(step.body)}</div>
      </div>`
  ).join(arrow);
  return `<div>
      <div style="font-size:${px(54, 60)};font-weight:800;color:${C.ink};margin-bottom:${px(54, 50)}">${esc(scene.title)}</div>
      <div style="display:flex;flex-direction:${VERTICAL ? "column" : "row"};align-items:${VERTICAL ? "center" : "stretch"};justify-content:center">${boxes}</div>
      ${scene.foot ? `<div style="margin-top:${px(48, 44)};font-size:${px(26, 28)};color:${C.muted}">${esc(scene.foot)}</div>` : ""}
    </div>`;
}

function guardHtml(scene) {
  const rows = GUARD_EXAMPLES.map(
    ([kind, before, after]) => `<div style="display:flex;${VERTICAL ? "flex-direction:column;gap:12px" : "align-items:center;gap:22px"};background:rgba(255,255,255,.82);border-radius:24px;padding:${px(22, 26)} ${px(30, 30)};box-shadow:0 12px 30px rgba(51,65,85,.08);text-align:left">
        <div style="${VERTICAL ? "" : "width:170px;flex:none;"}font-size:${px(26, 28)};font-weight:700;color:${C.sageDeep}">${esc(kind)}</div>
        <div style="${VERTICAL ? "" : "width:520px;flex:none;"}font-size:${px(28, 30)};color:${C.rose};background:${C.roseSoft};border-radius:14px;padding:12px 18px;text-decoration:line-through;text-decoration-thickness:2px">${esc(before)}</div>
        ${VERTICAL ? "" : `<div style="font-size:40px;color:${C.sage}">→</div>`}
        <div style="flex:1;font-size:${px(28, 30)};line-height:1.45;color:${C.ink};background:${C.sageSoft};border-radius:14px;padding:12px 18px">${esc(after)}</div>
      </div>`
  ).join("");
  return `<div style="width:${px(1640, 940)}">
      <div style="font-size:${px(52, 58)};font-weight:800;color:${C.ink}">${esc(scene.title)}</div>
      ${scene.body ? `<div style="margin-top:18px;font-size:${px(30, 32)};color:${C.slate}">${esc(scene.body)}</div>` : ""}
      <div style="margin-top:${px(44, 40)};display:flex;flex-direction:column;gap:${px(18, 22)}">${rows}</div>
      ${scene.foot ? `<div style="margin-top:${px(34, 36)};font-size:${px(24, 26)};color:${C.muted}">${esc(scene.foot)}</div>` : ""}
    </div>`;
}

function measureHtml(scene) {
  if (VERTICAL) {
    const rows = MEASUREMENTS.map(
      ([label, v1, v2]) => `<div style="background:rgba(255,255,255,.8);border-radius:26px;padding:30px 36px;text-align:left">
          <div style="font-size:30px;color:${C.slate}">${esc(label)}</div>
          <div style="margin-top:14px;font-size:30px;color:${C.muted}">v1 ${esc(v1)} <span style="color:${C.sage}">→</span> <b style="font-size:56px;color:${C.ink}">v2 ${esc(v2)}</b></div>
        </div>`
    ).join("");
    return `<div style="width:920px"><div style="font-size:52px;font-weight:800;margin-bottom:40px">${esc(scene.title)}</div>
      <div style="display:flex;flex-direction:column;gap:24px">${rows}</div></div>`;
  }
  const rows = MEASUREMENTS.map(
    ([label, v1, v2]) => `<tr>
      <td style="padding:26px 34px;text-align:left;font-size:36px;color:${C.slate}">${esc(label)}</td>
      <td style="padding:26px 34px;font-size:44px;color:${C.muted}">${esc(v1)}</td>
      <td style="padding:26px 34px;font-size:52px;font-weight:800;color:${C.ink}">${esc(v2)}</td></tr>`
  ).join("");
  return `<div>
    <div style="font-size:46px;font-weight:700;color:${C.ink};margin-bottom:46px">${esc(scene.title)}</div>
    <table style="border-collapse:collapse;margin:0 auto;background:rgba(255,255,255,.75);border-radius:28px;overflow:hidden;box-shadow:0 20px 50px rgba(51,65,85,.12)">
      <tr><th></th><th style="padding:22px 34px;font-size:28px;color:${C.muted}">v1</th><th style="padding:22px 34px;font-size:28px;color:${C.sageDeep}">v2</th></tr>
      ${rows}
    </table>
    ${scene.foot ? `<div style="margin-top:34px;font-size:24px;color:${C.muted}">${esc(scene.foot)}</div>` : ""}
  </div>`;
}

function cardHtml(scene) {
  const frame = (inner) =>
    page(`<div style="position:absolute;inset:0;background:${backdrop};display:flex;align-items:center;justify-content:center;text-align:center;padding:0 ${px(80, 60)}">${inner}</div>`);
  switch (scene.card) {
    case "title":
      return frame(`<div>
        <div style="font-size:${px(150, 132)};font-weight:800;letter-spacing:-.02em;color:${C.ink}">${esc(scene.title)}</div>
        <div style="margin-top:28px;font-size:${px(46, 44)};line-height:1.4;color:${C.slate}">${esc(scene.body)}</div>
        <div style="margin-top:60px;font-size:30px;letter-spacing:.2em;color:${C.sageDeep};font-weight:600">${esc(scene.foot)}</div>
      </div>`);
    case "number":
      return frame(`<div style="max-width:${px(1500, 940)}">
        <div style="font-size:${px(150, 112)};line-height:1.15;font-weight:800;color:${C.ink};letter-spacing:-.01em">${esc(scene.title)}</div>
        <div style="margin-top:34px;font-size:${px(46, 42)};line-height:1.5;color:${C.slate}">${esc(scene.body)}</div>
        <div style="margin-top:56px;font-size:24px;color:${C.muted}">${esc(scene.foot)}</div>
      </div>`);
    case "quote":
      return frame(`<div>
        <div style="font-size:${px(72, 70)};line-height:1.3;font-weight:700;color:${C.ink}">${esc(scene.title)}</div>
        <div style="margin-top:36px;font-size:${px(72, 70)};line-height:1.3;font-weight:700;color:${C.sageDeep}">${esc(scene.body)}</div>
      </div>`);
    case "pipeline":
      return frame(pipelineHtml(scene));
    case "guard":
      return frame(guardHtml(scene));
    case "measure":
      return frame(measureHtml(scene));
    case "end":
      return frame(`<div>
        <div style="font-size:${px(84, 76)};line-height:1.25;font-weight:800;color:${C.ink}">${esc(scene.title)}</div>
        <div style="margin-top:34px;font-size:${px(40, 40)};line-height:1.5;color:${C.slate}">${esc(scene.body)}</div>
        <div style="margin-top:${px(90, 120)};font-size:${px(30, 32)};color:${C.muted}">${esc(scene.foot)}</div>
      </div>`);
    default:
      throw new Error(`unknown card ${scene.card}`);
  }
}

async function renderImages(scenes) {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: W, height: H } });
  const shot = async (html, file) => {
    await tab.setContent(html, { waitUntil: "load" });
    await tab.waitForTimeout(150);
    await tab.screenshot({ path: file, omitBackground: true });
  };
  await shot(backgroundHtml(), path.join(WORK, "background.png"));
  await shot(bezelHtml(), path.join(WORK, "bezel.png"));
  const clipScenes = scenes.filter((s) => s.clip);
  let n = 0;
  for (const [i, s] of scenes.entries()) {
    if (s.card) await shot(cardHtml(s), path.join(WORK, `card-${i}.png`));
    else await shot(captionHtml(s, ++n, clipScenes.length), path.join(WORK, `caption-${i}.png`));
  }
  await browser.close();
}

function resolveTime(value, clip, markers, length) {
  if (value === "end") return length;
  if (typeof value === "number") return value;
  const label = typeof value === "string" ? value : value.marker;
  const plus = typeof value === "object" ? value.plus ?? 0 : 0;
  const m = markers.find((x) => x.clip === clip && x.label === label);
  if (!m) throw new Error(`no marker "${label}" in ${clip} (markers.json)`);
  return Math.min(length, Math.max(0, m.at + plus));
}

function fades(seconds) {
  return `fade=t=in:st=0:d=${FADE},fade=t=out:st=${Math.max(0, seconds - FADE).toFixed(3)}:d=${FADE}`;
}

function encodeArgs(out) {
  return ["-r", String(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", out];
}

async function main() {
  const markersFile = path.join(DIR, "markers.json");
  if (!fs.existsSync(markersFile)) throw new Error(`no markers.json in ${DIR} — run record-demo.mjs first`);
  const markers = JSON.parse(fs.readFileSync(markersFile, "utf8"));
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });

  const scenes = CUT === "vote" ? VOTE : MAIN;
  await renderImages(scenes);

  const segments = [];
  let total = 0;
  for (const [i, s] of scenes.entries()) {
    const seg = path.join(WORK, `seg-${String(i).padStart(2, "0")}.mp4`);
    if (s.card) {
      run("ffmpeg", [
        "-hide_banner", "-v", "error", "-y", "-loop", "1", "-t", String(s.seconds), "-i", path.join(WORK, `card-${i}.png`),
        "-vf", `${fades(s.seconds)},format=yuv420p`, ...encodeArgs(seg),
      ]);
      total += s.seconds;
    } else {
      const clip = path.join(DIR, `${s.clip}.mp4`);
      if (!fs.existsSync(clip)) throw new Error(`missing clip ${clip} — record it with record-demo.mjs`);
      const length = duration(clip);
      const from = resolveTime(s.from, s.clip, markers, length);
      const to = resolveTime(s.to, s.clip, markers, length);
      if (to - from < 0.5) throw new Error(`scene ${i + 1} (${s.clip}) is empty: ${from}s → ${to}s`);
      // `fit` caps a scene's length by speeding it up (never slows it down).
      const speed = Math.max(s.speed ?? 1, s.fit ? (to - from) / s.fit : 1);
      const seconds = Math.max(1, (to - from) / speed);
      run("ffmpeg", [
        "-hide_banner", "-v", "error", "-y",
        "-loop", "1", "-t", seconds.toFixed(3), "-i", path.join(WORK, "background.png"),
        "-ss", from.toFixed(3), "-t", (to - from).toFixed(3), "-i", clip,
        "-loop", "1", "-t", seconds.toFixed(3), "-i", path.join(WORK, "bezel.png"),
        "-loop", "1", "-t", seconds.toFixed(3), "-i", path.join(WORK, `caption-${i}.png`),
        "-filter_complex",
        [
          `[1:v]setpts=(PTS-STARTPTS)/${speed.toFixed(4)},scale=${SCREEN.w}:${SCREEN.h}:flags=lanczos,tpad=stop_mode=clone:stop_duration=2[phone]`,
          `[0:v][phone]overlay=${SCREEN.x}:${SCREEN.y}:shortest=0[a]`,
          `[a][2:v]overlay=0:0[b]`,
          `[b][3:v]overlay=0:0,${fades(seconds)},format=yuv420p[out]`,
        ].join(";"),
        "-map", "[out]", "-t", seconds.toFixed(3), ...encodeArgs(seg),
      ]);
      total += seconds;
    }
    segments.push(seg);
    console.log(`  scene ${String(i + 1).padStart(2, "0")} ${s.card ? `card:${s.card}` : s.clip}  ${total.toFixed(1)}s`);
  }

  const list = path.join(WORK, "segments.txt");
  fs.writeFileSync(list, segments.map((f) => `file '${f}'`).join("\n") + "\n");
  run("ffmpeg", [
    "-hide_banner", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list,
    "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "96k", "-shortest",
    "-movflags", "+faststart", OUT,
  ]);
  const minutes = Math.floor(total / 60);
  console.log(`✓ ${path.relative(process.cwd(), OUT)}  ${minutes}:${String(Math.round(total % 60)).padStart(2, "0")}`);
  if (total > LAYOUT.max) console.warn(`! ${Math.round(total)}s — longer than planned (${LAYOUT.max}s) for the ${CUT} cut`);
  if (total < LAYOUT.min) console.warn(`! ${Math.round(total)}s — shorter than planned (${LAYOUT.min}s) for the ${CUT} cut`);
}

await main();
