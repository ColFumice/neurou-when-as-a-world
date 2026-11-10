# R4a 实施计划（8 格判定与核心玩法）

- 日期：2026-10-24（Asia/Shanghai）
- 状态：计划，不写代码
- 依据：`docs/spec/stage-4.md` v1.4 §7（AC4-14~17、31~33）、`docs/NAMEBOOK-v4.0.md`、`docs/refactor-r1/verdicts-refactor-r1.md` V-R1-006/007/010
- 前置：R3 已冻结编辑器、项目树、项目 cmp、视差与双视频管线
- 范围：玩家进入世界 → 加载谱面 → 音频母钟推进 → 分层判定 → Logo/网格反馈 → 退出/结算
- 不做：R4b 蓝图运行时与随机分流、R4c 痕/视差框触发、R4d 魔王曲首演、R4e AI/Rain；不写账本

---

## 0. 先给结论

1. **判定引擎放在 `v4/core/chart/`，但输出不是字面 `GridStrike`。**
   `chart → trace` 是 stage-4 §5.3 的禁止边，C 不能 import T；`chart → editor` 也禁止，C 不能 import `ChartSourceData`。因此 C 只产出 `ChartSnapshot` / `GridNote` 判定状态，由 app（X）映射为 `GridStrike`（T）。若必须让 C 直接返回 `GridStrike`，需要 PROTOCOL 新开一条 `C → T` 类型边，或把引擎移到 director（R）。

2. **音频时钟拆成“纯映射 + Web Audio 适配器”。**
   `AudioOutputClock`（C，A 类名）只做 `outputSeconds → playheadMs` 的纯映射、暂停/恢复/seek/锚点；`WebAudioOutputClock`（X，非 A）放在 `v4/app/src/game/audioClock.ts`，持有 `AudioContext` 与 BGM source。这样不违反 E3（逻辑层零 WebAudio），也不把 `AudioOutputClock` 从 C 挪走；stage-4 §2 “Web Audio 只在 presentation”的字面冲突见 §6 R4a-R4。

3. **视觉层不新增 P 类 A 名。**
   R3 的 P 层 A 名表已冻结且没有 gameplay 组件名。R4a 的 React 组件全部放 `v4/app/src/game/`（X 组合根），纯状态放 C；不修改 `EditorStage` / `ProjectTreeView` / `WorldFolderConsole` / `ParallaxRenderer` / `ParallaxCamera`。

4. **三个阻塞裁定必须先落，否则 R4a.1 无法封口：**
   - `Strike` 是否允许补 `phase`（Down/Up）与 `source`（Keyboard/Pointer）字段；
   - AC4-33 的 Hold 越界时刻从哪里来（v2 没有路径/越界数据）；
   - 第 1/3+ 层全屏判定是否需要 trace 结果类型（T 当前只有 `GridStrike` / `FrameAlignedStrike`）。

5. **三个非阻塞裁定可后置：** Logo 数据来源、是否做改键 UI、视差框是否在 R4a 接键盘对准。

---

## 1. 现状核对

| 项 | 现状 | 对 R4a 的影响 |
|---|---|---|
| `ChartSourceData` v2 | `v4/core/editor/ChartSourceData.ts`，严格 parser；只接受 v2；不含 logo/keyframeId | gameplay 可加载，但 C 不能 import E；由 app 解析后以结构数据喂 C |
| `GridStrike` / `FrameAlignedStrike` | `v4/core/trace/strike.ts` 已落 | `GridStrike` 只覆盖 8 格；没有全屏判定结果类型 |
| `Strike` | 只在 NAMEBOOK §1.17，代码中不存在；`v4/core/director/` 不存在 | R4a 首次落 `Strike`；字段需要一次定清 |
| `AudioOutputClock` | v4 无实现；`src/presentation/AudioOutputClock.ts` 是 v3.21/Cocos 遗留 | 不能直接复用；R4a 需新写 v4 版本 |
| 编辑器 playhead | `EditorScreen` 用 rAF + `performance.now()` 推进，不是音频时钟 | gameplay 不能复用编辑器时钟；R3.5d 已明确“音频驱动 playhead”不适用于 editor |
| App 入口 | `App.tsx` 只有 project / stereo3d / editor 三个 screen | 需要新增 gameplay 入口；不改 editor 与 project tree 本体 |
| 世界入口 | `ProjectConsole` 已有 `onEnterWorld?: (world) => void`，在 flash 时调用；`ProjectTreeDemoScreen` 没传 | 可零改 cmp 接入；由 `ProjectTreeDemoScreen` 透传 |
| 谱面 fixture | `v4/.stereo-demo/project/charts/chart-w1.editor.json`，6 个 note（L1×3、L2×2、L3×1） | 可作为 R4a 第一条可玩谱面 |
| 媒体 fixture | `media/manifest.json`：8s、1280×720、left/right + audio.wav（48kHz） | 音频母钟与双视频都可用 |
| A 类门禁 | `tools/check-naming-v4.cjs` 要求 `v4/core` 每个 export 都是 A 类名且模块一致 | 新 C 导出只能用既有 A 名，不能自造 `ChartJudge` 之类 |
| 依赖门禁 | `check-dependencies-v4.cjs` 显式禁止 `C>T`、`T>C`、`C>E` 等 | 引擎/解析边界必须按 §0 第 1 条拆 |

### 1.1 R3 冻结、R4a 不碰的文件

- `v4/core/editor/EditorWorldFile.ts`
- `v4/core/editor/ChartSourceData.ts`
- `v4/app/src/editor/EditorScreen.tsx`
- `v4/app/src/editor/EditorStage.tsx`
- `v4/core/presentation/console/WorldFolderConsole.tsx`
- `v4/core/presentation/projecttree/*`
- `v4/core/presentation/parallax/ParallaxRenderer.tsx`
- `v4/core/presentation/parallax/ParallaxCamera.ts`
- `v4/core/world/frame.ts`

允许的集成改动仅限：`v4/app/src/App.tsx`（路由/覆盖层）、`v4/app/src/screens/ProjectTreeDemoScreen.tsx`（透传 `onEnterWorld`）、根 `package.json`（`test:v4` 增加 `r4`）。若必须改冻结文件，先停，走裁定。

