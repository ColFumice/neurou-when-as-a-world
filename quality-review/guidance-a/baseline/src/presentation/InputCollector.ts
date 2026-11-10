// ============================================================
// P 表现层 · InputCollector 输入采集（名库 v1.9 / VERDICT-094）
//
// 职责：
//   采集键盘 / 鼠标 / 触控的原始输入；
//   - 凡是需要交给逻辑层的，转换为玩家意图 PlayerIntent；
//   - 只影响画面的（滚轮 / 捏合调整视距），直接交给
//     CameraRig，不经过 director、不产生意图（VERDICT-094）。
//
// 帧序位置（FrameDriver 第 ① 步）：
//   每帧由 FrameDriver 调用 collectFrameIntents，整理出
//   本帧意图数组（持续移动 + 离散敲击 / 切换 / 谱面）。
//
// T7（HANDOFF-ROUND-18 任务 5 / 7 / 8，VERDICT-121）：
//   · 物理键白名单：KeyA–KeyZ + 11 符号（Regular）、
//     Digit0–9（Drum）、Space（Heavy）；Numpad0–9 别名到
//     同号 Digit；Shift 无槽位；
//   · 边沿触发：physicalKeysDown 统一守卫，操作系统自动重复
//     无效；每次独立按下各自入队，不互相覆盖；
//   · 上下文路由（INV-13）：谱面 Playing/Paused/Completed 时
//     键身份 Strike 提交首演、ESC 切换暂停；世界上下文时
//     WASD 移动、数字世界敲击、Space 跳跃、Tab 感知；
//   · 暂停时丢弃新输入；按住的键必须松开再按（physicalKeysDown
//     在暂停与恢复间保持，恢复后不自动补入）。
//
// 类型-only 边界（§6 I 边）：
//   对 director 的引用全部是 import type；意图由对象字面量
//   直接构造。check-dependencies E9 只放行 PlayerIntent /
//   IntentPort。
//
// 本文件命名已于 PROTOCOL HANDOFF-ROUND-17 追认批次正式冻结。
// 追认名：togglePerceptionMode、perceptionToggleNormal。
// VERDICT-118 直译名（待追认）：strikeKeysDown。
// ============================================================

import {
  _decorator,
  Component,
  input, Input,
  EventKeyboard,
  EventMouse,
} from 'cc';
import type { PlayerIntent } from '../director/PlayerIntent';
import type { PerceptionMode } from '../director/PlayerIntent';
import type { ChartPlaybackState } from '../chart/ChartPlaybackState';
import type { ChartKeyId } from '../chart/KeyboardPadLayout';
import type { CameraRig } from './CameraRig';

const { ccclass } = _decorator;

// —— 物理键码（DOM keyCode 口径；与真实 cc KeyCode 数值一致）——
const CODE_TAB = 9;
const CODE_ENTER = 13;
const CODE_SHIFT_LEFT = 16;
const CODE_SHIFT_RIGHT = 2000;
const CODE_ESCAPE = 27;
const CODE_SPACE = 32;
const CODE_LEFT = 37;
const CODE_UP = 38;
const CODE_RIGHT = 39;
const CODE_DOWN = 40;
const CODE_A = 65;
const CODE_D = 68;
const CODE_S = 83;
const CODE_W = 87;
const CODE_DIGIT_START = 48;
const CODE_DIGIT_END = 57;
const CODE_NUMPAD_START = 96;
const CODE_NUMPAD_END = 105;

// —— 11 个符号键物理码 → ChartKeyId（与布局槽位一一对应）——
const SYMBOL_CODE_TO_KEY_ID: ReadonlyArray<readonly [number, ChartKeyId]> = [
  [192, 'Backquote'],
  [189, 'Minus'],
  [187, 'Equal'],
  [219, 'BracketLeft'],
  [221, 'BracketRight'],
  [220, 'Backslash'],
  [186, 'Semicolon'],
  [222, 'Quote'],
  [188, 'Comma'],
  [190, 'Period'],
  [191, 'Slash'],
];

/**
 * InputCollector 输入采集组件
 */
@ccclass('InputCollector')
export class InputCollector extends Component {
  /** 视距调整的直送目标（仅表现层路径，不经过 director） */
  private cameraRig: CameraRig | null = null;

  /** 当前持续移动轴分量（[-1, 1]） */
  private moveLateral = 0;
  private moveDepth = 0;

  /** 本帧待整理的离散意图队列（敲击 / 切换 / 谱面） */
  private readonly discreteIntents: PlayerIntent[] = [];

  /** 当前按住的移动键集合（松键后移动轴正确归零）。 */
  private readonly pressedMoveKeys: Set<number> = new Set();

