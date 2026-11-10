﻿// ============================================================
// S2 地图域 · MapCenter 地图中点 / CenterDistance 距中点距离
// 名库 v0.3 空间域冻结名：MapCenter、CenterDistance
// 依据：stage-1.md §3（地图中点、距中点距离）、
//       AC-05（调试面板显示主角距中点距离，单位 WorldMeter，
//       同时计入横轴和纵深轴）
//
// 职责：声明中点坐标结构与距中点距离类型，并提供唯一的
//       欧氏距离计算（横轴、纵深轴两轴同时计入）。
//       纯基础几何，不含业务决策；不引用 cc。
// ============================================================

import type { WorldMeter } from './WorldMeter';
import type { LateralAxis } from './LateralAxis';
import type { DepthAxis } from './DepthAxis';

/**
 * MapCenter 地图中点
 * 坐标轴原点；位置以横轴坐标 + 纵深轴坐标表达。
 */
export interface MapCenter {
  /** 中点的横轴坐标（WorldMeter） */
  readonly lateral: LateralAxis;
  /** 中点的纵深轴坐标（WorldMeter） */
  readonly depth: DepthAxis;
}

/**
 * CenterDistance 距中点距离（AC-05）
 * 主角位置相对 MapCenter 的直线距离，同时计入横轴与纵深轴；
 * 单位 WorldMeter（INV-9）。
 */
export type CenterDistance = WorldMeter;

/**
 * 平面坐标（文件内私有结构，不导出新名称）
 *
 * 主角位置与 MapCenter 同构：lateral / depth 两轴坐标。
 * 主角类型名（主角类）名库尚未冻结，故计算函数以本匿名
 * 同构形状承载位置参数，不臆造新导出名。
 */
interface PlanePosition {
  readonly lateral: LateralAxis;
  readonly depth: DepthAxis;
}

/**
 * 计算主角距 MapCenter 的距离（AC-05）
 *
 * 基础几何直定义：sqrt(Δlateral² + Δdepth²)，
 * 横轴与纵深轴同时计入；无业务决策、无第二距离单位。
 *
 * 函数名 calculateCenterDistance 为 HANDOFF“距中点距离”的
 * 直译结构名，待 PROTOCOL 追认。
 *
 * @param position 主角当前两轴坐标
 * @param center 地图中点
 */
export function calculateCenterDistance(
  position: PlanePosition,
  center: MapCenter,
): CenterDistance {
  const deltaLateral = position.lateral - center.lateral;
  const deltaDepth = position.depth - center.depth;
  return Math.sqrt(
    deltaLateral * deltaLateral + deltaDepth * deltaDepth,
  );
}