---

## 2. 判定引擎接口

### 2.1 模块与文件

```text
C / v4/core/chart/
  note.ts        GridNote、GridKeyHold、HoldGridLine
  snapshot.ts    ChartSnapshot、HoldGridOverflow、SpaceHoldOverflow
  logo.ts        NoteLogoGuide、NoteLogoMiss、NoteLogoLeadTimeMs / NoteLogoLifetimeMs / NoteLogoHoldExtensionMs
  grid.ts        DynamicGridScale、GridLineVisibility、GridScaleRestoreCondition
  clock.ts       AudioOutputClock
  blind.ts       BlindMode

R / v4/core/director/
  types.ts       Strike（只放类型，不写账本、不碰 IntentPort 的账本语义）

T / v4/core/trace/
  strike.ts      不改；R4a 只消费 GridStrike

X / v4/app/src/game/
  audioClock.ts  WebAudioOutputClock（非 A；与 R3.5d AudioTriggerRuntime 同层）
```

说明：

- `ChartSnapshot`、`GridNote`、`GridKeyHold`、`HoldGridLine`、`HoldGridOverflow`、`SpaceHoldOverflow`、`NoteLogoGuide`、`NoteLogoMiss`、`NoteLogo*Ms`、`DynamicGridScale`、`GridLineVisibility`、`GridScaleRestoreCondition`、`BlindMode`、`AudioOutputClock` 都是既有 A 类名；不新增名。
- `ChartJudge` / `GameSession` / `JudgementRecord` 这类名字**不导出**，避免 E1 失败。
- `GridLayout` 保持既有 interface；几何计算放进 `DynamicGridScale`，不导出第二个同名值对象，避免跨文件同名。

### 2.2 输入

`Strike`（R，概念接口；字段待裁定）：

```ts
interface Strike {
  readonly timeMs: number;
  readonly chartKeyId?: string;   // 逻辑键身份；Space 也走这里
  readonly gridCellId?: number;   // 1..8；第 2 层
  readonly phase?: 'Down' | 'Up'; // 建议新增；默认 Down
  readonly source?: 'Keyboard' | 'Pointer'; // 建议新增；默认 Keyboard
}
```

为什么需要 `phase` / `source`：

- Hold 必须在 keyup 时知道“松开了当前段”，否则“按住不放”和“松开重按”无法区分；
- 第 3 层“任意键/任意点击”需要区分键盘与指针；指针落在格内还要携带 `gridCellId`；
- 这两个字段不新增 A 名，也不改变 `Strike` 与 `GridStrike` 的隔离关系。

C 侧不 import `Strike`。`ChartSnapshot.submit` 接收结构参数：

```ts
submit(intent: {
  timeMs: number;
  chartKeyId?: string;
  gridCellId?: number;
  phase?: 'Down' | 'Up';
  source?: 'Keyboard' | 'Pointer';
}): ChartSnapshot;
```

TypeScript 的结构类型让 app 可以把 `Strike` 直接传进来，而 C 不产生 `C → R` 依赖。

### 2.3 输出

`ChartSnapshot` 是不可变快照；`advance` / `submit` 返回新快照：

```ts
class ChartSnapshot {
  constructor(input: {
    durationMs: number;
    layers: readonly ChartLayer[];
    notes: readonly GridNote[];
    blindMode?: BlindMode;
  });

  advance(nowMs: number): ChartSnapshot;
  submit(intent: {
    timeMs: number;
    chartKeyId?: string;
    gridCellId?: number;
    phase?: 'Down' | 'Up';
    source?: 'Keyboard' | 'Pointer';
  }): ChartSnapshot;
  reset(): ChartSnapshot;

  readonly notes: readonly GridNote[];       // 含 judgement / offsetMs / hold / logo
  readonly counts: {
    perfect: number; good: number; miss: number;
    combo: number; maxCombo: number;
  };
  readonly overflows: readonly (HoldGridOverflow | SpaceHoldOverflow)[];
  readonly logoMisses: readonly NoteLogoMiss[];
}
```

`combo`：Perfect/Good +1；Miss 清零；`maxCombo` 记录峰值。

`GridNote` 承载单 note 的判定状态：

```ts
class GridNote {
  constructor(input: {
    noteIndex: number;
    timeMs: number;
    durationMs: number;
    chartLayerIndex: number;
    gridCellId?: number;
    chartKeyId?: string;
    chartPadKind: ChartPadKind;
  });

  readonly judgement: 'Pending' | 'Perfect' | 'Good' | 'Miss';
  readonly offsetMs: number | null;
  readonly resolvedAtMs: number | null;
  readonly hold: GridKeyHold | null;
  readonly logo: NoteLogoGuide | null;
}
```

**输出到 trace 的边界：**

- 第 2 层且已判定的 `GridNote` → app 构造 `GridStrike`（`timeMs` / `gridCellId` / `judgement` / `offsetMs`）。
  - `timeMs` 取 `resolvedAtMs`（命中用输入采样时间，漏拍用 `note.timeMs + GRID_GOOD_WINDOW_MS`）；`offsetMs` 是相对 `note.timeMs` 的偏差。
- 第 1/3+ 层：R4a 不产出 trace 结果，只保留 `GridNote.judgement` 给 HUD/计分；这样不新增 `FullScreenStrike`，也不伪造 `gridCellId=0`。
- `FrameAlignedStrike`：R4a 不产出；留给 R4c。
- 若 PROTOCOL 要求全屏层也进 trace，建议在 R4c 新增 `FullScreenStrike`（新 A 名），而不是污染 `GridStrike`。

### 2.4 时钟来源

- 唯一时钟：`AudioOutputClock.nowMs()`。
- 每帧只采样一次：`const now = clock.nowMs(); snapshot = snapshot.advance(now);`。
- 每次 keydown/keyup 只采样一次，用采样值构造 `Strike.timeMs`。
- 引擎内部不读 `performance.now()` / `Date.now()` / rAF 时间戳；测试传假 `nowMs`。
- 暂停时不调用 `advance`，并且 `submit` 直接丢弃（或由 app 层拦截）；恢复后 `clock.resume()` 重新锚定，不补帧。

