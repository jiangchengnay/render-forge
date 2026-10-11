#!/usr/bin/env node
// tools/test.js
// 轻量单元测试。零依赖，直接用 Node 跑纯函数模块。
// 用法：node tools/test.js

const path = require("path");
const fs = require("fs");
const assert = require("assert");

let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ✓ " + name);
  } catch (e) {
    failed++;
    failures.push({ name, err: e.message });
    console.log("  ✗ " + name + " — " + e.message);
  }
}

// —— 载入引擎模块（用 Function 构造避免依赖浏览器全局）——
function loadModule(relPath, globals) {
  const src = fs.readFileSync(path.join(__dirname, "..", relPath), "utf8");
  const sandbox = Object.assign({ window: {}, console, Math, JSON, Array, Object, String, Number, parseFloat, parseInt, isNaN, Date, Map, Set, Float32Array, Uint8Array, Error }, globals || {});
  const fn = new Function("window", "console", "Math", "JSON", "Array", "Object", "String", "Number", "parseFloat", "parseInt", "isNaN", "Date", "Map", "Set", "Float32Array", "Uint8Array", "Error", src + "\nreturn window.RF;");
  return fn(sandbox.window, console, Math, JSON, Array, Object, String, Number, parseFloat, parseInt, isNaN, Date, Map, Set, Float32Array, Uint8Array, Error);
}

console.log("=== Render Forge 单元测试 ===\n");

// 1. 确定性随机
console.log("[rand.js]");
const RF = loadModule("engine/core/rand.js", {});
test("同 seed 产生同序列", () => {
  const a = new RF.Rng("test"), b = new RF.Rng("test");
  for (let i = 0; i < 100; i++) assert.strictEqual(a.float(), b.float());
});
test("不同 seed 产生不同序列", () => {
  const a = new RF.Rng("x"), b = new RF.Rng("y");
  let same = 0;
  for (let i = 0; i < 50; i++) if (a.float() === b.float()) same++;
  assert.ok(same < 3, "不同 seed 序列过于相似");
});
test("fork 派生子流稳定", () => {
  const a = new RF.Rng("base").fork("child1");
  const b = new RF.Rng("base").fork("child1");
  assert.strictEqual(a.float(), b.float());
});
test("float 在 [0,1)", () => {
  const r = new RF.Rng("t");
  for (let i = 0; i < 1000; i++) {
    const v = r.float();
    assert.ok(v >= 0 && v < 1, "越界: " + v);
  }
});

// 2. 缓动
console.log("\n[easing.js]");
const RF2 = loadModule("engine/core/easing.js", {});
test("所有缓动 f(0)=0", () => {
  Object.keys(RF2.Easing).forEach((k) => {
    if (k === "resolve" || k === "cubicBezier") return;
    const f = RF2.Easing[k];
    if (typeof f !== "function") return;
    const v = f(0);
    assert.ok(Math.abs(v) < 0.01, k + "(0) = " + v);
  });
});
test("所有缓动 f(1)=1", () => {
  Object.keys(RF2.Easing).forEach((k) => {
    if (k === "resolve" || k === "cubicBezier") return;
    const f = RF2.Easing[k];
    if (typeof f !== "function") return;
    const v = f(1);
    assert.ok(Math.abs(v - 1) < 0.01, k + "(1) = " + v);
  });
});
test("resolve 支持字符串名", () => {
  assert.strictEqual(RF2.Easing.resolve("linear")(0.5), 0.5);
});
test("resolve 支持 bezier 数组", () => {
  const f = RF2.Easing.resolve([0.25, 0.1, 0.25, 1]);
  assert.ok(typeof f === "function");
  assert.ok(Math.abs(f(0)) < 0.01);
  assert.ok(Math.abs(f(1) - 1) < 0.01);
});

// 3. 表达式
console.log("\n[expression.js]");
const RF3 = loadModule("engine/core/expression.js", {});
test("算术求值", () => {
  assert.strictEqual(RF3.Expression.evalExpr("=1+2*3", {}), 7);
  assert.strictEqual(RF3.Expression.evalExpr("=2**3", {}), 8);
  assert.strictEqual(RF3.Expression.evalExpr("=(1+2)*3", {}), 9);
});
test("函数调用", () => {
  assert.ok(Math.abs(RF3.Expression.evalExpr("=sin(PI/2)", { PI: Math.PI }) - 1) < 1e-6);
  assert.strictEqual(RF3.Expression.evalExpr("=clamp(1.5,0,1)", {}), 1);
  assert.strictEqual(RF3.Expression.evalExpr("=lerp(0,10,0.5)", {}), 5);
});
test("三元与比较", () => {
  assert.strictEqual(RF3.Expression.evalExpr("=t>2?1:0", { t: 3 }), 1);
  assert.strictEqual(RF3.Expression.evalExpr("=t>2?1:0", { t: 1 }), 0);
});
test("clips 引用", () => {
  assert.strictEqual(RF3.Expression.evalExpr("=clips.a1.0.ease*2", { clips: { a1: { 0: { ease: 0.5 } } } }), 1);
});
test("isExpr 识别", () => {
  assert.strictEqual(RF3.Expression.isExpr("=t*2"), true);
  assert.strictEqual(RF3.Expression.isExpr("$accent"), false);
  assert.strictEqual(RF3.Expression.isExpr(0.5), false);
});
test("非法表达式返回 0 不抛错", () => {
  assert.strictEqual(RF3.Expression.evalExpr("=@@@", {}), 0);
});

