#!/usr/bin/env node
// tools/render.js
// 生产级渲染：Node + Puppeteer 逐帧截图 → ffmpeg 编码为 mp4（可选音轨）。
//
// 用法：
//   node tools/render.js <storyboard.json> <output.mp4> [--fps=30] [--w=1080] [--h=1080] [--audio=bgm.mp3]
//
// 依赖：npm i puppeteer（编码需系统 ffmpeg）

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { puppeteerLaunchOptions } = require("./find-browser");
const { findFfmpeg } = require("./find-ffmpeg");

function parseArgs() {
  const a = process.argv.slice(2);
  const out = { input: a[0], output: a[1], fps: 30, w: null, h: null, audio: null, keep: false, pngOnly: false };
  a.slice(2).forEach((s) => {
    const m = s.match(/^--(\w+)(?:=(.+))?$/);
    if (!m) return;
    const k = m[1], v = m[2];
    if (k === "fps") out.fps = parseInt(v, 10);
    else if (k === "w") out.w = parseInt(v, 10);
    else if (k === "h") out.h = parseInt(v, 10);
    else if (k === "audio") out.audio = v;
    else if (k === "keep") out.keep = true;
    else if (k === "png-only") out.pngOnly = true;
  });
  return out;
}

async function main() {
  const args = parseArgs();
  if (!args.input || !args.output) {
    console.error("用法: node tools/render.js <storyboard.json> <output.mp4> [--fps=30] [--audio=bgm.mp3]");
    process.exit(1);
  }

  let puppeteer;
  try { puppeteer = require("puppeteer"); }
  catch (e) { console.error("缺少 puppeteer。请执行: npm i puppeteer"); process.exit(1); }

  const sb = JSON.parse(fs.readFileSync(args.input, "utf8"));
  const meta = sb.meta || {};
  const W = args.w || meta.width || 1080;
  const H = args.h || meta.height || 1080;
  const duration = meta.duration || 6;
  const fps = args.fps;
  const totalFrames = Math.round(duration * fps);

  const root = path.resolve(__dirname, "..");
  const htmlPath = "file://" + path.join(root, "index.html").replace(/\\/g, "/");
  const tmpDir = path.join(root, "output", ".frames");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const launchInfo = puppeteerLaunchOptions();
  if (launchInfo.browser) console.log("使用浏览器: " + launchInfo.browser.name);
  const browser = await puppeteer.launch(launchInfo.options);
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto(htmlPath, { waitUntil: "networkidle0" });

  // 直接注入 storyboard（覆盖默认 demo）
  await page.evaluate((s) => {
    const canvas = document.getElementById("canvas");
    window.__rf_runtime = new RF.Runtime(canvas, s, {});
  }, sb);

  console.log("渲染 " + totalFrames + " 帧 @" + fps + "fps (" + W + "x" + H + ")");
  const t0 = Date.now();
  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;
    await page.evaluate((tt) => window.__rf_runtime.seek(tt), t);
    // 用 puppeteer 原生 screenshot（比 toDataURL 快）
    const fn = path.join(tmpDir, "f" + String(i).padStart(6, "0") + ".png");
    await page.screenshot({ path: fn, type: "png" });
    if (i % 30 === 0) {
      const pct = Math.round((i / totalFrames) * 100);
      process.stdout.write("\r  " + pct + "% (" + i + "/" + totalFrames + ")");
    }
  }
  process.stdout.write("\r  100% (" + totalFrames + "/" + totalFrames + ")\n");
  console.log("截图耗时 " + ((Date.now() - t0) / 1000).toFixed(1) + "s");
  await browser.close();

  // --png-only：跳过 ffmpeg，仅验证帧渲染
  if (args.pngOnly) {
    console.log("\n[--png-only] 已生成 " + totalFrames + " 帧到 " + tmpDir);
    console.log("验证：用 ls 看文件，或 npm run render 完整渲染");
    return;
  }

  // ffmpeg 编码
  const ff = findFfmpeg();
  if (!ff) {
    console.error("未找到 ffmpeg。安装：winget install ffmpeg / brew install ffmpeg / apt install ffmpeg");
    console.error("或运行：npm run install-ffmpeg");
    process.exit(1);
  }
  console.log("使用 ffmpeg: " + ff.source + " → " + ff.path);
  const framePattern = path.join(tmpDir, "f%06d.png");
  console.log("调用 ffmpeg 编码" + (args.audio ? "（含音轨）" : "") + "...");
  let cmd = '"' + ff.path + '" -y -framerate ' + fps + ' -i "' + framePattern + '"';
  if (args.audio) cmd += ' -i "' + path.resolve(args.audio) + '" -c:a aac -shortest';
  cmd += ' -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium "' + path.resolve(args.output) + '"';
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (e) {
    console.error("ffmpeg 失败。请确认已安装 ffmpeg。");
    process.exit(1);
  }

  if (!args.keep) {
    fs.readdirSync(tmpDir).forEach((f) => fs.unlinkSync(path.join(tmpDir, f)));
    fs.rmdirSync(tmpDir);
  }
  console.log("完成: " + args.output);
}

main().catch((e) => { console.error(e); process.exit(1); });