### 2.5 分层判定算法

`submit` 的顺序：

1. 若是 `phase === 'Up'`：只处理当前 active Hold 的松手；不参与普通 note 判定。
2. 若是 Hold 越界待重按：先在该 note 的越界窗口内匹配“新按下”；匹配成功则续段，匹配失败（按错）记 Miss 并终止。
3. 否则收集候选：`|intent.timeMs - note.timeMs| <= GRID_GOOD_WINDOW_MS` 且 `judgement === 'Pending'`。
4. 按层过滤：
   - **第 1 层 TopMost**：只接受 `chartKeyId === 'Space'` 的 Down；指针不判第 1 层。
   - **第 2 层 Grid**：只接受 `gridCellId` 匹配（或 `chartKeyId` 显式匹配）的 Down；不匹配则不进候选。
   - **第 3+ 层 FullScreen**：接受任意非修饰键 Down 或 Pointer Down；`fullScreenInput` 只作编辑提示，R4a 不据此禁用键盘。
5. 排序：`chartLayerIndex` 升序 → `abs(offsetMs)` 升序 → `timeMs` → `gridCellId`。
6. 取第一个；一个输入只判一个 note（同一输入不重复计分）。
7. 命中窗口：`abs(offset) <= 100` → Perfect；`<= 200` → Good；否则不进候选。
8. 无候选 → ghost（不扣分、不记 Miss），可用于视觉反馈。

`advance(nowMs)` 的顺序：

1. 普通 note：`nowMs > timeMs + 200` 且仍 Pending → Miss（`NoteLogoMiss` 同时入列）。
2. Hold：按 `HoldGridLine` 的 `atMs` 推进；`atMs + 200 < nowMs` 且未重按 → Miss 并终止。
3. Hold 到 `timeMs + durationMs`：完成，按初始 Perfect/Good 结算一次；不重复计分。
4. 幂等：同一个 note 只会从 Pending 进入 Perfect/Good/Miss 一次。

### 2.6 Hold 归属与越界

`GridKeyHold`（C）：

```ts
class GridKeyHold {
  readonly noteIndex: number;
  readonly layerIndex: number;       // 单一层；不允许跨层
  readonly startedAtMs: number;
  readonly endsAtMs: number;
  readonly gridCellId?: number;
  readonly chartKeyId?: string;
  readonly lastOverflowAtMs: number | null;
  readonly active: boolean;
}
```

规则：

- 一个 Hold 只属于一个 `chartLayerIndex`；第 2 层用 `HoldGridOverflow`，第 1/3+ 层用 `SpaceHoldOverflow`。
- 越界时刻必须“重新按下”才算续接；一直按住不算。
- 越界窗口：`atMs ± GRID_GOOD_WINDOW_MS`。
- 按对 → 续接；按错 → Miss 并终止当前段；越界后未按 → Miss。
- 提前 keyup（早于 `timeMs + durationMs`，且不在最后一个越界点的 Good 窗口内）→ 当前 Hold 记 Miss；不重复计分。此规则需要 sign-off（见 §6 R4a-R7）。
- 越界只影响 Hold 段，不改变 `DynamicGridScale`。
- 计分：一个 Hold 只结算一次；初始 offset 决定 Perfect/Good，任何越界失败降为 Miss。此规则需要 sign-off（见 §6 R4a-R7）。

**数据缺口（阻塞 AC4-33 的真实可玩性）：**

`ChartSourceData` v2 只有 `timeMs/durationMs/chartLayerIndex/gridCellId?/chartKeyId?/chartPadKind`，没有“Hold 提示移动路径”或“越界时刻”。AC4-33 的“越过判定网格线”无法从 v2 推导。

R4a 的建议：

- 引擎先支持显式 `HoldGridLine[]`（`atMs` + `requiredGridCellId?` + `requiredChartKeyId?`）；
- app 读取可选 sidecar `charts/<chartId>.holds.json`（新文件，非冻结 schema），为 demo/验收提供真实越界：

```json
{
  "schemaVersion": 1,
  "chartId": "chart-w1",
  "crossings": [
    {
      "noteTimeMs": 5800,
      "chartLayerIndex": 2,
      "gridCellId": 5,
      "atMs": 5950,
      "requiredGridCellId": 6
    }
  ]
}
```

- 不改 v2、不改 editor；若后续要作者可编辑，再在 R4b 把 sidecar 提升为 v2.1 可选字段。
- 若 sidecar 不存在：Hold 按“无越界”处理，仍可完整游玩与计分；AC4-33 的引擎行为由单测注入 schedule 覆盖。

### 2.7 Logo 引导

`NoteLogoGuide`（C）只对 `chartLayerIndex <= 2` 创建：

```ts
class NoteLogoGuide {
  readonly noteIndex: number;
  readonly layerIndex: number;
  readonly appearAtMs: number;
  readonly expireAtMs: number;
  readonly missAtMs: number | null;
  readonly state: 'Pending' | 'Visible' | 'Missed' | 'Done';
}
```

建议语义（待 sign-off）：

- 出现：`max(0, timeMs - NoteLogoLeadTimeMs)`。
- Tap 存活：到 `timeMs + NoteLogoLifetimeMs`。
- Hold 存活：到 `timeMs + durationMs + NoteLogoHoldExtensionMs`。
- Miss：在 `timeMs + GRID_GOOD_WINDOW_MS` 触发 `NoteLogoMiss`，保留 300ms 消失动效后移除。
- `BlindMode`：隐藏 Logo 与网格线，不改变 `appear/expire` 计算与判定窗口。
- 位置：Layer 2 默认取格心；Layer 1 默认取舞台中心；若加载到 editor.json 且有 logo，用 editor 的 `x/y/size/stretch`。
- Layer 3+：不创建。

建议值（待 sign-off）：`NoteLogoLeadTimeMs = 1500`，`NoteLogoLifetimeMs = 400`，`NoteLogoHoldExtensionMs = 300`。

### 2.8 动态网格

`DynamicGridScale`（C）：

