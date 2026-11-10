/**
 * T · trace / strike
 * 框对准与 8 格判定结果；只含数值与判定枚举。
 * 不 import chart；不引用 director 的 Strike。
 */

/** 框对准判定结果。 */
export interface FrameAlignedStrike {
  readonly timeMs: number;
  readonly aligned: boolean;
  readonly windowMs: number;
}

/** 8 格判定结果；gridCellId 为 1..8，judgement 为内联联合。 */
export interface GridStrike {
  readonly timeMs: number;
  readonly gridCellId: number;
  readonly judgement: 'Perfect' | 'Good' | 'Miss';
  readonly offsetMs: number;
}