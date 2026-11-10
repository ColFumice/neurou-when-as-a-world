# R4d.3 + R4d.4 变更说明 · 真实项目路径与首演落盘

日期：2026-10-25

范围：组合根注入、三个 Collector、异步 finish、HUD 状态与实机验收。

## 1. 组合根与项目路径

### App.tsx

- `gameEntry` 增加 `projectRoot`；
- `initialGameEntry()` 使用 `DEMO_PROJECT_ROOT`；
- `openGame(world, projectName, projectRoot = DEMO_PROJECT_ROOT)`；
- `ProjectTreeDemoScreen` 接收并转发 `projectRoot`；
- `GameScreen` 必填 `projectRoot`。

### chartLoader.ts

- 删除硬编码 `DEMO_PROJECT_ROOT`；
- `loadGameChart(worldId, projectRoot)` 使用传入根；
- 媒体音频路径同样使用传入根，不再固定 demo 根。

### projectRoot.ts

- `DEMO_PROJECT_ROOT` 移到独立 X 模块，只由 App 使用；chartLoader 不再持有常量。

## 2. GameLedgerHost

文件：`v4/app/src/game/gameLedgerHost.ts`

- 构造：`projectRoot + worldId + chartId`；
- `TauriProjectIo.openProjectRoot(projectRoot)`；
- `TauriLedgerFile(worlds/<worldId>/ledger.ndjson, worlds/<worldId>/ledger.head.json)`；
- 复用 R2 `LedgerStore` / `LedgerReader`；
- 写入委托 `ChartPremiereDirector`；
- 状态：
  - `Ready`
  - `PremiereRecorded`
  - `Corrupt`
  - `Unavailable`
- `getStatus()` / `getDiagnostic()`；
- 首次 `load()` 调 `readAll()`；
- 损坏时只读，不截断、不重建、不重试；
- `worldId` 校验：`^[A-Za-z0-9._-]+$`，且拒绝 `.` / `..`；
- 路径纯函数在 `narrative/ledgerPaths.ts`，单测可直接跑 Node 适配器。

## 3. Collectors

### TraceNarrativeCollector

- 实现 `TraceEventSink`；
- 唯一 Revealed / Touched / FrameLost；
- Deep / Anomalous / Rain 从 `GameTracePlacement` 取 tier/origin；
- ExitPerception 只计数诊断，不进 20 维；
- 采集异常 catch 后转 HUD warning。

### NeuNarrativeCollector

- 实现 `GameSignalSink`，wrapper 包住 `GamePlaybackSink`；
- 先转发 delegate，再采集；
- 只计 `origin === 'NEU'`；
- 按 `kind + moduleId` 去重；
- Binding Audio 单独计数；
- Subtitle 只记 module 出现，不记 text；
- 采集异常 catch，不改变 R4b 音频/动效/光效行为。

### TriggerNarrativeCollector

- 实现 `TriggerSink`，包住现有 HUD sink；
- 五类信号按种类去重；
- 采集异常 catch。

## 4. finish 改造

- `finish` 改为 async，`finishingRef` 防重入；
- `snapshot.advance(durationMs)` 后收集 trace / NEU / trigger 统计；
- 完成条件：
  - 自然到 duration；
  - `loaded.source !== 'fallback'`；
  - 所有 note 已决；
  - `loaded.notes.length > 0`；
- 构造 `ChartPremiere`；
- `await ledgerHost.recordPremiere()`；
- 成功/失败/损坏/已记录分别写 HUD；
- 写入期间：
  - `exit` 直接拒绝；
  - keydown / keyup / pointer / pause 均被 `finishingRef` 拦截；
- 写入失败仍 `setPhase('completed')`；
- 不重试 append。

## 5. HUD

- `Ready`：不显示；
- `PremiereRecorded`：显示“首演已记录”；
- `Corrupt`：显示“账本只读：…”；
- `Unavailable`：显示“账本不可用：…”；
- 写入成功：短暂显示“首演已写入账本”；
- 写入失败：显示 diagnostic；
- 状态显示为一条液态玻璃状态条；
- START / RESULT 覆盖层同时显示该消息；
- 不做账本 UI 浏览。

## 6. 测试

新增：

- `v4/tests/r4d/trace-ledger-bridge.test.ts`（3）
- `v4/tests/r4d/neu-ledger-bridge.test.ts`（4）
- `v4/tests/r4d/trigger-ledger-bridge.test.ts`（3）
- `v4/tests/r4d/ledger-project-path.test.ts`（4）

结果：

```text
npm run test:v4
  tests 276
  suites 61
  pass 276
  fail 0
  R4a~R4c 251/251 基线单独复跑通过

npm run check:v4
  totalErrors=0 allPassed=true

cd v4/app && npm run build
  869 modules transformed
  built in 2.60s
```

证据：

- `r4d3-4-test-run.log`
- `r4d3-4-baseline-251.log`
- `r4d3-4-gates.log`
- `r4d3-4-app-build.log`

## 7. 实机验收

运行方式：Tauri debug + WebView2 CDP，demo 项目根进入 `w1`。

| 场景 | 结果 |
|---|---|
| 中途退出 | `worlds/w1` 不存在，0 条 |
| 完整打完（全 Miss，6 notes 全决出） | `ledger.ndjson` 1 行，`ledger.head.json` eventCount=1 |
| 重开同一 world | HUD / START 显示“首演已记录” |
| 重演再完成 | 两份文件 SHA256 不变，仍 1 行 |
| head checksum 篡改 | HUD“账本只读：ledger checksum mismatch”；完整打完仍 CHART COMPLETE；ledger 不变，0 追加 |
| fallback 谱面完成 | HUD“fallback 谱面不写首演”；`worlds/w1` 无账本文件 |

首演事件：

```json
{"eventId":"premiere:chart-w1","vector":[30,5,0,0,0,50,20,5,0,0,0,45,0,3,0,45,0,60,0,0],"vectorSchemaVersion":1,"appendedAt":{"epochMs":1792859802314},"chartRef":"chart-w1"}
```

SHA256：

```text
ledger.ndjson  0B1B8AC88C6A0722D74F5D7C5E3241AF6E2E281EABFD9C103E89F957A46BDB79
ledger.head.json 57F693E8F801EF4F6B9D3AAE0427B3F65C253F739B21FEE805481A7C0E375CC2
corrupt head    A457BDD32670A0E1AAD9689D42C26C2694B96D191B7F2DA1127399BD554C834F
```

实机产物已复制到 `r4d3-4-evidence/`，随后清理 demo 项目的 `worlds/w1`，保持项目可重复验收；证据包括：

- `premiere-recorded.png`
- `ledger-corrupt.png`
- `ledger.ndjson`
- `ledger.head.json`
- `hashes.txt`
- `live-observations.txt`

## 8. 约束核对

- 未修改 R4a 判定、R4b `GameNeuRuntime`/`GamePlaybackSink`、R4c `TraceRuntime`/`TriggerRuntime` 的执行逻辑；
- `GamePlaybackSink` 公开 API 不变，只通过 `NeuNarrativeCollector` wrapper 包裹；
- Collector 异常隔离；
- 账本 I/O 失败不影响 R4a 分数/判定；
- `appendNarrativeEvent` 仍只在 director 内调用。
