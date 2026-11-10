# R4e.2b 变更说明 · Rain 视觉与 UI

日期：2026-10-25  
状态：**PASS** · 344/344 tests；R4a~R4d 276/276；gates 0 ERROR；App 888 modules build；Rust 31/31。

范围：RainLayer、RainAudio、NoteLogoGlow / RainTintSource 视觉应用、SettingsConsole Rain 分区、RainDemoScreen 与测试。  
未接 GameScreen；未改 R4a~R4d 游戏判定/时序/事件；未改 R4e.2a 的 Runtime / 适配器 / 视觉配置。

## 1. RainLayer 的 DOM 结构与 CSS 变量

文件：

- `v4/app/src/game/rain/RainLayer.tsx`
- `v4/app/src/game/rain/rainLayerModel.ts`
- `v4/app/src/game/rain/rain-layer.css`

组件：

```tsx
<RainLayer
  rainModeState={rainModeState} // RainModeState | null
  worldTint="#607684"          // optional
/>
```

渲染结构：

```text
.rain-layer
  .rain-layer__streak--1   （慢层）
  .rain-layer__streak--2   （中层）
  .rain-layer__streak--3   （快层）
  .rain-layer__tint
  .rain-layer__edge
```

- `position: fixed; inset: 0;`
- `z-index: 3`：高于 `.game-stage` / `.game-content`（1 / 2），低于 `.game-logos`（4）与 `.game-hud`（5）；
- 3 层重复 `linear-gradient` 雨丝；`transform + animation`，不占 rAF；
- `pointer-events: none`；
- 液态玻璃：极细边框、边缘 inner glow、低对比雨丝。

`rainLayerModel(rainModeState, worldTint)`：

- `null` 或 `active=false` → `null`，组件不渲染；
- `active=true` → 由 `RainVisualConfig.forIntensity(intensity)` 输出 3 层与 CSS variables：
  - `--rain-density`
  - `--rain-streak-speed`
  - `--rain-opacity`
  - `--rain-blur`
  - `--rain-tint`
  - `--rain-glow-strength`
  - 派生：`--rain-size-1/2/3`、`--rain-duration-1/2/3`、`--rain-opacity-2/3`
  - tint：`--rain-tint-source`、`--rain-tint-mode`

三档差异由 R4e.2a 的 `RainVisualConfig` 决定，不在本批重写：

| intensity | density | opacity | blur | glowStrength |
|---|---:|---:|---:|---:|
| Light | 0.32 | 0.30 | 1.2px | 0.24 |
| Moderate | 0.62 | 0.52 | 2.4px | 0.46 |
| Heavy | 1.00 | 0.72 | 4.5px | 0.72 |

`prefers-reduced-motion: reduce`：

```css
@media (prefers-reduced-motion: reduce) {
  .rain-layer__streak { animation: none; }
}
```

### 1.1 实机样式

截图：

- `quality-review/stage-4/r4e/evidence/rain-demo-none.png`
- `quality-review/stage-4/r4e/evidence/rain-demo-light.png`
- `quality-review/stage-4/r4e/evidence/rain-demo-heavy.png`

Light 实机 CSS variables：

```text
--rain-density: 0.32
--rain-streak-speed: 0.42
--rain-opacity: 0.3
--rain-blur: 1.2px
--rain-size-1: 563px
--rain-duration-1: 6.67s
```

Heavy 实机 CSS variables：

```text
--rain-density: 1
--rain-streak-speed: 1
--rain-opacity: 0.72
--rain-blur: 4.5px
--rain-size-1: 180px
--rain-duration-1: 2.80s
```

## 2. RainAudio 的噪声源设计

文件：`v4/app/src/game/rain/RainAudio.ts`

不加载外部音频；不依赖 React/DOM；只用 WebAudio 及可注入的 `contextFactory`。

```text
AudioContext
  → AudioBufferSource（2 秒白噪声 buffer，loop=true）
  → BiquadFilter（bandpass，950 Hz，Q=0.65）
  → GainNode
  → destination
```

音量：

| intensity | volume |
|---|---:|
| Light | 0.15 |
| Moderate | 0.30 |
| Heavy | 0.50 |

接口：

```ts
setEnabled(enabled: boolean): void
setIntensity(intensity: RainIntensity): void
resume(): Promise<void>
dispose(): void
static volumeFor(intensity): number
```

