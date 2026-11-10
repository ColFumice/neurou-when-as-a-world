/**
 * C · chart / types
 * 谱面引用、层级/成绩、键与 Pad、8 格布局。
 * 不 import trace / editor。
 */

/** 谱面层级：Regular / Character / World / Final。 */
export enum ChartTier {
  Regular = 'Regular',
  Character = 'Character',
  World = 'World',
  Final = 'Final',
}

/** 谱面引用。 */
export interface ChartRef {
  readonly chartId: string;
  readonly tier: ChartTier;
}

/**
 * 谱面成绩与计分公式。
 *
 * R4a 规范化：
 * - Perfect = 1000；Good = 500；Miss = 0；
 * - 层数 multiplier = ChartLayerIndex（1 基）；
 * - 连击加成：每 1 combo +1%，封顶 +100%（100 combo = 2.0×）。
 *
 * 计分只依赖判定档位、层数与 combo，不读 UI/像素。
 */
export class ChartScore {
  static readonly Perfect = 1000;
  static readonly Good = 500;
  static readonly Miss = 0;
  static readonly ComboStep = 0.01;
  static readonly ComboCap = 100;

  readonly chartId: string;
  readonly layerIndex: number;
  readonly score: number;

  constructor(chartId: string, layerIndex: number, score: number) {
    if (typeof chartId !== 'string' || chartId.length === 0) {
      throw new RangeError('ChartScore.chartId must be a non-empty string');
    }
    if (!Number.isSafeInteger(layerIndex) || layerIndex < 1) {
      throw new RangeError('ChartScore.layerIndex must be a positive safe integer');
    }
    if (!Number.isFinite(score) || score < 0) {
      throw new RangeError('ChartScore.score must be a non-negative finite number');
    }
    this.chartId = chartId;
    this.layerIndex = layerIndex;
    this.score = score;
  }

  /** combo → multiplier；0 → 1.0，100+ → 2.0。 */
  static comboMultiplier(combo: number): number {
    const safe = Number.isFinite(combo) ? Math.max(0, Math.floor(combo)) : 0;
    return 1 + Math.min(safe, ChartScore.ComboCap) * ChartScore.ComboStep;
  }

  /**
   * 单 note 得分。
   * `combo` 是本次命中前的 combo；首个 note 不吃加成。
   */
  static scoreFor(
    judgement: 'Perfect' | 'Good' | 'Miss',
    layerIndex: number,
    combo: number,
  ): number {
    if (!Number.isSafeInteger(layerIndex) || layerIndex < 1) {
      throw new RangeError('ChartScore.scoreFor layerIndex must be a positive safe integer');
    }
    if (judgement === 'Miss') return ChartScore.Miss;
    const base = judgement === 'Perfect' ? ChartScore.Perfect : ChartScore.Good;
    return Math.floor(base * layerIndex * ChartScore.comboMultiplier(combo));
  }
}


/** 逻辑键身份（R2 用 string；R4 可收窄为 branded string）。 */
export type ChartKeyId = string;

/** Pad 类型：Light / Heavy / TopMost；与 ChartLayerIndex 解耦。 */
export enum ChartPadKind {
  Light = 'Light',
  Heavy = 'Heavy',
  TopMost = 'TopMost',
}

/** 8 格格位身份：1..8。 */
export type GridCellId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** 8 格行：Top / Bottom。 */
export enum GridRow {
  Top = 'Top',
  Bottom = 'Bottom',
}

/** 2 行 × 4 列布局。 */
export interface GridLayout {
  readonly rows: readonly [GridRow.Top, GridRow.Bottom];
  readonly columnsPerRow: 4;
  readonly cells: readonly GridCell[];
}

/** 单格：格位 + 行 + 列（0..3）。 */
export interface GridCell {
  readonly gridCellId: GridCellId;
  readonly row: GridRow;
  readonly columnIndex: 0 | 1 | 2 | 3;
}