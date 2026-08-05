// docs/*.svg → PNG 렌더 (sharp 사용)
const sharp = require("sharp");
const path = require("path");

const names = ["aws-architecture", "feature-architecture"];

async function main() {
  for (const name of names) {
    const src = path.join(__dirname, "..", "docs", `${name}.svg`);
    const out = path.join(__dirname, "..", "docs", `${name}.png`);
    const info = await sharp(src, { density: 144 }).png().toFile(out);
    console.log("ok", `${name}.png`, `${info.width}x${info.height}`);
  }
}

main().catch((err) => {
  console.error("fail", err.message);
  process.exit(1);
});
