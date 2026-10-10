#!/usr/bin/env node
// tools/mcp-server.js
// Render Forge MCP Server —— 把渲染能力与「多 Agent 编排」暴露给任何支持 MCP 的 AI。
//
// 协议：MCP over stdio（JSON-RPC 2.0）
// 启动：node tools/mcp-server.js
//
// 工具分组：
//   基础：rf_list / rf_schema / rf_generate / rf_validate / rf_critique / rf_recommend / rf_apply_patch / rf_render
//   L0 语境与叙事：rf_l0_input / rf_resolve_conflict / rf_validate_constitution
//   L1 分析层：    rf_analyze / rf_validate_interpretation
//   L2 决策层：    rf_build_plan_input / rf_validate_plan
//   L3 执行层：    rf_assign_task / rf_validate_fragment
//   L4 组装层：    rf_assemble

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

const TOOLS = [
  // ===== 基础工具 =====
  { name: "rf_list", description: "列出 Render Forge 的所有效果、后处理、转场、模板、调色板", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "rf_schema", description: "导出分镜 DSL 的完整文档（Markdown）", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "rf_generate", description: "用内置模板生成分镜 JSON（写入文件）", inputSchema: { type: "object", properties: { template: { type: "string" }, slots: { type: "object" }, output: { type: "string" } }, required: ["template", "output"] } },
  { name: "rf_validate", description: "校验分镜 JSON", inputSchema: { type: "object", properties: { input: { type: "string" } }, required: ["input"] } },
  { name: "rf_critique", description: "渲染并生成批评报告（含关键帧指标 + contact sheet）", inputSchema: { type: "object", properties: { input: { type: "string" }, frames: { type: "number" } }, required: ["input"] } },
  { name: "rf_recommend", description: "根据意图/关键词推荐效果（如 粒子爆炸、产品标题）", inputSchema: { type: "object", properties: { intent: { type: "string" }, limit: { type: "number" } }, required: ["intent"] } },
  { name: "rf_apply_patch", description: "把批评报告生成的补丁方案应用到分镜 JSON", inputSchema: { type: "object", properties: { storyboard: { type: "string" }, proposal: { type: "string" }, output: { type: "string" } }, required: ["storyboard", "proposal"] } },
  { name: "rf_render", description: "渲染分镜为视频（WebCodecs 页内编码，无需 ffmpeg）", inputSchema: { type: "object", properties: { input: { type: "string" }, output: { type: "string" }, fps: { type: "number" }, audio: { type: "string" } }, required: ["input", "output"] } },

  // ===== L0 语境与叙事 =====
  { name: "rf_l0_input", description: "L0：准备语境与叙事层的输入包（含自动生成的联网搜索指令）。框架不自己搜，平台负责执行搜索。", inputSchema: { type: "object", properties: { request: { type: "string", description: "用户需求文本" }, audio: { type: "string", description: "可选音频路径" }, lyrics: { type: "string", description: "可选歌词文件" }, output: { type: "string", description: "输出路径（相对项目）" } }, required: ["request"] } },
  { name: "rf_resolve_conflict", description: "L0：冲突处理（确定性分支，对应 ARCHITECTURE §4.3）。无冲突→proceed；有冲突+允许问→ask_user；不许问→深层串联/网络匹配/AI自决/垫底。", inputSchema: { type: "object", properties: { conflict: { type: "string", description: "冲突清单 JSON 路径" }, allowAsk: { type: "boolean", description: "是否允许询问用户（默认 true）" }, output: { type: "string" } }, required: ["conflict"] } },
  { name: "rf_validate_constitution", description: "L0：校验创作宪法（creative constitution）", inputSchema: { type: "object", properties: { input: { type: "string" } }, required: ["input"] } },

  // ===== L1 分析层 =====
  { name: "rf_analyze", description: "L1：构建 dossier（音频+歌词+创作宪法 → 浓缩分析素材包）", inputSchema: { type: "object", properties: { audio: { type: "string" }, lyrics: { type: "string" }, constitution: { type: "string" }, output: { type: "string" } }, required: ["audio"] } },
  { name: "rf_validate_interpretation", description: "L1：校验《解读报告》（会拦截映射里出现效果名等越界）", inputSchema: { type: "object", properties: { input: { type: "string" } }, required: ["input"] } },

  // ===== L2 决策层 =====
  { name: "rf_build_plan_input", description: "L2：准备 Planner 输入包（解读报告 + 创作宪法 → 计划输入）", inputSchema: { type: "object", properties: { report: { type: "string" }, constitution: { type: "string" }, output: { type: "string" } }, required: ["report"] } },
  { name: "rf_validate_plan", description: "L2：校验任务清单（范式/切任务/底线规则）", inputSchema: { type: "object", properties: { input: { type: "string" } }, required: ["input"] } },

  // ===== L3 执行层 =====
  { name: "rf_assign_task", description: "L3：给某个 Worker 准备输入包（只给该 Worker 相关的切片）", inputSchema: { type: "object", properties: { plan: { type: "string" }, task: { type: "string", description: "任务 id，如 s1" }, output: { type: "string" } }, required: ["plan", "task"] } },
  { name: "rf_validate_fragment", description: "L3：校验片段（复用分镜校验，拦截未知效果名）", inputSchema: { type: "object", properties: { input: { type: "string" }, plan: { type: "string" } }, required: ["input"] } },

  // ===== L4 组装层 =====
  { name: "rf_assemble", description: "L4：组装（任务清单 + 片段目录 → 完整分镜 JSON）", inputSchema: { type: "object", properties: { plan: { type: "string" }, fragments: { type: "string", description: "片段目录" }, output: { type: "string" } }, required: ["plan", "fragments"] } },
];

