# Render Forge DSL 完整规范

> 本文件由 RF.genSchema() 自动生成。

## 顶层结构

```json
{
  "meta": {
    "title": "作品名",
    "width": 1080,
    "height": 1080,
    "duration": 12,
    "seed": 42
  },
  "palette": "deepSea",
  "post": [
    {
      "effect": "bloom",
      "amount": 0.5,
      "threshold": 0.6,
      "radius": 20
    }
  ],
  "acts": [
    {
      "id": "act1",
      "start": 0,
      "dur": 4,
      "background": {
        "type": "radial",
        "cx": 0.5,
        "cy": 0.5,
        "radius": 1,
        "inner": "$bg",
        "outer": "#000"
      },
      "transitionIn": {
        "type": "fade",
        "dur": 0.4
      },
      "transitionOut": {
        "type": "wipe",
        "dur": 0.3,
        "dir": "left"
      },
      "tracks": [
        {
          "effect": "fbmNoise",
          "at": 0,
          "dur": 4,
          "ease": "outCubic",
          "params": {
            "scale": 2,
            "warp": 0.6
          }
        }
      ]
    }
  ]
}
```

## 可用调色板

neonDusk, cyberMint, synthSunset, paperMint, coralCream, skyBlue, monochrome, inkAndGold, deepSea, memphis, bubblegum, lavaLamp, auroraGreen

颜色占位符：$0~$4（强调色序列）、$accent、$fg、$bg

## 转场

| 名称 | 说明 |
|---|---|
| cut | 硬切 |
| fade | 淡入淡出 |
| wipe | 划像(dir) |
| zoomFade | 缩放淡出 |
| iris | 圆形擦除 |
| slide | 推拉(dir) |
| glitch | 故障切片 |
| blocks | 块状溶解(cell) |
| shapeMask | 形状遮罩(shape) |

## 效果清单

### `feedback`

帧反馈，形成拖尾/万花筒。高级感来源。

_分类: feedback_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| decay | number | 0.94 | - | 残影衰减 |
| scale | number | 0.98 | - | 每帧缩放 |
| rotate | number | 0.004 | - | 每帧旋转（弧度） |
| hueShift | number | 0 | - | 每帧色相偏移（度） |

### `flowfield` _(stateful)_

流动场。粒子沿噪声场流动，丝绸质感。stateful。

_分类: particle_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| count | number | 2000 | - |  |
| noiseScale | number | 1.5 | - |  |
| noiseSpeed | number | 0.08 | - |  |
| velocity | number | 180 | - |  |
| lineWidth | number | 1 | - |  |
| alpha | number | 0.4 | - |  |

### `kaleidoscope`

万花筒对称。

_分类: math_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| slices | number | 8 | - |  |
| rotSpeed | number | 0.1 | - |  |
| zoom | number | 0.5 | - |  |
| srcLines | number | 8 | - |  |

### `lissajous`

利萨如曲线。

_分类: math_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| a | number | 3 | - |  |
| b | number | 2 | - |  |
| phase | number | 1.57 | - |  |
| radius | number | 0.42 | - |  |
| samples | number | 2000 | - |  |
| lineWidth | number | 1.5 | - |  |
| rotSpeed | number | 0.15 | - |  |
| color | string | $0 | - |  |

### `image`

显示注册过的图片素材。

_分类: media_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| src | string | - | - | 注册时的 id |
| x | number | 0.5 | - | 中心 x（0-1） |
| y | number | 0.5 | - | 中心 y（0-1） |
| w | number | 0.4 | - | 区域宽（相对画布） |
| h | number | 0.4 | - | 区域高 |
| fit | string | contain | contain ~ cover ~ stretch | 适配方式 |
| opacity | number | 1 | - |  |
| rotate | number | 0 | - | 旋转（弧度） |
| scale | number | 1 | - | 额外缩放 |
| shadow | boolean | false | - | 是否加阴影 |
| radius | number | 0 | - | 圆角（像素） |
| grayscale | boolean | false | - |  |

### `video`

播放注册过的视频素材（逐帧 drawImage）。

_分类: media_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| src | string | - | - | 注册时的 id |
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| w | number | 0.4 | - |  |
| h | number | 0.4 | - |  |
| fit | string | cover | - |  |
| loop | boolean | true | - |  |
| muted | boolean | true | - |  |
| startAt | number | 0 | - | 从视频第几秒开始 |
| opacity | number | 1 | - |  |

### `svg`