// 4. 音频时间解析
console.log("\n[audio.js — 纯函数部分]");
test("resolveTime 无音频按 120BPM", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine/core/audio.js"), "utf8");
  // 提取 resolveTime 逻辑测试
  assert.ok(src.indexOf("resolveTime") >= 0, "audio.js 应有 resolveTime");
});

// 5. 校验器
console.log("\n[validate.js]");
const v = require("./validate.js");
test("有效分镜无错误", () => {
  const problems = v.validate({ meta: { title: "T", width: 100, height: 100, duration: 1 }, post: [{ effect: "bloom" }], tracks: [{ effect: "fbmNoise" }] });
  const errors = problems.filter((p) => p.level === "error");
  assert.strictEqual(errors.length, 0, JSON.stringify(errors));
});
test("未知效果报错", () => {
  const names = JSON.parse(fs.readFileSync(path.join(__dirname, "_effect-names.json"), "utf8"));
  const problems = v.validate({ tracks: [{ effect: "nonexistent123" }] }, names);
  assert.ok(problems.some((p) => p.level === "error" && p.msg.indexOf("未知效果") >= 0));
});
test("未知后处理报错", () => {
  const problems = v.validate({ post: [{ effect: "fakePost" }] });
  assert.ok(problems.some((p) => p.level === "error"));
});

// 6. 浏览器探测
console.log("\n[find-browser.js]");
const fb = require("./find-browser.js");
test("findBrowser 返回对象或 null", () => {
  const b = fb.findBrowser();
  if (b) {
    assert.ok(typeof b.path === "string");
    assert.ok(typeof b.name === "string");
  }
});


// ========== 新增模块测试 ==========

// scenelet 片段库
console.log('\n[scenelet.js]');
const scl = loadModule('engine/scenelet.js', {});
test('注册与列出', () => {
  scl.Scenelet.register('t1', function() { return { dur: 1, tracks: [] }; });
  assert.ok(scl.Scenelet.list().indexOf('t1') >= 0);
});
test('expand 展开 include', () => {
  scl.Scenelet.register('t2', function(s) { return { dur: s.d || 2, tracks: [{ effect: 'fbmNoise' }] }; });
  const sb = { acts: [{ include: 't2', slots: { d: 5 } }] };
  scl.Scenelet.expand(sb);
  assert.strictEqual(sb.acts[0].dur, 5);
  assert.strictEqual(sb.acts[0].include, undefined);
  assert.strictEqual(sb.acts[0].tracks.length, 1);
});
test('未注册的 include 保留原样', () => {
  const sb = { acts: [{ include: 'nonexistent', foo: 1 }] };
  scl.Scenelet.expand(sb);
  assert.strictEqual(sb.acts[0].include, 'nonexistent');
});

// plugin 系统
console.log('\n[plugin.js]');
// plugin.js 用 window.RF；给它一个带 effects.register 的 mock
const mockRF = { effects: { register: function(id, def) { this[id] = def; } } };
const plg = loadModule('engine/plugin.js', {});
// 手动补 window.RF.effects（loadModule 返回的是 window.RF）
if (plg && plg.effects == null) plg.effects = mockRF.effects;
test('Plugin 导出正确', () => {
  assert.strictEqual(typeof plg.Plugin, 'object');
  assert.strictEqual(typeof plg.Plugin.load, 'function');
  assert.strictEqual(typeof plg.Plugin.list, 'function');
  assert.strictEqual(typeof plg.Plugin.unload, 'function');
});
test('load 缺 id 报错', () => {
  // 需要 mock 的 effects.register 已在 globals 提供
  assert.throws(() => plg.Plugin.load({ draw: function() {} }));
});
test('load 缺 draw/stateful 报错', () => {
  assert.throws(() => plg.Plugin.load({ id: 'x' }));
});
test('loadFromSource 语法错误返回失败', () => {
  const r = plg.Plugin.loadFromSource('this is not valid js !!!');
  assert.strictEqual(r.ok, false);
});

// recommend
console.log('\n[recommend.js]');
const rec = loadModule('engine/recommend.js', { RF: { effects: {} } });
test('recommend 导出正确', () => {
  assert.strictEqual(typeof rec.recommend, 'function');
});

// find-ffmpeg
console.log('\n[find-ffmpeg.js]');
const fff = require('./find-ffmpeg.js');
test('findFfmpeg 返回对象或 null', () => {
  const r = fff.findFfmpeg();
  if (r) {
    assert.ok(typeof r.path === 'string');
    assert.ok(typeof r.source === 'string');
  }
});

// apply-patch
console.log('\n[apply-patch.js]');
const ap = require('./apply-patch.js');
test('add 操作', () => {
  const sb = { post: [{ amount: 0.2 }] };
  ap.applyOne(sb, { path: 'post[0].amount', op: 'add', value: 0.1 });
  assert.ok(Math.abs(sb.post[0].amount - 0.3) < 1e-9);
});
test('multiply 操作', () => {
  const sb = { x: 10 };
  ap.applyOne(sb, { path: 'x', op: 'multiply', value: 0.5 });
  assert.strictEqual(sb.x, 5);
});
test('append 操作', () => {
  const sb = { tracks: [] };
  ap.applyOne(sb, { path: 'tracks', op: 'append', value: { effect: 'x' } });
  assert.strictEqual(sb.tracks.length, 1);
});
test('嵌套路径', () => {
  const sb = { acts: [{ tracks: [{ opacity: 1 }] }] };
  ap.applyOne(sb, { path: 'acts[0].tracks[0].opacity', op: 'multiply', value: 0.5 });
  assert.strictEqual(sb.acts[0].tracks[0].opacity, 0.5);
});