function runArgs(args, opts) {
  return new Promise((resolve) => {
    opts = opts || {};
    let stdout = "", stderr = "";
    let child;
    try {
      child = spawn(args[0], args.slice(1), { cwd: ROOT, shell: false });
    } catch (e) {
      return resolve({ ok: false, output: e.message });
    }
    const timer = setTimeout(() => {
      try { child.kill(); } catch (e) {}
      resolve({ ok: false, output: stdout + stderr + "\n[超时]" });
    }, opts.timeout || 300000);
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, output: e.message }); });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, output: stdout + (stderr ? "\n[stderr]\n" + stderr : "") });
    });
  });
}

// 输出/项目内文件：确保在项目目录内（防越权）
function safePath(p) {
  const abs = path.resolve(ROOT, p || "");
  if (!abs.startsWith(ROOT)) throw new Error("路径越权（输出须在项目内）: " + p);
  return abs;
}
// 只读输入（音频/歌词等用户文件）：允许项目外，仅绝对化
function safeRead(p) {
  return path.resolve(p || "");
}

async function handleTool(name, args) {
  switch (name) {
    case "rf_list": {
      const names = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/_effect-names.json"), "utf8"));
      const postfx = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/_postfx-names.json"), "utf8"));
      const transitions = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/_transitions.json"), "utf8"));
      const palettes = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/_palettes.json"), "utf8"));
      let templates = ["product-launch", "open-source", "music-video", "data-story"];
      try { const tp = path.join(ROOT, "tools", "_templates.json"); if (fs.existsSync(tp)) templates = JSON.parse(fs.readFileSync(tp, "utf8")); } catch (e) {}
      return JSON.stringify({ effects: names, postfx, transitions, palettes, templates }, null, 2);
    }
    case "rf_schema": return fs.readFileSync(path.join(ROOT, "dsl/schemas/storyboard.schema.md"), "utf8");
    case "rf_generate": {
      const spec = { template: args.template, slots: args.slots || {} };
      fs.writeFileSync(safePath(args.output), JSON.stringify(spec, null, 2));
      return "已生成: " + args.output;
    }
    case "rf_validate": return (await runArgs(["node", "tools/validate.js", safePath(args.input)])).output;
    case "rf_critique": return (await runArgs(["node", "tools/critique-cli.js", safePath(args.input), "--frames=" + (args.frames || 8)])).output;
    case "rf_recommend": {
      const tags = { particles: "粒子 爆炸 收拢 涡旋 星点", fbmNoise: "氛围 底纹 流动 烟雾", titleCard: "标题 品牌 产品名", lyricLine: "歌词 MV 高亮", browserFrame: "浏览器 产品演示 界面", terminalWindow: "终端 命令行 开源", counterNumber: "数字 计数 数据", lineChart: "折线图 趋势 增长", dotGrid: "点阵 网格 科技", ripples: "波纹 扩散 冲击波", lissajous: "曲线 数学 优雅" };
      const q = (args.intent || "").toLowerCase();
      const hits = [];
      Object.keys(tags).forEach((k) => { let s = 0; tags[k].split(" ").forEach((t) => { if (q.indexOf(t) >= 0) s += 3; }); if (q.indexOf(k) >= 0) s += 10; if (s > 0) hits.push({ name: k, score: s, tags: tags[k] }); });
      hits.sort((a, b) => b.score - a.score);
      return JSON.stringify(hits.slice(0, args.limit || 5), null, 2);
    }
    case "rf_apply_patch": {
      const a = ["node", "tools/apply-patch.js", safePath(args.storyboard), safePath(args.proposal)];
      if (args.output) a.push("--out=" + safePath(args.output));
      return (await runArgs(a)).output;
    }
    case "rf_render": {
      const a = ["node", "tools/export-webcodecs.js", safePath(args.input), safePath(args.output)];
      if (args.fps) a.push("--fps=" + args.fps);
      if (args.audio) a.push("--audio=" + safeRead(args.audio));
      return (await runArgs(a)).output;
    }

    // ===== L0 =====
    case "rf_l0_input": {
      const a = ["node", "tools/build-l0-input.js", "--request=" + safeRead(args.request)];
      if (args.audio) a.push("--audio=" + safeRead(args.audio));
      if (args.lyrics) a.push("--lyrics=" + safeRead(args.lyrics));
      if (args.output) a.push("--out=" + safePath(args.output));
      return (await runArgs(a)).output;
    }
    case "rf_resolve_conflict": {
      const a = ["node", "tools/resolve-conflict.js", "--conflict=" + safeRead(args.conflict)];
      a.push("--allow-ask=" + (args.allowAsk === false ? "false" : "true"));
      if (args.output) a.push("--out=" + safePath(args.output));
      return (await runArgs(a)).output;
    }
    case "rf_validate_constitution": return (await runArgs(["node", "tools/validate-constitution.js", safeRead(args.input)])).output;

    // ===== L1 =====
    case "rf_analyze": {
      const a = ["node", "tools/analyze.js", "--audio=" + safeRead(args.audio)];
      if (args.lyrics) a.push("--lyrics=" + safeRead(args.lyrics));
      if (args.constitution) a.push("--constitution=" + safeRead(args.constitution));
      if (args.output) a.push("--out=" + safePath(args.output));
      return (await runArgs(a)).output;
    }
    case "rf_validate_interpretation": return (await runArgs(["node", "tools/validate-interpretation.js", safeRead(args.input)])).output;

    // ===== L2 =====
    case "rf_build_plan_input": {
      const a = ["node", "tools/build-plan-input.js", "--report=" + safeRead(args.report)];
      if (args.constitution) a.push("--constitution=" + safeRead(args.constitution));
      if (args.output) a.push("--out=" + safePath(args.output));
      return (await runArgs(a)).output;
    }
    case "rf_validate_plan": return (await runArgs(["node", "tools/validate-plan.js", safeRead(args.input)])).output;

    // ===== L3 =====
    case "rf_assign_task": {
      const a = ["node", "tools/assign-task.js", "--plan=" + safeRead(args.plan), "--task=" + args.task];
      if (args.output) a.push("--out=" + safePath(args.output));
      return (await runArgs(a)).output;
    }
    case "rf_validate_fragment": {
      const a = ["node", "tools/validate-fragment.js", safeRead(args.input)];
      if (args.plan) a.push("--plan=" + safeRead(args.plan));
      return (await runArgs(a)).output;
    }

    // ===== L4 =====
    case "rf_assemble": {
      const a = ["node", "tools/assemble.js", "--plan=" + safeRead(args.plan), "--fragments=" + safeRead(args.fragments)];
      if (args.output) a.push("--out=" + safePath(args.output));
      return (await runArgs(a)).output;
    }

    default: throw new Error("未知工具: " + name);
  }
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    try { handleMessage(JSON.parse(line)); } catch (e) {}
  }
});

function send(obj) { process.stdout.write(JSON.stringify(obj) + "\n"); }

async function handleMessage(msg) {
  const { id, method, params } = msg;
  try {
    if (method === "initialize") {
      send({ jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "render-forge", version: "1.1.0" } } });
    } else if (method === "tools/list") {
      send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    } else if (method === "tools/call") {
      const { name, arguments: args } = params;
      const result = await handleTool(name, args || {});
      send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: String(result) }] } });
    } else if (method === "notifications/initialized") {
      // 无需回复
    } else {
      send({ jsonrpc: "2.0", id, error: { code: -32601, message: "未知方法: " + method } });
    }
  } catch (e) {
    send({ jsonrpc: "2.0", id, error: { code: -32603, message: String(e.message) } });
  }
}

console.error("[Render Forge MCP] 已启动，提供 " + TOOLS.length + " 个工具");
