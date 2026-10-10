#!/usr/bin/env node
// tools/patch.js
// 读批评报告 + 原分镜，生成具体的修改方案（不自动应用，供人/AI 确认）。
// 用法：node tools/patch.js <storyboard.json> <critique-report.json> [--out=patch.json]
const fs = require('fs');
const path = require('path');

// 问题类型 → 具体修改规则
const RULES = {
  '画面过暗': function (sb) {
    const patches = [];
    const bloom = (sb.post || []).findIndex(p => p.effect === 'bloom');
    if (bloom >= 0) patches.push({ path: 'post[' + bloom + '].amount', op: 'add', value: 0.15, reason: '提高 bloom 亮度' });
    else patches.push({ path: 'post', op: 'append', value: { effect: 'bloom', amount: 0.4, threshold: 0.6 }, reason: '加 bloom' });
    return patches;
  },
  '画面过曝': function (sb) {
    const patches = [];
    const bloom = (sb.post || []).findIndex(p => p.effect === 'bloom');
    if (bloom >= 0) patches.push({ path: 'post[' + bloom + '].amount', op: 'add', value: -0.2, reason: '降低 bloom' });
    return patches;
  },
  '对比度低，画面平淡': function (sb) {
    const patches = [];
    patches.push({ path: 'post', op: 'append', value: { effect: 'tint', color: '#000', mode: 'overlay', amount: 0.12 }, reason: '加 tint 提升对比' });
    return patches;
  },
  '视觉元素稀疏': function (sb) {
    return [{ path: 'acts[0].tracks', op: 'append', value: { effect: 'dotGrid', at: 0, dur: 3, opacity: 0.4, params: { spacing: 0.05, reveal: 'radial' } }, reason: '加装饰层' }];
  },
  '视觉过载，元素堆叠': function (sb) {
    const patches = [];
    // 找出透明度最低的几个 clip 建议降低
    (sb.acts || []).forEach((a, ai) => {
      (a.tracks || []).forEach((c, ci) => {
        if (c.opacity == null || c.opacity > 0.5) {
          patches.push({ path: 'acts[' + ai + '].tracks[' + ci + '].opacity', op: 'multiply', value: 0.8, reason: '降低不透明度' });
        }
      });
    });
    return patches.slice(0, 3);
  },
  '单色占比过高，缺少层次': function (sb) {
    return [{ path: 'acts[0].tracks', op: 'append', value: { effect: 'geoShapes', at: 0, dur: 3, opacity: 0.3, blend: 'lighter', params: { count: 8, alpha: 0.3 } }, reason: '加 lighter 元素增加层次' }];
  },
};

function applyPatch(sb, p) {
  // 简单实现：支持 add / multiply / append
  const parts = p.path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let obj = sb;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (obj[k] == null) obj[k] = {};
    obj = obj[k];
  }
  const last = parts[parts.length - 1];
  if (p.op === 'add') obj[last] = (typeof obj[last] === 'number' ? obj[last] : 0) + p.value;
  else if (p.op === 'multiply') obj[last] = (typeof obj[last] === 'number' ? obj[last] : 1) * p.value;
  else if (p.op === 'set') obj[last] = p.value;
  else if (p.op === 'append') {
    if (!Array.isArray(obj)) return;
    obj.push(p.value);
  }
}

function main() {
  const args = process.argv.slice(2);
  const sbPath = args[0], repPath = args[1];
  if (!sbPath || !repPath) {
    console.error('用法: node tools/patch.js <storyboard.json> <critique-report.json> [--out=patch.json]');
    process.exit(1);
  }
  let out = null;
  args.forEach(a => { const m = a.match(/^--out=(.+)$/); if (m) out = m[1]; });

  const sb = JSON.parse(fs.readFileSync(sbPath, 'utf8'));
  const report = JSON.parse(fs.readFileSync(repPath, 'utf8'));

  // 汇总所有帧的问题
  const issueCount = {};
  (report.frames || []).forEach(f => {
    (f.issues || []).forEach(i => { issueCount[i] = (issueCount[i] || 0) + 1; });
  });

  // 对每个问题类型生成 patch
  const proposals = [];
  Object.keys(issueCount).forEach(issue => {
    const rule = RULES[issue];
    if (!rule) return;
    const patches = rule(sb);
    if (patches.length) {
      proposals.push({ issue: issue, count: issueCount[issue], patches: patches });
    }
  });

  const proposal = {
    source: sbPath,
    report: repPath,
    generatedAt: new Date().toISOString(),
    proposals: proposals,
  };

  const outPath = out || path.join(path.dirname(sbPath), 'patch-proposal.json');
  fs.writeFileSync(outPath, JSON.stringify(proposal, null, 2));

  console.log('=== 修改方案 ===');
  proposals.forEach(p => {
    console.log('[' + p.count + 'x] ' + p.issue);
    p.patches.forEach(pt => console.log('  → ' + pt.path + ' ' + pt.op + ' ' + JSON.stringify(pt.value) + '  (' + pt.reason + ')'));
  });
  console.log('\n已写: ' + outPath);
  console.log('\n应用方式：手动编辑，或写脚本按 patch 修改分镜 JSON。');
}

module.exports = { applyPatch, RULES };
if (require.main === module) main();