显示 SVG 素材。

_分类: media_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| src | string | - | - | 注册 id |
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| w | number | 0.3 | - |  |
| h | number | 0.3 | - |  |
| fit | string | contain | - |  |
| opacity | number | 1 | - |  |

### `imageMask`

用图片作为遮罩裁切下层。

_分类: media_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| src | string | - | - |  |
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| w | number | 0.6 | - |  |
| h | number | 0.6 | - |  |
| feather | number | 0 | - |  |

### `metaball`

融合球（blur+contrast 模拟）。

_分类: math_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| count | number | 6 | - |  |
| blur | number | 30 | - |  |
| alpha | number | 0.85 | - |  |

### `fbmNoise`

分形噪声场，最常用的氛围底纹。

_分类: noise_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| scale | number | 3 | - | 噪声频率，越大越碎 |
| octaves | number | 4 | - | 倍频层数 |
| warp | number | 0.5 | - | 域扭曲强度 |
| speed | number | 0.15 | - | 演化速度 |
| bands | number | 0 | - | >0 时条带化 |
| alpha | number | 1 | - | 透明度 |
| colorA | string | $0 | - | 亮部色 |
| colorB | string | $bg | - | 暗部色 |
| resolution | number | 320 | - | 内部纹理分辨率 |
| pixelSize | number | 2 | - | 像素颗粒大小 |

### `noiseMask`

噪声遮罩，用噪声裁出流动形状。

_分类: noise_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| scale | number | 2.5 | - | 噪声频率 |
| threshold | number | 0.5 | - | 显示阈值 0-1 |
| speed | number | 0.1 | - | 演化速度 |
| color | string | $0 | - | 填充色 |
| step | number | 6 | - | 采样网格像素 |

### `particles` _(stateful)_

粒子系统。stateful，支持 6 种行为。

_分类: particle_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| count | number | 500 | - | 粒子数 |
| behavior | string | drift | drift ~ attract ~ explode ~ vortex ~ gravity ~ flow ~ none | 运动行为 |
| shape | string | dot | dot ~ square ~ line ~ star | 粒子形状 |
| spawn | string | random | random ~ center ~ ring ~ edge | 出生位置 |
| alpha | number | 0.9 | - |  |
| sizeMul | number | 1 | - |  |
| strength | number | 400 | - | 行为力度 |
| wrap | boolean | true | - |  |

### `shape`

任意图元：多边形/星形/圆/矩形/线段/路径。

_分类: primitive_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| kind | string | polygon | polygon ~ star ~ circle ~ rect ~ line ~ path |  |
| points | array | - | - | kind=polygon/path 时的顶点，归一化 [-1,1] |
| sides | number | 6 | - | 多边形边数 |
| starPoints | number | 5 | - | 星形角数 |
| innerRadius | number | 0.5 | - | 星形内半径比 0-1 |
| radius | number | 0.15 | - | 圆半径（相对短边） |
| w | number | 0.2 | - | 矩形宽（相对画布） |
| h | number | 0.2 | - | 矩形高 |
| size | number | 0.15 | - | 整体尺寸（相对短边） |
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| rotate | number | 0 | - | 旋转（弧度） |
| scale | number | 1 | - |  |
| opacity | number | 1 | - |  |
| fill | string |  | - |  |
| stroke | string | $fg | - |  |
| lineWidth | number | 2 | - |  |
| closed | boolean | true | - |  |

### `path`

折线/平滑曲线，支持逐段生长与虚线。

_分类: primitive_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| points | array | - | - | 画布归一化点 [[x,y],...]，x/y ∈ [0,1] |
| smooth | string | linear | linear ~ catmullRom |  |
| closed | boolean | false | - |  |
| grow | boolean | false | - | 按进度逐段生长 |
| dash | array | - | - | [on, off] 虚线（像素） |
| stroke | string | $fg | - |  |
| fill | string |  | - |  |
| lineWidth | number | 2 | - |  |
| opacity | number | 1 | - |  |

### `polygonRing`

多边形环绕中心排布。

_分类: geometry_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| count | number | 12 | - | 多边形数量 |
| radius | number | 0.3 | - | 环半径（相对短边） |
| sides | number | 6 | - | 每个多边形的边数 |
| size | number | 0.06 | - | 多边形大小 |
| lineWidth | number | 2 | - | 描边宽度（像素） |
| rotSpeed | number | 0.2 | - | 旋转速度 |
| radiusVar | number | 0 | - | 半径波动 0-1 |
| stagger | number | 0 | - | 逐个延迟比例 0-1 |
| color | string | $0 | - |  |
| color2 | string | $1 | - |  |

