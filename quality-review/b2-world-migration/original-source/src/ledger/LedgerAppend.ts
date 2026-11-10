﻿﻿﻿// ============================================================
// S4 账本域 · LedgerAppend 账本追加接口（T4 账本桩）
//
// 依据：
// - 名库 v1.6：阶段 1 结构“账本的读取接口与追加接口分开”
// - docs/spec/stage-1.md §3 / §6：
//     director 是全工程唯一可引用本接口的模块
//     （INV-2：只有叙事导演能追加账本；AC-24）；
//     脚本 scripts/check-dependencies.js 对此边硬校验。
// - INV-1：账本只能追加。
//
// 职责：只能追加；禁止修改、禁止删除。
// 本文件只声明接口契约；数组承载实现待后续 HANDOFF 授权，
// 当前不提供任何类骨架与方法体。
// ============================================================

import type { NarrativeEvent } from './NarrativeEvent';

/**
 * LedgerAppend 账本追加接口
 *
 * 全工程仅 director 可引用本接口（VERDICT-086 / AC-24）。
 * 接口中刻意只存在追加签名，不存在任何修改 / 删除签名
 * （INV-1 / AC-23）。
 *
 * （接口名 LedgerAppend 为本轮 HANDOFF 指定文件名承载，
 * 方法名 append 已经 PROTOCOL 验收轮第一部分第 4 条正式追认。）
 */
export interface LedgerAppend {
  /**
   * 追加单条叙事事件。
   *
   * 调用方（director）须给出完整 NarrativeEvent：
   * 完整 20 维向量 + VectorSchemaVersion + AppendedAt +
   * InputSource + ChapterTag + ChartRef（AC-22）。
   * 本接口不提供、也永远不应提供修改既有记录或删除记录
   * 的能力。
   *
   * @param event 待追加的叙事事件（只读）
   */
  append(event: NarrativeEvent): void;
}
