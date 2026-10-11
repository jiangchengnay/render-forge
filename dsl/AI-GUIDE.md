# 给 AI 的分镜生成指南

> 把本文件（连同 `dsl/schemas/storyboard.schema.md`）交给任意 LLM，它就能产出可用的分镜 JSON。

## 你的任务

根据用户的需求，产出一份分镜 JSON。你**不需要**写任何代码，只需输出 JSON。

## 先想清楚这几件事

1. **主题**：作品要表达什么？（产品发布 / 开源宣发 / 歌词 MV / 数据展示）
2. **时长**：通常 8-20 秒
3. **节奏**：几幕？每幕多长？（建议 3-5 幕，每幕 2-4 秒）
4. **配色**：从 13 套里选一个（见 schema）

## 两种写法

### 写法 A：用模板（最快）

```json
{
  "template": "product-launch",
  "slots": {
    "brand": "MyProduct",
    "tagline": "一句话说清价值",
    "features": ["特性一", "特性二", "特性三", "特性四"],
    "ctaTitle": "npm i my-product",
    "palette": "deepSea"
  }
}
```

可用模板：`product-launch` / `open-source` / `music-video` / `data-story`。
适合：需求明确、要快速出片。

### 写法 B：手写 acts（灵活）

```json
{
  "meta": { "title": "作品名", "width": 1080, "height": 1080, "duration": 10, "seed": 42 },
  "palette": "deepSea",
  "post": [
    { "effect": "bloom", "amount": 0.4, "threshold": 0.7, "radius": 16 },
    { "effect": "vignette", "amount": 0.55 },
    { "effect": "grain", "amount": 0.05 }
  ],
  "acts": [
    {
      "id": "intro", "dur": 3,
      "background": { "type": "radial", "inner": "#0a1530", "outer": "#020610" },
      "transitionIn": { "type": "fade", "dur": 0.5 },
      "transitionOut": { "type": "wipe", "dur": 0.35, "dir": "left" },
      "camera": { "zoomFrom": 1.15, "zoomTo": 1.0, "ease": "outCubic" },
      "tracks": [
        { "effect": "dotGrid", "at": 0, "dur": 3, "params": { "reveal": "radial" } },
        { "effect": "titleCard", "at": 0.5, "dur": 2.5, "ease": "outCubic",
          "params": { "title": "标题", "subtitle": "副标题", "x": 0.5, "y": 0.55 } }
      ]
    }
  ]
}
```

## 参考示例（强烈建议先读）

`dsl/examples/` 里有 14 个高质量示例，按场景选读：

| 文件 | 场景 | 特点 |
|---|---|---|
| `aurora-emergence.json` | 抽象氛围 | 极光流形、多幕节奏 |
| `starlight-mv.json` | 歌词 MV | 逐句一幕、贝塞尔文字、歌词高亮 |
| `opencode-launch.json` | 开源宣发 | 终端、数据、标签云 |
| `renderforge-product.json` | 产品片 | 浏览器框、特性列表、CTA |
| `beat-demo.json` | 节拍对齐 | `at: "beat:N"` 用法 |
| `cn-typography.json` | 中文排版 | 长文本自动换行 |
| `showcase-advanced.json` | 高级特性 | 表达式、分组、镜头 |
| `template-product.json` | 模板用法 | 最简写法 |
| `primitive-shapes.json` | 图元 | 精确摆放三角/星/圆/方/六边形 |
| `path-draw.json` | 路径 | 折线生长 + 平滑曲线 |
| `motion-keyframes.json` | 关键帧运动 | 4 关键点曲线 + 朝向跟随 |
| `group-nested.json` | 分组容器 | 两层嵌套 + 父子联动 |
| `flagship.json` | 综合演示 | 16 秒 4 幕全特性 |
| `scenelet-demo.json` | 片段库 | include 组合出成片 |

**读几个再动手，比从零构造强得多。**

## 效果速查表

`dsl/EFFECTS.md` 列出全部 58 个效果——名称、分类、一句话说明、参数个数。

按需求选：
- 要氛围底纹 → noise / gradientBlob
- 要动态元素 → particles / flowfield
- 要几何美感 → polygonRing / lissajous / morphPolygon
- 要产品演示 → browserFrame / terminalWindow / counterNumber
- 要歌词/标题 → lyricLine / titleCard
- 要装饰 → dotGrid / geoShapes / frameRect

## 布局：用锚点，别手算坐标

