#!/usr/bin/env node
/**
 * Builds the contest demo video (1920×1080, H.264) from the clips recorded by
 * record-demo.mjs: the phone screen on the left, a caption on the right, and
 * full-screen cards for the opening numbers, the measurements and the ending.
 *
 *   node scripts/demo/compose.mjs demo-out            → demo-out/beddy-demo.mp4
 *
 * Needs ffmpeg/ffprobe and Playwright (to draw the cards and captions from HTML).
 * Scenes and captions live in scenes.mjs.
 */
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { MAIN, MEASUREMENTS } from "./scenes.mjs";

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

const DIR = path.resolve(process.argv[2] || "demo-out");
const OUT = path.join(DIR, process.env.DEMO_OUTPUT || "beddy-demo.mp4");
const WORK = path.join(DIR, ".compose");
const W = 1920;
const H = 1080;
const FPS = 30;
const FADE = 0.35;
// Phone screen on the canvas (clips are 780×1688).
const SCREEN = { x: 300, y: 51, w: 452, h: 978 };

const FONT = `"Pretendard", "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", "Malgun Gothic", sans-serif`;
const C = {
  slate: "#334155",
  ink: "#1F2937",
  muted: "#64748B",
  sage: "#94A37E",
  sageDeep: "#6F7F5A",
  rose: "#C5A3A3",
  cream: "#F7F3EA",
  creamDeep: "#EDE6D9",
};

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${args.join(" ").slice(0, 300)}`);
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

const backdrop = `linear-gradient(135deg, ${C.cream} 0%, #F3EEE3 55%, ${C.creamDeep} 100%)`;

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
    `<div style="position:absolute;left:${SCREEN.x - 22}px;top:${SCREEN.y - 22}px;width:${SCREEN.w + 44}px;height:${SCREEN.h + 44}px;border-radius:64px;border:22px solid ${C.ink};box-shadow:inset 0 0 0 40px transparent"></div>
     <div style="position:absolute;left:${SCREEN.x}px;top:${SCREEN.y}px;width:${SCREEN.w}px;height:${SCREEN.h}px;border-radius:42px;box-shadow:0 0 0 30px ${C.ink}"></div>`
  );
}

function captionHtml(scene, index, total) {
  return page(
    `<div style="position:absolute;left:880px;top:0;width:900px;height:${H}px;display:flex;flex-direction:column;justify-content:center">
       <div style="font-size:24px;letter-spacing:.12em;color:${C.sageDeep};font-weight:600">BEDDY 2.0 · ${String(index).padStart(2, "0")} / ${String(total).padStart(2, "0")}</div>
       <div style="margin-top:22px;font-size:60px;line-height:1.25;font-weight:700;color:${C.ink}">${esc(scene.title)}</div>
       <div style="margin-top:30px;font-size:34px;line-height:1.6;color:${C.slate}">${esc(scene.body)}</div>
       ${scene.note ? `<div style="margin-top:28px;font-size:24px;color:${C.muted}">${esc(scene.note)}</div>` : ""}
     </div>`
  );
}

function cardHtml(scene) {
  const frame = (inner) =>
    page(`<div style="position:absolute;inset:0;background:${backdrop};display:flex;align-items:center;justify-content:center;text-align:center">${inner}</div>`);
  switch (scene.card) {
    case "title":
      return frame(`<div>
        <div style="font-size:150px;font-weight:800;letter-spacing:-.02em;color:${C.ink}">${esc(scene.title)}</div>
        <div style="margin-top:28px;font-size:46px;color:${C.slate}">${esc(scene.body)}</div>
        <div style="margin-top:60px;font-size:30px;letter-spacing:.2em;color:${C.sageDeep};font-weight:600">${esc(scene.foot)}</div>
      </div>`);
    case "number":
      return frame(`<div style="max-width:1500px">
        <div style="font-size:150px;font-weight:800;color:${C.ink};letter-spacing:-.01em">${esc(scene.title)}</div>
        <div style="margin-top:34px;font-size:46px;line-height:1.5;color:${C.slate}">${esc(scene.body)}</div>
        <div style="margin-top:56px;font-size:24px;color:${C.muted}">${esc(scene.foot)}</div>
      </div>`);
    case "quote":
      return frame(`<div>
        <div style="font-size:72px;font-weight:700;color:${C.ink}">${esc(scene.title)}</div>
        <div style="margin-top:36px;font-size:72px;font-weight:700;color:${C.sageDeep}">${esc(scene.body)}</div>
      </div>`);
    case "measure": {
      const rows = MEASUREMENTS.map(
        ([label, v1, v2]) => `<tr>
          <td style="padding:26px 34px;text-align:left;font-size:36px;color:${C.slate}">${esc(label)}</td>
          <td style="padding:26px 34px;font-size:44px;color:${C.muted}">${esc(v1)}</td>
          <td style="padding:26px 34px;font-size:52px;font-weight:800;color:${C.ink}">${esc(v2)}</td></tr>`
      ).join("");
      return frame(`<div>
        <div style="font-size:46px;font-weight:700;color:${C.ink};margin-bottom:46px">${esc(scene.title)}</div>
        <table style="border-collapse:collapse;margin:0 auto;background:rgba(255,255,255,.75);border-radius:28px;overflow:hidden;box-shadow:0 20px 50px rgba(51,65,85,.12)">
          <tr><th></th><th style="padding:22px 34px;font-size:28px;color:${C.muted}">v1</th><th style="padding:22px 34px;font-size:28px;color:${C.sageDeep}">v2</th></tr>
          ${rows}
        </table>
      </div>`);
    }
    case "end":
      return frame(`<div>
        <div style="font-size:84px;font-weight:800;color:${C.ink}">${esc(scene.title)}</div>
        <div style="margin-top:34px;font-size:40px;color:${C.slate}">${esc(scene.body)}</div>
        <div style="margin-top:90px;font-size:30px;color:${C.muted}">${esc(scene.foot)}</div>
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

  const scenes = MAIN;
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
      const length = duration(clip);
      const from = resolveTime(s.from, s.clip, markers, length);
      const to = resolveTime(s.to, s.clip, markers, length);
      const speed = s.speed ?? 1;
      const seconds = Math.max(1, (to - from) / speed);
      run("ffmpeg", [
        "-hide_banner", "-v", "error", "-y",
        "-loop", "1", "-t", seconds.toFixed(3), "-i", path.join(WORK, "background.png"),
        "-ss", from.toFixed(3), "-t", (to - from).toFixed(3), "-i", clip,
        "-loop", "1", "-t", seconds.toFixed(3), "-i", path.join(WORK, "bezel.png"),
        "-loop", "1", "-t", seconds.toFixed(3), "-i", path.join(WORK, `caption-${i}.png`),
        "-filter_complex",
        [
          `[1:v]setpts=(PTS-STARTPTS)/${speed},scale=${SCREEN.w}:${SCREEN.h}:flags=lanczos,tpad=stop_mode=clone:stop_duration=2[phone]`,
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
  if (total > 300) console.warn("! longer than 5 minutes — the contest allows 2–5 minutes");
  if (total < 120) console.warn("! shorter than 2 minutes — the contest asks for 2–5 minutes");
}

await main();
