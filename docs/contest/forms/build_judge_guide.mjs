#!/usr/bin/env node
/**
 * 심사위원 안내서 (Beddy2.0_심사안내.pdf) — one step per page, screenshots beside the instructions.
 *
 *   node docs/contest/forms/build_judge_guide.mjs
 *
 * Writes docs/contest/forms/out/Beddy2.0_심사안내.pdf and docs/contest/judge-guide.md (same content as Markdown).
 * The password is never written here — it lives only in the submission email.
 * Needs Playwright's Chromium (same setup as scripts/demo).
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const IMG = join(ROOT, "docs/contest/img");
const OUT_PDF = join(HERE, "out", "Beddy2.0_심사안내.pdf");
const OUT_MD = join(ROOT, "docs/contest/judge-guide.md");

// ---------------------------------------------------------------- content

const ACCOUNTS = [1, 2, 3, 4, 5].map((n) => [n, `judge${n}-child@beddy.test`, `judge${n}-guardian@beddy.test`]);

const OVERVIEW = [
  "**위기 신호를 5단계로 판정합니다**(없음·관찰·위험·긴급·보호). 단계마다 아이·보호자·병원에 다르게 대응합니다.",
  "**보호자에게 대화 원문을 보내지 않습니다.** 사실과 대처 안내만 보내고, 학대·폭력이 의심되면 보호자 대신 병원·상담 기관을 안내합니다.",
  "**화면에 나가는 AI 문장을 한 문장씩 검사합니다.** 약 복용 지시, 위험 방법, \"나만 믿어\" 같은 말은 안전한 문장으로 바뀝니다.",
  "**만 14세 미만은 법정대리인 동의가 끝나야** 대화와 기록이 시작되고, 보호자와 무엇을 나눌지는 아이가 고릅니다.",
];

const QUICK = [
  "아이 계정으로 로그인합니다(친구 만들기 1분).",
  "대화창에 아래 문장 4개를 **적힌 순서대로** 보냅니다. ③·④에서 도움 패널이 달라지는 것을 봅니다.",
  "같은 번호의 보호자 계정으로 로그인해, 알림에 원문이 없는지와 리포트 답변을 봅니다.",
];

const STEPS = [
  {
    num: "①", account: "아이 계정", brief: "홈 화면, 'AI 친구' 표시, 친구 만들기", title: "아이 계정으로 로그인하고 친구 만들기", time: "1~2분", layout: "side",
    shots: [
      ["guide-child-home.png", "아이 홈 화면. 가운데가 아이가 고른 AI 친구, 아래가 대화창"],
      ["guide-avatar.png", "친구 만들기의 마지막 단계. 친구 모습을 고르고 이름을 짓습니다"],
    ],
    todo: [
      "휴대폰 브라우저에서 테스트 URL을 엽니다. 첫 화면에서 **로그인**을 누릅니다.",
      "이메일 칸에 아이 계정(예: `judge1-child@beddy.test`), 비밀번호 칸에 제출 메일의 비밀번호를 넣고 로그인합니다.",
      "처음 들어오면 **친구 만들기**가 시작됩니다(9단계, 1분 정도). 성향·취향 설문 → 친구 모습 고르기 → 이름 짓기 순서이고, 아무 답이나 골라도 됩니다.",
      "홈 화면이 나오면 가운데에 아이가 고른 친구가, 아래에 대화창이 있습니다.",
    ],
    inputs: [],
    checks: [
      "홈과 대화 화면에 **'AI 친구'** 표시가 늘 보입니다(인공지능기본법 제31조의 AI 고지).",
      "심사 계정은 만 14세 미만이고 보호자 동의가 끝난 상태라 바로 대화가 열립니다. 동의 전 상태는 ⑦에서 볼 수 있습니다.",
      "홈 왼쪽 메뉴에 모험·정원·소원·일기, 오른쪽에 일정·기억·성장·우체국이 있습니다.",
    ],
    why: "아이가 자기를 닮은 친구를 직접 만들면 애착이 생겨 대화를 이어 가기 쉽습니다. 그 대신 Beddy는 아이가 AI에만 기대지 않도록 하루 한 번 곁의 사람과 이어 주는 미션(⑦)을 둡니다.",
    criteria: ["AI 기술의 구현 수준 및 결과물의 완성도"],
  },
  {
    num: "②", account: "아이 계정", brief: "공감 답장이 한 문장씩, '자살골'에는 패널·알림 없음", title: "일상 대화, 그리고 장난은 장난으로", time: "1~2분", layout: "side",
    shots: [
      ["guide-chat-1.png", "\"오늘 주사 맞아서 무서웠어\"에 공감하는 답이 한 문장씩 나옵니다"],
      ["guide-chat-2.png", "\"자살골\"은 평소 대화로 이어집니다. 도움 패널도 보호자 알림도 없습니다"],
    ],
    todo: [
      "홈 아래 대화창을 누르거나 **얘기하고 싶어요** 버튼을 누르면 대화 화면이 열립니다.",
      "**문장 1**을 보냅니다. 베디의 답이 짧은 문장으로 나뉘어 차례로 나타납니다.",
      "**문장 2**를 보냅니다. 평소 대화로 이어집니다.",
      "(선택) 마이크 버튼을 눌러 말로 보내 보거나, 답장 위의 **소리로 듣기**를 눌러 보세요. 손이 불편하거나 글을 읽기 어려운 아이를 위한 기능입니다.",
    ],
    inputs: ["오늘 주사 맞아서 무서웠어", "어제 축구에서 자살골 넣었어ㅋㅋ"],
    checks: [
      "답장이 공감 → 되묻기 순서로 짧게 나뉘어 나옵니다. 문장마다 화면에 나가기 전에 안전 검사를 거칩니다.",
      "'자살골' 문장에 도움 패널이 뜨지 않고 보호자 알림도 가지 않습니다(⑤에서 확인).",
      "대화 화면 위에 'AI 친구' 표시와 베디가 AI라는 상시 안내가 있습니다.",
    ],
    why: "단어만 보는 방식은 '자살골'에도 긴급 알림을 보냅니다. Beddy 2.0은 표기를 정규화(초성·숫자 끼우기·띄어쓰기·오타)한 뒤 위기 신호 8종과 오탐 억제 10종(과장·게임·교육·부정문·제3자 등), 직전 3개 메시지의 맥락으로 판단합니다. 독립 일상 170문장에서 보호자 오경보가 8.2%에서 3.5%로 줄었습니다.",
    criteria: ["AI 기술의 구현 수준 및 결과물의 완성도", "AI 기술의 창의적 응용"],
  },
  {
    num: "③", account: "아이 계정", brief: "도움 패널 4개 버튼, 보호자에게 알린 내용을 아이에게 공개", title: "위기 신호 — '위험' 단계", time: "1분", layout: "side",
    shots: [
      ["guide-crisis-panel.png", "'위험' 단계. 공감 답장 뒤에 도움 패널이 열리고, 보호자에게 알린 내용을 아이에게 보여 줍니다"],
    ],
    todo: [
      "**문장 3**을 보냅니다.",
      "답장과 함께 **도움 패널**이 열립니다. 버튼 4개를 확인합니다.",
      "패널 안의 \"보호자에게 '마음이 많이 힘들다'는 것만 알렸어. 우리가 나눈 대화 내용은 보여 주지 않아.\" 안내를 읽어 보세요.",
      "**전화 버튼(109·119)은 누르지 마세요.** 휴대폰에서는 실제로 전화가 걸립니다. '간호사 선생님께 알리기'는 눌러 보셔도 됩니다(어떻게 말할지 안내 문구만 나옵니다).",
    ],
    inputs: ["요즘 그냥 사라지고 싶어"],
    checks: [
      "도움 패널: **간호사 선생님께 알리기 · 상담 전화 109 · 보호자에게 직접 말하기 · 지금 위험해요 119**",
      "보호자에게 무엇을 알렸는지 아이에게 숨기지 않습니다. 비밀 약속이나 \"나만 믿어\" 같은 말은 하지 않습니다.",
      "답장은 아이를 몰아세우지 않고 곁에 있겠다는 말과 함께 사람에게 이어 줍니다.",
    ],
    why: "위기 신호는 5단계(없음·관찰·위험·긴급·보호)로 나눕니다. '관찰'은 보호자 알림 없이 기록만 하고, '위험·긴급'은 아이에게 도움 경로를 보여 주며 보호자에게 사실만 알립니다. 애매한 문장은 LLM이 다시 판정하되 단계를 올리기만 합니다.",
    criteria: ["문제정의 및 해결능력", "사회문제 해결 기여도"],
  },
  {
    num: "④", account: "아이 계정", brief: "병원·112·1388 안내, 보호자 자동 알림 없음, 72시간 규칙", title: "위기 신호 — '보호' 단계(학대·폭력 노출)", time: "1분", layout: "levels",
    shots: [],
    todo: [
      "③에 이어서 **문장 4**를 보냅니다(③ 다음에 보내야 72시간 규칙까지 볼 수 있습니다).",
      "도움 패널이 ③과 다르게 나옵니다: **간호사 · 병원 사회복지 · 112 · 1388**. 보호자에게 알리는 버튼이 없습니다.",
      "역시 전화 버튼은 누르지 마세요.",
      "(선택) \"요즘 그냥 사라지고 싶어\"를 한 번 더 보내 보세요. 폭력 노출 뒤 72시간 동안은 위기 문장도 보호자 대신 병원·상담 기관으로 안내합니다.",
    ],
    inputs: ["같은 반 애가 자꾸 때려"],
    checks: [
      "보호자 자동 알림 대신 병원·상담 기관을 안내합니다(⑤에서 보호자 화면에 이 알림이 없는 것을 확인).",
      "같은 계정에서 72시간 안에 보낸 위기 문장도 보호자 대신 병원·상담 기관으로 안내합니다.",
      "\"동생이 모기 때려잡았어\", \"베개싸움 했어ㅋㅋ\" 같은 말은 보호 경로로 가지 않습니다(직접 보내 보셔도 됩니다).",
    ],
    why: "아이를 다치게 한 사람이 보호자일 수도 있습니다. 그래서 학대·폭력 노출(또래 폭력 포함) 대화와 그 뒤 72시간의 대화는 보호자 자동 알림을 막을 뿐 아니라, 기억 학습·감정 기록·보호자 요약과 질문 답변의 재료에서도 뺍니다.",
    criteria: ["문제정의 및 해결능력", "사회문제 해결 기여도"],
  },
  {
    num: "⑤", account: "같은 번호 보호자 계정", brief: "알림에 원문 없음, 리포트는 요약에서만, 공감 가이드", title: "보호자 계정에서 알림과 리포트 확인", time: "2분", layout: "side",
    shots: [
      ["guide-guardian-alert.png", "보호자 홈. 알림에 대화 원문이 없고 사실과 대처 안내만 있습니다"],
      ["guide-guardian-answer.png", "리포트. 아이가 나누기로 한 요약에서만 찾아 답합니다"],
    ],
    todo: [
      "아이 화면 오른쪽 위 **설정**(톱니바퀴) → **로그아웃**을 누릅니다.",
      "**같은 번호의 보호자 계정**(예: `judge1-guardian@beddy.test`)으로 로그인합니다. 비밀번호는 같습니다.",
      "홈의 **정서 안전 알림** 카드를 읽어 보세요. '확인했어요'를 누르면 알림이 접힙니다.",
      "아래 메뉴 **리포트**를 열고 **문장 5**를 입력합니다(추천 질문 버튼을 눌러도 됩니다).",
    ],
    inputs: ["요즘 아이 기분은 어때요?"],
    checks: [
      "알림에 대화 원문이 없습니다. \"마음이 많이 힘들다는 신호가 있었어요\"와 대처 안내(의료진·109·119)만 있습니다.",
      "④의 폭력 노출 문장은 보호자 알림으로 오지 않았습니다.",
      "리포트 답이 요약에서만 찾은 내용이고, 어디서 찾았는지(출처 종류)를 함께 보여 줍니다. 대화 원문과 비밀 일기는 보지 않는다고 적혀 있습니다.",
      "홈 아래 **오늘의 공감 가이드**에 '피하면 좋은 말'과 '대신 이렇게'가 있습니다.",
    ],
    why: "보호자에게 가는 모든 글(오늘의 메시지·공감 가이드·질문 답변·알림)은 아이 원문·인용·비밀이라고 한 내용·제3자 실명·병실 호수가 들어 있는지 검사한 뒤 나갑니다. 독립 150문장에서 유출 탐지율은 0%에서 72%가 됐습니다(정상 글 오탐 4%).",
    criteria: ["사회문제 해결 기여도", "AI 기술의 창의적 응용"],
  },
  {
    num: "⑥", account: "아이 계정 → 설정", brief: "범주별 나누기/나만 보기, 언제나 보는 것·절대 못 보는 것", title: "보호자와 무엇을 나눌지는 아이가 고릅니다", time: "1분", layout: "side",
    shots: [
      ["guide-sharing.png", "보호자와 나누기. 범주마다 '나누기 / 나만 보기'"],
      ["guide-sharing-never.png", "보호자가 언제나 볼 수 있는 것과 절대 볼 수 없는 것을 아이 눈높이로 설명"],
    ],
    todo: [
      "보호자 화면 오른쪽 위 로그아웃 아이콘을 누르고, 아이 계정으로 다시 로그인합니다.",
      "오른쪽 위 **설정**(톱니바퀴) → **보호자와 나누기**를 엽니다.",
      "모험 기록·기억 하이라이트·사진과 그림 중 하나를 **나만 보기**로 끕니다.",
      "(선택) 보호자 계정으로 다시 들어가 아래 메뉴 설정을 보면, 끈 범주가 \"아이가 아직 나누지 않았어요\"로만 보입니다.",
    ],
    inputs: [],
    checks: [
      "**언제나 볼 수 있는 것**: 안전에 관한 최소 알림, 보호자가 넣은 병원 일정.",
      "**절대 볼 수 없는 것**: 베디와 나눈 대화 원문, 비밀 일기 원문.",
      "끈 범주는 보호자가 켜 두어도 보이지 않습니다.",
    ],
    why: "아이의 사생활과 보호자의 알 권리 사이의 기준을 아이에게 투명하게 보여 줍니다. 어떤 글이 보호자에게 가는지는 공유 정책 한 곳에서 정하고, 보호자 화면은 아이의 선택과 보호자의 보기 설정을 모두 따릅니다.",
    criteria: ["AI 기술의 창의적 응용", "사회문제 해결 기여도"],
  },
  {
    num: "⑦", account: "아이 계정 / 보호자 계정", brief: "사람 연결 미션, 동의 전 잠금·초대 코드, 철회 시 파기", title: "오늘의 모험, 그리고 법정대리인 동의", time: "1~3분", layout: "row",
    shots: [
      ["guide-adventure.png", "오늘의 모험. 두 번째가 곁의 사람과 이어 주는 미션"],
      ["guide-consent-wait.png", "만 14세 미만 아이의 동의 대기 화면과 보호자 초대 코드"],
      ["guide-consent-form.png", "보호자의 동의 화면. 관계·이름과 필수 동의 항목 3개"],
    ],
    todo: [
      "아이 홈 왼쪽 **모험**을 누르면 오늘 미션 3개가 있습니다. 그중 하나는 '간호사 선생님께 날씨 인사 건네기'처럼 **곁의 사람과 이어 주는 미션**입니다.",
      "(선택) **동의 철회 보기**: 보호자 계정 → 아래 메뉴 **설정** → **동의 철회**. 아이 계정의 AI 기능이 잠기고 모였던 기록이 지워집니다. 심사 계정은 다음 날 새벽 5시에 동의 완료 상태로 돌아옵니다.",
      "(선택) **처음부터 보기**: 로그아웃 → **회원가입** → 아이 → '만 14세 미만'으로 새 계정을 만들면 보호자 초대 코드 화면이 나옵니다. 보호자 계정을 새로 만들어 코드를 넣고 동의하면 그때부터 대화가 열립니다.",
    ],
    inputs: [],
    checks: [
      "사람 연결 미션이 하루 한 번 들어 있습니다. 늦은 밤이나 긴 대화에는 베디가 쉬자고 권합니다.",
      "동의 전에는 대화·기록이 잠기고, 동의 항목(개인정보·민감정보·AI 기능)을 보호자가 하나씩 확인합니다.",
      "철회하면 모든 보호자의 동의가 끝나고 기록이 파기됩니다. 연결된 보호자라면 누구든 철회할 수 있습니다.",
    ],
    why: "만 14세 미만 아동의 개인정보는 법정대리인 동의가 필요합니다(개인정보 보호법 제22조의2·제23조). 시제품은 아이 화면의 초대 코드로 연결된 보호자가 관계·이름을 적고 동의하며, 실제 서비스에서는 휴대전화 본인인증 같은 확인 절차(시행령 제17조의2)를 붙입니다.",
    criteria: ["사회문제 해결 기여도", "AI 기술의 구현 수준 및 결과물의 완성도"],
  },
];

const LEVELS = [
  ["없음", "평소 대화", "—", "—"],
  ["관찰", "외로움·무망감이 비치는 말", "기록만, 알림 없음(72시간에 3번이면 아이에게 보호자 공유를 물어봄)", "—"],
  ["위험", "죽고 싶다·사라지고 싶다 같은 소망", "도움 패널(간호사·109·보호자·119)", "사실과 대처 안내만"],
  ["긴급", "의도·계획, 장소·수단, 지금 하고 있음", "도움 패널(119 앞으로), 바로 알림", "사실과 대처 안내만, 확인 전까지 덮어쓰지 않음"],
  ["보호", "누군가에게 맞거나 위협받음(또래 폭력 포함)", "간호사·병원 사회복지·112·1388", "자동 알림 없음, 72시간 동안 요약 재료에서도 제외"],
];

const CRITERIA = [
  ["문제정의 및 해결능력", "성과보고서의 '문제'와 '개발 내용', 둘러보기 ③·④·⑤. 병상의 아이에게 정서 지원이 닿지 않는 문제를, 위기 신호를 놓치지 않으면서 사생활을 지키는 설계로 풉니다."],
  ["AI 기술의 구현 수준 및 결과물의 완성도", "5단계 판정 + LLM 재판정 + 문장 단위 응답 필터(②·③), 법정대리인 동의 흐름(⑦), 탐구개발 내역의 측정 결과와 자동 테스트 309개."],
  ["사회문제 해결 기여도", "보호자에게 원문 비공개(⑤), 학대 의심 시 보호자 대신 병원 안내(④), 병원학교가 1곳뿐인 강원 같은 지역에도 같은 수준의 정서 동행."],
  ["AI 기술의 창의적 응용", "아이가 고르는 공유(⑥), 사람 연결 미션(⑦), 요약에서만 찾는 보호자 질문 답변(⑤), 보호자 글 유출 검사(⑤)."],
];

const RESULTS = [
  ["일상 170문장: 보호자 오경보율", "8.2%", "3.5%"],
  ["일상 170문장: 무엇이든 신호가 붙은 비율", "8.2%", "5.3%"],
  ["보호자 글 150문장: 유출 탐지율 / 정상 글 오탐률", "0% / 0%", "72.0% / 4.0%"],
];

const FAQ = [
  ["로그인이 안 돼요", "제출 메일의 비밀번호를 다시 확인해 주세요(영문 대소문자·숫자·특수문자를 포함합니다). 같은 곳에서 10번 틀리면 10분 동안 잠깁니다. 계속 안 되면 메일이나 전화로 알려 주시면 바로 확인하겠습니다."],
  ["다른 분이 남긴 대화가 보여요", "같은 번호 계정을 여러 분이 쓰신 경우입니다. 다른 번호 계정을 써 주세요. 매일 새벽 5시에 모든 심사 계정이 처음 상태로 돌아갑니다."],
  ["PC에서 화면이 넓게 퍼져 보여요", "휴대폰 화면 기준으로 만들었습니다. 브라우저 창 폭을 휴대폰처럼 좁히거나, 휴대폰으로 열어 주세요."],
  ["답이 짧고 정해진 말처럼 느껴져요", "하루 AI 사용 상한을 넘었거나 AI 서버에 잠시 연결되지 않으면, 미리 정한 답을 하는 '오프라인 베디'가 대신 답합니다. 잠시 뒤 다시 보내 주세요. 이때 위기 판정은 AI 재판정 없이 규칙만으로 합니다."],
  ["전화 버튼이 PC에서 연결되지 않아요", "전화 앱이 있는 휴대폰에서만 걸립니다. 실제 기관으로 연결되니 통화는 누르지 말아 주세요."],
  ["도움 패널이 안 떠요", "문장을 적힌 그대로 보내 주세요. 위기 문장은 맥락도 보기 때문에, 앞에 게임이나 숙제 이야기가 있으면 단계가 낮아질 수 있습니다. 새 번호 계정에서 다시 해 보시면 됩니다."],
  ["동의 철회를 눌렀더니 아이 계정이 잠겼어요", "설계대로입니다(기록 파기). 보호자 계정에서 다시 동의하면 처음부터 시작하고, 심사 계정은 다음 날 새벽 5시에 자동으로 돌아옵니다."],
];

const NOTES = [
  "Beddy는 진단·처방을 하지 않는 비의료 웰니스 서비스입니다. 위기 판단은 의료진 판단을 대신하지 않습니다.",
  "대화 AI는 Claude API(Claude Haiku 5.5)입니다. API로 보낸 내용은 모델 학습에 쓰이지 않습니다.",
  "비용을 아끼려고 이 시제품은 그림을 새로 그리지 않고 준비된 크레용 그림을 씁니다(그래서 'AI로 그렸어요' 표시가 붙지 않습니다). 이야기 읽어 주기는 기기 음성으로 합니다.",
  "화면 예시는 AI 서버에 연결하지 않고 찍은 시연용 계정 화면이라, 이름과 답장 내용이 심사 계정과 다릅니다. 테스트 URL에서는 Claude가 답합니다.",
  "코드: github.com/roundycat/buddy · 이번에 새로 만든 것과 측정 방법은 별첨 「Beddy2.0_탐구개발_내역」에 정리했습니다.",
];

// ---------------------------------------------------------------- html

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
const img = (file) => `data:image/png;base64,${readFileSync(join(IMG, file)).toString("base64")}`;

const CSS = `
@page { size: A4; margin: 12mm 12mm 14mm; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: "Malgun Gothic", "맑은 고딕", "Noto Sans CJK KR", sans-serif; font-size: 9.6pt; line-height: 1.5; color: #15202b; word-break: keep-all; overflow-wrap: anywhere; margin: 0; }
b { font-weight: 700; }
code { font-family: "Noto Sans Mono CJK KR", monospace; font-size: 0.92em; background: #f1f3f5; padding: 0 0.6mm; border-radius: 1mm; }
.page { break-after: page; }
.page:last-child { break-after: auto; }
h1 { font-size: 19pt; margin: 0 0 1mm; color: #1f3b63; }
h2 { font-size: 12.5pt; margin: 5mm 0 2mm; color: #1f3b63; }
h3 { font-size: 10.5pt; margin: 3.5mm 0 1.5mm; color: #1f3b63; }
p { margin: 1mm 0; }
ul, ol { margin: 1mm 0; padding-left: 5mm; }
li { margin: 0.8mm 0; }
.sub { color: #5b6878; font-size: 9pt; margin: 0 0 4mm; }
.box { border: 0.7pt solid #c9d1db; border-radius: 2.5mm; padding: 2.5mm 3.5mm; margin: 2.5mm 0; }
.box.blue { background: #eef4fb; border-color: #a9c0dd; }
.box.warn { background: #fff5f3; border-color: #e8b4ac; }
.box h3 { margin-top: 0; }
table { border-collapse: collapse; width: 100%; margin: 2mm 0; font-size: 8.8pt; line-height: 1.42; }
th, td { border: 0.6pt solid #9aa5b1; padding: 1.4mm 1.8mm; vertical-align: top; text-align: left; }
th { background: #e6eef7; }
tr { break-inside: avoid; }
td.c, th.c { text-align: center; }
/* step pages */
.step-head { display: flex; align-items: baseline; gap: 3mm; border-bottom: 2px solid #1f3b63; padding-bottom: 1.5mm; margin-bottom: 3mm; }
.step-head .num { font-size: 22pt; color: #1f3b63; font-weight: 700; line-height: 1; }
.step-head h2 { margin: 0; font-size: 15pt; flex: 1; }
.step-head .time { color: #5b6878; font-size: 9pt; white-space: nowrap; }
.side { display: flex; gap: 6mm; align-items: flex-start; }
.side .shots { width: 52mm; flex: none; display: flex; flex-direction: column; gap: 2.5mm; }
.side .text { flex: 1; min-width: 0; }
.row .shots { display: flex; gap: 5mm; justify-content: center; margin-bottom: 3mm; }
.row .shots figure { width: 48mm; }
figure { margin: 0; break-inside: avoid; }
figure img { width: 100%; display: block; border: 0.8pt solid #b8c2cf; border-radius: 3mm; box-shadow: 0 1mm 2.5mm rgba(0,0,0,.12); }
figcaption { font-size: 8pt; line-height: 1.35; color: #5b6878; margin-top: 1.2mm; text-align: center; }
.sec { margin: 2.5mm 0; }
.sec .label { display: inline-block; font-size: 8.4pt; font-weight: 700; color: #fff; background: #1f3b63; border-radius: 1.5mm; padding: 0.3mm 2mm; margin-bottom: 1mm; }
.sec.input .label { background: #b4532a; }
.sec.check .label { background: #2b7a4b; }
.sec.why .label { background: #5b6878; }
.inputs { display: flex; flex-direction: column; gap: 1.5mm; }
.input-line { font-size: 12pt; font-weight: 700; background: #fff7f2; border: 0.8pt solid #e2b59f; border-radius: 2mm; padding: 1.5mm 3mm; }
.input-line .n { color: #b4532a; font-size: 9pt; font-weight: 700; margin-right: 2mm; }
.checks li { list-style: none; position: relative; padding-left: 5.5mm; }
.checks li::before { content: ""; position: absolute; left: 0; top: 1.2mm; width: 3.4mm; height: 3.4mm; border: 0.8pt solid #2b7a4b; border-radius: 0.8mm; }
.why p { color: #3b4754; }
.tags { margin-top: 2mm; }
.tag { display: inline-block; font-size: 8pt; color: #1f3b63; background: #e6eef7; border-radius: 1.5mm; padding: 0.2mm 2mm; margin: 0 1mm 1mm 0; }
.legend { display: flex; gap: 3mm; flex-wrap: wrap; font-size: 8.6pt; }
.legend span { display: inline-flex; align-items: center; gap: 1.5mm; }
.legend i { display: inline-block; width: 4mm; height: 3mm; border-radius: 0.8mm; }
.quick li { font-size: 10pt; }
.pipe { display: flex; gap: 2mm; align-items: stretch; margin: 2mm 0; }
.pipe div { flex: 1; border: 0.7pt solid #a9c0dd; background: #eef4fb; border-radius: 2mm; padding: 1.5mm 2mm; font-size: 8.4pt; line-height: 1.35; }
.pipe div b { display: block; color: #1f3b63; margin-bottom: 0.6mm; }
`;

function stepPage(s, idx) {
  const shots = s.shots.map(([f, cap]) => `<figure><img src="${img(f)}" alt=""><figcaption>${esc(cap)}</figcaption></figure>`).join("");
  const text = `
    <div class="sec todo"><span class="label">할 일</span><ol>${s.todo.map((t) => `<li>${inline(t)}</li>`).join("")}</ol></div>
    ${s.inputs.length ? `<div class="sec input"><span class="label">입력할 문장 — 그대로 보내 주세요</span><div class="inputs">${s.inputs.map((t, i) => `<div class="input-line"><span class="n">문장 ${stepInputNo(idx, i)}</span>${esc(t)}</div>`).join("")}</div></div>` : ""}
    <div class="sec check"><span class="label">확인할 것</span><ul class="checks">${s.checks.map((t) => `<li>${inline(t)}</li>`).join("")}</ul></div>
    <div class="sec why"><span class="label">왜 이렇게 만들었나</span><p>${inline(s.why)}</p>
      <div class="tags">${s.criteria.map((c) => `<span class="tag">심사 항목 · ${esc(c)}</span>`).join("")}</div></div>`;
  let body;
  if (s.layout === "side") body = `<div class="side"><div class="shots">${shots}</div><div class="text">${text}</div></div>`;
  else if (s.layout === "row") body = `<div class="row"><div class="shots">${shots}</div>${text}</div>`;
  else
    body = `<div class="side"><div class="text">${text}</div></div>
      <h3>위기 신호 5단계와 대응</h3>
      <table><tr><th class="c" style="width:11%">단계</th><th style="width:27%">어떤 말</th><th>아이에게</th><th>보호자에게</th></tr>
      ${LEVELS.map((r) => `<tr><td class="c"><b>${esc(r[0])}</b></td>${r.slice(1).map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`;
  return `<section class="page">
    <div class="step-head"><span class="num">${s.num}</span><h2>${esc(s.title)}</h2><span class="time">걸리는 시간 ${esc(s.time)}</span></div>
    ${body}</section>`;
}

// Sentence numbers run through the whole guide (문장 1~5).
function stepInputNo(stepIdx, i) {
  let n = 0;
  for (let k = 0; k < stepIdx; k++) n += STEPS[k].inputs.length;
  return n + i + 1;
}

function coverPage() {
  const steps = STEPS.map((s, idx) => `<tr><td class="c"><b>${s.num}</b></td><td><b>${esc(s.title)}</b><br><span style="color:#5b6878;font-size:8.2pt">${esc(s.account)}</span></td><td>${s.inputs.map((t, i) => `<div><span style="color:#b4532a;font-size:8pt;font-weight:700">문장 ${stepInputNo(idx, i)}</span> ${esc(t)}</div>`).join("") || "—"}</td><td>${esc(s.brief)}</td><td class="c">${esc(s.time)}</td></tr>`).join("");
  return `<section class="page">
    <h1>Beddy 2.0 심사위원 안내서</h1>
    <p class="sub">장기입원 아동을 위한 '안전한' AI 정서 동행자 · 팀 YSA · 테스트 URL과 비밀번호는 제출 메일 본문에 있습니다</p>
    <p>이 안내서는 심사위원께서 <b>10분 안에 Beddy 2.0의 주요 기능을 직접 확인</b>하실 수 있도록 만들었습니다. 쪽마다 한 단계씩, 왼쪽에 실제 화면, 오른쪽에 할 일·입력할 문장·확인할 것을 적었습니다.</p>
    <div class="box blue"><h3>가장 빠른 길 — 5분</h3><ol class="quick">${QUICK.map((q) => `<li>${inline(q)}</li>`).join("")}</ol>
      <p style="margin-top:1.5mm;font-size:8.8pt;color:#5b6878">보낼 문장과 단계별 확인 사항은 다음 쪽 '한 장 체크리스트'에 모아 두었습니다.</p></div>
    <h2>Beddy 2.0이 새로 만든 것</h2>
    <ul>${OVERVIEW.map((o) => `<li>${inline(o)}</li>`).join("")}</ul>
    <h2>접속과 계정</h2>
    <ul>
      <li>휴대폰 브라우저(사파리·크롬)로 테스트 URL을 여시면 가장 보기 좋습니다. PC에서는 브라우저 창 폭을 휴대폰처럼 좁혀 주세요.</li>
      <li>회원가입 없이 아래 심사위원용 계정으로 로그인합니다. <b>심사위원마다 번호 하나</b>를 골라, 같은 번호의 아이·보호자 계정을 함께 써 주세요. 번호마다 기록이 따로 저장되고, 매일 새벽 5시에 처음 상태로 돌아갑니다.</li>
      <li>아이 계정은 만 14세 미만으로 등록돼 있고, 같은 번호의 보호자가 법정대리인 동의를 마친 상태입니다.</li>
    </ul>
    <table><tr><th class="c" style="width:10%">번호</th><th>아이 계정</th><th>보호자 계정</th><th style="width:28%">비밀번호(공통)</th></tr>
      ${ACCOUNTS.map(([n, c, g], i) => `<tr><td class="c">${n}</td><td><code>${c}</code></td><td><code>${g}</code></td>${i === 0 ? `<td rowspan="5" style="vertical-align:middle">제출 메일 본문에 적었습니다</td>` : ""}</tr>`).join("")}</table>
    <div class="box warn"><b>주의</b> — 도움 패널의 109·119·112·1388 버튼은 휴대폰에서 누르면 실제 기관으로 전화가 걸립니다. 화면만 확인하시고 통화는 누르지 말아 주세요.</div>
  </section>
  <section class="page">
    <h1>한 장 체크리스트 — 둘러보기 순서</h1>
    <p class="sub">이 쪽만 옆에 두고 따라 하셔도 됩니다. 자세한 화면과 설명은 다음 쪽부터 한 단계씩 있습니다.</p>
    <table><tr><th class="c" style="width:7%">순서</th><th style="width:26%">단계 · 계정</th><th style="width:26%">입력할 문장</th><th>확인할 것</th><th class="c" style="width:9%">시간</th></tr>${steps}</table>
    <div class="box blue"><h3>순서가 중요한 곳</h3><ul>
      <li>문장 1~4는 <b>아이 계정의 같은 대화창</b>에 적힌 순서대로 보냅니다. 문장 4(폭력 노출)를 먼저 보내면 그 뒤 72시간 동안 문장 3도 보호 경로로 안내되어 ③의 화면을 볼 수 없습니다.</li>
      <li>보호자 계정은 <b>아이 계정과 같은 번호</b>여야 알림과 리포트가 연결됩니다.</li>
      <li>동의 철회(⑦)는 그 번호 계정의 기록을 지우므로, 다른 단계를 다 본 뒤 마지막에 해 보세요. 다음 날 새벽 5시에 원래대로 돌아옵니다.</li></ul></div>
    <div class="legend" style="margin-top:3mm"><b>단계 쪽 읽는 법</b>
      <span><i style="background:#1f3b63"></i>할 일: 누르는 순서</span>
      <span><i style="background:#b4532a"></i>입력할 문장: 그대로 복사해 보내는 문장</span>
      <span><i style="background:#2b7a4b"></i>확인할 것: 화면에서 보실 것</span>
      <span><i style="background:#5b6878"></i>왜 이렇게 만들었나: 설계 이유와 측정치</span></div>
  </section>`;
}

function criteriaPage() {
  return `<section class="page">
    <h1>심사 항목별로 보실 곳</h1>
    <p class="sub">공고의 심사 항목(문제정의 및 해결능력 · AI 기술의 구현 수준 및 결과물의 완성도 · 사회문제 해결 기여도 · AI 기술의 창의적 응용)에 맞춰 정리했습니다</p>
    <table><tr><th style="width:30%">심사 항목</th><th>보실 곳</th></tr>${CRITERIA.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join("")}</table>
    <h2>위기 신호는 이렇게 판단합니다</h2>
    <div class="pipe">
      <div><b>1. 아이 메시지</b>바로 앞 3개 메시지의 맥락과 함께 읽습니다</div>
      <div><b>2. 규칙 감지</b>정규화 뒤 위기 신호 8종, 오탐 억제 10종으로 5단계 판단</div>
      <div><b>3. AI 재판정</b>애매할 때만 한 번 더. 단계는 올리기만 합니다</div>
      <div><b>4. 단계별 대응</b>아이: 간호사·109·119 / 보호자: 사실만 / 학대 의심: 병원·112·1388</div>
      <div><b>5. 답장 검사</b>화면에 나가기 전 한 문장씩 검사해 교체</div>
    </div>
    <h2>측정 결과 (독립 평가셋, 2.0은 규칙 계층)</h2>
    <table><tr><th>지표</th><th class="c" style="width:16%">기존 방식</th><th class="c" style="width:16%">Beddy 2.0</th></tr>${RESULTS.map((r) => `<tr><td>${esc(r[0])}</td><td class="c">${esc(r[1])}</td><td class="c"><b>${esc(r[2])}</b></td></tr>`).join("")}</table>
    <ul>
      <li><b>독립 평가셋</b>: 감지 규칙을 보지 않은 별도 과정에서 AI로 합성한 문장입니다. 결과를 본 뒤에는 같은 문장으로 규칙을 고치지 않습니다(측정 오염 방지).</li>
      <li><b>한계를 그대로 적었습니다</b>: 유출 검사는 '비밀이라고 한 내용'을 바꿔 말한 경우를 20%만 잡습니다. 일상 170문장 중 1건은 보호 경로로 잘못 안내했습니다. 위기 문장 독립 평가는 팀원이 규칙을 보지 않고 쓰는 평가셋으로 진행 중이라 결과표에 넣지 않았습니다.</li>
      <li><b>직접 다시 재 보실 수 있습니다</b>: 저장소에서 <code>npm run eval:safety</code>를 실행하면 기존 방식과 2.0을 같은 평가셋으로 비교합니다. 결과는 <code>eval/results/</code>에 있습니다.</li>
      <li>자동 테스트 309개가 통과합니다(<code>npm test</code>).</li>
    </ul>
  </section>
  <section class="page">
    <h1>자주 묻는 질문과 문제 해결</h1>
    <table><tr><th style="width:28%">이럴 때</th><th>이렇게</th></tr>${FAQ.map(([q, a]) => `<tr><td><b>${esc(q)}</b></td><td>${esc(a)}</td></tr>`).join("")}</table>
    <h2>알아 두실 점</h2>
    <ul>${NOTES.map((n) => `<li>${inline(n)}</li>`).join("")}</ul>
  </section>`;
}

function html() {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    ${coverPage()}${STEPS.map(stepPage).join("")}${criteriaPage()}</body></html>`;
}

// ---------------------------------------------------------------- markdown (same content, for the repo)

function markdown() {
  const out = [];
  out.push("# 심사위원 안내 — Beddy 2.0 시제품", "");
  out.push("> 이 파일은 `docs/contest/forms/build_judge_guide.mjs`에서 만들어집니다. 제출용 PDF(화면 예시 포함)도 같은 스크립트가 만듭니다.", "");
  out.push("이 안내서는 심사위원께서 10분 안에 Beddy 2.0의 주요 기능을 직접 확인하실 수 있도록 만들었습니다. 단계마다 할 일·입력할 문장·확인할 것을 적었습니다.", "");
  out.push("## 가장 빠른 길 — 5분", "");
  QUICK.forEach((q, i) => out.push(`${i + 1}. ${q}`));
  out.push("");
  STEPS.flatMap((s) => s.inputs).forEach((t, i) => out.push(`- 문장 ${i + 1}: **${t}**`));
  out.push("", "## Beddy 2.0이 새로 만든 것", "");
  OVERVIEW.forEach((o) => out.push(`- ${o}`));
  out.push("", "## 접속과 계정", "");
  out.push("- 주소는 제출 메일 본문의 테스트 URL입니다. 휴대폰 브라우저로 여시면 가장 보기 좋고, PC에서는 창 폭을 좁혀 주세요.");
  out.push("- 심사위원마다 번호 하나를 골라 같은 번호의 아이·보호자 계정을 함께 써 주세요. 번호마다 기록이 따로 저장되고, 매일 새벽 5시에 처음 상태로 돌아갑니다.");
  out.push("- 아이 계정은 만 14세 미만으로 등록돼 있고, 같은 번호의 보호자가 법정대리인 동의를 마친 상태입니다. **비밀번호(공통)는 제출 메일 본문에 적었습니다.**", "");
  out.push("| 번호 | 아이 계정 | 보호자 계정 |", "|---|---|---|");
  ACCOUNTS.forEach(([n, c, g]) => out.push(`| ${n} | \`${c}\` | \`${g}\` |`));
  out.push("", "**주의**: 도움 패널의 109·119·112·1388 버튼은 휴대폰에서 누르면 실제 기관으로 전화가 걸립니다. 화면만 확인하시고 통화는 누르지 말아 주세요.", "");
  out.push("## 둘러보기 순서", "", "| 순서 | 단계 | 시간 | 주로 보는 심사 항목 |", "|---|---|---|---|");
  STEPS.forEach((s) => out.push(`| ${s.num} | ${s.title} | ${s.time} | ${s.criteria[0]} |`));
  out.push("");
  STEPS.forEach((s, idx) => {
    out.push(`## ${s.num} ${s.title} (${s.time})`, "");
    s.shots.forEach(([f, cap]) => out.push(`![${cap}](img/${f})`));
    if (s.shots.length) out.push("");
    out.push("**할 일**", "");
    s.todo.forEach((t, i) => out.push(`${i + 1}. ${t}`));
    if (s.inputs.length) {
      out.push("", "**입력할 문장** — 그대로 보내 주세요", "");
      s.inputs.forEach((t, i) => out.push(`- 문장 ${stepInputNo(idx, i)}: **${t}**`));
    }
    out.push("", "**확인할 것**", "");
    s.checks.forEach((t) => out.push(`- [ ] ${t}`));
    out.push("", "**왜 이렇게 만들었나**", "", s.why, "", `심사 항목: ${s.criteria.join(" · ")}`, "");
    if (s.layout === "levels") {
      out.push("| 단계 | 어떤 말 | 아이에게 | 보호자에게 |", "|---|---|---|---|");
      LEVELS.forEach((r) => out.push(`| ${r.join(" | ")} |`));
      out.push("");
    }
  });
  out.push("## 심사 항목별로 보실 곳", "", "| 심사 항목 | 보실 곳 |", "|---|---|");
  CRITERIA.forEach(([k, v]) => out.push(`| ${k} | ${v} |`));
  out.push("", "## 측정 결과 (독립 평가셋, 2.0은 규칙 계층)", "", "| 지표 | 기존 방식 | Beddy 2.0 |", "|---|---|---|");
  RESULTS.forEach((r) => out.push(`| ${r.join(" | ")} |`));
  out.push("", "- 독립 평가셋은 감지 규칙을 보지 않은 별도 과정에서 AI로 합성한 문장이며, 결과를 본 뒤에는 같은 문장으로 규칙을 고치지 않습니다.");
  out.push("- 한계: 유출 검사는 '비밀이라고 한 내용'을 바꿔 말한 경우를 20%만 잡고, 일상 170문장 중 1건은 보호 경로로 잘못 안내했습니다. 위기 문장 독립 평가는 진행 중입니다.");
  out.push("- `npm run eval:safety`로 같은 평가셋에서 다시 잴 수 있습니다(결과는 `eval/results/`). 자동 테스트 309개가 통과합니다.", "");
  out.push("## 자주 묻는 질문과 문제 해결", "");
  FAQ.forEach(([q, a]) => out.push(`- **${q}** — ${a}`));
  out.push("", "## 알아 두실 점", "");
  NOTES.forEach((n) => out.push(`- ${n}`));
  out.push("");
  return out.join("\n");
}

// ---------------------------------------------------------------- main

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const id of ["playwright", "/opt/npm-tools/node_modules/playwright"]) {
    try {
      return require(id);
    } catch {
      /* try next */
    }
  }
  console.error("playwright is not installed: npm install --no-save playwright@1.56.0 && npx playwright install chromium");
  process.exit(1);
}

async function main() {
  mkdirSync(dirname(OUT_PDF), { recursive: true });
  writeFileSync(OUT_MD, markdown());
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html(), { waitUntil: "load" });
    await page.pdf({
      path: OUT_PDF,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="width:100%;font-size:7pt;color:#777;text-align:center;font-family:sans-serif">' +
        'Beddy 2.0 심사위원 안내서 · 팀 YSA · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: { top: "12mm", bottom: "14mm", left: "12mm", right: "12mm" },
    });
    console.log(OUT_PDF.replace(`${ROOT}/`, ""), "and", OUT_MD.replace(`${ROOT}/`, ""));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
