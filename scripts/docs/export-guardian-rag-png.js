const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const svgPath = path.join(root, "docs", "architecture", "guardian-rag-docs-flow.svg");
const pngPath = path.join(root, "docs", "architecture", "guardian-rag-docs-flow.png");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, Segoe UI, sans-serif">
  <defs>
    <marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#5A6675"/></marker>
    <marker id="at" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#0F766E"/></marker>
    <marker id="ap" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#BE185D"/></marker>
    <marker id="ax" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#BE123C"/></marker>
    <style>
      .bg { fill: #FFFFFF; }
      .title { font-size: 34px; font-weight: 700; fill: #16202E; }
      .sub { font-size: 15px; fill: #5A6675; }
      .lab { font-size: 12px; font-weight: 700; fill: #9BA7B6; letter-spacing: 1px; }
      .h1 { font-size: 17px; font-weight: 700; fill: #16202E; }
      .h2 { font-size: 15px; font-weight: 700; }
      .cs { font-size: 13px; fill: #48546A; }
      .cx { font-size: 12px; fill: #7A8699; }
      .cm { font-size: 12px; fill: #48546A; font-family: Consolas, monospace; }
      .ln { fill: none; stroke-width: 2.4; }
      .lnd { fill: none; stroke-width: 2.2; stroke-dasharray: 7 5; }
      .doc { font-size: 13px; font-weight: 700; fill: #0F766E; }
      .docb { font-size: 11.5px; fill: #5A6675; }
    </style>
  </defs>
  <rect class="bg" width="1920" height="1080"/>
  <text class="title" x="48" y="52">보호자 RAG — 어떤 문서로 답하나</text>
  <text class="sub" x="48" y="82">채팅 원문 없음 · 요약 MD 5종 + Bridge → 보호자 리포트 요약 답변</text>

  <rect x="40" y="120" width="360" height="780" rx="16" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
  <text class="lab" x="60" y="150">1 · 아이 데이터</text>
  <text class="h1" x="60" y="180">DynamoDB / 앱 스토어</text>
  <rect x="60" y="210" width="320" height="72" rx="10" fill="#FFF" stroke="#94A3B8"/>
  <text class="h2" x="78" y="240" fill="#334155">학습 메모리</text>
  <text class="cx" x="78" y="262">어투 · 톤 · 테마 · 영속 사실 (원문 X)</text>
  <rect x="60" y="298" width="320" height="72" rx="10" fill="#FFF" stroke="#94A3B8"/>
  <text class="h2" x="78" y="328" fill="#334155">감정 정원</text>
  <text class="cx" x="78" y="350">최근 14일 꽃 · 기분 라벨</text>
  <rect x="60" y="386" width="320" height="72" rx="10" fill="#FFF" stroke="#94A3B8"/>
  <text class="h2" x="78" y="416" fill="#334155">모험 · 하루 이야기</text>
  <text class="cx" x="78" y="438">퀘스트 제목 · 헤드라인 · 이야기 최대 200자</text>
  <rect x="60" y="474" width="320" height="72" rx="10" fill="#FFF" stroke="#94A3B8"/>
  <text class="h2" x="78" y="504" fill="#334155">타임라인</text>
  <text class="cx" x="78" y="526">이벤트 제목 + 요약 최대 120자</text>
  <rect x="60" y="562" width="320" height="72" rx="10" fill="#FFF" stroke="#94A3B8"/>
  <text class="h2" x="78" y="592" fill="#334155">페르소나 · 소원</text>
  <text class="cx" x="78" y="614">성향 · 소원 텍스트 최대 80자</text>
  <rect x="60" y="680" width="320" height="88" rx="10" fill="#FEF2F2" stroke="#BE123C" stroke-width="2"/>
  <text class="h2" x="78" y="714" fill="#BE123C">채팅 원문 (transcript)</text>
  <text class="cs" x="78" y="738" fill="#9F1239">보호자 / KB로 전달 안 함</text>
  <text class="cx" x="78" y="758" fill="#BE123C">점선 = 차단</text>
  <path class="lnd" d="M 400 724 L 520 724" stroke="#BE123C" marker-end="url(#ax)"/>
  <text x="430" y="710" fill="#BE123C" font-size="18" font-weight="700">X</text>

  <rect x="440" y="120" width="520" height="780" rx="16" fill="#F0FDF4" stroke="#0F766E" stroke-width="2.5"/>
  <text class="lab" x="460" y="150">2 · 새벽 인덱싱 → S3 요약 문서</text>
  <text class="h1" x="460" y="180">kb-summaries/{childId}/</text>
  <text class="cm" x="460" y="204">index-summaries.ts · filterBridgeText</text>
  <rect x="460" y="230" width="480" height="70" rx="10" fill="#FFF" stroke="#0F766E"/>
  <rect x="460" y="230" width="8" height="70" fill="#0F766E"/>
  <text class="doc" x="486" y="258">memory.md</text>
  <text class="docb" x="486" y="280">대화 학습 메모리 요약</text>
  <rect x="460" y="316" width="480" height="70" rx="10" fill="#FFF" stroke="#0F766E"/>
  <rect x="460" y="316" width="8" height="70" fill="#0F766E"/>
  <text class="doc" x="486" y="344">emotion.md</text>
  <text class="docb" x="486" y="366">감정 이력 (날짜 · 기분 라벨)</text>
  <rect x="460" y="402" width="480" height="70" rx="10" fill="#FFF" stroke="#0F766E"/>
  <rect x="460" y="402" width="8" height="70" fill="#0F766E"/>
  <text class="doc" x="486" y="430">mission.md</text>
  <text class="docb" x="486" y="452">미션 제목 · 헤드라인 · 하루 이야기</text>
  <rect x="460" y="488" width="480" height="70" rx="10" fill="#FFF" stroke="#0F766E"/>
  <rect x="460" y="488" width="8" height="70" fill="#0F766E"/>
  <text class="doc" x="486" y="516">timeline.md</text>
  <text class="docb" x="486" y="538">타임라인 하이라이트</text>
  <rect x="460" y="574" width="480" height="70" rx="10" fill="#FFF" stroke="#0F766E"/>
  <rect x="460" y="574" width="8" height="70" fill="#0F766E"/>
  <text class="doc" x="486" y="602">interests.md</text>
  <text class="docb" x="486" y="624">관심사 · 소원 요약</text>
  <rect x="460" y="680" width="480" height="100" rx="12" fill="#CCFBF1" stroke="#0F766E"/>
  <text class="h2" x="482" y="716" fill="#0F766E">Bridge 필터 (쓰기 시)</text>
  <text class="cs" x="482" y="742">원문처럼 보이면 폐기 · GPS/좌표 폐기</text>
  <text class="cs" x="482" y="764">통과해도 본문 최대 800자</text>
  <path class="ln" d="M 380 246 L 440 265" stroke="#5A6675" marker-end="url(#a)"/>
  <path class="ln" d="M 380 334 L 440 351" stroke="#5A6675" marker-end="url(#a)"/>
  <path class="ln" d="M 380 422 L 440 437" stroke="#5A6675" marker-end="url(#a)"/>
  <path class="ln" d="M 380 510 L 440 523" stroke="#5A6675" marker-end="url(#a)"/>
  <path class="ln" d="M 380 598 L 440 609" stroke="#5A6675" marker-end="url(#a)"/>

  <rect x="1000" y="120" width="420" height="780" rx="16" fill="#F5F3FF" stroke="#6B2BE0" stroke-width="2.5"/>
  <text class="lab" x="1020" y="150">3 · 질문 시 RAG 런타임</text>
  <text class="h1" x="1020" y="180">Guardian RAG (Agent 아님)</text>
  <rect x="1020" y="220" width="380" height="90" rx="12" fill="#FFF" stroke="#6B2BE0" stroke-width="2"/>
  <text class="h2" x="1040" y="256" fill="#6B2BE0">1) 보호자 질문</text>
  <text class="cs" x="1040" y="282">parent.service · report</text>
  <path class="ln" d="M 1210 310 L 1210 350" stroke="#6B2BE0" marker-end="url(#a)"/>
  <rect x="1020" y="350" width="380" height="90" rx="12" fill="#FFF" stroke="#6B2BE0" stroke-width="2"/>
  <text class="h2" x="1040" y="386" fill="#6B2BE0">2) 질의 재작성</text>
  <text class="cs" x="1040" y="412">guardian-rag.ts · 질의 2~3개</text>
  <path class="ln" d="M 1210 440 L 1210 480" stroke="#6B2BE0" marker-end="url(#a)"/>
  <rect x="1020" y="480" width="380" height="110" rx="12" fill="#FFF" stroke="#6B2BE0" stroke-width="2"/>
  <text class="h2" x="1040" y="516" fill="#6B2BE0">3) Bedrock Retrieve</text>
  <text class="cs" x="1040" y="542">retrieve.ts · KB 검색</text>
  <text class="cx" x="1040" y="564">owner만: kb-summaries/{childId}/</text>
  <path class="ln" d="M 1210 590 L 1210 630" stroke="#6B2BE0" marker-end="url(#a)"/>
  <rect x="1020" y="630" width="380" height="100" rx="12" fill="#EDE9FE" stroke="#6B2BE0" stroke-width="2"/>
  <text class="h2" x="1040" y="668" fill="#6B2BE0">4) Bridge 필터 + top 5</text>
  <text class="cs" x="1040" y="694">privacy-filter.ts</text>
  <text class="cx" x="1040" y="716">hit 텍스트 → 프롬프트용 조각</text>
  <path class="ln" d="M 1210 730 L 1210 780" stroke="#6B2BE0" marker-end="url(#a)"/>
  <rect x="1020" y="780" width="380" height="90" rx="12" fill="#FFF" stroke="#6B2BE0" stroke-width="2"/>
  <text class="h2" x="1040" y="816" fill="#6B2BE0">5) + 라이브 집계</text>
  <text class="cs" x="1040" y="842">기분 · 메모리요약 · 모험 · 소원</text>
  <path class="ln" d="M 960 520 L 1000 520" stroke="#0F766E" marker-end="url(#at)"/>
  <text class="cx" x="960" y="505" fill="#0F766E">5종 MD</text>

  <rect x="1460" y="120" width="420" height="780" rx="16" fill="#FDF2F8" stroke="#BE185D" stroke-width="2.5"/>
  <text class="lab" x="1480" y="150">4 · 보호자에게 전달</text>
  <text class="h1" x="1480" y="180">원문 문서 X · 요약 답변 O</text>
  <rect x="1480" y="240" width="380" height="200" rx="14" fill="#FFF" stroke="#BE185D" stroke-width="2"/>
  <text class="h2" x="1500" y="280" fill="#BE185D">LLM 요약 답변</text>
  <text class="cs" x="1500" y="312">KB hits + 라이브 집계를</text>
  <text class="cs" x="1500" y="338">프롬프트에 넣고</text>
  <text class="cs" x="1500" y="364">따뜻한 요약 문장으로 생성</text>
  <text class="cx" x="1500" y="400">MD 파일을 그대로 보여주지 않음</text>
  <path class="ln" d="M 1420 825 L 1480 340" stroke="#BE185D" marker-end="url(#ap)"/>
  <rect x="1480" y="480" width="380" height="160" rx="14" fill="#FFF" stroke="#BE185D"/>
  <text class="h2" x="1500" y="520" fill="#9D174D">보호자 리포트 화면</text>
  <text class="cs" x="1500" y="552">답변 텍스트</text>
  <text class="cs" x="1500" y="578">출처 라벨 (감정 이력,</text>
  <text class="cs" x="1500" y="602">학습된 대화 메모리)</text>
  <rect x="1480" y="680" width="380" height="140" rx="14" fill="#FEF2F2" stroke="#BE123C" stroke-width="2"/>
  <text class="h2" x="1500" y="720" fill="#BE123C">절대 안 넘김</text>
  <text class="cs" x="1500" y="752">아이-베디 채팅 로그</text>
  <text class="cs" x="1500" y="778">일기 원문 · GPS/좌표</text>
  <text class="cs" x="1500" y="804">다른 아이 KB 문서</text>

  <text class="cx" x="48" y="940">인덱싱: EventBridge 새벽 배치 → kb-index.job → index-summaries.ts</text>
  <text class="cx" x="48" y="968">런타임: retrieveGuardianContext → LLM 답변 · hidePrivateChat = true</text>
  <text class="cm" x="48" y="1000">docs/architecture/guardian-rag-docs-flow.png 로 열어보세요</text>
  <rect x="48" y="1020" width="18" height="18" rx="3" fill="#F0FDF4" stroke="#0F766E" stroke-width="2"/>
  <text class="cx" x="76" y="1034">요약 문서</text>
  <rect x="180" y="1020" width="18" height="18" rx="3" fill="#F5F3FF" stroke="#6B2BE0" stroke-width="2"/>
  <text class="cx" x="208" y="1034">RAG 검색</text>
  <rect x="320" y="1020" width="18" height="18" rx="3" fill="#FDF2F8" stroke="#BE185D" stroke-width="2"/>
  <text class="cx" x="348" y="1034">보호자 전달</text>
  <rect x="470" y="1020" width="18" height="18" rx="3" fill="#FEF2F2" stroke="#BE123C" stroke-width="2"/>
  <text class="cx" x="498" y="1034">차단</text>
</svg>
`;

fs.writeFileSync(svgPath, svg, "utf8");

sharp(svgPath, { density: 144 })
  .png()
  .toFile(pngPath)
  .then((info) => {
    console.log("wrote", svgPath);
    console.log("wrote", pngPath, info);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
