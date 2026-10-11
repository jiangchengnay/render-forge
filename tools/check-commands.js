#!/usr/bin/env node
// tools/check-commands.js —— 校验文档里提到的 node tools/*.js 是否真实存在。
// 防止文档提到不存在的工具（误导用户/AI）。用法：node tools/check-commands.js
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const tools = new Set(fs.readdirSync(path.join(ROOT, "tools")).filter((f) => f.endsWith(".js")));
const docs = ["README.md", "USAGE.md", "ARCHITECTURE.md", "WORKFLOW.md",
  "dsl/AI-GUIDE.md", "dsl/CONTEXT-GUIDE.md", "dsl/ANALYSIS-GUIDE.md", "dsl/ORCHESTRATION-GUIDE.md"];
const seen = new Map();
docs.forEach((d) => {
  const p = path.join(ROOT, d);
  if (!fs.existsSync(p)) return;
  const t = fs.readFileSync(p, "utf8");
  const re = /node\s+tools\/([a-z0-9-]+\.js)/gi;
  let m;
  while ((m = re.exec(t)) !== null) { const f = m[1]; if (!seen.has(f)) seen.set(f, []); seen.get(f).push(d); }
});
let missing = 0;
[...seen.keys()].sort().forEach((f) => {
  if (!tools.has(f)) { missing++; console.log("✗ 文档提到不存在的工具: tools/" + f + "  ← " + [...new Set(seen.get(f))].join(", ")); }
});
if (missing) { console.log("\n" + missing + " 个文档命令无效"); process.exit(1); }
console.log("✓ 文档提到的所有工具都存在 (" + seen.size + " 个)");

// 额外：EFFECTS.md 是否含全部效果（防 stale）
const ef = path.join(ROOT, "dsl", "EFFECTS.md");
if (fs.existsSync(ef)) {
  const names = JSON.parse(fs.readFileSync(path.join(ROOT, "tools", "_effect-names.json"), "utf8"));
  const eff = fs.readFileSync(ef, "utf8");
  const miss = names.filter((n) => eff.indexOf(n) < 0);
  if (miss.length) { console.log("✗ EFFECTS.md 缺 " + miss.length + " 个效果: " + miss.join(", ")); process.exit(1); }
  console.log("✓ EFFECTS.md 含全部 " + names.length + " 个效果");
}