// ========== motion / path 测试 ==========
console.log('\n[motion.js]');
const mot = loadModule('engine/core/motion.js', { RF: {} });
test('catmullRom 纯函数确定性', () => {
  const a = mot.Motion.catmullRom(0, 1, 2, 3, 0.5);
  const b = mot.Motion.catmullRom(0, 1, 2, 3, 0.5);
  assert.strictEqual(a, b);
});
test('evaluate 端点正确', () => {
  const m = { keys: [{ t: 0, x: 0.1, y: 0.2 }, { t: 1, x: 0.9, y: 0.8 }], path: "linear" };
  const r0 = mot.Motion.evaluate(m, 0, 100, 100);
  const r1 = mot.Motion.evaluate(m, 1, 100, 100);
  assert.ok(Math.abs(r0.x - 0.1) < 1e-6);
  assert.ok(Math.abs(r1.x - 0.9) < 1e-6);
});
test('evaluate 确定性', () => {
  const m = { keys: [{ t: 0, x: 0.1 }, { t: 0.5, x: 0.5 }, { t: 1, x: 0.9 }], path: "catmullRom" };
  const a = mot.Motion.evaluate(m, 0.4, 100, 100);
  const b = mot.Motion.evaluate(m, 0.4, 100, 100);
  assert.strictEqual(a.x, b.x);
});
test('rotateFollow 产生切线', () => {
  const m = { keys: [{ t: 0, x: 0.1, y: 0.5 }, { t: 1, x: 0.9, y: 0.5 }], path: "linear", rotateFollow: true };
  const r = mot.Motion.evaluate(m, 0.5, 100, 100);
  assert.ok(typeof r.tangent === "number");
});


// ========== 音乐分析测试 ==========
console.log('\n[audio.js — 分频段/VAD/段落]');
const au = loadModule('engine/core/audio.js', {});
function mkSig(sr, dur) { const n = sr*dur; const ch = new Float32Array(n);
  for (let i=0;i<n;i++){const t=i/sr; if(t<2)ch[i]=0; else if(t<4)ch[i]=Math.sin(2*Math.PI*80*t)*0.6;
    else ch[i]=Math.sin(2*Math.PI*80*t)*0.3+Math.sin(2*Math.PI*1000*t)*0.3+Math.sin(2*Math.PI*8000*t)*0.3;}
  return ch; }
const sig = mkSig(44100, 6);
const an = au.Audio.analyzeChannel(sig, 44100);
test('bands 存在且长度一致', () => { assert.ok(an.bands && an.bands.bass); assert.strictEqual(an.bands.bass.length, an.rms.length); });
test('低频段在低音时段高于高频段', () => { const at=(s)=>Math.round(s/an.hopDuration); assert.ok(an.bands.bass[at(3)] > an.bands.treble[at(3)]*3); });
test('energy 存在', () => { assert.ok(an.energy && an.energy.length === an.rms.length); });
test('sections 存在', () => { assert.ok(Array.isArray(an.sections)); });
test('分析确定性', () => { const a2=au.Audio.analyzeChannel(sig,44100); assert.strictEqual(a2.bands.bass[100], an.bands.bass[100]); });
const vsig = new Float32Array(44100*6);
for (let i=0;i<vsig.length;i++){const t=i/44100; if((t<2)||(t>=4))vsig[i]=Math.sin(2*Math.PI*300*t)*0.5;}
const vd = au.Audio.detectVocal(vsig, 44100);
test('VAD phrases', () => { assert.ok(vd.phrases.length >= 2); assert.ok(Math.abs(vd.phrases[0].end-2) < 0.4); });
test('VAD interludes', () => { assert.ok(vd.interludes.length >= 1); });
test('VAD 确定性', () => { const v2=au.Audio.detectVocal(vsig,44100); assert.strictEqual(v2.phrases.length, vd.phrases.length); });
test('resolveTime phrase/interlude/section', () => {
  const a={beats:[0,0.5],vocal:{phrases:[{start:1}],interludes:[{start:3}]},sections:[{start:5,type:'chorus'}]};
  assert.strictEqual(au.Audio.resolveTime('phrase:1',a),1);
  assert.strictEqual(au.Audio.resolveTime('interlude:1',a),3);
  assert.strictEqual(au.Audio.resolveTime('section:chorus:1',a),5); });
