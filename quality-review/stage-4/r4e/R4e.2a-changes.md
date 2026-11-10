# R4e.2a 变更说明 · Rain 核心与适配器

日期：2026-10-25  
状态：**PASS** · 331/331 tests；R4a~R4d 276/276；gates 0 ERROR；Rust 31/31；App 876 modules build。

范围：W 层 RainModeState、P 层 Rain 视觉纯数据、X 层 Location/Weather 适配器、app 层 RainRuntime 状态机与测试。  
未接 UI、未接 GameScreen、未接 RainLayer / RainAudio / Settings；未修改 R4a~R4d 游戏链路。

## 1. RainModeState 结构补全

文件：`v4/core/world/types.ts`

`RainModeState` 从 R2 的 interface 补全为可构造的 class，字段保持 A 类名不变：

```ts
class RainModeState {
  active: boolean;
  intensity: RainIntensity;
  degradedReason:
    | 'LocationUnavailable'
    | 'WeatherUnavailable'
    | 'NetworkUnavailable'
    | null;
  lastResolvedAt: number | null;
  source: 'IpWeather' | 'Manual';
}
```

- `lastResolvedAt` 从 `number` 改为 `number | null`；
- `active` 只表示“有效视觉”，与 `PerceptionMode.Rain` 分离；
- `source` 默认 `IpWeather`；
- 默认状态：`active=false`、`intensity=Light`、`degradedReason=null`、`lastResolvedAt=null`。

### 1.1 纯函数暴露方式（A 类 325 约束）

用户正文要求 `updateRainModeState` 与“强度映射函数”。  
本批 **不新增 A 类名**，因此不新增顶层 export，而是在 A 类 `RainModeState` 上提供两个静态纯函数：

```ts
RainModeState.updateRainModeState(current, input)
RainModeState.mapRainIntensity(weatherCode, precipitationMm)
```

行为：

- `updateRainModeState` 返回新对象，不修改 `current`；支持局部字段更新；
- `mapRainIntensity`：
  - 雪码 `71/73/75/77/85/86` → `null`；
  - 无雨码且降水量 `<= 0` → `null`；
  - `precipitation < 1` → `Light`；
  - `1 <= precipitation < 7.5` → `Moderate`；
  - `>= 7.5` → `Heavy`；
  - 雨码但瞬时降水为 0 仍视为 `Light`（天气码已指示降雨）。

命名门禁仍为 A 类 **325**，`RainModeState` 已实现 A 类；未新增导出名。

## 2. P 层 Rain 配置

目录：`v4/core/presentation/rain/`

只做纯数据/纯计算，不 import React / Pixi / DOM，也不值依赖 W（因此使用本地字符串联合，不 import `RainIntensity` 值）。

### 2.1 `RainVisualConfig`

文件：`RainVisualConfig.ts`

```ts
RainVisualConfig.forIntensity('Light' | 'Moderate' | 'Heavy')
```

输出：

```text
density / streakSpeed / opacity / blur / tint / glowStrength
```

三档差异：

| 参数 | Light | Moderate | Heavy |
|---|---:|---:|---:|
| density | 0.32 | 0.62 | 1.00 |
| streakSpeed | 0.42 | 0.70 | 1.00 |
| opacity | 0.30 | 0.52 | 0.72 |
| blur | 1.2px | 2.4px | 4.5px |
| glowStrength | 0.24 | 0.46 | 0.72 |

`cssVariables` 输出：

```text
--rain-density
--rain-streak-speed
--rain-opacity
--rain-blur
--rain-tint
--rain-glow-strength
```

供 R4e.2b RainLayer 直接消费，不操作 DOM。

### 2.2 `NoteLogoGlow`

文件：`NoteLogoGlow.ts`

```ts
NoteLogoGlow.forIntensity(intensity) -> 'drop-shadow(...)'
```

Light / Moderate / Heavy 分别输出 4px / 8px / 14px 的 drop-shadow，纯字符串，不依赖渲染器。

### 2.3 `RainTintSource`

文件：`RainTintSource.ts`

```ts
RainTintSource.mixBlendMode // 'soft-light'
RainTintSource.forThemeColor('#607684')
// 'color-mix(in srgb, #607684 38%, transparent)'
```

非法 themeColor 回退 `#607684`；只输出 CSS 值，不做合成。

## 3. X 层适配器与 Rust command

### 3.1 契约

文件：`v4/app/src/adapters/rainAdapters.ts`

```ts
type LocationResult =
  | { ok: true; latitude: number; longitude: number; timezone: string }
  | { ok: false; reason: 'NetworkError' | 'ParseError' };

type WeatherResult =
  | { ok: true; weatherCode: number; precipitationMm: number; isRain: boolean }
  | { ok: false; reason: 'NetworkError' | 'ParseError' };

interface LocationResolver { resolve(): Promise<LocationResult>; }
interface WeatherResolver { resolve(lat: number, lon: number): Promise<WeatherResult>; }
```

实现：

- `TauriLocationResolver implements LocationResolver`
  - 调用 `location_resolve`，无参数；
  - 校验经纬度范围、timezone 非空；
  - `ParseError/InvalidRequest` → `ParseError`，其余失败 → `NetworkError`；
  - 无缓存。
