# 《创作宪法》规范（L0 语境与叙事层产出）

> 本文件定义 render-forge L0 语境与叙事层产出的**创作宪法**（Creative Constitution）结构。
> 外部平台读「L0 输入包 + prompt 模板」→ 产出 song_context / lyrics_scan / user_intent / conflict / creative_constitution → 由 `tools/validate-constitution.js` 校验。
> 校验通过后，创作宪法是 L1 及后续所有层的**约束框架**。

## 0. 定位

- 创作宪法是比《解读报告》**更高层**的约束框架，回答「这首歌到底在说什么，用户想用它的哪个侧面来说事」。
- 它位于所有层之前：L0 产出 → L1 四路分析师据此约束解读 → L2/L3/L4 全程引用。
- **render-forge 不碰 LLM、不碰网络**：语义判断与联网搜索由外部平台完成，本框架只提供模板 + 协议 + 校验。

## 1. 顶层结构

```json
{
  "meta": { "requestRef": "req.txt", "generatedAt": "2026-10-11T00:00:00.000Z", "source": "search_queries + user_request + lyrics" },
  "song_context": {
    "factual_background": "创作背景（来源标注）",
    "cultural_roots": "文化语境",
    "known_interpretations": [
      { "source": "Genius Verified", "meaning": "作者本人解释：……" }
    ],
    "search_queries_used": ["<歌名> 创作背景", "<歌名> 歌词含义"]
  },
  "lyrics_scan": {
    "summary": "字面大意",
    "overall_tone": "整体基调"
  },
  "user_intent": {
    "stated": "用户明确说的",
    "implied": "从场景推断",
    "pasted": "用户粘贴的解读（若无则空字符串）",
    "narrative_style": "叙事风格"
  },
  "conflict": {
    "has_conflict": false,
    "items": [
      { "aspect": "情绪基调", "user_side": "…", "song_side": "…", "severity": "low|mid|high" }
    ],
    "resolution": "询问用户 | 深层串联 | 网络匹配 | AI 自决 | 垫底",
    "resolution_note": "…"
  },
  "creative_constitution": {
    "core_meaning": "综合三方后的核心意思",
    "must_preserve": ["歌词本意的锚点1", "锚点2"],
    "can_interpret": ["可自由发挥的空间1", "空间2"],
    "narrative_style": "最终采纳的叙事风格",
    "conflict_notes": "冲突如何处理"
  }
}
```

五个顶层段由 L0 五个子步骤产出（见 WORKFLOW.md 第 2 节）：
- `song_context` ← 0.1 语境分析师（联网搜索）
- `lyrics_scan` ← 0.1b 歌词速读
- `user_intent` ← 0.2 意图解析
- `conflict` ← 0.3 冲突检测
- `creative_constitution` ← 0.4 宪法撰写

`meta` 由 build-l0-input / 收口时补写。

## 2. song_context 段（歌曲原生语境）

| 字段 | 类型 | 约束 |
|---|---|---|
| `factual_background` | string | 创作背景，**须标注来源**（如「来源：About the Song」）。无信息可空字符串 |
| `cultural_roots` | string | 文化语境 / 社会背景 / 发行时语境。可空字符串 |
| `known_interpretations` | 对象数组 | 每项 `{ source:string, meaning:string }`。可空数组 |
| `search_queries_used` | string[] | 实际用过的搜索词（来自 build-l0-input 生成的搜索指令）。可空数组 |

> **框架不自己搜**：`search_queries_used` 只记录**平台实际执行**的搜索词。搜索本身由平台（Cuckoo 子代理 / 其它 Agent / 手动）完成。

## 3. lyrics_scan 段（歌词速读）

**粗读**：只取字面大意 + 整体基调，够冲突检测用（精读是 L1 歌词分析师的事）。

| 字段 | 类型 | 约束 |
|---|---|---|
| `summary` | string | 字面大意（1-3 句） |
| `overall_tone` | string | 整体基调（如「悲伤」「希望」「怀念」） |

## 4. user_intent 段（用户意图）

| 字段 | 类型 | 约束 |
|---|---|---|
| `stated` | string | 用户**明确说的**（原话归纳）。可空字符串 |
| `implied` | string | 从场景/受众**推断的**（发布/纪念/二创）。可空字符串 |
| `pasted` | string | 用户主动粘贴的解读。无则空字符串 |
| `narrative_style` | string | 用户想要的叙事风格（克制 / 宏大 / 碎片 / 线性…）。可空字符串 |

> `stated` 与 `implied` 至少一个非空（不能完全没意图信息）。

## 5. conflict 段（冲突检测）

| 字段 | 类型 | 约束 |
|---|---|---|
| `has_conflict` | boolean | **必填**。无冲突 → `items` 必须为空数组 |
| `items` | 对象数组 | 每项见下表 |
| `resolution` | enum | `询问用户` / `深层串联` / `网络匹配` / `AI 自决` / `垫底`。无冲突时可为空字符串 |
| `resolution_note` | string | 处理依据说明。可空字符串 |

**items[] 字段约束**：

| 字段 | 类型 | 约束 |
|---|---|---|
| `aspect` | string | 冲突维度（情绪基调 / 叙事方向 / 隐喻用法…） |
| `user_side` | string | 用户意图一侧 |
| `song_side` | string | 歌曲本意/网络共识一侧 |
| `severity` | enum | `low` / `mid` / `high` |

> 冲突清单的独立规范见 `dsl/schemas/conflict.schema.md`。`tools/resolve-conflict.js` 据其产出 resolution。

## 6. creative_constitution 段（创作宪法主体）

**后续所有层引用的约束框架**。

| 字段 | 类型 | 约束 |
|---|---|---|
| `core_meaning` | string | 综合三方后的核心意思。**必填非空** |
| `must_preserve` | string[] | 歌词本意锚点（不可偏离）。可空数组，但**不得与 can_interpret 冲突** |
| `can_interpret` | string[] | 可自由发挥的空间。可空数组 |
| `narrative_style` | string | 最终采纳的叙事风格。**必填非空** |
| `conflict_notes` | string | 冲突如何处理（问过用户 / 深度串联 / 网络匹配 / AI 自决 / 垫底） |

> `must_preserve` 是**硬约束**：无论怎么融合，不能脱离歌词本身的意思（见 ARCHITECTURE.md §4.2 第 3 类信息源）。

## 7. 完整示例

见 `dsl/examples/l0-demo/constitution.json`。

## 8. 校验

```bash
node tools/validate-constitution.js constitution.json
```

- exit 0：无 error。
- exit 1：存在 error，逐条打印并定位到具体路径（如 `creative_constitution.core_meaning 缺失`）。

## 9. 枚举值速查

| 枚举 | 取值 |
|---|---|
| conflict.items[].severity | low / mid / high |
| conflict.resolution | 询问用户 / 深层串联 / 网络匹配 / AI 自决 / 垫底 |