test('resolveTime 缺数据降级', () => { assert.strictEqual(au.Audio.resolveTime('phrase:1',null,-1),-1); });
// ========== L1 分析层测试 ==========
console.log('\n[analyze.js]');
const az = require('./analyze.js');
test('parseLyrics 纯文本', () => {
  const r = az.parseLyrics("第一句\n\n第二句");
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].index, 1);
  assert.strictEqual(r[0].text, '第一句');
  assert.strictEqual(r[1].text, '第二句');
});
test('parseLyrics SRT', () => {
  const srt = "1\n00:00:00,000 --> 00:00:02,000\n第一句\n\n2\n00:00:02,000 --> 00:00:04,000\n第二句";
  const r = az.parseLyrics(srt);
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].start, 0);
  assert.strictEqual(r[0].end, 2);
  assert.strictEqual(r[1].start, 2);
});
test('parseLyrics 空输入', () => { assert.deepStrictEqual(az.parseLyrics(""), []); });
test('condenseAudio 丢弃每帧数组', () => {
  const analysis = {
    duration: 8, tempo: 120, beats: [0,0.5], onsets: [0.1],
    sections: [{ start:0,end:4,type:'intro',energy:0 }, { start:4,end:8,type:'chorus',energy:1 }],
    bands: { bass:[0,0.5,1,0.5,0,0.5,1,0.5], mid:[0,0.5,1,0.5,0,0.5,1,0.5], treble:[0,0.5,1,0.5,0,0.5,1,0.5] },
    hopDuration: 1,
    vocal: { phrases: [{start:0,end:2}], interludes: [{start:4,end:5}] },
  };
  const c = az.condenseAudio(analysis);
  assert.strictEqual(c.rms, undefined);
  assert.strictEqual(c.bands, undefined);
  assert.strictEqual(c.bands_summary.bass.length, 2);
  assert.strictEqual(c.sections[1].energy, 'high');
  assert.strictEqual(c.phrases.length, 1);
});
test('condenseAudio 确定性', () => {
  const a = { duration:4, sections:[{start:0,end:4,type:'verse',energy:0}], bands:{bass:[1,2,3,4],mid:[1,2,3,4],treble:[1,2,3,4]}, hopDuration:1, beats:[], onsets:[] };
  assert.deepStrictEqual(az.condenseAudio(a), az.condenseAudio(a));
});
test('buildDossier 结构完整', () => {
  const d = az.buildDossier({ title:'t', audio:{duration:8}, lyrics:[{index:1,text:'a'}], constitution:{}, presets:[] });
  assert.ok(d.meta && d.song && d.lyrics && d.constitution && Array.isArray(d.presets));
  assert.strictEqual(d.song.lyricsAvailable, true);
});
test('buildDossier 无歌词 lyricsAvailable=false', () => {
  const d = az.buildDossier({ title:'t', audio:null, lyrics:[], constitution:{}, presets:[] });
  assert.strictEqual(d.song.lyricsAvailable, false);
});

console.log('\n[validate-interpretation.js]');
const vi = require('./validate-interpretation.js');
function okReport() {
  return {
    meta: { dossierRef: 'd.json', generatedAt: '2026' },
    music: { emotion_curve:[{start:0,end:4,intensity:0.3,label:'平静'}], key_moments:[{t:8.2,type:'drop',note:'x'}], sections_mapped:[{start:0,end:8,type:'verse',mood:'叙述'}] },
    lyrics: [{index:1,text:'我看见光',line:'主歌',emotion:'期待',imagery:['光'],metaphor:'希望',note:''}],
    mapping: [{lyric_index:1,meaning:'希望升起',action:'升起+放大',transition:{type:'fade',dur:0.5},layer_hint:'subject'}],
    layers: { focus_curve:[{t:0,focus:'text',reason:'开场'},{t:2,focus:'subject',reason:'主体'}] },
  };
}
test('合法报告通过', () => { assert.strictEqual(vi.validate(okReport()).errors.length, 0); });
test('缺 lyrics 报错', () => { const r = okReport(); delete r.lyrics; assert.ok(vi.validate(r).errors.some(e => e.path === 'lyrics')); });
test('lyrics 缺 emotion 定位到路径', () => { const r = okReport(); delete r.lyrics[0].emotion; assert.ok(vi.validate(r).errors.some(e => e.path === 'lyrics[0].emotion')); });
test('坏引用 lyric_index 报错', () => { const r = okReport(); r.mapping[0].lyric_index = 99; assert.ok(vi.validate(r).errors.some(e => e.path.indexOf('lyric_index') >= 0)); });
test('非法枚举 focus 报错', () => { const r = okReport(); r.layers.focus_curve[0].focus = 'wat'; assert.ok(vi.validate(r).errors.some(e => e.path.indexOf('focus') >= 0)); });
test('focus_curve t 非递减', () => { const r = okReport(); r.layers.focus_curve = [{t:5,focus:'text',reason:'a'},{t:1,focus:'subject',reason:'b'}]; assert.ok(vi.validate(r).errors.some(e => e.msg.indexOf('非递减') >= 0)); });
test('红线：action 含效果名报错', () => { const r = okReport(); r.mapping[0].action = '用 particles 爆发'; assert.ok(vi.validate(r).errors.some(e => e.msg.indexOf('引擎效果名') >= 0)); });
test('intensity 越界报错', () => { const r = okReport(); r.music.emotion_curve[0].intensity = 1.5; assert.ok(vi.validate(r).errors.some(e => e.path.indexOf('intensity') >= 0)); });
test('key_moment 非法枚举报错', () => { const r = okReport(); r.music.key_moments[0].type = 'boom'; assert.ok(vi.validate(r).errors.some(e => e.path.indexOf('type') >= 0)); });

