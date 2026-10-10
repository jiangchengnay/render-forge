#!/usr/bin/env node
// tools/gen-template-schema.js —— 从 builtin.js 提取 slots 生成文档
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'engine/templates/builtin.js'), 'utf8');

const blocks = [];
const re = /T\.register\("([^"]+)"[\s\S]*?(?=T\.register\("|$)/g;
let m;
while ((m = re.exec(src)) !== null) {
  const name = m[1];
  const body = m[0];
  const slots = {};
  let sm;
  const sr = /s\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
  while ((sm = sr.exec(body)) !== null) {
    slots[sm[1]] = (slots[sm[1]] || 0) + 1;
  }
  blocks.push({ name: name, slots: Object.keys(slots).sort() });
}

var md = '# 模板 slots 参考\n\n> 自动生成。用法：{"template":"名","slots":{...}}\n\n';
blocks.forEach(function(b) {
  md += '## `' + b.name + '`\n\n';
  md += '| slot | 建议类型 | 说明 |\n|---|---|---|\n';
  b.slots.forEach(function(s) {
    var type = 'string';
    if (/^(features|items|lines|tags|metrics|trend|bgColors|colors|modes)$/.test(s)) type = 'array';
    if (/^(stars|contributors|duration|width|height|seed|lineDur|value)$/.test(s)) type = 'number';
    var desc = '';
    if (s === 'palette') desc = '调色板名';
    else if (s === 'features') desc = '特性列表（字符串数组）';
    else if (s === 'lines') desc = '歌词行';
    md += '| `' + s + '` | ' + type + ' | ' + desc + ' |\n';
  });
  md += '\n';
});
fs.writeFileSync(path.join(root, 'dsl', 'TEMPLATE-SLOTS.md'), md);
console.log('生成 dsl/TEMPLATE-SLOTS.md：' + blocks.length + ' 个模板');
blocks.forEach(function(b) { console.log('  ' + b.name + ': ' + b.slots.length + ' slots'); });
