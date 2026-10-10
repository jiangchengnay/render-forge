#!/usr/bin/env node
// tools/check-docs.js —— 校验"当前事实"文档里的总数与实际一致。
// 只扫 AI-GUIDE / README / OVERVIEW / SCHEMA-BRIEF / EFFECTS（排除 PROGRESS.md —— 它是历史日志，数字反映当时状态）。
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.resolve(__dirname, '..');

function readJson(f) { try { return JSON.parse(fs.readFileSync(path.join(root, 'tools', f), 'utf8')); } catch(e) { return null; } }
const names = readJson('_effect-names.json') || [];
const postfx = readJson('_postfx-names.json') || [];
const trans = readJson('_transitions.json') || [];
const tpl = readJson('_templates.json') || [];
const scenelets = readJson('_scenelets.json') || [];
const examples = fs.readdirSync(path.join(root, 'dsl/examples')).filter(f => f.endsWith('.json')).length;

let testCount = null;
try {
  const out = execSync('node tools/test.js', { cwd: root, encoding: 'utf8' });
  const m = out.match(/通过[:：]\s*(\d+)/);
  if (m) testCount = parseInt(m[1], 10);
} catch (e) {
  const out = (e.stdout || '') + (e.stderr || '');
  const m = out.match(/通过[:：]\s*(\d+)/);
  if (m) testCount = parseInt(m[1], 10);
}

const actual = {
  效果: names.length, 示例: examples, 后处理: postfx.length,
  转场: trans.length, 模板: tpl.length, 片段: scenelets.length, 单元测试: testCount,
};

const docs = ['dsl/AI-GUIDE.md', 'README.md', 'OVERVIEW.md', 'dsl/SCHEMA-BRIEF.md', 'dsl/EFFECTS.md'];

// 只匹配"明确的计数"形式，避免列表序号/散文：
//   1) "N 个效果" / "N 效果"（数字紧跟）
//   2) 表格 "| 效果/组件 | N" / "| 效果 | N"
//   3) "效果 N/57" 这种
const PATTERNS = [
  // 表格行：| 关键词... | 数字 |
  { re: /\|\s*[^|]*?(效果|示例|后处理|转场|模板|片段|单元测试)[^|]*\|\s*\**\s*(\d+)/g, form: 'table' },
  // "N 个效果" / "N 效果" / "效果 N"
  { re: /(\d+)\s*个?\s*(效果|示例|后处理|转场|模板|片段)/g, form: 'suffix', swap: true },
  { re: /(效果|示例|后处理|转场|模板|片段)\s*(\d+)\s*个/g, form: 'prefix' },
];

// 豁免：模糊语境
const FUZZY = /至少|最多|若干|约\s*\d|其中|单个|每[个种]|1-2|1~2|1-3|几[个种]/;

let problems = 0;
docs.forEach((d) => {
  const p = path.join(root, d);
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    // 跳过：列表序号行（"1. xxx" / "- xxx" 开头是序号）
    if (/^\d+\.\s/.test(trimmed)) return;
    if (FUZZY.test(line)) return;

    PATTERNS.forEach(({ re, form }) => {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        let keyword, n;
        if (form === 'table') { keyword = m[1]; n = parseInt(m[2], 10); }
        else if (form === 'suffix') { n = parseInt(m[1], 10); keyword = m[2]; }
        else { keyword = m[1]; n = parseInt(m[2], 10); }
        const want = actual[keyword];
        if (want == null) continue;
        if (n !== want) {
          console.log('✗ ' + d + ':' + (i + 1) + ' 说 "' + keyword + '=' + n + '"，实际 ' + want);
          console.log('    ' + trimmed.slice(0, 90));
          problems++;
        }
      }
    });
  });
});

if (problems === 0) {
  console.log('✓ 当前文档数字全部一致');
  console.log('  ' + Object.keys(actual).map(k => k + '=' + actual[k]).join(' '));
} else {
  console.log('');
  console.log('共 ' + problems + ' 处不一致');
  process.exit(1);
}
