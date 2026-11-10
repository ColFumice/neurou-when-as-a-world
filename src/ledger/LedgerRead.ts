﻿﻿// ============================================================
// S4 账本域 · LedgerRead 账本读取接口（T4 账本桩）
//
// 依据：
// - 名库 v1.6：阶段 1 结构“账本的读取接口与追加接口分开”
// - docs/spec/stage-1.md §3 / §6：
//     读取接口所有模块可引用（presentation 按 R 只能用读取面）；
//     本接口不含任何写入能力（AC-23 / AC-25）。
// - VERDICT-086：director 是唯一可引用 LedgerAppend 的模块。
//
// 职责：遍历、按 ID 查询；禁止修改、禁止删除。
// 本文件只声明接口契约；数组承载实现待后续 HANDOFF 授权，
// 当前不提供任何类骨架与方法体。
// ============================================================

import type { NarrativeEvent } from './NarrativeEvent';
import type { NarrativeEventId } from '../../constants/index';

/**
 * LedgerRead 账本读取接口
 *
 * 只暴露只读能力：遍历与按 ID 查询。
 * 接口中刻意不存在任何修改 / 删除签名（AC-23：账本对外没有
 * 修改和删除记录的能力）；返回集合使用 ReadonlyArray，
 * 调用方无法经此接口改写记录顺序或内容。
 *
 * （接口名 LedgerRead 为本轮 HANDOFF 指定文件名承载，
 * 方法名 traverse / findById 已经 PROTOCOL 验收轮
 * 第一部分第 4 条正式追认。）
 */
export interface LedgerRead {
  /**
   * 遍历账本中的全部叙事事件。
   *
   * 顺序契约：按追加先后返回（账本只追加，天然有序）；
   * 返回只读数组，禁止经此修改或删除。
   */
  traverse(): ReadonlyArray<NarrativeEvent>;

  /**
   * 按 ID 查询单条叙事事件。
   *
   * @param eventId 叙事事件 ID（constants.NarrativeEventId）
   * @returns 对应记录；不存在时返回 null。仅查询，无副作用。
   */
  findById(eventId: NarrativeEventId): NarrativeEvent | null;
}
