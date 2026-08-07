/**
 * Print view of the sealed storybook — A4 pages a family can keep as PDF.
 */

import type {
  GrowthStorybookResponse,
  StorybookPage,
} from "@/frontend/shared/types/growth-storybook";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Returns false when the browser blocked the print popup. */
export function printBook(book: GrowthStorybookResponse): boolean {
  const popup = window.open("", "_blank");
  if (!popup) return false;

  const pages = [book.opening, ...book.pages, book.epilogue].filter(
    Boolean
  ) as StorybookPage[];
  const pageHtml = pages
    .map(
      (page) => `<section class="page">
          <p class="eyebrow">${escapeHtml(page.headline || "우리의 이야기")}</p>
          <h2>${escapeHtml(page.title)}</h2>
          ${
            page.drawingUrl || page.photoUrl || page.illustration?.imageUrl
              ? `<img src="${escapeHtml(
                  page.drawingUrl ||
                    page.photoUrl ||
                    page.illustration?.imageUrl ||
                    ""
                )}" alt="">`
              : `<div class="art">✦</div>`
          }
          <p class="story">${escapeHtml(page.body).replace(/\n/g, "<br>")}</p>
          ${
            page.memory
              ? `<aside>이 페이지가 기억하는 것 · ${escapeHtml(page.memory.label)}</aside>`
              : ""
          }
        </section>`
    )
    .join("");
  const letterHtml = book.parentLetter
    ? `<section class="page letter"><p class="eyebrow">날아온 편지</p>${
        book.parentLetter.title?.trim()
          ? `<h2>${escapeHtml(book.parentLetter.title)}</h2>`
          : ""
      }${
        book.parentLetter.photoUrl
          ? `<img src="${escapeHtml(book.parentLetter.photoUrl)}" alt="">`
          : ""
      }<p class="story">${escapeHtml(book.parentLetter.body).replace(
        /\n/g,
        "<br>"
      )}</p><p class="signature">${escapeHtml(
        book.parentLetter.signature
      )}<br><small>${escapeHtml(book.parentLetter.date)}</small></p></section>`
    : "";
  const goodbyeHtml = book.goodbye
    ? `<section class="page"><p class="eyebrow">${escapeHtml(
        book.goodbye.headline
      )}</p><h2>${escapeHtml(
        book.goodbye.title
      )}</h2><div class="art">✨</div><p class="story">${escapeHtml(
        book.goodbye.body
      ).replace(/\n/g, "<br>")}</p></section>`
    : "";
  popup.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8">
      <title>${escapeHtml(book.cover?.title || book.title)}</title>
      <style>
        @page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;color:#44505a;font-family:"Malgun Gothic",sans-serif;background:#fff}
        .page{width:210mm;min-height:297mm;padding:26mm 24mm;page-break-after:always;background:#fffdf7}
        .cover{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
        h1{font-size:30pt;max-width:150mm;line-height:1.35}h2{font-size:22pt;line-height:1.4;margin:4mm 0 8mm}.eyebrow{color:#76947d;font-size:9pt;letter-spacing:.16em}
        img{display:block;width:100%;max-height:130mm;object-fit:contain;border-radius:7mm;margin:8mm 0}.art{height:110mm;border-radius:7mm;background:linear-gradient(#dce8dc,#fff4df);display:flex;align-items:center;justify-content:center;font-size:42pt;color:#fff}
        .story{font-size:13pt;line-height:2}.dedication{font-size:12pt;line-height:2;max-width:130mm}.page aside{margin-top:10mm;padding:5mm;border:1px solid #e7dfd1;border-radius:4mm;font-size:9pt;color:#78817e}
        .signature{text-align:right;margin-top:18mm;font-style:italic;font-size:14pt}.signature small{font-size:9pt;color:#999}
      </style></head><body>
      <section class="page cover"><p class="eyebrow">OUR STORYBOOK</p><h1>${escapeHtml(
        book.cover?.title || book.title
      )}</h1><p>${escapeHtml(book.cover?.subtitle || "")}</p><p class="dedication">${escapeHtml(
    book.cover?.dedication || book.companionNote
  )}</p></section>${pageHtml}${letterHtml}${goodbyeHtml}
      <script>window.onload=()=>setTimeout(()=>window.print(),600)</script>
      </body></html>`);
  popup.document.close();
  return true;
}
