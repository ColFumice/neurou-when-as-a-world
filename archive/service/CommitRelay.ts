// ============================================================
// 服务域 · CommitRelay 轻量中继接口
// 名库 v0.4 冻结名：CommitRelay（服务域 / 同步机制域）
// 关联冻结名：WorldCommit（同步机制域）
// 本文件仅包含转发方法签名，无任何中继与网络实现
// ============================================================

import type { WorldCommit } from '../sync/WorldCommit';

/**
 * CommitRelay 提交中继（轻量）
 * 方法范围严格依据 HANDOFF-ROUND-04：转发 WorldCommit。
 * 名库“CommitRelay 边界清单”的具体边界待后续轮次授权。
 */
export interface CommitRelay {
  /**
   * 转发世界提交（仅签名，无实现）
   *
   * 形参名 commit：HANDOFF-ROUND-11 随 relay 签名
   * 一并正式追认冻结。
   */
  relay(commit: WorldCommit): void;
}
