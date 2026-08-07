const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const iconDir = path.join(root, "docs", "images", "aws-icons");
const svgPath = path.join(root, "docs", "architecture", "pipeline-user-to-discharge.svg");
const pngPath = path.join(root, "docs", "architecture", "pipeline-user-to-discharge.png");

function b64(name) {
  const buf = fs.readFileSync(path.join(iconDir, name));
  return `data:image/png;base64,${buf.toString("base64")}`;
}

const I = {
  alb: b64("alb.png"),
  ecs: b64("ecs.png"),
  ddb: b64("dynamodb.png"),
  s3: b64("s3.png"),
  bedrock: b64("bedrock.png"),
  eb: b64("eventbridge.png"),
};

function icon(href, x, y, s = 64) {
  return `<image href="${href}" x="${x}" y="${y}" width="${s}" height="${s}" />`;
}

function sq(x, y, size, stroke, fill = "#fff", sw = 2) {
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" filter="url(#sh)"/>`;
}

function aws1(href, x, y, size = S, iconS = 68) {
  const ix = x + Math.round((size - iconS) / 2);
  const iy = y + 14;
  return icon(href, ix, iy, iconS);
}

function aws2(hrefA, hrefB, x, y, size = S, iconS = 56) {
  const gap = 8;
  const total = iconS * 2 + gap;
  const ix = x + Math.round((size - total) / 2);
  const iy = y + 16;
  return `${icon(hrefA, ix, iy, iconS)}${icon(hrefB, ix + iconS + gap, iy, iconS)}`;
}

function tx(x, y, size, className, text, dy, fill) {
  const cx = x + size / 2;
  const f = fill ? ` fill="${fill}"` : "";
  return `<text class="${className}" x="${cx}" y="${y + dy}" text-anchor="middle"${f}>${text}</text>`;
}

const S = 140;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, Segoe UI, sans-serif">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#64748b"/></marker>
    <marker id="arrB" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#2563eb"/></marker>
    <marker id="arrP" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#7e22ce"/></marker>
    <marker id="arrO" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#c2410c"/></marker>
    <marker id="arrG" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#16a34a"/></marker>
    <filter id="sh" x="-12%" y="-12%" width="124%" height="124%"><feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#0f172a" flood-opacity="0.07"/></filter>
    <style>
      .title { font-size: 28px; font-weight: 800; fill: #0f172a; }
      .sub { font-size: 13px; fill: #64748b; }
      .lane { font-size: 13px; font-weight: 800; }
      .h { font-size: 13px; font-weight: 800; fill: #0f172a; }
      .t { font-size: 11px; fill: #475569; }
      .s { font-size: 10px; fill: #64748b; }
      .tag { font-size: 10px; font-weight: 800; fill: #fff; }
      .pipe { fill: none; stroke: #64748b; stroke-width: 2.4; marker-end: url(#arr); }
      .pipeB { fill: none; stroke: #2563eb; stroke-width: 2.4; marker-end: url(#arrB); }
      .pipeP { fill: none; stroke: #7e22ce; stroke-width: 2.4; marker-end: url(#arrP); }
      .pipeO { fill: none; stroke: #c2410c; stroke-width: 2.2; stroke-dasharray: 6 4; marker-end: url(#arrO); }
      .pipeG { fill: none; stroke: #16a34a; stroke-width: 2.2; marker-end: url(#arrG); }
    </style>
  </defs>

  <rect width="1920" height="1080" fill="#ffffff"/>
  <text class="title" x="36" y="40">Beddy ???�작 공유 ??Role 분기 ???�아 / 보호?????�원</text>
  <text class="sub" x="36" y="62">분기??Auth role(child|guardian) · Persona???�아 ?�보?�만 · 보호?�는 ?�이 ?�결 ??RAG</text>

  <rect x="24" y="80" width="220" height="968" rx="16" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>
  <text class="lane" x="134" y="110" text-anchor="middle" fill="#334155">SHARED START</text>

  ${sq(70, 140, S, "#94a3b8")}
  <circle cx="140" cy="186" r="24" fill="#e2e8f0" stroke="#64748b"/>
  <circle cx="140" cy="176" r="8" fill="#64748b"/>
  <ellipse cx="140" cy="200" rx="13" ry="8" fill="#64748b"/>
  ${tx(70, 140, S, "h", "User", 106)}
  ${tx(70, 140, S, "s", "?�아+보호??, 126)}

  ${sq(70, 310, S, "#94a3b8")}
  ${aws2(I.alb, I.ecs, 70, 310)}
  ${tx(70, 310, S, "h", "로그??, 98)}
  ${tx(70, 310, S, "s", "ALB · ECS", 118)}
  ${tx(70, 310, S, "s", "signup/login", 134)}

  ${sq(70, 480, S, "#334155", "#fff", 2.4)}
  ${aws1(I.ddb, 70, 480, S, 72)}
  ${tx(70, 480, S, "h", "Auth Role", 104)}
  ${tx(70, 480, S, "s", "child | guardian", 124)}

  <path class="pipe" d="M140 280 L140 310"/>
  <path class="pipe" d="M140 450 L140 480"/>

  <text class="lane" x="255" y="200" fill="#2563eb">child ??/text>
  <text class="lane" x="250" y="800" fill="#7e22ce">guardian ??/text>
  <path class="pipeB" d="M210 520 C 245 520, 245 200, 280 200"/>
  <path class="pipeP" d="M210 560 C 245 560, 245 820, 280 820"/>
  <text class="s" x="230" y="490" text-anchor="middle" fill="#64748b">middleware</text>
  <text class="s" x="230" y="506" text-anchor="middle" fill="#64748b">role 분기</text>

  <rect x="280" y="80" width="1100" height="230" rx="16" fill="#eff6ff" stroke="#2563eb" stroke-width="2.2"/>
  <text class="lane" x="300" y="108" fill="#1d4ed8">CHILD · ?�아 (Persona ?�보???????�상)</text>
  <rect x="1290" y="90" width="44" height="18" rx="5" fill="#1d4ed8"/><text class="tag" x="1312" y="103" text-anchor="middle">LLM</text>

  ${sq(300, 128, S, "#2563eb", "#dbeafe", 2.4)}
  ${aws1(I.ddb, 300, 128, S, 68)}
  ${tx(300, 128, S, "h", "Persona", 100)}
  ${tx(300, 128, S, "s", "캐릭?�·닉?�임", 120)}

  ${sq(468, 128, S, "#3b82f6")}
  ${tx(468, 128, S, "h", "?�아 UI", 58)}
  ${tx(468, 128, S, "s", "채팅·?�원·모험", 84)}

  ${sq(636, 128, S, "#2563eb", "#fff", 2.4)}
  ${aws1(I.bedrock, 636, 128, S, 72)}
  <rect x="664" y="206" width="84" height="16" rx="4" fill="#1d4ed8"/><text class="tag" x="706" y="218" text-anchor="middle">LLM</text>
  ${tx(636, 128, S, "h", "?�시�?채팅", 110)}
  ${tx(636, 128, S, "s", "Haiku+Guard", 128)}

  ${sq(804, 128, S, "#3b82f6")}
  ${aws2(I.ddb, I.s3, 804, 128)}
  ${tx(804, 128, S, "h", "?�태/미디??, 100)}
  ${tx(804, 128, S, "s", "DDB · S3", 120)}

  ${sq(972, 128, S, "#2563eb", "#dbeafe")}
  ${tx(972, 128, S, "h", "미션 ?�행", 58)}
  ${tx(972, 128, S, "s", "packs ?�용", 84)}
  ${tx(972, 128, S, "s", "Agent ????, 104)}

  ${sq(1140, 128, S, "#93c5fd", "#eff6ff", 1.5)}
  ${tx(1140, 128, S, "s", "축적", 58, "#1d4ed8")}
  ${tx(1140, 128, S, "s", "경험 ?�이??, 84)}

  <path class="pipeB" d="M440 198 L468 198"/>
  <path class="pipeB" d="M608 198 L636 198"/>
  <path class="pipeB" d="M776 198 L804 198"/>
  <path class="pipeB" d="M944 198 L972 198"/>
  <path class="pipeB" d="M1112 198 L1140 198"/>

  <rect x="280" y="330" width="1100" height="270" rx="16" fill="#fff7ed" stroke="#ea580c" stroke-width="2.4"/>
  <text class="lane" x="300" y="358" fill="#c2410c">DAWN · ?�벽 배치 (공용 Agent)</text>
  <rect x="1280" y="340" width="52" height="18" rx="5" fill="#c2410c"/><text class="tag" x="1306" y="353" text-anchor="middle">AGENT</text>

  ${sq(300, 384, S, "#ea580c")}
  ${aws1(I.eb, 300, 384, S, 72)}
  ${tx(300, 384, S, "h", "EventBridge", 100)}
  ${tx(300, 384, S, "s", "05:00", 120)}

  ${sq(468, 384, S, "#c2410c", "#fff", 2.4)}
  ${aws2(I.ecs, I.bedrock, 468, 384)}
  ${tx(468, 384, S, "h", "Mission Agent", 100)}
  ${tx(468, 384, S, "s", "tool-use", 120)}

  ${sq(636, 384, S, "#ea580c")}
  ${aws1(I.ddb, 636, 384, S, 72)}
  ${tx(636, 384, S, "h", "packs", 100)}
  ${tx(636, 384, S, "s", "???�아", 120)}

  <g filter="url(#sh)">
    <rect x="804" y="384" width="506" height="140" rx="12" fill="#ffedd5" stroke="#c2410c" stroke-width="2.4"/>
  </g>
  ${icon(I.s3, 1017, 396, 72)}
  <text class="h" x="1057" y="484" text-anchor="middle" fill="#c2410c">KB ?�약 문서 (MD · 5�?</text>
  <text class="t" x="1057" y="504" text-anchor="middle">memory · emotion · mission · timeline · interests</text>
  <text class="s" x="1057" y="520" text-anchor="middle" fill="#b91c1c">?�문·?�기·GPS 미포????보호??RAG</text>

  <path class="pipeO" d="M440 454 L468 454"/>
  <path class="pipeO" d="M608 454 L636 454"/>
  <path class="pipeO" d="M776 454 L804 454"/>

  <path class="pipeB" d="M706 384 L706 310 L1042 310 L1042 268"/>
  <text class="s" x="740" y="300" text-anchor="middle" fill="#2563eb">packs ??/text>
  <path class="pipeP" d="M864 524 L864 700 L520 700"/>
  <text class="s" x="900" y="610" text-anchor="middle" fill="#7e22ce">?�약 MD ??/text>

  <rect x="280" y="624" width="1100" height="424" rx="16" fill="#faf5ff" stroke="#9333ea" stroke-width="2.2"/>
  <text class="lane" x="300" y="652" fill="#7e22ce">PARENT · 보호??(?�이 ?�결 ??RAG · Persona 분기 ?�님)</text>
  <rect x="1296" y="634" width="40" height="18" rx="5" fill="#7e22ce"/><text class="tag" x="1316" y="647" text-anchor="middle">RAG</text>

  ${sq(300, 676, S, "#7e22ce", "#fdf4ff", 2.4)}
  ${aws1(I.ddb, 300, 676, S, 68)}
  ${tx(300, 676, S, "h", "?�이 ?�결", 100)}
  ${tx(300, 676, S, "s", "guardian-link", 120)}

  ${sq(468, 676, S, "#7e22ce", "#fff", 2.4)}
  ${aws1(I.s3, 468, 676, S, 72)}
  ${tx(468, 676, S, "h", "KB MD", 100)}
  ${tx(468, 676, S, "s", "?�약 ?�신", 120)}

  ${sq(636, 676, S, "#9333ea")}
  ${aws1(I.bedrock, 636, 676, S, 72)}
  ${tx(636, 676, S, "h", "Retrieve", 100)}
  ${tx(636, 676, S, "s", "Bedrock", 120)}

  ${sq(804, 676, S, "#9333ea")}
  ${aws1(I.ecs, 804, 676, S, 72)}
  ${tx(804, 676, S, "h", "Bridge+??, 100)}
  ${tx(804, 676, S, "s", "ECS 로직", 120)}

  ${sq(972, 676, S, "#a855f7")}
  ${tx(972, 676, S, "h", "보호??UI", 58)}
  ${tx(972, 676, S, "s", "?�·QnA·?��?", 84)}

  ${sq(1140, 676, S, "#7e22ce", "#fdf4ff", 2.4)}
  ${aws1(I.s3, 1140, 676, S, 68)}
  ${tx(1140, 676, S, "h", "?��? ?�성", 100)}
  ${tx(1140, 676, S, "s", "보내�?준�?, 120)}

  <path class="pipeP" d="M440 746 L468 746"/>
  <path class="pipeP" d="M608 746 L636 746"/>
  <path class="pipeP" d="M776 746 L804 746"/>
  <path class="pipeP" d="M944 746 L972 746"/>
  <path class="pipeP" d="M1112 746 L1140 746"/>

  <text class="t" x="830" y="850" text-anchor="middle">role=guardian ??/guardian · ?�이 ?�결 ???�약�??�람 (?�이 Persona???�시?�으로만 참조)</text>
  <text class="t" x="830" y="876" text-anchor="middle" fill="#7e22ce">질문 ??KB 검????Bridge ?�터 ???�약 · ?�문 채팅·?�기·GPS 차단</text>
  <text class="s" x="830" y="900" text-anchor="middle">?�원 ?? ?�원???�정 ???��? ?�성(보호?��? ?�) ???�송 · ?�어보기 ?�님</text>

  <rect x="1412" y="80" width="476" height="968" rx="16" fill="#f0fdf4" stroke="#16a34a" stroke-width="2.2"/>
  <text class="lane" x="1650" y="110" text-anchor="middle" fill="#15803d">DISCHARGE</text>

  ${sq(1536, 150, 200, "#16a34a", "#ecfdf5", 2.4)}
  <circle cx="1636" cy="210" r="28" fill="#16a34a"/>
  <path d="M1622 210 l12 12 22-24" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
  ${tx(1536, 150, 200, "h", "?�아 ?�어보기", 130, "#15803d")}
  ${tx(1536, 150, 200, "s", "?�원??봉투 ?�픈", 154)}
  ${tx(1536, 150, 200, "s", "?�야기책 ??��", 172)}

  ${sq(1536, 420, 200, "#16a34a", "#fff", 2.4)}
  ${icon(I.s3, 1596, 448, 80)}
  ${tx(1536, 420, 200, "h", "보호??보내�?, 136, "#15803d")}
  ${tx(1536, 420, 200, "s", "?��? ?�송�?, 160)}
  ${tx(1536, 420, 200, "s", "?�어보기 ?�님", 178)}

  <path class="pipeG" d="M1636 420 L1636 350"/>
  <text class="s" x="1636" y="390" text-anchor="middle" fill="#15803d">?�송 ????/text>

  ${sq(1472, 680, S, "#86efac", "#fff")}
  ${tx(1472, 680, S, "h", "???�아", 58)}
  ${tx(1472, 680, S, "s", "Persona?�LLM", 84)}

  ${sq(1640, 680, S, "#fdba74", "#fff")}
  ${tx(1640, 680, S, "h", "?�벽", 58)}
  ${tx(1640, 680, S, "s", "Agent 배치", 84)}

  ${sq(1472, 848, S, "#d8b4fe", "#fff")}
  ${tx(1472, 848, S, "h", "??보호??, 58)}
  ${tx(1472, 848, S, "s", "link?�RAG", 84)}

  ${sq(1640, 848, S, "#86efac", "#fff")}
  ${tx(1640, 848, S, "h", "?�원", 58)}
  ${tx(1640, 848, S, "s", "보내기→?�기", 84)}

  <text class="s" x="1650" y="1010" text-anchor="middle">분기 = Auth role · Persona ??보호??경로</text>

  <path class="pipeB" d="M1380 200 C 1420 200, 1480 220, 1536 230"/>
  <text class="s" x="1410" y="184" text-anchor="middle" fill="#2563eb">?�기</text>
  <path class="pipeG" d="M1380 900 C 1440 900, 1480 530, 1536 520"/>
  <text class="s" x="1400" y="880" text-anchor="middle" fill="#15803d">보내�?/text>
</svg>
`;

fs.writeFileSync(svgPath, svg, "utf8");

sharp(Buffer.from(svg), { density: 144 })
  .png()
  .toFile(pngPath)
  .then((info) => console.log("ok", pngPath, `${info.width}x${info.height}`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