```ts
class DynamicGridScale {
  constructor(layout: GridLayout);
  cellRect(cell: GridCellId): { x: number; y: number; width: number; height: number };
  hitTest(point: { x: number; y: number }): GridCellId | null;
  scaleOf(cell: GridCellId): number;          // 1.0 / 1.5
  visibilityOf(cell: GridCellId): GridLineVisibility;
  hit(cell: GridCellId): void;                // 1.5 + Revealed
  restoreIfOutside(
    point: { x: number; y: number },
    condition: GridScaleRestoreCondition,
  ): readonly GridCellId[];                   // 恢复 1.0 + Concealed
  reset(): void;
}
```

规则：

- 每格独立维护；`hit` 只影响该格。
- 点击到该格“放大后矩形”之外 → 该格恢复 1.0；其他格不受影响。
- 放大只改变 pointer 命中区域与视觉；`cell → key` 映射、判定窗口不变。键盘解析不依赖 scale；指针命中用放大后矩形。
- 成功命中才放大；Miss 不放大。
- 默认 `GridLineVisibility.Concealed`；1.5 → `Revealed`；1.0 → `Concealed`。
- R4a 不做“短暂保留可见”；立即恢复，视觉细节留给 R4c/打磨。

---

## 3. 视觉层拆分

R3 的 P 层 A 名已冻结且没有 gameplay 组件名，因此 R4a 的 React 组件放 app（X），纯状态放 C；不修改 R3 组件。

| 组件/文件 | 层 | 职责 | 数据来源 |
|---|---|---|---|
| `v4/app/src/game/GameScreen.tsx` | X | 加载、开始遮罩、rAF、输入、暂停、结算、退出 | clock / snapshot / loader |
| `v4/app/src/game/GameStage.tsx` | X | 双视频 GLSL 视差底图；视频 muted，跟随 playhead | media / playhead / camera |
| `v4/app/src/game/GridOverlay.tsx` | X | 2×4 格；per-cell scale/visibility；键位标签；命中闪光 | `DynamicGridScale` / `GridLayout` |
| `v4/app/src/game/NoteLogoLayer.tsx` | X | 按 `NoteLogoGuide` 渲染 Logo；Miss 红闪；BlindMode 隐藏 | `ChartSnapshot.notes[].logo` |
| `v4/app/src/game/FrameLayer.tsx` | X | 渲染 `VisualFrame` 矩形、tracking/lock；不触发 trace | `VisualFrame` |
| `v4/app/src/game/GameHud.tsx` | X | Perfect/Good/Miss、combo、层标识、时钟、暂停提示 | `ChartSnapshot.counts` |
| `v4/app/src/game/keymap.ts` | X | 物理键 → ChartKeyId/GridCellId；默认 QWER/ASDF | 常量 |
| `v4/app/src/game/chartLoader.ts` | X | 读 editor.json / v2 / holds sidecar / media manifest | Tauri adapters |
| `v4/app/src/game/session.ts` | X | 非导出的会话编排；不进入 A 名 | 上述模块 |

### 3.1 GameStage

- 复用 `EditorStage` 的 GLSL 算法（background/foreground 双层 + camera uniform），但**复制为独立 app 文件**，不修改 `EditorStage`；R4a 不做编辑器/游戏共用重构，避免回归。
- 视频元素 muted；BGM 走 WebAudio。视频不提供主时钟。
- 视频同步：每帧 `playheadMs` 与 `video.currentTime * 1000` 偏差 > 40ms 才 seek；seek 中跳过；暂停时 pause。
- WebGL2 不可用：显示视频直出/黑底 + 诊断，不阻断音频与判定。
- 相机：R4a 先用固定的轻微视差（由 `VisualFrame` 的 layer factor 或 `ParallaxCamera` 的计算结果 clamp 到 ±1）；不做 R4c 的框触发。

### 3.2 GridOverlay

- 16:9 letterbox 的内容框内做 2×4 网格；`DynamicGridScale.cellRect` 提供归一化 rect。
- 每格：`transform: scale(scaleOf(cell))`，`transform-origin: center`；`Revealed` 时显示网格线，`Concealed` 时隐藏。
- 键位标签：上排 Q/W/E/R，下排 A/S/D/F。
- 命中：Perfect/Good 白闪；Miss 红闪；不改变布局。
- 指针命中测试用当前 scale 后的矩形；键盘命中不依赖 DOM rect。

### 3.3 NoteLogoLayer

- 只渲染 `layerIndex <= 2` 且 `state === 'Visible'` 的 guide。
- 有 editor logo 时用 editor 的 `x/y/size/stretch`；按 `(timeMs, chartLayerIndex, gridCellId/chartKeyId)` 与 v2 note 匹配，重复 key 的 note 用默认位置，避免错配。
- 默认位置：Layer 2 格心；Layer 1 舞台中心。
- 动效：R4a 只实现 FadeDown/FadeUp，其他 editor 动效降级为淡入淡出。
- Miss：红色 tint + 轻微抖动 300ms；不改变判定。
- BlindMode：整个 layer 返回 null；网格线同样隐藏。

### 3.4 FrameLayer

- 只画 `VisualFrame.rect` 与 `FrameTracking` / `VisualFrameTargetLock` 的只读状态。
- R4a 不实现 `FrameAlignedStrike`、不改 trace 可见性、不做框触发。
- “键盘对准”在 R4a 不做，原因是会与第 3+ 层“任意键”冲突；建议 R4c 做框触发时一起做（见 §6 R4a-R9）。

### 3.5 GameHud

- 显示：`PERFECT / GOOD / MISS` 计数、`COMBO / MAX`、当前层、`playhead / duration`、音频状态。
- 不写账本、不写项目文件。
- 数值分数：R4a 不定义最终公式；HUD 可显示 `ChartLayerScoring.scoreFor(layer)` 的层基准分，但不乘判定系数。若需要分数条，用临时规则 `Perfect = base`、`Good = floor(base/2)`、`Miss = 0`，并在 UI 标注 `PROVISIONAL`；正式公式留 R4d。

### 3.6 布局与分辨率

