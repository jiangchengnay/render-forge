# L1 分析层使用指南

> L1 分析层把「音频 + 歌词 + 创作宪法」变成一份《解读报告》。
> **render-forge 不碰 LLM（A 模式）**：语义分析由外部 LLM 完成，本框架只提供「数据准备 + 协议 + 模板 + 校验」。

## 1. 定位

L1 是**可独立运行的最小切片**：不依赖上层多 Agent 编排，输入音频+歌词+宪法即可产出报告。

内部有依赖 DAG（非全并行）：

```
① 音乐分析师 ──┐
                ├──→ ⑤ 层次分析师
② 歌词分析师 ──┴──→ ④ 映射分析师 ──┘
```

执行批次：第一批（并行）① ② → 第二批 ④（依赖②）→ 第三批 ⑤（依赖①+②+④）。

## 2. 四步流程

### 步骤 1：构建 dossier（确定性，本框架做）

```bash
node tools/analyze.js --audio=bgm.mp3 --lyrics=lyrics.txt --constitution=constitution.json --out=dossier.json
```

- `--audio`（必填）：音频文件。经 puppeteer 载入 index.html，复用 `RF.Audio` 分析（tempo/beats/onsets/sections/bands/phrases/interludes）。
- `--lyrics`（可选）：纯文本（每行一句）或 SRT（自动解析时间）。
- `--constitution`（可选）：L0 产出的创作宪法 JSON；缺省留空。
- `--out`（可选）：输出路径；缺省打到 stdout。

> 音频数据会**浓缩**（见第 4 节），避免撑爆 LLM 上下文。

### 步骤 2：外部 LLM 读 dossier + prompt 模板，产出报告各段

- `prompts/music-analyst.md` → `music` 段
- `prompts/lyrics-analyst.md` → `lyrics` 段
- `prompts/mapping-analyst.md` → `mapping` 段（依赖 lyrics 段）
- `prompts/layer-analyst.md` → `layers` 段（依赖前三者）

模板含占位符（`{{dossier}}`、`{{constitution}}`、`{{presets}}`、`{{lyrics}}`、`{{music}}`、`{{mapping}}`），由外部平台注入。

### 步骤 3：合并为完整报告

把四段合并进一个对象，补 `meta`（`dossierRef`、`generatedAt`），得到《解读报告》。

### 步骤 4：校验

```bash
node tools/validate-interpretation.js report.json
```

- exit 0：通过。
- exit 1：报错并定位到路径（如 `lyrics[3].emotion 缺失`）。

报告结构见 `dsl/schemas/interpretation.schema.md`。完整样例见 `dsl/examples/analysis-demo/`。

## 3. 关键设计

- **映射只到「动作」，不指定效果名**：映射分析师产出如「升起+放大」，绝不写 `particles`、`logoMark` 等引擎效果名（那是 L3 执行层的事）。校验器会扫描并拦截越界。
- **流畅性/淡化由映射层定义**：`mapping[].transition` 描述句间过渡。
- **焦点是动态曲线**：`layers.focus_curve` 是随时间移动的焦点，不是固定主体。
- **创作宪法约束四路分析师**：情绪基调、解读边界、叙事风格均受其约束。

## 4. 音频数据浓缩策略

dossier 里的 `audio` **不含每帧原始数组**（rms/flux/energy/bands 每帧），只保留：

| 字段 | 内容 |
|---|---|
| `tempo` | 速度（整数） |
| `beats` / `onsets` | 时间点数组（保留，分析师需要节拍锚点） |
| `sections` | `[{start,end,type,energy}]`，energy 映射为 `low`/`high` |
| `bands_summary` | 每频段按 section 的 `{start,end,mean,peak}`（丢弃逐帧） |
| `phrases` / `interludes` | `[{start,end}]`（来自 VAD） |

取舍：节拍/起点保留完整数组（体积小且是核心锚点）；频谱逐帧数据体积大（数千帧 × 多频段），改为按段落聚合的均值/峰值——足够表达「哪段低音强、哪段高频亮」，又不撑爆上下文。

## 5. 动画设计预设库

`dsl/presets/animation-presets.json` 内置 **12 个**预设，按情绪覆盖（epic / calm / energetic / dark / uplifting / fragile / mysterious / tense…），每个含四层（主体/背景/衬托/装饰）的动作候选与 `effect_hint`。

它是**参考不是模板套用**：帮分析师快速定位效果族，最终动作由内容决定。

## 6. 相关文件

| 文件 | 作用 |
|---|---|
| `tools/analyze.js` | dossier 构建器（CLI + 可 require） |
| `dsl/schemas/interpretation.schema.md` | 《解读报告》规范 |
| `prompts/*.md` | 四个分析师 prompt 模板 |
| `tools/validate-interpretation.js` | 报告校验器（CLI + 可 require） |
| `dsl/presets/animation-presets.json` | 动画设计预设库 |
| `dsl/examples/analysis-demo/` | dossier + report 样例 |
