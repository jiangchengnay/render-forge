// engine/core/expression.js
// 轻量表达式求值器。让 DSL 参数可以写动态表达式，解锁「跟随/联锁/参数曲线」。
// 支持：
//   变量：t（全局时间）, local（clip 本地时间）, p（进度 0-1）, ease（缓动后进度）
//         W, H, PI, TAU
//   函数：sin cos tan abs min max floor ceil round sqrt pow exp log lerp clamp smoothstep
//   运算符：+ - * / % ** 一元- 括号 比较 < > <= >= == != 三元 ?:
//   引用：clips.actId.trackIndex.p  （其他 clip 的进度）
//   写法：字符串以 '=' 开头即视为表达式，如 "=t*2"、"=clips.a1.0.ease*0.5"
(function (RF) {

  // —— 词法 ——
  function tokenize(src) {
    const toks = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      // 数字
      if (/[0-9.]/.test(c)) {
        let j = i;
        while (j < src.length && /[0-9.]/.test(src[j])) j++;
        toks.push({ t: 'num', v: parseFloat(src.slice(i, j)) });
        i = j; continue;
      }
      // 标识符（含点，用于 clips.a1.0.p）
      if (/[a-zA-Z_$]/.test(c)) {
        let j = i;
        while (j < src.length && /[a-zA-Z0-9_$.]/.test(src[j])) j++;
        toks.push({ t: 'id', v: src.slice(i, j) });
        i = j; continue;
      }
      // 双字符运算符
      const two = src.slice(i, i + 2);
      if (['<=','>=','==','!=','**'].indexOf(two) >= 0) {
        toks.push({ t: 'op', v: two }); i += 2; continue;
      }
      // 单字符
      if ('+-*/%<>?:()!,'.indexOf(c) >= 0) {
        toks.push({ t: 'op', v: c }); i++; continue;
      }
      throw new Error('表达式非法字符: ' + c);
    }
    return toks;
  }

  // —— 语法分析（递归下降）——
  function parse(toks) {
    let pos = 0;
    const peek = () => toks[pos];
    const eat = (v) => {
      const t = toks[pos];
      if (!t || (v != null && t.v !== v)) throw new Error('期望 ' + v + '，实际 ' + (t ? t.v : 'EOF'));
      pos++; return t;
    };

    function parseExpr() { return parseTernary(); }
    function parseTernary() {
      const cond = parseBinary(0);
      if (peek() && peek().v === '?') {
        eat('?');
        const a = parseExpr();
        eat(':');
        const b = parseExpr();
        return { k: 'tern', cond, a, b };
      }
      return cond;
    }
    const PREC = { '==':1,'!=':1,'<':2,'>':2,'<=':2,'>=':2,'+':3,'-':3,'*':4,'/':4,'%':4,'**':5 };
    function parseBinary(minPrec) {
      let left = parseUnary();
      while (peek() && peek().t === 'op' && PREC[peek().v] != null && PREC[peek().v] >= minPrec) {
        const op = eat().v;
        const right = parseBinary(PREC[op] + (op === '**' ? 0 : 1));
        left = { k: 'bin', op, left, right };
      }
      return left;
    }
    function parseUnary() {
      if (peek() && peek().v === '-') { eat('-'); return { k: 'neg', x: parseUnary() }; }
      if (peek() && peek().v === '+') { eat('+'); return parseUnary(); }
      return parsePrimary();
    }
    function parsePrimary() {
      const t = peek();
      if (!t) throw new Error('表达式意外结束');
      if (t.t === 'num') { eat(); return { k: 'num', v: t.v }; }
      if (t.t === 'id') {
        eat();
        // 函数调用
        if (peek() && peek().v === '(') {
          eat('(');
          const args = [];
          if (peek() && peek().v !== ')') {
            args.push(parseExpr());
            while (peek() && peek().v === ',') { eat(','); args.push(parseExpr()); }
          }
          eat(')');
          return { k: 'call', name: t.v, args };
        }
        return { k: 'ref', path: t.v };
      }
      if (t.v === '(') { eat('('); const e = parseExpr(); eat(')'); return e; }
      throw new Error('表达式语法错误: ' + t.v);
    }
    const ast = parseExpr();
    if (pos < toks.length) throw new Error('表达式有多余内容: ' + toks[pos].v);
    return ast;
  }

  // —— 求值 ——
  const FN = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    abs: Math.abs, min: Math.min, max: Math.max,
    floor: Math.floor, ceil: Math.ceil, round: Math.round,
    sqrt: Math.sqrt, pow: Math.pow, exp: Math.exp, log: Math.log,
    lerp: (a, b, t) => a + (b - a) * t,
    clamp: (x, a, b) => Math.max(a, Math.min(b, x)),
    smoothstep: (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); },
  };

  function evalNode(node, scope) {
    switch (node.k) {
      case 'num': return node.v;
      case 'neg': return -evalNode(node.x, scope);
      case 'ref': return resolveRef(node.path, scope);
      case 'bin': {
        const a = evalNode(node.left, scope);
        const b = evalNode(node.right, scope);
        switch (node.op) {
          case '+': return a + b; case '-': return a - b;
          case '*': return a * b; case '/': return a / b;
          case '%': return a % b; case '**': return Math.pow(a, b);
          case '<': return a < b ? 1 : 0; case '>': return a > b ? 1 : 0;
          case '<=': return a <= b ? 1 : 0; case '>=': return a >= b ? 1 : 0;
          case '==': return a === b ? 1 : 0; case '!=': return a !== b ? 1 : 0;
        }
        throw new Error('未知运算符 ' + node.op);
      }
      case 'tern': return evalNode(node.cond, scope) ? evalNode(node.a, scope) : evalNode(node.b, scope);
      case 'call': {
        // audio.inSection("chorus") 之类的方法调用
        if (node.name.indexOf('.') >= 0) {
          const ps = node.name.split('.');
          if (ps[0] === 'audio' && scope.audio && typeof scope.audio[ps[1]] === 'function') {
            return scope.audio[ps[1]].apply(scope.audio, node.args.map((a) => evalNode(a, scope)));
          }
          reportError('未知方法: ' + node.name);
          return 0;
        }
        const fn = FN[node.name];
        if (!fn) throw new Error('未知函数 ' + node.name);
        return fn.apply(null, node.args.map((a) => evalNode(a, scope)));
      }
    }
    throw new Error('未知节点 ' + node.k);
  }

  // —— 错误收集 ——
  const errors = [];
  function reportError(msg) {
    errors.push(msg);
    if (errors.length < 50) console.warn("[RF 表达式]", msg);
  }
  function getErrors() { return errors.slice(); }
  function clearErrors() { errors.length = 0; }

  function resolveRef(path, scope) {
    // 内置变量
    if (path in scope) return scope[path];
    // audio.<field>
    const ap = path.split('.');
    if (ap[0] === 'audio' && scope.audio) {
      const v = scope.audio[ap[1]];
      if (typeof v === 'function') return v;
      return v != null ? v : 0;
    }
    // clips.<actId>.<trackIndex>.<field>
    const parts = path.split('.');
    if (parts[0] === 'clips' && scope.clips) {
      const act = scope.clips[parts[1]];
      if (!act) return 0;
      const clip = act[parts[2]];
      if (!clip) return 0;
      const field = parts[3];
      return clip[field] != null ? clip[field] : 0;
    }
    // 未知变量：上报 + 返回 0（不打断渲染）
    reportError("未知变量: " + path);
    return 0;
  }

  // —— 缓存 AST ——
  const cache = new Map();
  function compile(src) {
    if (cache.has(src)) return cache.get(src);
    const ast = parse(tokenize(src));
    cache.set(src, ast);
    return ast;
  }

  // 是否是表达式（以 = 开头）
  function isExpr(v) { return typeof v === 'string' && v.length > 1 && v[0] === '='; }

  // 求值一个表达式字符串
  function evalExpr(src, scope) {
    try { return evalNode(compile(src.slice(1)), scope); }
    catch (e) {
      reportError("求值失败 '" + src + "': " + e.message);
      return 0;
    }
  }

  // —— 递归处理 params，把表达式求值 ——
  // 每次渲染前调用（因为表达式可能依赖 t）
  function resolveParams(raw, scope) {
    const walk = (v) => {
      if (typeof v === 'string') {
        if (isExpr(v)) return evalExpr(v, scope);
        return v;
      }
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object') {
        const o = {};
        for (const k in v) o[k] = walk(v[k]);
        return o;
      }
      return v;
    };
    return walk(raw);
  }

  RF.Expression = {
    compile, evalExpr, isExpr, resolveParams, tokenize, parse,
    getErrors, clearErrors,
  };
})(window.RF = window.RF || {});
