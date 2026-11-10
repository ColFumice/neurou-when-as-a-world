# R4e.3 变更说明 · GameScreen 集成与 Rain 全链路验收

日期：2026-10-25  
状态：**PASS** · 350/350 tests；R4a~R4d 276/276；gates 0 ERROR；App 889 modules build；Rust 31/31。

范围：GameScreen 接入 App 持有的 RainRuntime、RainLayer/RainAudio 挂载、NoteLogoGlow/RainTintSource 生效、online/offline、生命周期与测试。  
不接 TraceTier.Rain；不做 Rain 特殊玩法；不做 R4f 通关。

## 1. GameScreen 集成点

文件：`v4/app/src/game/GameScreen.tsx`、`v4/app/src/App.tsx`、`v4/app/src/game/rainIntegration.ts`

### 1.1 Runtime 来源

App 继续持有 **唯一** `RainRuntime`（R4e.2b 已建立），GameScreen 通过 props 接收：

```tsx
<GameScreen
  ...
  rainRuntime={rainRuntime}
  rainState={rainState}
/>
```

- SettingsConsole 的 ENABLE / DISABLE 已经调用同一个 `RainRuntime.setEnabled(...)`；
- GameScreen 不另建 runtime，避免 project console 与 game 两套状态；
- `rainState` 由 App 的 `onStateChange` 更新后传入，GameScreen 只消费。

### 1.2 rAF 挂载

`loop` 与 `loopPreRoll` 每帧调用：

```ts
safeAdvanceRain(rainRuntime, now);
```

`safeAdvanceRain`：

```ts
try {
  void runtime.advanceTo(now).catch(() => undefined);
} catch {
  // rAF 不被 Rain 异常打断
}
```

- 不 await，不阻塞 R4a 帧循环；
- 同步 throw / Promise reject 都被隔离；
- 不影响 snapshot / NEU / Trace / Trigger 的既有顺序。

### 1.3 GameScreen 只读 RainModeState

- 不修改 `PerceptionMode`；
- 不选择 Rain 模式、不改变判定；
- `RainRuntime` 只输出 `RainModeState`，GameScreen 用它决定视觉/音频；
- R4a 的 judge / audioClock / GameStage / neuRuntime / traceRuntime / ChartPremiereDirector 未改。

## 2. RainRuntime 生命周期

| 时机 | 处理 |
|---|---|
| GameScreen 挂载 | 接收 App 的 runtime/state；不重建 |
| 进入 ready | 不强制 refresh；用户已在 Settings 启用时沿用 runtime 状态 |
| playing rAF | `safeAdvanceRain(now)`，每帧检查 10 分钟/退避到期 |
| pause | `rainAudio.setEnabled(false)`；`setRainSuspended(true)`；RainLayer/tint/logo glow 停止 |
| resume | `setRainSuspended(false)`；`syncRainAudio(state)`；恢复 rAF |
| completed | `setRainSuspended(true)`；音频停止；不继续展示雨层 |
| exit | `rainAudio.dispose()`；`setRainSuspended(true)`；卸载即移除 RainLayer；调用 onExit |
| unmount | effect cleanup `rainAudio.dispose()`；移除 online/offline 监听 |
| 用户手动关闭 Rain | App 的 `setEnabled(false)` → `rainState.active=false` → GameScreen 立即隐藏 RainLayer/tint/logo glow、Audio gain 归零 |

### 2.1 关于 `reset()`

R4e.2a 的 RainRuntime 已冻结，且**没有** `reset()` / `handleOffline()`。  
按硬性约束不改 Runtime；GameScreen 用等效生命周期完成：

- 暂停：本地 `rainSuspended=true`，视觉/音频关闭，但不覆盖用户 Settings 的启用状态；
- 退出/卸载：RainLayer 卸载、RainAudio dispose、rAF 停止；
- 不新增 Runtime 方法，不修改其内部逻辑。

## 3. RainLayer / RainAudio / NoteLogoGlow / RainTintSource 挂载

### 3.1 RainLayer

挂载位置：`.game-content` 内，z-index 3。

```tsx
<RainLayer
  rainModeState={rainActive ? rainState : null}
  worldTint={worldTint}
/>
```

- `.game-content` 内：高于 stage/content 的底层，低于 `.game-logos`（z4）与 `.game-hud`（z5）；
- `rainModeState=null` 或 active=false 时 RainLayer 返回 null，不渲染；
- `worldTint` 由 `world.themeColor` 转为 `#RRGGBB`（`worldTintHex`）。

### 3.2 RainAudio

- GameScreen `useMemo` 创建唯一 `RainAudio`；
- `rainState` 变化：

