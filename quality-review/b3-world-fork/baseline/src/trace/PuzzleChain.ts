// ============================================================
// S3 痕接口 · PuzzleChain 两步解谜链（T6 / AC-12 ~ AC-13）
// 名库冻结名：PuzzleChain（名库 v0 事件域；v2.3 解谜链段冻结
//   两步链口径）、RhythmStrike、PuzzleProgress
//
// 两步链口径（名库 v2.3 / VERDICT-117 / AC-13）：
//   第一步：主角移动使痕满足指定接近距离，且痕的屏幕投影进入
//           指定敲击区域 → PuzzleProgress 推进至"待敲击"；
//           离开有效范围 → 退回第一步；
//   第二步：保持条件并连续七秒命中拍点（当前窗口 ±100ms）；漏拍 / 离区归零。
//   中间不写账本（进度只更新 PuzzleProgress）；终点恰好写入
//   一条 NarrativeEvent（结算由 director 经 LedgerAppend 执行，
//   INV-2，并防止重复结算）。
//
// 可配置参数（HANDOFF-ROUND-17 明示）：接近距离与敲击区域
//   放在本文件内部占位，不进入 constants；数值待 PROTOCOL 冻结。
//
// 边界：
//   ✗ 不引用 cc（逻辑模块，stage-1.md §14）
//   ✗ 不写账本（终点结算专属 director，INV-2）
//   ✗ 不做屏幕投影测量（投影坐标由表现层经探针提供）
//   ✗ 不计算主角到痕的距离（距离由 director 计算后传入）
//   ✗ 不实现向量计算 / 网络同步 / 颜色映射 / 雨模式
//
// 本文件命名已于 PROTOCOL HANDOFF-ROUND-17 追认批次正式冻结。
// 追认名：checkSustainedExpiry、getSustainedElapsedMs、
// getRequiredSustainedMs、sustainedStartMs、sustainedElapsedMs、
// requiredSustainedMs、evaluateStepCondition、attemptStrike、
// getProgress、PuzzleChainStage。
//
// VERDICT-119 新增直译名（待追认）：lastEvaluatedBeatTimeMs
//   （最后一次被评估的拍点时刻，用于终点前拍点判定窗口闭合
//    检查；归属以目标拍点时刻判断）。
// ============================================================

import { judgeRhythmStrike } from './RhythmStrike';
import type { RhythmStrike } from './RhythmStrike';
import type { PuzzleProgress, PuzzleChainStage } from './PuzzleProgress';
import { RHYTHM_STRIKE_WINDOW_MS } from '../../constants/index';

/** Complete private timing data; active sustained runs are outside the B2.2d-1 boundary. */
export interface PuzzleChainPrivateState {
  readonly stage: PuzzleChainStage;
  readonly sustainedStartMs: number;
  readonly sustainedElapsedMs: number;
  readonly lastHitBeatTimeMs: number;
  readonly nextBeatTimeMs: number;
  readonly beatIntervalMs: number;
  readonly requiredSustainedMs: number;
}