- 默认不创建 AudioContext；
- `setEnabled(false)` → gain 0，不发声；
- `resume()` 必须由用户手势调用；`RainDemoScreen` 监听 `pointerdown` / `keydown` 后调用；
- AudioContext 创建 / resume / close 失败全部吞掉，静音降级，不影响游戏；
- `dispose()`：stop source、disconnect、close context；此后 `setEnabled(true)` 不再重建；
- 单元测试使用 fake context，不真实播放。

## 3. NoteLogoGlow / RainTintSource 的应用方式

### 3.1 NoteLogoGlow

文件：

- `v4/app/src/game/NoteLogoLayer.tsx`
- `v4/app/src/game/rain/rain-layer.css`

`NoteLogoLayer` 只增加可选视觉 prop：

```ts
readonly rainGlow?: string | null;
```

- 有 `rainGlow` 时 wrapper 加 `game-note-logo--rain`，并注入 `--rain-logo-glow`；
- 没有时不加 class，不改变任何原行为；
- **不改判定、时序、事件、可见窗口**；
- CSS 只作用于未 hit / 未 miss 的 logo：

```css
.game-note-logo--rain .game-logo:not(.game-logo--hit):not(.game-logo--miss) img {
  filter: var(--rain-logo-glow);
}
```

GameScreen 本批不传 `rainGlow`，因此 R4a 游戏链路零行为变化；R4e.3 接入时由外部在 `rainModeState.active=true` 时传入 `NoteLogoGlow.forIntensity(...)`。

RainDemoScreen 用同样的 class + CSS variable 展示了发光效果。

### 3.2 RainTintSource

应用位置：

- RainLayer 内 `.rain-layer__tint`：`background: var(--rain-tint-source)` + `mix-blend-mode: var(--rain-tint-mode)`；
- 为后续 GameScreen 外部 wrapper 预置 CSS hook：

```css
.game-content--rain::before,
.game-stage--rain::before {
  background: var(--rain-tint-source);
  mix-blend-mode: var(--rain-tint-mode);
  opacity: var(--rain-tint-opacity, 0.22);
  pointer-events: none;
}
```

- 只作用于 `.game-stage` / `.game-content` 级 wrapper，不作用于 HUD；
- **GameStage.tsx 未修改**；本批只在 RainDemoScreen 的 stage wrapper 实机演示；
- 本批不接 GameScreen，R4e.3 才加 wrapper class。

## 4. SettingsConsole 扩展

文件：

- `v4/core/presentation/console/SettingsConsole.tsx`
- `v4/core/presentation/console/rainSettingsModel.ts`
- `v4/core/presentation/console/console.css`
- `v4/core/presentation/console/WorldFolderConsole.tsx`
- `v4/app/src/App.tsx`

新增 Rain 分区：

- `Rain follow IP weather` 开关（默认关闭）；
- 当前状态：
  - `NORMAL`
  - `RAIN LIGHT`
  - `RAIN MODERATE`
  - `RAIN HEAVY`
  - `DEGRADED`
- 降级原因：`LocationUnavailable` / `WeatherUnavailable` / `NetworkUnavailable`；
- `Manual Refresh`；
- `Enable / Disable`；
- 液态玻璃样式与现有 console settings 一致。

状态逻辑独立为纯模型 `rainSettingsModel.ts`（default anonymous export，不新增 A 类名）：

```text
!enabled || !state       → NORMAL
degradedReason != null   → DEGRADED + reason
state.active             → RAIN {INTENSITY}
否则                      → NORMAL
```

数据流：

```text
App 持有 RainRuntime
  → onStateChange 更新 React rainState
  → ProjectTreeDemoScreen
  → ProjectConsole props
  → SettingsConsole（只接收状态/回调，不持有 Runtime）
```

- App 默认 `rainEnabled=false`；只有用户在 SettingsConsole 点击 ENABLE 才调用 `RainRuntime.setEnabled(true)`；
- `Manual Refresh` 调用 `refresh()`；
- 本批不接 GameScreen；RainRuntime 不参与游戏 rAF。

实机截图：

- `quality-review/stage-4/r4e/evidence/settings-console-rain.png`
- `quality-review/stage-4/r4e/evidence/settings-console-rain-enabled.png`

