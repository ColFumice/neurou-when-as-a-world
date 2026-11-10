# R4b.1 引擎与编辑器补全

日期：2026-10-24
范围：NEU 核心执行器、编辑器 NEU UI、`GameNeuRuntime` 骨架与单测；世界内 `/edit` 导航修复。
未改动：R4a 判定、`audioClock`。

## 1. 核心执行器

### 1.1 A 类值对象

新增 `v4/core/eventgraph/RandomMode.ts`：

- `RandomPreviewMode`：`Seeded` / `Live`
- `RandomSeed`：0..2^32-1 的值对象
- `CycleWarning`：`moduleId` / `atMs` / `limit` / `reason`

说明：名库把这三个 A 名归在 G（eventgraph），不是 E（editor）。为通过
`check-naming` 与依赖矩阵，放在 `core/eventgraph/`；E 层 `NeuRuntime` 只做
**type-only** 导入，实际 Seeded/Live 构造由 X 层编辑器/宿主注入。

### 1.2 NeuRuntime options

`v4/core/editor/runtime/NeuRuntime.ts` 构造函数新增：

```ts
new NeuRuntime(modules, {
  mode?: RandomPreviewMode;
  seed?: RandomSeed;
  randomValue?: () => number;
  onCycleWarning?: (warning: CycleWarning) => void;
});
```

- `Seeded`：每模块独立 `triggerSeq`，`mulberry32(hash(seed, moduleId, seq))`
- `Live`：调用注入的 `randomValue()`
- 核心不 import `crypto` / DOM / React

### 1.3 原生 feedback loop

- 不再新增 `Loop`/`LoopAction` 节点。
- `compileNeuGraph` 仍做 Kahn 排序；环不再算编译错误，剩余节点按声明顺序补入 order。
- runtime 按 pulse count 做最多 **100 轮**传播：
  - DAG 一轮或多轮内自然稳定；
  - 任意 output→input feedback 环都会在同一 playhead 内继续传播；
- `CycleWarning(reason='GraphCycle')` 在同一个 playhead 内 100 轮仍有余波时产生，不崩溃。
- `Channel` 同号回接：`channel-right-N` 收到脉冲时，把同号 `channel-left-N` 作为下一轮脉冲源；即使 `side/port` 参数缺失，也会按 `channel-right-N` 的 moduleId 兜底识别。`Audio → Delay → R4`、`L4 → Audio` 会跨 tick 循环。
- 编辑器 playback 对 `advanceTo` 加异常捕获；不会因为一次 NEU 异常让 rAF 停住而无提示。
- 原先的 `LoopAction` / `neu:loop` / `iterations` 已删除。

### 1.4 Delay / NOT / Channel

- Delay：按 playhead 调度，`currentMs + delayMs`，暂停冻结；`delayMs` 支持数字与数字字符串，避免字符串导致 0ms 同 tick 循环。
- NOT：保留 tick 语义，本 tick 无输入时触发下游
- Channel：pulse count 原样透传

## 2. 编辑器 UI

### 2.1 Modules 调色板

新增可拖入节点：

- `随机 / Random` (`neu:random`)

`Loop` / `LoopAction` 入口已删除；循环直接用原有 output→input 连线。

### 2.2 seed 与预览模式

NEU `Edit` 页新增：

- `RandomSeed` 数值输入（0..4294967295）
- `Preview Mode`：`Seeded` / `Live`，默认 `Seeded`

预览模式不写回 `editor.json`；seed 使用文档现有 `seed` 字段。

### 2.3 NOT 提示与环告警

- NOT 模块卡片显示：`本 tick 无输入时触发下游`
- feedback ring 达到 100 轮时，环内模块卡片加 `is-cycle-warning` 红色边框 + `CYCLE ×100` badge
- 编辑器播放前清空上次 warning

### 2.4 Ctrl+Z / NEU undo

- 原有 `ChartEditUndo` 只覆盖关键帧增删改；NEU 节点、连线、参数、seed 不进历史，所以在此前看起来“Ctrl+Z 没实现”。
- 新增编辑器内 NEU 快照历史（上限 100），覆盖：
  - 节点新增/删除
  - 连线/断线
  - 节点移动/参数
  - seed 修改
- `Ctrl+Z` 优先撤销最近一次 NEU 编辑；没有 NEU 历史时走原 `ChartEditUndo`。
- 编辑器预览对同一 `atMs` 的重复音频做一次去重，防止 ring 同 tick 重入时同时启动大量采样。
- `Ctrl+Shift+Z` / `Ctrl+Y` 支持 NEU redo。

### 2.5 右栏延迟展开

- 拖动模块时不再立即打开右栏。
- 只有指针抬起且移动距离 < 6px（静止点击）后等待 500ms 才打开。
- 拖动、双击删除、点击空白都取消该定时器。
- 已打开的右栏不会因拖动而关闭；只是不再每次自动弹出。

### 2.6 触发高亮动画

- 模块 activity 高亮时长改为 **900ms**。
- Delay 1000ms 循环时，每 1000ms 重新触发一次高亮；900ms 后清空，不会把上一秒的 RhythmPoint 继续留在 active 集合里。
- 未进入反馈环的 RhythmPoint 只在 0s 首次触发，不会每秒重新高亮。
- 连线高亮只跟随**循环边**：只有 target 能沿图回到 source 的边才亮，且 source 必须 active；顶部 RhythmPoint→Audio 这条非循环边不再高亮。
- R→L 隐式回接参与循环边判定；L4→Audio 这段循环连线仍会每秒亮。

