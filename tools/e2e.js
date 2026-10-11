#!/usr/bin/env node
// tools/e2e.js —— 端到端集成验证：把 L0→L4 的工具链串起来跑一遍，验证每步产物能被下一步接受。
//
// 用法：node tools/e2e.js [--render]（--render 额外验证出片）
//
// 说明：L0/L2/L3 的"语义判断"需外部 LLM，无法纯脚本生成；
// 本脚本用 dsl/examples 下的预置产物串起工具链，验证【工具之间的数据衔接】无误。
// 这是"整条链能连"的可复现证明，也是回归测试。

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "output", "e2e");
const results = [];
let failed = 0;

function step(name, fn) {
  try {
    const msg = fn();
    results.push({ name, ok: true, msg: msg || "" });
  } catch (e) {
    failed++;
    results.push({ name, ok: false, msg: e.message });
  }
}
function run(cmd, args) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8" });
}
function mustExist(p, label) {
  if (!fs.existsSync(path.resolve(ROOT, p))) throw new Error(label + " 不存在: " + p);
  return true;
}

fs.mkdirSync(OUT, { recursive: true });

const DEMO = "dsl/examples";
const L0 = DEMO + "/l0-demo";
const L1 = DEMO + "/analysis-demo";
const ORCH = DEMO + "/orchestration-demo";

// L0：校验创作宪法
step("L0 校验创作宪法", () => {
  const o = run("node", ["tools/validate-constitution.js", L0 + "/constitution.json"]);
  if (o.indexOf("通过") < 0) throw new Error("宪法未通过");
  return "✓";
});

// L0：冲突处理分支（无冲突）
step("L0 冲突处理（无冲突→proceed）", () => {
  const tmp = path.join(OUT, "nc.json");
  fs.writeFileSync(tmp, JSON.stringify({ has_conflict: false, items: [] }));
  const out = path.join(OUT, "nc-res.json");
  run("node", ["tools/resolve-conflict.js", "--conflict=" + tmp, "--out=" + out]);
  const j = JSON.parse(fs.readFileSync(out, "utf8"));
  if (j.action !== "proceed") throw new Error("期望 proceed，得到 " + j.action);
  return "action=proceed";
});

// L1：构建 dossier（含宪法）
step("L1 analyze → dossier", () => {
  const out = path.join(OUT, "dossier.json");
  run("node", ["tools/analyze.js", "--audio=" + L1 + "/demo.wav", "--lyrics=" + L1 + "/lyrics.txt", "--constitution=" + L0 + "/constitution.json", "--out=" + out]);
  const d = JSON.parse(fs.readFileSync(out, "utf8"));
  if (!d.constitution) throw new Error("dossier 未含 constitution 段");
  return "dossier 含宪法";
});

// L1：校验解读报告
step("L1 校验解读报告", () => {
  const o = run("node", ["tools/validate-interpretation.js", L1 + "/report.json"]);
  if (o.indexOf("通过") < 0) throw new Error("报告未通过");
  return "✓";
});

// L2：构建计划输入（用 dossier 补全 timeline）
step("L2 build-plan-input（含 dossier）", () => {
  const out = path.join(OUT, "plan-input.json");
  run("node", ["tools/build-plan-input.js", "--report=" + L1 + "/report.json", "--constitution=" + L0 + "/constitution.json", "--dossier=" + path.join(OUT, "dossier.json"), "--out=" + out]);
  const p = JSON.parse(fs.readFileSync(out, "utf8"));
  if (p.meta.timeline_source !== "dossier+report") throw new Error("timeline 未用 dossier 补全");
  return "timeline_source=dossier+report";
});

// L2：校验计划
step("L2 校验任务清单", () => {
  const o = run("node", ["tools/validate-plan.js", ORCH + "/plan.json"]);
  if (o.indexOf("通过") < 0) throw new Error("计划未通过");
  return "✓";
});

// L3：生成 worker 输入包
step("L3 assign-task → worker 输入", () => {
  const out = path.join(OUT, "worker-s1.json");
  run("node", ["tools/assign-task.js", "--plan=" + ORCH + "/plan.json", "--task=s1", "--out=" + out]);
  const w = JSON.parse(fs.readFileSync(out, "utf8"));
  if (!w.task) throw new Error("worker 包无 task");
  return "task=" + w.task.id;
});

// L3：校验片段
step("L3 校验片段", () => {
  const o = run("node", ["tools/validate-fragment.js", ORCH + "/fragments/s1.json", "--plan=" + ORCH + "/plan.json"]);
  if (o.indexOf("通过") < 0 && o.indexOf("✓") < 0) throw new Error("片段未通过: " + o.slice(0, 100));
  return "✓";
});

// L4：组装
step("L4 assemble → storyboard", () => {
  const out = path.join(OUT, "storyboard.json");
  run("node", ["tools/assemble.js", "--plan=" + ORCH + "/plan.json", "--fragments=" + ORCH + "/fragments/", "--out=" + out]);
  mustExist("output/e2e/storyboard.json", "组装结果");
  return "✓";
});

// L4：校验最终分镜
step("L4 校验最终分镜", () => {
  const o = run("node", ["tools/validate.js", "output/e2e/storyboard.json"]);
  if (o.indexOf("通过") < 0) throw new Error("分镜未通过");
  return "✓";
});

// 可选：出片
if (process.argv.indexOf("--render") >= 0) {
  step("渲染出片", () => {
    const out = path.join(OUT, "e2e.mp4");
    run("node", ["tools/export-webcodecs.js", "output/e2e/storyboard.json", out, "--fps=30"]);
    const b = fs.readFileSync(out);
    if (b.slice(4, 8).toString("latin1") !== "ftyp") throw new Error("非合法 mp4");
    return Math.round(b.length / 1024) + "KB mp4";
  });
}

// 报告
console.log("=== 端到端集成验证 ===");
results.forEach((r) => console.log((r.ok ? "  ✓ " : "  ✗ ") + r.name + (r.msg ? "  [" + r.msg + "]" : "")));
console.log("");
console.log(failed === 0 ? "全部通过 (" + results.length + " 步)" : failed + " 步失败 / 共 " + results.length + " 步");
process.exit(failed ? 1 : 0);
