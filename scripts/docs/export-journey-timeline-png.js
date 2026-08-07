const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const svgPath = path.join(root, "docs", "architecture", "journey-timeline-llm-agent-rag.svg");
const pngPath = path.join(root, "docs", "architecture", "journey-timeline-llm-agent-rag.png");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, Segoe UI, sans-serif">
  <defs>
    <marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748B"/></marker>
    <style>
      .title { font-size: 36px; font-weight: 700; fill: #0f172a; }
      .sub { font-size: 15px; fill: #475569; }
      .h1 { font-size: 18px; font-weight: 700; fill: #0f172a; }
      .h2 { font-size: 15px; font-weight: 700; fill: #0f172a; }
      .t { font-size: 13px; fill: #334155; }
      .s { font-size: 12px; fill: #64748b; }
      .ln { fill: none; stroke: #64748B; stroke-width: 2.2; marker-end: url(#a); }
      .tag { font-size: 11px; font-weight: 700; fill: #fff; }
    </style>
  </defs>

  <rect width="1920" height="1080" fill="#ffffff"/>
  <text class="title" x="44" y="56">입원 → 퇴원 전반 플로우 (LLM / Agent / RAG)</text>
  <text class="sub" x="44" y="84">채팅은 LLM, 미션 계획은 Agent, 보호자 QnA는 RAG / 원문 채팅은 보호자로 직접 전달 안 됨</text>

  <!-- Top timeline -->
  <rect x="44" y="112" width="1832" height="140" rx="16" fill="#f8fafc" stroke="#cbd5e1"/>
  <text class="h1" x="64" y="146">환아 여정 5단계</text>

  <rect x="66" y="168" width="320" height="68" rx="12" fill="#e2e8f0"/><text class="h2" x="86" y="208">1) 입원/온보딩</text>
  <rect x="426" y="168" width="320" height="68" rx="12" fill="#dbeafe"/><text class="h2" x="446" y="208">2) 입원 중 일상</text>
  <rect x="786" y="168" width="320" height="68" rx="12" fill="#ffedd5"/><text class="h2" x="806" y="208">3) 새벽 배치</text>
  <rect x="1146" y="168" width="320" height="68" rx="12" fill="#f5d0fe"/><text class="h2" x="1166" y="208">4) 보호자 확인/질문</text>
  <rect x="1506" y="168" width="320" height="68" rx="12" fill="#dcfce7"/><text class="h2" x="1526" y="208">5) 퇴원/편지 오픈</text>

  <!-- LLM -->
  <rect x="44" y="288" width="590" height="230" rx="14" fill="#f0f9ff" stroke="#0284c7" stroke-width="2"/>
  <text class="h1" x="64" y="322">LLM (실시간 채팅)</text>
  <rect x="62" y="340" width="554" height="160" rx="12" fill="#fff" stroke="#0284c7"/>
  <text class="h2" x="84" y="372" fill="#0369a1">아이 메시지 → Guardrail + Haiku SSE → 답변</text>
  <text class="t" x="84" y="398">참조: 페르소나 + 학습 메모리 요약(formatMemoryForPrompt)</text>
  <text class="s" x="84" y="424">결과: 대화 저장, 감정/이벤트 축적 (정원·소원·이야기책·일정 데이터에 반영)</text>
  <rect x="534" y="350" width="72" height="24" rx="8" fill="#0369a1"/><text class="tag" x="556" y="366">LLM</text>

  <!-- Agent -->
  <rect x="664" y="288" width="590" height="360" rx="14" fill="#fff7ed" stroke="#c2410c" stroke-width="2"/>
  <text class="h1" x="684" y="322">Agent (오늘의 모험 계획, 유일한 tool-use)</text>
  <rect x="682" y="340" width="554" height="290" rx="12" fill="#fff" stroke="#ea580c"/>
  <text class="h2" x="704" y="372" fill="#c2410c">runToolAgent: tool 선택 루프</text>
  <text class="t" x="704" y="398">- lookup_emotional_guidance → emotional-guidance.cards.json</text>
  <text class="t" x="704" y="422">- list_recent_quest_titles → recent adventure packs (DynamoDB)</text>
  <text class="t" x="704" y="446">- submit_mission_plan(terminal) → 계획 확정</text>
  <text class="t" x="704" y="478">그 다음: generate(LLM) → validate(code) → repair 1회 → fallback</text>
  <text class="s" x="704" y="506">배치 시점(05:00 KST)에 준비되어 아이가 낮에 수행</text>
  <rect x="1158" y="350" width="72" height="24" rx="8" fill="#c2410c"/><text class="tag" x="1173" y="366">AGENT</text>

  <!-- RAG -->
  <rect x="1284" y="288" width="592" height="500" rx="14" fill="#faf5ff" stroke="#7e22ce" stroke-width="2"/>
  <text class="h1" x="1304" y="322">RAG (보호자 질문 답변, Agent 아님)</text>
  <rect x="1302" y="340" width="556" height="430" rx="12" fill="#fff" stroke="#a855f7"/>
  <text class="h2" x="1324" y="372" fill="#7e22ce">질문 → 질의 재작성 → KB 검색 → Bridge 필터 → 요약 답변</text>
  <text class="t" x="1324" y="402">RAG 문서 참조 (S3): kb-summaries/{childId}/{date}-{kind}.md</text>
  <text class="t" x="1324" y="428">kind 5종: memory / emotion / mission / timeline / interests</text>
  <text class="s" x="1324" y="456">생성: ai/kb/index-summaries.ts</text>
  <text class="s" x="1324" y="480">검색: ai/rag/guardian-rag.ts + ai/kb/retrieve.ts</text>
  <text class="s" x="1324" y="504">필터: ai/bridge/privacy-filter.ts (원문·좌표 차단)</text>
  <text class="t" x="1324" y="538">+ 라이브 집계(기분/모험/메모리요약)를 함께 넣어 최종 답변 생성</text>
  <rect x="1780" y="350" width="72" height="24" rx="8" fill="#7e22ce"/><text class="tag" x="1804" y="366">RAG</text>
  <rect x="1322" y="566" width="520" height="70" rx="10" fill="#fef2f2" stroke="#dc2626"/>
  <text class="h2" x="1340" y="594" fill="#b91c1c">항상 차단</text>
  <text class="t" x="1340" y="618">채팅 원문 · 일기 원문 · GPS · 타 아동 KB 문서</text>

  <!-- Cross arrows -->
  <path class="ln" d="M 634 410 L 664 410"/>
  <path class="ln" d="M 1254 520 L 1284 520"/>

  <!-- Summary -->
  <rect x="44" y="818" width="1832" height="216" rx="14" fill="#f8fafc" stroke="#cbd5e1"/>
  <text class="h1" x="64" y="854">발표용 한 줄</text>
  <text class="t" x="64" y="882">입원 중 아이는 LLM 친구와 상호작용하고, 새벽에는 Agent가 다음 날 미션을 계획하며, 보호자는 RAG가 요약 문서(5종)와 라이브 집계를 바탕으로 만든 답변만 받습니다.</text>
  <text class="s" x="64" y="910">즉, 경험은 풍부하게 제공하고, 보호자 전달은 프라이버시를 지키는 요약 경로로 제한합니다.</text>
</svg>
`;

fs.writeFileSync(svgPath, svg, "utf8");

sharp(svgPath, { density: 144 })
  .png()
  .toFile(pngPath)
  .then((info) => {
    console.log("ok", pngPath, `${info.width}x${info.height}`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