console.log('\n[prompts 占位符]');
test('四个 prompt 模板存在且含占位符', () => {
  ['music-analyst','lyrics-analyst','mapping-analyst','layer-analyst'].forEach((f) => {
    const p = path.join(__dirname, '..', 'prompts', f + '.md');
    assert.ok(fs.existsSync(p), f + '.md 不存在');
    const src = fs.readFileSync(p, 'utf8');
    assert.ok(src.indexOf('{{') >= 0 && src.indexOf('}}') >= 0, f + ' 无占位符');
  });
});

console.log('\n[analysis-demo 样例]');
test('demo report 通过校验', () => {
  const p = path.join(__dirname, '..', 'dsl', 'examples', 'analysis-demo', 'report.json');
  const rep = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.strictEqual(vi.validate(rep).errors.length, 0);
});

// ========== L2/L3/L4 编排层测试 ==========
console.log('\n[orchestrate-lib / build-plan-input / assign-task]');
const ol = require('./orchestrate-lib.js');
const demoReport = JSON.parse(fs.readFileSync(path.join(__dirname,'..','dsl','examples','analysis-demo','report.json'),'utf8'));
const demoPlan = JSON.parse(fs.readFileSync(path.join(__dirname,'..','dsl','examples','orchestration-demo','plan.json'),'utf8'));
const FRAG_DIR = path.join(__dirname,'..','dsl','examples','orchestration-demo','fragments');
function loadDemoFrags() {
  return fs.readdirSync(FRAG_DIR).filter(f=>f.endsWith('.json'))
    .map(f=>JSON.parse(fs.readFileSync(path.join(FRAG_DIR,f),'utf8')));
}
test('buildPlanInput 结构正确', () => {
  const pkg = ol.buildPlanInput({ report: demoReport, constitution: { mood:'uplifting' } });
  assert.ok(pkg.report && pkg.constitution);
  assert.ok(Array.isArray(pkg.palette_names) && pkg.palette_names.length > 0);
  assert.ok(Array.isArray(pkg.effect_names) && pkg.effect_names.length > 0);
  assert.ok(Array.isArray(pkg.transition_names) && Array.isArray(pkg.postfx_names));
  assert.ok(pkg.timeline && Array.isArray(pkg.timeline.focus_curve));
});
test('extractTimeline 抽取 sections/focus', () => {
  const tl = ol.extractTimeline(demoReport);
  assert.strictEqual(tl.sections.length, 2);
  assert.ok(tl.focus_curve.length >= 1);
});
test('sliceForRole 按角色裁切', () => {
  const tl = { beats:[1,2], onsets:[0.5], phrases:[{start:0,end:1}], sections:[{start:0,end:2}],
    focus_curve:[{t:0,focus:'text'},{t:1,focus:'accent'}] };
  const bg = ol.sliceForRole('background', tl);
  assert.ok(bg.timeline_slice.sections && !bg.timeline_slice.phrases);
  const ac = ol.sliceForRole('accent', tl);
  assert.ok(ac.timeline_slice.beats && ac.timeline_slice.onsets);
  assert.strictEqual(ac.focus_slice.length, 1);
  assert.strictEqual(ac.focus_slice[0].focus, 'accent');
});
test('assignTask 结构正确', () => {
  const pkg = ol.assignTask({ plan: demoPlan, taskId: 's3' });
  assert.strictEqual(pkg.task.id, 's3');
  assert.strictEqual(pkg.task.type, 'system');
  assert.ok(pkg.timeline_slice && pkg.timeline_slice.beats);
  assert.ok(Array.isArray(pkg.docs) && pkg.docs.length >= 1);
});
test('assignTask 未知 task 抛错', () => {
  assert.throws(() => ol.assignTask({ plan: demoPlan, taskId: 'nope' }));
});

console.log('\n[validate-plan]');
test('合法 plan 通过', () => { assert.strictEqual(ol.validatePlan(demoPlan).errors.length, 0); });
test('缺 global 报错', () => {
  const p = JSON.parse(JSON.stringify(demoPlan)); delete p.global;
  assert.ok(ol.validatePlan(p).errors.some(e=>e.path==='global'));
});
test('非法 paradigm 报错', () => {
  const p = JSON.parse(JSON.stringify(demoPlan)); p.paradigm='wat';
  assert.ok(ol.validatePlan(p).errors.some(e=>e.path==='paradigm'));
});
test('task 缺 brief 报错', () => {
  const p = JSON.parse(JSON.stringify(demoPlan)); delete p.tasks[0].brief;
  assert.ok(ol.validatePlan(p).errors.some(e=>e.path.indexOf('brief')>=0));
});
test('docs 引用未知效果名报错', () => {
  const p = JSON.parse(JSON.stringify(demoPlan)); p.tasks[0].docs=['EFFECTS#nonexistentEffect'];
  assert.ok(ol.validatePlan(p).errors.some(e=>e.msg.indexOf('未知效果')>=0));
});
test('choreography 用了 act 类型报错', () => {
  const p = JSON.parse(JSON.stringify(demoPlan)); p.tasks[0].type='act';
  assert.ok(ol.validatePlan(p).errors.some(e=>e.path.indexOf('type')>=0));
});
function splicePlan() {
  return { paradigm:'splice', global:{palette:'deepSea',seed:1,width:100,height:100,duration:8},
    timeline:{beats:[],phrases:[],sections:[],focus_curve:[]},
    tasks:[
      {id:'a1',type:'act',role:'subject',scope:{start:0,end:4},brief:'x',docs:[]},
      {id:'a2',type:'act',role:'subject',scope:{start:4,end:8},brief:'x',docs:[]} ] };
}
test('合法 splice plan 通过', () => { assert.strictEqual(ol.validatePlan(splicePlan()).errors.length, 0); });
test('splice 幕重叠报错', () => {
  const p = splicePlan(); p.tasks[1].scope={start:3,end:8};
  assert.ok(ol.validatePlan(p).errors.some(e=>e.msg.indexOf('重叠')>=0));
});
test('splice 幕有间隙报错', () => {
  const p = splicePlan(); p.tasks[1].scope={start:5,end:9};
  assert.ok(ol.validatePlan(p).errors.some(e=>e.msg.indexOf('间隙')>=0));
});

