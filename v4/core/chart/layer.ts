/**
 * C · chart / layer
 * 动态层、1 基索引、层分值与全屏判定方式。
 * 不 import trace / editor；不导出 CHART_LAYER_BASE_SCORE。
 */

/** 1 基层索引。 */
export type ChartLayerIndex = number;

/** 层类别（仅本文件内部使用，不导出）。 */
type ChartLayerKind = 'TopMost' | 'Grid' | 'FullScreen';

/** 全屏判定方式：Space / Pointer。 */
export enum FullScreenJudgementLayer {
  Space = 'Space',
  Pointer = 'Pointer',
}

/** 动态层；第 1 层 TopMost、第 2 层 Grid、第 3+ 层 FullScreen。 */
export interface ChartLayer {
  readonly index: ChartLayerIndex;
  readonly kind: ChartLayerKind;
  readonly fullScreenInput?: FullScreenJudgementLayer;
}

/**
 * 层分值：
 * score(1) = base；
 * score(n) = max(1, floor(score(n-1) * 0.5))。
 * base 默认 800，不导出常量名。
 */
export class ChartLayerScoring {
  static scoreFor(index: ChartLayerIndex, base: number = 800): number {
    if (!Number.isSafeInteger(index) || index < 1) {
      throw new RangeError(`layer index must be a positive safe integer, got ${String(index)}`);
    }
    if (!Number.isSafeInteger(base) || base < 1) {
      throw new RangeError(`layer base must be a positive safe integer, got ${String(base)}`);
    }

    let score = base;
    for (let current = 2; current <= index; current += 1) {
      score = Math.max(1, Math.floor(score * 0.5));
    }
    return score;
  }
}