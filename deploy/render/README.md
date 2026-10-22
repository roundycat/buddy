# Render 배포 가이드 (AWS 없이)

Beddy 2.0을 **Render**(싱가포르 리전)와 **Claude API**로 배포하는 방법입니다.
AWS 계정이 필요 없습니다. 설정은 저장소 루트의 [`render.yaml`](../../render.yaml)에 들어 있습니다.
화면에서 몇 번 클릭하고 값 몇 개만 넣으면 됩니다.

| 항목 | 내용 |
|---|---|
| 서버 | Render 웹 서비스(Docker), 512MB·0.5 CPU, 월 $7 |
| 저장소 | Render 영구 디스크 1GB(`/var/data`), 월 $0.25 |
| AI | Claude API. Claude Haiku 5.5는 입력 100만 토큰당 $0.10, 출력 100만 토큰당 $0.50 |
| 주소 | `https://<서비스이름>.onrender.com` (HTTPS 자동) |

> 가격은 2026-10-22에 확인했습니다. 결제 전에 Render와 Anthropic 가격 페이지를 다시 확인해 주세요.

## 1. Claude API 키 만들기 (5분)
1. [console.anthropic.com](https://console.anthropic.com)에 가입합니다. 팀 대표 계정을 권장합니다.
2. **Billing**에서 크레딧을 충전합니다. 심사와 투표 기간에는 $10 정도면 충분합니다.
3. **Limits**에서 월 사용 한도를 걸어 둡니다(예: $20). 한도를 넘으면 API가 멈추고, 앱은 오프라인 베디 답변으로 버팁니다.
4. **API Keys → Create Key**로 키를 만들고 복사합니다. 키는 한 번만 보입니다.
   - 키는 채팅·메신저·문서에 붙여 넣지 말고, 2단계의 Render 화면에만 입력합니다.
   - API로 보낸 대화는 허락 없이 모델 학습에 쓰이지 않습니다([데이터 보존 안내](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)).

## 2. Render에 배포하기 (5분)
1. [render.com](https://render.com)에 **GitHub 계정으로** 가입합니다. 유료 인스턴스를 쓰므로 결제 카드를 등록합니다.
2. Dashboard에서 **New → Blueprint**를 누릅니다.
3. GitHub 연결 화면에서 **`roundycat/buddy` 저장소만** 접근을 허용하고 **Connect**를 누릅니다.
4. Blueprint 이름(예: `beddy2`)을 넣고 브랜치는 `main`으로 둡니다.
5. 값을 넣으라는 칸이 나오면 다음 세 가지를 입력합니다.

   | 이름 | 넣을 값 |
   |---|---|
   | `ANTHROPIC_API_KEY` | 1단계에서 복사한 키 |
   | `JUDGE_PASSWORD` | 심사위원용 비밀번호 |
   | `DEMO_PASSWORD` | 시연 영상용 비밀번호(심사용과 다르게) |

   비밀번호는 **8~20자에 영문·숫자·특수문자를 모두** 넣어야 합니다. 규칙에 맞지 않으면 계정이 만들어지지 않습니다.
6. **Deploy Blueprint**를 누릅니다. 첫 빌드는 5~10분쯤 걸립니다.

`AUTH_SESSION_SECRET`(로그인 서명 키)과 `CRON_SECRET`(관리용 키)은 Render가 무작위로 만듭니다.

## 3. 잘 됐는지 확인하기
1. 서비스 화면 위쪽의 주소(`https://….onrender.com`)를 엽니다.
2. `주소/api/health`가 `{"ok":true,…}`이면 서버가 살아 있는 것입니다.
3. **Logs** 탭에서 아래 두 줄을 확인합니다.
   - `[seed] accounts ready (judge:created/created, judge2:created/created, demo:created/created)`
   - `[scheduler] in-process daily batch scheduler on`
4. 아래 계정으로 로그인해 봅니다.

| 용도 | 아이 계정 | 보호자 계정(아이와 연결됨) | 비밀번호 |
|---|---|---|---|
| 심사위원 | `judge-child@beddy.test` | `judge-guardian@beddy.test` | `JUDGE_PASSWORD` |
| 심사위원(동의 철회 시험용) | `judge2-child@beddy.test` | `judge2-guardian@beddy.test` | `JUDGE_PASSWORD` |
| 시연 영상 | `demo-child@beddy.test` | `demo-guardian@beddy.test` | `DEMO_PASSWORD` |

아이 계정은 **만 14세 미만**으로 등록돼 있고, 보호자 계정이 법정대리인 동의를 마친 상태입니다.
보호자 계정의 **프로필 → 동의 철회**를 누르면 그 아이의 대화·기록이 지워지고 AI 기능이 잠깁니다(개인정보 파기). 다시 동의하면 처음부터 시작합니다.
그래서 철회는 `judge2` 계정으로 시험하도록 안내합니다. 심사위원 여러 명이 `judge` 계정을 함께 쓰기 때문입니다.
처음부터 해 보려면 새 아이 계정(만 14세 미만)과 새 보호자 계정을 가입해 초대 코드로 연결하면 됩니다.

## 4. 운영
- **업데이트**: `main`에 push하면 자동으로 다시 배포됩니다. 디스크를 붙인 서비스는 배포 중 30초~1분 정도 접속이 끊깁니다. 심사 기간에는 push를 몰아서 합니다.
- **새벽 배치**: 매일 05:00(KST) 이후 서버 안에서 한 번 돕니다. 미션 준비, 기억 정리, 보호자 요약을 만듭니다. 서버가 재시작돼도 하루 한 번만 돕니다.
- **AI 사용 상한**: 서버 전체로 하루 `AI_DAILY_LLM_CAP`(8000회, Claude Haiku 5.5로 하루 최대 5달러 안팎)을 넘으면 그날은 비용이 들지 않는 오프라인 베디가 답합니다. 아이 한 명은 하루 200번(10분에 40번)까지 대화할 수 있습니다. 로그인은 같은 곳에서 같은 계정의 비밀번호를 10번 틀리면 10분 동안 막히고(다른 곳에서 같은 계정을 쓰는 사람은 막히지 않음), 가입은 한 곳에서 한 시간에 20개까지입니다.
- **비밀번호 변경**: Render의 **Environment**에서 `JUDGE_PASSWORD`를 바꾸고 저장하면 재시작 때 반영됩니다. 아이 데이터는 그대로 남습니다.
- **데이터**: 모든 데이터는 디스크 `/var/data`에 있습니다. 서비스를 지우면 디스크도 지워지므로, 심사가 끝날 때까지 지우지 않습니다.

## 5. 안전성 측정 (관리자)
`CRON_SECRET`은 Render **Environment**에서 볼 수 있습니다. 이 값은 다른 사람에게 보내지 않습니다.
본인 컴퓨터 터미널에서 아래처럼 실행합니다.
```bash
curl -s -X POST "https://<주소>/api/admin/safety-eval?set=heldout" \
  -H "x-bedi-cron-secret: <CRON_SECRET>"
```
결과에는 규칙만 쓴 경우와 규칙에 LLM 재판정을 더한 경우의 지표, 판정 지연 시간이 함께 나옵니다.
최종 평가셋(`crisis-test.jsonl`)이 만들어진 뒤에만 의미가 있습니다.

## AWS 판과 다른 점
| 기능 | AWS 판(`deploy/aws`) | Render 판 |
|---|---|---|
| 대화 모델 | Bedrock Claude Haiku 4.5 | Claude API Claude Haiku 5.5 |
| 응답 안전 필터 | Bedrock Guardrails + 앱 출력 필터 | 앱 출력 필터(문장 단위로 화면에 나가기 전에 검사: 개인정보, 약 복용 지시, 위험 방법, 관계 규칙) |
| 보호자 질문 검색 | Bedrock Knowledge Base | 서버 안 요약 검색(같은 개인정보 필터를 거친 요약 문서) |
| 캐릭터 그림 | Stability(Bedrock) | 준비해 둔 크레용 그림 |
| 이야기 읽어 주기 | Amazon Polly | 기기의 음성 합성 |
| 저장 | DynamoDB + S3 | 영구 디스크의 JSON 파일 |
| 새벽 배치 | EventBridge(cron) | 서버 안 스케줄러 |

위기 신호 감지, 보호자 알림, 아동 동의, 관계 가드 같은 안전 계층은 두 판이 같은 코드입니다.

## 문제 해결
| 증상 | 확인할 것 |
|---|---|
| 빌드 실패 | Logs의 마지막 오류. 다시 하려면 **Manual Deploy → Clear build cache & deploy** |
| 로그인 안 됨 | 비밀번호 규칙(8~20자, 영문·숫자·특수문자). 로그에 `[seed] … skipped`가 있는지 |
| 베디가 같은 말만 함 | API 키, 크레딧, 월 한도. 로그에 `Claude API 401/429`가 있는지 |
| 그날 AI가 멈춤 | `AI_DAILY_LLM_CAP` 도달. 다음 날 자동으로 풀립니다 |