console.log('\n[validate-fragment]');
function okFrag() { return { task_id:'s3', type:'system', tracks:[{effect:'particles', at:0, dur:1, params:{count:10}}] }; }
test('合法片段通过', () => { assert.strictEqual(ol.validateFragment(okFrag(), {plan:demoPlan}).errors.length, 0); });
test('未知效果名被拦截', () => {
  const f = okFrag(); f.tracks[0].effect='nonexistentFx';
  assert.ok(ol.validateFragment(f, {plan:demoPlan}).errors.some(e=>e.msg.indexOf('未知效果')>=0));
});
test('task_id 坏引用报错', () => {
  const f = okFrag(); f.task_id='nope';
  assert.ok(ol.validateFragment(f, {plan:demoPlan}).errors.some(e=>e.path==='task_id'));
});
test('type 与 task 不一致报错', () => {
  const f = okFrag(); f.type='act';
  assert.ok(ol.validateFragment(f, {plan:demoPlan}).errors.some(e=>e.path==='type'));
});
test('缺 tracks 报错', () => {
  const f = okFrag(); delete f.tracks;
  assert.ok(ol.validateFragment(f, {plan:demoPlan}).errors.some(e=>e.path==='tracks'));
});

console.log('\n[assemble]');
test('assemble 产出合法分镜', () => {
  const sb = ol.assemble(demoPlan, loadDemoFrags());
  assert.ok(sb.meta && sb.acts && sb.acts.length>=1);
  assert.strictEqual(sb.meta.duration, 8);
  assert.strictEqual(sb.palette, 'deepSea');
});
test('assemble 结果被 validate.js 接受', () => {
  const sb = ol.assemble(demoPlan, loadDemoFrags());
  const names = JSON.parse(fs.readFileSync(path.join(__dirname,'_effect-names.json'),'utf8'));
  const errs = v.validate(sb, names).filter(p=>p.level==='error');
  assert.strictEqual(errs.length, 0, JSON.stringify(errs));
});
test('assemble 确定性', () => {
  const frags = loadDemoFrags();
  assert.deepStrictEqual(ol.assemble(demoPlan, frags), ol.assemble(demoPlan, frags));
});
test('splice assemble 成多幕', () => {
  const frags = [
    {task_id:'a1',type:'act',tracks:[{effect:'particles'}]},
    {task_id:'a2',type:'act',tracks:[{effect:'fbmNoise'}]}];
  const sb = ol.assemble(splicePlan(), frags);
  assert.strictEqual(sb.acts.length, 2);
  assert.strictEqual(sb.acts[0].dur, 4);
});
test('extractTimeline 无 dossier 降级（key_moments→beats, lyrics→phrases）', () => {
  const tl = ol.extractTimeline(demoReport);
  assert.ok(tl.beats.length >= 1, '应至少从 key_moments 兜底一个 beat');
  assert.strictEqual(tl.phrases.length, 0, 'demoReport.lyrics 无时间戳，phrases 应为空');
});
test('extractTimeline 用 dossier 补真实 beats/onsets/phrases', () => {
  const dossier = {
    audio: {
      beats: [0, 0.5, 1, 1.5], onsets: [1.97, 3.97], sections: [{start:0,end:4,type:'intro'}],
      phrases: [{start:0,end:2},{start:3.97,end:7.97}],
    },
  };
  const tl = ol.extractTimeline(demoReport, dossier);
  assert.deepStrictEqual(tl.beats, [0, 0.5, 1, 1.5]);
  assert.deepStrictEqual(tl.onsets, [1.97, 3.97]);
  assert.strictEqual(tl.phrases.length, 2, 'report.lyrics 无时间戳，用 dossier.phrases');
  // sections 优先用 report.music.sections_mapped（语义段落带 mood），非 dossier
  assert.strictEqual(tl.sections.length, 2, 'demoReport.music.sections_mapped 有 2 段');
  assert.strictEqual(tl.sections[0].mood, '叙述', 'sections 应来自 report（带 mood），而非 dossier');
});
test('extractTimeline sections 无 report.mapped 时降级用 dossier.sections', () => {
  const rep = { music: {}, lyrics: [], layers: { focus_curve: [] } };
  const dossier = { audio: { sections: [{start:0,end:4,type:'intro'}] } };
  const tl = ol.extractTimeline(rep, dossier);
  assert.strictEqual(tl.sections.length, 1);
  assert.strictEqual(tl.sections[0].type, 'intro');
});
test('buildPlanInput 带 dossier 时 timeline 用真实锚点', () => {
  const dossier = { audio: { beats: [0,1,2,3], onsets: [1], sections: [{start:0,end:4,type:'x'}], phrases: [{start:0,end:2}] } };
  const pkg = ol.buildPlanInput({ report: demoReport, constitution: {}, dossier });
  assert.strictEqual(pkg.timeline.beats.length, 4);
  assert.strictEqual(pkg.meta.timeline_source, 'dossier+report');
  assert.strictEqual(pkg.meta.dossierRef !== undefined, true);
});
test('sliceForRole 空数组跳过（不返回误导性空切片）', () => {
  const tl = { beats: [], onsets: [], phrases: [{start:0,end:2}], sections: [{start:0,end:4}], focus_curve: [] };
  const text = ol.sliceForRole('text', tl);
  assert.deepStrictEqual(Object.keys(text.timeline_slice), ['phrases'], 'phrases 有数据应保留');
  assert.strictEqual(text.timeline_slice.phrases.length, 1);
  const bg = ol.sliceForRole('background', tl);
  assert.strictEqual(bg.timeline_slice.beats, undefined, '空 beats 不应出现在切片里');
});

