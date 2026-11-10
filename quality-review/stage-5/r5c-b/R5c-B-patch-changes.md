# R5c-B-patch · 修复 `?mode=rhythm` 粘性

时间：2026-10-26（Asia/Shanghai）
状态：**R5c-B-patch 完成**；未改判定数学、账本、AudioClock、R4a~R5c-B 其他冻结逻辑。

## 1. 粘性修复方案

采用 **一次性 debug 入口 + closeGame 重置**（A1/A2 的组合，按语义实现）：

### 1.1 入口消费

新增 `v4/app/src/game/gameModeEntry.ts`：

```ts
consumeInitialGameMode(search, storage)
resetGameModeEntry(storage)
```

规则：

- `?mode=rhythm` → `Rhythm`，并立即从 sessionStorage 删除 debug 标记。
- `?mode=explore` → `Explore`，并删除旧标记。
- 无 query 且 storage 中仍有 rhythm → 消费一次 `Rhythm`（仅用于兜住 Tauri 在 App 模块前丢 query）。
- 其他 → `Explore`。
- **消费后 sessionStorage 不再保留 rhythm**；刷新/新标签页无 query 自然回 Explore。

`index.html` 只在 URL 含 `mode=rhythm` 时预写 sessionStorage；App 模块加载时消费并清除。

### 1.2 closeGame / openEditor 重置

`App.tsx`：

- `initialGameMode` 改为可变 state（仍由 `consumeInitialGameMode` 初始化）。
- `closeGame()`：
  - `setGameEntry(null)`
  - `resetGameModeEntry(sessionStorage)`
  - `setInitialGameMode('explore')`
- `openEditor()`（从游戏进入编辑器也视为离开游戏）：
  - 同样重置 Explore + 清 sessionStorage。
- 再次进入世界（不带 query）→ App 传 `initialMode='explore'`。
- 再次进入世界（带 `?mode=rhythm`，页面重新加载）→ 重新消费一次 Rhythm。

### 1.3 语义结果

| 场景 | 结果 |
|---|---|
| 第一次 `?mode=rhythm` 进入 | Rhythm |
| 关闭世界/进编辑器后再进入，无 query | **Explore** |
| 关闭后重新导航 `?mode=rhythm` | Rhythm |
| 刷新，无 query | **Explore** |
| 新标签页，无 query | **Explore** |
| `?mode=explore` | 强制 Explore 并清旧标记 |

`?mode=explore` 仍保留为“新标签页打开时强制 Explore”的语义；同一 SPA 内不需要动态改 URL，`closeGame` 已重置 state。

## 2. 旧 e2e 改造清单

只改 URL/导航，**不改断言逻辑**：

1. `r4f.e2e.mjs`
   - 新增 `reopenRhythm()`：失败重试和最终重开都重新导航 `?r4f=1&mode=rhythm`。
2. `r4f-fault.e2e.mjs`
   - 故障重载改为导航 `?r4f=fault&mode=rhythm`。
3. `r5a.e2e.mjs`
   - 编辑器后重载改为导航 `?r5a3=1&mode=rhythm`。
4. `r5b1.e2e.mjs`
   - 72s demo 重载改为导航 `?r5b1=1&mode=rhythm`。
5. `r5b2.e2e.mjs`
   - 两处 reload 改为导航 `?r5b2=1&mode=rhythm`。
6. `r5b2-patch-clock.e2e.mjs`
   - 初始入口已是 `mode=rhythm`，无二次重进。
7. `r5c-a-layer.e2e.mjs`
   - 编辑器后的 game 导航已带 `mode=rhythm`。
8. `r5c-a-media.e2e.mjs`
9. `r5c-a-editor.e2e.mjs`

旧 9 个 e2e 的初始导航均保留 `?mode=rhythm`；二次进入统一显式带 query。

## 3. 单元测试

新增 `v4/tests/r5c/b-patch-mode.test.ts`（7 项）：

- 一次 `?mode=rhythm` → Rhythm，并消费 storage。
- closeGame 重置 → 再次进入无 query → Explore。
- 再次进入带 `?mode=rhythm` → Rhythm。
- 刷新无 query → Explore。
- 新标签页无 query → Explore。
- Tauri 先丢 query 但 index.html 已预写 → 只 Rhythm 一次。
- `?mode=explore` 强制 Explore 并清旧标记。

合计：**442 / 442 pass**。

## 4. 自跑结果

| 项 | 结果 |
|---|---|
| `npm run typecheck:v4` | exit 0 |
| `npm run test:v4` | **442 / 442 pass** |
| `npm run check:v4` | totalErrors=0，allPassed=true |
| `npm --prefix v4/app run build` | 成功（仅既有 chunk/dynamic import warning） |
| `cargo test` | 35 passed（Rust 未改） |
| 旧 9 个 e2e | **9/9 通过** |
| `r4f.e2e` | 6/6 notes，账本 valid，treeVisible=true |
| `r4f-fault.e2e` | 通过 |
| `r5a.e2e` | 通过 |
| `r5b1.e2e` | 72s demo，BPM 90 / 72.000（`NEUROU_E2E_PROJECT` + `NO_RECORD=1`） |
| `r5b2.e2e` | 通过 |
| `r5b2-patch-clock.e2e` | 通过 |
| `r5c-a-layer/media/editor` | 3/3 通过 |
| `r5c-b-explore` | 通过；账本 1 |
| `r5c-b-mid-exit` | 通过；账本 0 |
| `r5c-b-cutscene` | 通过；账本 0；未知 id 告警 |

## 5. 一句话状态

**R5c-B-patch 完成：`?mode=rhythm` 变为一次性 debug 入口，closeGame/openEditor 重置 Explore 并清除 sessionStorage；刷新/新标签页无 query 回 Explore，二次 debug 进入显式带 query；442 单测、35 Rust、旧 9 e2e 与 R5c-B 3 e2e 全绿。**
