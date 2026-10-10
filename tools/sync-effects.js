#!/usr/bin/env node
// tools/sync-effects.js —— 用 puppeteer 从浏览器导出引擎快照，供 Node 侧工具使用。
const fs = require('fs');
const path = require('path');
const { puppeteerLaunchOptions } = require('./find-browser');

async function main() {
  let puppeteer;
  try { puppeteer = require('puppeteer'); }
  catch (e) { console.error('缺少 puppeteer: npm i puppeteer'); process.exit(1); }

  const root = path.resolve(__dirname, '..');
  const htmlPath = 'file://' + path.join(root, 'index.html').replace(/\\/g, '/');
  const launchInfo = puppeteerLaunchOptions();
  if (launchInfo.browser) console.log('使用浏览器: ' + launchInfo.browser.name);
  const browser = await puppeteer.launch(launchInfo.options);
  const page = await browser.newPage();
  await page.goto(htmlPath, { waitUntil: 'networkidle0' });

  const data = await page.evaluate(() => {
    const names = [];
    const meta = {};
    Object.keys(RF.effects).forEach((k) => {
      if (k === 'register') return;
      names.push(k);
      const m = RF.effects[k].meta;
      if (m && m.params) meta[k] = m.params;
    });
    const postfx = Object.keys(RF.postfx).filter((k) => k !== 'register');
    const transitions = RF.Transitions.list();
    const palettes = Object.keys(RF.PALETTES);
    const templates = (RF.Templates && RF.Templates.list) ? RF.Templates.list() : [];
    const scenelets = (RF.Scenelet && RF.Scenelet.list) ? RF.Scenelet.list() : [];
    return { names, meta, postfx, transitions, palettes, templates, scenelets };
  });

  await browser.close();

  const w = (f, d) => fs.writeFileSync(path.join(root, 'tools', f), JSON.stringify(d, null, 2));
  w('_effect-names.json', data.names);
  w('_effect-meta.json', data.meta);
  w('_postfx-names.json', data.postfx);
  w('_transitions.json', data.transitions);
  w('_palettes.json', data.palettes);
  w('_templates.json', data.templates);
  w('_scenelets.json', data.scenelets);

  console.log('已同步快照：');
  console.log('  效果: ' + data.names.length);
  console.log('  有 meta: ' + Object.keys(data.meta).length);
  console.log('  后处理: ' + data.postfx.length);
  console.log('  转场: ' + data.transitions.length);
  console.log('  调色板: ' + data.palettes.length);
  console.log('  模板: ' + data.templates.length);
  console.log('  片段: ' + data.scenelets.length);
}

main().catch((e) => { console.error(e); process.exit(1); });
