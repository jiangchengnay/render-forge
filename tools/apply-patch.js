#!/usr/bin/env node
// tools/apply-patch.js：把 patch-proposal.json 应用到分镜 JSON
const fs = require('fs');
const path = require('path');

function applyOne(sb, patch) {
  const parts = patch.path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let obj = sb;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (obj[k] == null) obj[k] = {};
    obj = obj[k];
  }
  const last = parts[parts.length - 1];
  if (patch.op === 'add') obj[last] = (typeof obj[last] === 'number' ? obj[last] : 0) + patch.value;
  else if (patch.op === 'multiply') obj[last] = (typeof obj[last] === 'number' ? obj[last] : 1) * patch.value;
  else if (patch.op === 'set') obj[last] = patch.value;
  else if (patch.op === 'append') {
    // obj 是父容器，last 是键；往 obj[last] 数组里加
    if (obj[last] == null) obj[last] = [];
    if (Array.isArray(obj[last])) obj[last].push(patch.value);
  }
  else if (patch.op === 'delete') { if (Array.isArray(obj)) obj.splice(+last, 1); else delete obj[last]; }
  return sb;
}

function main() {
  const args = process.argv.slice(2);
  const sbPath = args[0], propPath = args[1];
  if (!sbPath || !propPath) { console.error('用法: node tools/apply-patch.js <storyboard.json> <patch-proposal.json> [--out=new.json]'); process.exit(1); }
  let out = null;
  args.forEach(a => { const m = a.match(/^--out=(.+)$/); if (m) out = m[1]; });
  const sb = JSON.parse(fs.readFileSync(sbPath, 'utf8'));
  const prop = JSON.parse(fs.readFileSync(propPath, 'utf8'));
  let count = 0;
  (prop.proposals || []).forEach(p => {
    (p.patches || []).forEach(pt => { try { applyOne(sb, pt); count++; } catch (e) { console.warn('失败:', pt.path, e.message); } });
  });
  const outPath = out || sbPath.replace(/\.json$/, '.patched.json');
  fs.writeFileSync(outPath, JSON.stringify(sb, null, 2));
  console.log('应用了 ' + count + ' 处修改 -> ' + outPath);
}

module.exports = { applyOne };
if (require.main === module) main();
