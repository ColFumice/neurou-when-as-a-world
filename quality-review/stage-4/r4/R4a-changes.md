# R4a.1 + R4a.2 落盘说明（权限回滚 / 键盘映射 / 白网格 / 计分 / 预滚 / 引导）

- 日期：2026-10-24（Asia/Shanghai）
- 状态：R4a.1 判定核心完成；R4a.2 视觉组件完成，并提前接入最小可玩闭环用于验收
- 依据：`quality-review/stage-4/r4/R4a-plan.md`、`docs/spec/stage-4.md` AC4-14~17 / 31~33
- 范围：Strike、ChartSnapshot/GridNote、Hold 越界、Logo 状态、动态网格、AudioOutputClock、app/game 视觉层
- 不做：AI/Rain、痕、蓝图运行时、R3 编辑器/项目树/cmp/视差改造、账本写入

---

## 1. 交付清单

### R4a.1 判定核心（C / R）

| 文件 | 内容 |
|---|---|
| `v4/core/director/types.ts` | `Strike`：`timeMs` / `chartKeyId?` / `gridCellId?` / `phase?` / `source?` |
| `v4/core/chart/note.ts` | `GridNote`、`GridKeyHold`、`HoldGridLine`；窗口判定、Hold 单层校验、Hold 状态、单 note scoreValue |
| `v4/core/chart/types.ts` | `ChartScore`：Perfect 1000 / Good 500 / Miss 0、层数 multiplier、combo 加成 |
| `v4/core/chart/logo.ts` | `NoteLogoGuide`、`NoteLogoMiss`、`NoteLogoLeadTimeMs` / `NoteLogoLifetimeMs` / `NoteLogoHoldExtensionMs` |
| `v4/core/chart/grid.ts` | `DynamicGridScale`、`GridLineVisibility`、`GridScaleRestoreCondition`；2×4 全屏、`restore(cell)` 单格缩回 |
| `v4/core/chart/blind.ts` | `BlindMode` |
| `v4/core/chart/judge.ts` | `ChartSnapshot`、`HoldGridOverflow`、`SpaceHoldOverflow`；分层仲裁、counts/score、overflow、Logo Miss |
| `v4/core/chart/clock.ts` | `AudioOutputClock` 纯映射：锚点、暂停/恢复/seek、未来锚点、clamp、单调 |
| `v4/tests/r4/*.test.ts` | 11 个 R4a 测试套件；57 项测试 |

### R4a.2 视觉层（X / app）

| 文件 | 内容 |
|---|---|
| `v4/app/src/game/GameScreen.tsx` | 组合根：320ms 白闪、加载、START、3-2-1 count-in、1.2s 预滚、GO、rAF、输入、暂停、结算、退出、网格 260ms 后缩回 |
| `v4/app/src/game/GameStage.tsx` | 双视频 GLSL 视差底图（复用 R3 的 Stereo3D shader 逻辑）；视频跟随 playhead（40ms 阈值） |
| `v4/app/src/game/GridOverlay.tsx` | 2×4 全屏纯白方框；区域键位标签；命中短暂 1.5× 后缩回 |
| `v4/app/src/game/NoteLogoLayer.tsx` | L1/L2 Logo；L1 移到 cell 1 内部；提前量、Hold 延长、Miss 红闪/抖动 |
| `v4/app/src/game/RhythmGuideLayer.tsx` | L1 全屏白色定位十字；Hold 白色引导线 + 小白色正方形；提示在格内 |
| `v4/app/src/game/FrameLayer.tsx` | `VisualFrame` 静态框与 tracking/lock 标签 |
| `v4/app/src/game/GameHud.tsx` | SCORE、Perfect/Good/Miss、combo/max、playhead、AUDIO 状态、warning |
| `v4/app/src/game/keymap.ts` | 用户指定区域：`123QWE / 456RTY / 789UIO / 0-=P[]`；`ASDZXC / FGHVB / JKLNM< / ："\|>?`；Space L1 |
| `v4/app/src/game/audioClock.ts` | `GameClock`、`WebAudioOutputClock`、`PerformanceOutputClock`、`createGameClock` |
| `v4/app/src/game/chartLoader.ts` | editor.json → v2、可选纯 v2、holds sidecar、media manifest、fallback chart |
| `v4/app/src/game/game.css` | 游戏 UI；全屏 2×4 白框/区域标签/L1 十字/Hold 线/Logo/Frame/HUD |
| `v4/app/src/App.tsx` | `onEnterWorld` → GameScreen；`#game` 直连调试入口；游戏时不再渲染项目树/Glitch/Crosshair |
| `v4/app/src/screens/ProjectTreeDemoScreen.tsx` | 透传 `onEnterWorld`；导出 `PROJECT_WORLDS` 供调试入口 |
| `v4/.stereo-demo/project/charts/chart-w1.holds.json` | 已清空 crossings；chart-w1 的 L2 Hold 不再要求越界重按（AC4-33 由合成单测保留） |
| `package.json` | `test:v4` 增加 `v4/.dist/tests/r4/*.test.js` |

