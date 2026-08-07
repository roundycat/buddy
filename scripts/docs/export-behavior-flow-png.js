const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const svgPath = path.join(root, "docs", "architecture", "llm-agent-rag-behavior-flow.svg");
const pngPath = path.join(root, "docs", "architecture", "llm-agent-rag-behavior-flow.png");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, Segoe UI, sans-serif">
  <defs>
    <marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/></marker>
    <style>
      .title { font-size: 34px; font-weight: 800; fill: #0f172a; }
      .sub { font-size: 16px; fill: #475569; }
      .lane { font-size: 20px; font-weight: 800; }
      .h { font-size: 15px; font-weight: 700; fill: #0f172a; }
      .t { font-size: 13px; fill: #334155; }
      .s { font-size: 12px; fill: #64748b; }
      .ln { fill: none; stroke: #475569; stroke-width: 2.4; marker-end: url(#a); }
      .tag { font-size: 12px; font-weight: 800; fill: #fff; }
    </style>
  </defs>

  <rect width="1920" height="1080" fill="#ffffff"/>
  <text class="title" x="40" y="52">Beddy AI 동작 플로우 (LLM / Agent / RAG가 실제로 어떻게 도나)</text>
  <text class="sub" x="40" y="82">AWS 서비스는 아래에 작게, 위에는 동작 경로를 강조</text>

  <!-- ===== LLM LANE ===== -->
  <rect x="40" y="110" width="1840" height="260" rx="16" fill="#eff6ff" stroke="#2563eb" stroke-width="3"/>
  <text class="lane" x="60" y="148" fill="#1d4ed8">1) LLM — 실시간 채팅 (항상 아이 대화 때)</text>
  <rect x="1660" y="122" width="80" height="30" rx="8" fill="#1d4ed8"/><text class="tag" x="1686" y="142">LLM</text>

  <rect x="60" y="170" width="220" height="90" rx="12" fill="#fff" stroke="#3b82f6"/>
  <text class="h" x="80" y="204">아이 메시지</text>
  <text class="s" x="80" y="228">환아 UI 채팅</text>

  <rect x="320" y="170" width="260" height="90" rx="12" fill="#fff" stroke="#3b82f6"/>
  <text class="h" x="340" y="204">ECS API</text>
  <text class="s" x="340" y="228">ALB → conversation</text>

  <rect x="620" y="170" width="320" height="90" rx="12" fill="#fff" stroke="#3b82f6"/>
  <text class="h" x="640" y="204">Bedrock Haiku + Guardrail</text>
  <text class="s" x="640" y="228">SSE 스트림 응답</text>

  <rect x="980" y="170" width="280" height="90" rx="12" fill="#fff" stroke="#3b82f6"/>
  <text class="h" x="1000" y="204">아이 화면에 답변</text>
  <text class="s" x="1000" y="228">즉시 표시</text>

  <rect x="1300" y="170" width="540" height="90" rx="12" fill="#dbeafe" stroke="#2563eb"/>
  <text class="h" x="1320" y="204">참조 데이터</text>
  <text class="t" x="1320" y="228">페르소나 + 학습 메모리 요약</text>
  <text class="s" x="1320" y="250">원문 채팅은 아이 전용 저장</text>

  <path class="ln" d="M 280 215 L 320 215"/>
  <path class="ln" d="M 580 215 L 620 215"/>
  <path class="ln" d="M 940 215 L 980 215"/>

  <text class="t" x="60" y="300">결과 축적: DynamoDB(상태) / S3(미디어) ← 나중에 Agent·RAG 재료가 됨</text>
  <text class="s" x="60" y="330">※ Agent 아님. 매 채팅 턴마다 LLM만 호출</text>

  <!-- ===== AGENT LANE ===== -->
  <rect x="40" y="400" width="1840" height="300" rx="16" fill="#fff7ed" stroke="#ea580c" stroke-width="3"/>
  <text class="lane" x="60" y="438" fill="#c2410c">2) Agent — 미션 계획 (새벽 배치 / 필요할 때만)</text>
  <rect x="1640" y="412" width="100" height="30" rx="8" fill="#c2410c"/><text class="tag" x="1660" y="432">AGENT</text>

  <rect x="60" y="460" width="240" height="100" rx="12" fill="#fff" stroke="#fb923c"/>
  <text class="h" x="80" y="494">EventBridge 05:00</text>
  <text class="s" x="80" y="518">/api/cron/daily</text>

  <rect x="340" y="460" width="260" height="100" rx="12" fill="#fff" stroke="#fb923c"/>
  <text class="h" x="360" y="494">오늘 컨텍스트 수집</text>
  <text class="s" x="360" y="518">기분·일정·에너지·상태</text>

  <rect x="640" y="460" width="520" height="100" rx="12" fill="#ffedd5" stroke="#c2410c" stroke-width="2"/>
  <text class="h" x="660" y="490">tool-use 루프 (모델이 골라 호출)</text>
  <text class="t" x="660" y="514">1 guidance 카드  2 최근 제목  3 submit_plan</text>
  <text class="s" x="660" y="536">emotional-guidance.cards.json + adventure packs</text>

  <rect x="1200" y="460" width="300" height="100" rx="12" fill="#fff" stroke="#fb923c"/>
  <text class="h" x="1220" y="494">generate → validate</text>
  <text class="s" x="1220" y="518">repair 1회 / rules fallback</text>

  <rect x="1540" y="460" width="300" height="100" rx="12" fill="#fff" stroke="#fb923c"/>
  <text class="h" x="1560" y="494">미션팩 저장</text>
  <text class="s" x="1560" y="518">아이 낮에 수행</text>

  <path class="ln" d="M 300 510 L 340 510"/>
  <path class="ln" d="M 600 510 L 640 510"/>
  <path class="ln" d="M 1160 510 L 1200 510"/>
  <path class="ln" d="M 1500 510 L 1540 510"/>

  <text class="t" x="60" y="600">Agent가 “고르는” 방식: 컨텍스트 보고 → 필요 도구만 호출 → 규칙 안(병실 가능/의료금지)에서 plan 제출 → 코드 검증</text>
  <text class="s" x="60" y="628">※ 채팅마다 안 돔. 미션 준비가 필요할 때만 동작</text>
  <text class="s" x="60" y="656">같은 배치에서 보호자 홈 메시지 준비 + KB 요약 MD 5종도 생성</text>

  <!-- ===== RAG LANE ===== -->
  <rect x="40" y="730" width="1840" height="300" rx="16" fill="#faf5ff" stroke="#9333ea" stroke-width="3"/>
  <text class="lane" x="60" y="768" fill="#7e22ce">3) RAG — 보호자 질문 답변 (질문할 때만, Agent 아님)</text>
  <rect x="1680" y="742" width="80" height="30" rx="8" fill="#7e22ce"/><text class="tag" x="1704" y="762">RAG</text>

  <rect x="60" y="790" width="220" height="100" rx="12" fill="#fff" stroke="#a855f7"/>
  <text class="h" x="80" y="824">보호자 질문</text>
  <text class="s" x="80" y="848">리포트 UI</text>

  <rect x="320" y="790" width="260" height="100" rx="12" fill="#fff" stroke="#a855f7"/>
  <text class="h" x="340" y="824">질의 재작성</text>
  <text class="s" x="340" y="848">guardian-rag.ts</text>

  <rect x="620" y="790" width="340" height="100" rx="12" fill="#f3e8ff" stroke="#7e22ce" stroke-width="2"/>
  <text class="h" x="640" y="820">Bedrock KB Retrieve</text>
  <text class="t" x="640" y="844">S3 kb-summaries/{childId}/</text>
  <text class="s" x="640" y="866">memory emotion mission timeline interests</text>

  <rect x="1000" y="790" width="280" height="100" rx="12" fill="#fff" stroke="#a855f7"/>
  <text class="h" x="1020" y="824">Bridge 필터</text>
  <text class="s" x="1020" y="848">원문·좌표 차단</text>

  <rect x="1320" y="790" width="260" height="100" rx="12" fill="#fff" stroke="#a855f7"/>
  <text class="h" x="1340" y="824">+ 라이브 집계</text>
  <text class="s" x="1340" y="848">기분/모험/메모리요약</text>

  <rect x="1620" y="790" width="220" height="100" rx="12" fill="#fdf4ff" stroke="#7e22ce"/>
  <text class="h" x="1640" y="824">요약 답변</text>
  <text class="s" x="1640" y="848">보호자 화면에만</text>

  <path class="ln" d="M 280 840 L 320 840"/>
  <path class="ln" d="M 580 840 L 620 840"/>
  <path class="ln" d="M 960 840 L 1000 840"/>
  <path class="ln" d="M 1280 840 L 1320 840"/>
  <path class="ln" d="M 1580 840 L 1620 840"/>

  <text class="t" x="60" y="930">전달되는 것: 요약 문서 hit + 집계 → LLM이 만든 따뜻한 요약 문장</text>
  <text class="t" x="60" y="958" fill="#b91c1c">안 가는 것: 채팅 원문 · 일기 원문 · GPS · 다른 아이 KB</text>
  <text class="s" x="60" y="986">AWS 공통: ALB · ECS · Bedrock · DynamoDB · S3 · EventBridge · CloudWatch · Secrets Manager</text>
</svg>
`;

fs.writeFileSync(svgPath, svg, "utf8");

sharp(svgPath, { density: 144 })
  .png()
  .toFile(pngPath)
  .then((info) => console.log("ok", pngPath, `${info.width}x${info.height}`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
