#!/usr/bin/env node
// tools/vision.js
// 视觉模型批评：把 contact sheet 发给多模态模型，产出结构化批评。
// 支持 OpenAI 兼容接口（OpenAI / Azure / 通义 / 智谱 / DeepSeek-VL / 本地 Ollama 等）。
//
// 环境变量：
//   RF_VISION_URL     chat completions 端点（如 https://api.openai.com/v1/chat/completions）
//   RF_VISION_KEY     API Key
//   RF_VISION_MODEL   模型名（如 gpt-4o / qwen-vl-max / glm-4v）
//
// 用法：
//   node tools/vision.js <contact-sheet.jpg> [--prompt="..."] [--out=vision-report.json]
//
// 若环境变量缺失，返回 { skipped: true, reason } 而不报错。

const fs = require("fs");
const path = require("path");

const DEFAULT_PROMPT = `你是一位专业的动效设计师。这是一段程序化动画的关键帧拼图（每个格子标注了时间点）。
请按以下 JSON 格式评价，不要输出其他内容：
{
  "overall": "整体印象（1-2 句）",
  "score": 0-10 的整数,
  "strengths": ["优点1", "优点2"],
  "weaknesses": ["问题1", "问题2"],
  "suggestions": [
    { "target": "某时间点或某类元素", "action": "具体的修改建议" }
  ],
  "issues": [
    { "type": "构图/色彩/节奏/文字/层次", "severity": "high/medium/low", "desc": "描述" }
  ]
}`;

async function askVision(imagePath, opts) {
  opts = opts || {};
  const url = process.env.RF_VISION_URL;
  const key = process.env.RF_VISION_KEY;
  const model = process.env.RF_VISION_MODEL || "gpt-4o";

  if (!url || !key) {
    return { skipped: true, reason: "未配置 RF_VISION_URL / RF_VISION_KEY" };
  }
  if (!fs.existsSync(imagePath)) {
    return { error: "图片不存在: " + imagePath };
  }

  const b64 = fs.readFileSync(imagePath).toString("base64");
  const mime = /.png$/i.test(imagePath) ? "image/png" : "image/jpeg";
  const dataUrl = "data:" + mime + ";base64," + b64;

  const body = {
    model: model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: opts.prompt || DEFAULT_PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 1500,
    temperature: 0.4,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + key,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: "API 返回 " + res.status + ": " + text.slice(0, 300) };
  }

  const json = await res.json();
  const content = json.choices && json.choices[0] && json.choices[0].message
    ? json.choices[0].message.content
    : "";

  // 尝试解析 JSON（模型可能包裹在 markdown 里）
  let parsed = null;
  const m = content.match(/\{[\s\S]*\}/);
  if (m) { try { parsed = JSON.parse(m[0]); } catch (e) { /* 保持原样 */ } }

  return { raw: content, parsed: parsed, model: model };
}

async function main() {
  const args = process.argv.slice(2);
  const imagePath = args[0];
  if (!imagePath) {
    console.error("用法: node tools/vision.js <image.jpg> [--prompt=...] [--out=report.json]");
    process.exit(1);
  }
  let prompt = null, out = null;
  args.slice(1).forEach((s) => {
    const m = s.match(/^--(\w+)=(.*)$/);
    if (!m) return;
    if (m[1] === "prompt") prompt = m[2];
    else if (m[1] === "out") out = m[2];
  });

  const r = await askVision(imagePath, { prompt });
  if (r.skipped) {
    console.log("跳过视觉批评：" + r.reason);
    console.log("配置方法：设置 RF_VISION_URL / RF_VISION_KEY / RF_VISION_MODEL 环境变量");
    process.exit(0);
  }
  if (r.error) { console.error(r.error); process.exit(1); }

  if (out) fs.writeFileSync(out, JSON.stringify(r, null, 2));
  if (r.parsed) {
    console.log("=== 视觉批评 ===");
    console.log("评分: " + r.parsed.score + "/10");
    console.log("整体: " + r.parsed.overall);
    if (r.parsed.strengths) { console.log("\n优点:"); r.parsed.strengths.forEach((s) => console.log("  + " + s)); }
    if (r.parsed.weaknesses) { console.log("\n问题:"); r.parsed.weaknesses.forEach((s) => console.log("  - " + s)); }
    if (r.parsed.suggestions) { console.log("\n建议:"); r.parsed.suggestions.forEach((s) => console.log("  → " + s.target + ": " + s.action)); }
  } else {
    console.log(r.raw);
  }
}

module.exports = { askVision };

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
