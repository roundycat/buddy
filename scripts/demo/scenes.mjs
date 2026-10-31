/**
 * The contest videos, scene by scene (docs/contest/demo-video-script.md,
 * docs/contest/vote-campaign.md).
 *
 * A card is a full-screen slide. A clip scene cuts a recorded clip between two
 * markers (see record-demo.mjs → markers.json) and shows a caption beside
 * (MAIN) or above (VOTE) the phone. `from`/`to` are marker labels, seconds, or
 * { marker, plus } — "end" is the end of the clip. `speed` plays it faster;
 * `fit` caps the scene at that many seconds by speeding it up.
 *
 * Numbers come from docs/contest/research-factsheet.md and eval/results/.
 * Pending measurements are written as "측정 중" until the final run.
 */

export const TITLE = "Beddy 2.0";

export const MEASUREMENTS = [
  // [label, 기존 방식, Beddy 2.0]
  ["일상 대화 170문장: 보호자 오경보율", "8.2%", "3.5%"],
  ["보호자 글 유출 탐지율 (유출 75건·5유형)", "0%", "72.0%"],
];

/** How a message is judged (src/backend/ai/safety/v2) — the "pipeline" card. */
export const PIPELINE = [
  { title: "아이 메시지", body: "바로 앞 대화 맥락과\n함께 읽습니다" },
  { title: "규칙 감지", body: "위기 신호 8종,\n오탐 억제 10종으로\n5단계 판단" },
  { title: "AI 재판정", body: "애매할 때만 한 번 더.\n단계는 올리기만 합니다" },
  { title: "단계별 대응", body: "아이: 간호사·109·119\n보호자: 사실만 알림\n학대 의심:\n병원·112·1388" },
  { title: "답장 검사", body: "화면에 나가기 전\n한 문장씩 검사합니다" },
];

/**
 * What the reply filter does to a sentence (output-guard.ts). The replacement
 * lines are the filter's own, checked against guardCompanionOutput.
 */
export const GUARD_EXAMPLES = [
  // [kind, before, after]
  ["비밀 강요", "이건 너랑 나만의 비밀이야.", "네 이야기는 소중하게 들을게. 그런데 네가 다치거나 위험할 수 있는 일이면, 너를 지키려고 어른에게 알려야 할 때도 있어."],
  ["약 지시", "진통제 두 알 더 먹어.", "약이나 치료는 꼭 의사·간호사 선생님과 함께 정해야 해. 궁금한 건 선생님께 같이 여쭤보자."],
  ["기대게 하는 말", "나만 있으면 돼.", "나는 너를 응원하는 AI 친구야. 엄마·아빠, 간호사 선생님, 친구들처럼 너를 아껴 주는 사람들과 나누는 시간도 꼭 소중히 했으면 좋겠어."],
  ["개인정보", "내 번호는 010-1234-5678이야.", "내 번호는 [전화번호]이야."],
];

const END_FOOT = "마음이 힘들 땐 자살예방 상담전화 109 (24시간)";

