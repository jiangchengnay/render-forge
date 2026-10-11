#!/usr/bin/env node
// tools/smoke.js —— 对全部效果做最小渲染 smoke test，抓崩溃。用法：node tools/smoke.js
const fs = require('fs');
const path = require('path');
const { puppeteerLaunchOptions } = require('./find-browser');
(async () => {
  const puppeteer = require('puppeteer');
  const root = path.resolve(__dirname, '..');
  const html = 'file://' + path.join(root, 'index.html').replace(/\\/g, '/');
  const names = JSON.parse(fs.readFileSync(path.join(root, 'tools/_effect-names.json'), 'utf8'));
  const browser = await puppeteer.launch(puppeteerLaunchOptions().options);
  const page = await browser.newPage();
  await page.setViewport({ width: 720, height: 720 });
  await page.goto(html, { waitUntil: 'networkidle0' });
  const results = await page.evaluate(async (names) => {
    const out = [];
    // 先注册测试素材（image/svg 类效果需要）
    try {
      const c = document.createElement('canvas'); c.width = 64; c.height = 64;
      const cx = c.getContext('2d'); cx.fillStyle = '#f80'; cx.fillRect(0, 0, 64, 64);
      const blob = await new Promise((r) => c.toBlob(r));
      await RF.Media.register('smokeimg', blob);
      await RF.Media.register('smokesvg', '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="lime"/></svg>');
      const vc = document.createElement('canvas'); vc.width = 64; vc.height = 64;
      vc.getContext('2d').fillRect(0, 0, 64, 64);
      const vblob = await new Promise((r) => vc.toBlob(r, 'image/png'));
      // video 效果难以在 smoke 里造真视频，跳过
    } catch (e) {}
    // 每个效果：最小分镜渲染，检查 runtime.errors
    for (const name of names) {
      const params = {};
      // 素材类需要 src
      if (name === 'image' || name === 'imageMask') params.src = 'smokeimg';
      if (name === 'svg') params.src = 'smokesvg';
      if (name === 'video') { out.push({ name, skipped: true }); continue; }
      const sb = { meta: { width: 720, height: 720, duration: 1, seed: 1 }, palette: 'deepSea',
        acts: [{ id: 'a', dur: 1, tracks: [{ effect: name, at: 0, dur: 1, params }] }] };
      try {
        const rt = new RF.Runtime(document.getElementById('canvas'), sb, {});
        rt.seek(0.5);
        rt.seek(1);
        const errs = rt.errors.slice();
        // 检查是否真画了内容（非纯黑）
        let contentPct = 0;
        try {
          const cv = document.getElementById('canvas');
          const img = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
          let nb = 0, total = 0;
          for (let i = 0; i < img.length; i += 4 * 97) { total++; if (img[i] > 12 || img[i+1] > 12 || img[i+2] > 12) nb++; }
          contentPct = Math.round(nb / total * 100);
        } catch (e) {}
        out.push({ name, errors: errs, contentPct });
      } catch (e) {
        out.push({ name, threw: e.message });
      }
    }
    return out;
  }, names);
  await browser.close();
  let bad = 0;
  results.forEach((r) => {
    if (r.skipped) { console.log('⊘ ' + r.name + ' (跳过：需真视频)'); return; }
    if (r.threw) { bad++; console.log('✗ ' + r.name + ' 抛异常: ' + r.threw); return; }
    if (r.errors && r.errors.length) { bad++; console.log('✗ ' + r.name + ' runtime错误: ' + JSON.stringify(r.errors)); return; }
    if (r.contentPct === 0) { bad++; console.log('✗ ' + r.name + ' 渲染为空白（可能参数未生效）'); return; }
    console.log('✓ ' + r.name + '  (' + r.contentPct + '%)');
  });
  console.log('');
  console.log('smoke test: ' + (results.length - bad) + '/' + results.length + ' 通过，' + bad + ' 个有问题');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