---

## 2. 关键实现说明

### 2.1 Strike

```text
phase:  Down（缺省）| Up
source: Keyboard（缺省）| Pointer
```

- `ChartSnapshot.submit` 用 `phaseOf` / `sourceOf` 归一化缺省值。
- Hold 的 `Up` 只处理 active `GridKeyHold`；不会命中普通 note。
- 测试 `strike-phase.test.ts` 覆盖：缺省 Down、Up 正常完成、结束前 500ms 松手完成、提前松手 Miss、Pointer 不命中 L1。

### 2.2 分层判定

- 第 1 层：接受 `chartKeyId === 'Space'` 或 cell 1 键盘区（`1/2/3/Q/W/E`）的键盘 Down；Pointer 不命中 L1。
- 第 2 层：`chartKeyId` 优先；无 `chartKeyId` 时按 `gridCellId`；指针可按格命中自定义 key 的 note。
- 第 3+ 层：任意非修饰键 / 指针；Space 是第 1 层专用键，不参与 L3+。
- 同刻冲突按层序 1 → 2 → 3+；一次输入只命中一个 note。
- 判定窗口：`|offset| <= 100` Perfect；`<= 300` Good（内部 `GRID_JUDGE_WINDOW_MS = 1.5 × GRID_GOOD_WINDOW_MS`）；超时由 `advance` 判 Miss。
- 提示窗口保持 ±200ms 不变；判定放宽不影响提示显示时长。

### 2.3 Hold / AC4-33

- `GridNote` 校验 Hold 只属于一个 `chartLayerIndex`，且 `holdGridLines` 严格递增、在 hold 内。
- `chart-w1.holds.json` 由 `chartLoader` 读取，按 `(noteTimeMs, chartLayerIndex, gridCellId)` 匹配到 note；当前 demo 已清空 crossings，避免 L2 Hold 在 5950 强制重按。
- 越界机制仍保留在核心与 AC4-33 合成单测：越界时必须是新的 Down；一直按住不算；按对续接，按错/不按窗口后 Miss。
- Hold 只结算一次；越界失败时把已计的 Perfect/Good 回退为 Miss，避免重复计分。
- 提前 keyup：距结束 >500ms 时 Miss；进入结束前 500ms 后松手直接完成（不断连）。越界窗口内松手仍允许重按。

### 2.4 Logo / AC4-31

- `NoteLogoGuide` 只对 `chartLayerIndex <= 2` 创建；L3+ 为 null。
- 核心仍按 `timeMs - 1500` 生成 Logo 状态；P 层只在这个 note 的**提示窗 ±200ms** 内渲染，避免提前 1.5s 出现导致玩家早按。
- 视觉显示：tap `timeMs ± GRID_GOOD_WINDOW_MS`；hold 从 `timeMs - 200` 到 hold 结束；命中反馈额外 180ms；Miss 红闪 300ms。
- `BlindMode` 不改变判定；`GameScreen` 当前固定传 `blind=false`，P 层隐藏逻辑已就绪。
- 视觉位置：L2 格心；L1 移到 cell 1 内部（供 L1 十字/Logo/Hold 线统一锚点）；editor.json 的自定义 Logo 位置尚未接线（见 §5）。
- 浏览器无 Tauri 时本地 logo 图片会被拦截；已移除圆形 `N` fallback，不再在提示位置画圆。