### `ripples`

同心圆波纹从中心扩散。

_分类: geometry_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| count | number | 6 | - | 波纹数量 |
| cx | number | 0.5 | - |  |
| cy | number | 0.5 | - |  |
| maxRadius | number | 0.7 | - | 最大半径 |
| lineWidth | number | 2 | - | 线宽（像素） |
| color | string | $0 | - |  |
| alpha | number | 0.8 | - |  |

### `gridWarp`

网格点阵形变。

_分类: geometry_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| cols | number | 20 | - |  |
| rows | number | 20 | - |  |
| dot | number | 2 | - |  |
| noiseAmp | number | 0.05 | - |  |
| noiseScale | number | 2 | - |  |
| speed | number | 0.3 | - |  |
| color | string | $0 | - |  |

### `strokeGrow`

路径描边逐段生长。

_分类: geometry_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| paths | array | - | - | 路径数组，每项 {kind:'arc'|'line', ...} |
| lineWidth | number | 3 | - |  |
| color | string | $0 | - |  |
| stagger | number | 0.3 | - |  |

### `morphPolygon`

多边形旋转+呼吸缩放。

_分类: geometry_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| sides | number | 6 | - |  |
| radius | number | 0.3 | - |  |
| cx | number | 0.5 | - |  |
| cy | number | 0.5 | - |  |
| rotSpeed | number | 0.5 | - |  |
| fill | string | $0 | - |  |
| stroke | string | $fg | - |  |
| lineWidth | number | 3 | - |  |
| breath | number | 0 | - |  |

### `subtitle`

显示 SRT 字幕（按全局时间自动切换，支持自动换行）。

_分类: text_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| src | string | - | - | 字幕 id |
| x | number | 0.5 | - |  |
| y | number | 0.88 | - |  |
| size | number | 0.028 | - |  |
| weight | number | 600 | - |  |
| color | string | #ffffff | - |  |
| bgColor | string | rgba(0,0,0,0.5) | - |  |
| padding | number | 0.012 | - |  |
| maxWidth | number | 0.8 | - |  |

### `titleCard`

产品片大标题卡：徽章+主标+副标+标签+分隔线，逐字进入。

_分类: text_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| title | string | TITLE | - | 主标题 |
| subtitle | string |  | - | 副标题 |
| badge | string |  | - | 徽章文字（上方胶囊） |
| tag | string |  | - | 底部标签 |
| x | number | 0.5 | 0 ~ 1 |  |
| y | number | 0.5 | 0 ~ 1 |  |
| titleSize | number | 0.075 | - | 主标题字号（相对画布宽） |
| titleWeight | number | 700 | - |  |
| subSize | number | 0.028 | - |  |
| badgeSize | number | 0.018 | - |  |
| tagSize | number | 0.018 | - |  |
| stagger | number | 0.4 | - | 逐字延迟比例 |
| divider | boolean | true | - | 是否显示分隔线 |

### `lyricLine`

MV 歌词，三种高亮模式。

_分类: text_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| text | string | - | - | 歌词文本 |
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| size | number | 0.06 | - | 字号（相对画布宽） |
| weight | number | 600 | - |  |
| mode | string | fill | fill ~ scan ~ fade | 高亮模式 |
| colorBase | string | rgba(255,255,255,0.25) | - |  |
| colorHi | string | $fg | - |  |
| colorGlow | string | $accent | - |  |
| glow | boolean | true | - |  |

### `bezierText`

文字沿 Catmull-Rom 曲线排布。

_分类: text_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| text | string | - | - |  |
| points | array | [4 items] | - | 控制点 [[x,y],...]，坐标 0-1 |
| size | number | 0.05 | - |  |
| weight | number | 600 | - |  |
| spread | number | 1.5 | - | 字间采样间隔 |
| showPath | boolean | true | - |  |
| pathWidth | number | 1.5 | - |  |
| samples | number | 200 | - |  |
| color | string | $fg | - |  |
| colorPath | string | rgba(255,255,255,0.3) | - |  |

### `bulletList`

特性列表，逐项出现。

