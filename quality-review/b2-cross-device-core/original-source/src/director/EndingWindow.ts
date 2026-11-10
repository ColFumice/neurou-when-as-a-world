// ============================================================
// S5 叙事导演域 · EndingWindow 终末回映窗口
// 名库冻结名（ROUND-09 补充裁定逐字冻结）：
//   EndingWindow、RecentEmpathy、EndingMemoryDuration
// 关联冻结名：WallClock（epochMs）、DivergenceAxis.Empathy
// 常量：ENDING_WINDOW_SECONDS（1小时）、
//      ENDING_MEMORY_MIN_SECONDS（60）/ MAX_SECONDS（300）
//
// 命名状态：RecentEmpathy.totalEmpathy 字段经
// HANDOFF-ROUND-11 正式追认冻结；
// “60 秒 + 共情累计”的朴素映射经 ROUND-11 确认保留，
// 非最终平衡结论，待阶段 8 数值平衡调整。
//
// 逻辑边界：
// - 窗口判定只做时间戳比较（毫秒差 → 秒）；
// - 共情只做窗口内累计求和，不做实时情绪计算
//  （“玩家共情程度”由规则引擎在写入时确定）；
// - 总时长只做 [60,300] 秒区间裁剪；共情→秒数采用无系数
//   朴素映射（下限 + 累计值），不引入任何平衡系数 / 曲线，
//   系数待 ARCHITECT 数值平衡后授权。
// ============================================================

import {
  ENDING_WINDOW_SECONDS,
  ENDING_MEMORY_MIN_SECONDS,
  ENDING_MEMORY_MAX_SECONDS,
} from '../../constants/index';
import type { WallClock } from '../world/WorldInstance';

/**
 * RecentEmpathy 近期共情（EndingWindow 窗口累计产物）
 */
export interface RecentEmpathy {
  /**
   * 窗口内 DivergenceAxis.Empathy 维度的累计值
   * （字段名 totalEmpathy 经 ROUND-11 追认冻结）。
   */
  totalEmpathy: number;
}

/**
 * EndingMemoryDuration 回映总时长（单位：秒）
 * 合法区间为 [ENDING_MEMORY_MIN_SECONDS,
 *             ENDING_MEMORY_MAX_SECONDS]（60~300 秒）。
 */
export type EndingMemoryDuration = number;

/**
 * 共情样本（文件内私有类型，不作为模块对外导出名）
 *
 * 名库尚未冻结该样本类型名，故不导出、不进入跨文件 API；
 * 调用方按结构类型传入对象即可。
 * - at：样本写入时刻（承载名库感绪域 AppendedAt 的时间语义，
 *   ROUND-08 后统一以 WallClock 表达）；
 * - empathy：该样本的 DivergenceAxis.Empathy 数值。
 * 类型名与两个字段名均为直译，待 PROTOCOL 追认后再定名导出。
 */
interface EmpathySample {
  /** 样本时刻（WallClock 口径） */
  at: WallClock;
  /** 该样本共情值（DivergenceAxis.Empathy） */
  empathy: number;
}

/**
 * EndingWindow 终末回映窗口（1 小时）
 */
export class EndingWindow {
  constructor(
    private readonly windowSeconds: number = ENDING_WINDOW_SECONDS,
  ) {}

  /**
   * 判定某时刻是否落在回映窗口内（基础时间戳比较）
   *
   * 未来时刻（age 为负）不计入窗口；恰在窗口边界上按
   * “在窗口内”处理（<=，契约字面取法，待 PROTOCOL 追认）。
   */
  isWithinWindow(at: WallClock, now: WallClock): boolean {
    const ageSeconds = (now.epochMs - at.epochMs) / 1000;
    return ageSeconds >= 0 && ageSeconds <= this.windowSeconds;
  }

  /**
   * 计算 RecentEmpathy：对窗口内样本的共情值求和
   *
   * 只做遍历求和；负值样本按 0 处理（累计值不被负样本拖低，
   * 与“共情累计”语义一致；该取法待 PROTOCOL 追认）。
   */
  computeRecentEmpathy(
    samples: ReadonlyArray<EmpathySample>,
    now: WallClock,
  ): RecentEmpathy {
    let totalEmpathy = 0;
    for (const sample of samples) {
      if (this.isWithinWindow(sample.at, now)) {
        totalEmpathy += Math.max(0, sample.empathy);
      }
    }
    return { totalEmpathy };
  }

  /**
   * 计算 EndingMemoryDuration（60~300 秒）
   *
   * 朴素无系数映射：下限秒数 + 共情累计值（共情 1 单位
   * 对应 1 秒），随后裁剪到 [MIN, MAX]。ROUND-11 确认
   * 该朴素映射为当前阶段保留实现，非最终平衡结论，
   * 待阶段 8 数值平衡时仅修订本方法。
   */
  calculateEndingMemoryDuration(
    recentEmpathy: RecentEmpathy,
  ): EndingMemoryDuration {
    const rawSeconds = ENDING_MEMORY_MIN_SECONDS + recentEmpathy.totalEmpathy;
    if (rawSeconds < ENDING_MEMORY_MIN_SECONDS) {
      return ENDING_MEMORY_MIN_SECONDS;
    }
    if (rawSeconds > ENDING_MEMORY_MAX_SECONDS) {
      return ENDING_MEMORY_MAX_SECONDS;
    }
    return rawSeconds;
  }
}