export function validatePuzzleChainPrivateState(raw: unknown, expectedBeatIntervalMs?: number): PuzzleChainPrivateState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      (Object.getPrototypeOf(raw) !== Object.prototype && Object.getPrototypeOf(raw) !== null)) {
    throw new Error('解谜计时快照格式无效');
  }
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  const names = ['stage', 'sustainedStartMs', 'sustainedElapsedMs', 'lastHitBeatTimeMs',
    'nextBeatTimeMs', 'beatIntervalMs', 'requiredSustainedMs'];
  if (Reflect.ownKeys(descriptors).length !== names.length) { throw new Error('解谜计时快照字段无效'); }
  const value: Record<string, unknown> = {};
  for (const name of names) {
    const descriptor = descriptors[name];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new Error('解谜计时快照不可安全读取');
    }
    value[name] = descriptor.value;
  }
  const stage = value.stage;
  if (stage !== 'Step1' && stage !== 'AwaitingStrike' && stage !== 'Completed') { throw new Error('解谜阶段无效'); }
  for (const name of names.filter(name => name !== 'stage')) {
    if (typeof value[name] !== 'number' || !Number.isFinite(value[name])) { throw new Error('解谜计时须为有限数'); }
  }
  const start = value.sustainedStartMs as number, elapsed = value.sustainedElapsedMs as number;
  const last = value.lastHitBeatTimeMs as number, next = value.nextBeatTimeMs as number;
  const beat = value.beatIntervalMs as number;
  if (beat <= 0 || value.requiredSustainedMs !== 7000 ||
      (expectedBeatIntervalMs !== undefined && beat !== expectedBeatIntervalMs)) {
    throw new Error('解谜计时规则不匹配');
  }
  if (stage !== 'Completed') {
    if (start !== -1 || elapsed !== 0 || last !== -1 || next !== -1) {
      throw new Error('UnsupportedBoundary: 活动七秒持续期不支持保存或恢复');
    }
  } else if (start < 0 || elapsed < 7000 || last < 0 || next !== last + beat ||
      next < start + 7000 || last >= start + 7000 || !Number.isFinite(start + elapsed)) {
    throw new Error('已完成解谜计时不一致');
  }
  return Object.freeze({ stage, sustainedStartMs: start, sustainedElapsedMs: elapsed,
    lastHitBeatTimeMs: last, nextBeatTimeMs: next, beatIntervalMs: beat, requiredSustainedMs: 7000 });
}

/**
 * 归一化屏幕投影点（文件内私有结构，不导出新名称）。
 *
 * 由表现层测量后经探针提供：x / y ∈ [0, 1]，原点为屏幕左上。
 * 本类型只承载测量结果，不在逻辑层做任何投影计算。
 */
interface ScreenProjectionPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * PuzzleChain 两步解谜链（名库 v0 / v2.3 冻结类型名）
 *
 * 阶段 1 一条链绑定一枚痕（场景中为深痕，AC-14"链终点若为
 * 深痕"）；进度承载在构造注入的 PuzzleProgress 中。
 */
export class PuzzleChain {
  /** 解谜进度（状态承载；仅由本链按两步口径推进） */
  private readonly progress: PuzzleProgress;

  // --------------------------------------------------------
  // 可配置参数（HANDOFF-ROUND-17：本文件内部占位，不进
  // constants；数值由实现方占位，待 PROTOCOL 冻结登记）
  // --------------------------------------------------------

  /** 第一步接近距离（WorldMeter，占位 2；与可见性触发半径同量级） */
  private readonly approachDistanceWm = 2;

  /** 敲击区域中心（归一化屏幕坐标，占位居中 0.5 / 0.5） */
  private readonly strikeZoneCenterX = 0.5;
  private readonly strikeZoneCenterY = 0.5;

  /** 敲击区域半宽 / 半高（归一化屏幕坐标，占位 0.2，即屏幕中央 40%×40%） */
  private readonly strikeZoneHalfWidth = 0.2;
  private readonly strikeZoneHalfHeight = 0.2;

  /**
   * 连续无失误持续时长要求（毫秒，占位 7000）。
   * 用户指令：固定跟随节拍无溢出当前判定窗口（±100ms）保持 7 秒后才进入
   * 谱面，而非准了一次就跳转。以时间而非拍数为口径，因为
   * 后续可能有不同的节奏型。数值为本文件内部占位，不进
   * constants，待 PROTOCOL 冻结登记。
   */
  private readonly requiredSustainedMs = 7000;

  /** 连续无失误起始时刻（beat 时钟毫秒；-1 = 尚未开始） */
  private sustainedStartMs = -1;

  /** 连续无失误已持续时长（毫秒；供标签显示用，逐帧更新） */
  private sustainedElapsedMs = 0;

  /** 上次命中的目标拍点时间戳（防止同一拍重复处理） */
  private lastHitBeatTimeMs = -1;

