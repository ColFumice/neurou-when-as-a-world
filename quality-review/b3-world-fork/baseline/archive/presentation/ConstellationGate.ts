// ============================================================
// 入口域 · ConstellationGate 星座入口静止检测
// 名库冻结名：ConstellationGate、IdleThreshold、StarPoint、
//            GatePosition、ConstellationGateState、
//            AutopilotThreshold、WallClock
// 关联冻结名：MoveSpeed（表现体系）、LateralAxis / DepthAxis
//            （空间域）
//
// 命名状态：GatePosition 的 lateral / depth 字段，以及
// ConstellationGateState 的三个状态字段
// （starPointDropped / starMapHeld / autopilotTriggered），
// 还有 update 方法及其形参，均已经 HANDOFF-ROUND-11
// 正式追认冻结，不再重命名。
//
// 状态链（严格按 HANDOFF-ROUND-06 边界，不做阈值微调）：
//   移动中 / 速度非 0  → 静止计时清零
//   连续静止满 20 秒    → 边沿触发 StarPoint 掉落（仅一次）
//   静止 20~30 秒       → 保持星图
//   静止满 30 秒        → 边沿触发 AI 接管（仅一次）
//
// 解耦：本类不出现 30 秒数值，AI 接管判定全部委托注入的
//      AutopilotThreshold 实例。
// 时间：统一使用冻结结构 WallClock（epochMs 毫秒），
//      秒级阈值在本文件边界处换算，不另造时间字段。
//
// VERDICT-086 返工（阶段 1）：presentation → service 边删除。
//      AutopilotThreshold 随 src/service 整体归档至 archive/；
//      PROTOCOL 验收轮裁定：30 秒判定改为从 constants 直接读取
//      AUTOPILOT_THRESHOLD_SECONDS（=30），不再经 service 注入。
//
// 归档说明（PROTOCOL 验收轮第三部分）：本文件属阶段 8 范围
//      （星图入口，stage-1.md §4 明确不在阶段 1），完成常量
//      直读改写后整文件归档至 archive/presentation/。
// ============================================================

import {
  IDLE_THRESHOLD_SECONDS,
  AUTOPILOT_THRESHOLD_SECONDS,
} from '../../constants';
import type { WallClock } from '../world/WorldInstance';

/**
 * GatePosition 入口判定坐标（正式冻结，承载横 / 纵轴）
 *
 * 字段 lateral / depth 承载名库空间域冻结的
 * LateralAxis（横轴）与 DepthAxis（深轴）；
 * 字段名经 ROUND-11 追认冻结（见文件头部命名状态）。
 */
export interface GatePosition {
  /** 横向位置（承载冻结名 LateralAxis） */
  lateral: number;
  /** 纵深位置（承载冻结名 DepthAxis） */
  depth: number;
}

/**
 * ConstellationGateState 单次检测结果（正式冻结）
 *
 * 三个字段经 ROUND-11 追认冻结（见文件头部命名状态）；
 * 掉落与接管为“边沿信号”（同一静止区间内只报一次）。
 *
 * StarPoint 本体结构名库未冻结，本类不负责生成 StarPoint
 * 实例（对象工厂未授权），仅上报掉落触发信号。
 */
export interface ConstellationGateState {
  /** 本次检测是否跨越 20 秒线（StarPoint 掉落边沿） */
  starPointDropped: boolean;
  /** 当前是否处于“20 秒到 30 秒之间保持星图”区间 */
  starMapHeld: boolean;
  /** 本次检测是否跨越 30 秒线（AI 接管边沿，对齐冻结名 AutopilotThreshold） */
  autopilotTriggered: boolean;
}

/**
 * ConstellationGate 星座入口
 */
export class ConstellationGate {
  /** 静止起始时刻（epochMs，WallClock 口径）；null 表示当前未静止 */
  private stationarySinceEpochMs: number | null = null;
  /** 上一次坐标，用于判定“位置无变化” */
  private lastPosition: GatePosition | null = null;
  /** StarPoint 掉落边沿是否已在本静止区间触发 */
  private starPointDropFired = false;
  /** AI 接管边沿是否已在本静止区间触发 */
  private autopilotFired = false;

  /**
   * 无参构造（PROTOCOL 验收轮裁定）：
   * 30 秒阈值不再由 AutopilotThreshold 注入，直接读
   * constants.AUTOPILOT_THRESHOLD_SECONDS；本类不持有
   * 任何 service 引用。
   */
  constructor() {}

  /**
   * 逐帧 / 逐拍驱动静止检测
   *
   * 静止条件（HANDOFF：由 MoveSpeed 和坐标判定）：
   * 坐标与上一次严格相等 且 MoveSpeed 为 0。
   * 未引入任何距离容差（容差未经冻结，禁止臆造）。
   *
   * @param position 当前坐标（lateral / depth）
   * @param moveSpeed 当前移动速度（冻结名 MoveSpeed，number 承载）
   * @param wallClock 当前挂钟时刻（ROUND-08 统一冻结结构 WallClock）
   */
  update(
    position: GatePosition,
    moveSpeed: number,
    wallClock: WallClock,
  ): ConstellationGateState {
    const positionChanged =
      this.lastPosition === null ||
      this.lastPosition.lateral !== position.lateral ||
      this.lastPosition.depth !== position.depth;

    if (positionChanged || moveSpeed !== 0) {
      // 发生移动：整条静止状态链复位（掉落/接管边沿重新武装）
      this.stationarySinceEpochMs = null;
      this.starPointDropFired = false;
      this.autopilotFired = false;
      this.lastPosition = position;
      return {
        starPointDropped: false,
        starMapHeld: false,
        autopilotTriggered: false,
      };
    }

    // 坐标无变化且速度为 0：开始或延续静止计时
    if (this.stationarySinceEpochMs === null) {
      this.stationarySinceEpochMs = wallClock.epochMs;
    }
    // 边界换算：毫秒差值 → 秒，与 SECONDS 口径常量比较
    const stationaryDurationSeconds =
      (wallClock.epochMs - this.stationarySinceEpochMs) / 1000;

    // 20 秒线：StarPoint 掉落（边沿）
    let starPointDropped = false;
    if (
      stationaryDurationSeconds >= IDLE_THRESHOLD_SECONDS &&
      !this.starPointDropFired
    ) {
      this.starPointDropFired = true;
      starPointDropped = true;
    }

    // 30 秒线：AI 接管（边沿）。
    // PROTOCOL 验收轮：直接与 constants.AUTOPILOT_THRESHOLD_SECONDS
    // 比较，不再经 AutopilotThreshold.isReached 注入。
    let autopilotTriggered = false;
    if (
      stationaryDurationSeconds >= AUTOPILOT_THRESHOLD_SECONDS &&
      !this.autopilotFired
    ) {
      this.autopilotFired = true;
      autopilotTriggered = true;
    }

    // 20~30 秒之间保持星图：满 20 秒且未到 30 秒接管阈值
    const starMapHeld =
      stationaryDurationSeconds >= IDLE_THRESHOLD_SECONDS &&
      stationaryDurationSeconds < AUTOPILOT_THRESHOLD_SECONDS;

    return { starPointDropped, starMapHeld, autopilotTriggered };
  }
}
