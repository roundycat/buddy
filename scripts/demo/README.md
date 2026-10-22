# 시연 영상 자동 녹화·편집

배포된 Beddy에서 휴대폰 크기 화면을 녹화하고, 자막·카드를 붙여 제출용 영상과 투표용 짧은 영상을 만듭니다.
장면 순서와 자막은 `scenes.mjs` 한 곳에서 고칩니다.

| 파일 | 하는 일 |
|---|---|
| `record-demo.mjs` | 새 아이(만 14세 미만)·보호자 계정을 가입시키고 초대 코드 연결 → 보호자 동의 → 친구 만들기 → 대화 → 모험 → 공유 선택 → 보호자 화면을 녹화합니다 |
| `scenes.mjs` | 장면 목록(`MAIN` 제출용, `VOTE` 투표용), 측정표 숫자, 위기 판단 흐름, 응답 필터 예시 |
| `compose.mjs` | 녹화본을 잘라 자막·카드와 합쳐 MP4로 만듭니다 |

## 준비 (한 번)
```bash
npm install --no-save playwright@1.56.0 && npx playwright install chromium
# ffmpeg, ffprobe가 있어야 합니다 (macOS: brew install ffmpeg)
```

## 찍기
```bash
BASE_URL=https://<서비스>.onrender.com OUT_DIR=demo-out node scripts/demo/record-demo.mjs
node scripts/demo/compose.mjs demo-out              # demo-out/beddy-demo.mp4  1920×1080, 2~5분
node scripts/demo/compose.mjs demo-out --cut vote   # demo-out/beddy-vote.mp4  1080×1920, 약 1분
```

- 저장된 비밀번호가 필요 없습니다. 매번 `demo-kid-…@beddy.test`, `demo-parent-…@beddy.test` 계정을 새로 만들고, 비밀번호는 끝에 한 번만 출력합니다. 심사 계정(`judge…`)은 건드리지 않습니다.
- 녹화본은 `01-child`, `02-guardian-consent`, `03-chat`, `04-adventure`, `05-sharing`, `06-guardian` 여섯 개이고, 장면이 시작하는 시점은 `markers.json`에 남습니다. 편집은 이 시점으로 기다리는 구간을 잘라 냅니다.
- 위기 메시지는 화면에 나타나기 전부터 흐리게 가립니다(투표 페이지에 공개될 수 있어서). 두 영상 모두 끝에 자살예방 상담전화 109를 넣습니다.
- 소리는 비어 있습니다. 배경 음악을 넣으려면 저작권 없는 음원만 편집기에서 얹어 주세요.

## 바꿀 때
- 측정이 끝나면 `scenes.mjs`의 `MEASUREMENTS`에서 "측정 중"을 실제 값으로 바꿉니다.
- 투표 링크가 공지되면 `VOTE` 마지막 카드에 넣습니다.
- 대화 문장은 `record-demo.mjs`의 `CHATS`, `CRISIS`, 보호자 질문은 `GUARDIAN_QUESTION`입니다. 위기 문장을 바꾸면 흐림 처리도 같이 따라갑니다.
- 화면 문구가 바뀌어 단추를 못 찾으면, 오류가 난 화면을 `error-….png`로 남기고 멈춥니다.
