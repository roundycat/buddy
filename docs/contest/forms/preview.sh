#!/bin/bash
# Render the filled forms to PDF/PNG with LibreOffice to check the page count (성과보고서 ≤ 2 pages).
# 맑은 고딕 is mapped to Noto Sans CJK KR (slightly taller lines), so Word usually fits in less.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
export FONTCONFIG_FILE="$HERE/fonts.conf"
DEST="${1:-$HERE/out/preview}"
mkdir -p "$DEST"
for f in "$HERE"/out/*.docx; do
  soffice --headless --convert-to pdf --outdir "$DEST" "$f" >/dev/null 2>&1
  pdf="$DEST/$(basename "${f%.docx}").pdf"
  echo "$(basename "$pdf"): $(pdfinfo "$pdf" | awk '/^Pages/{print $2}') page(s)"
  rm -f "${pdf%.pdf}"-*.png
  pdftoppm -r 110 -png "$pdf" "${pdf%.pdf}"
done