```json
{ "effect": "titleCard", "anchor": "bottom", "offsetY": -0.08, "safeArea": true,
  "params": { "title": "标题" } }
```

锚点：`top-left` `top` `top-right` `left` `center` `right` `bottom-left` `bottom` `bottom-right`
- `offsetX/offsetY`：相对画布的偏移（0-1）
- `safeArea: true`：自动避开 8% 边距

**比手算 x/y 更稳，且不会贴边。**

## 图元 / 路径 / 关键帧运动 / 分组容器

### 图元 shape

```json
{ "effect": "shape",
  "params": { "kind": "polygon", "points": [[-0.5,0.6],[0.5,0.6],[0,-0.7]],
    "size": 0.22, "x": 0.3, "y": 0.4, "rotate": 0.3,
    "fill": "#0a3a6a", "stroke": "$accent", "lineWidth": 3 } }
```

kind: `polygon` / `star`（starPoints+innerRadius）/ `circle`（radius）/ `rect`（w+h）/ `line` / `path`。
**坐标系**：points 归一化 [-1,1] 相对 size；x/y 画布比例；rotate 弧度。

### 路径 path

```json
{ "effect": "path",
  "params": { "points": [[0.1,0.7],[0.3,0.3],[0.5,0.6],[0.7,0.2]],
    "smooth": "catmullRom", "grow": true, "stroke": "$accent", "lineWidth": 4 } }
```

**坐标系**：points 画布归一化 [0,1]。smooth: `linear` / `catmullRom`。grow 逐段生长。

### 关键帧运动 motion

```json
{ "effect": "shape",
  "motion": { "keys": [{ "t":0,"x":0.1,"y":0.8 },{ "t":0.5,"x":0.5,"y":0.2 },
                        { "t":1,"x":0.9,"y":0.6 }],
    "path": "catmullRom", "ease": "inOutCubic", "rotateFollow": true },
  "params": { "kind": "polygon", "sides": 3, "size": 0.06 } }
```

t 为 clip 进度 0-1。rotateFollow: true 时朝运动切线方向。

### 属性频道 channels（连续编舞）

storyboard 级、**绝对秒**的关键帧轨道，一个 channel 可跨幕驱动多个 clip（这是"连续编舞"的核心）。

```json
{
  "channels": {
    "riseY": { "keys": [{ "t": 0, "value": 0.85 }, { "t": 4, "value": 0.45 }], "path": "catmullRom" },
    "spin":  { "keys": [{ "t": 0, "value": 0 }, { "t": 8, "value": 6.28 }], "path": "linear" }
  },
  "acts": [
    { "id": "a1", "dur": 4, "tracks": [
      { "effect": "morphPolygon", "at": 0, "dur": 4, "bind": { "y": "riseY", "rotate": "spin" } }
    ] }
  ]
}
```

- `channels.<名>`：`{ keys:[{t:秒, value}], path:"linear|catmullRom", ease?, loop? }`
- clip 用 `bind: { x/y/scale/rotate/opacity: "channel名" }` 绑定到 channel。
- **与 motion 的区别**：motion.keys 的 t 是**clip 进度 0-1**（单段补间）；channels 的 t 是**全局秒**（可跨幕，连续）。
- 用途：让同一组件的运动跨越幕边界连续（真正编舞），而非"每幕各动各的"。

### 分组容器 group

```json
{ "type": "group", "id": "hero", "at": 0, "dur": 4,
  "transform": { "x": 0.5, "y": 0.5, "scale": 1 },
  "motion": { "keys": [{ "t":0,"rotate":0 },{ "t":1,"rotate":6.28 }] },
  "children": [
    { "effect": "shape", "params": { "kind": "polygon", "sides": 6, "size": 0.12 } },
    { "effect": "labelText", "params": { "text": "NESTED", "x": 0.5, "y": 0.85 } } ] }
```

子项在容器局部坐标系渲染。支持任意层嵌套。

### 视频特效 vfx

- `shake` 震屏：`{ "effect":"shake", "params": { "amp":0.03, "freq":30, "decay":0.5 } }`
- `waveform` 音频波形：`{ "effect":"waveform", "params": { "mode":"bars", "count":48 } }`
- `lensFlare` 镜头光晕：`{ "effect":"lensFlare", "params": { "x":0.7, "y":0.3, "streak":true } }`
- `lightSweep` 光扫：`{ "effect":"lightSweep", "params": { "angle":45, "width":0.1 } }`
- `textMask` 文字遮罩：`{ "effect":"textMask", "params": { "text":"MASK", "mode":"cutout" } }`

