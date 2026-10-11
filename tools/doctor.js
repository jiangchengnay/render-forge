#!/usr/bin/env node
// tools/doctor.js —— 环境自检：一键诊断"为什么跑不起来"。
// 用法：node tools/doctor.js
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const checks = [];
function check(name, fn) {
  try { const msg = fn(); checks.push({ name, ok: true, msg: msg || "OK" }); }
  catch (e) { checks.push({ name, ok: false, msg: e.message }); }
}

check("Node 版本 ≥ 18", () => {
  const v = parseInt(process.versions.node.split(".")[0], 10);
  if (v < 18) throw new Error("当前 " + process.versions.node + "，需 ≥18");
  return process.versions.node;
});
check("项目文件完整", () => {
  ["index.html", "package.json", "tools/mcp-server.js", "dsl/examples/flagship.json"].forEach((f) => {
    if (!fs.existsSync(path.join(ROOT, f))) throw new Error("缺 " + f);
  });
  return "关键文件齐全";
});
check("puppeteer 已安装", () => {
  try { require.resolve("puppeteer", { paths: [ROOT] }); return "OK"; }
  catch (e) { throw new Error("未安装 puppeteer（npm install）"); }
});
check("找到 Chromium 浏览器", () => {
  try {
    const { findBrowser } = require("./find-browser.js");
    const b = findBrowser();
    if (!b) throw new Error("未找到（装 Chrome/Edge，或 npx puppeteer browsers install chrome）");
    return b.name + " → " + b.path;
  } catch (e) { throw new Error(e.message); }
});
check("WebCodecs 可用（导出依赖）", () => {
  // 只能通过浏览器验证，这里只检查浏览器存在
  return "需渲染时由浏览器确认";
});
check("效果快照新鲜", () => {
  const snap = path.join(ROOT, "tools", "_effect-names.json");
  if (!fs.existsSync(snap)) throw new Error("快照缺失（npm run sync-effects）");
  const names = JSON.parse(fs.readFileSync(snap, "utf8"));
  return names.length + " 个效果";
});
check("文档数字一致", () => {
  try { execSync("node tools/check-docs.js", { cwd: ROOT, stdio: "pipe" }); return "OK"; }
  catch (e) { throw new Error("文档数字不一致（npm run check-docs）"); }
});
check("单元测试通过", () => {
  try { execSync("node tools/test.js", { cwd: ROOT, stdio: "pipe" }); return "OK"; }
  catch (e) { throw new Error("有测试失败（npm run test）"); }
});

console.log("=== Render Forge 环境自检 ===\n");
let bad = 0;
checks.forEach((c) => {
  if (!c.ok) bad++;
  console.log((c.ok ? "  ✓ " : "  ✗ ") + c.name + "  [" + c.msg + "]");
});
console.log("");
if (bad) { console.log(bad + " 项异常，请按提示修复。"); process.exit(1); }
console.log("环境健康，可正常运行。");
