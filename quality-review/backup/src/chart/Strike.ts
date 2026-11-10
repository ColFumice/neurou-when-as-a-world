// ============================================================
// C 谱面域 · Strike 敲击（名库 v2.5 / HANDOFF-ROUND-18 冻结）
//
// 依据：
// - HANDOFF-ROUND-18：Strike 保留 videoTimeMs，增加可选 keyId；
//     谱面消费时 keyId 必需。
//
// 职责：承载一次输入的谱面时间码与（演奏时）槽位标识。
// 每次输入独立保存时间戳与顺序，不被单个 lastStrike 覆盖。
// 禁止：零 cc 依赖；不保存输入字符。
// ============================================================

import type { ChartKeyId } from './KeyboardPadLayout';

/**
 * Strike 敲击事件（HANDOFF-ROUND-18 冻结契约）。
 */
export interface Strike {
  /** 敲击对应的谱面 / 视频时间码（毫秒）。 */
  readonly videoTimeMs: number;
  /** 槽位标识；世界敲击可省略，谱面消费时必需。 */
  readonly keyId?: ChartKeyId;
}