## 音乐驱动

载入音频后，可用音乐数据驱动视觉。

### 表达式
| 变量 | 含义 |
|---|---|
| `audio.bass` / `mid` / `treble` | 低/中/高频能量 0-1 |
| `audio.energy` | 全频段能量 |
| `audio.rms` / `flux` | 响度 / 谱通量 |
| `audio.beat` | 拍点 0/1 |
| `audio.inVocal` | 在唱 0/1 |
| `audio.inSection(\"chorus\")` | 在副歌 0/1 |

```json
{ \"effect\": \"ripples\", \"params\": { \"maxRadius\": \"=0.2 + audio.bass * 0.5\" } }
```

### at 语法
`beat:N` / `phrase:N` / `interlude:N` / `section:chorus:N`（缺数据安全降级）。
```json
{ \"effect\": \"lyricLine\", \"at\": \"phrase:1\", \"dur\": 3 }
```

### 双轨 VAD
`RF.Audio.analyzeStems(vocals, instrumental)` → `vocal.phrases`（在唱）/ `vocal.interludes`（间奏）。只给混合轨时 `vocal.reliable=false`。

### 音画对齐
`node tools/export-webcodecs.js in.json out.mp4 --audio=bgm.mp3 --fit=audio`（audio/storyboard/strict）

## 硬性规则（违反会出「AI 屏保」）

1. **至少 2 种不同效果**，不要只用一种
2. **不同 clip 用不同 ease**，不要全是 linear
3. **颜色用占位符** `$0`~`$4` / `$accent` / `$fg` / `$bg`，不要硬编码 hex（除了背景深色）
4. **至少挂 1-2 项后处理**（bloom / vignette / grain）
5. **文字不要压在画面正中**（用 y=0.85 或 y=0.15）
6. **多幕用不同转场类型**（fade / wipe / iris / glitch 轮着来）

## 高级技巧

### 表达式：让参数动起来

参数值以 `=` 开头即为每帧求值的表达式：

```json
{ "effect": "ripples", "params": { "maxRadius": "=t * 0.15" } }
{ "effect": "morphPolygon", "params": { "cx": "=0.5 + sin(t * 2) * 0.15" } }
{ "effect": "labelText", "params": { "opacity": "=clips.intro.0.ease" } }
{ "effect": "morphPolygon", "params": { "y": "=t > 2 ? 0.7 : 0.3" } }
```

变量：`t`（全局秒）`local`（clip 内秒）`p` `ease`（0-1 进度）`W` `H` `PI`
函数：`sin cos abs min max floor round sqrt pow lerp clamp smoothstep`
引用：`clips.<幕id>.<clip序号>.{p,ease,at,dur}`

### 分组：让多个元素联动

```json
{ "effect": "morphPolygon", "group": "logo",
  "groupTransform": { "scaleFrom": 0.5, "scaleTo": 1, "rotateFrom": 0, "rotateTo": 6.28, "dur": 2 } }
```

### 镜头：推拉摇移

```json
{ "camera": { "zoomFrom": 1.2, "zoomTo": 0.9, "xFrom": 0.5, "xTo": 0.4,
               "rotateFrom": 0, "rotateTo": 0.1, "ease": "inOutCubic" } }
```

### 节拍对齐

载入音频后，`at` 可写 beat 语法（无音频时按 120 BPM 兜底）：

```json
{ "effect": "ripples", "at": "beat:4", "dur": 0.4 }
{ "effect": "particles", "at": { "beat": 8, "offset": 0.2 } }
```

### 单位写法

三种都支持：
- `0.5`（相对画布短边，最常用）
- `"50px"`（像素，自动换算）
- `"50%"`（等同 0.5）

## 产出后自检

写完 JSON，检查：
- [ ] 每个 effect 名在清单里？
- [ ] 参数名拼对了吗？
- [ ] 至少 2 种效果 + 2 项后处理？
- [ ] 文字位置避开中心？

（可用 `npm run validate -- 你的.json` 自动检查）

## 迭代

如果效果不满意：
1. 在浏览器里载入，看关键帧
2. 跑 `npm run critique -- 你的.json` 看批评报告
3. 根据报告改参数，回到步骤 1

2-4 轮后质量会明显提升。
