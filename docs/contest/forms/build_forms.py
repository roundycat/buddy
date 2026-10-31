"""Fill the official KEIT Word form: 성과보고서 (table 1) and 참가신청서 (table 2).

  python3 docs/contest/forms/build_forms.py

Reads template.docx (the KEIT「(Word양식) 2026 AI 라이프 솔루션 챌린지 성과보고서」 with its
text runs merged) and the text in report_content.py, and writes
  out/Beddy2.0_성과보고서.docx, out/Beddy2.0_참가신청서.docx, ../report-draft.md
Check the page count afterwards (limit: 2 pages) — ./preview.sh renders PDFs with LibreOffice.
"""
import os
import re
import sys
import zipfile
from xml.sax.saxutils import escape

BASE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(BASE, "template.docx")
OUT = os.path.join(BASE, "out")
DRAFT_MD = os.path.join(BASE, "..", "report-draft.md")

SIZE = 20  # body text, half-points (10pt)
LINE = 252  # 1.05 lines
FONT = '<w:rFonts w:hint="eastAsia"/>'  # as the template's own runs: theme font (맑은 고딕)

# Hanging indents per line kind: (left, hanging) in dxa; the marker sits at left - hanging.
LAYOUT = {"item": (240, 240), "detail": (440, 200), "num": (500, 260)}
NUMS = "①②③④⑤⑥⑦⑧⑨"


# ---------- docx ----------

def rpr(size, bold=False, sup=False, mark=False):
    return (
        "<w:rPr>" + FONT
        + ("<w:b/><w:bCs/>" if bold else "")
        + f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>'
        + ('<w:highlight w:val="yellow"/>' if mark else "")
        + ('<w:vertAlign w:val="superscript"/>' if sup else "")
        + "</w:rPr>"
    )


TOKENS = r"(\*\*.+?\*\*|\^\{[^}]+\}|\[[^\]]*\])"


def runs(text, size, bold=False):
    """**bold**, ^{n} superscript and [placeholder] (highlighted) → w:r elements."""
    out = []
    for part in re.split(TOKENS, text):
        if not part:
            continue
        b, sup, mark = bold, False, False
        if part.startswith("**") and part.endswith("**"):
            part, b = part[2:-2], True
        elif part.startswith("^{"):
            part, sup = part[2:-1], True
        elif part.startswith("[") and part.endswith("]"):
            mark = True
        out.append(f'<w:r>{rpr(size, b, sup, mark)}<w:t xml:space="preserve">{escape(part)}</w:t></w:r>')
    return "".join(out)


def ppr(size, before=0, layout=None, center=False, line=LINE):
    tabs = ind = ""
    if layout:
        left, hanging = LAYOUT[layout]
        tabs = f'<w:tabs><w:tab w:val="left" w:pos="{left}"/></w:tabs>'
        ind = f'<w:ind w:left="{left}" w:hanging="{hanging}"/>'
    jc = '<w:jc w:val="center"/>' if center else ""
    return (
        f"<w:pPr>{tabs}<w:wordWrap/>"
        f'<w:spacing w:before="{before}" w:after="0" w:line="{line}" w:lineRule="auto"/>'
        f"{ind}{jc}{rpr(size)}</w:pPr>"
    )


def para(text, size, bold=False, before=0, center=False, line=LINE):
    return f"<w:p>{ppr(size, before, None, center, line)}{runs(text, size, bold)}</w:p>"


def marked(marker, text, size, layout, before=0):
    head = f'<w:r>{rpr(size)}<w:t xml:space="preserve">{escape(marker)}</w:t><w:tab/></w:r>'
    return f"<w:p>{ppr(size, before, layout)}{head}{runs(text, size)}</w:p>"