  /** 空格键按住守卫：世界上下文按住时每帧提交 Jump。 */
  private spacePressed = false;

  /** 感知模式开关本地游标（Tab；true = 下一次请求 Normal）。 */
  private perceptionToggleNormal = true;

  /**
   * 已按下物理键集合（统一边沿守卫）。
   * 键值取真实 event.keyCode 数值；keydown 时若已在集合中即
   * 操作系统自动重复 → 丢弃；keyup 移除。暂停 / 恢复间保持，
   * 保证按住的键恢复后必须松开再按。
   */
  private readonly physicalKeysDown: Set<number> = new Set();

  /** 谱面状态只读来源（上下文路由；未绑定按世界处理）。 */
  private chartStateProvider: (() => ChartPlaybackState) | null = null;

  /** 谱面媒体时间探针（Strike 时间戳；未就绪返回 -1）。 */
  private chartTimeProbe: (() => number) | null = null;

  /**
   * 世界敲击录制回调：每次世界数字键边沿调用一次，组合根据此
   * 在 BGM 时钟上记录 RhythmStrike（入 FIFO 时间线），
   * 与本类随后入队的 Strike 意图一一对应。
   */
  private worldStrikeRecorder: (() => void) | null = null;
  private worldStrikeResetter: (() => void) | null = null;

  private chartContextProvider: (() => boolean) | null = null;
  bindChartContextProvider(provider: () => boolean): void { this.chartContextProvider = provider; }

  private worldMotionProvider: (() => boolean) | null = null;

  bindWorldMotionProvider(provider: () => boolean): void { this.worldMotionProvider = provider; }

  private isWorldMotionGated(): boolean { return this.worldMotionProvider?.() ?? false; }

  private clearHeldInput = (): void => {
    this.physicalKeysDown.clear();
    this.pressedMoveKeys.clear();
    this.spacePressed = false;
    this.setMoveAxis(0, 0);
    this.discreteIntents.length = 0;
    this.worldStrikeResetter?.();
  };

  onEnable(): void {
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    input.on(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this);
    if (typeof window !== 'undefined') { window.addEventListener('blur', this.clearHeldInput); }
  }

  onDisable(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    input.off(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this);
    if (typeof window !== 'undefined') { window.removeEventListener('blur', this.clearHeldInput); }
    this.clearHeldInput();
  }

  // ----------------------------------------------------------
  // 接线
  // ----------------------------------------------------------

  /** 接线视距直送目标。 */
  bindCameraRig(cameraRig: CameraRig): void {
    this.cameraRig = cameraRig;
  }

  /** 接线谱面状态只读来源。 */
  bindChartStateProvider(provider: () => ChartPlaybackState): void {
    this.chartStateProvider = provider;
  }

  /** 接线谱面媒体时间探针。 */
  bindChartTimeProbe(probe: () => number): void {
    this.chartTimeProbe = probe;
  }

  /** 接线世界敲击录制回调。 */
  bindWorldStrikeRecorder(recorder: () => void): void {
    this.worldStrikeRecorder = recorder;
  }
  bindWorldStrikeResetter(resetter: () => void): void { this.worldStrikeResetter = resetter; }

  // ----------------------------------------------------------
  // 原始输入入口
  // ----------------------------------------------------------

  private onKeyDown(event: EventKeyboard): void {
    const code = event.keyCode as unknown as number;
    const repeated = this.physicalKeysDown.has(code);
    this.physicalKeysDown.add(code);
    if (repeated) {
      // 操作系统自动重复：不产生任何新边沿（移动 / 离散都不重复）。
      return;
    }

    const state = this.readChartState();
    if (isChartPlayback(state) || this.chartContextProvider?.()) {
      this.routeChartKey(code, state);
      return;
    }
    if (!this.isWorldMotionGated()) { this.routeWorldKey(code); }
  }

  private onKeyUp(event: EventKeyboard): void {
    const code = event.keyCode as unknown as number;
    this.physicalKeysDown.delete(code);
    if (code === CODE_SPACE) {
      this.spacePressed = false;
    }
    if (this.pressedMoveKeys.delete(code)) {
      this.refreshMoveAxis();
    }
  }

