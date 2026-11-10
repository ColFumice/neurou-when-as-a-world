﻿﻿﻿// ============================================================
// 【归档快照 · PROTOCOL 验收轮第三部分第 6 条】
// 本文件为 src/ledger/MomentInfo.ts 的归档前快照，保留阶段 8
// 才使用的瞬间信息越界逻辑（extractMomentInfo 提取函数）与
// 已被 LedgerRead / LedgerAppend 取代的四字段 Ledger 接口残余。
// 已移出 tsconfig 编译范围（archive/ 不参与 tsc 与门禁）。
// 阶段 8 恢复瞬间信息时以此快照为参考重新授权落盘。
// ============================================================

// ============================================================
// 账本域 · MomentInfo 瞬间信息提取（历史骨架，随目录改名保留）
// 名库冻结名：MomentInfo、Ledger（账本容器）
//
// 阶段定位（VERDICT-086 / stage-1.md §4）：
// 瞬间信息不在阶段 1 范围内。本文件随 src/event → src/ledger
// 改名整体迁入，本轮仅按依赖方向矩阵切断违规依赖边，
// 不新增提取逻辑、不做颜色映射。
//
// 本轮切断的违规边（T1 返工第 4 条）：
// 1. ledger → trace：删除 Trace 导入；relatedTraces 改为只
//    引用 constants.TraceId（“账本只引用 ID”）；
// 2. ledger → director：删除 Chapter 导入；chapter 字段按
//    阻塞字段规则注释挂起，等待 PROTOCOL 裁定是否改挂
//    ChapterTag，禁止以近似类型顶替；
// 3. ledger → presentation（瞬间信息相关，三处）：删除
//    EmotionWindowSum 导入，并删除 MomentInfo / Ledger 两处
//    emotionTendency 字段（导入 1 处 + 字段 2 处 = 三处）。
// ============================================================

import type { TraceId } from '../../constants';

/**
 * MomentInfo 瞬间信息（提取结果）
 */
export interface MomentInfo {
  // 原 emotionTendency: EmotionWindowSum 已删除
  // （EmotionWindowSum 同文件占位于 presentation；
  //  ledger → presentation 双重违规，瞬间信息不在阶段 1 范围）。

  /**
   * 关联的痕：VERDICT-086 后账本只引用痕的 ID
   * （constants.TraceId），不引用 trace 模块的 Trace 类型；
   * 字段名 relatedTraces 维持 ROUND-11 追认冻结，承载语义
   * 随裁定收窄为“关联痕的 ID 列表”。
   */
  relatedTraces: TraceId[];

  /*
   * 阻塞字段（ROUND-11 追认字段，类型因矩阵切边而挂起）：
   * 所属章节原类型 Chapter 位于 director 域，矩阵禁止
   * ledger → director；是否改挂账本附加信息 ChapterTag
   * 待 PROTOCOL 裁定，禁止以语义近似类型顶替。
   *
   * chapter: Chapter;
   */

  /**
   * 原始感绪数值：仅承载数值数组（number[]），
   * 不附带任何解释、分级或颜色信息。
   */
  rawEmotionValues: number[];
}

/**
 * Ledger 账本容器（正式冻结名；历史四字段读取面占位）
 *
 * 结构说明：本接口为 ROUND-11 追认的四字段提取面残余，
 * 随 VERDICT-086 切边同步收窄。与 T4 落盘的
 * LedgerRead / LedgerAppend（阶段 1 正式账本契约）的关系
 * 尚未经 PROTOCOL / ARCHITECT 裁定：本轮不合并、不删除，
 * 原样挂起等待放置裁定。
 */
export interface Ledger {
  // 原 emotionTendency: EmotionWindowSum 已删除（原因同 MomentInfo）。

  /** 账本侧已归集的关联痕 ID（VERDICT-086：只引用 ID） */
  relatedTraces: TraceId[];

  /*
   * 阻塞字段：原 chapter: Chapter；ledger → director
   * 为矩阵禁止边，挂起待 PROTOCOL 裁定（是否改挂 ChapterTag）。
   *
   * chapter: Chapter;
   */

  /** 账本侧记录的原始感绪数值（纯数值，无解释） */
  rawEmotionValues: number[];
}

/**
 * extractMomentInfo 瞬间信息提取
 *
 * 历史纯函数骨架：从 Ledger 逐字段装配 MomentInfo，
 * 不做派生计算、不做颜色映射。emotionTendency / chapter
 * 两条装配随字段删除 / 挂起一并移除，恢复承载待后续裁定。
 */
export function extractMomentInfo(ledger: Ledger): MomentInfo {
  return {
    relatedTraces: ledger.relatedTraces,
    rawEmotionValues: ledger.rawEmotionValues,
  };
}
