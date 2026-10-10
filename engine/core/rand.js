// engine/core/rand.js
// 确定性伪随机。同一个 seed 无论何时渲染都得到同一序列，保证可复现。

(function (RF) {
  // mulberry32：快、分布好、状态小
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 字符串 -> 32bit 种子
  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  class Rng {
    constructor(seed) {
      this.seed = typeof seed === "number" ? seed >>> 0 : hashSeed(seed == null ? "rf" : seed);
      this.next = mulberry32(this.seed);
    }
    // [0,1)
    float() { return this.next(); }
    // [min,max)
    range(min, max) { return min + this.next() * (max - min); }
    // [min,max] 整数
    int(min, max) { return Math.floor(min + this.next() * (max - min + 1)); }
    // 以 p 概率为真
    chance(p) { return this.next() < p; }
    // 从数组取一个
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    // 单位圆内均匀点
    onCircle() {
      const a = this.next() * Math.PI * 2;
      return { x: Math.cos(a), y: Math.sin(a), a };
    }
    // 标准正态（Box-Muller）
    gauss() {
      let u = 0, v = 0;
      while (u === 0) u = this.next();
      while (v === 0) v = this.next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    // 派生子流：给某个图层/元素独立且稳定的随机序列
    fork(tag) {
      return new Rng((this.seed ^ hashSeed(tag)) >>> 0);
    }
    reset() { this.next = mulberry32(this.seed); }
  }

  RF.Rng = Rng;
  RF.hashSeed = hashSeed;
  RF.mulberry32 = mulberry32;
})(window.RF = window.RF || {});
