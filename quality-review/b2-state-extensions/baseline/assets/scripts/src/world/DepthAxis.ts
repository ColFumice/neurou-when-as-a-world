﻿// ============================================================
// S2 地图域 · DepthAxis 纵深轴坐标（名库 v0.3 空间域冻结名）
// 依据：stage-1.md §3（坐标轴）、AC-01 / AC-04
//       （纵深移动、至少三层纵深）
//
// 职责：声明纵深轴坐标的单位类型；纯类型，不含逻辑。
// ============================================================

import type { WorldMeter } from './WorldMeter';

/**
 * DepthAxis 纵深轴
 * 主角少量靠近 / 远离所在轴；可移动跨度由
 * constants.DEPTH_RANGE_WM 约束，远小于地图横向（AC-01）。
 * 坐标值以 MapCenter 为原点，单位 WorldMeter（INV-9）。
 */
export type DepthAxis = WorldMeter;