- `TauriWeatherResolver implements WeatherResolver`
  - 调用 `weather_resolve(lat, lon)`；
  - 先校验输入坐标，非法时不发请求；
  - 校验 `weatherCode / precipitationMm / isRain`；
  - 失败返回 `ok:false`，不抛到 Runtime；
  - 无缓存。

两个类均通过构造器注入 `TauriInvokeFn`，测试不联网。

### 3.2 Rust 命令

文件：`v4/app/src-tauri/src/commands/weather.rs`

```text
location_resolve() -> { latitude, longitude, timezone }
weather_resolve(lat: f64, lon: f64) -> { weatherCode, precipitationMm, isRain }
```

实现：

- `reqwest` HTTPS GET；
- `location_resolve`：
  - `https://ipwho.is/`，无 Key；
  - 解析 `latitude` / `longitude` / `timezone`（兼容字符串或 `{ id }`）；
  - 5s timeout。
- `weather_resolve`：
  - `https://api.open-meteo.com/v1/forecast?...&current=weather_code,precipitation`；
  - 解析 `current.weather_code` / `current.precipitation`；
  - `isRain`：雨码或降水量 > 0；雪码固定 false；
  - 5s timeout。
- 失败 code：`NetworkError` / `ParseError` / `InvalidRequest`；
- 错误 message 通用，不含 URL 响应正文；
- **每次调用都请求，不缓存**；缓存由上层决定。

接入：

- `commands/mod.rs` 声明 `weather`；
- `lib.rs` 注册两个 command；
- `build.rs` 的 `APP_COMMANDS` 加入 `location_resolve` / `weather_resolve`；
- `capabilities/default.json` 加入 `allow-location-resolve` / `allow-weather-resolve`。

## 4. app 层 RainRuntime

文件：`v4/app/src/game/rainRuntime.ts`

不 import React / Pixi / DOM，只依赖 `RainModeState` 与 X 契约类型。

### 4.1 构造与默认值

```ts
new RainRuntime({
  locationResolver,
  weatherResolver,
  now: () => number,
  onStateChange?: (state) => void,
})
```

- 默认 `enabled=false`，不发出任何网络请求；
- 初始状态 `RainModeState` 默认值；
- `onStateChange` 异常被吞掉，不破坏状态机。

### 4.2 API

```ts
setEnabled(enabled: boolean): Promise<void>
refresh(): Promise<RainModeState>
advanceTo(nowMs: number): Promise<void>
notifyOnline(): Promise<void>
get state(): RainModeState
get enabled(): boolean
```

- 首次 `setEnabled(true)` → 立即 `refresh()`；
- `setEnabled(false)` → 不请求，`active=false`、`degradedReason=null`；
- `advanceTo` 每帧可调用，只在到期时刷新；返回值仅供测试/调用方等待，rAF 可忽略；
- `notifyOnline` 由 app/游戏层把浏览器 `online` 事件转发进来；RainRuntime 自身不监听 DOM。

### 4.3 状态转换

```text
disabled
  --setEnabled(true)--> 立即 refresh

refresh:
  location fail:
    ParseError -> degradedReason=LocationUnavailable
    NetworkError -> degradedReason=NetworkUnavailable
  weather fail:
    ParseError -> degradedReason=WeatherUnavailable
    NetworkError -> degradedReason=NetworkUnavailable
  success:
    intensity = mapRainIntensity(weatherCode, precipitationMm)
    intensity 非空 -> active=true
    intensity 为 null（晴/雪） -> active=false, degradedReason=null
    lastResolvedAt = now
    source = IpWeather

失败但不改 PerceptionMode；active=false 时由 R4e.2b/3 视觉层表现为 Normal。
```

### 4.4 刷新与退避

- 成功：`nextAttemptAt = now + 10 分钟`；
- 失败：`30s → 60s → 120s → 240s`，上限 240s；
- 每次成功重置 backoff；
- `notifyOnline()` 立即重试并重置退避；
- `refresh()` 用 in-flight guard 防止并发；用 generation token 防止关闭后旧请求回写；
- 所有 resolver 异常、回调和状态更新都被隔离，`refresh` 永不向 rAF 抛异常。

## 5. 测试

新增 26 项 R4e.2a 测试：

### `rain-intensity-mapping.test.ts`（6）

- 晴天 → null；
- drizzle 0.5mm/h → Light；
- moderate 3mm/h → Moderate；
- heavy 10mm/h → Heavy；
- snow → null；
- 雨码但降水为 0 → Light；负降水非法。

### `rain-mode-state.test.ts`（4）

- `PerceptionMode.Rain + active=true` → 有效下雨；
- `PerceptionMode.Rain + active=false` → 视觉 Normal，不回写 PerceptionMode；
- 失败原因写入 `degradedReason`；`update` 不修改原对象；
- 三种降级原因可表达；`lastResolvedAt` 可为 null。

### `rain-visual-config.test.ts`（4）

