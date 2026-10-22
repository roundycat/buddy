/**
 * The contest demo video, scene by scene (docs/contest/demo-video-script.md).
 *
 * A card is a full-screen slide. A clip scene cuts a recorded clip between two
 * markers (see record-demo.mjs → markers.json), optionally sped up, and shows a
 * caption beside the phone. `from`/`to` are marker labels, seconds, or
 * { marker, plus } — "end" is the end of the clip.
 *
 * Numbers come from docs/contest/research-factsheet.md and eval/results/.
 * Pending measurements are written as "측정 중" until the final run.
 */

export const TITLE = "Beddy 2.0";

export const MEASUREMENTS = [
  // [label, v1, v2]
  ["위기 문장 위험·긴급 감지율", "측정 중", "측정 중"],
  ["일상 대화 보호자 오경보율 (170문장)", "8.2%", "3.5%"],
  ["보호자 글 원문 유출 탐지율 (150문장)", "0%", "72.0%"],
];

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
    speed: 2.5,
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
    body: "'AI 친구', 'AI로 그렸어요' — AI라는 걸 늘 알려 줍니다.\n인공지능기본법 투명성 의무",
  },
  {
    clip: "03-chat",
    from: "message-1",
    to: "message-2",
    title: "마음을 들어 주는 대화",
    body: "답장은 문장마다 안전 필터를 거쳐 화면에 나갑니다.\n말로 하기·소리로 듣기도 됩니다.",
  },
  {
    clip: "03-chat",
    from: "message-2",
    to: "crisis",
    title: "장난은 장난으로",
    body: "\"어제 축구에서 자살골 넣었어ㅋㅋ\"\nv1은 이 말에 보호자 '긴급' 알림을 보냈습니다.\nv2는 평소 대화로 이어 갑니다.",
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
    clip: "04-adventure",
    from: 0,
    to: "end",
    title: "AI는 사람에게 돌려보내는 다리",
    body: "하루 한 번, 간호사·가족·친구에게 마음을 전하는\n'사람 연결 미션'을 줍니다.",
  },
  {
    clip: "05-guardian",
    from: "home",
    to: "ask",
    title: "보호자에게는 원문 대신 사실만",
    body: "'도움이 필요하다'는 알림과 대처 안내만 보냅니다.\n학대가 의심되면 보호자 대신 병원·112·1388로 안내합니다.",
  },
  {
    clip: "05-guardian",
    from: "ask",
    to: "end",
    title: "요약으로 답하는 보호자 질문",
    body: "아이가 나누기로 한 요약만 찾아 답하고,\n어디서 찾았는지 함께 보여 줍니다.",
  },
  {
    card: "measure",
    seconds: 9,
    title: "감지 규칙을 보지 않고 만든 평가셋으로 측정했습니다",
  },
  {
    card: "end",
    seconds: 6,
    title: "아이에게 안전한 AI 친구, Beddy 2.0",
    body: "팀 YSA · 정하민 · 최유경 · 최유현 · 최태웅",
    foot: "마음이 힘들 땐 자살예방 상담전화 109 (24시간)",
  },
];