- 内容框固定 16:9，居中 letterbox；1920×1080 与 2560×1440 使用同一归一化坐标。
- 网格、Logo、Frame 的坐标都相对内容框，不相对窗口。
- 视觉验收截图必须覆盖两档分辨率。

---

## 4. 键盘映射配置

### 4.1 默认映射

| 物理键（`event.code`） | ChartKeyId | GridCellId | 层 |
|---|---|---|---|
| `Space` | `Space` | — | 1 |
| `KeyQ` | `Grid1` | 1 | 2 |
| `KeyW` | `Grid2` | 2 | 2 |
| `KeyE` | `Grid3` | 3 | 2 |
| `KeyR` | `Grid4` | 4 | 2 |
| `KeyA` | `Grid5` | 5 | 2 |
| `KeyS` | `Grid6` | 6 | 2 |
| `KeyD` | `Grid7` | 7 | 2 |
| `KeyF` | `Grid8` | 8 | 2 |
| 其他非修饰键 | 物理键名 | — | 3+ |

- 用 `event.code`，不用 `event.key`；避免输入法/键盘布局影响。
- 忽略 `event.repeat`；忽略 Shift/Ctrl/Alt/Meta/CapsLock 本身。
- Space `preventDefault()`，避免滚动/按钮激活。
- 第 3+ 层“任意键”不包含修饰键；指针点击也算。
- 第 2 层指针点击格内时，携带 `gridCellId`；键盘按 `chartKeyId`/`gridCellId` 解析。

### 4.2 ChartKeyId 自定义

- note 有 `chartKeyId` 时，按逻辑 id 匹配；note 没有 `chartKeyId` 时，按 `gridCellId` 匹配。
- app 支持一张可选的 `ChartKeyId → event.code` 表；默认表就是上表的 `Grid1..8`。
- R4a **不做改键 UI、不做持久化**；自定义通过配置文件/常量注入，改键界面留 R4b/R5。
- 物理键没有自定义绑定、note 却有 `chartKeyId` 时，该 note 不会被默认键误命中；必须由绑定表提供对应逻辑 id，否则只能漏拍。不要用 `gridCellId` 兜底，避免错判。

### 4.3 输入优先级

1. 模态层（暂停/结算/开始遮罩）> 游戏判定。
2. 文本输入框/可编辑元素获得焦点时，游戏不接管键盘。
3. 同一时刻：第 1 层 → 第 2 层 → 第 3+ 层。
4. 一次输入只判一个 note；同刻多键（chord）由多个独立输入分别判定。
5. keyup 只处理 Hold 松手，不参与普通 note 判定。

### 4.4 键盘捕获与 R3 隔离

- `GameScreen` 在 `window` 上以 capture 监听 keydown/keyup；命中游戏键时 `preventDefault()` + `stopPropagation()`，避免 `ProjectConsole` 的 window keydown 继续处理。
- 游戏覆盖层显示时，底层 `ProjectTreeDemoScreen` 保持挂载（保留 workspace/console 状态），但设 `inert` / `aria-hidden`；`GlobalGlitch` 与 `Crosshair` 不渲染，避免按键触发故障层/准星穿帮。
- 退出游戏恢复底层；不重新加载项目树。

---

## 5. 音频时钟实现（Web Audio 版本）

### 5.1 纯映射：`AudioOutputClock`（C）

```ts
class AudioOutputClock {
  constructor(
    durationMs: number,
    readOutput: () => { outputSeconds: number; wallMs: number },
  );

  start(offsetMs?: number, atOutputSeconds?: number): void;
  pause(): void;
  resume(): void;
  seek(ms: number): void;
  nowMs(): number;
  readonly running: boolean;
  readonly playheadMs: number;
  readonly source: 'Audio' | 'Fallback';
}
```

映射：

```text
playheadMs = anchorChartMs + (outputSeconds - anchorOutputSeconds) * 1000
```

- `start(offset)` / `resume()` 建立新 anchor；`pause()` 冻结在最后一次采样值；`seek()` 设 pending offset，下一次采样重建 anchor。
- `nowMs()` clamp 到 `[0, durationMs]`；同一次运行内不倒退（seek 除外）。
- 支持“未来 anchor”：`start(offset, atOutputSeconds)`，用于 `source.start(when)` 的精确对齐；在 `when` 之前返回 offset。
- 不读 `performance.now()` 做判定；`wallMs` 只用于 fallback/诊断。
- 纯 C，无 DOM/WebAudio；单测用假 `readOutput`。

### 5.2 Web Audio 适配器：`WebAudioOutputClock`（X）

位置：`v4/app/src/game/audioClock.ts`（与 R3.5d 的 `AudioTriggerRuntime` 同层，使用 app 的 DOM 类型）。

> 契约提示：stage-4 §2 字面写“唯一允许值引用 Web Audio 的层是 presentation”；但 R3.5d 的 `AudioTriggerRuntime` 已经在 `v4/app`（X）使用 Web Audio。R4a 沿用既成先例，把 WebAudio 宿主放 X，C 保持纯逻辑。若 PROTOCOL 严格按 §2 执行，需要把 `AudioTriggerRuntime` 与 `WebAudioOutputClock` 一起迁入 P；这是跨阶段改动，不在 R4a 静默做。

职责：

- 创建/恢复 `AudioContext`；
- `decodeAudioData` 加载 BGM；
- `AudioBufferSourceNode → GainNode → destination`；
- 提供 `readOutputSeconds()`；
- 组合一个 `AudioOutputClock`，对外只暴露 `nowMs/start/pause/resume/seek/dispose`。

`readOutputSeconds()`：

1. 优先 `context.getOutputTimestamp()`：
   - 若 `state === 'running'`、`contextTime > 0`、`performanceTime > 0`、且 `performance.now() - performanceTime < 1000`：
     `output = min(currentTime, contextTime + (performance.now() - performanceTime) / 1000)`
2. 否则 fallback：`output = max(0, currentTime - baseLatency - outputLatency)`。
3. **不再二次扣延迟**：`getOutputTimestamp` 已经是输出对齐；只在 fallback 扣一次。

播放：