- 三档 density / opacity / glowStrength 递增；
- CSS variables 稳定；
- NoteLogoGlow 只输出 drop-shadow；
- RainTintSource 输出 `soft-light` 与 `color-mix` tint。

### `rain-runtime.test.ts`（8）

- `setEnabled(false)` → 不请求；
- `setEnabled(true)` → 立即 refresh，成功 active/intensity；
- 无雨成功 → active=false、degradedReason=null；
- 失败 30s 重试，连续失败 60/120/240s 封顶；
- ParseError → LocationUnavailable / WeatherUnavailable；
- `notifyOnline` 立即重试；
- 10 分钟定期刷新；
- resolver 抛异常 / onStateChange 抛异常不外溢。

### `rain-adapters.test.ts`（4）

- Location 命令参数与结果；
- Location ParseError；
- Weather `weather_resolve(lat, lon)` 参数与结果；
- 非法坐标不请求；失败 `ok=false`。

### 汇总

```text
R4e.1a：15
R4e.1b：14
R4e.2a：26
R4e 总计：55
全仓：331
基线 R4a~R4d：276
```

## 6. 自跑结果

```text
npm run typecheck:v4
  exit 0

npm run test:v4
  tests 331
  suites 73
  pass 331
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
  A 类总数 325、同名跨模块 0、禁名 0

v4/app npm run typecheck
  exit 0

v4/app npm run build
  876 modules transformed
  built in 2.57s

cargo test
  31 passed / 0 failed

cargo build
  exit 0
```

证据：

- `quality-review/stage-4/r4e/r4e2a-typecheck-v4.log`
- `quality-review/stage-4/r4e/r4e2a-test-run.log`
- `quality-review/stage-4/r4e/r4e2a-baseline-276.log`
- `quality-review/stage-4/r4e/r4e2a-gates.log`
- `quality-review/stage-4/r4e/r4e2a-app-typecheck.log`
- `quality-review/stage-4/r4e/r4e2a-app-build.log`
- `quality-review/stage-4/r4e/r4e2a-cargo-test.log`
- `quality-review/stage-4/r4e/r4e2a-cargo-build.log`

## 7. 约束核对

| 约束 | 结果 |
|---|---|
| 不修改 R4a~R4d 游戏链路 | 未修改；基线 276/276 |
| RainRuntime 失败不中断 rAF | resolver/回调异常全部隔离；测试覆盖 |
| 默认关闭 | `enabled=false`；默认 0 请求；测试覆盖 |
| E7 外部网络门禁 | 只有显式 `setEnabled(true)` 才请求；无 UI / 无 GameScreen 接入 |
| 不接 UI | 未改 Editor/GameScreen/UI |
| 不接 GameScreen | 未改 GameScreen |
| RainLayer/RainAudio/Settings | 未实现 |
| Rust build.rs / capabilities | 已补两个 command |
| A 类 325 | 未新增 A 名；P/W 使用既有 A 类名 |

## 8. 已知说明

1. **纯函数暴露在 `RainModeState` 静态方法上**：为保持 A 类 325 不新增顶层导出名；语义分别是 `updateRainModeState` 与 `mapRainIntensity`。
2. **RainRuntime 不监听 DOM**：`notifyOnline()` 是供 R4e.2b/3 app 层绑定 `online` 事件的入口；本批不接 UI。
3. **`source: Manual` 本批不产生**：本批只有 IP/Weather 路径；Manual 留给 Settings UI 接入时的显式来源。
4. **API 实网**：Rust 解析测试使用固定 JSON；未在自动化测试中请求 ipwho.is / Open-Meteo，避免测试依赖外网。命令已通过 `cargo build` 与 ACL 注册。
5. **Rust 每次调用不缓存**：符合要求；上层 10 分钟刷新。
6. **视觉参数是 R4e.2b 的输入契约**，本批不生成 RainLayer / DOM。

## 9. 关键文件

### W

- `v4/core/world/types.ts`

### P

- `v4/core/presentation/rain/RainVisualConfig.ts`
- `v4/core/presentation/rain/NoteLogoGlow.ts`
- `v4/core/presentation/rain/RainTintSource.ts`

### X

- `v4/app/src/adapters/rainAdapters.ts`
- `v4/app/src/game/rainRuntime.ts`

### Rust

- `v4/app/src-tauri/src/commands/weather.rs`
- `v4/app/src-tauri/src/commands/mod.rs`
- `v4/app/src-tauri/src/lib.rs`
- `v4/app/src-tauri/build.rs`
- `v4/app/src-tauri/capabilities/default.json`

### Tests

- `v4/tests/r4e/rain-intensity-mapping.test.ts`
- `v4/tests/r4e/rain-mode-state.test.ts`
- `v4/tests/r4e/rain-visual-config.test.ts`
- `v4/tests/r4e/rain-runtime.test.ts`
- `v4/tests/r4e/rain-adapters.test.ts`

## 10. 一行状态

**R4e.2a PASS：RainModeState + 强度映射、三种 P 视觉纯数据、ipwho.is/Open-Meteo Tauri 适配器、默认关闭且 30/60/120/240s 退避的 RainRuntime，331/331 tests、276/276 基线、gates 0、Rust 31/31。**