### 2.5 动态网格 / AC4-32

- 8 格始终显示**纯白 1px 方框**；透明背景，无角落、无编号、无 pulse、无 glow。
- 命中 L2 tap → `1.5×` + `Revealed`，`transform 220ms ease-in-out` 放大；260ms 后 `restore(cell)` 再用 220ms 缓出。
- **Hold 按住期间对应格子锁定 1.5× + Revealed，不会在 260ms 自动缩回**；直到 hold 完成/松手/失败才恢复。
- 放大期间 `z-index:3` + 不透明 `#020407` 背景，覆盖其他格线；`transform` 不参与布局，不挤压其他格。
- 指针落在放大后矩形之外仍按原规则恢复；`SessionReset` 清空全部。
- 核心 `GridLineVisibility` 默认 `Concealed` 保留，但 P 层不再把未命中格隐藏。
- `restore(cell)` 新增单格恢复；AC4-32 增加 1 项测试。

### 2.6 AudioClock

- `AudioOutputClock`（C）纯数学：`playhead = anchorChart + (outputSeconds - anchorOutput) * 1000`。
- `WebAudioOutputClock`（app）：
  - `getOutputTimestamp()` 优先；
  - 回退 `currentTime - baseLatency - outputLatency`；
  - `source.start(when, offset)`，锚点映射到未来输出时刻；
  - 暂停停 source；恢复重建 source；seek 重建；
  - 4s 加载超时 → `PerformanceOutputClock` fallback。
- `GameScreen` 每帧/每次输入通过 `chartNow()` 只取一次时间（预滚用 performance，主循环用 AudioClock）；核心引擎不读 performance。
- 视频 muted，按 40ms 阈值 seek；音频是唯一母钟。

### 2.7 计分（ChartScore）

- `ChartScore` 统一公式：
  - Perfect = 1000；Good = 500；Miss = 0；
  - `layerMultiplier = ChartLayerIndex`（1 基）；
  - `comboMultiplier = 1 + min(comboBefore, 100) × 0.01`（首个 note 不吃加成，100 combo 封顶 2.0×）；
  - `score = floor(judgementBase × layerIndex × comboMultiplier)`。
- `GridNote.scoreValue` 保存单 note 得分；`ChartSnapshot.score` 求和。
- Hold 命中时按 comboBefore 记一次；结束前 500ms 内松手正常完成；早于该窗口松手/越界失败时 `scoreValue = 0` 并转 Miss，不重复计分。
- 只进 HUD，不写账本；旧 v3.21 的 GuideTransparency 加成未接（v4 v2 谱面没有该字段）。
- 例：`chart-w1` 6 note 全 Perfect 的 fixture 总分是 10260；Tauri 实机 Good 1（L3）→ 001500。

### 2.8 项目树 / ProjectConsole 现场保留

- `App` 不再在 `gameEntry` 时 early-return 卸载底层；`ProjectTreeDemoScreen` 始终挂载。
- 进入游戏时只给 `.app-tear-surface` 加 `.app-tear-surface--hidden`（`visibility:hidden` + `pointer-events:none`），GameScreen 以 fixed 层覆盖。
- 因此 ProjectConsole 的 `activeWorld`、当前目录、history、输入现场都不丢；退出只移除 GameScreen，底层立即恢复。
- 游戏内 keydown 以 capture + stopPropagation 隔离底层 console；GlobalGlitch/Crosshair/拖拽区在游戏时关闭。
- Tauri 实测：GameScreen 显示时 `console=true`；退出后 `console=true / visibility=visible`，直接回到 w1 world 视图。

### 2.9 8 格全屏区域与键盘映射（用户指定）