_分类: text_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| items | array | - | - | 列表项字符串数组 |
| x | number | 0.15 | - |  |
| y | number | 0.35 | - |  |
| size | number | 0.03 | - |  |
| weight | number | 500 | - |  |
| lineGap | number | 0.08 | - | 行间距（相对高） |
| color | string | $fg | - |  |
| colorBullet | string | $accent | - |  |
| stagger | number | 0.5 | - |  |

### `codeBlock`

代码块，逐字打出。

_分类: text_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| lines | array | - | - | 代码行字符串数组 |
| x | number | 0.15 | - |  |
| y | number | 0.4 | - |  |
| size | number | 0.022 | - |  |
| weight | number | 400 | - |  |
| color | string | $fg | - |  |
| bgColor | string | rgba(0,0,0,0.8) | - |  |
| cursor | boolean | true | - |  |

### `typewriter`

打字机。

_分类: text_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| text | string | Hello | - |  |
| size | number | 0.08 | - |  |
| weight | number | 600 | - |  |
| color | string | $fg | - |  |
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| align | string | center | - |  |
| cursor | boolean | true | - |  |

### `wordPop`

逐字弹入。

_分类: text_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| text | string | - | - |  |
| size | number | 0.08 | - |  |
| weight | number | 600 | - |  |
| stagger | number | 0.5 | - |  |
| color | string | $fg | - |  |
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| align | string | center | - |  |
| rise | number | 0.5 | - |  |

### `blurFocus`

从模糊到清晰聚焦。

_分类: text_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| text | string | - | - |  |
| size | number | 0.08 | - |  |
| weight | number | 600 | - |  |
| maxBlur | number | 20 | - | 起始模糊像素 |
| scaleFrom | number | 1 | - |  |
| color | string | $fg | - |  |
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| align | string | center | - |  |

### `shake`

画面整体震屏/抖动，支持频率、幅度、衰减。

_分类: vfx_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| amp | number | 0.02 | - | 幅度（相对画布短边） |
| freq | number | 30 | - | 频率（Hz） |
| decay | number | 0 | - | 衰减 0-1 |
| rotate | number | 0 | - | 旋转抖动幅度（弧度） |
| seed | number | 0 | - |  |

### `waveform`

音频波形/频谱条（用 RF.Audio 数据）。

_分类: vfx_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| mode | string | bars | bars ~ wave |  |
| dir | string | vertical | vertical ~ horizontal |  |
| band | string | full | full ~ bass ~ mid ~ treble | 频率段 |
| count | number | 48 | - |  |
| x | number | 0.5 | - |  |
| y | number | 0.7 | - |  |
| w | number | 0.7 | - |  |
| h | number | 0.2 | - |  |
| color | string | $accent | - |  |
| color2 | string | $1 | - |  |
| gap | number | 0.3 | - |  |
| lineWidth | number | 2 | - |  |
| opacity | number | 1 | - |  |

### `lensFlare`

镜头光晕：中心光源 + 光斑链 + anamorphic streak。

_分类: vfx_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| x | number | 0.7 | - |  |
| y | number | 0.3 | - |  |
| size | number | 0.12 | - |  |
| color | string | #ffffff | - |  |
| color2 | string | $accent | - |  |
| ghosts | number | 5 | - |  |
| streak | boolean | true | - |  |
| streakWidth | number | 0.6 | - |  |
| opacity | number | 0.9 | - |  |

### `lightSweep`

一条高光带扫过画面。

_分类: vfx_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| angle | number | 45 | - |  |
| width | number | 0.1 | - |  |
| color | string | #ffffff | - |  |
| opacity | number | 0.5 | - |  |
| from | number | -0.3 | - |  |
| to | number | 1.3 | - |  |

### `textMask`

用文字作为遮罩挖空（露出下层内容）。

_分类: vfx_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| text | string | MASK | - |  |
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| size | number | 0.18 | - |  |
| weight | number | 800 | - |  |
| align | string | center | left ~ center ~ right |  |
| letterSpacing | number | 0 | - |  |
| mode | string | cutout | cutout ~ fill |  |
| color | string | $fg | - |  |

### `spectrum`

频域频谱条（真实 FFT 分频段）。

_分类: vfx_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| count | number | 32 | - |  |
| x | number | 0.5 | - |  |
| y | number | 0.75 | - |  |
| w | number | 0.7 | - |  |
| h | number | 0.25 | - |  |
| color | string | $accent | - |  |
| color2 | string | $1 | - |  |
| gap | number | 0.2 | - |  |
| opacity | number | 1 | - |  |
| mirrored | boolean | false | - |  |

### `counterNumber`