```ts
syncRainAudio(rainAudio, rainSuspended ? null : rainState);
// active=true: setIntensity(state.intensity); setEnabled(true)
// inactive: setEnabled(false)
```

- 首次 `pointerdown` / `keydown`：全局监听，若 `rainActive` 则 `resume()`；
- 失败静音，不影响游戏；
- pause / completed：`setEnabled(false)`；
- exit/unmount：`dispose()`。

### 3.3 NoteLogoGlow

GameScreen 传入：

```tsx
rainGlow={rainActive ? rainLogoGlow(rainState) : null}
```

- `rainLogoGlow` 只在 active=true 时返回 `NoteLogoGlow.forIntensity(intensity)`；
- NoteLogoLayer 仅在 `rainGlow != null` 时加 `game-note-logo--rain` 并注入 `--rain-logo-glow`；
- 不改 R4a judge/时序/事件；inactive 时无 class、无 filter；
- 实机 DOM 验证：active Heavy 时存在 `.game-note-logo--rain`。

### 3.4 RainTintSource

GameScreen 只给 **外部 wrapper** 加 class：

```tsx
<div
  className={`game-content${rainActive ? ' game-content--rain' : ''}`}
  style={rainActive ? rainStageStyle(rainState, worldTint) : undefined}
>
```

- style 注入 `--rain-tint-source` / `--rain-tint-mode` / `--rain-tint-opacity`；
- CSS 定义在 R4e.2b 的 `rain-layer.css`，作用于 `.game-content::before`；
- **GameStage.tsx 未修改**；
- HUD 在 `.game-content` 外部，不被 tint 作用。

## 4. online / offline 事件

GameScreen effect：

```ts
window.addEventListener('online', onOnline);
window.addEventListener('offline', onOffline);
```

- online → `notifyRainOnline(rainRuntime)` → `runtime.notifyOnline()`（立即重试）；
- offline → `handleRainOffline(rainRuntime)`：
  - R4e.2a Runtime 没有 `handleOffline`；
  - helper 使用 optional call，不存在时直接忽略；
  - 不刷新、不抛错。
- 卸载时移除监听；
- 回调内异常被隔离。

## 5. 测试覆盖

新增 `v4/tests/r4e/game-screen-rain-integration.test.ts`（6）：

- `safeAdvanceRain` 调用 `advanceTo`；同步 throw / async reject 不外泄；
- RainLayer active=false 不渲染；active=true + intensity 渲染 3 层；
- `syncRainAudio` 随 intensity 写入、inactive 立即 setEnabled(false)；
- NoteLogoGlow 只在 active=true 返回；stage class 只在 active=true；
- stage tint CSS variables；
- online 调用 notifyOnline；offline 无 handleOffline 时忽略；
- themeColor → hex。

汇总：

```text
R4e.1a：15
R4e.1b：14
R4e.2a：26
R4e.2b：13
R4e.3：6
R4e 总计：74
全仓：350
基线 R4a~R4d：276
```

测试为纯模型/薄绑定测试，不启动浏览器、不真实播放音频、不真实联网；GameScreen 组件本身由实机 DOM 验证。

## 6. 自跑结果

```text
npm run typecheck:v4
  exit 0

npm run test:v4
  tests 350
  suites 77
  pass 350
  fail 0

R4a~R4d 基线单独复跑
  tests 276
  pass 276
  fail 0

npm run check:v4
  check-naming              0 ERROR
  check-dependencies        0 ERROR
  check-zero-engine         0 ERROR
  check-ledger-single-writer 0 ERROR
  totalErrors=0 allPassed=true

v4/app npm run typecheck
  exit 0

v4/app npm run build
  889 modules transformed
  built in 2.61s

cargo test
  31 passed / 0 failed
```

证据：

- `quality-review/stage-4/r4e/r4e3-typecheck-v4.log`
- `quality-review/stage-4/r4e/r4e3-test-run.log`
- `quality-review/stage-4/r4e/r4e3-baseline-276.log`
- `quality-review/stage-4/r4e/r4e3-gates.log`
- `quality-review/stage-4/r4e/r4e3-app-typecheck.log`
- `quality-review/stage-4/r4e/r4e3-app-build.log`
- `quality-review/stage-4/r4e/r4e3-cargo-test.log`

## 7. 实机验收

### 7.1 DSH 已执行

1. **默认路径**
   - project console → `cd w1` → 游戏；
   - DOM：`.rain-layer` 不存在，`.game-content` 只有 `game-content`，无 tint/logo rain class；
   - 截图：`quality-review/stage-4/r4e/evidence/game-screen-rain-normal.png`。

