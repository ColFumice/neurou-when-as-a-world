﻿﻿// ============================================================
// S4 账本域 · MomentInfo 瞬间信息（数据形状占位）
// 名库冻结名：MomentInfo、ChapterTag（账本附加信息）、TraceId
//
// 阶段定位（VERDICT-086 / stage-1.md §4）：
// 瞬间信息不在阶段 1 范围内。本文件仅保留冻结名
// MomentInfo 的数据形状，不含任何提取逻辑：
// - extractMomentInfo 提取函数（越界逻辑）已按 PROTOCOL
//   验收轮第三部分第 6 条归档至 archive/ledger/MomentInfo.legacy.ts；
// - 四字段 Ledger 接口残余已按验收轮第二部分第 4 条删除，
//   账本契约以 LedgerRead / LedgerAppend 为准；
// - chapter 字段按验收轮第二部分第 3 条挂载账本附加信息
//   ChapterTag（ledger 域禁止依赖 director 域 Chapter）。
// ============================================================

import type { TraceId } from '../../constants/index';
import type { ChapterTag } from './NarrativeEvent';

/**
 * MomentInfo 瞬间信息（提取结果的数据形状）
 */
export interface MomentInfo {
  /**
   * 关联的痕：账本只引用痕的 ID（constants.TraceId），
   * 不引用 trace 模块的 Trace 类型（VERDICT-086）；
   * 字段名 relatedTraces 为 ROUND-11 追认冻结名。
   */
  relatedTraces: TraceId[];

  /**
   * 所属章节标记（PROTOCOL 验收轮裁定）：
   * 挂载账本附加信息 ChapterTag（同文件占位于 NarrativeEvent.ts，
   * 结构待冻结，当前空接口）；不再使用 director 域 Chapter。
   */
  chapter: ChapterTag;

  /**
   * 原始感绪数值：仅承载数值数组（number[]），
   * 不附带任何解释、分级或颜色信息。
   */
  rawEmotionValues: number[];
}
