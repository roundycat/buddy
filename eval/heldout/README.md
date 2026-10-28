# 독립 평가셋 (held-out)

탐지 규칙(`src/backend/ai/safety/`)과 개발셋(`eval/dev/`)을 보지 않은 작성자가 [`../LABELING_GUIDE.md`](../LABELING_GUIDE.md)만 보고 만든 문장입니다.
규칙을 고치는 동안에는 열어 보지 않고, 최종 측정에만 씁니다. 실제 아동의 대화는 들어 있지 않습니다(모두 합성).

| 파일 | 내용 | 작성 |
|---|---|---|
| `leak-test.jsonl` | 보호자 글 유출 150건 (유출 75 · 정상 75) | AI 보조 작성, 규칙 비공개 상태 |
| `crisis-none.jsonl` | 위기 아님(일상·과장·게임·교육·의료 질문) 170건 | AI 보조 작성, 규칙 비공개 상태 |
| `crisis-risk.jsonl` | 위기 단계(긴급·위험·관찰·보호) 문장 | **팀원 직접 작성** — AI로 대량 생성하려던 시도는 안전 필터에 막혀 사람이 쓰기로 함 |
| `crisis-test.jsonl` | 위 두 crisis 파일을 합친 최종 평가셋 | `python3 eval/heldout/build_crisis_test.py` |

측정: `EVAL_SET=heldout npm run eval:safety`, 배포 환경에서는 `bash deploy/aws/run-eval.sh`.

`crisis-risk.jsonl`·`crisis-test.jsonl`과 팀원이 보낸 CSV는 저장소에 올리지 않습니다(`.gitignore`). 저장소가 공개라서, 위기 문장 원문 대신 `eval/results/`의 집계 결과만 커밋합니다.