2. **雨天路径（临时 fake resolver）**
   - 按用户授权，临时将 `TauriWeatherResolver.resolve` 返回 `weatherCode=61 / precipitationMm=10 / isRain=true`；
   - 在 SettingsConsole 启用 Rain，得到 `RAIN HEAVY`；
   - 进入 w1 游戏后 DOM 验证：
     - `.rain-layer` 存在；
     - `.rain-layer__streak` × 3；
     - `.game-content` class = `game-content game-content--rain`；
     - `.game-note-logo--rain` 存在；
     - `data-intensity="Heavy"`；
   - 截图：`quality-review/stage-4/r4e/evidence/game-screen-rain-heavy.png`；
   - **验证后已恢复原始 adapter**，`Compare-Object` 显示无差异；临时文件已删除。

3. **退出**
   - 点击 `ESC / EXIT` 后 `.game-screen` 消失，`.rain-layer` 不存在；
   - RainAudio dispose（单元测试 + 代码路径）；
   - App Settings 的 runtime 状态保留，但 GameScreen 已卸载。

4. **真实天气**
   - 当前 ipwho.is / Open-Meteo 实际返回晴（weatherCode=1, precipitation=0）；
   - Settings 启用后状态 NORMAL；
   - 说明真实 API 与映射路径已通，仅无雨。

5. **音频**
   - 自动化用 fake AudioContext 验证 gain / resume / dispose；
   - DSH 截图无法验证实际扬声器声音，需用户复核。

### 7.2 用户复核清单

- [ ] 进入游戏，默认 `NORMAL`，无雨丝/雨声；
- [ ] 项目 console → `settings` → Rain `ENABLE`；
- [ ] 回到游戏：若当前晴天，保持 `NORMAL`；
- [ ] 若当前雨天，看到雨丝（Light/Moderate/Heavy 强度差异）；
- [ ] 首次点击/按键后听到雨声；不交互时保持静音；
- [ ] 关闭网络，等待约 30s，Settings 显示 `DEGRADED` + `NetworkUnavailable`；
- [ ] 恢复网络，`online` 自动重试；成功回到 `RAIN XXX`；
- [ ] 点击 `ESC / EXIT`，雨声消失、雨丝消失；
- [ ] 退出再进入，Settings 开关保持用户选择；
- [ ] 暂停游戏，雨层/音频暂停；恢复后继续。

## 8. 约束核对

| 约束 | 结果 |
|---|---|
| 不改 judge.ts / audioClock.ts / GameStage.tsx / neuRuntime.ts / traceRuntime.ts / ChartPremiereDirector | 全部未改 |
| 不改 RainRuntime 内部逻辑 | 未改；只接生命周期/state |
| RainLayer / RainAudio 冻结，只接 props | 未改组件/类实现 |
| 不改 GameStage.tsx | 未改 |
| Audio 首次手势后 resume | GameScreen 全局 pointerdown/keydown + RainDemo |
| 手动关闭 Rain 立即停 | active=false → RainLayer null、Audio gain 0、stage/logo class 移除 |
| 不接 TraceTier.Rain | 未接 |
| E7 默认 0 请求 | App 默认 rainEnabled=false；仅 Settings ENABLE 后请求 |

## 9. 已知说明

1. **无 `RainRuntime.reset` / `handleOffline`**：Runtime 在本批冻结，禁止修改；GameScreen 用 `rainSuspended` + audio dispose + RainLayer 卸载完成等效生命周期。offline 仅忽略，不主动刷新。
2. **Audio 实机听力未断言**：DSH 只能验证代码路径/DOM；实际声音需用户扬声器确认。
3. **雨天实机使用临时 fake resolver**：已按授权恢复，未留在代码中。
4. **Display 截图雨丝较细**：Heavy 的 blur 4.5px 与低对比视觉让静态截图不夸张；DOM 3 层与 CSS variables 已确认。实机动画/音频更直观。
5. **SettingsConsole 不在 GameScreen 内**：用户在项目 console 设置后进入游戏；GameScreen 只消费 App 的 runtime state，不新增 in-game 设置面板。
6. **R4a NoteLogoLayer** 只通过 R4e.2b 的可选 `rainGlow` prop 接收视觉 class；不触碰判定/时序/事件。

## 10. 一行状态

**R4e.3 PASS：GameScreen 挂载 App 共享 RainRuntime，rAF 安全 advanceTo，RainLayer 三层/Stage tint/Logo glow 随 active 生效，RainAudio 手势 resume、暂停/退出/卸载隔离，online/offline 接入；350/350 tests、276/276 基线、gates 0、App 889 modules、Rust 31/31。**
