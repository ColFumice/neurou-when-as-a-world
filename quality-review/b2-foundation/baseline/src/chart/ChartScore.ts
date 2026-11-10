// ============================================================
// C 谱面域 · ChartScore 谱面计分（名库 v2.5 冻结名）
//
// 依据：
// - 名库 v2.5：ChartScore 为谱面体系冻结名；
// - stage-1.md T7 / AC-17：判定分 Perfect / Good / Miss 三档；
// - HANDOFF-ROUND-18 计分占位（EXECUTOR 不决定平衡）：
//     基础分 = CHART_BASE_SCORE (100)；
//     透明度加成线性：0% → 0，100% → 最多 100；
//     保持随 GuideTransparency 单调递增（AC-18）。
//
// 语义：
//   - 时间窗口纯判定：|Δ| ≤ 100 Perfect；≤ 200 Good；其余 Miss；
//     本轮用户确认数值，修订 VERDICT-123 第 5 条；窗口含端点。
//   - 命中（Perfect / Good）得基础分 + 透明度线性加成；
//     Miss 不得分。
//   - 占位口径：Perfect / Good 基础分同为 100（HANDOFF 仅明示
//     一个基础分 100；两档差异属数值平衡，待后续裁定）。
//
// 禁止：零 cc 依赖；不读取像素颜色；不写账本。
// ============================================================

import {
  PERFECT_WINDOW_MS,
  GOOD_WINDOW_MS,
  CHART_BASE_SCORE,
  CHART_TRANSPARENCY_BONUS_MAX,
} from '../../constants';

/**
 * ChartJudgeTier 判定档位（名称为直译，待追认）。
 */
export type ChartJudgeTier = 'Perfect' | 'Good' | 'Miss';

/** GuideTransparency 合法范围（百分比）。 */
const TRANSPARENCY_MIN = 0;
const TRANSPARENCY_MAX = 100;

/** 将 GuideTransparency 裁剪到 0~100。 */
export function clampGuideTransparency(value: number): number {
  if (!Number.isFinite(value)) {
    return TRANSPARENCY_MIN;
  }
  if (value < TRANSPARENCY_MIN) {
    return TRANSPARENCY_MIN;
  }
  if (value > TRANSPARENCY_MAX) {
    return TRANSPARENCY_MAX;
  }
  return value;
}

/**
 * 时间窗口纯判定（方法名为直译，待追认）。
 *
 * 边界口径（窗口含端点）：
 *   |timeMs - targetTimeMs| ≤ PERFECT_WINDOW_MS → Perfect；
 *   ≤ GOOD_WINDOW_MS → Good；其余 → Miss。
 *
 * @param timeMs 敲击时间码
 * @param targetTimeMs 目标 Note 时间码
 */
export function judgeTimeWindow(
  timeMs: number,
  targetTimeMs: number,
): ChartJudgeTier {
  const absolute = Math.abs(timeMs - targetTimeMs);
  if (absolute <= PERFECT_WINDOW_MS) {
    return 'Perfect';
  }
  if (absolute <= GOOD_WINDOW_MS) {
    return 'Good';
  }
  return 'Miss';
}

/**
 * 透明度线性加成（方法名为直译，待追认）。
 *
 * bonus = CHART_TRANSPARENCY_BONUS_MAX × (T/100)。
 * T 越大加成越大（含相等），满足 AC-18 单调性。
 *
 * @param guideTransparency 引导透明度 0~100
 */
export function transparencyBonus(guideTransparency: number): number {
  const t = clampGuideTransparency(guideTransparency);
  return CHART_TRANSPARENCY_BONUS_MAX * (t / TRANSPARENCY_MAX);
}

/**
 * ChartScore 谱面计分状态。
 *
 * 累计各档数量与总分；计分只依据判定档位与 GuideTransparency，
 * 与像素颜色、声音反馈分别处理。
 */
export class ChartScore {
  private perfectCount = 0;
  private goodCount = 0;
  private missCount = 0;
  private totalScore = 0;

  /**
   * 应用一次判定并返回本次得分（Miss 为 0）。
   *
   * @param tier 判定档位
   * @param guideTransparency 本次演奏的引导透明度
   */
  applyJudgement(
    tier: ChartJudgeTier,
    guideTransparency: number,
  ): number {
    if (tier === 'Perfect') {
      this.perfectCount += 1;
    } else if (tier === 'Good') {
      this.goodCount += 1;
    } else {
      this.missCount += 1;
      return 0;
    }
    const points =
      CHART_BASE_SCORE + transparencyBonus(guideTransparency);
    this.totalScore += points;
    return points;
  }

  /** Perfect 数量。 */
  getPerfectCount(): number {
    return this.perfectCount;
  }

  /** Good 数量。 */
  getGoodCount(): number {
    return this.goodCount;
  }

  /** Miss 数量。 */
  getMissCount(): number {
    return this.missCount;
  }

  /** 当前总分。 */
  getTotalScore(): number {
    return this.totalScore;
  }
}
