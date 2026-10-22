#!/usr/bin/env node
/**
 * Supporting documents for the submission email, as A4 PDFs (공고 9: 성과 입증 자료 추가 제출 가능).
 *
 *   node docs/contest/forms/build_attachments.mjs
 *
 * Needs pandoc and Playwright's Chromium (same setup as scripts/demo).
 * Writes docs/contest/forms/out/<name>.pdf.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const OUT = join(HERE, "out");

const DOCS = [
  {
    source: "docs/v2/CHANGES.md",
    output: "Beddy2.0_v1-v2_구분표.pdf",
    note: "성과보고서 별첨 · 팀 YSA · 저장소 roundycat/buddy의 docs/v2/CHANGES.md",
  },
];

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const id of ["playwright", "/opt/npm-tools/node_modules/playwright"]) {
    try {
      return require(id);
    } catch {
      /* try next */
    }
  }
  console.error("playwright is not installed: npm install --no-save playwright@1.56.0 && npx playwright install chromium");
  process.exit(1);
}

const CSS = `
@page { size: A4; margin: 14mm 13mm 16mm; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: "Malgun Gothic", "맑은 고딕", "Noto Sans CJK KR", sans-serif; font-size: 9.2pt; line-height: 1.5; color: #111; word-break: keep-all; overflow-wrap: anywhere; }
h1 { font-size: 15pt; margin: 0 0 2mm; padding-bottom: 2mm; border-bottom: 2px solid #1f3b63; }
h2 { font-size: 11.5pt; margin: 5mm 0 2mm; color: #1f3b63; }
p, li { margin: 1mm 0; }
ul { padding-left: 5mm; margin: 1mm 0; }
.note { color: #555; font-size: 8.2pt; margin: 0 0 3mm; }
table { border-collapse: collapse; width: 100%; margin: 2mm 0; font-size: 8.3pt; line-height: 1.42; }
th, td { border: 0.6pt solid #9aa5b1; padding: 1.3mm 1.6mm; vertical-align: top; text-align: left; }
th { background: #e6eef7; }
tr { break-inside: avoid; }
table:first-of-type td:first-child { text-align: center; }
table:first-of-type, table:last-of-type { table-layout: fixed; }
table:first-of-type th:nth-child(1) { width: 5%; }
table:first-of-type th:nth-child(2) { width: 12%; }
table:first-of-type th:nth-child(3) { width: 22%; }
table:last-of-type th:nth-child(1) { width: 29%; }
table:last-of-type th:nth-child(2), table:last-of-type th:nth-child(3) { width: 10%; }
code { font-family: "D2Coding", "Noto Sans Mono CJK KR", monospace; font-size: 0.92em; background: #f1f3f5; padding: 0 0.6mm; border-radius: 1mm; }
`;

async function main() {
  const { chromium } = loadPlaywright();
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const doc of DOCS) {
      const markdown = readFileSync(join(ROOT, doc.source), "utf8");
      const body = execFileSync("pandoc", ["-f", "gfm", "-t", "html5"], { input: markdown }).toString();
      const withNote = body.replace(/(<\/h1>)/, `$1<p class="note">${doc.note}</p>`);
      const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${withNote}</body></html>`;
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      const target = join(OUT, doc.output);
      await page.pdf({
        path: target,
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate:
          '<div style="width:100%;font-size:7pt;color:#777;text-align:center;font-family:sans-serif">' +
          '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
        margin: { top: "14mm", bottom: "16mm", left: "13mm", right: "13mm" },
      });
      await page.close();
      console.log(target.replace(`${ROOT}/`, ""));
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