def results_table(rows, size):
    indent = LAYOUT["item"][0]
    widths = [5115, 1500, 1600]  # cell text width 8455 - indent
    border = "".join(
        f'<w:{side} w:val="single" w:sz="4" w:space="0" w:color="808080"/>'
        for side in ("top", "left", "bottom", "right", "insideH", "insideV")
    )
    tblpr = (
        f'<w:tblPr><w:tblW w:w="{sum(widths)}" w:type="dxa"/><w:tblInd w:w="{indent}" w:type="dxa"/>'
        f'<w:tblBorders>{border}</w:tblBorders><w:tblLayout w:type="fixed"/>'
        '<w:tblCellMar><w:top w:w="20" w:type="dxa"/><w:left w:w="70" w:type="dxa"/>'
        '<w:bottom w:w="20" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar>'
        '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0"'
        ' w:noHBand="0" w:noVBand="1"/></w:tblPr>'
    )
    grid = "<w:tblGrid>" + "".join(f'<w:gridCol w:w="{w}"/>' for w in widths) + "</w:tblGrid>"
    trs = []
    for r, row in enumerate(rows):
        header = r == 0
        tcs = []
        for c, (value, width) in enumerate(zip(row, widths)):
            shd = '<w:shd w:val="clear" w:color="auto" w:fill="E6EEF7"/>' if header else ""
            bold = header or c == 2  # header row and the v2 column
            tcs.append(
                f'<w:tc><w:tcPr><w:tcW w:w="{width}" w:type="dxa"/>{shd}<w:vAlign w:val="center"/></w:tcPr>'
                f"{para(value, size, bold=bold, center=c > 0, line=240)}</w:tc>"
            )
        trs.append(f'<w:tr><w:trPr><w:cantSplit/></w:trPr>{"".join(tcs)}</w:tr>')
    return f"<w:tbl>{tblpr}{grid}{''.join(trs)}</w:tbl>"


def cell_body(lines, results):
    xml = []
    for i, line in enumerate(lines):
        if line == "@results":
            xml.append(results_table(results, SIZE - 2))
        elif line.startswith("ㅇ "):
            xml.append(marked("ㅇ", line[2:], SIZE, "item", before=0 if i == 0 else 40))
        elif line.startswith("- "):
            xml.append(marked("-", line[2:], SIZE, "detail"))
        elif line[:1] in NUMS:
            xml.append(marked(line[0], line[1:].lstrip(), SIZE, "num"))
        else:
            xml.append(para(line, SIZE))
    return "".join(xml)


def set_cell(row_xml, index, new_paras):
    """Keep the cell's properties, swap its paragraphs."""
    cells = re.findall(r"<w:tc>.*?</w:tc>", row_xml, flags=re.S)
    target = cells[index]
    head = re.match(r"<w:tc>(<w:tcPr>.*?</w:tcPr>)", target, flags=re.S).group(1)
    return row_xml.replace(target, f"<w:tc>{head}{new_paras}</w:tc>", 1)


def tables(doc):
    out, pos = [], doc.index("<w:body>")
    while (start := doc.find("<w:tbl>", pos)) >= 0:
        end = doc.index("</w:tbl>", start) + len("</w:tbl>")
        out.append((start, end))
        pos = end
    return out


def build_report(doc, report, results):
    (t1s, t1e), (t2s, t2e) = tables(doc)[:2]
    table = doc[t1s:t1e]
    rows = re.findall(r"<w:tr[ >].*?</w:tr>", table, flags=re.S)
    keys = [None, "tech", "idea", "summary", "goal", "work", "pains", "effects"]
    new_table = table
    for i, key in enumerate(keys):
        if not key:
            continue
        new_row = set_cell(rows[i], 1, cell_body(report[key], results))
        if key in ("idea", "summary", "goal"):
            # The template reserves ~1.3in for these short answers; let the rows fit their text.
            new_row = re.sub(r'<w:trHeight w:val="\d+"/>', '<w:trHeight w:val="567"/>', new_row, count=1)
        new_table = new_table.replace(rows[i], new_row, 1)
    sources = para(report["sources"], 14, before=50, line=240)
    # Drop the application form (table 2) and the spacer before it; keep the last paragraph + sectPr.
    return doc[:t1s] + new_table + sources + doc[t2e:]


