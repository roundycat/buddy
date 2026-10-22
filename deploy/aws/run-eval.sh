#!/usr/bin/env bash
# Measure the deployed safety pipeline (rules vs rules + LLM review) on the bundled test set.
# Prints aggregate metrics only. Run in CloudShell from the beddy2 folder.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$HERE/.state.env"
export AWS_DEFAULT_REGION="$REGION" AWS_PAGER=""
SET="${1:-heldout}"
SECRET="$(aws ssm get-parameter --name "/${PREFIX}/CRON_SECRET" --with-decryption --query Parameter.Value --output text)"
OUT="$HERE/eval-${SET}-$(date +%Y%m%d-%H%M).json"
curl -sS -X POST -H "x-bedi-cron-secret: $SECRET" --max-time 290 \
  "https://${CF_DOMAIN}/api/admin/safety-eval?set=${SET}" -o "$OUT"
python3 - "$OUT" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
if "rulesOnly" not in d:
    print(json.dumps(d, ensure_ascii=False, indent=2)); sys.exit(1)
labels = [("위험·긴급 감지율","alertRecall"),("긴급 감지율","urgentRecall"),("일반 대화 오경보율","falseAlertOnNone"),
          ("관찰을 관찰로","watchAsWatch"),("학대 노출 보호 경로","protectRouted"),("5단계 정확도","exactLevel")]
def f(r): return "-" if not r["d"] else f'{100*r["n"]/r["d"]:.1f}% ({r["n"]}/{r["d"]})'
print(f'set={d["set"]} n={d["n"]}  LLM 재판정 {d["review"]["reviewed"]}건, 상향 {d["review"]["raised"]}건, 지연 p50={d["review"]["latencyMs"]["p50"]}ms p90={d["review"]["latencyMs"]["p90"]}ms')
print(f'{"지표":<16}{"규칙만":>22}{"규칙+LLM":>22}')
for name,key in labels:
    print(f'{name:<16}{f(d["rulesOnly"][key]):>22}{f(d["rulesPlusLlm"][key]):>22}')
PY
echo "저장: $OUT  (이 파일 내용을 그대로 채팅에 붙여 주면 보고서에 반영합니다)"
