# 《冲突清单》规范（L0 冲突检测产出）

> 本文件定义 render-forge L0 语境与叙事层中**冲突检测**（子步骤 0.3）产出的**冲突清单**（Conflict List）结构。
> 它判断「用户意图」与「歌曲本意 / 网络共识」是否冲突，是 L0 唯一可能**打断用户**的点（异常分支）。
> 冲突清单会被 `tools/resolve-conflict.js` 消费，产出 resolution（确定性分支逻辑）。

## 0. 定位

- 冲突清单**只做判断与描述**，不做处理决策（处理是 resolve-conflict.js 的事）。
- 它是创作宪法 `conflict` 段的**输入**：宪法里 `conflict` 字段即本清单 + resolution。
- **判定标准**（情绪基调相反 / 叙事方向矛盾 / 隐喻用反 等）由 `prompts/conflict-detector.md` 约束。

## 1. 顶层结构

```json
{
  "has_conflict": true,
  "items": [
    {
      "aspect": "情绪基调",
      "user_side": "用户说要欢快",
      "song_side": "歌曲实为悲伤",
      "severity": "high",
      "possible_bridge": "用户理解的某种深层串联（如有）",
      "matching_interpretation": "网上解读中最贴合用户意图的（如有）"
    }
  ]
}
```

## 2. 字段约束

| 字段 | 类型 | 约束 |
|---|---|---|
| `has_conflict` | boolean | **必填**。`true` 表示存在冲突；`false` 时 `items` 必须为空数组 |
| `items` | 对象数组 | 冲突条目列表。`has_conflict==true` 时**必须非空** |
| `items[].aspect` | string | 冲突维度（必填）。建议取值：情绪基调 / 叙事方向 / 隐喻用法 / 主题侧重 / 受众定位 |
| `items[].user_side` | string | 用户意图一侧（必填） |
| `items[].song_side` | string | 歌曲本意 / 网络共识一侧（必填） |
| `items[].severity` | enum | 严重度（必填）：`low` / `mid` / `high` |
| `items[].possible_bridge` | string | 可选。用户意图与歌曲本意之间的**深层串联**（若有）。resolve-conflict 分支 a 用 |
| `items[].matching_interpretation` | string | 可选。网上解读中最贴合用户意图的那条。resolve-conflict 分支 b 用 |

## 3. 判定标准

**何时算冲突**（详见 `prompts/conflict-detector.md`）：

1. **情绪基调相反**：用户要「欢快」，歌词/共识是「悲伤」。
2. **叙事方向矛盾**：用户要「线性叙事」，歌曲结构是「碎片/意识流」。
3. **隐喻用反**：用户的解读把歌曲隐喻**反着用**（如把「坠落」当「上升」）。
4. **主题侧重错位**：用户只抓歌曲的次要侧面，与歌曲核心意思相悖。

**不算冲突**（正常发挥空间）：
- 用户抓歌曲的**某个合法侧面**（歌曲有多义性）。
- 用户采用**网上已有解读**之一。
- 用户意图与歌曲本意**互补**而非矛盾。

## 4. severity 分级

| 级别 | 含义 | 对处理的影响 |
|---|---|---|
| `low` | 轻微偏差，可忽略或微调 | 通常不必问用户，AI 自决可覆盖 |
| `mid` | 明显分歧，需要处理 | 优先深层串联 / 网络匹配 |
| `high` | 直接对立，会改变整片基调 | **强烈建议问用户**（除非明确不许问） |

## 5. 与创作宪法的关系

冲突清单在创作宪法里体现为 `conflict` 段：

```json
{
  "conflict": {
    "has_conflict": true,
    "items": [ /* 本清单的 items */ ],
    "resolution": "深层串联",
    "resolution_note": "用户想表达『挫折后的重生』，与歌曲的『坠落后升起』深层串联"
  }
}
```

> `resolution` 由 `tools/resolve-conflict.js` 产出（确定性分支逻辑），不由冲突检测分析师决定。

## 6. 完整示例

见 `dsl/examples/l0-demo/conflict.json`。

## 7. 校验

冲突清单本身不含独立校验器（作为创作宪法的一部分，由 `tools/validate-constitution.js` 校验 `conflict` 段）。

## 8. 枚举值速查

| 枚举 | 取值 |
|---|---|
| has_conflict | true / false |
| items[].severity | low / mid / high |
| items[].aspect | 情绪基调 / 叙事方向 / 隐喻用法 / 主题侧重 / 受众定位（建议） |
