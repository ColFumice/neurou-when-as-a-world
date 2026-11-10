// ============================================================
// S6 角色域 · MoveSpeed 主角移动速度与移动计算（T2）
// 名库 v1.9 冻结名：MoveSpeed（v0.2 表现体系冻结名，本文件
//                  承载其逻辑速度语义；逻辑拖尾色与渲染分离
//                  INV-6）
// 关联冻结名：LateralAxis / DepthAxis / WorldMeter（world 域）
//             MapCenter（world 域，纵深裁剪基准）
// 常量：MAX_MOVE_SPEED_WM_PER_SECONDS、DEPTH_RANGE_WM
// 追认冻结名（HANDOFF-ROUND-12 PROTOCOL 全部批准）：
//   MoveInput / MovementResult / moveAlongAxes
//
// ROUND-13 / VERDICT-100 第 4 条 + 名库 v1.9 纵深语义：
//   DEPTH_RANGE_WM 表示总跨度（非单侧距离）；裁剪以 MapCenter
//   为基准，两侧各 ±半个总跨度；**必须计入中点偏移**。
//   原 ROUND-12 实现写死 ±halfDepthRange（围绕 0），仅当
//   MapCenter.depth = 0 时正确；现修正为按 center.depth 偏移
//   裁剪，符合名库硬约束；character → world 矩阵 A（允许）。
//
// 职责：速度上限裁剪、按本帧时长推进两轴坐标、纵深按
//       MapCenter 基准裁剪；纯基础运动学，不含业务决策；
//       不引用 cc。
// ============================================================

import {
  MAX_MOVE_SPEED_WM_PER_SECONDS,
  DEPTH_RANGE_WM,
} from '../../constants/index';
import type { LateralAxis } from '../world/LateralAxis';
import type { DepthAxis } from '../world/DepthAxis';
import type { MapCenter } from '../world/MapCenter';

/**
 * MoveSpeed 移动速度
 * 单位 WorldMeter/秒（VERDICT-088 后缀口径）；
 * 取值不得超过 constants.MAX_MOVE_SPEED_WM_PER_SECONDS。
 */
export type MoveSpeed = number;

/**
 * MoveInput 移动输入（文件内结构，名称为直译待追认）
 * 两轴方向分量，约定区间 [-1, 1]：负值负方向、正值正方向；
 * 由 presentation 采集后经 PlayerIntent.Move 传入，
 * 本域不读取任何渲染状态（INV-6）。
 */
export interface MoveInput {
  /** 横轴方向分量（LateralAxis 口径，[-1, 1]） */
  readonly lateral: number;
  /** 纵深轴方向分量（DepthAxis 口径，[-1, 1]） */
  readonly depth: number;
}

/**
 * MovementResult 移动结果（文件内结构，名称为直译待追认）
 * 推进后的两轴坐标，单位均为 WorldMeter。
 */
export interface MovementResult {
  /** 推进后的横轴坐标 */
  readonly lateral: LateralAxis;
  /** 推进后的纵深轴坐标（已按 DEPTH_RANGE_WM 裁剪） */
  readonly depth: DepthAxis;
}

/** 将分量裁剪到 [-1, 1]（基础数学） */
function clampAxisInput(value: number): number {
  if (value < -1) {
    return -1;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

/** 将速度裁剪到 [0, MAX_MOVE_SPEED_WM_PER_SECONDS]（基础数学） */
function clampSpeed(speed: MoveSpeed): MoveSpeed {
  if (speed < 0) {
    return 0;
  }
  if (speed > MAX_MOVE_SPEED_WM_PER_SECONDS) {
    return MAX_MOVE_SPEED_WM_PER_SECONDS;
  }
  return speed;
}

/**
 * 将纵深坐标按 MapCenter 基准裁剪到两侧各半个总跨度内
 * （基础数学；VERDICT-100 第 4 条 / 名库 v1.9 纵深语义）
 *
 * 即便 MapCenter.depth = 0（坐标基准以中点为零点），仍必须
 * 通过本函数显式计入中点偏移，不得绕过 center 直接写死
 * ±halfDepthRange —— 否则一旦地图中点非零，裁剪会偏离。
 *
 * @param depth 待裁剪的纵深坐标
 * @param center 地图中点（裁剪基准；名库 v1.9 硬约束）
 */
function clampDepth(depth: DepthAxis, center: MapCenter): DepthAxis {
  const halfDepthRange = DEPTH_RANGE_WM / 2;
  const minDepth = center.depth - halfDepthRange;
  const maxDepth = center.depth + halfDepthRange;
  if (depth < minDepth) {
    return minDepth;
  }
  if (depth > maxDepth) {
    return maxDepth;
  }
  return depth;
}

/**
 * 主角沿轴移动（AC-01；纯函数，无状态类）
 *
 * 位移 = 方向分量 × 速度 × 本帧时长：
 * - 横轴不设范围裁剪（地图横向远大于纵深，AC-01）；
 * - 纵深轴裁剪到 [center.depth - DEPTH_RANGE_WM/2,
 *   center.depth + DEPTH_RANGE_WM/2]，必须计入中点偏移
 *   （VERDICT-100 第 4 条 / 名库 v1.9 纵深语义）；
 * - 速度先裁剪到非负且不超过 MAX_MOVE_SPEED_WM_PER_SECONDS。
 *
 * 函数名 moveAlongAxes 为 HANDOFF“主角移动”的直译结构名，
 * 连同 MoveInput / MovementResult 已经 PROTOCOL 验收轮第一部分
 * 全部正式追认冻结（HANDOFF-ROUND-12）。
 *
 * @param current 当前两轴坐标
 * @param input 本帧两轴方向分量（[-1, 1]）
 * @param speed 当前移动速度（WorldMeter/秒）
 * @param frameDurationSeconds 本帧时长（秒）
 * @param center 地图中点（纵深裁剪基准；名库 v1.9 硬约束）
 */
export function moveAlongAxes(
  current: { readonly lateral: LateralAxis; readonly depth: DepthAxis },
  input: MoveInput,
  speed: MoveSpeed,
  frameDurationSeconds: number,
  center: MapCenter,
): MovementResult {
  const safeSpeed = clampSpeed(speed);
  const lateralInput = clampAxisInput(input.lateral);
  const depthInput = clampAxisInput(input.depth);

  const nextLateral: LateralAxis =
    current.lateral + lateralInput * safeSpeed * frameDurationSeconds;
  const nextDepth: DepthAxis = clampDepth(
    current.depth + depthInput * safeSpeed * frameDurationSeconds,
    center,
  );

  return { lateral: nextLateral, depth: nextDepth };
}