### 2.7 事件接口多目标

- `L1..L6` 这类事件接口现在可以同时接多个模块：targets 追加而不是覆盖。
- `R1..R6` 也可以接收多个上游模块：inputs 追加并去重。
- 普通模块输出/输入原本就是数组，验证可多目标；重复连接会被去重。
- 删除/断开其中一条边不会清空同接口的其他边。

## 3. GameNeuRuntime 骨架

新增 `v4/app/src/game/neuRuntime.ts`：

- `GameNeuRuntime` 持有核心 `NeuRuntime`
- 方法：`reset` / `advanceTo` / `dispose`
- `GameSignalSink.emit` 统一投递：
  - `Audio` / `Resource` / `Subtitle` / `Effect` / `Light`
  - `CycleWarning`
- Binding 与 NEU Audio 双轨输入；同 asset + 同 tick 时 binding 优先去重
- 未接真实视觉 sink

## 3.1 世界内 `/edit`

进入 GameScreen 后，左下角常驻 `NeurOS  C:\A_Try\<project>` 命令行：

- 按 `/` 聚焦命令行（也可直接点击）
- 输入 `edit` 或 `/edit` 回车 → 打开当前 world 的编辑器
- 输入 `exit` / `/exit` → 退出世界
- `Esc` 关闭/清空命令输入

同时修复 `ProjectConsole` 的 world command：接受带前导 `/` 的 `/edit`。

`openEditor` 现在会先清空 `gameEntry`，避免从编辑器退出后又回到 GameScreen。

## 4. 测试

新增 `v4/tests/r4b/`：

- `neu-truth-table.test.ts`：AND / OR / NOT / Channel
- `neu-random.test.ts`：Seeded 同 seed 同结果；不同 seed 不同；Live provider 不同
- `neu-delay.test.ts`：playhead 推进、暂停冻结、大帧跳跃、delayMs 数字字符串
- `neu-loop.test.ts`：原生 feedback ring 100 轮告警、其他分支、DAG 不告警、`R3→L3` 跨 tick 循环
- `neu-signal-sink.test.ts`：GameNeuRuntime fake sink、binding 优先去重、暂停不投递

`package.json` 的 `test:v4` 已加入 `v4/.dist/tests/r4b/*.test.js`。

结果：

```text
tests 203
suites 48
pass 203
fail 0
```

R4a 既有 183 项全部保留，无退化。

## 5. 验证命令

```text
npm run typecheck:v4      pass
cd v4/app && npm run typecheck   pass
npm run check:v4          totalErrors=0 allPassed=true
npm run test:v4           203 / 203 pass
cd v4/app && npm run build       843 modules / pass
```

## 6. 编辑器实测

Tauri 实机：

- Modules 页可见 `随机 / Random`
- Random 节点可拖入蓝图
- `RandomSeed` 从 `20261023` 改为 `42`，Preview Mode 切到 `Live` 生效
- NOT 卡片显示 tick 提示
- 添加 Random 后 `Ctrl+Z` 删除该节点，`Ctrl+Y` 恢复
- feedback ring 达到 100 轮时由 runtime 产生 `CycleWarning`
- GameScreen 左下角显示 `NeurOS  C:\A_Try\chromato >` 命令行；输入 `/edit` 成功进入编辑器；编辑器 Esc 返回项目树，不回到游戏

证据：

- `editor-neu-modules.png`（旧截图，含已删除的 Loop 入口；当前以 `editor-neu-seed.png` 为准）
- `editor-neu-seed.png`
- `game-world-command.png`
- `game-world-command-style.png`
- `test-run.log`
- `app-build.log`

## 7. 已知边界

- 不新增 Loop 节点；循环直接由原有 output→input feedback ring 表达。
- `R3/N` 与 `L3/N` 同号通道回接由 runtime 完成；不同号不串联。
- ring 通过 pulse count 传播，最多 100 轮；超过产生 `CycleWarning`，不崩溃。
- `GameNeuRuntime` 只到骨架，不加载 chart/editor，不投递真实视觉。
- `assetResolver` 已保留接口，R4b.2 接游戏资源。
- 世界内命令只做 `/edit`、`/exit`、`/help`；不做完整 shell。



## R5c-B v2 addendum（2026-10-26）

- `NeuModuleType` 增加 `EnterRhythmMode / PlayCutscene / ExitToExplore`。
- 控制信号 `NeuControlSignal` 与 `NeuSignal` 分离，通过 `onControl` 投递，不进入视觉/音频 Sink。
- `NeuRuntime`：
  - `activation: Explore | Rhythm`；
  - Explore 跳过 RhythmPoint / Binding，支持时间根与 `trace:` / `trigger:` 虚拟脉冲；
  - Rhythm 忽略 Control。
- `GameNeuRuntime` 暴露 `pulse(sourceId)`，`activation=Explore` 时跳过 binding。
- 单测：控制信号路由、虚拟脉冲、Rhythm ignore、Explore 过滤、control 不泄漏。
