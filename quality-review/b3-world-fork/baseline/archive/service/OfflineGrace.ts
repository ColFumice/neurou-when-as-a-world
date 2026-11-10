// ============================================================
// 服务域 · OfflineGrace 离线宽限状态接口
// 名库冻结名：OfflineGrace（服务域）
// 时长常量：ROUND-08 正式定名 OFFLINE_GRACE_HOURS（取值 1，
//          集中于 constants/index.ts，本接口不硬编码）
// 本文件仅包含开始计时 / 检查宽限方法签名，无任何实现；
// 离线有效期由 OfflineGrace 确定（VERDICT-020 已转正式）
// ============================================================

/**
 * OfflineGrace 离线宽限状态
 * 方法范围严格依据 HANDOFF-ROUND-04：开始计时 / 检查宽限。
 */
export interface OfflineGrace {
  /** 开始计时（仅签名，无实现；方法名 ROUND-11 正式追认冻结） */
  startTiming(): void;

  /**
   * 检查宽限（仅签名，无实现）
   *
   * 方法名 checkGrace：ROUND-11 正式追认冻结；
   * 判定阈值为已冻结常量 OFFLINE_GRACE_HOURS（1 小时，
   * ROUND-11 HANDOFF 追认），实现落地时由消费方引用并
   * 换算，接口层不持有数值。
   */
  checkGrace(): boolean;
}