/** Submission video, 2–5 minutes, 1920×1080. */
export const MAIN = [
  {
    card: "title",
    seconds: 4,
    title: "Beddy 2.0",
    body: "장기입원 아이를 위한 '안전한' AI 친구",
    foot: "팀 YSA",
  },
  {
    card: "number",
    seconds: 5,
    title: "8만 2,272명",
    body: "산정특례에 등록된 18세 미만 중증·희귀질환 환아 (2024)",
    foot: "국민건강보험공단 자료 · 동아일보 2025.12.1",
  },
  {
    card: "number",
    seconds: 5,
    title: "약 1%",
    body: "만 24세 이하 중증 질환자 8만 3,365명 가운데 완화의료를 이용한 아이 708명",
    foot: "국민건강보험공단 자료 · 한겨레 2026.1.22",
  },
  {
    card: "number",
    seconds: 5,
    title: "병원학교 33곳 · 강원 1곳",
    body: "장기 치료로 등교하지 못하는 건강장애 학생 1,924명",
    foot: "교육부 「2025 특수교육 연차보고서」",
  },
  {
    card: "quote",
    seconds: 5,
    title: "밤 10시, 엄마가 잠든 병실.",
    body: "아이는 누구에게 말할까요?",
  },
  {
    clip: "01-child",
    from: "survey",
    to: { marker: "consent-wait", plus: 1 },
    speed: 2,
    title: "나를 닮은 AI 친구 만들기",
    body: "아이가 고른 성향과 취향으로 친구 '베디'를 만듭니다.",
  },
  {
    clip: "01-child",
    from: "consent-wait",
    to: { marker: "consent-wait", plus: 6 },
    title: "만 14세 미만은 보호자 동의가 먼저",
    body: "보호자가 동의하기 전에는 대화도 기록도 시작하지 않습니다.\n개인정보 보호법 제22조의2",
  },
  {
    clip: "02-guardian-consent",
    from: "link",
    to: { marker: "consented", plus: 2 },
    speed: 1.5,
    title: "보호자는 초대 코드로 연결하고 동의",
    body: "관계·항목·동의서 버전을 기록합니다.\n철회하면 모인 기록을 바로 지웁니다.",
  },
  {
    clip: "01-child",
    from: "avatar-pick",
    to: "end",
    title: "친구가 찾아왔어요",
    body: "대화창의 'AI 친구' 표시로 AI라는 걸 늘 알려 주고,\nAI가 그린 그림에는 'AI로 그렸어요'를 붙입니다.\n인공지능기본법 투명성 의무",
  },
  {
    clip: "03-chat",
    from: "message-1",
    to: "message-2",
    title: "마음을 들어 주는 대화",
    body: "답장은 문장마다 안전 필터를 거쳐 화면에 나갑니다.\n말로 하기·소리로 듣기도 됩니다.",
  },
  {
    card: "guard",
    seconds: 10,
    title: "답장은 화면에 나가기 전, 한 문장씩 검사합니다",
    body: "걸린 문장은 아이에게 보이기 전에 안전한 말로 바뀝니다.",
    foot: "필터가 어떻게 바꾸는지 보여 주려고 만든 예시 문장입니다.",
  },
  {
    clip: "03-chat",
    from: "message-2",
    to: "crisis",
    title: "장난은 장난으로",
    body: "\"어제 축구에서 자살골 넣었어ㅋㅋ\"\n\"동생이 춤춰서 웃겨 죽는 줄ㅋㅋ\"\n단어만 보는 방식이라면 '자살골'에도 보호자 '긴급' 알림이 갑니다.\nBeddy 2.0은 평소 대화로 이어 갑니다.",
  },
  {
    clip: "03-chat",
    from: "crisis",
    to: "end",
    title: "위험 신호는 5단계로",
    body: "도움 버튼(간호사·109·119)을 보여 주고,\n보호자에게 무엇을 알렸는지 아이에게도 알려 줍니다.",
    note: "영상에서는 아이 메시지를 흐리게 가렸습니다.",
  },
  {
    card: "pipeline",
    seconds: 11,
    title: "위험 신호는 이렇게 판단합니다",
    foot: "학대가 의심되면 보호자에게 자동으로 보내지 않습니다. 보호자가 그 사람일 수도 있기 때문입니다.",
  },
  {
    clip: "04-adventure",
    from: 0,
    to: "end",
    title: "AI는 사람에게 돌려보내는 다리",
    body: "하루 한 번, 간호사·가족·친구에게 마음을 전하는\n'사람 연결 미션'을 줍니다.",
  },
  {
    clip: "05-sharing",
    from: 0,
    to: "end",
    title: "무엇을 나눌지는 아이가 정합니다",
    body: "기분·모험·기억·사진을 하나씩 켜고 끕니다.\n대화 원문과 일기 글은 보호자에게 보이지 않습니다.",
  },
  {
    clip: "06-guardian",
    from: "home",
    to: "ask",
    title: "보호자에게는 원문 대신 사실만",
    body: "'도움이 필요하다'는 알림과 대처 안내만 보냅니다.\n아이가 나누지 않은 항목은 잠금 표시로만 보입니다.",
  },
  {
    clip: "06-guardian",
    from: "ask",
    to: "end",
    title: "요약으로 답하는 보호자 질문",
    body: "아이가 나누기로 한 요약만 찾아 답하고,\n어디서 찾았는지 함께 보여 줍니다.",
  },
  {
    card: "measure",
    seconds: 9,
    title: "감지 규칙을 보지 않고 만든 평가셋으로 측정했습니다",
    foot: "2.0은 규칙 계층 값 · 평가 문장은 규칙을 보지 않은 별도 과정에서 AI로 합성",
  },
  {
    card: "end",
    seconds: 6,
    title: "아이에게 안전한 AI 친구, Beddy 2.0",
    body: "팀 YSA · 정하민 · 최유경 · 최유현",
    foot: END_FOOT,
  },
];

/**
 * Voting-page short, about a minute, 1080×1920 (docs/contest/vote-campaign.md).
 * Public, so the crisis message stays blurred and the ending carries 109.
 */
export const VOTE = [
  {
    card: "quote",
    seconds: 5,
    title: "엄마가 잠든 밤 10시,",
    body: "아이는 누구에게\n말할까요?",
  },
  {
    clip: "01-child",
    from: "avatar-pick",
    to: { marker: "home", plus: 3 },
    fit: 6,
    title: "입원한 아이의\nAI 친구, Beddy",
  },
  {
    clip: "03-chat",
    from: "message-1",
    to: "message-2",
    fit: 7,
    title: "입원한 아이의\nAI 친구, Beddy",
    body: "마음을 들어 주는 대화",
  },
  {
    clip: "03-chat",
    from: "crisis",
    to: "end",
    fit: 9,
    title: "위험한 신호는\n알아차리고",
    note: "아이 메시지는 흐리게 가렸습니다",
  },
  {
    clip: "03-chat",
    from: "message-3",
    to: "crisis",
    fit: 6,
    title: "장난은 장난으로",
  },
  {
    clip: "06-guardian",
    from: "home",
    to: { marker: "home", plus: 7 },
    fit: 7,
    title: "보호자에게는 사실만",
    body: "아이의 말은 아이의 것",
  },
  {
    clip: "04-adventure",
    from: 0,
    to: "end",
    fit: 8,
    title: "AI는 사람에게\n돌아가는 다리",
    body: "하루 한 번, 사람에게 마음을 전하는 미션",
  },
  {
    card: "end",
    seconds: 7,
    title: "아이에게 안전한 AI 친구\nBeddy 2.0에\n투표해 주세요",
    body: "팀 YSA",
    foot: END_FOOT,
  },
];