实机中当前天气为晴（weatherCode=1，precipitation=0），因此启用后状态为 `NORMAL`，不是 `RAIN XXX`；这是正确映射。手工直接调用 `location_resolve` / `weather_resolve` 均成功返回。

## 5. RainDemoScreen 预览入口

文件：

- `v4/app/src/screens/RainDemoScreen.tsx`
- `v4/app/src/screens/rain-demo.css`
- `v4/app/src/App.tsx`

入口：

- 顶部临时按钮 `Rain Demo`；
- URL `#rain` 也可直接进入。

功能：

- `None / Light / Moderate / Heavy` 手动强度；
- RainLayer + RainAudio；
- 当前 intensity 状态；
- 音频状态、reduced-motion 声明、tint blend 信息；
- 返回按钮；
- 不请求真实天气 API；
- 不接 GameScreen。

交互：

- 选择非 None → `audio.setIntensity` + `setEnabled(true)` + 用户手势 `resume()`；
- 选择 None → `setEnabled(false)`，RainLayer 因 active=false 不渲染；
- 卸载 → `audio.dispose()`；
- window `pointerdown` / `keydown` → 若 audio enabled 则 resume。

## 6. 测试覆盖

新增 13 项：

### `rain-layer.test.ts`（4）

- null / active=false → 不渲染；
- active=true + Light → 3 层、CSS variables 正确；
- Heavy density > Light；
- `prefers-reduced-motion: reduce` 源码含 `animation: none`。

### `rain-audio.test.ts`（5）

- setEnabled(false) → 静音且不创建 AudioContext；
- 三档音量 0.15 / 0.30 / 0.50；
- 启用后 setIntensity 写入 gain 目标值，关闭归零；
- resume 调用 AudioContext.resume；
- dispose 停止 source、关闭 context，之后不再建图。

### `settings-console-rain.test.ts`（4）

- 默认关闭 → NORMAL；
- 启用且成功 → RAIN LIGHT / MODERATE / HEAVY；
- 失败 → DEGRADED + reason；
- 启用但无雨 → NORMAL。

纯 TS 测试不实际联网、不实际播放音频；RainLayer 用纯 model，SettingsConsole 用其纯状态模型。

汇总：

```text
R4e.1a：15
R4e.1b：14
R4e.2a：26
R4e.2b：13
R4e 总计：68
全仓：344
基线 R4a~R4d：276
```

## 7. 自跑结果

```text
npm run typecheck:v4
  exit 0

npm run test:v4
  tests 344
  suites 76
  pass 344
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
  888 modules transformed
  built in 2.59s

cargo test
  31 passed / 0 failed（Rust 本批未改，沿用 R4e.2a）
```

证据：

- `quality-review/stage-4/r4e/r4e2b-typecheck-v4.log`
- `quality-review/stage-4/r4e/r4e2b-test-run.log`
- `quality-review/stage-4/r4e/r4e2b-baseline-276.log`
- `quality-review/stage-4/r4e/r4e2b-gates.log`
- `quality-review/stage-4/r4e/r4e2b-app-typecheck.log`
- `quality-review/stage-4/r4e/r4e2b-app-build.log`
- `quality-review/stage-4/r4e/r4e2b-cargo-test.log`

## 8. 实机验收清单

### A. RainDemoScreen

- [ ] 从顶部 `Rain Demo` 或 `#rain` 进入；
- [ ] None：无雨层、状态 NONE、Audio SILENT；
- [ ] Light：出现 3 层雨丝，状态 RAIN LIGHT；
- [ ] Moderate / Heavy：雨丝更密、更快、更明显；
- [ ] 打开 DevTools，`.rain-layer` 上能看到 `--rain-density / --rain-streak-speed / --rain-opacity / --rain-blur`；
- [ ] 系统开启“减少动态效果”后，雨丝不再移动；
- [ ] 点击 Light / Moderate / Heavy 后能听到雨声（首次需要用户手势；受系统输出设备影响）；
- [ ] 返回按钮回到项目树。

### B. SettingsConsole

- [ ] 项目 console 输入 `settings` 打开设置；
- [ ] 看到 Rain 分区、默认 `NORMAL`、ENABLE 状态；
- [ ] 点击 ENABLE：按钮变 DISABLE；当前天气晴时显示 NORMAL；
- [ ] 当前接口失败时显示 DEGRADED + 对应 reason；
- [ ] Manual Refresh 可重新请求；
- [ ] 点击 Disable 后不再请求（下一次手动刷新也不请求）。

