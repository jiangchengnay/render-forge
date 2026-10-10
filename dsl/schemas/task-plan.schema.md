# 任务清单规范（L2 决策层产出）

> 本文件定义 render-forge L2 决策层产出的**任务清单**（Task Plan）结构。
> 外部 LLM 读「Planner 输入包 + \`prompts/planner.md\`」→ 产出本清单 → 由 \`tools/validate-plan.js\` 校验。
> 校验通过后，清单是 L3 执行层的输入。

## 0. 定位

- 任务清单是 Planner 做**全局决策**的产物：定范式、定全局约束、切任务。
- 它**只描述结构与约束**，不含具体效果参数（那是 L3 各 Worker 的自由）。
- 它是 L3「按任务下发」的唯一依据：每条 task 会被 \`tools/assign-task.js\` 打成一份 Worker 输入包。

## 1. 顶层结构

\`\`\`json
{
  "paradigm": "splice | choreography",
  "global": {
    "palette": "deepSea",
    "seed": 42,
    "width": 1080,
    "height": 1080,
    "duration": 8,
    "style": "epic-tech",
    "narrative_style": "克制",
    "bottom_line_rules": ["转场不连续同类型", "文字避开中心", "配色统一", "时长与音频对齐"]
  },
  "timeline": {
    "beats": [],
    "phrases": [],
    "sections": [],
    "focus_curve": []
  },
  "tasks": [
    {
      "id": "s1",
      "type": "system",
      "role": "background",
      "scope": "全片",
      "brief": "氛围底纹，随 section 缓慢演化",
      "docs": ["EFFECTS#fbmNoise", "EFFECTS#gradientBlob"],
      "timeline_slice": { "sections": [] },
      "focus_slice": []
    }
  ]
}
\`\`\`

## 2. global 段（全局约束）

**关键原则**：规格由 Planner 根据内容产出，**不是引擎预设**。只保留**底线约束**，不写死「每幕 2-4 秒」这类僵化规则。

| 字段 | 类型 | 约束 |
|---|---|---|
| \`palette\` | string | 调色板名（见 \`tools/_palettes.json\`），全片统一 |
| \`seed\` | number | 随机种子（确定性） |
| \`width\` / \`height\` | number | 画布尺寸，正数 |
| \`duration\` | number | 全片时长（秒），正数，通常与音频对齐 |
| \`style\` | string | 风格标签（自由文本，如 epic-tech） |
| \`narrative_style\` | string | 叙事风格（克制 / 碎片 / 线性 …） |
| \`bottom_line_rules\` | string[] | 底线规则列表（软性约束，供校验/自检） |
| \`post\` | object[] | 可选。后处理链（effect + 参数），直接进分镜 \`post\` |

## 3. timeline 段（时间轴锚点）

Planner 从解读报告整理出的全片时间锚点。**不是全片原始数据**，够切片即可。

| 字段 | 类型 | 约束 |
|---|---|---|
| \`beats\` | number[] | 节拍时间点（秒） |
| \`phrases\` | {start,end}[] | 乐句（歌词句）区间 |
| \`sections\` | {start,end,type}[] | 段落区间 |
| \`focus_curve\` | {t,focus,reason}[] | 焦点曲线，\`t\` 必须**非递减** |

## 4. tasks 段（任务列表）

| 字段 | 类型 | 约束 |
|---|---|---|
| \`id\` | string | 唯一标识（如 s1 / s2） |
| \`type\` | enum | \`act\`（幕） / \`system\`（视觉系统） |
| \`role\` | string | 执行角色：background / subject / accent / decoration / text … |
| \`scope\` | 对象或字符串 | splice → \`{start,end}\`；choreography → \`"全片"\` 或 \`{start,end}\` |
| \`brief\` | string | 一句话说明本任务要做什么 |
| \`docs\` | string[] | 相关文档引用，如 \`"EFFECTS#particles"\`、\`"audio#bands"\` |
| \`timeline_slice\` | object | 按角色裁好的时间轴切片（见第 5 节） |
| \`focus_slice\` | object[] | 与角色相关的焦点段（从 focus_curve 裁出） |

### 4.1 两种范式

- **splice（幕拼接）**：\`type:"act"\`，每个 task 是一幕，\`scope:{start,end}\`。
- **choreography（连续编舞）**：\`type:"system"\`，每个 task 是一个视觉系统，\`scope\` 通常「全片」。

## 5. 时间轴切片规则（按角色下发）

来自 WORKFLOW.md §B3：**Worker 只拿与自己相关的时间锚点，够用即可，不给全片。**

| 角色 role | timeline_slice 下发 | focus_slice 下发 |
|---|---|---|
| text（文字） | phrases | focus_curve 中 \`focus:"text"\` 的段 |
| accent / effect（特效·粒子） | beats + onsets | focus_curve 中 \`focus:"accent"\` 的段 |
| background（背景） | sections | —（通常全程） |
| subject（主体） | beats + phrases | focus_curve 中 \`focus:"subject"\` 的段 |

> 若 task 未显式给出 \`timeline_slice\` / \`focus_slice\`，\`tools/assign-task.js\` 会按上表自动裁切。

## 6. Planner 自检清单

Planner 产出清单前必须自检；**违反底线规则就拒绝重来**。

1. **范式一致**：splice 全是 \`type:"act"\`；choreography 全是 \`type:"system"\`。
2. **splice 覆盖**：所有幕的 \`{start,end}\` 必须**无缝覆盖** \`[0,duration]\`，既不重叠也不留空。
3. **choreography 层次**：系统应覆盖「主体·衬托·背景·装饰」中的多个层次（可多可少，但别只有一个）。
4. **引用完整**：\`docs\` 里的 \`EFFECTS#<name>\` 应是真实效果名（类别名会给出警告）。
5. **时间轴非递减**：\`focus_curve\` 的 \`t\` 非递减。
6. **底线规则**：\`bottom_line_rules\` 必须被后续执行/组装遵守（如「文字避开中心」→ 文字类 task 的 y 偏移避开 0.5）。

## 7. 校验

\`\`\`bash
node tools/validate-plan.js plan.json
\`\`\`

- exit 0：无 error。
- exit 1：存在 error，逐条打印并定位到路径（如 \`tasks[2].scope: start 必须 < end\`）。

## 8. 完整示例

见 \`dsl/examples/orchestration-demo/plan.json\`。

## 9. 枚举速查

| 枚举 | 取值 |
|---|---|
| paradigm | splice / choreography |
| tasks[].type | act / system |
| tasks[].role | background / subject / accent / decoration / text / …（自由，建议取自视觉层次） |
| focus_curve[].focus | text / subject / background / accent / decoration / none |
