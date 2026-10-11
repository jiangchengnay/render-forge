#!/usr/bin/env node
// tools/bench.js —— 性能基准：测渲染/导出速度，防性能回归。
// 用法：node tools/bench.js [storyboard.json]
const fs = require('fs');
const path = require('path');
const http = require('http');
const { puppeteerLaunchOptions } = require('./find-browser');

function serve(root) {
  const MIME = { ".html":"text/html",".js":"text/javascript",".mjs":"text/javascript",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml" };
  return new Promise((res) => {
    const s = http.createServer((req, r) => {
      let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/index.html";
      const f = path.join(root, p);
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(r);
    });
    s.listen(0, "127.0.0.1", () => res({ server: s, port: s.address().port }));
  });
}

(async () => {
  const sb = process.argv[2] || "dsl/examples/flagship.json";
  const root = path.resolve(__dirname, "..");
  const { server, port } = await serve(root);
  const puppeteer = require("puppeteer");
  const browser = await puppeteer.launch(puppeteerLaunchOptions().options);
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080 });
  await page.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle0" });
  const storyboard = JSON.parse(fs.readFileSync(path.join(root, sb), "utf8"));

  const r = await page.evaluate(async (sbd) => {
    const canvas = document.getElementById("canvas");
    const rt = new RF.Runtime(canvas, sbd, {});
    const dur = rt.duration;
    // 预热
    rt.seek(0);
    // 测 seek 渲染耗时（N 次）
    const N = 100;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) { rt.seek((i / N) * dur); }
    const seekMs = (performance.now() - t0) / N;
    return { duration: dur, seekMsPerFrame: +seekMs.toFixed(2), fps: +(1000 / seekMs).toFixed(1) };
  }, storyboard);

  await browser.close();
  server.close();
  console.log("=== 性能基准 ===");
  console.log("分镜: " + sb);
  console.log("时长: " + r.duration + "s");
  console.log("seek 渲染: " + r.seekMsPerFrame + " ms/帧  (" + r.fps + " fps 等效)");
  console.log("5min@30fps 纯渲染换算: " + (r.seekMsPerFrame * 9000 / 60000).toFixed(1) + " 分钟");
})().catch((e) => { console.error(e); process.exit(1); });