### C. 视觉/音频边界

- [ ] RainDemo 的 HUD/panel 不被 tint 作用；
- [ ] 雨层不阻挡点击（pointer-events: none）；
- [ ] 关闭 Rain 后雨丝消失、Audio gain 归零；
- [ ] 游戏 rAF 未调用 AI/天气；
- [ ] 未接 GameScreen，R4a~R4d 画面逻辑不出现变化。

## 9. 约束核对

| 约束 | 结果 |
|---|---|
| 不修改 R4a~R4d 游戏链路 | 未改 GameScreen / GameStage；NoteLogoLayer 仅新增可选视觉 prop/class；基线 276/276 |
| 不修改 R4e.2a Runtime / 适配器 / 视觉配置 | 未修改 `rainRuntime.ts` / `rainAdapters.ts` / P rain 文件 |
| 不接 GameScreen | 未改 GameScreen；RainLayer 只用于 Demo |
| 不改 R4a NoteLogoLayer 判定/时序/事件 | 仅 wrapper class / CSS variable，不改判断逻辑 |
| 不改 GameStage.tsx | 未修改 |
| 液态玻璃/极简 | RainDemo / Settings 截图与现有 console/editor 风格一致 |
| 暗角/准星/鱼眼保持 | 未改相关层 |
| E7 默认 0 请求 | App 默认 rainEnabled=false；Demo 用手动 intensity，不请求 API |

## 10. 关键文件

### Rain 视觉/音频

- `v4/app/src/game/rain/RainLayer.tsx`
- `v4/app/src/game/rain/rainLayerModel.ts`
- `v4/app/src/game/rain/rain-layer.css`
- `v4/app/src/game/rain/RainAudio.ts`

### Logo / Tint hook

- `v4/app/src/game/NoteLogoLayer.tsx`（仅可选视觉 prop）
- `v4/app/src/game/rain/rain-layer.css`（`.game-note-logo--rain` / `.game-content--rain` / `.game-stage--rain`）

### Settings / App / Demo

- `v4/core/presentation/console/SettingsConsole.tsx`
- `v4/core/presentation/console/rainSettingsModel.ts`
- `v4/core/presentation/console/console.css`
- `v4/core/presentation/console/WorldFolderConsole.tsx`
- `v4/app/src/App.tsx`
- `v4/app/src/screens/RainDemoScreen.tsx`
- `v4/app/src/screens/rain-demo.css`
- `v4/app/src/App.css`（临时入口按钮）

### Tests

- `v4/tests/r4e/rain-layer.test.ts`
- `v4/tests/r4e/rain-audio.test.ts`
- `v4/tests/r4e/settings-console-rain.test.ts`

## 11. 已知说明

1. **Rust 本批未改**：沿用 R4e.2a 的 `location_resolve` / `weather_resolve`，cargo 31/31 仍通过。
2. **Settings 状态为 NORMAL 的实机原因**：当前 ipwho.is / Open-Meteo 返回晴（weatherCode=1、precipitation=0），RainRuntime 正确映射为 active=false，因此不显示 RAIN XXX；失败时会显示 DEGRADED。
3. **音频实机未做听力断言**：自动化用 fake AudioContext 验证 gain/resume/dispose；实机需要用户手势与扬声器确认。
4. **未接 GameScreen**：RainLayer / RainTint hook / NoteLogo rain class 已准备好，R4e.3 才接入真实游戏。
5. **`NoteLogoLayer` prop 未由 GameScreen 传入**：保持 R4a 默认行为不变；这是本批的边界。
6. **A 类仍为 325**：`rainSettingsModel.ts` 使用 anonymous default export，不新增 A 名；P/W 既有名称不变。

## 12. 一行状态

**R4e.2b PASS：RainLayer 三层 CSS 雨丝 + tint/reduced-motion、WebAudio 白噪声雨声、NoteLogoGlow/RainTintSource 视觉 hook、SettingsConsole Rain 开关与状态、RainDemoScreen 手动预览；344/344 tests、276/276 基线、gates 0、App 888 modules、Rust 31/31。**
