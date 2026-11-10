// ============================================================
// 服务域 · AutopilotThreshold AI 接管时间阈值
// 名库 v0.8 正式冻结名：AutopilotThreshold
// （取代 HANDOFF-ROUND-06 文本名 AITakeoverThreshold；
//  旧文件 AITakeoverThreshold.ts 已删除，无新旧并存）
// 30 秒数值经 constants 注入
//
// 职责边界：只回答“静止时长是否已达到接管阈值”，
//          不持有静止检测状态、不知道 ConstellationGate
//          的存在，以保证与入口逻辑解耦
// ============================================================

import { AUTOPILOT_THRESHOLD_SECONDS } from '../../constants';

/**
 * AutopilotThreshold AI 接管阈值
 *
 * 解耦方式：
 * - 阈值经构造函数注入，默认值取自常量集中文件，本类不硬编码；
 * - ConstellationGate 依赖本类的实例（外部装配），
 *   不直接引用 30 秒常量，替换本类即可改变接管时机。
 */
export class AutopilotThreshold {
  constructor(
    private readonly thresholdSeconds: number = AUTOPILOT_THRESHOLD_SECONDS,
  ) {}

  /**
   * 静止时长是否达到 AI 接管阈值（基础比较，无业务决策外溢）
   *
   * 形参名 stationaryDurationSeconds：HANDOFF-ROUND-11
   * 正式追认冻结。
   */
  isReached(stationaryDurationSeconds: number): boolean {
    return stationaryDurationSeconds >= this.thresholdSeconds;
  }
}
