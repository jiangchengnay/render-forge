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

// 额外：prompts/*.md 里提到的 tools/*.js 也必须存在
const pdir = path.join(ROOT, "prompts");
if (fs.existsSync(pdir)) {
  let pbad = 0;
  fs.readdirSync(pdir).filter((f) => f.endsWith(".md")).forEach((f) => {
    const t = fs.readFileSync(path.join(pdir, f), "utf8");
    const re2 = /tools\/([a-z0-9-]+\.js)/gi; let m2;
    while ((m2 = re2.exec(t)) !== null) { if (!tools.has(m2[1])) { pbad++; console.log("✗ prompts/" + f + " 引用不存在的: tools/" + m2[1]); } }
  });
  if (pbad) { console.log("\n" + pbad + " 处 prompts 无效引用"); process.exit(1); }
  console.log("✓ prompts 提到的工具全部存在");
}

// 额外：效果示例覆盖率（信息性提示，不 fail）
try {
  const names2 = JSON.parse(fs.readFileSync(path.join(ROOT, "tools", "_effect-names.json"), "utf8"));
  const used = new Set();
  const edir = path.join(ROOT, "dsl", "examples");
  const scan = (dir) => {
    fs.readdirSync(dir).forEach((f) => {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) { scan(p); return; }
      if (!f.endsWith(".json")) return;
      const t = fs.readFileSync(p, "utf8");
      names2.forEach((n) => { if (t.indexOf('"' + n + '"') >= 0) used.add(n); });
    });
  };
  scan(edir);
  const unused = names2.filter((n) => !used.has(n));
  console.log("ℹ 效果示例覆盖率: " + used.size + "/" + names2.length + (unused.length ? "（未覆盖: " + unused.join(", ") + "）" : ""));
} catch (e) {}

// 额外：示例里的 effect 名必须都在效果清单里
try {
  const names3 = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, "tools", "_effect-names.json"), "utf8")));
  const postfx3 = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, "tools", "_postfx-names.json"), "utf8")));
  let exbad = 0;
  const exscan = (dir) => {
    fs.readdirSync(dir).forEach((f) => {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) { exscan(p); return; }
      if (!f.endsWith(".json")) return;
      const t = fs.readFileSync(p, "utf8");
      const re3 = /"effect"\s*:\s*"([^"]+)"/g; let m3;
      while ((m3 = re3.exec(t)) !== null) {
        if (!names3.has(m3[1]) && !postfx3.has(m3[1])) { exbad++; console.log("✗ " + p + " 引用未知效果: " + m3[1]); }
      }
    });
  };
  exscan(path.join(ROOT, "dsl", "examples"));
  if (exbad) { console.log("\n" + exbad + " 处示例引用未知效果"); process.exit(1); }
  console.log("✓ 示例的效果名全部有效");
} catch (e) {}

// 额外：文档里的文件引用（tools/dsl/engine/prompts/*.js|md）必须存在
try {
  const mds = ["README.md", "USAGE.md", "ARCHITECTURE.md", "WORKFLOW.md", "OVERVIEW.md", "HEALTH.md",
    "CUCKOO-INTEGRATION.md", "ITERATIONS.md", "dsl/AI-GUIDE.md", "dsl/CONTEXT-GUIDE.md",
    "dsl/ANALYSIS-GUIDE.md", "dsl/ORCHESTRATION-GUIDE.md", "dsl/SCHEMA-BRIEF.md", "dsl/EFFECTS.md"];
  const reL = /(?:^|[\s(\`])((?:tools|dsl|engine|prompts|vendor)\/[a-zA-Z0-9_\-./]+\.(?:js|md|mjs))(?![a-zA-Z0-9])/g;
  let lbad = 0, lchecked = 0;
  mds.forEach((md) => {
    const p = path.join(ROOT, md);
    if (!fs.existsSync(p)) return;
    const t = fs.readFileSync(p, "utf8");
    let m; const seen = new Set();
    while ((m = reL.exec(t)) !== null) {
      const ref = m[1];
      if (seen.has(ref)) continue; seen.add(ref);
      if (ref.indexOf("xxx") >= 0) continue;
      lchecked++;
      if (!fs.existsSync(path.join(ROOT, ref))) { lbad++; console.log("✗ " + md + " 引用不存在: " + ref); }
    }
  });
  if (lbad) { console.log("\n" + lbad + " 处文档死链"); process.exit(1); }
  console.log("✓ 文档文件引用无死链 (" + lchecked + " 处)");
} catch (e) {}

// 额外：.cuckoo/agents/*.md 引用的文件必须存在
try {
  const adir = path.join(ROOT, ".cuckoo", "agents");
  if (fs.existsSync(adir)) {
    const reA = /(prompts\/[a-z0-9-]+\.md|dsl\/[A-Za-z0-9-]+\.md|dsl\/schemas\/[a-z-]+\.schema\.md|tools\/[a-z0-9-]+\.js)/g;
    let abad = 0, achecked = 0;
    fs.readdirSync(adir).filter((f) => f.endsWith(".md")).forEach((f) => {
      const t = fs.readFileSync(path.join(adir, f), "utf8");
      let m; const seen = new Set();
      while ((m = reA.exec(t)) !== null) {
        if (seen.has(m[1])) continue; seen.add(m[1]); achecked++;
        if (!fs.existsSync(path.join(ROOT, m[1]))) { abad++; console.log("✗ agents/" + f + " 引用不存在: " + m[1]); }
      }
    });
    if (abad) { console.log("\n" + abad + " 处 agents 死链"); process.exit(1); }
    console.log("✓ agents 引用的文件都存在 (" + achecked + " 处)");
  }
} catch (e) {}
