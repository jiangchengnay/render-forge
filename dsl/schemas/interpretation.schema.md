# 《解读报告》规范（L1 分析层产出）

> 本文件定义 render-forge L1 分析层产出的《解读报告》（Interpretation Report）结构。
> 外部 LLM 读「dossier + prompt 模板」→ 产出本报告 → 由 `tools/validate-interpretation.js` 校验。
> 校验通过后，报告作为 L2 决策层的输入。

## 0. 定位

- 本报告**只做语义分析**（情绪 / 隐喻 / 意义 / 焦点），**不指定具体效果名与参数**（那是 L3 执行层的事）。
- 报告**可独立产出**：输入「音频 + 歌词 + 创作宪法」即可，不依赖上层编排。

## 1. 顶层结构

```json
{
  "meta": { "dossierRef": "dossier.json", "generatedAt": "2026-10-11T00:00:00.000Z" },
  "music": { "emotion_curve": [], "key_moments": [], "sections_mapped": [] },
  "lyrics": [],
  "mapping": [],
  "layers": { "focus_curve": [] }
}
```

四个分析师各产出其中一段（`music` / `lyrics` / `mapping` / `layers`），最终由 L1 收口合并为完整报告。
`meta` 为收口时补写。

## 2. music 段（音乐分析师产出）

情绪强度曲线 + 关键节点 + 段落情绪映射。

```json
{
  "music": {
    "emotion_curve": [
      { "start": 0, "end": 4, "intensity": 0.3, "label": "平静" },
      { "start": 4, "end": 8, "intensity": 0.8, "label": "积蓄" }
    ],
    "key_moments": [
      { "t": 8.2, "type": "drop", "note": "鼓点爆发" }
    ],
    "sections_mapped": [
      { "start": 0, "end": 8, "type": "verse", "mood": "叙述" }
    ]
  }
}
```

**字段约束**：

| 字段 | 类型 | 约束 |
|---|---|---|
| `emotion_curve` | 数组 | 每项 { start:number, end:number, intensity:number(0-1), label:string }。start<end，时间递增 |
| `emotion_curve[].label` | string | 情绪标签（如「平静」「积蓄」「爆发」「释然」），中文建议 |
| `emotion_curve[].intensity` | number | 0.0–1.0 |
| `key_moments` | 数组 | 每项 { t:number, type:string, note:string } |
| `key_moments[].type` | enum | `drop` / `build-up` / `cut` / `break` / `rise` / `fall` / `other` |
| `sections_mapped` | 数组 | 每项 { start:number, end:number, type:string, mood:string }，type 对应 dossier.audio.sections 的 type |

> 音乐分析师可在 emotion_curve 段上附 `preset_hint`（可选，string）：引用 `presets` 里的某个 preset 名，作为「这段适合哪种动作族」的参考。

## 3. lyrics 段（歌词分析师产出）

逐句精读：字面 / 情绪 / 隐喻 / 意象。

```json
{
  "lyrics": [
    {
      "index": 1,
      "text": "我看见光",
      "line": "主歌",
      "emotion": "期待",
      "imagery": ["光", "上升"],
      "metaphor": "希望正在到来",
      "note": "开场，语气轻"
    }
  ]
}
```

**字段约束**：

| 字段 | 类型 | 约束 |
|---|---|---|
| `index` | number | 必须对应 dossier.lyrics 的 index |
| `text` | string | 原句文本 |
| `line` | string | 段落归属（主歌 / 副歌 / 桥段 / 尾声…），可空字符串 |
| `emotion` | string | 该句情绪（**必填**） |
| `imagery` | string[] | 意象词（如 ["光","上升","破碎"]），可空数组 |
| `metaphor` | string | 隐喻解读，可空字符串 |
| `note` | string | 备注，可空字符串 |

## 4. mapping 段（映射分析师产出）

每句 → **视觉动作候选**。**只到「动作」，不指定具体效果名。**

```json
{
  "mapping": [
    {
      "lyric_index": 1,
      "meaning": "希望升起",
      "action": "升起+放大",
      "transition": { "type": "fade", "dur": 0.5 },
      "layer_hint": "subject"
    }
  ]
}
```

**字段约束**：

| 字段 | 类型 | 约束 |
|---|---|---|
| `lyric_index` | number | **必须存在于 lyrics 的 index 集合中**（引用完整性） |
| `meaning` | string | 该句要表达的意义 |
| `action` | string | 视觉**动作候选**（如「升起+放大」「裂开消散」「下沉+拉长」）。**不得写具体效果名**（见下方红线） |
| `transition` | object | 与上一句的过渡：{ type:string, dur:number } |
| `transition.type` | enum | `fade` / `dissolve` / `cut` / `wipe` / `none` |
| `transition.dur` | number | 秒，≥0（cut/none 可为 0） |
| `layer_hint` | enum | `subject` / `background` / `accent` / `decoration` / `text` / `none` |

### 4.1 红线：映射只到「动作」，不指定效果名

- ✅ 允许：「升起+放大」「裂开消散」「下沉+拉伸」「环绕」「脉冲」
- ❌ 禁止：`logoMark`、`particles`、`fbmNoise`、`ripples` 等**引擎效果名**（那是 L3 执行层的自由）

**理由**（见 ARCHITECTURE.md 5.6「三者的递进边界」）：
1. 映射分析师定「要表达什么动作」（需求层）——不指定效果名。
2. 动画设计预设给「怎么实现的参考」（参考层）——是建议范围。
3. 执行层定「具体用哪个效果、什么参数」（实现层）——在预设范围内自由选。

> 校验器会**扫描 action / meaning 字符串是否出现引擎效果名**，若出现则报 error（防止越界）。

## 5. layers 段（层次分析师产出）

**焦点时间轴**——焦点是**随时间移动的曲线**，不是固定主体。

```json
{
  "layers": {
    "focus_curve": [
      { "t": 0, "focus": "text", "reason": "开场字幕" },
      { "t": 2, "focus": "subject", "reason": "主体升起" },
      { "t": 4, "focus": "accent", "reason": "粒子爆发" }
    ]
  }
}
```

**字段约束**：

| 字段 | 类型 | 约束 |
|---|---|---|
| `focus_curve` | 数组 | 每项 { t:number, focus:string, reason:string }。t 必须**非递减** |
| `focus_curve[].focus` | enum | `text` / `subject` / `background` / `accent` / `decoration` / `none` |
| `focus_curve[].reason` | string | 为什么此时焦点在此 |

> 同一时刻可有多个 focus 项（表示并重），但 t 必须非递减。

## 6. 完整示例

见 `dsl/examples/analysis-demo/report.json`。

## 7. 校验

```
node tools/validate-interpretation.js report.json
```

- exit 0：无 error。
- exit 1：存在 error，且逐条打印定位到具体路径（如 `lyrics[3].emotion 缺失`）。

## 8. 枚举值速查

| 枚举 | 取值 |
|---|---|
| key_moments[].type | drop / build-up / cut / break / rise / fall / other |
| transition.type | fade / dissolve / cut / wipe / none |
| layer_hint | subject / background / accent / decoration / text / none |
| focus_curve[].focus | text / subject / background / accent / decoration / none |