- `start(offsetMs)`：`const when = context.currentTime + 0.03`；`source.start(when, offsetSeconds)`；`clock.start(offsetMs, when 对应的 outputSeconds)`。
- `pause()`：`source.stop()`；`clock.pause()`；保留 offset。
- `resume()`：重建 source，从当前 offset 开始；`clock.resume()` / 新 anchor。
- `seek(ms)`：停 source，重建，从新 offset 开始；`clock.seek(ms)`。
- `dispose()`：停 source、断 gain、关 context；异步回写加 `disposed` guard。
- 音频不可用/解码失败：`clock` 用 `performance.now()` fallback，`source = 'Fallback'`，HUD 显示诊断；判定仍可进行，但不宣称音频对齐。

### 5.3 每帧/每输入采样

```text
rAF:
  now = clock.nowMs()
  snapshot = snapshot.advance(now)
  render(snapshot, now)

keydown/keyup:
  now = clock.nowMs()
  snapshot = snapshot.submit({ timeMs: now, ... })
```

- 不在 rAF 里累加 `deltaTime`；不以帧率推时间。
- 视觉只读 `now`；判定只读 `timeMs`。
- HUD 的 `playhead` 可 10Hz 节流，但判定/网格/Logo 用每帧值。
- 视频同步阈值 40ms；音频是母钟。

### 5.4 暂停/可见性/结束

- `Esc` 暂停：`clock.pause()`；视频 pause；输入只允许恢复/退出。
- `visibilitychange` 隐藏 → 自动暂停；恢复时要求用户手势 resume。
- 结束：`nowMs >= durationMs` → `Completed`；停 BGM/视频；显示结算；不写账本。若谱面时长 > 音频时长，时钟以音频结束为准，并用 `snapshot.advance(chartDurationMs)` 结算剩余 note 的 Miss；HUD 给诊断。
- 中途退出：销毁 clock/videos/overlay；不写账本；不产生 `ChartPremiere`。

### 5.5 音频同步验收

- 单测：假 `readOutput` 序列，验证 anchor、pause/resume、seek、clamp、monotonic、未来 anchor。
- 手动：HUD 显示 `playheadMs` / `context.currentTime` / `outputTime`；连续播放 8s，记录最大偏差；目标 ≤ 30ms（测量值，不宣称硬件级）。
- 证据：`quality-review/stage-4/r4/audio-sync.json` + 截图。

---

## 6. 需要裁定的风险

| ID | 风险 | 影响 | 建议 | 状态 |
|---|---|---|---|---|
| R4a-R1 | `Strike` 只有 `timeMs + chartKeyId / gridCellId`，没有 `phase` / `source` | Hold 无法区分“按住/松开”；第 3+ 层指针与键盘无法区分 | 在 R4a 定义 `Strike` 时补可选 `phase` / `source`；不新增 A 名 | **阻塞** |
| R4a-R2 | C 不能 import T，无法直接返回 `GridStrike` | “判定引擎输出 GridStrike”与依赖矩阵冲突 | C 产出 `ChartSnapshot/GridNote`；app 映射为 `GridStrike`；不新开 `C → T` 边 | **阻塞（若坚持字面输出）** |
| R4a-R3 | T 没有全屏判定结果类型 | 第 1/3+ 层判定无法进 trace | R4a 只对第 2 层产出 `GridStrike`；全屏结果留 HUD；R4c 再议 `FullScreenStrike` | **阻塞（若 trace 必须覆盖全屏）** |
| R4a-R4 | `AudioOutputClock` 在 NAMEBOOK 属 C，但 stage-4 §2 字面要求 Web Audio 只在 presentation；R3.5d 已在 app(X) 用 Web Audio | 放 C 违反 E3；放 P 违反名库模块；X 与 §2 字面冲突 | `AudioOutputClock` 纯 C + `WebAudioOutputClock` X adapter，沿用 R3.5d 先例；若严格按 §2，需把 `AudioTriggerRuntime` 一起迁 P，属跨阶段裁定 | **阻塞（代码布局/契约解释）** |
| R4a-R5 | v2 没有 Hold 路径/越界时刻 | AC4-33 无法从真实谱面产生越界 | 引擎支持显式 `HoldGridLine[]`；app 读可选 `charts/<id>.holds.json` sidecar；不改 v2/editor | **阻塞 AC4-33 真实可玩** |
| R4a-R6 | v2 不含 logo | AC4-31 无法只靠 v2 还原编辑器里的 Logo | gameplay 同时加载 editor.json 取 logo；无 logo 时用格心/舞台中心默认；v2 仍作判定权威 | 可后置 |
| R4a-R7 | Hold 只结算一次，初始 offset 决定 Perfect/Good，越界失败降 Miss | 计分规则未在 stage-4 写明 | 先按此规则实现并单测；若 PROTOCOL 有异议，只改 `ChartSnapshot` 一处 | 需 sign-off |
| R4a-R8 | 自定义键位是否要做 UI/持久化 | 影响 R4a 范围 | 引擎支持 `ChartKeyId`；R4a 只做默认表 + 配置注入；改键 UI 留 R4b/R5 | 可后置 |
| R4a-R9 | 视差框“键盘对准”与第 3+ 层“任意键”冲突 | 输入语义冲突 | R4a 只渲染 Frame；不对准、不触发；R4c 做框触发时一起做 | 可后置 |
| R4a-R10 | 编辑器的 Layer 3+ 导出 `fullScreenInput: 'Pointer'`，但 AC4-17/本任务说“任意键/任意区域点击” | 指针/键盘二选一 | R4a 对 Layer 3+ 同时接受键盘与指针；`fullScreenInput` 只作编辑提示 | 需确认 |
| R4a-R11 | 项目根是硬编码 `DEFAULT_EDITOR_PROJECT_ROOT` | “进入世界”仍是 demo 路径，不是真实项目根 | R4a 沿用 editor 的 demo 根；真实项目根/多项目路由留 R4b | 可后置 |
| R4a-R12 | Logo 时长语义有歧义 | `NoteLogoLifetimeMs` 可能被理解为“总存活”而非“判定后存活” | 按 §2.7 的“Tap 判定后 400ms / Hold 结束后 300ms”实现；参数可单点调整 | 需 sign-off |