  /** 下一待命中拍点；若在持续期终点前，窗口闭合后漏拍归零。 */
  private nextBeatTimeMs = -1;

  /**
   * @param progress 解谜进度（由组合根装配注入；本链推进其阶段）
   */
  constructor(progress: PuzzleProgress, private readonly beatIntervalMs = 1000, initialState?: PuzzleChainPrivateState) {
    if (!Number.isFinite(beatIntervalMs) || beatIntervalMs <= 0) { throw new Error('PuzzleChain: 拍点间隔必须为正'); }
    this.progress = progress;
    if (initialState !== undefined) {
      const seed = validatePuzzleChainPrivateState(initialState, beatIntervalMs);
      if (seed.stage !== progress.getStage()) { throw new Error('解谜初始阶段与计时不一致'); }
      this.sustainedStartMs = seed.sustainedStartMs;
      this.sustainedElapsedMs = seed.sustainedElapsedMs;
      this.lastHitBeatTimeMs = seed.lastHitBeatTimeMs;
      this.nextBeatTimeMs = seed.nextBeatTimeMs;
    }
  }

  /** Capture only a stable supported boundary; no timer is reset for serialization. */
  capturePrivateState(): PuzzleChainPrivateState {
    return validatePuzzleChainPrivateState({ stage: this.progress.getStage(),
      sustainedStartMs: this.sustainedStartMs, sustainedElapsedMs: this.sustainedElapsedMs,
      lastHitBeatTimeMs: this.lastHitBeatTimeMs, nextBeatTimeMs: this.nextBeatTimeMs,
      beatIntervalMs: this.beatIntervalMs, requiredSustainedMs: this.requiredSustainedMs }, this.beatIntervalMs);
  }

  /**
   * 读取解谜进度（只读；AC-13 进度阶段的可观察出口）。
   * 方法名 getProgress 为"解谜链进度"直译，待 PROTOCOL 追认。
   */
  getProgress(): PuzzleProgress {
    return this.progress;
  }

  /**
   * 每帧评估第一步条件，并按结果推进 / 退回 PuzzleProgress
   * （AC-13：条件成立推进至"待敲击"；离开有效范围退回第一步）。
   *
   * 方法名 evaluateStepCondition 为"第一步条件"直译，
   * 待 PROTOCOL 追认。
   *
   * @param distanceWm 主角到链绑定痕的平面距离（WorldMeter；
   *                   由 director 计算后传入）
   * @param projection 链绑定痕的归一化屏幕投影点（表现层测量；
   *                   相机 / 表现层未就绪时为 null）
   * @returns 第一步条件当前是否成立（供 director 在敲击时刻复核）
   */
  evaluateStepCondition(
    distanceWm: number,
    projection: ScreenProjectionPoint | null,
  ): boolean {
    const withinApproach = distanceWm <= this.approachDistanceWm;
    const inStrikeZone =
      projection !== null &&
      Math.abs(projection.x - this.strikeZoneCenterX) <=
        this.strikeZoneHalfWidth &&
      Math.abs(projection.y - this.strikeZoneCenterY) <=
        this.strikeZoneHalfHeight;
    const stepConditionHold = withinApproach && inStrikeZone;

    const stage = this.progress.getStage();
    if (stepConditionHold && stage === 'Step1') {
      // 第一步条件成立：显式推进至"待敲击"（可观察的进度阶段）。
      this.progress.applyStage('AwaitingStrike');
    } else if (!stepConditionHold && stage === 'AwaitingStrike') {
      // 离开第一步有效范围：退回第一步（AC-13）。
      this.progress.applyStage('Step1');
      this.resetSustained();
    }
    return stepConditionHold;
  }

  /**
   * 读取连续无失误已持续时长（毫秒，只读；AC-13 进度出口）。
   * 方法名 getSustainedElapsedMs 为直译，待 PROTOCOL 追认。
   */
  getSustainedElapsedMs(): number {
    return this.sustainedElapsedMs;
  }