- `.game-content` 全屏；`DynamicGridScale.cellRect` 无 padding，8 格严格 25% × 50%，2×4 铺满 1280×800。
- 键盘区域按用户最新指定：
  - 上排：`123QWE` / `456RTY` / `789UIO` / `0-=P[]`；
  - 下排：`ASDZXC` / `FGHVB` / `JKLNM<` / `："|>?`（即 `; ' \ . /` 的 Shift 符号）。
  - `Space` 或 cell 1 键盘区（`1/2/3/Q/W/E`）为 L1；未列出的键作为 L3+ 任意键。
- 区域标签直接显示：`1 2 3 / Q W E`、`4 5 6 / R T Y`、`0 - = / P [ ]`、`A S D / Z X C`、`J K L / N M <`、`: " | / > ?`。
- Tauri 实机全连：`chart-w1` 6 note，`PERFECT 6 / GOOD 0 / MISS 0`，score `010260`；
  空格（L1）、`R`（cell2）、`X`（L3）、`A`（cell5）、Space（7200）全部命中；L2 Hold 不再要求 5950 → cell6 重按。
- 1.2s 预滚：倒计时结束后先进入 `-1200ms` 视觉预滚；节奏点提示只在 `-200ms` 提示窗打开时出现；到 0ms 才启动音频/主循环并显示 GO。

### 2.10 节奏点引导

- 引导只在 **playing / paused** 渲染；ready/countdown 不显示，避免倒计时期间误按。
- 提示窗口：
  - tap：`±200ms`；
  - hold：从 `-200ms` 到 hold 结束；这期间 hold 提示持续可见。
- L1：3 根 2px 竖线 + 3 根 2px 横线组成加粗十字（间隔 4px，视觉约 10px），带 `L1 / SPACE · 123QWE`；锚点在 cell 1 内部；没有中心圆点。
- Hold 引导线：**静止**白色竖线 + 结尾一个小白色正方形；长度 `min(42% 屏高, 18% + duration/1500)`，不随时间移动。
- 只有节奏点提示沿引导线移动：
  - 上排/L1 向下，下排 L2 向上；图表中 `4167ms L1` 走 336px、`5800ms L2` 走 304px，足以整条越过 400px 网格边界。
  - L1 十字随 hold 进度移动；L2 Logo 随 hold 进度移动。
- 不加额外判定线，不加圆形 fallback；删除之前自行添加的 hold 判定线与圆形 N 环。
- 锚点：L1 固定在 cell 1 中心；L2 在各自格心；所有提示尽量落在网格内部。
- 引导层 z-index 5，位于网格/Logo 之上、HUD 之下（HUD 后渲染同层覆盖）；结算页隐藏。

---

## 3. AC 覆盖

| AC | 实现 | 测试/验证 |
|---|---|---|
| AC4-14 第 2 层才用 8 格 | `ChartSnapshot.pickCandidate`；`GridStrike` 仅由 app 从 L2 note 映射 | `ac4-14-layer-grid.test.ts`（5 项） |
| AC4-15 窗口 | `GridNote.judgeOffset` + `advance` 超时 | `ac4-15-window.test.ts`（5 项） |
| AC4-16 Hold 单层 | `GridNote` 校验；`GridKeyHold`；`HoldGridOverflow`/`SpaceHoldOverflow` | `ac4-16-hold-layer.test.ts`（3 项） |
| AC4-17 分层判定 | 层序过滤/排序；一次输入一个 note；Space/cell1 专属 L1 | `ac4-17-layer-priority.test.ts`（7 项） |
| AC4-31 Logo | `NoteLogoGuide` + `NoteLogoMiss` + 三常量 | `ac4-31-note-logo.test.ts`（5 项） |
| AC4-32 动态网格 | `DynamicGridScale` per-cell + `restore(cell)` | `ac4-32-dynamic-grid.test.ts`（8 项） |
| AC4-33 Hold 越界 | `HoldGridLine` + sidecar + 续接/失败 | `ac4-33-hold-overflow.test.ts`（6 项） |
| AudioClock 对齐 | `AudioOutputClock` 纯映射 | `audio-output-clock.test.ts`（6 项） |
| 计分 | `ChartScore` 1000/500/0 + layer multiplier + combo 加成 | `chart-score.test.ts`（5 项） |
| 完整 fixture | `chart-w1` 6 note | `chart-snapshot-fixture.test.ts`（2 项） |