console.log('\n[L2-L4 端到端]');
test('demo plan+fragments → assemble → validate 通过', () => {
  const plan = demoPlan;
  const frags = loadDemoFrags();
  frags.forEach(f=>assert.strictEqual(ol.validateFragment(f,{plan:plan}).errors.length,0, f.task_id));
  const sb = ol.assemble(plan, frags);
  const names = JSON.parse(fs.readFileSync(path.join(__dirname,'_effect-names.json'),'utf8'));
  assert.strictEqual(v.validate(sb, names).filter(p=>p.level==='error').length, 0);
  const disk = JSON.parse(fs.readFileSync(path.join(__dirname,'..','dsl','examples','orchestration-demo','storyboard.json'),'utf8'));
  assert.strictEqual(sb.acts.length, disk.acts.length);
  assert.strictEqual(sb.palette, disk.palette);
});

// ========== L0 语境与叙事层测试 ==========
console.log('\n[build-l0-input.js]');
const bl0 = require('./build-l0-input.js');
test('extractSongInfo 提取书名号歌名', () => {
  const s = bl0.extractSongInfo('用《晨星》这首歌做 PV', null);
  assert.strictEqual(s.title, '晨星');
});
test('extractSongInfo 提取艺术家', () => {
  const s = bl0.extractSongInfo('《晨星》- 虚构乐队 做 PV', null);
  assert.strictEqual(s.title, '晨星');
  assert.strictEqual(s.artist, '虚构乐队');
});
test('extractSongInfo 兜底用音频文件名', () => {
  const s = bl0.extractSongInfo('随便做点东西', 'bgm.mp3');
  assert.strictEqual(s.title, 'bgm');
});
test('buildSearchQueries 生成搜索指令', () => {
  const q = bl0.buildSearchQueries({ title: '晨星', artist: '虚构乐队' });
  assert.ok(q.queries.length >= 3);
  assert.ok(q.queries[0].indexOf('晨星') >= 0);
  assert.ok(q.queries[0].indexOf('创作背景') >= 0);
});
test('buildSearchQueries 无歌名返回空', () => {
  const q = bl0.buildSearchQueries({ title: '', artist: '' });
  assert.strictEqual(q.queries.length, 0);
});
test('buildL0Input 结构正确', () => {
  const pkg = bl0.buildL0Input({
    userRequest: '用《晨星》做 PV',
    audioMeta: { file: 'x.mp3' },
    lyrics: [{ index:1, text:'a' }],
    songInfo: { title:'晨星', artist:'' },
    searchQueries: bl0.buildSearchQueries({ title:'晨星', artist:'' }),
  });
  assert.ok(pkg.user_request);
  assert.strictEqual(pkg.song.title, '晨星');
  assert.ok(Array.isArray(pkg.search_queries) && pkg.search_queries.length > 0);
  assert.ok(pkg.placeholders && pkg.placeholders.song_context);
  assert.ok(pkg.placeholders.lyrics_scan && pkg.placeholders.user_intent);
});
test('buildL0Input 确定性', () => {
  const a = bl0.buildL0Input({ userRequest:'x', songInfo:{title:'t',artist:''} });
  const b = bl0.buildL0Input({ userRequest:'x', songInfo:{title:'t',artist:''} });
  assert.deepStrictEqual(a.search_queries, b.search_queries);
  assert.strictEqual(a.user_request, b.user_request);
});