  /**
   * 读取完成所需持续时长（毫秒，只读；供表现层显示进度分母）。
   * 方法名 getRequiredSustainedMs 为直译，待 PROTOCOL 追认。
   */
  getRequiredSustainedMs(): number {
    return this.requiredSustainedMs;
  }

  /**
   * 逐帧检查持续期是否已满（用于无敲击到达时也能在 7 秒满
   * 时自动完成）。由 director 在 updatePuzzleChain 中每帧调用。
   *
   * VERDICT-119 口径：
   *   - 有效持续区间为 [首次命中时刻, 首次命中时刻 + 7000ms)
   *     （半开区间），满 7000ms 完成；
   *   - 终点前的拍点仍须得到有效判定；若其判定窗口尚未闭合
   *     （当前 beat 时钟 < lastEvaluatedBeatTimeMs +
   *     RHYTHM_STRIKE_WINDOW_MS），不得因已满七秒而提前宣布
   *     成功——须等到窗口闭合后再完成。
   *   - 归属以目标拍点时刻判断（见 attemptStrike 边界处理）。
   *
   * 方法名 checkSustainedExpiry 为直译，待 PROTOCOL 追认。
   *
   * @param currentBeatTimeMs 当前 beat 时钟毫秒（表现层探针提供）
   * @returns 是否因此次检查到达终点
   */
  private resetSustained(): void {
    this.sustainedStartMs = -1;
    this.sustainedElapsedMs = 0;
    this.lastHitBeatTimeMs = -1;
    this.nextBeatTimeMs = -1;
  }

  checkSustainedExpiry(currentBeatTimeMs: number): boolean {
    if (this.progress.getStage() !== 'AwaitingStrike' ||
        !Number.isFinite(currentBeatTimeMs) || this.sustainedStartMs < 0) { return false; }
    const end = this.sustainedStartMs + this.requiredSustainedMs;
    // A beat strictly before end belongs to this run, even when its window closes after end.
    if (this.nextBeatTimeMs < end) {
      if (currentBeatTimeMs > this.nextBeatTimeMs + RHYTHM_STRIKE_WINDOW_MS) {
        this.resetSustained();
      } else {
        this.sustainedElapsedMs = Math.max(0, currentBeatTimeMs - this.sustainedStartMs);
      }
      return false;
    }
    this.sustainedElapsedMs = Math.max(0, currentBeatTimeMs - this.sustainedStartMs);
    if (currentBeatTimeMs >= end) {
      this.progress.applyStage('Completed');
      return true;
    }
    return false;
  }

  attemptStrike(strike: RhythmStrike): boolean {
    if (this.progress.getStage() !== 'AwaitingStrike' ||
        !Number.isFinite(strike.strikeTimeMs) || !Number.isFinite(strike.targetBeatTimeMs) ||
        strike.strikeTimeMs < 0 || strike.targetBeatTimeMs < 0) { return false; }
    if (this.sustainedStartMs >= 0) {
      const end = this.sustainedStartMs + this.requiredSustainedMs;
      if (strike.targetBeatTimeMs >= end) { return false; }
      if (this.nextBeatTimeMs < strike.targetBeatTimeMs) { this.resetSustained(); }
    }
    if (strike.targetBeatTimeMs === this.lastHitBeatTimeMs) { return false; }
    if (!judgeRhythmStrike(strike.strikeTimeMs, strike.targetBeatTimeMs)) {
      this.resetSustained();
      return false;
    }
    if (this.sustainedStartMs < 0) { this.sustainedStartMs = strike.strikeTimeMs; }
    this.lastHitBeatTimeMs = strike.targetBeatTimeMs;
    this.nextBeatTimeMs = strike.targetBeatTimeMs + this.beatIntervalMs;
    this.sustainedElapsedMs = Math.max(0, strike.strikeTimeMs - this.sustainedStartMs);
    return false;
  }
}
