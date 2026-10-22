"""Merge team-written risk sentences (CSV) with crisis-none.jsonl into crisis-test.jsonl.

Usage: python3 eval/heldout/build_crisis_test.py path/to/risk.csv
- `context` column: earlier child messages separated by " | " (optional)
- writes eval/heldout/crisis-risk.jsonl and eval/heldout/crisis-test.jsonl (ids T001…)
Prints counts only, never the sentences.
"""
import collections, csv, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
LEVELS = {"urgent", "elevated", "watch", "protect"}
CATS = {"S1_direct", "S2_indirect", "S3_hopeless_burden", "S4_treatment_refusal",
        "S5_means", "S6_abuse", "S7_past", "S8_loneliness"}
FORMS = {"plain", "chosung", "spacing", "typo", "substitution", "emoji", "multi"}

def main(csv_path):
    risk, problems = [], []
    with open(csv_path, encoding="utf-8-sig") as f:
        for i, row in enumerate(csv.DictReader(f), start=2):
            text = (row.get("text") or "").strip()
            if not text or (row.get("writer") or "").startswith("예시"):
                continue
            level = (row.get("level") or "").strip()
            cat = (row.get("category") or "").strip()
            form = (row.get("form") or "plain").strip() or "plain"
            if level not in LEVELS: problems.append(f"{i}행 level '{level}'")
            if cat not in CATS: problems.append(f"{i}행 category '{cat}'")
            if form not in FORMS: problems.append(f"{i}행 form '{form}'")
            ctx = [c.strip() for c in (row.get("context") or "").split("|") if c.strip()]
            risk.append({"text": text, "context": ctx, "level": level, "category": cat,
                         "form": form, "note": (row.get("note") or "").strip(),
                         "writer": (row.get("writer") or "").strip()})
    if problems:
        print("고쳐야 할 칸:"); [print(" -", p) for p in problems[:40]]; sys.exit(1)
    none = [json.loads(l) for l in open(os.path.join(HERE, "crisis-none.jsonl"), encoding="utf-8") if l.strip()]
    rows = risk + none
    for n, r in enumerate(rows, start=1):
        r["id"] = f"T{n:03d}"
    with open(os.path.join(HERE, "crisis-risk.jsonl"), "w", encoding="utf-8") as f:
        for r in risk: f.write(json.dumps(r, ensure_ascii=False) + "\n")
    with open(os.path.join(HERE, "crisis-test.jsonl"), "w", encoding="utf-8") as f:
        for r in rows: f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print("총", len(rows), "문장 =", dict(collections.Counter(r["level"] for r in rows)))
    print("작성자별", dict(collections.Counter(r.get("writer", "AI(none)") for r in risk)))
    print("범주", dict(sorted(collections.Counter(r["category"] for r in risk).items())))
    nonplain = sum(1 for r in risk if r["form"] != "plain")
    print(f"표기 변형 비율 {nonplain}/{len(risk)}, 문맥 있는 문장 {sum(1 for r in risk if r['context'])}")

if __name__ == "__main__":
    main(sys.argv[1])
