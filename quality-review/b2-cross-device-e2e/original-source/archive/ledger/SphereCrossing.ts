// ============================================================
// 事件空间 · SphereCrossing 球面穿越判定类
// 名库冻结名：SphereCrossing（事件空间域）、
//            EventDistance（空间域，PROTOCOL ROUND-05
//            补充裁定：球面内外边界距离）、
//            LedgerPosition（事件空间域）
// 本文件实现基础数学（平方模长 / 平方半径比较）与穿越判定；
// 不含任何业务决策；EventDistance 的具体数值未冻结，
// 经构造函数注入，类内不写任何数值
// ============================================================

import type { LedgerPosition } from './LedgerPosition';

/**
 * EventDistance 事件距离（球面内外边界）
 * 名库空间域冻结名；PROTOCOL 在 ROUND-05 补充裁定中
 * 指认为 SphereCrossing 的球面半径 / 内外边界。
 *
 * 占位说明：作为标量距离，暂以 number 类型别名承载；
 * 其归属文件（空间域）与具体数值均未冻结，数值待
 * CONSTANTS.md 冻结后由调用方注入，是否拆分为独立
 * 文件待 PROTOCOL 指定。
 */
export type EventDistance = number;

/**
 * SphereCrossing 球面穿越
 * HANDOFF-ROUND-05 指定：check(初始坐标, 新坐标): boolean，
 * 逻辑依据——坐标从球面内到达球面外即触发。
 */
export class SphereCrossing {
  /**
   * @param eventDistance 球面边界距离（PROTOCOL 裁定冻结名；
   *   数值未冻结，由调用方注入，本类不持有默认值）
   */
  constructor(private readonly eventDistance: EventDistance) {}

  /**
   * 穿越判定：初始坐标位于球面内，且新坐标位于球面外时触发。
   *
   * 形参名 initialPosition / nextPosition：HANDOFF-ROUND-11
   * 随 check 签名一并正式追认冻结；
   * 坐标类型采用同域冻结名 LedgerPosition（取其 vector）。
   *
   * 边界约定：平方距离等于半径平方（恰在球面上）按“内”
   * 处理（<=）；该约定为基础数学常识性取法，如与设计
   * 不符请 PROTOCOL 裁定后调整。
   *
   * 球心说明：check 签名由 HANDOFF 锁定为两个坐标，
   * 故当前按“坐标为相对球心（名库冻结名 EventSpaceCenter）
   * 的位移”理解，直接取模长；球心的显式接入待后续授权，
   * 本轮不新增参数。
   */
  check(initialPosition: LedgerPosition, nextPosition: LedgerPosition): boolean {
    const radiusSquared = this.eventDistance * this.eventDistance;
    const isInside = (position: LedgerPosition): boolean =>
      this.squaredNorm(position.vector) <= radiusSquared;

    // 从球面内到达球面外即触发（基础比较数学，无业务决策）
    return isInside(initialPosition) && !isInside(nextPosition);
  }

  /**
   * 平方模长（基础数学：各维平方求和，不含业务决策）
   */
  private squaredNorm(vector: number[]): number {
    let total = 0;
    for (const value of vector) {
      total += value * value;
    }
    return total;
  }
}
