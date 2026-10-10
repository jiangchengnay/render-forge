# 分镜 DSL 速览

> 首轮阅读用。需要参数细节时看 `storyboard.schema.md` 或对应效果。

## 顶层

```json
{
  "meta": {
    "title": "名",
    "width": 1080,
    "height": 1080,
    "duration": 10,
    "seed": 42
  },
  "palette": "deepSea",
  "post": [
    {
      "effect": "bloom",
      "amount": 0.4
    }
  ],
  "acts": [
    {
      "id": "a1",
      "dur": 4,
      "tracks": [
        {
          "effect": "fbmNoise",
          "at": 0,
          "dur": 4,
          "params": {}
        }
      ]
    }
  ]
}
```

## 效果速览（按分类）

### feedback

- `feedback` — 帧反馈，形成拖尾/万花筒。高级感来源。

### particle

- `flowfield` ★ — 流动场。粒子沿噪声场流动，丝绸质感。stateful。
- `particles` ★ — 粒子系统。stateful，支持 6 种行为。

### math

- `kaleidoscope` — 万花筒对称。
- `lissajous` — 利萨如曲线。
- `metaball` — 融合球（blur+contrast 模拟）。

### media

- `image` — 显示注册过的图片素材。
- `video` — 播放注册过的视频素材（逐帧 drawImage）。
- `svg` — 显示 SVG 素材。
- `imageMask` — 用图片作为遮罩裁切下层。

### noise

- `fbmNoise` — 分形噪声场，最常用的氛围底纹。
- `noiseMask` — 噪声遮罩，用噪声裁出流动形状。

### geometry

- `polygonRing` — 多边形环绕中心排布。
- `ripples` — 同心圆波纹从中心扩散。
- `gridWarp` — 网格点阵形变。
- `strokeGrow` — 路径描边逐段生长。
- `morphPolygon` — 多边形旋转+呼吸缩放。

### text

- `titleCard` — 产品片大标题卡：徽章+主标+副标+标签+分隔线，逐字进入。
- `lyricLine` — MV 歌词，三种高亮模式。
- `bezierText` — 文字沿 Catmull-Rom 曲线排布。
- `bulletList` — 特性列表，逐项出现。
- `codeBlock` — 代码块，逐字打出。
- `typewriter` — 打字机。
- `wordPop` — 逐字弹入。
- `blurFocus` — 从模糊到清晰聚焦。
- `labelText` — 轻量标签文字，用于副标/说明。

### data

- `counterNumber` — 数字滚动（带千分位、前后缀）。
- `progressRing` — 圆环进度条。
- `barChart` — 条形图，逐条生长。
- `lineChart` — 折线图，生长+端点+填充。
- `pieChart` — 饼图/环图。
- `radarChart` — 雷达图。

### decor

- `geoShapes` — 几何形状散布（圆/方/三角/六边形）。
- `dotGrid` — 点阵（径向/扫描/淡入三种出现方式）。
- `gradientBlob` — 渐变光斑（大色块氛围）。
- `frameRect` — 描边矩形，逐边生长+角标。
- `divider` — 水平/垂直分隔线，从中心生长。
- `logoMark` — Logo 占位符号。
- `stripes` — 斜纹背景。
- `bigGlyph` — 大号装饰符（引号/星号等）。

### interactive

- `cursor` — 鼠标光标，沿路径移动。
- `clickRipple` — 点击波纹扩散。
- `keyPress` — 键盘按键演示，带按下效果。
- `connector` — 连线/箭头连接两个点。
- `tagCloud` — 标签云，逐个出现+自动换行。

### ui

- `browserFrame` — 浏览器窗口框（产品演示骨架）。
- `terminalWindow` — 终端窗口，命令逐行显示。
- `phoneFrame` — 手机框。
- `cardStack` — 卡片堆叠（展示多张截图）。

## clip 通用字段

| 字段 | 说明 |
|---|---|
| `effect` | 效果名 |
| `at` / `dur` | 起始秒 / 时长（at 可写 `"beat:4"`） |
| `ease` | 缓动名或 `[x1,y1,x2,y2]` |
| `blend` | canvas 合成模式（`lighter` 做加法发光） |
| `opacity` | 0-1 |
| `group` / `groupTransform` | 分组联动 |
| `anchor` | 九宫格锚点（`top-left` / `center` / `bottom-right` 等） |
| `offsetX` / `offsetY` | 锚点偏移（0-1） |
| `safeArea` | true 时避开 8% 安全区 |
| `params` | 效果参数（支持表达式 `"=t*0.5"`） |