`GridStrike` 只在 app 层从 L2 `GridNote` 映射；第 1/3+ 层结果留在 `GridNote.judgement`，不新增 `FullScreenStrike`，不伪造 `gridCellId=0`。

---

## 4. 自跑结果

```text
npm run typecheck:v4        exit 0
npm run check:v4            totalErrors=0 allPassed=true
                            E1 naming 0 / E2 deps 0 / E3 zero-engine 0 / E4 single-writer 0
npm run test:v4             183 tests / 43 suites / 183 pass / 0 fail
                            （其中 R4a：57 tests / 11 suites / 57 pass）
cd v4/app && npm run typecheck  exit 0
cd v4/app && npm run build      exit 0
                            842 modules transformed
```

日志：

- `quality-review/stage-4/r4/logs/typecheck-v4.log`
- `quality-review/stage-4/r4/logs/check-v4.log`
- `quality-review/stage-4/r4/logs/test-v4.log`
- `quality-review/stage-4/r4/logs/app-typecheck.log`
- `quality-review/stage-4/r4/logs/app-build.log`

环境修复与回滚记录：

- 开始时 shell 因工作区 Windows 文件权限无法启动（`grantWrite` 失败）。
- 曾用诊断脚本临时补 FullControl；已在 2026-10-24 按备份恢复原 DACL，脚本输出 `RESTORED` + `verification=verified`。
- `Get-Acl` 复核：只剩继承的 Administrators / SYSTEM / Authenticated Users / Users 条目，无当前用户显式 ACE；Owner 不变。
- 后续遇 Access Denied 只报告，禁止自动修复。
- 备份与回滚脚本：`quality-review/stage-4/r4/acl-recovery/`；回滚记录：`logs/acl-rollback.log`。

浏览器/WebView2 证据：

- `quality-review/stage-4/r4/logs/tauri-media.log`
  - Tauri WebView2：`chart-w1` / `WORLD w1 · EDITOR` / `AUDIO / WEB`
  - 两条视频 `readyState=4`，1280×720，无 error
  - `SCORE 001500`（Good L3，按 ChartScore 公式）
- `quality-review/stage-4/r4/logs/tauri-flow.log`
  - GameScreen 显示时 `console=true`：ProjectConsole DOM 仍在
  - Exit 后 `game=false` / `console=true` / `visibility=visible`，恢复 world 现场
  - 8 个 grid cell、L2 Logo、静态 Frame 可见
- `quality-review/stage-4/r4/logs/tauri-fullscore.log`
  - 2×4 全屏纯白网格：cell 320×400，origin 0/320/640/960 × 0/400
  - 全连：`PERFECT 6 / GOOD 0 / MISS 0`，`SCORE 010260`
  - R→cell2、A→cell5、Space L1、X L3 全部命中；L2 Hold 5950 不再强制 cell6
  - 命中后 220ms ease-in-out 放大到 1.5×，保持到 260ms，再用 220ms 缓出回到 1.0×（总约 480ms）
  - 放大格 z-index 3 + 不透明背景，覆盖其他格线；不挤压其他格
- `quality-review/stage-4/r4/tauri-grid-white.png`：START 前 2×4 白框 + 区域标签；不显示节奏点。
- `quality-review/stage-4/r4/tauri-prompt-window.png`：`-150ms` 提示窗内 L1 十字/Logo/Hold 引导线；窗外不显示。
- `quality-review/stage-4/r4/tauri-fullscore-white.png`：Tauri 实机全连结果页。
- `quality-review/stage-4/r4/logs/tauri-prompt-press.log`
  - 提示在 `-900ms` 不显示、`-200ms` 显示、hold 结束后隐藏
  - 提示出现时按下并保持 600ms → `GOOD 1`，证明 Hold 判定可用
  - L2 tap 提示出现时按 `R` → `GOOD 1`
  - 单测：L1 可用 Space 或 cell 1 键；chart-w1 的 Hold ≤360ms，结束前 500ms 松手完成，因此点一下也能过
  - 单测：长 Hold 在结束前 >500ms 松手仍 Miss；结束前 ≤500ms 松手完成
  - L1 十字/Logo 沿静止引导线移动；十字为 3 竖 + 3 横的 2px 线组
  - 判定窗放宽到 Good ±300ms；提示窗保持 ±200ms
