// ============================================================
// S3 痕接口 · PuzzleChain 两步解谜链（T6 / AC-12 ~ AC-13）
// 名库冻结名：PuzzleChain（名库 v0 事件域；v2.3 解谜链段冻结
//   两步链口径）、RhythmStrike、PuzzleProgress
//
// 两步链口径（名库 v2.3 / VERDICT-117 / AC-13）：
//   第一步：主角移动使痕满足指定接近距离，且痕的屏幕投影进入
//           指定敲击区域 → PuzzleProgress 推进至"待敲击"；
//           离开有效范围 → 退回第一步；
//   第二步：第一步条件仍成立时，完成一次 RhythmStrike（±50ms）
//           → 到达终点；敲击超出窗口 → 保留"待敲击"，允许重试；
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
import type { PuzzleProgress } from './PuzzleProgress';
import { RHYTHM_STRIKE_WINDOW_MS } from '../../constants/index';

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
   * 用户指令：固定跟随节拍无溢出 ±50ms 保持 7 秒后才进入
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

  /**
   * 最后一次被评估的拍点时刻（终点前；VERDICT-119）。
   *
   * 用于 checkSustainedExpiry 中的待判窗口检查：持续期满时，
   * 若该拍点的判定窗口 [t-50, t+50] 尚未闭合（当前 beat 时钟
   * < t + RHYTHM_STRIKE_WINDOW_MS），不得提前宣布成功——终点
   * 前的拍点仍须得到有效判定机会。miss 归零时同步重置为 -1。
   */
  private lastEvaluatedBeatTimeMs = -1;

  /**
   * @param progress 解谜进度（由组合根装配注入；本链推进其阶段）
   */
  constructor(progress: PuzzleProgress) {
    this.progress = progress;
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
  checkSustainedExpiry(currentBeatTimeMs: number): boolean {
    if (this.progress.getStage() !== 'AwaitingStrike') {
      return false;
    }
    if (this.sustainedStartMs < 0) {
      this.sustainedElapsedMs = 0;
      return false;
    }
    const elapsed = currentBeatTimeMs - this.sustainedStartMs;
    this.sustainedElapsedMs = elapsed;
    if (elapsed >= this.requiredSustainedMs) {
      // VERDICT-119：终点前的拍点若判定窗口尚未闭合，
      // 不得提前宣布成功——等待窗口闭合后再完成。
      if (
        this.lastEvaluatedBeatTimeMs >= 0 &&
        currentBeatTimeMs <
          this.lastEvaluatedBeatTimeMs + RHYTHM_STRIKE_WINDOW_MS
      ) {
        return false;
      }
      this.progress.applyStage('Completed');
      return true;
    }
    return false;
  }

  /**
   * 第二步：尝试结算一次节奏敲击（AC-12 / AC-13）。
   *
   * VERDICT-119 口径（时间制，非拍数制）：
   *   - 第一次命中启动 7 秒持续期；
   *   - 持续期内每次敲击必须在 ±50ms 内（miss 即归零重来）；
   *   - 有效持续区间为 [首次命中时刻, 首次命中时刻 + 7000ms)
   *     （半开区间）；
   *   - 目标拍点时刻等于或晚于持续期终点的拍点，不计入本轮
   *     持续判定（归属以目标拍点时刻判断，不以按键事件或
   *     更新帧的处理顺序判断）；
   *   - 终点前的拍点仍须得到有效判定；若其判定窗口尚未闭合，
   *     不得因已满七秒而提前宣布成功。
   *
   * 仅"待敲击"阶段接受敲击；判定由 RhythmStrike 纯函数执行
   * （绝对偏差 ≤ RHYTHM_STRIKE_WINDOW_MS = 50）。
   *
   * 账本结算不在本方法内：链终点"恰好写入一条 NarrativeEvent"
   * 由 director 在本方法返回 true 后执行（INV-2）。
   *
   * 方法名 attemptStrike 为"完成一次敲击"直译，待 PROTOCOL 追认。
   *
   * @param strike 敲击时间戳与目标节拍时间戳（表现层探针提供）
   * @returns 是否到达终点（持续期满 7 秒）
   */
  attemptStrike(strike: RhythmStrike): boolean {
    if (this.progress.getStage() !== 'AwaitingStrike') {
      return false;
    }

    // VERDICT-119：持续期活跃时，以目标拍点时刻判断边界。
    // 目标拍点时刻 >= 持续期终点的拍点不计入本轮持续判定。
    if (this.sustainedStartMs >= 0) {
      const sustainedEnd = this.sustainedStartMs + this.requiredSustainedMs;
      if (strike.targetBeatTimeMs >= sustainedEnd) {
        // 本拍不计入持续判定。但持续期已满——检查终点前
        // 最后一个被评估拍点的判定窗口是否已闭合：
        // 若尚未闭合，须等待（终点前的拍点仍须得到有效判定）。
        if (
          this.lastEvaluatedBeatTimeMs >= 0 &&
          strike.strikeTimeMs <
            this.lastEvaluatedBeatTimeMs + RHYTHM_STRIKE_WINDOW_MS
        ) {
          return false;
        }
        this.progress.applyStage('Completed');
        return true;
      }
    }

    // 同一拍重复命中：不计数也不归零，等待下一拍。
    if (strike.targetBeatTimeMs === this.lastHitBeatTimeMs) {
      return false;
    }
    this.lastHitBeatTimeMs = strike.targetBeatTimeMs;

    // 记录最后一次被评估的拍点时刻（终点前），
    // 供 checkSustainedExpiry 的待判窗口检查使用。
    this.lastEvaluatedBeatTimeMs = strike.targetBeatTimeMs;

    if (!judgeRhythmStrike(strike.strikeTimeMs, strike.targetBeatTimeMs)) {
      // 敲击超出窗口：持续期归零，保留"待敲击"阶段允许重试。
      this.sustainedStartMs = -1;
      this.sustainedElapsedMs = 0;
      this.lastEvaluatedBeatTimeMs = -1;
      return false;
    }

    // 命中：若持续期未开始则启动（以本次敲击时间戳为起点）。
    if (this.sustainedStartMs < 0) {
      this.sustainedStartMs = strike.strikeTimeMs;
    }
    this.sustainedElapsedMs = strike.strikeTimeMs - this.sustainedStartMs;
    return false;
  }
}
