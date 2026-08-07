const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const svgPath = path.join(root, "docs", "architecture", "structure-simple-final.svg");
const pngPath = path.join(root, "docs", "architecture", "structure-simple-final.png");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, Segoe UI, sans-serif">
  <defs>
    <marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/></marker>
    <style>
      .title { font-size: 34px; font-weight: 700; fill: #0f172a; }
      .sub { font-size: 15px; fill: #475569; }
      .h1 { font-size: 18px; font-weight: 700; fill: #0f172a; }
      .h2 { font-size: 15px; font-weight: 700; fill: #0f172a; }
      .t { font-size: 13px; fill: #334155; }
      .s { font-size: 11.5px; fill: #64748b; }
      .ln { fill: none; stroke: #475569; stroke-width: 2.3; marker-end: url(#a); }
      .dln { fill: none; stroke: #b91c1c; stroke-width: 2.1; stroke-dasharray: 7 4; marker-end: url(#a); }
      .tag { font-size: 11px; font-weight: 700; fill: #fff; }
    </style>
  </defs>

  <rect width="1920" height="1080" fill="#ffffff"/>
  <text class="title" x="44" y="56">Beddy 구조 요약 (최종 간단판)</text>
  <text class="sub" x="44" y="84">로그인 분기 → 환아 경로 / 보호자 경로 + 새벽 배치 + LLM/Agent/RAG 역할 분리</text>

  <!-- Login -->
  <rect x="70" y="430" width="220" height="140" rx="12" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>
  <text class="h1" x="105" y="488">로그인</text>
  <text class="t" x="92" y="516">(환아 / 보호자)</text>

  <!-- Child lane -->
  <rect x="350" y="120" width="650" height="430" rx="16" fill="#f0f9ff" stroke="#0284c7" stroke-width="2.2"/>
  <text class="h1" x="372" y="152">환아 경로</text>

  <rect x="372" y="176" width="606" height="110" rx="12" fill="#fff" stroke="#0284c7"/>
  <text class="h2" x="394" y="208" fill="#0369a1">환아 UI</text>
  <text class="t" x="394" y="234">채팅 + 정원/소원/이야기책/모험 수행 + 일정/미디어</text>
  <text class="s" x="394" y="258">상태 저장: DynamoDB / 미디어: S3</text>

  <rect x="372" y="308" width="292" height="96" rx="12" fill="#fff" stroke="#0284c7"/>
  <text class="h2" x="394" y="340" fill="#0369a1">LLM 채팅</text>
  <text class="t" x="394" y="364">Guardrail + Haiku SSE</text>
  <rect x="594" y="318" width="62" height="24" rx="8" fill="#0369a1"/><text class="tag" x="615" y="334">LLM</text>

  <rect x="686" y="308" width="292" height="96" rx="12" fill="#fff7ed" stroke="#ea580c"/>
  <text class="h2" x="708" y="340" fill="#c2410c">미션 Agent</text>
  <text class="t" x="708" y="364">필요 시 실행 (항상 X)</text>
  <text class="s" x="708" y="386">tool-use 계획 후 미션 생성</text>
  <rect x="908" y="318" width="70" height="24" rx="8" fill="#c2410c"/><text class="tag" x="923" y="334">AGENT</text>

  <rect x="372" y="424" width="606" height="96" rx="12" fill="#fef2f2" stroke="#dc2626"/>
  <text class="h2" x="394" y="456" fill="#b91c1c">프라이버시</text>
  <text class="t" x="394" y="480">채팅 원문은 보호자에 직접 전달되지 않음</text>

  <!-- Parent lane -->
  <rect x="1040" y="120" width="810" height="430" rx="16" fill="#faf5ff" stroke="#9333ea" stroke-width="2.2"/>
  <text class="h1" x="1062" y="152">보호자 경로</text>

  <rect x="1062" y="176" width="766" height="110" rx="12" fill="#fff" stroke="#a855f7"/>
  <text class="h2" x="1084" y="208" fill="#7e22ce">보호자 UI</text>
  <text class="t" x="1084" y="234">홈/일정/기록/편지 + 질문(리포트)</text>
  <text class="s" x="1084" y="258">privacy 토글 적용, hidePrivateChat=true</text>

  <rect x="1062" y="308" width="766" height="158" rx="12" fill="#fff" stroke="#7e22ce" stroke-width="2"/>
  <text class="h2" x="1084" y="340" fill="#7e22ce">RAG 질문 응답 (Agent 아님)</text>
  <text class="t" x="1084" y="366">질문 → query rewrite → KB retrieve → Bridge filter → 요약 답변</text>
  <text class="s" x="1084" y="390">참조: kb-summaries/{childId}/{date}-{memory|emotion|mission|timeline|interests}.md</text>
  <text class="s" x="1084" y="414">+ 라이브 집계(기분/모험/메모리요약)</text>
  <rect x="1758" y="318" width="62" height="24" rx="8" fill="#7e22ce"/><text class="tag" x="1779" y="334">RAG</text>

  <rect x="1062" y="482" width="766" height="38" rx="8" fill="#fef2f2" stroke="#dc2626"/>
  <text class="t" x="1084" y="506" fill="#b91c1c">차단: 채팅 원문 · 일기 원문 · GPS · 타 아동 데이터</text>

  <!-- Batch lane -->
  <rect x="350" y="590" width="1500" height="340" rx="16" fill="#fff7ed" stroke="#c2410c" stroke-width="2.2"/>
  <text class="h1" x="372" y="622">새벽 배치 (EventBridge 05:00)</text>
  <text class="s" x="372" y="646">/api/cron/daily 트리거</text>

  <rect x="372" y="666" width="300" height="90" rx="12" fill="#fff" stroke="#ea580c"/>
  <text class="h2" x="394" y="698" fill="#c2410c">1) 데이터 정리</text>
  <text class="t" x="394" y="722">memory/emotion/story</text>

  <rect x="700" y="666" width="300" height="90" rx="12" fill="#fff" stroke="#ea580c"/>
  <text class="h2" x="722" y="698" fill="#c2410c">2) mission Agent 실행</text>
  <text class="t" x="722" y="722">다음날 모험 준비</text>

  <rect x="1028" y="666" width="300" height="90" rx="12" fill="#fff" stroke="#ea580c"/>
  <text class="h2" x="1050" y="698" fill="#c2410c">3) 보호자 메시지 준비</text>
  <text class="t" x="1050" y="722">홈 요약/공감 가이드</text>

  <rect x="1356" y="666" width="472" height="90" rx="12" fill="#ecfeff" stroke="#0e7490"/>
  <text class="h2" x="1378" y="698" fill="#0e7490">4) KB 요약 문서 생성</text>
  <text class="t" x="1378" y="722">memory/emotion/mission/timeline/interests</text>

  <path class="ln" d="M 672 711 L 700 711"/>
  <path class="ln" d="M 1000 711 L 1028 711"/>
  <path class="ln" d="M 1328 711 L 1356 711"/>

  <rect x="372" y="778" width="1456" height="128" rx="12" fill="#fff" stroke="#94a3b8"/>
  <text class="h2" x="394" y="812">결과</text>
  <text class="t" x="394" y="836">아이: 미션팩 생성 / 보호자: 요약 카드 + 질문 답변</text>
  <text class="t" x="394" y="860">LLM은 실시간 채팅, Agent는 미션 준비 시, RAG는 보호자 질문 시 동작</text>

  <!-- arrows from login -->
  <path class="ln" d="M 290 470 L 350 250"/>
  <path class="ln" d="M 290 500 L 350 340"/>
  <path class="ln" d="M 290 530 L 1040 250"/>

  <!-- cross links -->
  <path class="ln" d="M 1000 356 L 1040 356"/>
  <path class="ln" d="M 1660 756 L 1660 308"/>
  <path class="ln" d="M 820 756 L 820 308"/>
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
