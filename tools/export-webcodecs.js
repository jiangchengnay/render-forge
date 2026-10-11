#!/usr/bin/env node
// tools/export-webcodecs.js —— Node 驱动页内 WebCodecs 编码，直接出 mp4（零截图、零 ffmpeg）
// 通过本地 HTTP 服务加载页面（file:// 禁止动态 import ESM）
// 支持 --audio=path 把音轨一并编码进 mp4（AAC），仍不需要 ffmpeg。
const fs = require("fs");
const path = require("path");
const http = require("http");
const { puppeteerLaunchOptions } = require("./find-browser");

function parseArgs() {
  const a = process.argv.slice(2);
  const out = { input: a[0], output: a[1], fps: 30, container: null, bitrate: null, audio: null, fit: "audio" };
  a.slice(2).forEach((s) => {
    const m = s.match(/^--(\w+)(?:=(.+))?$/);
    if (!m) return;
    const k = m[1], v = m[2];
    if (k === "fps") out.fps = parseInt(v, 10);
    else if (k === "container") out.container = v;
    else if (k === "bitrate") out.bitrate = parseInt(v, 10);
    else if (k === "audio") out.audio = v;
    else if (k === "fit") out.fit = v;
  });
  return out;
}

// 极简静态文件服务（额外支持 /__audio 路由，服务任意外部音轨文件）
function startServer(root, audioPath) {
  const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
    ".json": "application/json", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg",
    ".svg": "image/svg+xml", ".mp4": "video/mp4", ".webm": "video/webm",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".aac": "audio/aac", ".ogg": "audio/ogg" };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0]);
      if (p === "/__audio") {
        if (!audioPath || !fs.existsSync(audioPath)) { res.writeHead(404); res.end("audio not found"); return; }
        res.writeHead(200, { "Content-Type": MIME[path.extname(audioPath)] || "application/octet-stream" });
        fs.createReadStream(audioPath).pipe(res);
        return;
      }
      if (p === "/") p = "/index.html";
      const file = path.join(root, p);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end("not found"); return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

async function main() {
  const args = parseArgs();
  if (!args.input || !args.output) {
    console.error("用法: node tools/export-webcodecs.js <storyboard.json> <output.mp4> [--fps=30] [--audio=bgm.mp3]");
    process.exit(1);
  }
  let puppeteer;
  try { puppeteer = require("puppeteer"); }
  catch (e) { console.error("缺少 puppeteer: npm i puppeteer"); process.exit(1); }

  const root = path.resolve(__dirname, "..");
  const sb = JSON.parse(fs.readFileSync(args.input, "utf8"));
  const meta = sb.meta || {};
  const W = meta.width || 1080, H = meta.height || 1080;

  let audioPath = null;
  if (args.audio) {
    audioPath = path.resolve(args.audio);
    if (!fs.existsSync(audioPath)) { console.error("音轨文件不存在: " + audioPath); process.exit(1); }
  }

  // 起本地服务
  const { server, port } = await startServer(root, audioPath);
  const url = "http://127.0.0.1:" + port + "/index.html";
  const audioUrl = audioPath ? ("http://127.0.0.1:" + port + "/__audio") : null;

  const launchInfo = puppeteerLaunchOptions();
  if (launchInfo.browser) console.log("使用浏览器: " + launchInfo.browser.name);
  if (audioPath) console.log("音轨: " + audioPath);
  const browser = await puppeteer.launch(launchInfo.options);
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H });
  page.on("console", (msg) => { const t = msg.text(); if (t.indexOf("[RF") >= 0) console.log("  [page] " + t); });
  page.on("pageerror", (e) => console.error("  [page error] " + e.message));
  await page.goto(url, { waitUntil: "networkidle0" });

  console.log("加载分镜 + 页内编码" + (audioUrl ? "（含音轨）" : "") + "...");
  const result = await page.evaluate(async (opts) => {
    const { storyboard, fps, container, bitrate, audioUrl, fit, assetsBase } = opts;
    const canvas = document.getElementById("canvas");
    if (window.__rf_runtime) window.__rf_runtime.pause();
    let sbd = storyboard;
    if (window.RF && RF.Templates && storyboard.template) sbd = RF.Templates.expand(storyboard);
    // fit：探测音频时长算 targetDuration
    let targetDuration = null;
    if (audioUrl) {
      try {
        const resp = await fetch(audioUrl); const ab = await resp.arrayBuffer();
        const actx = new (window.AudioContext || window.webkitAudioContext)();
        const abuf = await actx.decodeAudioData(ab.slice(0)); await actx.close();
        const ad = abuf.duration; const sd = (sbd.meta && sbd.meta.duration) || 0;
        const mode = fit || "audio";
        if (mode === "audio") targetDuration = ad;
        else if (mode === "storyboard") targetDuration = sd;
        else if (mode === "strict") { if (Math.abs(ad - sd) > 0.15) throw new Error("strict: 音频 " + ad.toFixed(2) + "s vs 分镜 " + sd + "s"); targetDuration = sd; }
        else targetDuration = ad;
      } catch (e) { console.log("[RF Export] fit: " + e.message); }
    }
    // 加载分镜 assets 清单（图片/视频/svg/字体）
    if (sbd.assets && sbd.assets.length && RF.Media && RF.Media.loadStoryboardAssets) {
      const ar = await RF.Media.loadStoryboardAssets(sbd.assets, assetsBase);
      if (ar.errors.length) console.log("[RF Export] assets 警告: " + ar.errors.join("; "));
      console.log("[RF Export] assets 已加载 " + ar.loaded + "/" + sbd.assets.length);
    }
    window.__rf_runtime = new RF.Runtime(canvas, sbd, {});
    const r = await RF.Exporter.exportVideo({
      runtime: window.__rf_runtime,
      targetDuration: targetDuration,
      fps: fps, container: container, bitrate: bitrate, audioUrl: audioUrl,
      onProgress: function (p) { if (p.frame % 60 === 0) console.log("[RF Export] " + p.pct + "%"); },
    });
    return { bytes: r.bytes, frames: r.frames, container: r.container, codec: r.codec,
      totalMs: r.totalMs, msPerFrame: r.msPerFrame, audio: r.audio,
      data: Array.from(new Uint8Array(r.buffer)) };
  }, { storyboard: sb, fps: args.fps, container: args.container, bitrate: args.bitrate, audioUrl: audioUrl, fit: args.fit, assetsBase: "http://127.0.0.1:" + port + "/" + path.dirname(path.relative(root, path.resolve(args.input))).replace(/\\/g, "/") + "/" });

  await browser.close();
  server.close();

  const outPath = path.resolve(args.output);
  fs.writeFileSync(outPath, Buffer.from(result.data));
  console.log("");
  console.log("=== 导出完成 ===");
  console.log("文件: " + outPath);
  console.log("格式: " + result.container + " / " + result.codec);
  if (result.audio) console.log("音轨: " + result.audio.codec + " " + result.audio.sampleRate + "Hz " + result.audio.channels + "ch");
  console.log("大小: " + Math.round(result.bytes / 1024) + " KB");
  console.log("帧数: " + result.frames);
  console.log("总耗时: " + (result.totalMs / 1000).toFixed(1) + "s");
  console.log("每帧: " + result.msPerFrame.toFixed(1) + "ms");
  console.log("5min@30fps 换算: " + (result.msPerFrame * 9000 / 60000).toFixed(1) + " 分钟");
}

main().catch((e) => { console.error(e); process.exit(1); });
