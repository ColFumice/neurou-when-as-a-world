import { VectorSchemaVersion } from '../constants/index';

/**
 * 20 维叙事向量类型。
 *
 * 顺序（与 v3.21 冻结顺序一致）：
 * 0 Red / 1 Green / 2 Blue / 3 Black / 4 White / 5 Grey /
 * 6 Initial / 7 Process / 8 Trace / 9 Highlight / 10 Commented /
 * 11 Residue / 12 Trust / 13 Closeness / 14 Understanding / 15 Conflict /
 * 16 TruthLevel / 17 NarrativeTime / 18 InfluenceRadius / 19 PlayerEmpathy。
 */
export type NarrativeDimension = readonly [
  number, // 0 Red
  number, // 1 Green
  number, // 2 Blue
  number, // 3 Black
  number, // 4 White
  number, // 5 Grey
  number, // 6 Initial
  number, // 7 Process
  number, // 8 Trace
  number, // 9 Highlight
  number, // 10 Commented
  number, // 11 Residue
  number, // 12 Trust
  number, // 13 Closeness
  number, // 14 Understanding
  number, // 15 Conflict
  number, // 16 TruthLevel
  number, // 17 NarrativeTime
  number, // 18 InfluenceRadius
  number, // 19 PlayerEmpathy
];

/**
 * 叙事事件（账本一行）。
 * P-R2-05：chartRef 用 string | null 占位，不 import chart。
 */
export interface NarrativeEvent {
  readonly eventId: string;
  readonly vector: NarrativeDimension;
  readonly vectorSchemaVersion: typeof VectorSchemaVersion;
  readonly appendedAt: AppendedAt;
  readonly chartRef: string | null;
}

/** 账本容器（只读视图）。 */
export interface Ledger {
  readonly events: readonly NarrativeEvent[];
}

/** 账本累计位置（20 维和）。 */
export type LedgerPosition = NarrativeDimension;

/** 账本追加时刻。 */
export interface AppendedAt {
  readonly epochMs: number;
}

/** 路线覆盖：事件数、累计位置、六情感分歧轴。 */
export interface RouteCoverage {
  readonly eventCount: number;
  readonly position: LedgerPosition;
  readonly divergence: DivergenceAxis;
}

/** 路线签名：覆盖 + 由事件序列派生的 routeId。 */
export interface RouteSignature extends RouteCoverage {
  readonly routeId: string;
}

/** 六情感分歧轴。 */
export enum DivergenceAxis {
  Red,
  Green,
  Blue,
  Black,
  White,
  Grey,
}