数字滚动（带千分位、前后缀）。

_分类: data_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| from | number | 0 | - |  |
| to | number | 1000 | - |  |
| decimals | number | 0 | - |  |
| prefix | string |  | - |  |
| suffix | string |  | - |  |
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| size | number | 0.12 | - |  |
| weight | number | 800 | - |  |
| color | string | $fg | - |  |
| colorAccent | string | $accent | - |  |
| comma | boolean | true | - |  |

### `progressRing`

圆环进度条。

_分类: data_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| radius | number | 0.15 | - |  |
| lineWidth | number | 0.02 | - |  |
| value | number | 0.75 | - | 0-1 进度 |
| label | string | - | - | 中心文字，默认百分比 |
| color | string | $accent | - |  |
| bgColor | string | - | - |  |
| fontSize | number | - | - |  |

### `barChart`

条形图，逐条生长。

_分类: data_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| x | number | 0.15 | - |  |
| y | number | 0.3 | - |  |
| w | number | 0.7 | - |  |
| h | number | 0.4 | - |  |
| values | array | [5 items] | - | 0-1 数组 |
| labels | array | - | - |  |
| gap | number | 0.15 | - |  |
| colors | array | - | - |  |
| labelSize | number | 0.016 | - |  |
| stagger | number | 0.4 | - |  |

### `lineChart`

折线图，生长+端点+填充。

_分类: data_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| x | number | 0.15 | - |  |
| y | number | 0.3 | - |  |
| w | number | 0.7 | - |  |
| h | number | 0.4 | - |  |
| values | array | [7 items] | - |  |
| color | string | $accent | - |  |
| lineWidth | number | 3 | - |  |
| fill | boolean | true | - |  |
| grid | boolean | true | - |  |
| dots | boolean | true | - |  |

### `pieChart`

饼图/环图。

_分类: data_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| radius | number | 0.18 | - |  |
| inner | number | 0 | - | 0-1，>0 为环图 |
| values | array | [5 items] | - |  |
| colors | array | - | - |  |
| startAngle | number | -1.5708 | - |  |
| gap | number | 0.02 | - |  |

### `radarChart`

雷达图。

_分类: data_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| radius | number | 0.2 | - |  |
| values | array | [5 items] | - |  |
| labels | array | - | - |  |
| color | string | $accent | - |  |
| labelSize | number | 0.018 | - |  |

### `geoShapes`

几何形状散布（圆/方/三角/六边形）。

_分类: decor_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| count | number | 12 | - |  |
| alpha | number | 0.25 | - |  |
| lineWidth | number | 1.5 | - |  |
| stagger | number | 0.6 | - |  |
| stroke | boolean | true | - |  |
| fill | boolean | false | - |  |
| float | boolean | true | - |  |

### `dotGrid`

点阵（径向/扫描/淡入三种出现方式）。

_分类: decor_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| spacing | number | 0.05 | - |  |
| dotR | number | 0.002 | - |  |
| color | string | rgba(255,255,255,0.15) | - |  |
| reveal | string | radial | radial ~ fade ~ sweep |  |

### `gradientBlob`

渐变光斑（大色块氛围）。

_分类: decor_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| count | number | 3 | - |  |
| alpha | number | 0.35 | - |  |
| mode | string | screen | - | 合成模式 |

### `frameRect`

描边矩形，逐边生长+角标。

_分类: decor_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| x | number | 0.1 | - |  |
| y | number | 0.1 | - |  |
| w | number | 0.3 | - |  |
| h | number | 0.2 | - |  |
| color | string | $accent | - |  |
| lineWidth | number | 2 | - |  |
| corners | boolean | true | - |  |

### `divider`

水平/垂直分隔线，从中心生长。

_分类: decor_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| dir | string | h | h ~ v |  |
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| x0 | number | 0.2 | - |  |
| x1 | number | 0.8 | - |  |
| y0 | number | 0.2 | - |  |
| y1 | number | 0.8 | - |  |
| lineWidth | number | 2 | - |  |
| color | string | $accent | - |  |

### `logoMark`

Logo 占位符号。

_分类: decor_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| style | string | cross | cross ~ circles ~ square-stack ~ diamond |  |
| size | number | 0.06 | - |  |
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| color | string | $accent | - |  |

### `stripes`

斜纹背景。

_分类: decor_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| angle | number | 45 | - | 角度（度） |
| gap | number | 0.03 | - |  |
| lineWidth | number | - | - |  |
| color | string | rgba(255,255,255,0.08) | - |  |

