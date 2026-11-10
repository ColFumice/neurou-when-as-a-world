// ============================================================
// 共情域 · EmpathyScaling 共情增幅
// 名库 v0.8 冻结名：EmpathyScaling、ScalingBasis（共情域）、
//                  ScalingWindow（增幅时间窗口）、
//                  DivergenceAxis.Understanding /
//                  DivergenceAxis.Empathy（两维成员）
// 关联冻结名：Trace、TraceOrigin.Echo / EchoTrace
//
// 逻辑边界（HANDOFF-ROUND-06，逐条硬约束）：
// 1. 增幅依据：ScalingWindow（近 1 小时）内“理解”“共情”
//    两个维度的累计值——窗口累计由上游完成，本类只消费
//    累计结果，不做时间窗采集；
// 2. 受上限约束：增幅量（而非基础值）被裁剪到 cap；
// 3. 只增不减：负向增量一律按 0 处理，绝不削减基础值；
// 4. 回响痕不应用此增幅：TraceOrigin.Echo（含 EchoTrace）
//    直接原样返回基础值。
//
// 本类不写任何平衡系数：增量=两维累计值直接求和，
// 系数 / 曲线待 ARCHITECT 数值平衡后授权。
// ============================================================

import { EMPATHY_SCALING_CAP } from '../../constants/index';
import { TraceOrigin } from './TraceOrigin';
import type { Trace } from './Trace';

/**
 * ScalingBasis 增幅基准（ScalingWindow 近 1 小时窗口累计值）
 * 名库共情域冻结名。
 *
 * 两个成员即 v0.8 冻结的 DivergenceAxis 两维成员，
 * 逐字使用冻结名 Understanding / Empathy（PascalCase）；
 * 其余四维不参与本增幅，故不在此出现。
 */
export interface ScalingBasis {
  /** “理解”维度窗口累计值（冻结成员 DivergenceAxis.Understanding） */
  Understanding: number;
  /** “共情”维度窗口累计值（冻结成员 DivergenceAxis.Empathy） */
  Empathy: number;
}

/**
 * EmpathyScaling 共情增幅器
 */
export class EmpathyScaling {
  /**
   * @param cap 增幅量上限；默认取常量集中文件的安全值 0。
   *   ROUND-11 裁定：EMPATHY_SCALING_CAP = 0 为暂定值
   *   （不产生未经平衡的增益），属数值平衡事项，
   *   待阶段 8 统一调整。
   */
  constructor(private readonly cap: number = EMPATHY_SCALING_CAP) {}

  /**
   * 计算增幅结果
   *
   * @param baseValue 待增幅的基础值
   * @param basis 近 1 小时（ScalingWindow）两维累计值
   * @param trace 触发本次计算的痕，用于回响痕排除
   */
  amplify(baseValue: number, basis: ScalingBasis, trace: Trace): number {
    // 约束 4：回响痕（TraceOrigin.Echo，EchoTrace 同源判定）不增幅
    if (trace.origin === TraceOrigin.Echo) {
      return baseValue;
    }

    // 基础求和（无平衡系数），约束 3：只增不减，负向增量归零
    const rawIncrement = basis.Understanding + basis.Empathy;
    const nonNegativeIncrement = Math.max(0, rawIncrement);

    // 约束 2：增幅量受上限裁剪；基础值本身永不被削减
    const cappedIncrement = Math.min(nonNegativeIncrement, this.cap);

    return baseValue + cappedIncrement;
  }
}