  /**
   * 谱面上下文路由：
   *   - ESC：Playing/Paused 边沿切换暂停；Completed → 请求退出；
   *   - 非 Playing：丢弃（暂停期间不接收演奏，Completed 已结束）；
   *   - Playing：白名单键边沿入队键身份 Strike，其余忽略。
   */
  private routeChartKey(code: number, state: ChartPlaybackState): void {
    if (code === CODE_ESCAPE) {
      if (state === 'Playing' || state === 'Paused') {
        this.requestToggleChartPause();
      } else if (state === 'Completed' || state === 'Ready') {
        this.requestExitChart();
      }
      return;
    }
    if (state !== 'Playing') {
      return; // 暂停 / 完成：丢弃其余输入。
    }
    const keyId = resolveChartKeyId(code);
    if (keyId === null) {
      return; // 非白名单（含 Shift / 方向键）忽略。
    }
    const mediaTime = this.chartTimeProbe !== null ? this.chartTimeProbe() : -1;
    if (!Number.isFinite(mediaTime) || mediaTime < 0) { return; }
    this.discreteIntents.push({
      kind: 'Strike',
      videoTimeMs: mediaTime,
      keyId,
    });
  }

  /**
   * 世界上下文路由：
   *   - WASD / 方向键 → Move；空格 → Jump（按住每帧）；
   *   - 主键盘 / 小键盘数字 → 世界敲击（录制 + Strike 意图）；
   *   - Tab → 感知往返；Enter → 进入谱面；ESC → 退出谱面。
   */
  private routeWorldKey(code: number): void {
    if (
      code === CODE_W || code === CODE_A || code === CODE_S || code === CODE_D ||
      code === CODE_UP || code === CODE_DOWN || code === CODE_LEFT || code === CODE_RIGHT
    ) {
      this.pressedMoveKeys.add(code);
      this.refreshMoveAxis();
      return;
    }
    if (code === CODE_SPACE) {
      this.spacePressed = true;
      return;
    }
    if (isWorldDigitCode(code)) {
      // 每次独立按下：录制一次（BGM 时钟）+ 入队一个 Strike。
      if (this.worldStrikeRecorder !== null) {
        this.worldStrikeRecorder();
      }
      this.discreteIntents.push({ kind: 'Strike', videoTimeMs: 0 });
      return;
    }
    if (code === CODE_TAB) {
      this.togglePerceptionMode();
      return;
    }
    if (code === CODE_ENTER) {
      this.requestEnterChart();
      return;
    }
    if (code === CODE_ESCAPE) {
      this.requestExitChart();
    }
  }

  /**
   * 移动轴（相机在 +Z 俯视 -Z）：
   *   W/↑ depth −1；S/↓ depth +1；A/← lateral −1；D/→ lateral +1。
   * 相反方向同时按互相抵消。
   */
  private refreshMoveAxis(): void {
    let lateral = 0;
    let depth = 0;
    if (this.pressedMoveKeys.has(CODE_D) || this.pressedMoveKeys.has(CODE_RIGHT)) {
      lateral += 1;
    }
    if (this.pressedMoveKeys.has(CODE_A) || this.pressedMoveKeys.has(CODE_LEFT)) {
      lateral -= 1;
    }
    if (this.pressedMoveKeys.has(CODE_W) || this.pressedMoveKeys.has(CODE_UP)) {
      depth -= 1;
    }
    if (this.pressedMoveKeys.has(CODE_S) || this.pressedMoveKeys.has(CODE_DOWN)) {
      depth += 1;
    }
    this.setMoveAxis(lateral, depth);
  }

  /** 鼠标滚轮：调视距直送 CameraRig，不产生意图。 */
  private onMouseWheel(event: EventMouse): void {
    if (isChartPlayback(this.readChartState()) || this.isWorldMotionGated()) { return; }
    const scrollY = event.getScrollY();
    if (scrollY !== 0) {
      this.adjustViewDistance(scrollY > 0 ? -1 : 1);
    }
  }

  /** 翻转感知模式（Normal / Triggered 往返；'Rain' 不产生）。 */
  private togglePerceptionMode(): void {
    if (this.perceptionToggleNormal) {
      this.requestSwitchPerceptionMode('Triggered');
    } else {
      this.requestSwitchPerceptionMode('Normal');
    }
    this.perceptionToggleNormal = !this.perceptionToggleNormal;
  }

  private readChartState(): ChartPlaybackState {
    return this.chartStateProvider !== null
      ? this.chartStateProvider()
      : 'Ready';
  }

  /** 设置持续移动轴分量（整理时裁剪到 [-1, 1]）。 */
  setMoveAxis(lateral: number, depth: number): void {
    this.moveLateral = lateral;
    this.moveDepth = depth;
  }

  /** 请求切换感知模式。 */
  requestSwitchPerceptionMode(mode: PerceptionMode): void {
    this.discreteIntents.push({ kind: 'SwitchPerceptionMode', mode });
  }

  /** 请求进入谱面（授予校验在逻辑层）。 */
  requestEnterChart(): void {
    this.discreteIntents.push({ kind: 'EnterChart' });
  }