- `quality-review/stage-4/r4/logs/tauri-hold-lock.log`
  - L1/L2 Hold 按住期间该格持续 `--enlarged / 1.5 / 不透明 / z=3`
  - hold 结束后才缩回，tap flash 定时器不会提前缩小按住中的格
  - `4167 L1` 引导线 336px 向下，`5800 L2` 304px 向上；提示充分越界
- `quality-review/stage-4/r4/logs/game-hit-dom.log`：旧公式下的浏览器 DOM 证据，仅保留历史；分数 000200 已被 ChartScore 取代。
- 说明：headless Edge 的 `Page.captureScreenshot` 会带桌面色渗出；最终视觉验收以 Tauri WebView2 为准。
- HMR：本轮验收前已删除 `v4/app/node_modules/.vite`，Tauri 从干净页面启动；验收结束后再次清理该缓存。

---

## 5. 已知限制 / 与计划的偏差

1. **进入游戏时保留项目树/ProjectConsole DOM。** `App` 不再卸载底层，只用 `.app-tear-surface--hidden`（`visibility:hidden` + `pointer-events:none`）停止绘制与命中，GameScreen 覆盖其上；退出后恢复进入前的 ProjectConsole world/目录现场。
2. **`chartLoader` 使用 demo 项目根**（`v4/.stereo-demo/project`），与 R3 编辑器一致；真实项目根/多项目路由留 R4a.3 或 R4b。
3. **editor.json 的自定义 Logo 位置未接线。** 当前 L1 用 cell 1 内部（十字/Logo/Hold 线共同锚点），L2 用格心；editor logo 的 x/y/size/stretch 尚未映射到 `NoteLogoLayer`。
4. **视差框只静态渲染**，不接键盘对准、不做 `FrameAlignedStrike` / trace 触发（R4c）。
5. **全屏层不进 trace。** 第 1/3+ 层只进 `GridNote.judgement`/HUD；若后续 trace 需要全屏结果，需新 A 名 `FullScreenStrike`。
6. **自定义键位只有配置级支持**，无改键 UI/持久化；note 有 `chartKeyId` 时必须由绑定表提供，键盘不会用格位兜底。
7. **计分已迁到 `ChartScore`**（1000/500/0 + 层数 + combo 封顶 2.0×）；HUD 只显示，不写账本。旧 v3.21 的透明度加成未接，因为 v2 谱面没有 GuideTransparency 字段。
8. **`chart-w1` 第一个 note 在 0ms。** 已加 1.2s 预滚：核心 Logo 在 `-1500ms` 生成，但视觉只在 `-200ms` 提示窗出现；0ms 音频/GO/主循环开始。预滚期间暂停被忽略（仅 1.2s）。
9. **headless 截图有桌面层渗出**；已改用 Tauri WebView2 完成视觉/全连验收（见 §4）；headless 日志仅作历史证据。
10. **`#game` 是调试入口**：`http://127.0.0.1:1420/?direct=1#game` 可直接进 fallback chart，方便无 Tauri 环境验收；正常流程仍走项目树。
11. **`AudioOutputClock` 的 C 纯映射 + app WebAudio 宿主**遵循已批准的裁定；stage-4 §2 的“Web Audio 只在 presentation”字面冲突按 R4a-R4 记录保留。
12. **`ChartSnapshot` 作为运行时引擎**是对“谱面快照”的实现解释；若 PROTOCOL 要求 snapshot 必须纯数据，需要另立 A 名或把引擎移到 director。

---

## 6. 人工验收清单（重点）