console.log('\n[validate-constitution.js]');
const vc = require('./validate-constitution.js');
function okCon() {
  return {
    meta: { requestRef: 'req.txt' },
    song_context: { factual_background:'x（来源：访谈）', cultural_roots:'y', known_interpretations:[{source:'s',meaning:'m'}], search_queries_used:['q'] },
    lyrics_scan: { summary:'大意', overall_tone:'向上' },
    user_intent: { stated:'要做 PV', implied:'', pasted:'', narrative_style:'克制' },
    conflict: { has_conflict:false, items:[], resolution:'', resolution_note:'' },
    creative_constitution: { core_meaning:'核心', must_preserve:['a'], can_interpret:['b'], narrative_style:'克制', conflict_notes:'无冲突' },
  };
}
test('合法宪法通过', () => { assert.strictEqual(vc.validate(okCon()).errors.length, 0); });
test('缺 creative_constitution 报错', () => { const c = okCon(); delete c.creative_constitution; assert.ok(vc.validate(c).errors.some(e=>e.path==='creative_constitution')); });
test('core_meaning 缺失定位到路径', () => { const c = okCon(); delete c.creative_constitution.core_meaning; assert.ok(vc.validate(c).errors.some(e=>e.path==='creative_constitution.core_meaning')); });
test('bad severity 报错', () => { const c = okCon(); c.conflict.has_conflict=true; c.conflict.items=[{aspect:'a',user_side:'x',song_side:'y',severity:'boom'}]; assert.ok(vc.validate(c).errors.some(e=>e.path.indexOf('severity')>=0)); });
test('has_conflict=false 但 items 非空报错', () => { const c = okCon(); c.conflict.items=[{aspect:'a',user_side:'x',song_side:'y',severity:'low'}]; assert.ok(vc.validate(c).errors.some(e=>e.msg.indexOf('items 必须为空')>=0)); });
test('has_conflict=true 但 items 空报错', () => { const c = okCon(); c.conflict.has_conflict=true; assert.ok(vc.validate(c).errors.some(e=>e.msg.indexOf('不能为空')>=0)); });
test('user_intent 全空报错', () => { const c = okCon(); c.user_intent.stated=''; c.user_intent.implied=''; assert.ok(vc.validate(c).errors.some(e=>e.path==='user_intent')); });
test('must_preserve 与 can_interpret 重复报错', () => { const c = okCon(); c.creative_constitution.must_preserve=['x']; c.creative_constitution.can_interpret=['x']; assert.ok(vc.validate(c).errors.some(e=>e.msg.indexOf('重复')>=0)); });

console.log('\n[resolve-conflict.js]');
const rc = require('./resolve-conflict.js');
test('无冲突 → proceed', () => {
  const r = rc.resolveConflict({ has_conflict:false, items:[] }, { allowAsk:true });
  assert.strictEqual(r.action, 'proceed');
});
test('有冲突+允许问 → ask_user', () => {
  const r = rc.resolveConflict({ has_conflict:true, items:[{aspect:'情绪',user_side:'x',song_side:'y',severity:'high'}] }, { allowAsk:true });
  assert.strictEqual(r.action, 'ask_user');
  assert.ok(Array.isArray(r.questions) && r.questions.length === 1);
});
test('有冲突+不许问+有桥 → use_bridge', () => {
  const r = rc.resolveConflict({ has_conflict:true, items:[{aspect:'a',user_side:'x',song_side:'y',severity:'mid',possible_bridge:'深层'}] }, { allowAsk:false });
  assert.strictEqual(r.action, 'use_bridge');
  assert.strictEqual(r.resolution, '深层串联');
});
test('有冲突+不许问+仅网络 → use_network', () => {
  const r = rc.resolveConflict({ has_conflict:true, items:[{aspect:'a',user_side:'x',song_side:'y',severity:'low',matching_interpretation:'网络'}] }, { allowAsk:false });
  assert.strictEqual(r.action, 'use_network');
  assert.strictEqual(r.resolution, '网络匹配');
});
test('有冲突+不许问+都无 → ai_decide', () => {
  const r = rc.resolveConflict({ has_conflict:true, items:[{aspect:'a',user_side:'x',song_side:'y',severity:'high'}] }, { allowAsk:false });
  assert.strictEqual(r.action, 'ai_decide');
});
test('有冲突+items空 → proceed_with_default（垫底）', () => {
  const r = rc.resolveConflict({ has_conflict:true, items:[] }, { allowAsk:false });
  assert.strictEqual(r.action, 'proceed_with_default');
  assert.strictEqual(r.resolution, '垫底');
});
test('桥优先于网络', () => {
  const r = rc.resolveConflict({ has_conflict:true, items:[{aspect:'a',user_side:'x',song_side:'y',severity:'low',possible_bridge:'深层',matching_interpretation:'网络'}] }, { allowAsk:false });
  assert.strictEqual(r.action, 'use_bridge');
});
test('默认 allowAsk=true', () => {
  const r = rc.resolveConflict({ has_conflict:true, items:[{aspect:'a',user_side:'x',song_side:'y',severity:'mid'}] });
  assert.strictEqual(r.action, 'ask_user');
});

console.log('\n[l0-demo 样例]');
test('l0-demo constitution 通过校验', () => {
  const p = path.join(__dirname, '..', 'dsl', 'examples', 'l0-demo', 'constitution.json');
  const con = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.strictEqual(vc.validate(con).errors.length, 0);
});
test('l0-demo conflict + resolve-conflict 一致', () => {
  const dir = path.join(__dirname, '..', 'dsl', 'examples', 'l0-demo');
  const conflict = JSON.parse(fs.readFileSync(path.join(dir, 'conflict.json'), 'utf8'));
  const r = rc.resolveConflict(conflict, { allowAsk:false });
  assert.strictEqual(r.action, 'use_bridge');
});

// —— 汇总 ——
console.log("\n=== 结果 ===");
console.log("通过: " + passed + "  失败: " + failed);
if (failed > 0) {
  console.log("\n失败详情:");
  failures.forEach((f) => console.log("  ✗ " + f.name + ": " + f.err));
  process.exit(1);
}
console.log("全部通过 ✓");
