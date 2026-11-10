/**
 * K · constants
 * R2 冻结窗口常量；不 import 任何模块。
 */

/** 20 维叙事向量版本，固定 1。 */
export const VectorSchemaVersion = 1;

/** 8 格 Perfect 判定窗口（ms）。U-R2-01 冻结。 */
export const GRID_PERFECT_WINDOW_MS = 100;

/** 8 格 Good 判定窗口（ms）。U-R2-01 冻结。 */
export const GRID_GOOD_WINDOW_MS = 200;

/** 视差框对准窗口（ms）。U-R2-01 冻结。 */
export const FRAME_ALIGNED_WINDOW_MS = 100;