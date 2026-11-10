# R4f 变更说明 · 端到端与最终验收（R4f-patch）

日期：2026-10-25  
状态：**R4f-patch 完成，R4f 可冻结**。

## 1. 范围与基线

R4f 不新增玩法、不做美术替换/性能优化/移动端适配；只做 e2e、边界测试、HUD 诊断与冻结收口。

Phase 0 基线：

```text
全仓（R4f 测试前）：350 / 350
R4a~R4d 基线：276 / 276
gates：0 ERROR
cargo test：31 / 31
```

Phase 0 备份：`quality-review/stage-4/r4f/backup/`，ledger/head 当时不存在（`.absent`）；E2E `finally` 恢复并校验 hash。

## 2. AC4-28 端到端

脚本：

```text
v4/app/tests/e2e/r4f.e2e.mjs
v4/app/tests/e2e/r4f-cdp.mjs
v4/app/tests/e2e/r4f-fixtures.mjs
v4/app/tests/e2e/r4f-fault.e2e.mjs
```

真实 Tauri App + WebView2 CDP，Node 内置 `fetch`/`WebSocket`，非 Playwright。

主路径：

```text
项目树 → chromato → project console → cd w1
→ 加载/ready → 6 notes 全 Perfect
→ 首演/ledger → 重开再 Perfect → 不重复写
→ project tree
```

实测：

```text
attempt 1: perfect=6 good=0 miss=0 complete=true
reopen:    perfect=6 good=0 miss=0 complete=true
ledger lines=1, valid=true
ledgerAfterReopen lines=1
treeVisible=true
restored=true
externalRequests=[]
```

证据：

- `evidence/e2e-run.json`
- `evidence/e2e-success-report.json`
- `evidence/e2e-completed.png`

### 网络

CDP 0 外部请求；默认 Rain/AI 关闭；未开启时 Rust 天气/AI 命令不触发。

Windows Firewall 规则因无管理员权限未能创建。按 PROTOCOL 裁定：**CDP 层 0 请求 + 代码审查（默认关闭）接受为有条件通过**；后续管理员会话可复跑。

## 3. AC4-24 HUD 漂移接入

文件：

- `v4/app/src/game/clockDrift.ts`
- `v4/app/src/game/GameHud.tsx`
- `v4/app/src/game/GameScreen.tsx`
- `v4/tests/r4f/hud-drift-integration.test.ts`
- `v4/tests/r4f/clock-drift.test.ts`

实现：

- 每 30 帧采样一次；
- `<25ms`：正常；
- `25..50ms`：黄色 `CLOCK DRIFT WARNING`；
- `>50ms`：红色 `CLOCK DRIFT` + monitor 基准 re-anchor；
- `>100ms`：红色 `AUDIO OFFLINE`，暂停判定输入（`submitStrike` / pointer strike gate）。
- **不修改** `judge.ts` / `audioClock.ts` / `ChartSnapshot` playhead / `AudioOutputClock` 内部；re-anchor 只重置监视器基准，避免冻结逻辑被改动。
- Downbeat：无 beat 数据/提取，按批准记录 **R5 GAP**。

测试：9/9 pass（HUD 4 + 180s 漂移 5）。

实机：

- Warning：`evidence/hud-drift-warning.png`
- Critical：`evidence/hud-drift-critical.png`，显示 `AUDIO OFFLINE`。
- 临时 drift 注入使用 `window.__R4F_DRIFT_OVERRIDE__`（测试 seam，默认不设置）。

## 4. AC4-25 编辑器边界

`v4/tests/r4f/editor-boundary.test.ts`（10）通过：

- History 0/1/99/100/101/1000；
- 100 步全部 Undo；101 步最旧丢弃；空 Undo/Redo；新编辑截断 redo；no-op；
- keyframes 0/1/1000；
- time/layer/grid/duration/seed/边界；
- toJson/fromJson 保留 keyframes/bindings/neu/effects/seed/ai；
- export v2 0/1/多 notes + `parseChartSourceData`；
- 非法 schema/未知字段。

已知局限：History 只覆盖 keyframe；bindings/NEU/effects 的 setter 没有 Undo。

## 5. Fault e2e 收口

`v4/app/tests/e2e/r4f-fault.e2e.mjs` 实测：

1. **Ledger Corrupt**
   - `game=true`
   - `ledgerHud=true` → `LEDGER / CORRUPT · READ ONLY`
   - `ledgerUnchanged=true`
   - 截图 `evidence/fault-ledger-corrupt.png`
