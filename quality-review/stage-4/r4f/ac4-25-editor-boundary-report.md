# AC4-25 · 编辑器边界报告

日期：2026-10-25  
状态：**PASS（边界/round-trip/export）；有既有历史局限**。

## 测试

`v4/tests/r4f/editor-boundary.test.ts`（10）：

- 100 步全部 Undo 回到初始。
- 101 步时最旧被丢弃；Undo 100 次后首步仍在。
- 1000 步容量保持 100。
- 空 Undo/Redo、no-op、新编辑截断 redo。
- keyframes 0 / 1 / 1000。
- time 0 / duration 边界 / 负数 / NaN / Infinity / `MAX_SAFE_INTEGER+1`。
- layer 1/2/3/32/0/33；grid null/1/8/0/9。
- duration 0/负值/越界；seed 负值/非整数；缺失 keyframe。
- `toJson → fromJson` 保留 keyframes / bindings / neuModules / effects / seed / ai。
- `editor.json.ai` 只含 keyRef；raw key/未知字段拒绝。
- export v2 0/1/多 notes，`parseChartSourceData` 回读一致。
- 非法 schema / 未知字段拒绝或稳定处理。

运行结果：10/10 pass。

## 已知局限

- History 只覆盖 keyframe 操作；`bindings` / `neuModules` / `effects` 的 setter 不进 Undo。R4f 按授权记录为 **known limitation**，不修。
- 未做完整 Editor UI 的 100 步浏览器 e2e；本次是核心模型边界测试。
- “连线”以 bindings / NEU module connections 验证 round-trip；没有新增独立连接模型。
- 当前 `ChartEditUndo` 有界 100；AI 批量插入仍只占 1 条历史（R4e.1b 已覆盖）。

## 结论行

AC4-25：**边界、100/101/1000、round-trip、export v2 全部通过；bindings/NEU/effects 无 Undo 为已知限制。**
