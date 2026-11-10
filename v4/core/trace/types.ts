// TraceTier 依据：archive/legacy-v3.21/NAMEBOOK.md 第 11 行：“痕 Trace、TraceTier(Common / Deep / Rain)、TraceOrigin(Normal / Anomalous)、DeepTrace、RainTrace、RainTraceTint 雨痕与雨元素彻底分开”
/**
 * T · trace
 * 痕、层级、来源、深痕/回声痕/触碰、异痕与目击。
 * 本文件不 import chart；不 import director / eventgraph。
 */

/** 痕层级：Common / Deep / Rain。Rain 为痕层级枚举成员，与 PerceptionMode.Rain 不混用。 */
export enum TraceTier {
  Common = 'Common',
  Deep = 'Deep',
  Rain = 'Rain',
}

/** 痕来源：Normal / Anomalous / Echo（v3.21 值域；R4 可补）。 */
export enum TraceOrigin {
  Normal = 'Normal',
  Anomalous = 'Anomalous',
  Echo = 'Echo',
}

/** 痕基础结构。 */
export interface Trace {
  readonly traceId: string;
  readonly tier: TraceTier;
  readonly origin: TraceOrigin;
}

/** 深痕：层级固定为 Deep。 */
export interface DeepTrace extends Trace {
  readonly tier: TraceTier.Deep;
}

/** 回声痕：来源固定为 Echo。 */
export interface EchoTrace extends Trace {
  readonly origin: TraceOrigin.Echo;
}

/** 痕触碰记录。 */
export interface TraceTouch {
  readonly traceId: string;
  readonly touchedAtMs: number;
  readonly count: number;
}

/** 异痕披露状态：Masked / Disclosed。 */
export enum AnomalyDisclosure {
  Masked = 'Masked',
  Disclosed = 'Disclosed',
}

/** 异痕成因（v3.21 四值）。 */
export enum AnomalyCause {
  ForcedRollback = 'ForcedRollback',
  MergeConflict = 'MergeConflict',
  OrphanCommit = 'OrphanCommit',
  RevertedEdit = 'RevertedEdit',
}

/** 目击视野。 */
export interface WitnessSight {
  readonly witnessId: string;
  readonly disclosed: boolean;
}