### 6.1 建议先裁定的三项

1. **R4a-R1**：`Strike` 补 `phase` / `source` 是否算破坏 R2 冻结？建议“字段级扩展，不算新名”。
2. **R4a-R4**：`AudioOutputClock` 是否接受“C 纯映射 + X WebAudio 适配器”的拆分？
3. **R4a-R5**：AC4-33 是否接受 `charts/<chartId>.holds.json` sidecar 作为 R4a 数据源？若不接受，AC4-33 只能做到“引擎 + 单测”，真实谱面不产生越界。

---

## 7. 实施拆分

### R4a.0 契约与骨架（0.5d）

- 落 §6 的三项裁定；把结论写进 `R4a-changes.md`。
- 建 `v4/core/chart/`、`v4/core/director/`、`v4/adapters/browser/`、`v4/app/src/game/`、`v4/tests/r4/`。
- 根 `package.json` 的 `test:v4` 增加 `v4/.dist/tests/r4/*.test.js`。
- 不写判定逻辑；只落类型/空实现/测试脚手架。

**出口**：`typecheck:v4` 通过；E1/E2/E3 仍 0 ERROR；测试脚本能发现 r4 目录。

### R4a.1 判定引擎（3d）

- `GridNote`：窗口判定、Hold 字段、单层校验、单次结算。
- `ChartSnapshot`：`advance` / `submit` / `reset`；层序仲裁；同刻多键；Miss；Hold 越界；Logo 状态；`counts/combo`。
- `GridKeyHold` / `HoldGridLine` / `HoldGridOverflow` / `SpaceHoldOverflow`。
- `NoteLogoGuide` / `NoteLogoMiss` / 三个时长常量。
- `DynamicGridScale` / `GridLineVisibility` / `GridScaleRestoreCondition` / `GridLayout` 值对象。
- `BlindMode`。
- `Strike`（R，字段按裁定）。
- 单测：窗口、层序、chord、Hold、Logo、动态网格、暂停冻结、幂等。
- app 侧只写 `toGridStrike` 的纯映射（可放 `gamesession`，不接 UI）。

**出口**：`npm run test:v4` 全绿；`check:v4` 0 ERROR；`ChartSnapshot` 对 fixture 6 note 的手动输入序列得到预期计数。

### R4a.2 视觉层（2.5d）

- `GameStage`：双视频 GLSL、16:9 letterbox、视频跟随 playhead（40ms 阈值）。
- `GridOverlay`：8 格、per-cell scale/visibility、QWER/ASDF 标签、命中闪光。
- `NoteLogoLayer`：默认/editor logo、Fade、Miss 红闪、BlindMode。
- `FrameLayer`：`VisualFrame` 只读渲染。
- `GameHud`：计数/combo/层/时钟/音频状态。
- 用静态 fixture（固定 playhead/固定 snapshot）先出两档分辨率截图。

**出口**：1920×1080 / 2560×1440 截图；无 WebGL2 时降级可见；不改 R3 任何文件。

### R4a.3 集成与闭环（3d）

- `WebAudioOutputClock`：AudioContext、BGM decode、start/pause/resume/seek/dispose、output timestamp。
- `chartLoader`：
  1. 读 `charts/chart-<worldId>.editor.json`（有则取 logo；无 v2 导出时也从它 `exportV2()`）；
  2. 读 `charts/chart-<worldId>.json`；存在则以它作为判定权威（v2 与 editor 不一致时 v2 赢，只记诊断）；
  3. 两者都没有 → 报错，不静默造谱面；
  4. 读可选 `charts/chart-<worldId>.holds.json`；
  5. 读 `media/manifest.json` 最新 stereo pair + audio；
  6. 校验谱面/音频时长：音频为母钟；谱面超出音频 >100ms 记诊断，结束时结算剩余 Miss。
- `GameScreen`：加载 → 开始遮罩 → 3-2-1 count-in（约 2.4s，期间不判定/不 Miss）→ 0ms BGM 与 playhead 同时开始 → rAF → 输入 → 暂停 → 结算 → 退出；首帧用 200ms 白闪承接 `WorldEnterTransition` 的闪光（不改 cmp）。
- `App.tsx`：新增 game overlay；`ProjectTreeDemoScreen` 透传 `onEnterWorld`；底层保持挂载 + inert；`GlobalGlitch` 在游戏时关闭。
- 键盘/指针映射、keyup Hold、Esc/可见性暂停。
- 手动验收：完整打一遍 `chart-w1`；故意 Miss/Hold 越界；两档分辨率；退出/重进。

**出口**：AC4-14~17、31~33 的证据齐全；R3 回归（editor/project tree/cmp/parallax）通过。

### 7.1 依赖关系

```text
R4a.0 ─→ R4a.1 ─→ R4a.2 ─→ R4a.3
                 └──────→ R4a.3（loader/路由可与视觉并行）
```

R4a.1 是硬前置；R4a.2 的静态截图可在 R4a.1 完成前用 mock snapshot 先做，但最终必须接真 snapshot。

---

## 8. 测试、门禁与证据

### 8.1 单元测试（node:test，编译到 `v4/.dist/tests/r4`）

| 文件 | 覆盖 |
|---|---|
| `ac4-14-layer-grid.test.ts` | 第 2 层才用 8 格；第 1/3+ 层无 `gridCellId`；`GridStrike` 只从第 2 层产生 |
| `ac4-15-window.test.ts` | 0/99/100/101/199/200/201ms；早/晚；同 note 只判一次；暂停冻结 |
| `ac4-16-hold-layer.test.ts` | Hold 单层；跨层输入不续接；第 2 层 `HoldGridOverflow`；第 1/3+ 层 `SpaceHoldOverflow` |
| `ac4-17-layer-priority.test.ts` | 同刻 L1/L2/L3 冲突；Space 优先 L1；Q 优先 L2；无 L1/L2 时 L3；一次输入只判一个 |
| `ac4-31-note-logo.test.ts` | 提前量；Tap 存活；Hold 延长；Miss 触发；BlindMode 隐藏不改判定；L3+ 不生成 |
| `ac4-32-dynamic-grid.test.ts` | per-cell 1.5/1.0；格内/格外；cell→key 映射不变；判定窗口不变；reset |
| `ac4-33-hold-overflow.test.ts` | 到点重按成功；不按 Miss；按错 Miss；按住不放不算；提前松手 Miss；不重复计分；不改 DynamicGridScale |
| `audio-output-clock.test.ts` | anchor；pause/resume；seek；clamp；monotonic；未来 anchor；fallback |
| `chart-snapshot-fixture.test.ts` | `chart-w1` 6 note 的完整输入序列；chord；Miss；最终 counts |