2. **Tauri 命令失败**
   - page init 注入 `window.__R4F_FAIL_INVOKE__=true`（测试 seam）
   - 自动 fallback 到 `fallback-w1`，HUD/overlay 显示错误，不白屏
   - 截图 `evidence/fault-tauri-unavailable.png`
3. **Rust 进程死亡**
   - Node `taskkill` 进程树；`processKill=true`
   - 只验证进程/端口清理，不承诺前端存活
4. **快速 `/edit`**
   - 连续 20 次 Enter；最终 `editors=1`、`games=0`，只发生一次跳转
   - 没有做 heap/localStorage 泄漏量测（只验证 DOM 幂等）

纯 fault 测试 5/5：ledger head 缺失/malformed/checksum、append 拒绝、sidecar 降级、主谱面不受影响。

证据：`evidence/fault-e2e.json`、`fault-ledger-corrupt.png`、`fault-tauri-unavailable.png`。

## 6. 测试与构建

```text
npm run typecheck:v4        exit 0
npm run test:v4             374 / 374，81 suites，0 fail
R4a~R4d baseline            276 / 276
npm run check:v4            4 gates 0 ERROR / allPassed=true
v4/app typecheck            exit 0
v4/app build                890 modules / built in 2.64s
cargo test                  31 / 31
e2e                         主流程 PASS + fault e2e PASS
```

R4f 新增：

- R4f initial 20
- HUD drift +4
- 合计 R4f 24；全仓 374。

日志：`quality-review/stage-4/r4f/logs/`
（`patch-test-v4.log`、`patch-gates.log`、`patch-typecheck-v4.log`、`patch-app-typecheck.log`、`patch-app-build.log`、`patch-cargo-test.log`、`patch-baseline-276.log`）。

## 7. AC 矩阵

| AC | 状态 | 说明 |
|---|---|---|
| AC4-28 | **PASS（有条件）** | 真实 Tauri E2E：Perfect 6/6、ledger +1、重开不重复、treeVisible、restore；CDP 0 外部请求；OS 防火墙因权限未执行，按 PROTOCOL 接受 |
| AC4-24 | **PASS（Downbeat GAP）** | HUD warning/error/critical、25/50/100ms、180s 测试、输入暂停；monitor-only re-anchor，不改 audioClock；Downbeat R5 GAP |
| AC4-25 | **PASS** | 100/101/1000、round-trip、export v2；History 只覆盖 keyframes 为 known limitation |
| Fault | **PASS（有界）** | ledger Corrupt HUD、Tauri failure fallback、进程清理、20 次 /edit 单跳转；无 heap 泄漏量测 |
| R4 冻结 | **YES** | R4a~R4f 374 测试，E2E 主路径通过 |

## 8. R4 阶段总结

```text
R4a ~ R4e：350（冻结）
R4f：+24
全仓：374
R4a~R4d 基线：276
A 类：325
```

R4 已实现并验证：8 格判定、NEU、痕/框、账本/首演、AI、Rain，以及真实 Tauri 端到端。

## 9. 残留/风险

1. **Windows Firewall**：无管理员权限；接受 CDP + 代码审查有条件通过，后续可补 OS 级证据。
2. **Downbeat**：无节拍提取，R5 GAP。
3. **Drift re-anchor**：monitor-only，未改冻结的 AudioOutputClock 内部；HUD/输入暂停已生效。
4. **History**：bindings/NEU/effects 无 Undo；keyframe 历史边界已覆盖。
5. **Fault**：无 heap/localStorage 泄漏量测；Rust 进程死亡只验证清理。
6. **E2E 可重跑性**：Pixi 项目树节点轻微漂移，脚本有限候选坐标；本次已通过。

## 10. 一行状态

**R4f-patch 完成，R4f 可冻结。**

## R5c-B v2 addendum（2026-10-26）

- 账本语义保持：每个 `(projectRoot, worldId, chartId)` 一次首演；`PremiereRecorded` 不覆盖。
- 只有 Rhythm 自然完成 + 全部 note 已判才构造 ChartPremiere / `recordPremiere`。
- 中途退出（`EXIT TO EXPLORE` / `ExitToExplore`）不写；Cutscene 不写。
- 正常完成显示结果页 → `RETURN TO EXPLORE`；debug Rhythm 保持旧 completed 页。
- R5c-B explore e2e 账本 1 条；mid-exit 0 条；cutscene 0 条；R4f reopen 仍 1 条。