### `bigGlyph`

大号装饰符（引号/星号等）。

_分类: decor_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| glyph | string | “ | - |  |
| x | number | 0.15 | - |  |
| y | number | 0.3 | - |  |
| size | number | 0.3 | - |  |
| rotate | number | 0 | - |  |
| color | string | rgba(255,255,255,0.3) | - |  |

### `cursor`

鼠标光标，沿路径移动。

_分类: interactive_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| points | array | [3 items] | - | 路径点 0-1 |
| size | number | 0.03 | - |  |
| color | string | #ffffff | - |  |
| showTrail | boolean | true | - |  |

### `clickRipple`

点击波纹扩散。

_分类: interactive_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| clicks | array | [1 items] | - | 点击点 [{x,y,at,duration}] |
| color | string | #ffffff | - |  |
| maxRadius | number | 0.08 | - |  |
| lineWidth | number | 3 | - |  |
| dot | boolean | true | - |  |

### `keyPress`

键盘按键演示，带按下效果。

_分类: interactive_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| keys | array | [2 items] | - |  |
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| keySize | number | 0.06 | - |  |
| bgColor | string | #ffffff | - |  |
| textColor | string | #1a1a1f | - |  |
| accentColor | string | $accent | - |  |

### `connector`

连线/箭头连接两个点。

_分类: interactive_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| from | array | [2 items] | - | [x,y] 0-1 |
| to | array | [2 items] | - |  |
| style | string | straight | straight ~ curve ~ elbow |  |
| arrow | boolean | true | - |  |
| lineWidth | number | 3 | - |  |
| color | string | $accent | - |  |

### `tagCloud`

标签云，逐个出现+自动换行。

_分类: interactive_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| tags | array | [2 items] | - |  |
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| size | number | 0.024 | - |  |
| maxWidth | number | 0.8 | - |  |
| bgColor | string | - | - |  |
| textColor | string | $accent | - |  |
| borderColor | string | - | - |  |
| stagger | number | 0.5 | - |  |

### `labelText`

轻量标签文字，用于副标/说明。

_分类: text_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| text | string | - | - | 文字 |
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| size | number | 0.024 | - |  |
| weight | number | 500 | - |  |
| color | string | $fg | - |  |
| align | string | center | left ~ center ~ right |  |
| letterSpacing | number | 0 | - |  |

### `browserFrame`

浏览器窗口框（产品演示骨架）。

_分类: ui_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| x | number | 0.15 | - |  |
| y | number | 0.2 | - |  |
| w | number | 0.7 | - |  |
| h | number | 0.55 | - |  |
| url | string | example.com | - |  |
| lines | number | 0 | - | 占位线行数 |
| bgColor | string | #ffffff | - |  |
| barColor | string | #f0f0f4 | - |  |
| radius | number | 0.012 | - |  |

### `terminalWindow`

终端窗口，命令逐行显示。

_分类: ui_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| x | number | 0.15 | - |  |
| y | number | 0.2 | - |  |
| w | number | 0.7 | - |  |
| h | number | 0.5 | - |  |
| title | string | terminal | - |  |
| lines | array | [1 items] | - | 命令/输出行 |
| fontSize | number | 0.022 | - |  |
| bgColor | string | #1a1a1f | - |  |
| barColor | string | #0f0f12 | - |  |
| promptColor | string | #00ffa3 | - |  |
| textColor | string | #e8e8e8 | - |  |

### `phoneFrame`

手机框。

_分类: ui_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| w | number | 0.28 | - | 宽度（高=宽*2.05） |
| frameColor | string | #1a1a1f | - |  |
| screenColor | string | #ffffff | - |  |

### `cardStack`

卡片堆叠（展示多张截图）。

_分类: ui_

| 参数 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| x | number | 0.5 | - |  |
| y | number | 0.5 | - |  |
| w | number | 0.42 | - |  |
| h | number | 0.5 | - |  |
| count | number | 3 | - |  |
| colors | array | - | - |  |

## 后处理

| 名称 |
|---|
| bloom |
| vignette |
| grain |
| chroma |
| scanlines |
| glitch |
| tint |

## 硬性规则

1. 至少叠 2 种不同效果
2. 不同 clip 用不同 ease
3. 颜色用占位符，不硬编码 hex
4. 至少挂 1-2 项后处理
5. 文字不要压在画面正中
6. 多 act 时用不同转场