`WebAudioOutputClock` 依赖 DOM/AudioContext，不做 `node:test`；由 app `typecheck`/`build` + 手动同步证据覆盖。纯 `AudioOutputClock` 的算法全部进单测。

补充性质测试：

- 任意输入序列：一个 note 最多 resolved 一次；一个 input 最多命中一个 note；`nowMs` 不倒退（除 seek）。
- `ChartSnapshot` 不可变：`advance/submit` 不修改旧快照。

### 8.2 手动/集成验收

1. 进入世界 → 开始遮罩 → BGM 起播；HUD 显示音频状态。
2. Layer 1：Space 命中/漏拍；Hold 到点重按 Space。
3. Layer 2：Q/W/E/R/A/S/D/F 命中 8 格；命中后该格 1.5× + Revealed；点击格外恢复 1.0 + Concealed；其他格不受影响。
4. Layer 3：任意键/任意点击命中；与 L1/L2 同刻时按层序。
5. Logo：提前 1.5s 出现；Miss 红闪；Hold 延长；BlindMode 隐藏。
6. Hold：越界后不按 → Miss；重按 → 续接；按错 → Miss；不重复计分。
7. 暂停：Esc 冻结；恢复不跳帧；可见性切换自动暂停。
8. 退出：回项目 console/world 视图；无账本写入；重进可再玩。
9. 分辨率：1920×1080 / 2560×1440。
10. 回归：editor 打开/保存、project tree 3D、cmp 进入世界、Parallax Demo 均不回归。

### 8.3 门禁与构建

```text
npm run typecheck:v4
npm run check:v4          # E1 naming / E2 dependencies / E3 zero-engine / E4 ledger
npm run test:v4
cd v4/app && npm run typecheck
cd v4/app && npm run build
```

R4a 新增 C 文件必须让 E3 仍 0 ERROR；新增 core export 必须让 E1 仍 0 ERROR；`ChartSnapshot` 不得 import T/E/R。

### 8.4 证据

```text
quality-review/stage-4/r4/
  R4a-plan.md
  R4a-changes.md
  logs/typecheck-v4.log
  logs/check-v4.log
  logs/test-v4.log
  logs/app-typecheck.log
  logs/app-build.log
  audio-sync.json
  screens/1920-initial.png
  screens/1920-layer2-hit.png
  screens/1920-layer2-enlarged.png
  screens/1920-hold-overflow.png
  screens/1920-miss.png
  screens/2560-layer1.png
  screens/2560-layer3.png
  screens/2560-pause.png
```

每条 AC 在 `R4a-changes.md` 中写“实现位置 + 测试名 + 证据路径”。

---

## 9. 明确不做 / 冻结边界

### 9.1 R4a 不做

- NEU 蓝图运行时、随机分流（R4b）。
- 痕、视差框触发、`FrameAlignedStrike`、`VisualFrameTargetLock` 的判定消费（R4c）。
- 魔王曲首演、`ChartPremiere`、账本写入、重演（R4d）。
- AI、Rain、天气（R4e）。
- 编辑器/项目树/cmp/视差/双视频管线的行为修改。
- 账号、网络、服务端。
- 最终计分公式、改键 UI、真实项目根路由、多项目并发。

### 9.2 冻结文件保护

若实现中必须修改 §1.1 的任一文件，先停，按 §6 走裁定；不静默改。R4a 验收时必须能证明这些文件未变（或只有经批准的透传改动）。

### 9.3 命名保护

- 不往 `docs/NAMEBOOK-v4.0.md` 加新 A 名。
- 不在 `v4/core` 导出非 A 名。
- 若必须新增名（例如 `FullScreenStrike`），先出裁定，不在 R4a 代码里先斩后奏。

---

## 10. 验收清单（AC 对照）

| AC | 实现 | 验证 |
|---|---|---|
| AC4-14 第 2 层才用 8 格 | `ChartSnapshot` 层规则；`GridStrike` 仅第 2 层 | `ac4-14-layer-grid.test.ts` + HUD 层标识 |
| AC4-15 窗口 | `GridNote` 用 100/200ms；同 note 一次；暂停冻结 | `ac4-15-window.test.ts` + 暂停手动 |
| AC4-16 Hold 单层 | `GridNote`/`GridKeyHold` 校验；越界事件按层 | `ac4-16-hold-layer.test.ts` |
| AC4-17 分层判定 | 层序仲裁；Space/Q/任意键；同一输入不重复 | `ac4-17-layer-priority.test.ts` + 手动 |
| AC4-31 Logo | `NoteLogoGuide` + 默认/editor 位置；Miss/Blind | `ac4-31-note-logo.test.ts` + 截图 |
| AC4-32 动态网格 | `DynamicGridScale` per-cell 1.5/1.0；Revealed/Concealed | `ac4-32-dynamic-grid.test.ts` + 截图 |
| AC4-33 Hold 越界 | `HoldGridLine` + `HoldGridOverflow`/`SpaceHoldOverflow`；重按/失败 | `ac4-33-hold-overflow.test.ts` + sidecar 演示 |
| AC4-24 音频对齐（R4a 范围） | `AudioOutputClock` + `WebAudioOutputClock` | `audio-output-clock.test.ts` + `audio-sync.json` |

**R4a 完成的定义：** 从项目 console 进入 `w1`，能完整打完 `chart-w1`；8 格、Logo、Hold 越界、动态网格、暂停/退出均可用；所有单测/门禁/构建通过；R3 无回归；证据落盘。