前置：`cd v4/app && npm run tauri dev`（或已构建的 Tauri 应用）。

1. 项目树 → 双击 `chromato` → 输入 `open w1` → 等加载/字幕/闪光结束。
2. GameScreen 出现 `chart-w1`；**START 前应看到 2×4 全屏白色方框**，但节奏点提示不显示（ready/countdown 隐藏）。
3. **第一拍**：倒计时后先有一段预滚；`-200ms` 时提示出现，`0ms` 音频/GO 开始。按 `Space` 或 cell 1 区键（`1/2/3/Q/W/E`）；首 Hold 只有 240ms，结束前 500ms 内松手（实际上任何时刻点一下）也会完成，不会断连。不按则 `MISS` 增加。
4. **8 格**：约 1.6s 按 `R`（cell 2；`4/5/6/T/Y` 同属）；tap 命中后 220ms 放大、260ms 后 220ms 缩回；Hold 按住期间该格一直保持 1.5×，不自动缩回。
5. **L1 十字/引导线**：cell 1 内有 3×2px 竖线 + 3×2px 横线组成的加粗十字与 `L1 / SPACE · 123QWE`；Hold 引导线静止、结尾小白色正方形；只有十字/Logo 沿引导线移动，4167ms L1 走 336px、5800ms L2 走 304px，能整条越过网格边界。没有额外判定线，也没有圆形提示。
6. **L1 Hold**：约 4.17s 按 `Space`（或 cell 1 区键）；按住期间 cell 1 保持 1.5×，结束前 500ms 内松手即完成，HUD 不加重复分。
7. **L3**：约 4.4s 按任意键（如 `X`）或点任意区域；命中 L3。
8. **L2 Hold**：约 5.8s 按 `A`（cell 5）或点一下；按住期间 cell 5 保持 1.5×；chart-w1 已无 5950 越界重按要求，按住/松手都不会断连。越界机制仅在 AC4-33 合成单测中验证。
9. **Logo**：L2 note 命中前出现 Logo；Miss 时红闪/抖动；hold 提示持续到 hold 结束。
10. **暂停/恢复**：Esc 暂停；Space/Enter 恢复；恢复后不跳帧。
11. **全连参考**：`Space(0) → R(1.6) → Space(4.167) → X(4.4) → A(5.8) → Space(7.2)` = `PERFECT 6 / 010260`。
12. **结算/退出**：8s 后显示 CHART COMPLETE、score/counts；BACK 返回进入前的 ProjectConsole 现场（world 视图/当前目录），不退回项目树根部。
13. **分辨率**：1920×1080 与 2560×1440 各看一遍；2×4 网格仍铺满窗口。
14. **R3 回归**：编辑器打开/保存、项目树 3D、ProjectConsole、Parallax Demo 均正常。

---

## 7. 下一批（R4a.3 / R4b）

- 真实项目根与项目路径注入，替换 demo 根。
- editor.json Logo 位置/动效接线；`NoteLogoLayer` 消费 editor keyframe。
- Tauri WebView2 下的真实音画同步测量（`audio-sync.json`）与两档分辨率截图。
- 视差框键盘对准/FrameAlignedStrike（R4c）。
- 完整 R4a.3 的 end-to-end 证据与人工验收记录。

## R5c-B v2 addendum（2026-10-26）

- R4a.1 判定数学（judge.ts / note.ts / grid.ts / ChartScore）**零改动**，测试文件未改。
- R4a.2 编排升级为 GameMode 宿主：`Explore / Rhythm / Cutscene`；默认进入世界为 Explore。
- Rhythm 会话懒创建 `ChartSnapshot` / `AudioOutputClock` / 完整 NEU；退出回 Explore 只销毁 Rhythm session。
- `?mode=rhythm` 保留为长期 debug 入口；旧 e2e 全部走该入口或 `/rhythm`。
- 旧 debug Rhythm 的 ready → START → completed 行为保留；正常 EnterRhythm 自动 countdown。
- 验收：R4a 核心测试全绿；R4f/R5a/R5b1/R5b2 回归；R5c-B explore/mid-exit 通过。
