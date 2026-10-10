#!/usr/bin/env node
// tools/inject-meta.js —— 把 _meta-defs.json 里的 meta 注入到各效果文件
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const defs = JSON.parse(fs.readFileSync(path.join(__dirname, '_meta-defs.json'), 'utf8'));

// 效果名 -> 文件
const fileMap = {
  noiseMask: 'engine/effects/noise.js',
  polygonRing: 'engine/effects/shapes.js',
  ripples: 'engine/effects/shapes.js',
  strokeGrow: 'engine/effects/shapes.js',
  morphPolygon: 'engine/effects/shapes.js',
  lyricLine: 'engine/effects/text-advanced.js',
  bezierText: 'engine/effects/text-advanced.js',
  bulletList: 'engine/effects/text-advanced.js',
  codeBlock: 'engine/effects/text-advanced.js',
  wordPop: 'engine/effects/text.js',
  blurFocus: 'engine/effects/text.js',
  progressRing: 'engine/components/data-viz.js',
  barChart: 'engine/components/data-viz.js',
  lineChart: 'engine/components/data-viz.js',
  pieChart: 'engine/components/data-viz.js',
  radarChart: 'engine/components/data-viz.js',
  geoShapes: 'engine/components/decor.js',
  gradientBlob: 'engine/components/decor.js',
  frameRect: 'engine/components/decor.js',
  divider: 'engine/components/decor.js',
  logoMark: 'engine/components/decor.js',
  stripes: 'engine/components/decor.js',
  bigGlyph: 'engine/components/decor.js',
  clickRipple: 'engine/components/interactive.js',
  keyPress: 'engine/components/interactive.js',
  connector: 'engine/components/interactive.js',
  tagCloud: 'engine/components/interactive.js',
  terminalWindow: 'engine/components/ui-mock.js',
  phoneFrame: 'engine/components/ui-mock.js',
  cardStack: 'engine/components/ui-mock.js',
};

let total = 0;
const byFile = {};
for (const name of Object.keys(defs)) {
  const rel = fileMap[name];
  if (!rel) { console.warn('no file for', name); continue; }
  byFile[rel] = byFile[rel] || [];
  byFile[rel].push(name);
}

for (const rel of Object.keys(byFile)) {
  const full = path.join(root, rel);
  let src = fs.readFileSync(full, 'utf8');
  let changed = 0;
  for (const name of byFile[rel]) {
    const meta = defs[name];
    // 匹配 RF.effects.register("name", {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(RF\\.effects\\.register\\(\"' + esc + '\",\\s*\\{)', 'm');
    if (!re.test(src)) { console.warn('  pattern not found:', name, 'in', rel); continue; }
    // 检查是否已有 meta
    const after = src.slice(src.indexOf('register("' + name + '"') , src.indexOf('register("' + name + '"') + 400);
    if (after.indexOf('meta:') >= 0) { continue; }
    const metaStr = '\n    meta: ' + JSON.stringify(meta) + ',';
    src = src.replace(re, '$1' + metaStr);
    changed++;
    total++;
  }
  if (changed > 0) {
    fs.writeFileSync(full, src);
    console.log(rel + ': 注入 ' + changed + ' 个 meta');
  }
}
console.log('\n总计注入 ' + total + ' 个 meta');
