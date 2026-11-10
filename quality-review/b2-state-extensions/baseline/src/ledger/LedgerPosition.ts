﻿﻿// ============================================================
// S4 账本域 · LedgerPosition 账本坐标类
// 名库冻结名：LedgerPosition（事件空间域）、
//            NarrativeDimension（20 维枚举，名库 v1.6 / §9）
//
// 本文件实现基础数据结构（20 维向量）与基础数学
// （逐维累加 / 清零 / 求和），不含任何业务决策。
//
// 访问铁律（T4 / PROTOCOL 验收轮第三部分第 1 条授权改写）：
// 对 20 维的所有访问一律通过 NarrativeDimension 枚举名，
// 禁止硬编码数字下标；维度有序列表由枚举在运行时导出
// （Object.values 过滤数值成员，滤掉数字枚举的反向映射），
// 数组长度同样由枚举派生，不写死 20。
// ============================================================

import { NarrativeDimension } from '../../constants/index';

/**
 * 全部维度的有序列表（枚举值 0~19，即冻结的数组下标）。
 * Object.values(数字枚举) 运行时含反向映射的字符串成员，
 * 以 typeof === 'number' 过滤；顺序即枚举声明顺序
 * （情感在前，TruthLevel 为第 17 维），与 stage-1.md §9 一致。
 */
const DIMENSIONS: readonly NarrativeDimension[] = Object.values(
  NarrativeDimension,
).filter(
  (value): value is NarrativeDimension => typeof value === 'number',
);

/**
 * LedgerPosition 账本坐标
 * HANDOFF-ROUND-05 指定：20 维向量数组，add(向量) / reset()。
 * 维度顺序与英文名经名库 v1.6 / stage-1.md §9 冻结。
 */
export class LedgerPosition {
  /**
   * 20 维坐标向量（构造时初始化为全 0）；
   * 长度由 NarrativeDimension 枚举成员数派生，不硬编码。
   */
  vector: number[];

  constructor() {
    this.vector = new Array<number>(DIMENSIONS.length).fill(0);
  }

  /**
   * 逐维累加另一个向量（基础数学，无业务决策）
   *
   * 只按 NarrativeDimension 枚举成员访问：
   * `this.vector[dimension]` 的 dimension 是枚举值，
   * 全方法无任何数字字面量下标。
   * 维度不一致时缺位以 0 补（?? 0）；该策略为此前落盘
   * 约定，PROTOCOL 另有裁定再调整。
   */
  add(other: number[]): void {
    for (const dimension of DIMENSIONS) {
      this.vector[dimension] += other[dimension] ?? 0;
    }
  }

  /**
   * 清零（基础数据操作，无业务决策；fill 不涉及维度下标）
   */
  reset(): void {
    this.vector.fill(0);
  }

  /**
   * 向量求和（ROUND-03 签名保留；只经枚举成员遍历累加）
   */
  sum(): number {
    let total = 0;
    for (const dimension of DIMENSIONS) {
      total += this.vector[dimension];
    }
    return total;
  }
}
