// ============================================================
// C 谱面域 · Note 谱面音符（名库 v2.5 冻结名）
//
// 依据：
// - 名库 v2.5：Note 为事件域冻结名；
// - HANDOFF-ROUND-18：Note 最小成员 timeMs + keyId；
//     显示坐标从所用布局派生，不随 Note 保存；
// - stage-1.md T7：判定要求时间有效 + 槽位匹配。
//
// 职责：只承载时间码与槽位标识；不保存像素、纹理或 Cocos 对象。
// 禁止：零 cc 依赖。
// ============================================================

import type { ChartKeyId } from './KeyboardPadLayout';
import type { ChartTier } from '../../constants';

/**
 * Note 谱面音符（HANDOFF-ROUND-18 冻结最小成员）。
 */
export interface Note {
  /** 谱面时间码（毫秒，独立谱面时间，不引用像素）。 */
  readonly timeMs: number;
  /** 目标槽位标识；显示坐标由 KeyboardPadLayout 派生。 */
  readonly keyId: ChartKeyId;
}

/**
 * ChartData 谱面数据文件内容（名称为直译，待追认）。
 *
 * 对应独立谱面 JSON（AC-16）：谱面数据只通过时间码引用视频，
 * 视频文件与本文件是两个独立文件。
 */
export interface ChartData {
  /** 谱面唯一标识（结算时写入 ChartRef.chartId）。 */
  readonly chartId: string;
  /** 谱面档位；阶段 1 为 Regular。 */
  readonly tier: ChartTier;
  /** 资源声明的布局版本；须与所用布局一致，否则拒绝加载。 */
  readonly layoutVersion: string;
  /** 全部音符。 */
  readonly notes: readonly Note[];
}
