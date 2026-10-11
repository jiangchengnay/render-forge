# 效果速查表

> 自动生成。

## data

| 效果 | 说明 |
|---|---|
| `counterNumber` | 数字滚动（带千分位、前后缀）。 |
| `progressRing` | 圆环进度条。 |
| `barChart` | 条形图，逐条生长。 |
| `lineChart` | 折线图，生长+端点+填充。 |
| `pieChart` | 饼图/环图。 |
| `radarChart` | 雷达图。 |

## decor

| 效果 | 说明 |
|---|---|
| `geoShapes` | 几何形状散布（圆/方/三角/六边形）。 |
| `dotGrid` | 点阵（径向/扫描/淡入三种出现方式）。 |
| `gradientBlob` | 渐变光斑（大色块氛围）。 |
| `frameRect` | 描边矩形，逐边生长+角标。 |
| `divider` | 水平/垂直分隔线，从中心生长。 |
| `logoMark` | Logo 占位符号。 |
| `stripes` | 斜纹背景。 |
| `bigGlyph` | 大号装饰符（引号/星号等）。 |

## feedback

| 效果 | 说明 |
|---|---|
| `feedback` | 帧反馈，形成拖尾/万花筒。高级感来源。 |

## geometry

| 效果 | 说明 |
|---|---|
| `polygonRing` | 多边形环绕中心排布。 |
| `ripples` | 同心圆波纹从中心扩散。 |
| `gridWarp` | 网格点阵形变。 |
| `strokeGrow` | 路径描边逐段生长。 |
| `morphPolygon` | 多边形旋转+呼吸缩放。 |

## interactive

| 效果 | 说明 |
|---|---|
| `cursor` | 鼠标光标，沿路径移动。 |
| `clickRipple` | 点击波纹扩散。 |
| `keyPress` | 键盘按键演示，带按下效果。 |
| `connector` | 连线/箭头连接两个点。 |
| `tagCloud` | 标签云，逐个出现+自动换行。 |

## math

| 效果 | 说明 |
|---|---|
| `kaleidoscope` | 万花筒对称。 |
| `lissajous` | 利萨如曲线。 |
| `metaball` | 融合球（blur+contrast 模拟）。 |

## media

| 效果 | 说明 |
|---|---|
| `image` | 显示注册过的图片素材。 |
| `video` | 播放注册过的视频素材（逐帧 drawImage）。 |
| `svg` | 显示 SVG 素材。 |
| `imageMask` | 用图片作为遮罩裁切下层。 |

## noise

| 效果 | 说明 |
|---|---|
| `fbmNoise` | 分形噪声场，最常用的氛围底纹。 |
| `noiseMask` | 噪声遮罩，用噪声裁出流动形状。 |

## particle

| 效果 | 说明 |
|---|---|
| `flowfield` ★ | 流动场。粒子沿噪声场流动，丝绸质感。stateful。 |
| `particles` ★ | 粒子系统。stateful，支持 6 种行为。 |

## primitive

| 效果 | 说明 |
|---|---|
| `shape` | 任意图元：多边形/星形/圆/矩形/线段/路径。 |
| `path` | 折线/平滑曲线，支持逐段生长与虚线。 |

## text

| 效果 | 说明 |
|---|---|
| `subtitle` | 显示 SRT 字幕（按全局时间自动切换，支持自动换行）。 |
| `titleCard` | 产品片大标题卡：徽章+主标+副标+标签+分隔线，逐字进入。 |
| `lyricLine` | MV 歌词，三种高亮模式。 |
| `bezierText` | 文字沿 Catmull-Rom 曲线排布。 |
| `bulletList` | 特性列表，逐项出现。 |
| `codeBlock` | 代码块，逐字打出。 |
| `typewriter` | 打字机。 |
| `wordPop` | 逐字弹入。 |
| `blurFocus` | 从模糊到清晰聚焦。 |
| `labelText` | 轻量标签文字，用于副标/说明。 |

## ui

| 效果 | 说明 |
|---|---|
| `browserFrame` | 浏览器窗口框（产品演示骨架）。 |
| `terminalWindow` | 终端窗口，命令逐行显示。 |
| `phoneFrame` | 手机框。 |
| `cardStack` | 卡片堆叠（展示多张截图）。 |

## vfx

| 效果 | 说明 |
|---|---|
| `shake` | 画面整体震屏/抖动，支持频率、幅度、衰减。 |
| `waveform` | 音频波形/频谱条（用 RF.Audio 数据）。 |
| `lensFlare` | 镜头光晕：中心光源 + 光斑链 + anamorphic streak。 |
| `lightSweep` | 一条高光带扫过画面。 |
| `textMask` | 用文字作为遮罩挖空（露出下层内容）。 |
| `spectrum` | 频域频谱条（真实 FFT 分频段）。 |

