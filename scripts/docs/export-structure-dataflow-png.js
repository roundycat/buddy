const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const svgPath = path.join(root, "docs", "architecture", "structure-dataflow-final.svg");
const pngPath = path.join(root, "docs", "architecture", "structure-dataflow-final.png");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, Segoe UI, sans-serif">
  <defs>
    <marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/></marker>
    <style>
      .title { font-size: 32px; font-weight: 700; fill: #0f172a; }
      .sub { font-size: 14px; fill: #475569; }
      .h1 { font-size: 17px; font-weight: 700; fill: #0f172a; }
      .h2 { font-size: 14px; font-weight: 700; fill: #0f172a; }
      .t { font-size: 12.5px; fill: #334155; }
      .s { font-size: 11.5px; fill: #64748b; }
      .ln { fill: none; stroke: #475569; stroke-width: 2.2; marker-end: url(#a); }
      .dln { fill: none; stroke: #b91c1c; stroke-width: 2.1; stroke-dasharray: 7 4; marker-end: url(#a); }
      .chip { font-size: 11px; font-weight: 700; fill: #fff; }
      .label { font-size: 11px; fill: #1f2937; }
    </style>
  </defs>

  <rect width="1920" height="1080" fill="#ffffff"/>
  <text class="title" x="40" y="52">구조 + 데이터 전달 상세 (LLM / Agent / RAG)</text>
  <text class="sub" x="40" y="78">무엇이 어디로 전달되는지: 환아 데이터 → 배치 → Agent/RAG → 보호자 답변</text>

  <!-- Left: child -->
  <rect x="40" y="110" width="560" height="520" rx="14" fill="#f0f9ff" stroke="#0284c7" stroke-width="2"/>
  <text class="h1" x="60" y="140">환아 경로</text>

  <rect x="60" y="160" width="520" height="120" rx="10" fill="#fff" stroke="#0284c7"/>
  <text class="h2" x="80" y="190" fill="#0369a1">환아 UI</text>
  <text class="t" x="80" y="214">채팅 / 정원 / 소원 / 이야기책 / 모험 수행 / 일정</text>
  <text class="s" x="80" y="238">저장: 상태(DynamoDB), 미디어(S3)</text>

  <rect x="60" y="296" width="250" height="92" rx="10" fill="#fff" stroke="#0284c7"/>
  <text class="h2" x="78" y="326" fill="#0369a1">LLM 채팅</text>
  <text class="t" x="78" y="350">Guardrail + Haiku SSE</text>
  <rect x="250" y="304" width="52" height="22" rx="7" fill="#0369a1"/><text class="chip" x="267" y="319">LLM</text>

  <rect x="330" y="296" width="250" height="92" rx="10" fill="#fff7ed" stroke="#ea580c"/>
  <text class="h2" x="348" y="326" fill="#c2410c">모험 수행</text>
  <text class="t" x="348" y="350">새벽 준비된 미션 실행</text>

  <rect x="60" y="404" width="520" height="110" rx="10" fill="#fef2f2" stroke="#dc2626"/>
  <text class="h2" x="80" y="434" fill="#b91c1c">직접 전달 금지 데이터</text>
  <text class="t" x="80" y="458">채팅 원문 / 일기 원문 / GPS</text>
  <text class="s" x="80" y="482">보호자 UI로 직접 화살표 없음 (Bridge/요약 경로만 허용)</text>

  <!-- Center: batch + stores -->
  <rect x="640" y="110" width="640" height="920" rx="14" fill="#fff7ed" stroke="#c2410c" stroke-width="2"/>
  <text class="h1" x="660" y="140">새벽 배치 + 데이터 가공</text>

  <rect x="660" y="160" width="300" height="90" rx="10" fill="#fff" stroke="#94a3b8"/>
  <text class="h2" x="678" y="190">DynamoDB</text>
  <text class="s" x="678" y="214">감정/모험/메모리/타임라인</text>

  <rect x="980" y="160" width="280" height="90" rx="10" fill="#fff" stroke="#94a3b8"/>
  <text class="h2" x="998" y="190">S3</text>
  <text class="s" x="998" y="214">미디어 + KB 요약 문서</text>

  <rect x="660" y="274" width="600" height="106" rx="10" fill="#fff" stroke="#ea580c"/>
  <text class="h2" x="678" y="304" fill="#c2410c">EventBridge 05:00 → /api/cron/daily</text>
  <text class="t" x="678" y="328">memory/emotion/story 정리 + mission plan + parent summary 준비</text>
  <text class="s" x="678" y="352">이 단계에서 RAG 문서도 생성됨</text>

  <rect x="660" y="396" width="600" height="180" rx="10" fill="#fff" stroke="#ea580c"/>
  <text class="h2" x="678" y="426" fill="#c2410c">Mission Agent 입력 데이터 (어떻게 고르나)</text>
  <text class="t" x="678" y="450">1) 오늘 컨텍스트: 기분/에너지/일정/최근 상태</text>
  <text class="t" x="678" y="474">2) 도구 참조:</text>
  <text class="t" x="696" y="496">- emotional-guidance.cards.json (정서 가이드)</text>
  <text class="t" x="696" y="518">- 최근 모험 제목(DynamoDB) (중복 방지)</text>
  <text class="t" x="678" y="542">3) submit_mission_plan → generate/validate/repair/fallback</text>
  <rect x="1186" y="404" width="70" height="24" rx="8" fill="#c2410c"/><text class="chip" x="1201" y="420">AGENT</text>

  <rect x="660" y="592" width="600" height="200" rx="10" fill="#ecfeff" stroke="#0e7490"/>
  <text class="h2" x="678" y="622" fill="#0e7490">RAG 문서 생성 (S3 KB Summary)</text>
  <text class="t" x="678" y="646">경로: kb-summaries/{childId}/{date}-{kind}.md</text>
  <text class="t" x="678" y="670">kind: memory / emotion / mission / timeline / interests</text>
  <text class="t" x="678" y="694">생성 파일: ai/kb/index-summaries.ts</text>
  <text class="t" x="678" y="718">필터: ai/bridge/privacy-filter.ts (원문·좌표 차단, 길이 제한)</text>
  <rect x="1186" y="600" width="58" height="24" rx="8" fill="#0e7490"/><text class="chip" x="1205" y="616">RAG</text>

  <rect x="660" y="808" width="600" height="200" rx="10" fill="#fff" stroke="#94a3b8"/>
  <text class="h2" x="678" y="838">배치 산출물</text>
  <text class="t" x="678" y="862">- 아이: 다음날 미션팩</text>
  <text class="t" x="678" y="886">- 보호자 홈: 요약 메시지/공감 가이드</text>
  <text class="t" x="678" y="910">- 보호자 질문용: KB 요약 문서</text>

  <!-- Right: parent -->
  <rect x="1320" y="110" width="560" height="920" rx="14" fill="#faf5ff" stroke="#9333ea" stroke-width="2"/>
  <text class="h1" x="1340" y="140">보호자 경로</text>

  <rect x="1340" y="160" width="520" height="120" rx="10" fill="#fff" stroke="#a855f7"/>
  <text class="h2" x="1360" y="190" fill="#7e22ce">보호자 UI</text>
  <text class="t" x="1360" y="214">홈/일정/기록/편지 + 리포트 질문</text>
  <text class="s" x="1360" y="238">privacy 토글 + hidePrivateChat=true</text>

  <rect x="1340" y="296" width="520" height="300" rx="10" fill="#fff" stroke="#7e22ce" stroke-width="2"/>
  <text class="h2" x="1360" y="326" fill="#7e22ce">RAG 전달 상세</text>
  <text class="t" x="1360" y="350">보호자 질문</text>
  <text class="t" x="1360" y="374">→ guardian-rag.ts (질의 재작성)</text>
  <text class="t" x="1360" y="398">→ retrieve.ts (Bedrock KB 검색)</text>
  <text class="t" x="1360" y="422">→ privacy-filter.ts (원문/좌표 차단)</text>
  <text class="t" x="1360" y="446">→ 라이브 집계(기분/모험/메모리요약) 결합</text>
  <text class="t" x="1360" y="470">→ LLM 요약 답변 생성 후 UI 표시</text>
  <text class="s" x="1360" y="496">즉, 문서 원문을 그대로 주는 게 아니라 요약 답변을 전달</text>
  <rect x="1790" y="304" width="58" height="24" rx="8" fill="#7e22ce"/><text class="chip" x="1809" y="320">RAG</text>

  <rect x="1340" y="612" width="520" height="128" rx="10" fill="#fef2f2" stroke="#dc2626"/>
  <text class="h2" x="1360" y="642" fill="#b91c1c">항상 차단</text>
  <text class="t" x="1360" y="666">채팅 원문 · 일기 원문 · GPS · 타 아동 KB 데이터</text>

  <rect x="1340" y="756" width="520" height="252" rx="10" fill="#fff" stroke="#94a3b8"/>
  <text class="h2" x="1360" y="786">핵심 요약</text>
  <text class="t" x="1360" y="810">1) 환아 정보는 DB/S3에 저장 후 배치에서 가공</text>
  <text class="t" x="1360" y="834">2) Agent는 컨텍스트+가이드카드+최근제목으로 미션 계획</text>
  <text class="t" x="1360" y="858">3) RAG는 5종 KB summary 문서 + 라이브 집계를 기반으로 답변</text>
  <text class="t" x="1360" y="882">4) 보호자는 요약 결과만 받음</text>

  <!-- arrows -->
  <path class="ln" d="M 600 214 L 660 214"/>
  <text class="label" x="606" y="202">환아 상태/행동</text>
  <path class="ln" d="M 600 350 L 660 450"/>
  <text class="label" x="592" y="334">미션 관련 컨텍스트</text>
  <path class="ln" d="M 600 238 L 980 205"/>
  <text class="label" x="742" y="192">미디어/요약 저장</text>

  <path class="ln" d="M 1260 692 L 1320 396"/>
  <text class="label" x="1240" y="382">KB summary</text>
  <path class="ln" d="M 1260 884 L 1320 214"/>
  <text class="label" x="1232" y="232">홈 요약/가이드</text>

  <path class="dln" d="M 580 458 L 1320 658"/>
  <text class="label" x="820" y="612" fill="#b91c1c">직접 전달 금지 경로</text>
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