def build_application(doc, members, applicant):
    (t1s, t1e), (t2s, t2e) = tables(doc)[:2]
    table = doc[t2s:t2e]
    # The template floats this table on page 2; on its own page it sits inline at the top.
    table = re.sub(r"<w:tblpPr [^>]*/>", "", table, count=1)
    rows = re.findall(r"<w:tr[ >].*?</w:tr>", table, flags=re.S)
    member_rows = []
    for member in members:
        row = rows[2]
        for col, value in enumerate(member, start=1):
            row = set_cell(row, col, para(value, 20, center=True, line=240))
        member_rows.append(row)
    new_table = table.replace(rows[2] + rows[3], "".join(member_rows), 1)
    signed = new_table.replace(
        '<w:t xml:space="preserve"> :                (서명 또는 인)</w:t>',
        f'<w:t xml:space="preserve"> :    {escape(applicant)}          (서명 또는 인)</w:t>',
        1,
    )
    # The separately published 참가신청서 form labels this block '개발자 정보'; the copy inside
    # the 성과보고서 file still says '제안자 정보'. Follow the 참가신청서 form.
    labelled = signed.replace("<w:t>제안자</w:t>", "<w:t>개발자</w:t>", 1)
    if new_table == table or signed == new_table or labelled == signed:
        raise SystemExit("template changed: member rows, applicant line or label not found")
    body = doc.index("<w:body>") + len("<w:body>")
    return doc[:body] + labelled + doc[t2e:]


def write_docx(template_zip, document_xml, target):
    with zipfile.ZipFile(template_zip) as src, zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as dst:
        names = sorted(src.namelist(), key=lambda n: n != "[Content_Types].xml")
        for name in names:
            data = document_xml.encode("utf8") if name == "word/document.xml" else src.read(name)
            dst.writestr(zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0)), data, zipfile.ZIP_DEFLATED)


# ---------- markdown copy of the report ----------

def md_text(text):
    text = re.sub(r"\^\{([^}]+)\}", r"<sup>\1</sup>", text)
    return re.sub(r"\[([^\]]*)\]", r"`[\1]`", text)


def build_markdown(report, results):
    titles = [
        ("tech", "AI 기술명"), ("idea", "아이디어명"), ("summary", "기술요약 (3줄 이내)"),
        ("goal", "최종목표 (2줄 이내)"), ("work", "개발 내용 및 결과"), ("pains", "개발과정에서 애로점"),
        ("effects", "기대효과"),
    ]
    out = [
        "# 성과보고서 (제출 양식 본문)",
        "",
        "> 이 파일은 `docs/contest/forms/report_content.py`에서 만들어집니다. 고칠 때는 그 파일을 고치고"
        " `python3 docs/contest/forms/build_forms.py`를 실행하세요. 제출 파일은 `docs/contest/forms/out/`에 생깁니다.",
        "> `[ ]` 칸(양식에서는 노란색)은 제출 전에 채웁니다: 위기 평가 수치·해석, 배포 주소.",
        "",
    ]
    for key, title in titles:
        out += [f"## {title}", ""]
        for line in report[key]:
            if line == "@results":
                out += ["", "| " + " | ".join(results[0]) + " |", "|---|---|---|"]
                out += ["| " + " | ".join(md_text(c) for c in row) + " |" for row in results[1:]]
                out.append("")
            elif line.startswith("ㅇ "):
                out.append("- " + md_text(line[2:]))
            elif line.startswith("- "):
                out.append("  - " + md_text(line[2:]))
            elif line[:1] in NUMS:
                out.append("  - " + md_text(line))
            else:
                out.append(md_text(line) + "  ")
        out.append("")
    out += ["---", "", md_text(report["sources"]), ""]
    return "\n".join(out)


def main():
    sys.path.insert(0, BASE)
    sys.dont_write_bytecode = True
    from report_content import APPLICANT, MEMBERS, REPORT, RESULTS

    os.makedirs(OUT, exist_ok=True)
    with zipfile.ZipFile(TEMPLATE) as z:
        doc = z.read("word/document.xml").decode("utf8")
    for name, xml in (
        ("Beddy2.0_성과보고서.docx", build_report(doc, REPORT, RESULTS)),
        ("Beddy2.0_참가신청서.docx", build_application(doc, MEMBERS, APPLICANT)),
    ):
        target = os.path.join(OUT, name)
        write_docx(TEMPLATE, xml, target)
        print(os.path.relpath(target))
    with open(DRAFT_MD, "w", encoding="utf8") as f:
        f.write(build_markdown(REPORT, RESULTS))
    print(os.path.relpath(DRAFT_MD))


if __name__ == "__main__":
    main()
