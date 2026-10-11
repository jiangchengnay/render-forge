#!/usr/bin/env node
// tools/critique-cli.js
// Node 侧批评管线：puppeteer 加载 → 逐帧 seek → 图像分析 → 输出 JSON 报告 + contact sheet。
// 可选：接视觉模型 API 做 AI 判定（环境变量 RF_VISION_URL / RF_VISION_KEY）。
//
// 用法：
//   node tools/critique-cli.js <storyboard.json> [--frames=8] [--out=report.json]
//
// 输出：
//   - 控制台：结构化报告
//   - 文件：report.json（每帧指标 + 问题 + lint）
//   - 文件：report-contact.jpg（拼图）

const fs = require("fs");
const path = require("path");
const { puppeteerLaunchOptions, findBrowser } = require("./find-browser");

function parseArgs() {
  const a = process.argv.slice(2);
  const out = { input: a[0], frames: 8, out: null, keep: false };
  a.slice(1).forEach((s) => {
    const m = s.match(/^--(\w+)(?:=(.+))?$/);
    if (!m) return;
    const k = m[1], v = m[2];
    if (k === "frames") out.frames = parseInt(v, 10);
    else if (k === "out") out.out = v;
    else if (k === "keep") out.keep = true;
  });
  return out;
}

async function main() {
  const args = parseArgs();
  if (!args.input) {
    console.error("用法: node tools/critique-cli.js <storyboard.json> [--frames=8] [--out=report.json]");
    process.exit(1);
  }

  let puppeteer;
  try { puppeteer = require("puppeteer"); }
  catch (e) { console.error("缺少 puppeteer。请执行: npm i puppeteer"); process.exit(1); }

  const root = path.resolve(__dirname, "..");
  const htmlPath = "file://" + path.join(root, "index.html").replace(/\\/g, "/");
  const sb = JSON.parse(fs.readFileSync(args.input, "utf8"));

  const launchInfo = puppeteerLaunchOptions();
  if (!launchInfo.browser) {
    console.warn("[警告] 未找到系统 Chromium 内核浏览器，尝试 puppeteer 自带（如失败请运行 npx puppeteer browsers install chrome）");
  } else {
    console.log("使用浏览器: " + launchInfo.browser.name);
  }
  const browser = await puppeteer.launch(launchInfo.options);
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080 });
  await page.goto(htmlPath, { waitUntil: "networkidle0" });

  // 注入 storyboard（先加载 assets/字幕，与导出保持一致）
  const sbDir = path.dirname(path.resolve(args.input)).replace(/\\/g, "/");
  const assetsBase = "file://" + sbDir + "/";
  await page.evaluate(async (opts) => {
    const canvas = document.getElementById("canvas");
    const { s, base } = opts;
    if (s && (s.assets || s.subtitles) && RF.Media && RF.Media.loadStoryboardResources) {
      try { await RF.Media.loadStoryboardResources(s, base); } catch (e) { console.warn("[critique] 资源加载失败:", e.message); }
    }
    window.__rf_runtime = new RF.Runtime(canvas, s, {});
  }, { s: sb, base: assetsBase });

  // 调用浏览器内的批评工具
  const report = await page.evaluate(async (frames) => {
    const r = await RF.critiqueContactSheet({ frames, cols: 4 });
    return r;
  }, args.frames);

  await browser.close();

  // 写报告
  const outJson = args.out || path.join(root, "output", "critique-report.json");
  const outDir = path.dirname(outJson);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // 存 contact sheet
  const sheetPath = outJson.replace(/\.json$/, "-contact.jpg");
  if (report.contactSheet) {
    const b64 = report.contactSheet.replace(/^data:image\/jpeg;base64,/, "");
    fs.writeFileSync(sheetPath, Buffer.from(b64, "base64"));
  }

  // 精简报告（去掉 thumb 的 base64，省体积）
  const slim = {
    duration: report.duration,
    summary: report.summary,
    lintWarnings: report.lintWarnings,
    runtimeErrors: report.runtimeErrors,
    frames: report.frames.map((f) => ({ t: f.t, metrics: f.metrics, issues: f.issues })),
  };
  fs.writeFileSync(outJson, JSON.stringify(slim, null, 2));

  // 控制台输出
  console.log("=== 批评报告 ===");
  console.log("时长: " + report.duration + "s");
  console.log("问题帧: " + report.summary.framesWithIssues + "/" + report.summary.totalFrames);
  console.log("\n主要问题:");
  report.summary.topIssues.forEach((i) => console.log("  [" + i.count + "x] " + i.issue));
  console.log("\nlint 警告: " + report.lintWarnings.length);
  report.lintWarnings.forEach((w) => console.log("  [" + w.level + "] " + w.msg));
  if (report.runtimeErrors.length) {
    console.log("\n运行错误: " + report.runtimeErrors.length);
    report.runtimeErrors.slice(0, 5).forEach((e) => console.log("  " + e));
  }
  console.log("\n报告: " + outJson);
  console.log("拼图: " + sheetPath);

  // 可选：接视觉模型
  if (process.env.RF_VISION_URL && process.env.RF_VISION_KEY) {
    try {
      const { askVision } = require("./vision");
      console.log("\n调用视觉模型...");
      const visionResult = await askVision(sheetPath, {});
      if (visionResult.parsed) {
        console.log("\n=== AI 视觉批评 ===");
        console.log("评分: " + visionResult.parsed.score + "/10");
        console.log("整体: " + visionResult.parsed.overall);
        if (visionResult.parsed.weaknesses) {
          console.log("问题:");
          visionResult.parsed.weaknesses.forEach((w) => console.log("  - " + w));
        }
        if (visionResult.parsed.suggestions) {
          console.log("建议:");
          visionResult.parsed.suggestions.forEach((s) => console.log("  → " + s.target + ": " + s.action));
        }
        // 合并进报告
        slim.vision = visionResult.parsed;
        fs.writeFileSync(outJson, JSON.stringify(slim, null, 2));
      } else if (visionResult.raw) {
        console.log("模型输出: " + visionResult.raw.slice(0, 500));
      } else if (visionResult.error) {
        console.log("视觉模型调用失败: " + visionResult.error);
      }
    } catch (e) {
      console.log("视觉批评跳过: " + e.message);
    }
  } else {
    console.log("\n（未配置视觉模型，跳过 AI 批评。设置 RF_VISION_URL / RF_VISION_KEY 可启用）");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