  /** 请求退出谱面（逻辑层保证不写账本）。 */
  requestExitChart(): void {
    this.discreteIntents.push({ kind: 'ExitChart' });
  }

  /**
   * 请求切换谱面暂停（暂停面板继续按钮 / ESC 落点）。
   * 时间取谱面媒体探针（暂停时冻结），作为切换边界。
   */
  requestToggleChartPause(): void {
    const mediaTime = this.chartTimeProbe !== null ? this.chartTimeProbe() : -1;
    this.discreteIntents.push({
      kind: 'ToggleChartPause',
      videoTimeMs: mediaTime >= 0 ? mediaTime : 0,
    });
  }

  /** 调整视距：直送 CameraRig，不产生 PlayerIntent。 */
  adjustViewDistance(delta: number): void {
    if (this.cameraRig !== null) {
      this.cameraRig.adjustViewDistance(delta);
    }
  }

  // ----------------------------------------------------------
  // FrameDriver 第 ① 步：整理本帧输入
  // ----------------------------------------------------------

  /**
   * 整理本帧意图：世界上下文时持续 Move / 按住 Jump 在队首，
   * 离散意图按采集顺序在后；谱面上下文只输出离散（键身份
   * Strike / ToggleChartPause）。清空离散队列。
   */
  collectFrameIntents(): PlayerIntent[] {
    const frameIntents: PlayerIntent[] = [];
    const state = this.readChartState();
    const inChart = isChartPlayback(state) || (this.chartContextProvider?.() ?? false);

    if (inChart || this.isWorldMotionGated()) {
      this.worldStrikeResetter?.();
      this.pressedMoveKeys.clear();
      this.spacePressed = false;
      this.setMoveAxis(0, 0);
    }
    if (!inChart && !this.isWorldMotionGated()) {
      const lateral = clampAxis(this.moveLateral);
      const depth = clampAxis(this.moveDepth);
      if (lateral !== 0 || depth !== 0) {
        frameIntents.push({ kind: 'Move', lateral, depth });
      }
      // 蜻蜓点水：按住空格每帧 Jump，落地帧起跳、空中帧被忽略。
      if (this.spacePressed) {
        frameIntents.push({ kind: 'Jump' });
      }
    }

    while (this.discreteIntents.length > 0) {
      const queued = this.discreteIntents.shift();
      if (queued !== undefined) {
        frameIntents.push(queued);
      }
    }
    return frameIntents;
  }
}

/** 是否谱面播放态（Playing/Paused/Completed：键按谱面路由）。 */
function isChartPlayback(state: ChartPlaybackState): boolean {
  return state === 'Playing' || state === 'Paused' || state === 'Completed';
}

/** 是否世界数字键（主键盘 48~57 或小键盘 96~105）。 */
function isWorldDigitCode(code: number): boolean {
  return (
    (code >= CODE_DIGIT_START && code <= CODE_DIGIT_END) ||
    (code >= CODE_NUMPAD_START && code <= CODE_NUMPAD_END)
  );
}

/**
 * 物理键码 → ChartKeyId（物理身份，不依赖输入字符 / NumLock）。
 *   字母 65~90、主数字 48~57、小键盘 96~105（别名同号 Digit）、
 *   Space；11 符号；其余（含 Shift）返回 null。
 */
function resolveChartKeyId(code: number): ChartKeyId | null {
  if (code >= CODE_A && code <= CODE_D + 22) {
    return ('Key' + String.fromCharCode(code)) as ChartKeyId;
  }
  if (code >= CODE_DIGIT_START && code <= CODE_DIGIT_END) {
    return ('Digit' + String(code - CODE_DIGIT_START)) as ChartKeyId;
  }
  if (code >= CODE_NUMPAD_START && code <= CODE_NUMPAD_END) {
    // Numpad 别名到同号 Digit（谱面不区分物理来源）。
    return ('Digit' + String(code - CODE_NUMPAD_START)) as ChartKeyId;
  }
  if (code === CODE_SPACE) {
    return 'Space';
  }
  for (const [symbolCode, keyId] of SYMBOL_CODE_TO_KEY_ID) {
    if (symbolCode === code) {
      return keyId;
    }
  }
  // 显式标注 Shift 无槽位（避免误判为未知键）。
  if (code === CODE_SHIFT_LEFT || code === CODE_SHIFT_RIGHT) {
    return null;
  }
  return null;
}

/** 将轴分量裁剪到 [-1, 1]（基础数学；非向量计算）。 */
function clampAxis(value: number): number {
  if (value < -1) {
    return -1;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}
